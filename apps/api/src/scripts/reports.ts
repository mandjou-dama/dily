// Dily's review of reported listings and people, until an admin screen
// exists. Apple expects an answer within 24 hours (guideline 1.2):
//   pnpm --filter @dily/api reports:list
//   pnpm --filter @dily/api reports:resolve <report id> dismiss|remove|suspend
// dismiss: nothing against the rules. remove: the listing leaves Dily (only
// its seller still sees it). suspend: the account is signed out everywhere,
// can't sign in again, and its listings are hidden. The last two answer
// every open report about the same listing or person.
import Fastify from "fastify";
import { z } from "zod";
import { loadConfig } from "../config.js";
import { createPrisma } from "../lib/prisma.js";
import { createRedis } from "../lib/redis.js";
import type { OpenReport } from "../modules/moderation/moderation.service.js";
import { createServices } from "../services.js";

const args = z
  .union([
    z.tuple([z.literal("list")]),
    z.tuple([
      z.literal("resolve"),
      z.uuid(),
      z.enum(["dismiss", "remove", "suspend"]),
    ]),
  ])
  .safeParse(process.argv.slice(2));
if (!args.success) {
  console.error(
    "usage: reports:list | reports:resolve <report id> dismiss|remove|suspend",
  );
  process.exit(1);
}

const describe = (report: OpenReport) => {
  const reported = report.reportedUser;
  const lines = [
    `${report.id}  ${report.createdAt.toISOString()}  ${report.kind}: ${report.reason}`,
    `  reported: ${reported.fullName ?? "?"} ${reported.phoneE164}` +
      ` (${reported._count.reportsReceived} open report(s)` +
      `${reported.suspendedAt ? ", suspended" : ""})`,
    `  by: ${report.reporter ? `${report.reporter.fullName ?? "?"} ${report.reporter.phoneE164}` : "deleted account"}`,
  ];
  if (report.product) {
    lines.push(
      `  listing: ${report.productId} "${report.product.title}" (${report.product.status})`,
    );
  }
  if (report.conversationId) {
    lines.push(`  conversation: ${report.conversationId}`);
  }
  if (report.note) lines.push(`  note: ${report.note}`);
  return lines.join("\n");
};

const config = loadConfig();
const prisma = createPrisma(config.DATABASE_URL);
const redis = createRedis(config.REDIS_URL);
const services = createServices({
  config,
  prisma,
  redis,
  logger: Fastify().log,
});
try {
  if (args.data[0] === "list") {
    const reports = await services.moderation.openReports();
    console.log(
      reports.length === 0
        ? "No open reports."
        : reports.map(describe).join("\n\n"),
    );
  } else {
    const [, reportId, decision] = args.data;
    await services.moderation.resolveReport(reportId, decision);
    console.log(`Report ${reportId}: ${decision} done.`);
  }
} finally {
  await Promise.allSettled([prisma.$disconnect(), redis.quit()]);
}

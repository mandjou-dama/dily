import type { ReportReason } from "@dily/shared";
import type { FastifyBaseLogger } from "fastify";

/** What Dily needs to know about a new report, to look at it within 24 hours. */
export interface ReportAlert {
  reportId: string;
  kind: "listing" | "user";
  reason: ReportReason;
  note: string | null;
  reportedName: string;
  /** Open reports against that person, this one included. */
  openReports: number;
  reporterName: string;
  /** A listing report's title. */
  listingTitle: string | null;
  /** Where a person was reported from. */
  conversationId: string | null;
}

/** Tells Dily a report came in. Never throws: the report is saved either way. */
export interface ReportAlerter {
  alert(report: ReportAlert): Promise<void>;
}

const REASON_LABELS: Record<ReportReason, string> = {
  prohibited: "article interdit",
  counterfeit: "contrefaçon",
  scam: "arnaque",
  harassment: "insultes ou harcèlement",
  offensive: "contenu choquant",
  spam: "spam",
  other: "autre",
};

/** People's words as plain text: no bold, links or code blocks of their making. */
const plain = (text: string) => text.replace(/([\\`*_~|>[\]()])/g, "\\$1");

/** The Discord message, in French like the rest of Dily's side. */
export function reportMessage(report: ReportAlert): string {
  const lines = [
    `**Nouveau signalement** · ${report.kind === "listing" ? "annonce" : "personne"} · ${REASON_LABELS[report.reason]}`,
  ];
  if (report.listingTitle !== null) {
    lines.push(`Annonce : « ${plain(report.listingTitle)} »`);
  }
  lines.push(
    `Signalé : ${plain(report.reportedName)} (${report.openReports} signalement${report.openReports > 1 ? "s" : ""} ouvert${report.openReports > 1 ? "s" : ""})`,
    `Par : ${plain(report.reporterName)}`,
  );
  if (report.conversationId !== null) {
    lines.push(`Discussion : ${report.conversationId}`);
  }
  if (report.note !== null) lines.push(`Note : « ${plain(report.note)} »`);
  lines.push(
    `\`pnpm --filter @dily/api reports:resolve ${report.reportId} dismiss|remove|suspend\``,
  );
  return lines.join("\n");
}

/** Without a webhook (development): the API's logs only. */
export class LogReportAlerter implements ReportAlerter {
  constructor(private readonly logger: Pick<FastifyBaseLogger, "warn">) {}

  async alert(report: ReportAlert): Promise<void> {
    this.logger.warn(
      { reportId: report.reportId, kind: report.kind, reason: report.reason },
      "moderation: new report to review",
    );
  }
}

/**
 * Posts to a Discord channel's webhook (Server settings > Integrations >
 * Webhooks): a notification on the phone of whoever reviews reports.
 */
export class DiscordReportAlerter implements ReportAlerter {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly webhookUrl: string,
    private readonly logger: Pick<FastifyBaseLogger, "warn" | "error">,
    fetchImpl?: typeof fetch,
  ) {
    this.fetchImpl = fetchImpl ?? ((...args) => fetch(...args));
  }

  async alert(report: ReportAlert): Promise<void> {
    try {
      const res = await this.fetchImpl(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: reportMessage(report),
          // A note saying "@everyone" pings nobody
          allowed_mentions: { parse: [] },
        }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.error(
          { status: res.status, body: await res.text() },
          "moderation: Discord alert failed",
        );
      }
    } catch (error) {
      this.logger.error({ err: error }, "moderation: Discord alert failed");
    }
    // In the logs too: Discord may be down or the webhook deleted
    this.logger.warn(
      { reportId: report.reportId, kind: report.kind, reason: report.reason },
      "moderation: new report to review",
    );
  }
}

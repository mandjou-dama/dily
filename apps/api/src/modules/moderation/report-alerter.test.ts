import { describe, expect, it, vi } from "vitest";
import {
  DiscordReportAlerter,
  type ReportAlert,
  reportMessage,
} from "./report-alerter.js";

const REPORT: ReportAlert = {
  reportId: "8f3e6942-2a50-4139-91d9-35fd51444f31",
  kind: "listing",
  reason: "counterfeit",
  note: "@everyone **faux** logo",
  reportedName: "Aïcha Traoré",
  openReports: 2,
  reporterName: "Awa Diarra",
  listingTitle: "Vintage Denim Jacket",
  conversationId: null,
};

const logger = { warn: vi.fn(), error: vi.fn() };

describe("report alerts", () => {
  it("says in French what was reported, people's words kept plain", () => {
    expect(reportMessage(REPORT)).toBe(
      [
        "**Nouveau signalement** · annonce · contrefaçon",
        "Annonce : « Vintage Denim Jacket »",
        "Signalé : Aïcha Traoré (2 signalements ouverts)",
        "Par : Awa Diarra",
        "Note : « @everyone \\*\\*faux\\*\\* logo »",
        "`pnpm --filter @dily/api reports:resolve 8f3e6942-2a50-4139-91d9-35fd51444f31 dismiss|remove|suspend`",
      ].join("\n"),
    );
  });

  it("posts to the Discord webhook without pinging anyone", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    const alerter = new DiscordReportAlerter(
      "https://discord.test/api/webhooks/1/abc",
      logger,
      fetch,
    );

    await alerter.alert(REPORT);

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://discord.test/api/webhooks/1/abc");
    expect(JSON.parse(init.body as string)).toEqual({
      content: reportMessage(REPORT),
      allowed_mentions: { parse: [] },
    });
  });

  it("never throws when Discord is unreachable", async () => {
    const fetch = vi.fn(async () => {
      throw new Error("network down");
    });
    const alerter = new DiscordReportAlerter(
      "https://discord.test/api/webhooks/1/abc",
      logger,
      fetch,
    );

    await expect(alerter.alert(REPORT)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});

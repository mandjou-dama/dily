import type { PhoneE164 } from "@dily/shared";
import type { FastifyBaseLogger } from "fastify";
import { AppError } from "../../lib/errors.js";

/** Delivers a sign-in code. */
export interface OtpSender {
  send(to: PhoneE164, code: string): Promise<void>;
}

const sendFailed = () =>
  new AppError(
    502,
    "otp_unavailable",
    "We couldn't send the code on WhatsApp. Try again.",
  );

/** Development only: writes the code to the logs instead of sending it. */
export class ConsoleOtpSender implements OtpSender {
  constructor(private readonly logger: Pick<FastifyBaseLogger, "info">) {}

  async send(to: PhoneE164, code: string): Promise<void> {
    this.logger.info({ to, code }, "[OTP console] code not sent");
  }
}

/** No sending (`OTP_SENDER=none`): only test numbers, which get no message, can sign in. */
export class NoOtpSender implements OtpSender {
  async send(): Promise<void> {
    throw new AppError(
      503,
      "otp_unavailable",
      "Sign-in by WhatsApp isn't open yet.",
    );
  }
}

export interface WhatsAppOptions {
  apiBase: string;
  phoneNumberId: string;
  accessToken: string;
  /** Approved AUTHENTICATION template with a copy-code button. */
  templateName: string;
  templateLanguage: string;
  fetch?: typeof fetch;
}

/**
 * Sends the code with Meta's WhatsApp Cloud API. The authentication
 * template has a fixed body ("<code> est votre code de vérification") and a
 * copy-code button, both filled with the same code.
 */
export class WhatsAppOtpSender implements OtpSender {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly options: WhatsAppOptions,
    private readonly logger: Pick<FastifyBaseLogger, "error">,
  ) {
    this.fetchImpl = options.fetch ?? ((...args) => fetch(...args));
  }

  async send(to: PhoneE164, code: string): Promise<void> {
    const message = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      // Meta takes the number with or without "+"
      to: to.replace(/^\+/, ""),
      type: "template",
      template: {
        name: this.options.templateName,
        language: { code: this.options.templateLanguage },
        components: [
          { type: "body", parameters: [{ type: "text", text: code }] },
          {
            type: "button",
            sub_type: "url",
            index: "0",
            parameters: [{ type: "text", text: code }],
          },
        ],
      },
    };

    let res: Response;
    try {
      res = await this.fetchImpl(
        `${this.options.apiBase}/${this.options.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.options.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message),
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch (error) {
      this.logger.error({ err: error }, "WhatsApp request error");
      throw sendFailed();
    }

    if (!res.ok) {
      // Meta's error body names the cause (bad template, number not on
      // WhatsApp, rate limit…): logs only
      this.logger.error(
        { status: res.status, body: await res.text() },
        "WhatsApp send failed",
      );
      throw sendFailed();
    }
  }
}

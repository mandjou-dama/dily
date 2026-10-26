import type { PaymentFailureReason, PaymentProvider } from "@dily/shared";
import type { FastifyBaseLogger } from "fastify";

export interface PaymentRequest {
  paymentId: string;
  provider: PaymentProvider;
  payerPhone: string;
  amount: number;
}

/** The operator's answer: paid, or why not. */
export type PaymentOutcome =
  | { status: "succeeded"; reference: string }
  | { status: "failed"; reason: PaymentFailureReason };

export type PaymentOutcomeHandler = (
  paymentId: string,
  outcome: PaymentOutcome,
) => Promise<void>;

/**
 * Mobile money operators (Orange Money, Moov Money): `request` asks the
 * operator to show the payment on the payer's phone; the answer comes later,
 * through the handler given to `onOutcome` (a webhook for real operators).
 * A request the payer never confirms gets no answer: the payment expires.
 */
export interface PaymentGateway {
  request(payment: PaymentRequest): Promise<void>;
  onOutcome(handler: PaymentOutcomeHandler): void;
}

/**
 * No money moves: every payment succeeds after `delayMs`, except for test
 * payer numbers ending in 99 (refused), 98 (insufficient funds) and 97
 * (never confirmed, so it expires). Refused in production (config).
 */
export class SimulatedPaymentGateway implements PaymentGateway {
  private handler: PaymentOutcomeHandler | null = null;

  constructor(
    private readonly delayMs: number,
    private readonly logger: FastifyBaseLogger,
  ) {}

  onOutcome(handler: PaymentOutcomeHandler): void {
    this.handler = handler;
  }

  async request(payment: PaymentRequest): Promise<void> {
    const outcome = simulatedOutcome(payment);
    if (!outcome) return;
    const timer = setTimeout(() => {
      this.handler?.(payment.paymentId, outcome).catch((error: unknown) =>
        this.logger.error(
          { err: error, paymentId: payment.paymentId },
          "payments: simulated outcome failed",
        ),
      );
    }, this.delayMs);
    // A pending simulation never keeps the process alive
    timer.unref();
  }
}

/** What the simulated operator answers for a payer number; null: no answer. */
export function simulatedOutcome({
  paymentId,
  payerPhone,
}: Pick<PaymentRequest, "paymentId" | "payerPhone">): PaymentOutcome | null {
  if (payerPhone.endsWith("99")) return { status: "failed", reason: "refused" };
  if (payerPhone.endsWith("98")) {
    return { status: "failed", reason: "insufficient_funds" };
  }
  if (payerPhone.endsWith("97")) return null;
  return { status: "succeeded", reference: `SIM-${paymentId.slice(0, 8)}` };
}

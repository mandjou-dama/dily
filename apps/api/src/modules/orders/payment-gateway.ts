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

/** Money Dily sends: a payout to a seller, or a refund to a buyer. */
export interface TransferRequest {
  transferId: string;
  provider: PaymentProvider;
  phone: string;
  amount: number;
}

/** The operator's answer: sent, or why not ("refused": no such account). */
export type TransferOutcome =
  | { status: "succeeded"; reference: string }
  | { status: "failed"; reason: "refused" | "unavailable" };

export type TransferOutcomeHandler = (
  transferId: string,
  outcome: TransferOutcome,
) => Promise<void>;

/**
 * Mobile money operators (Orange Money, Moov Money): `request` asks the
 * operator to show the payment on the payer's phone; the answer comes later,
 * through the handler given to `onOutcome` (a webhook for real operators).
 * A request the payer never confirms gets no answer: the payment expires.
 *
 * `send` moves money the other way, from Dily's account to a number; the
 * answer comes through `onTransferOutcome`. The transfer id is the
 * operator's idempotency key: sending it again never pays twice.
 */
export interface PaymentGateway {
  request(payment: PaymentRequest): Promise<void>;
  onOutcome(handler: PaymentOutcomeHandler): void;
  send(transfer: TransferRequest): Promise<void>;
  onTransferOutcome(handler: TransferOutcomeHandler): void;
}

/**
 * No money moves: every payment succeeds after `delayMs`, except for test
 * payer numbers ending in 99 (refused), 98 (insufficient funds) and 97
 * (never confirmed, so it expires). Transfers succeed too, except to
 * numbers ending in 99 (no such account). Refused in production (config).
 */
export class SimulatedPaymentGateway implements PaymentGateway {
  private handler: PaymentOutcomeHandler | null = null;
  private transferHandler: TransferOutcomeHandler | null = null;

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

  onTransferOutcome(handler: TransferOutcomeHandler): void {
    this.transferHandler = handler;
  }

  async send(transfer: TransferRequest): Promise<void> {
    const outcome = simulatedTransferOutcome(transfer);
    const timer = setTimeout(() => {
      this.transferHandler?.(transfer.transferId, outcome).catch(
        (error: unknown) =>
          this.logger.error(
            { err: error, transferId: transfer.transferId },
            "transfers: simulated outcome failed",
          ),
      );
    }, this.delayMs);
    timer.unref();
  }
}

/** What the simulated operator answers for a transfer. */
export function simulatedTransferOutcome({
  transferId,
  phone,
}: Pick<TransferRequest, "transferId" | "phone">): TransferOutcome {
  if (phone.endsWith("99")) return { status: "failed", reason: "refused" };
  return { status: "succeeded", reference: `SIM-${transferId.slice(0, 8)}` };
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

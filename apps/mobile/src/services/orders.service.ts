import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type DirectBuyBody,
  type DisputeReason,
  type Order,
  type OrderDetails,
  orderDetailsSchema,
  orderSchema,
  type Payment,
  type PaymentBody,
  type PayoutAccount,
  paymentSchema,
  profileSchema,
  type Transfer,
  uploadedImageSchema,
} from "@dily/shared";
import { randomUUID } from "expo-crypto";

import { api } from "@/lib/api";
import { compressImage, imageFormData } from "@/lib/upload";
import { profileQueryKey } from "@/services/auth.service";
import { orderQueryKey } from "@/services/chat.service";
import { applyOrderToCache } from "@/services/offers.service";

export type { OrderDetails, Payment, Transfer };

/** Report photos: enough to see a defect, small over mobile data. */
const REPORT_PHOTO_MAX_SIDE = 1600;

/** While the payer confirms: in case a realtime event gets lost. */
const PAYMENT_POLL_MS = 3_000;

/**
 * The order and, for the buyer, its latest payment attempt. `poll`: fetched
 * again while that attempt waits for the payer.
 */
export function useOrderDetails(
  orderId: string | undefined,
  { poll = false }: { poll?: boolean } = {},
) {
  return useQuery({
    queryKey: orderQueryKey(orderId ?? ""),
    enabled: !!orderId,
    queryFn: () =>
      api.request(`/orders/${orderId}`, { schema: orderDetailsSchema }),
    refetchInterval: poll
      ? (query) => {
          const status = query.state.data?.payment?.status;
          return !status || status === "pending" ? PAYMENT_POLL_MS : false;
        }
      : false,
  });
}

/** "Acheter": an order at the listed price, held while the buyer pays. */
export function useDirectBuy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: DirectBuyBody) =>
      api.request("/orders", { method: "POST", body, schema: orderSchema }),
    onSuccess: (order) => applyOrderToCache(queryClient, order),
  });
}

/** New id for a payment attempt: kept across retries of the same one. */
export const newPaymentId = () => randomUUID();

/** "Payer": the operator asks the payer to confirm on their phone. */
export function usePay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ order, ...body }: PaymentBody & { order: Order }) =>
      api.request(`/orders/${order.id}/payments`, {
        method: "POST",
        body,
        schema: paymentSchema,
      }),
    onSuccess: (payment, { order }) => {
      // The waiting screen shows at once, then fetches the saved order
      queryClient.setQueryData<OrderDetails>(
        orderQueryKey(order.id),
        (details) =>
          details ?? {
            order,
            payment,
            handoverCode: null,
            dispute: null,
            transfer: null,
          },
      );
      applyPaymentToCache(queryClient, payment);
    },
  });
}

/** "Je n'ai rien reçu": the buyer stops waiting. */
export function useCancelPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      paymentId,
    }: {
      orderId: string;
      paymentId: string;
    }) =>
      api.request(`/orders/${orderId}/payments/${paymentId}/cancel`, {
        method: "POST",
        schema: paymentSchema,
      }),
    onSuccess: (payment) => applyPaymentToCache(queryClient, payment),
  });
}

/** A payment attempt's new status, on the payment screens. */
export function applyPaymentToCache(
  queryClient: QueryClient,
  payment: Payment,
) {
  queryClient.setQueryData<OrderDetails>(
    orderQueryKey(payment.orderId),
    (details) => {
      if (!details) return details;
      // An older attempt changing doesn't replace the latest one
      const current = details.payment;
      if (current && current.id !== payment.id) {
        if (current.createdAt > payment.createdAt) return details;
      }
      return { ...details, payment };
    },
  );
}

// After the payment: handover code, reported problems, refunds, payouts

/** An order's details as an action returned them: every screen showing it. */
function applyDetailsToCache(queryClient: QueryClient, details: OrderDetails) {
  queryClient.setQueryData(orderQueryKey(details.order.id), details);
  applyOrderToCache(queryClient, details.order);
}

const orderAction = (orderId: string, action: string, body?: object) =>
  api.request(`/orders/${orderId}/${action}`, {
    method: "POST",
    ...(body ? { body } : {}),
    schema: orderDetailsSchema,
  });

/** The seller types the code the buyer gave: the money leaves for them. */
export function useHandover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, code }: { orderId: string; code: string }) =>
      orderAction(orderId, "handover", { code }),
    onSuccess: (details) => applyDetailsToCache(queryClient, details),
  });
}

/** "J'ai reçu l'article": the buyer settles it without the code. */
export function useConfirmReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => orderAction(orderId, "confirm"),
    onSuccess: (details) => applyDetailsToCache(queryClient, details),
  });
}

export type ReportPhoto = { uri: string; width: number; height: number };

/** The buyer reports a problem: photos uploaded first, then the report. */
export function useReportProblem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      reason,
      note,
      photos,
    }: {
      orderId: string;
      reason: DisputeReason;
      note: string;
      photos: ReportPhoto[];
    }) => {
      const photoPaths: string[] = [];
      for (const photo of photos) {
        const uri = await compressImage(
          photo.uri,
          REPORT_PHOTO_MAX_SIDE,
          photo,
        );
        const { path } = await api.request("/media/report-images", {
          method: "POST",
          body: imageFormData(uri),
          schema: uploadedImageSchema,
        });
        photoPaths.push(path);
      }
      return orderAction(orderId, "dispute", { reason, note, photoPaths });
    },
    onSuccess: (details) => applyDetailsToCache(queryClient, details),
  });
}

/** The seller gives the money back: the listing is on sale again. */
export function useRefundBuyer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => orderAction(orderId, "refund"),
    onSuccess: (details) => applyDetailsToCache(queryClient, details),
  });
}

/** Where the seller receives money; waiting payouts leave at once. */
export function useSetPayoutAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (account: PayoutAccount) =>
      api.request("/me/payout-account", {
        method: "PUT",
        body: account,
        schema: profileSchema,
      }),
    onSuccess: (profile) => {
      queryClient.setQueryData(profileQueryKey(profile.id), profile);
    },
  });
}

/** Money sent to the user changed: the order's details show it. */
export function applyTransferToCache(
  queryClient: QueryClient,
  transfer: Transfer,
) {
  queryClient.setQueryData<OrderDetails>(
    orderQueryKey(transfer.orderId),
    (details) => details && { ...details, transfer },
  );
}

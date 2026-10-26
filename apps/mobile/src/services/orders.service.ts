import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type DirectBuyBody,
  type Order,
  type OrderDetails,
  orderDetailsSchema,
  orderSchema,
  type Payment,
  type PaymentBody,
  paymentSchema,
} from "@dily/shared";
import { randomUUID } from "expo-crypto";

import { api } from "@/lib/api";
import { orderQueryKey } from "@/services/chat.service";
import { applyOrderToCache } from "@/services/offers.service";

export type { OrderDetails, Payment };

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

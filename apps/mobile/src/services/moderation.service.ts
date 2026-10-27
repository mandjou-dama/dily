import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type BlockedUser,
  blockedUsersSchema,
  type ReportBody,
} from "@dily/shared";

import { api } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { CHAT_QUERY_KEY } from "@/services/chat.service";
import { PRODUCTS_QUERY_KEY } from "@/services/products.service";

export type { BlockedUser };

export const blockedUsersQueryKey = (userId: string | undefined) => [
  "moderation",
  "blocks",
  userId,
];

/** "Signaler": a listing, or the other person of a conversation. */
export function useReport() {
  return useMutation({
    mutationFn: (body: ReportBody) =>
      api.request("/reports", { method: "POST", body }),
  });
}

/** Blocking changes what the feed, the listings and the chats show. */
const refreshAfterBlock = (
  queryClient: QueryClient,
  userId: string | undefined,
) => {
  queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: blockedUsersQueryKey(userId) });
};

/** Blocks someone (`blocked: true`) or unblocks them. */
export function useSetBlocked() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  return useMutation({
    mutationFn: ({ userId, blocked }: { userId: string; blocked: boolean }) =>
      api.request(`/me/blocks/${userId}`, {
        method: blocked ? "PUT" : "DELETE",
      }),
    onSuccess: () => refreshAfterBlock(queryClient, session?.user.id),
  });
}

/** The people the user blocked, the latest first. */
export function useBlockedUsers() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: blockedUsersQueryKey(userId),
    enabled: !!userId,
    queryFn: async () =>
      (await api.request("/me/blocks", { schema: blockedUsersSchema })).items,
  });
}

import {
  type InfiniteData,
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  type FeedPage,
  feedPageSchema,
  type FeedProduct,
  likedIdsSchema,
  picksSchema,
  type Product,
  type ProductCondition,
  productSchema,
} from "@dily/shared";

import { api, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";
import { MessageType } from "@/components/notify/type";
import { useNotify } from "@/components/notify";

export type { FeedProduct, Product, ProductCondition };

export const PRODUCTS_QUERY_KEY = ["products"];
export type FeedFilters = {
  categorySlug?: string;
  // Matched anywhere in the title, case-insensitive
  search?: string;
};

export const feedQueryKey = ({ categorySlug, search }: FeedFilters) => [
  ...PRODUCTS_QUERY_KEY,
  "feed",
  categorySlug ?? "all",
  search ?? "",
];
const FEED_QUERY_KEY = [...PRODUCTS_QUERY_KEY, "feed"];
export const productQueryKey = (id: string) => [
  ...PRODUCTS_QUERY_KEY,
  "detail",
  id,
];
export const likedIdsQueryKey = (userId: string | undefined) => [
  "likes",
  userId,
];

function fetchFeedPage(
  { categorySlug, search }: FeedFilters,
  cursor: string | null,
): Promise<FeedPage> {
  const params = new URLSearchParams();
  if (categorySlug) params.set("category", categorySlug);
  if (search) params.set("search", search);
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  return api.request(`/products${query ? `?${query}` : ""}`, {
    schema: feedPageSchema,
  });
}

/** The home feed, newest first, optionally limited to one category slug. */
export function useProductFeed(
  filters: FeedFilters = {},
  // Search: keep showing the last results while the next term loads
  { keepPrevious = false } = {},
) {
  return useInfiniteQuery({
    queryKey: feedQueryKey(filters),
    queryFn: ({ pageParam }) => fetchFeedPage(filters, pageParam),
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    initialPageParam: null as string | null,
    // Keyset pagination: the API hands out the next page's cursor
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

/**
 * "Today's Pick": the most liked active listings of the last two weeks,
 * chosen by the API.
 */
export function useSpotlightPicks() {
  return useQuery({
    queryKey: [...PRODUCTS_QUERY_KEY, "picks"],
    queryFn: () => api.request("/products/picks", { schema: picksSchema }),
  });
}

/** Ids of the products the signed-in user liked: one small query instead of a per-card lookup. */
export function useLikedIds() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: likedIdsQueryKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { productIds } = await api.request("/me/likes", {
        schema: likedIdsSchema,
      });
      return new Set(productIds);
    },
  });
}

export const CONDITION_LABELS: Record<ProductCondition, string> = {
  new: "New",
  like_new: "Like new",
  good: "Good",
  used: "Used",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One listing with everything the details screen shows. Resolves to null
 * when it doesn't exist or isn't visible (archived by someone else), so a
 * stale deep link shows "not available" instead of an error.
 */
export function useProduct(id: string) {
  return useQuery({
    queryKey: productQueryKey(id),
    queryFn: async (): Promise<Product | null> => {
      // A malformed id from a link would only get a 400
      if (!UUID_PATTERN.test(id)) return null;
      try {
        return await api.request(`/products/${id}`, { schema: productSchema });
      } catch (error) {
        if (error instanceof ApiRequestError && error.code === "not_found") {
          return null;
        }
        throw error;
      }
    },
  });
}

type ToggleLikeVars = {
  productId: string;
  currentlyLiked: boolean;
};

const adjustLikesCount = (
  data: InfiniteData<FeedPage> | undefined,
  productId: string,
  delta: number,
) =>
  data && {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((product) =>
        product.id === productId
          ? {
              ...product,
              likesCount: Math.max(0, product.likesCount + delta),
            }
          : product,
      ),
    })),
  };

export function useToggleLike() {
  const queryClient = useQueryClient();
  const { notify } = useNotify();
  const { session } = useAuth();
  const userId = session?.user.id;
  const likesKey = likedIdsQueryKey(userId);

  return useMutation({
    mutationFn: ({ productId, currentlyLiked }: ToggleLikeVars) =>
      api.request(`/products/${productId}/like`, {
        method: currentlyLiked ? "DELETE" : "PUT",
      }),

    onMutate: async ({ productId, currentlyLiked }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: likesKey }),
        queryClient.cancelQueries({ queryKey: PRODUCTS_QUERY_KEY }),
      ]);

      const previousLikes = queryClient.getQueryData<Set<string>>(likesKey);
      const previousFeeds = queryClient.getQueriesData<InfiniteData<FeedPage>>({
        queryKey: FEED_QUERY_KEY,
      });
      const previousProduct = queryClient.getQueryData<Product | null>(
        productQueryKey(productId),
      );

      queryClient.setQueryData<Set<string>>(likesKey, (old) => {
        const next = new Set(old);
        if (currentlyLiked) next.delete(productId);
        else next.add(productId);
        return next;
      });
      const delta = currentlyLiked ? -1 : 1;
      queryClient.setQueriesData<InfiniteData<FeedPage>>(
        { queryKey: FEED_QUERY_KEY },
        (old) => adjustLikesCount(old, productId, delta),
      );
      queryClient.setQueryData<Product | null>(
        productQueryKey(productId),
        (old) =>
          old && { ...old, likesCount: Math.max(0, old.likesCount + delta) },
      );

      return { previousLikes, previousFeeds, previousProduct, productId };
    },

    onError: (_err, _vars, context) => {
      queryClient.setQueryData(likesKey, context?.previousLikes);
      context?.previousFeeds.forEach(([key, data]) =>
        queryClient.setQueryData(key, data),
      );
      if (context?.previousProduct !== undefined) {
        queryClient.setQueryData(
          productQueryKey(context.productId),
          context.previousProduct,
        );
      }
      notify(likeErrorNotif.text, likeErrorNotif.options);
    },

    onSettled: () => {
      // The database trigger owns likes_count: read back the real value
      queryClient.invalidateQueries({ queryKey: likesKey });
      queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY });
    },
  });
}

const likeErrorNotif: MessageType = {
  text: "Ouupsss",
  options: {
    description: "Something went wrong. Try again.",
  },
};

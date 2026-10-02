import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { supabase } from "@/services/supabase";
import type { Enums } from "@/types/supabase";
import { useAuth } from "@/providers/auth-provider";
import { MessageType } from "@/components/notify/type";
import { useNotify } from "@/components/notify";

export const PAGE_SIZE = 20;

export const PRODUCTS_QUERY_KEY = ["products"];
export const feedQueryKey = (categorySlug: string | undefined) => [
  ...PRODUCTS_QUERY_KEY,
  "feed",
  categorySlug ?? "all",
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

// Only what a card shows: the first image and the seller's name
const FEED_COLUMNS = `
  id, title, price, likes_count, created_at,
  seller:profiles!products_seller_id_fkey(full_name),
  images:product_images(path)
`;

// Filtering on the embedded category needs an inner join
const FEED_COLUMNS_BY_CATEGORY = `${FEED_COLUMNS}, category:categories!inner(slug)`;

export type FeedProduct = {
  id: string;
  title: string;
  price: number;
  likesCount: number;
  createdAt: string;
  sellerName: string;
  imagePath: string | null;
};

type FeedPage = FeedProduct[];

// Newest first; the cursor is the last card's (created_at, id)
type Cursor = { createdAt: string; id: string } | null;

async function fetchFeedPage(
  categorySlug: string | undefined,
  cursor: Cursor,
): Promise<FeedPage> {
  let query = supabase
    .from("products")
    .select(categorySlug ? FEED_COLUMNS_BY_CATEGORY : FEED_COLUMNS)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .order("position", { referencedTable: "product_images" })
    .limit(1, { referencedTable: "product_images" })
    .limit(PAGE_SIZE);

  if (categorySlug) query = query.eq("category.slug", categorySlug);

  // Keyset pagination: stays correct when new products are listed while
  // scrolling, unlike offsets
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query.overrideTypes<
    {
      id: string;
      title: string;
      price: number;
      likes_count: number;
      created_at: string;
      seller: { full_name: string | null } | null;
      images: { path: string }[];
    }[],
    { merge: false }
  >();
  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    price: row.price,
    likesCount: row.likes_count,
    createdAt: row.created_at,
    sellerName: row.seller?.full_name ?? "Dily",
    imagePath: row.images[0]?.path ?? null,
  }));
}

/** The home feed, newest first, optionally limited to one category slug. */
export function useProductFeed(categorySlug?: string) {
  return useInfiniteQuery({
    queryKey: feedQueryKey(categorySlug),
    queryFn: ({ pageParam }) => fetchFeedPage(categorySlug, pageParam),
    initialPageParam: null as Cursor,
    getNextPageParam: (lastPage) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      const last = lastPage[lastPage.length - 1];
      return { createdAt: last.createdAt, id: last.id };
    },
  });
}

/**
 * Ids of the products the signed-in user liked. One small query instead of
 * a per-card lookup; RLS only returns the user's own likes.
 */
export function useLikedIds() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: likedIdsQueryKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("likes")
        .select("product_id")
        .eq("user_id", userId!);
      if (error) throw error;
      return new Set(data.map((like) => like.product_id));
    },
  });
}

export type ProductCondition = Enums<"product_condition">;

export const CONDITION_LABELS: Record<ProductCondition, string> = {
  new: "New",
  like_new: "Like new",
  good: "Good",
  used: "Used",
};

export type Product = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  size: string | null;
  condition: ProductCondition;
  status: Enums<"product_status">;
  likesCount: number;
  createdAt: string;
  categoryName: string | null;
  seller: { id: string; name: string; avatarPath: string | null };
  // Ordered by position, the cover first
  imagePaths: string[];
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
      // A malformed id from a link would be a Postgres cast error
      if (!UUID_PATTERN.test(id)) return null;

      const { data, error } = await supabase
        .from("products")
        .select(
          `id, title, description, price, size, condition, status, likes_count, created_at,
          category:categories(name),
          seller:profiles!products_seller_id_fkey(id, full_name, avatar_url),
          images:product_images(path, position)`,
        )
        .eq("id", id)
        .order("position", { referencedTable: "product_images" })
        .maybeSingle()
        .overrideTypes<
          {
            id: string;
            title: string;
            description: string | null;
            price: number;
            size: string | null;
            condition: ProductCondition;
            status: Enums<"product_status">;
            likes_count: number;
            created_at: string;
            category: { name: string } | null;
            seller: {
              id: string;
              full_name: string | null;
              avatar_url: string | null;
            };
            images: { path: string; position: number }[];
          },
          { merge: false }
        >();
      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        title: data.title,
        description: data.description,
        price: data.price,
        size: data.size,
        condition: data.condition,
        status: data.status,
        likesCount: data.likes_count,
        createdAt: data.created_at,
        categoryName: data.category?.name ?? null,
        seller: {
          id: data.seller.id,
          name: data.seller.full_name ?? "Dily",
          avatarPath: data.seller.avatar_url,
        },
        imagePaths: data.images.map((image) => image.path),
      };
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
    pages: data.pages.map((page) =>
      page.map((product) =>
        product.id === productId
          ? {
              ...product,
              likesCount: Math.max(0, product.likesCount + delta),
            }
          : product,
      ),
    ),
  };

export function useToggleLike() {
  const queryClient = useQueryClient();
  const { notify } = useNotify();
  const { session } = useAuth();
  const userId = session?.user.id;
  const likesKey = likedIdsQueryKey(userId);

  return useMutation({
    mutationFn: async ({ productId, currentlyLiked }: ToggleLikeVars) => {
      if (!userId) throw new Error("Not signed in");

      const { error } = currentlyLiked
        ? await supabase
            .from("likes")
            .delete()
            .eq("product_id", productId)
            .eq("user_id", userId)
        : await supabase
            .from("likes")
            .insert({ product_id: productId, user_id: userId });
      if (error) throw error;
    },

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
      // The trigger owns likes_count: read back the real value
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

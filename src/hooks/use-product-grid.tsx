import { useCallback, useMemo } from "react";
import { useNavigation } from "@react-navigation/native";
import ProductCard from "@/components/product-card";
import {
  type FeedProduct,
  useLikedIds,
  useProductFeed,
  useToggleLike,
} from "@/services/products.service";
import { imageUrl } from "@/lib/image";
import { formatPrice } from "@/lib/format";

// Cards are ~180pt wide: 400px covers 2x density without decoding full photos
const CARD_IMAGE_WIDTH = 400;

const NO_PRODUCTS: FeedProduct[] = [];
const NO_LIKES = new Set<string>();

export const productKeyExtractor = (item: FeedProduct) => item.id;

/**
 * Everything a two-column product grid needs from a feed query: the flat
 * list, a memoized renderItem (cells only receive primitives), paging and
 * the like toggle. Shared by the home feed and search results.
 */
export function useProductGrid(feed: ReturnType<typeof useProductFeed>) {
  const navigation = useNavigation();
  const { data: likedIds = NO_LIKES, refetch: refetchLikes } = useLikedIds();
  const { mutate: toggleLike } = useToggleLike();

  const data = useMemo(
    () => feed.data?.pages.flat() ?? NO_PRODUCTS,
    [feed.data],
  );

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const openProduct = useCallback(
    (id: string) => navigation.navigate("ProductDetails", { id }),
    [navigation],
  );

  const onToggleLike = useCallback(
    (productId: string, currentlyLiked: boolean) =>
      toggleLike({ productId, currentlyLiked }),
    [toggleLike],
  );

  const renderItem = useCallback(
    ({ item }: { item: FeedProduct }) => (
      <ProductCard
        id={item.id}
        name={item.title}
        price={formatPrice(item.price)}
        imageUri={imageUrl("product-images", item.imagePath, CARD_IMAGE_WIDTH)}
        sellerName={item.sellerName}
        likeCount={item.likesCount}
        liked={likedIds.has(item.id)}
        onPress={openProduct}
        onToggleLike={onToggleLike}
      />
    ),
    [openProduct, onToggleLike, likedIds],
  );

  return { data, renderItem, loadMore, openProduct, refetchLikes };
}

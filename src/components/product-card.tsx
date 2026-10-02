import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { HeartIcon } from "lucide-react-native";
import { colors } from "@/theme/colors";

// Fixed sizes keep every cell the same height: FlashList never has to
// re-measure a row after an image loads.
export const PRODUCT_IMAGE_HEIGHT = 150;

type Props = {
  id: string;
  name: string;
  price: string;
  imageUri: string | null;
  sellerName: string;
  likeCount: number;
  liked: boolean;
  onPress: (id: string) => void;
  onToggleLike: (id: string, liked: boolean) => void;
};

// Only primitives (plus one stable callback) come in, so memo() can skip
// re-rendering cells whose data did not change.
const ProductCard = memo(function ProductCard({
  id,
  name,
  price,
  imageUri,
  sellerName,
  likeCount,
  liked,
  onPress,
  onToggleLike,
}: Props) {
  return (
    <Pressable
      onPress={() => onPress(id)}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${price} F CFA, sold by ${sellerName}`}
      style={styles.container}
    >
      <View style={styles.imageWrapper}>
        <Image
          source={imageUri}
          recyclingKey={id}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={200}
          style={styles.image}
        />

        <Pressable
          onPress={() => onToggleLike(id, liked)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={liked ? "Unlike" : "Like"}
          accessibilityState={{ selected: liked }}
          style={styles.likePill}
        >
          <HeartIcon
            fill={liked ? colors.primary : "transparent"}
            color={colors.primary}
            strokeWidth={2}
            size={14}
          />
          <Text style={styles.likeCount}>{likeCount}</Text>
        </Pressable>
      </View>

      <View style={styles.info}>
        <View style={styles.seller}>
          <View style={styles.sellerInitial}>
            <Text style={styles.sellerInitialText}>{sellerName.charAt(0)}</Text>
          </View>
          <Text numberOfLines={1} style={styles.sellerName}>
            {sellerName}
          </Text>
        </View>
        <Text numberOfLines={1} style={styles.name}>
          {name}
        </Text>
        <Text style={styles.price}>{price} F CFA</Text>
      </View>
    </Pressable>
  );
});

export default ProductCard;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 6,
    backgroundColor: colors.white,
    borderRadius: 22,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  imageWrapper: {
    height: PRODUCT_IMAGE_HEIGHT,
    borderRadius: 22,
    borderCurve: "continuous",
    overflow: "hidden",
    backgroundColor: "#EAE7DC",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  likePill: {
    position: "absolute",
    top: 10,
    right: 10,
    height: 28,
    paddingHorizontal: 10,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.white,
  },
  likeCount: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  info: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    gap: 2,
  },
  seller: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sellerInitial: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DFE3D2",
  },
  sellerInitialText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
  },
  sellerName: {
    flexShrink: 1,
    fontSize: 12,
    color: "#5A5A52",
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },
  skeletonBar: {
    borderRadius: 6,
    marginVertical: 2,
    backgroundColor: "#EAE7DC",
  },
  price: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.black,
  },
});

/** Same box as a card, shown while the feed loads. Static: no per-cell animation. */
export const ProductCardSkeleton = memo(function ProductCardSkeleton() {
  return (
    <View style={styles.container} accessibilityElementsHidden>
      <View style={styles.imageWrapper} />
      <View style={styles.info}>
        <View style={[styles.skeletonBar, { width: "45%", height: 12 }]} />
        <View style={[styles.skeletonBar, { width: "80%", height: 15 }]} />
        <View style={[styles.skeletonBar, { width: "35%", height: 13 }]} />
      </View>
    </View>
  );
});

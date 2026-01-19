import {
  TEST_USER_ID,
  useToggleLike,
  PRODUCTS_QUERY_KEY,
  useProducts,
} from "@/services/products.service";
import { useQueryClient } from "@tanstack/react-query";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { HeartIcon } from "lucide-react-native";
import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { MessageType } from "./notify/type";
import { createAnimatedComponent } from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";

const AnimatedImage = createAnimatedComponent(ExpoImage);

interface Props {
  user: {
    name: string;
    image: any;
  };
  productId: string;
}

const notifPayload: MessageType = {
  text: "Welcome",
  options: {
    description: "This is a normal notification",
    action: {
      label: "OK",
      onClick: () => {
        console.log("Notification action clicked");
      },
    },
  },
};

const ProductCard = ({ productId }: { productId: string }) => {
  const navigation = useNavigation();

  const { data: products } = useProducts();
  const toggleLike = useToggleLike();
  const [ratio, setRatio] = React.useState<number | null>(null);

  const item = products?.find((p) => p.id.toString() === productId);
  if (!item) return null;

  const { user, product, like } = item;

  const handleLike = () => {
    toggleLike.mutate({
      productId,
      userId: TEST_USER_ID,
      currentlyLiked: like.liked,
    });
  };

  return (
    <Pressable
      onPress={() => navigation.navigate("ProductDetails")}
      style={styles.container}
    >
      <View>
        <AnimatedImage
          sharedTransitionTag="product-image"
          contentFit="cover"
          source={product.image}
          transition={300}
          onLoad={(e) => {
            const { width, height } = e.source;
            setRatio(width / height);
          }}
          style={[styles.productImage, { aspectRatio: ratio || 16 / 9 }]}
        />

        <LinearGradient
          colors={["rgba(0,0,0,0.7)", "transparent"]}
          style={styles.gradient}
        />

        <Pressable
          hitSlop={20}
          onPress={() => console.log("liked")}
          style={styles.heart}
        >
          <HeartIcon
            style={{ pointerEvents: "none" }}
            fill={like.liked ? colors.primary : "transparent"}
            color={colors.primary}
            strokeWidth={1.5}
            size={20}
          />
          <Text style={styles.heartCount}>{like.number}</Text>
        </Pressable>
      </View>

      <View style={styles.productInfo}>
        <View style={styles.user}>
          <ExpoImage
            source={user.image}
            style={{ width: 15, height: 15, borderRadius: 100 }}
          />
          <Text style={styles.userName}>{user.name}</Text>
        </View>

        <Text numberOfLines={2} style={styles.productName}>
          {product.name}
        </Text>

        <Text style={styles.productPrice}>{product.price} F CFA</Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    // flex: 1,
    backgroundColor: colors.white,
    margin: 6,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 13,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  gradient: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "50%",
  },
  user: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    // position: "absolute",
    // top: 10,
    // left: 10,
    gap: 4,
  },
  heart: {
    flexDirection: "row",
    alignItems: "center",
    position: "absolute",
    top: 10,
    right: 10,
    gap: 2,
    backgroundColor: colors.white,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 100,
    borderCurve: "continuous",
  },

  heartCount: {
    fontSize: 12,
    fontWeight: "300",
    color: colors.primary,
  },

  userName: {
    fontSize: 12,
    fontWeight: "300",
    color: colors.black + "80",
  },
  productImage: {
    // flex: 1,
    width: "100%",
    alignSelf: "center",
    overflow: "hidden",
    borderRadius: 13,
    borderCurve: "continuous",
  },
  productInfo: {
    paddingHorizontal: spacing.sm + 5,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
  productState: {
    fontSize: 10,
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "300",
    color: colors.black + "80",
  },
  productPrice: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
});

export default ProductCard;

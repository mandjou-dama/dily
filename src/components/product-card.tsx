import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { HeartIcon } from "lucide-react-native";
import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";

type User = {
  name: string;
  image: any;
};

type Product = {
  name: string;
  image: any;
  price: string;
  size: string;
  state: string;
};

type Like = {
  liked: boolean;
  number: number;
};

interface Props {
  user: User;
  product: Product;
  like: Like;
}

const ProductCard = ({ user, product, like }: Props) => {
  const [ratio, setRatio] = React.useState<number | null>(null);

  const [liked, setLiked] = useState<boolean>(like.liked);
  const [heartCount, setHeartCount] = useState<number>(like.number);

  const handleLike = () => {
    setLiked(!liked);
    setHeartCount(heartCount + (liked ? -1 : 1));
  };

  return (
    <View style={styles.container}>
      <View style={{}}>
        <ExpoImage
          contentFit="cover"
          source={product.image}
          transition={1000}
          onLoad={(e) => {
            const { width, height } = e.source;
            setRatio(width / height);
          }}
          style={[styles.productImage, { aspectRatio: ratio || 16 / 9 }]}
        />

        <LinearGradient
          colors={["rgba(0, 0, 0, 0.7)", "transparent"]}
          style={styles.gradient}
        />

        <Pressable hitSlop={20} onPress={handleLike} style={styles.heart}>
          <HeartIcon
            fill={liked ? colors.primary : "transparent"}
            color={colors.primary}
            strokeWidth={1.5}
            size={20}
          />
          <Text style={styles.heartCount}>{heartCount}</Text>
        </Pressable>
      </View>

      <View style={styles.productInfo}>
        <View style={styles.user}>
          <ExpoImage
            transition={1000}
            source={user.image}
            style={{ width: 15, height: 15, borderRadius: 100 }}
          />
          <Text style={styles.userName}>{user.name}</Text>
        </View>
        <Text numberOfLines={2} style={styles.productName}>
          {product.name}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={styles.productState}>{product.state}</Text>
          <Text
            style={[
              styles.productState,
              { fontWeight: "600", color: colors.primary },
            ]}
          >
            •
          </Text>
          <Text style={[styles.productState]}>size {product.size}</Text>
        </View>

        <Text style={styles.productPrice}>{product.price} F CFA</Text>
      </View>
    </View>
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

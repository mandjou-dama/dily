import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { HeartIcon } from "lucide-react-native";
import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";

type User = {
  name: string;
  image: any;
};

type Product = {
  name: string;
  image: any;
  price: number;
  size: string;
  state: string;
};

interface Props {
  user: User;
  product: Product;
}

const ProductCard = ({ user, product }: Props) => {
  const [ratio, setRatio] = React.useState<number | null>(null);

  return (
    <View style={styles.container}>
      <View>
        <ExpoImage
          contentFit="cover"
          source={product.image}
          onLoad={(e) => {
            const { width, height } = e.source;
            setRatio(width / height);
          }}
          style={[
            styles.productImage,
            ratio ? { aspectRatio: ratio } : { minHeight: 150 },
          ]}
        />

        <LinearGradient
          colors={["rgba(0, 0, 0, 0.7)", "transparent"]}
          style={styles.gradient}
        />

        <View style={styles.user}>
          <ExpoImage source={user.image} style={{ width: 25, height: 25 }} />
          <Text style={styles.userName}>{user.name}</Text>
        </View>
      </View>

      <View style={styles.productInfo}>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.productState}>{product.state}</Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={styles.productPrice}>{product.price} F CFA</Text>
          <View style={styles.heart}>
            <HeartIcon fill={colors.primary} color={colors.primary} size={20} />
            <Text style={styles.heartCount}>12</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    margin: 6,
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
    position: "absolute",
    top: 10,
    left: 10,
    gap: 4,
  },
  heart: {
    flexDirection: "row",
    alignItems: "center",
    // position: "absolute",
    // top: 10,
    // right: 10,
    gap: 2,
  },

  heartCount: {
    fontSize: 12,
    fontWeight: "300",
    color: colors.primary,
  },

  userName: {
    fontSize: 12,
    fontWeight: "300",
    color: colors.white,
  },
  productImage: {
    width: "100%",
    alignSelf: "center",
    overflow: "hidden",
  },
  productInfo: {
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 2,
  },
  productName: {
    fontSize: 12,
    fontWeight: "300",
    color: colors.primary,
  },
  productState: {
    fontSize: 10,
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "300",
    color: colors.black,
  },
  productPrice: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
});

export default ProductCard;

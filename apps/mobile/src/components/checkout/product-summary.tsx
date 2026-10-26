import { listedTotal, type Conversation, type Order } from "@dily/shared";
import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";

import { imageUrl } from "@/lib/image";
import { amountLabel } from "@/lib/offers";
import { colors } from "@/theme/colors";

const THUMB_SIZE = 48;

type Props = {
  product: Conversation["product"];
  /** An accepted offer's order: the listed price struck through, then the agreed one. */
  agreed?: Order | null;
};

/** Thumbnail, title and price: the top of the payment screens. */
function ProductSummaryBase({ product, agreed }: Props) {
  const { t } = useTranslation();
  const price = amountLabel(product.price);
  const thumbUri = imageUrl(product.imagePath, THUMB_SIZE * 3);

  return (
    <View style={styles.row}>
      {thumbUri ? (
        <Image
          source={thumbUri}
          style={styles.thumb}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={styles.thumb} />
      )}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {product.title}
        </Text>
        <Text style={styles.price} numberOfLines={1}>
          {agreed ? (
            <>
              <Text style={styles.struck}>
                {amountLabel(listedTotal(agreed))}
              </Text>
              {" · "}
              <Text style={styles.agreed}>
                {agreed.fulfilment === "delivery"
                  ? t("deal.agreedDelivered", {
                      amount: amountLabel(agreed.amount),
                    })
                  : t("deal.agreed", { amount: amountLabel(agreed.amount) })}
              </Text>
            </>
          ) : product.size ? (
            t("deal.priceWithSize", { price, size: product.size })
          ) : (
            price
          )}
        </Text>
      </View>
    </View>
  );
}

export const ProductSummary = memo(ProductSummaryBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: colors.trackOnBackground,
  },
  text: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.black,
  },
  price: {
    fontSize: 14,
    color: colors.muted,
    fontVariant: ["tabular-nums"],
  },
  struck: {
    textDecorationLine: "line-through",
  },
  agreed: {
    fontWeight: "600",
    color: colors.noteText,
  },
});

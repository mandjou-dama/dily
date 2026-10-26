import { Pressable, StyleSheet, Text, View } from "react-native";
import { ProductCardSkeleton } from "@/components/product-card";
import { colors } from "@/theme/colors";

const SKELETON_COUNT = 6;

// Two columns of placeholder cards: the grid's layout before data arrives
export const GridLoading = () => (
  <View style={styles.skeletonGrid}>
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <View key={i} style={styles.skeletonCell}>
        <ProductCardSkeleton />
      </View>
    ))}
  </View>
);

export const GridMessage = ({
  title,
  text,
  onRetry,
}: {
  title: string;
  text?: string;
  onRetry?: () => void;
}) => (
  <View style={styles.message}>
    <Text style={styles.title}>{title}</Text>
    {text ? <Text style={styles.text}>{text}</Text> : null}
    {onRetry ? (
      <Pressable onPress={onRetry} hitSlop={12} accessibilityRole="button">
        <Text style={styles.retry}>Try again</Text>
      </Pressable>
    ) : null}
  </View>
);

export const GridError = ({ onRetry }: { onRetry: () => void }) => (
  <GridMessage
    title={"Couldn't load the listings"}
    text="Check your connection and try again."
    onRetry={onRetry}
  />
);

const styles = StyleSheet.create({
  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  skeletonCell: {
    width: "50%",
  },
  message: {
    paddingTop: 48,
    paddingHorizontal: 32,
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.black,
    textAlign: "center",
  },
  text: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  retry: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
  },
});

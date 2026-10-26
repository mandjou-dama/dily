import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { imageUrl } from "@/lib/image";
import { colors } from "@/theme/colors";

/** A person's photo, or the first letter of their name on a tinted disc. */
export const Avatar = ({
  name,
  path,
  size,
}: {
  name: string;
  path: string | null;
  size: number;
}) => {
  // 3x density
  const uri = imageUrl(path, size * 3);
  const shape = { width: size, height: size, borderRadius: size / 2 };

  return uri ? (
    <Image
      source={uri}
      style={[styles.image, shape]}
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={uri}
    />
  ) : (
    <View style={[styles.fallback, shape]}>
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    backgroundColor: "#EAE7DC",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DFE3D2",
  },
  initial: {
    fontWeight: "700",
    color: colors.primary,
  },
});

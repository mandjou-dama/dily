import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import {
  launchCameraAsync,
  launchImageLibraryAsync,
  requestCameraPermissionsAsync,
  requestMediaLibraryPermissionsAsync,
} from "expo-image-picker";
import { Camera, X } from "lucide-react-native";
import { colors } from "@/theme/colors";
import { imageUrl } from "@/lib/image";
import {
  MAX_PHOTOS,
  type ListingPhoto,
  photoKey,
} from "@/services/sell.service";
import { useHaptics } from "@/hooks/use-haptics";

const TILE_SIZE = 96;

type Props = {
  photos: ListingPhoto[];
  onChange: (photos: ListingPhoto[]) => void;
  hasError: boolean;
};

/**
 * Horizontal strip: an add tile, then the photos in order. The first photo
 * is the cover; tapping another makes it the cover.
 */
export function PhotoStrip({ photos, onChange, hasError }: Props) {
  const { impact } = useHaptics();
  const remaining = MAX_PHOTOS - photos.length;

  const addFrom = async (source: "camera" | "library") => {
    const permission =
      source === "camera"
        ? await requestCameraPermissionsAsync()
        : await requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        source === "camera" ? "Camera access needed" : "Photo access needed",
        "Allow access in Settings to add photos to your listing.",
      );
      return;
    }

    const result =
      source === "camera"
        ? await launchCameraAsync({ mediaTypes: "images", quality: 1 })
        : await launchImageLibraryAsync({
            mediaTypes: "images",
            allowsMultipleSelection: true,
            selectionLimit: remaining,
            orderedSelection: true,
            quality: 1,
          });
    if (result.canceled) return;

    const picked: ListingPhoto[] = result.assets.map((asset) => ({
      kind: "local",
      uri: asset.uri,
      width: asset.width,
      height: asset.height,
    }));
    onChange([...photos, ...picked].slice(0, MAX_PHOTOS));
  };

  const onAdd = () => {
    impact("light");
    const options = ["Take a photo", "Choose from library"];

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...options, "Cancel"], cancelButtonIndex: 2 },
        (index) => {
          if (index === 0) addFrom("camera");
          if (index === 1) addFrom("library");
        },
      );
    } else {
      Alert.alert("Add photos", undefined, [
        { text: options[0], onPress: () => addFrom("camera") },
        { text: options[1], onPress: () => addFrom("library") },
        { text: "Cancel", style: "cancel" },
      ]);
    }
  };

  const remove = (key: string) =>
    onChange(photos.filter((photo) => photoKey(photo) !== key));

  const makeCover = (key: string) => {
    const photo = photos.find((p) => photoKey(p) === key);
    if (!photo) return;
    impact("light");
    onChange([photo, ...photos.filter((p) => photoKey(p) !== key)]);
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {remaining > 0 ? (
          <Pressable
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel="Add photos"
            style={({ pressed }) => [
              styles.tile,
              styles.addTile,
              hasError && styles.addTileError,
              pressed && styles.pressed,
            ]}
          >
            <Camera size={24} color={colors.primary} strokeWidth={1.6} />
            <Text style={styles.addText}>Add photos</Text>
            <Text style={styles.addCount}>
              {photos.length}/{MAX_PHOTOS}
            </Text>
          </Pressable>
        ) : null}

        {photos.map((photo, index) => {
          const key = photoKey(photo);
          const uri =
            photo.kind === "local"
              ? photo.uri
              : imageUrl("product-images", photo.path, TILE_SIZE * 3);

          return (
            <Pressable
              key={key}
              onPress={() => makeCover(key)}
              disabled={index === 0}
              accessibilityRole="button"
              accessibilityLabel={
                index === 0 ? "Cover photo" : `Photo ${index + 1}, make cover`
              }
              style={styles.tile}
            >
              <Image source={uri} contentFit="cover" style={styles.photo} />
              {index === 0 ? (
                <View style={styles.coverBadge}>
                  <Text style={styles.coverText}>Cover</Text>
                </View>
              ) : null}
              <Pressable
                onPress={() => remove(key)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${index + 1}`}
                style={styles.removeButton}
              >
                <X size={14} color={colors.white} strokeWidth={2.5} />
              </Pressable>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[styles.hint, hasError && styles.hintError]}>
        {hasError
          ? "Add at least one photo."
          : photos.length > 1
            ? "Tap a photo to make it the cover."
            : "Good light, plain background: items with clear photos sell faster."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  strip: {
    gap: 10,
    paddingHorizontal: 20,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 18,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  addTile: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primary,
    backgroundColor: "#EEF0E6",
  },
  addTileError: {
    borderColor: colors.danger,
  },
  pressed: {
    opacity: 0.7,
  },
  addText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  addCount: {
    fontSize: 11,
    color: "#5A5A52",
    fontVariant: ["tabular-nums"],
  },
  photo: {
    width: "100%",
    height: "100%",
    backgroundColor: "#EAE7DC",
  },
  coverBadge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  coverText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.white,
  },
  removeButton: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(30, 30, 30, 0.6)",
  },
  hint: {
    paddingHorizontal: 20,
    fontSize: 12,
    color: "#5A5A52",
  },
  hintError: {
    color: colors.danger,
  },
});

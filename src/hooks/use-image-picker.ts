import { useCallback, useState } from "react";
import { Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  MediaType,
  launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync,
  UIImagePickerPresentationStyle,
} from "expo-image-picker";

type PickImagesOptions = {
  limit?: number; // how many images user can pick
  allowsEditing?: boolean;
  quality?: number;
};

export const useImagePicker = () => {
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [isPicking, setIsPicking] = useState(false);

  const pickImages = useCallback(
    async ({
      limit = 1,
      allowsEditing = true,
      quality = 1,
    }: PickImagesOptions = {}) => {
      try {
        setIsPicking(true);

        const permission = await requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(
            "Permission required",
            "Permission to access the media library is required."
          );
          return null;
        }

        const result = await launchImageLibraryAsync({
          mediaTypes: "images",
          presentationStyle: UIImagePickerPresentationStyle.FULL_SCREEN,
          allowsEditing: limit === 1 ? allowsEditing : false,
          allowsMultipleSelection: limit > 1,
          selectionLimit: limit > 1 ? limit : undefined,
          quality,
        });

        if (result.canceled) return null;

        setImages(result.assets);
        return result.assets;
      } catch (e) {
        console.warn("Image picker error:", e);
        return null;
      } finally {
        setIsPicking(false);
      }
    },
    []
  );

  const reset = () => setImages([]);

  return {
    images,
    imageUris: images.map((img) => img.uri),
    pickImages,
    reset,
    isPicking,
  };
};

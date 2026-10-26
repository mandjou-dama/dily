import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

const UPLOAD_QUALITY = 0.7;

/**
 * Resizes a picked image to `maxSide` (longest side) and re-encodes it as
 * JPEG: small over mobile data, and always a format the API accepts (iPhone
 * photos can be HEIC). The API makes its own sizes from it.
 */
export async function compressImage(
  uri: string,
  maxSide: number,
  // The picker gives it; otherwise the image is decoded once to read it
  size?: { width: number; height: number },
): Promise<string> {
  const { width, height } =
    size ?? (await ImageManipulator.manipulate(uri).renderAsync());
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > maxSide) {
    context.resize(width >= height ? { width: maxSide } : { height: maxSide });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({
    compress: UPLOAD_QUALITY,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}

/** Multipart body with the image as its `file` part, the way the API reads it. */
export function imageFormData(uri: string): FormData {
  const form = new FormData();
  // Expo's fetch (the global one since SDK 57) can't send React Native's
  // { uri, name, type } parts: it reads the bytes of a File instead
  form.append("file", new File(uri), "photo.jpg");
  return form;
}

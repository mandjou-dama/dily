import { supabase } from "@/services/supabase";

type Bucket = "avatars" | "product-images";

/**
 * Turns a stored image value into a URL resized to `width` px.
 * Lists must never decode full-resolution photos: on low-end Android this
 * is the main source of memory pressure and scroll jank.
 *
 * Columns hold a Storage path; values starting with "http" are external
 * URLs from the seed data (Pexels), resized with Pexels' own parameters.
 */
export function imageUrl(
  bucket: Bucket,
  value: string | null | undefined,
  width: number,
): string | null {
  if (!value) return null;

  if (value.startsWith("http")) {
    return value.includes("images.pexels.com")
      ? `${value}?auto=compress&cs=tinysrgb&w=${width}`
      : value;
  }

  return supabase.storage.from(bucket).getPublicUrl(value, {
    transform: { width, quality: 70 },
  }).data.publicUrl;
}

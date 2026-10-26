import { imageVariantFor } from "@dily/shared";
import { env } from "./env";

/**
 * Turns a stored image value into a URL of the smallest size covering
 * `width` px. Lists must never decode full-resolution photos: on low-end
 * Android this is the main source of memory pressure and scroll jank.
 *
 * Columns hold a media path; values starting with "http" are external
 * URLs from the seed data (Pexels), resized with Pexels' own parameters.
 */
export function imageUrl(
  value: string | null | undefined,
  width: number,
): string | null {
  if (!value) return null;

  if (value.startsWith("http")) {
    return value.includes("images.pexels.com")
      ? `${value}?auto=compress&cs=tinysrgb&w=${width}`
      : value;
  }

  return `${env.mediaUrl}/${value}-${imageVariantFor(width)}.webp`;
}

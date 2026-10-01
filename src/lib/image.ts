/**
 * Returns a resized, compressed variant of a remote product image.
 * Lists must never decode full-resolution photos: on low-end Android this
 * is the main source of memory pressure and scroll jank.
 *
 * Only Pexels URLs (the mock data) are resized for now; other hosts are
 * returned unchanged until the real storage (Supabase) is wired.
 */
export function thumbnailUrl(url: string, width: number): string {
  if (url.includes("images.pexels.com")) {
    return `${url}?auto=compress&cs=tinysrgb&w=${width}`;
  }
  return url;
}

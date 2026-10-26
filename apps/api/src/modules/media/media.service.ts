import { randomUUID } from "node:crypto";
import { IMAGE_VARIANTS, type ImageVariant } from "@dily/shared";
import sharp from "sharp";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { AppError } from "../../lib/errors.js";
import type { MediaStorage } from "./storage.js";

// A small VPS runs this: no decoded-image cache kept between uploads
sharp.cache(false);

export type MediaFolder = "products" | "avatars";

const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);
const WEBP_QUALITY = 75;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export const variantKey = (path: string, variant: ImageVariant) =>
  `${path}-${variant}.webp`;

/** External URLs (seed data) aren't ours to store or delete. */
const isStoredPath = (path: string) => !path.startsWith("http");

export interface MediaServiceDeps {
  prisma: PrismaClient;
  storage: MediaStorage;
}

/**
 * Uploaded images: re-encoded to WebP in every size of IMAGE_VARIANTS, under
 * `<folder>/<user id>/<random id>`. Re-encoding also drops EXIF data, GPS
 * position included.
 */
export class MediaService {
  constructor(private readonly deps: MediaServiceDeps) {}

  /** Stores an image for the user and returns its path. */
  async store(
    folder: MediaFolder,
    userId: string,
    input: Buffer,
  ): Promise<string> {
    const metadata = await sharp(input)
      .metadata()
      .catch(() => null);
    if (!metadata?.format || !ACCEPTED_FORMATS.has(metadata.format)) {
      throw new AppError(
        415,
        "unsupported_image",
        "Send a JPEG, PNG or WebP image.",
      );
    }

    const path = `${folder}/${userId}/${randomUUID()}`;
    const variants = await Promise.all(
      (Object.entries(IMAGE_VARIANTS) as [ImageVariant, number][]).map(
        async ([variant, size]) => ({
          key: variantKey(path, variant),
          body: await sharp(input)
            // Applies the EXIF orientation before it is dropped
            .rotate()
            .resize({
              width: size,
              height: size,
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: WEBP_QUALITY })
            .toBuffer(),
        }),
      ),
    );

    try {
      for (const { key, body } of variants) {
        await this.deps.storage.put(key, body, "image/webp");
      }
    } catch (error) {
      await this.deps.storage.delete(variants.map((v) => v.key));
      throw error;
    }
    return path;
  }

  /** True for a product image the user uploaded (`products/<uid>/<id>`). */
  isOwnProductImage(userId: string, path: string): boolean {
    return new RegExp(`^products/${userId}/${UUID}$`).test(path);
  }

  /** Deletes every size of these images. Best effort: a leftover file only costs storage. */
  async remove(paths: readonly string[]): Promise<void> {
    const keys = paths
      .filter(isStoredPath)
      .flatMap((path) =>
        (Object.keys(IMAGE_VARIANTS) as ImageVariant[]).map((v) =>
          variantKey(path, v),
        ),
      );
    if (keys.length > 0) await this.deps.storage.delete(keys);
  }

  /**
   * Deletes uploads the user gave up on (a listing that failed to save).
   * Only their own product images that no listing uses.
   */
  async discard(userId: string, paths: readonly string[]): Promise<void> {
    const own = paths.filter((path) => this.isOwnProductImage(userId, path));
    if (own.length === 0) return;
    const used = await this.deps.prisma.productImage.findMany({
      where: { path: { in: own } },
      select: { path: true },
    });
    const usedPaths = new Set(used.map((image) => image.path));
    await this.remove(own.filter((path) => !usedPaths.has(path)));
  }
}

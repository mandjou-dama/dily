import { z } from "zod";

/**
 * Every uploaded image is stored in these sizes (longest side, px), as
 * `<path>-<variant>.webp`. Lists never decode a full-size photo.
 */
export const IMAGE_VARIANTS = { sm: 400, lg: 1200 } as const;
export type ImageVariant = keyof typeof IMAGE_VARIANTS;

/** Smallest variant that covers `width` px, the largest past that. */
export const imageVariantFor = (width: number): ImageVariant =>
  width <= IMAGE_VARIANTS.sm ? "sm" : "lg";

export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

export const uploadedImageSchema = z.object({ path: z.string() });

export const discardImagesBodySchema = z.object({
  paths: z.array(z.string().min(1).max(200)).min(1).max(20),
});

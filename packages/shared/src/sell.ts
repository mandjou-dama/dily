import { z } from "zod";
import { productConditionSchema } from "./products";

export const MAX_LISTING_PHOTOS = 8;

/** A listing as the seller sends it, on create and on every edit. */
export const listingBodySchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z
    .string()
    .trim()
    .max(2000)
    .transform((value) => value || null),
  // Whole F CFA: XOF has no minor unit
  price: z.number().int().min(0).max(100_000_000),
  categoryId: z.number().int().positive(),
  condition: productConditionSchema,
  size: z
    .string()
    .trim()
    .max(20)
    .transform((value) => value || null),
  // Uploaded image paths in display order: the first one is the cover
  imagePaths: z
    .array(z.string().min(1).max(200))
    .min(1)
    .max(MAX_LISTING_PHOTOS),
});
export type ListingBody = z.input<typeof listingBodySchema>;

export const createdListingSchema = z.object({ id: z.uuid() });

export const listingStatusBodySchema = z.object({ sold: z.boolean() });

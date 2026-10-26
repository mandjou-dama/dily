import { z } from "zod";

export const FEED_PAGE_SIZE = 20;

export const productConditions = ["new", "like_new", "good", "used"] as const;
export const productConditionSchema = z.enum(productConditions);
export type ProductCondition = z.infer<typeof productConditionSchema>;

export const productStatuses = ["active", "sold", "archived"] as const;
export const productStatusSchema = z.enum(productStatuses);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const categorySchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  position: z.number().int(),
});
export type Category = z.infer<typeof categorySchema>;
export const categoriesSchema = z.array(categorySchema);

/** What a product card shows: the cover image, the seller's name, a Sold badge. */
export const feedProductSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  price: z.number().int(),
  // Always active in the feed; sold or archived in the profile tabs
  status: productStatusSchema,
  likesCount: z.number().int(),
  createdAt: z.iso.datetime(),
  sellerName: z.string(),
  imagePath: z.string().nullable(),
});
export type FeedProduct = z.infer<typeof feedProductSchema>;

export const feedQuerySchema = z.object({
  category: z.string().trim().min(1).max(40).optional(),
  // Matched anywhere in the title, case-insensitive
  search: z.string().trim().min(1).max(80).optional(),
  // Opaque: the `nextCursor` of the previous page
  cursor: z.string().max(200).optional(),
});
export type FeedQuery = z.infer<typeof feedQuerySchema>;

/** Paging of the profile tabs (own listings, favorites). */
export const pageQuerySchema = feedQuerySchema.pick({ cursor: true });

export const feedPageSchema = z.object({
  items: z.array(feedProductSchema),
  // Null on the last page
  nextCursor: z.string().nullable(),
});
export type FeedPage = z.infer<typeof feedPageSchema>;

export const picksSchema = z.array(feedProductSchema);

export const productSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  price: z.number().int(),
  size: z.string().nullable(),
  condition: productConditionSchema,
  status: productStatusSchema,
  likesCount: z.number().int(),
  createdAt: z.iso.datetime(),
  categoryId: z.number().int().nullable(),
  categoryName: z.string().nullable(),
  seller: z.object({
    id: z.uuid(),
    name: z.string(),
    avatarPath: z.string().nullable(),
    // "Hamdallaye ACI, Bamako", or just the city when no neighbourhood is set
    location: z.string(),
  }),
  // Ordered by position, the cover first
  imagePaths: z.array(z.string()),
});
export type Product = z.infer<typeof productSchema>;

export const likedIdsSchema = z.object({
  productIds: z.array(z.uuid()),
});

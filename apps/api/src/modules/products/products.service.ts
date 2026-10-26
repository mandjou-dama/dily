import {
  FEED_PAGE_SIZE,
  type Category,
  type FeedPage,
  type FeedProduct,
  type FeedQuery,
  type Product,
} from "@dily/shared";
import { z } from "zod";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { AppError, notFound } from "../../lib/errors.js";

// Only what a card shows: the cover image, the seller's name, a Sold badge
const FEED_SELECT = {
  id: true,
  title: true,
  price: true,
  status: true,
  likesCount: true,
  createdAt: true,
  seller: { select: { fullName: true } },
  images: { select: { path: true }, orderBy: { position: "asc" }, take: 1 },
} satisfies Prisma.ProductSelect;

type FeedRow = Prisma.ProductGetPayload<{ select: typeof FEED_SELECT }>;

const toFeedProduct = (row: FeedRow): FeedProduct => ({
  id: row.id,
  title: row.title,
  price: row.price,
  status: row.status,
  likesCount: row.likesCount,
  createdAt: row.createdAt.toISOString(),
  sellerName: row.seller.fullName ?? "Dily",
  imagePath: row.images[0]?.path ?? null,
});

// Newest first; the cursor is the last card's (date, id): its created_at in
// the feed, the moment it was liked in favorites
const cursorSchema = z.object({ c: z.iso.datetime(), i: z.uuid() });

const encodeCursor = (date: Date, id: string) =>
  Buffer.from(JSON.stringify({ c: date.toISOString(), i: id })).toString(
    "base64url",
  );

function decodeCursor(cursor: string) {
  try {
    const { c, i } = cursorSchema.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
    );
    return { date: new Date(c), id: i };
  } catch {
    throw new AppError(400, "validation_error", "Invalid cursor.");
  }
}

/** Rows strictly after the cursor in (date desc, id desc) order. */
const productsAfter = (cursor: string | undefined) => {
  if (!cursor) return {};
  const after = decodeCursor(cursor);
  return {
    OR: [
      { createdAt: { lt: after.date } },
      { createdAt: after.date, id: { lt: after.id } },
    ],
  } satisfies Prisma.ProductWhereInput;
};

/** One page out of PAGE_SIZE + 1 rows: the extra one tells whether another page follows. */
function toPage<T>(
  rows: T[],
  toItem: (row: T) => FeedProduct,
  cursorOf: (row: T) => string,
): FeedPage {
  const page = rows.slice(0, FEED_PAGE_SIZE);
  const last = page.at(-1);
  return {
    items: page.map(toItem),
    nextCursor: rows.length > FEED_PAGE_SIZE && last ? cursorOf(last) : null,
  };
}

const feedCursor = (row: FeedRow) => encodeCursor(row.createdAt, row.id);

// Prisma passes `contains` to ILIKE as is: a search for "50%" must match the
// % and _ wildcards literally
const escapeLike = (term: string) => term.replace(/[\\%_]/g, "\\$&");

const PICKS_COUNT = 5;
const PICKS_WINDOW_DAYS = 14;

/** A product is visible unless archived, in which case only its seller sees it. */
const visibleTo = (viewerId: string): Prisma.ProductWhereInput => ({
  OR: [{ status: { not: "archived" } }, { sellerId: viewerId }],
});

export interface ProductsServiceDeps {
  prisma: PrismaClient;
  now?: () => Date;
}

/** Reading the catalog, and likes. */
export class ProductsService {
  private readonly prisma: PrismaClient;
  private readonly now: () => Date;

  constructor(deps: ProductsServiceDeps) {
    this.prisma = deps.prisma;
    this.now = deps.now ?? (() => new Date());
  }

  categories(): Promise<Category[]> {
    return this.prisma.category.findMany({ orderBy: { position: "asc" } });
  }

  /**
   * Active listings, newest first. Keyset pagination: stays right when new
   * listings arrive while scrolling, unlike offsets.
   */
  async feed({ category, search, cursor }: FeedQuery): Promise<FeedPage> {
    const rows = await this.prisma.product.findMany({
      where: {
        status: "active",
        ...(category ? { category: { slug: category } } : {}),
        // ILIKE, served by the pg_trgm index on title
        ...(search
          ? { title: { contains: escapeLike(search), mode: "insensitive" } }
          : {}),
        ...productsAfter(cursor),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: FEED_PAGE_SIZE + 1,
      select: FEED_SELECT,
    });
    return toPage(rows, toFeedProduct, feedCursor);
  }

  /** The seller's own listings, sold and archived included, newest first. */
  async ownListings(sellerId: string, cursor?: string): Promise<FeedPage> {
    const rows = await this.prisma.product.findMany({
      where: { sellerId, ...productsAfter(cursor) },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: FEED_PAGE_SIZE + 1,
      select: FEED_SELECT,
    });
    return toPage(rows, toFeedProduct, feedCursor);
  }

  /** Listings the user liked and can still see, the latest like first. */
  async favorites(userId: string, cursor?: string): Promise<FeedPage> {
    const after = cursor ? decodeCursor(cursor) : null;
    const rows = await this.prisma.like.findMany({
      where: {
        userId,
        product: visibleTo(userId),
        ...(after
          ? {
              OR: [
                { createdAt: { lt: after.date } },
                { createdAt: after.date, productId: { lt: after.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { productId: "desc" }],
      take: FEED_PAGE_SIZE + 1,
      select: {
        createdAt: true,
        productId: true,
        product: { select: FEED_SELECT },
      },
    });
    return toPage(
      rows,
      (row) => toFeedProduct(row.product),
      (row) => encodeCursor(row.createdAt, row.productId),
    );
  }

  /**
   * "Today's Pick": the most liked active listings of the last two weeks, so
   * the banner stays fresh. Falls back to the most liked ever while the
   * catalog is small.
   */
  async picks(): Promise<FeedProduct[]> {
    const since = new Date(
      this.now().getTime() - PICKS_WINDOW_DAYS * 24 * 3600 * 1000,
    );
    const fetchPicks = async (from?: Date) => {
      const rows = await this.prisma.product.findMany({
        where: {
          status: "active",
          likesCount: { gt: 0 },
          // A pick without a photo would leave the banner empty
          images: { some: {} },
          ...(from ? { createdAt: { gte: from } } : {}),
        },
        orderBy: [{ likesCount: "desc" }, { createdAt: "desc" }],
        take: PICKS_COUNT,
        select: FEED_SELECT,
      });
      return rows.map(toFeedProduct);
    };

    const recent = await fetchPicks(since);
    return recent.length >= 3 ? recent : fetchPicks();
  }

  /** One listing with everything the details screen shows. */
  async product(viewerId: string, id: string): Promise<Product> {
    const row = await this.prisma.product.findFirst({
      where: { id, ...visibleTo(viewerId) },
      include: {
        category: { select: { name: true } },
        seller: {
          select: {
            id: true,
            fullName: true,
            avatarPath: true,
            neighbourhood: true,
            city: true,
          },
        },
        images: { select: { path: true }, orderBy: { position: "asc" } },
      },
    });
    if (!row) throw notFound("This listing isn't available.");

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      price: row.price,
      size: row.size,
      condition: row.condition,
      status: row.status,
      likesCount: row.likesCount,
      createdAt: row.createdAt.toISOString(),
      categoryId: row.categoryId,
      categoryName: row.category?.name ?? null,
      seller: {
        id: row.seller.id,
        name: row.seller.fullName ?? "Dily",
        avatarPath: row.seller.avatarPath,
        location: [row.seller.neighbourhood, row.seller.city]
          .filter(Boolean)
          .join(", "),
      },
      imagePaths: row.images.map((image) => image.path),
    };
  }

  /** Ids of the products the user liked: one small query instead of a lookup per card. */
  async likedIds(userId: string): Promise<string[]> {
    const likes = await this.prisma.like.findMany({
      where: { userId },
      select: { productId: true },
    });
    return likes.map((like) => like.productId);
  }

  /** Idempotent. `likes_count` follows through the database trigger. */
  async like(userId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, ...visibleTo(userId) },
      select: { id: true },
    });
    if (!product) throw notFound("This listing isn't available.");
    await this.prisma.like.createMany({
      data: [{ userId, productId }],
      skipDuplicates: true,
    });
  }

  async unlike(userId: string, productId: string): Promise<void> {
    await this.prisma.like.deleteMany({ where: { userId, productId } });
  }
}

import type { listingBodySchema } from "@dily/shared";
import type { z } from "zod";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { AppError, notFound } from "../../lib/errors.js";
import type { MediaService } from "../media/media.service.js";

export type Listing = z.output<typeof listingBodySchema>;

const listingNotFound = () =>
  notFound("This listing doesn't exist or isn't yours.");

export interface SellServiceDeps {
  prisma: PrismaClient;
  media: MediaService;
}

/** A seller's own listings. Every write checks the listing belongs to the caller. */
export class SellService {
  private readonly prisma: PrismaClient;

  constructor(private readonly deps: SellServiceDeps) {
    this.prisma = deps.prisma;
  }

  /** Publishes a listing with photos the seller already uploaded; returns its id. */
  async create(sellerId: string, listing: Listing): Promise<string> {
    await this.assertCategory(listing.categoryId);
    await this.assertUsablePaths(sellerId, null, listing.imagePaths, []);

    const { id } = await this.prisma.product.create({
      data: {
        sellerId,
        ...this.toFields(listing),
        images: {
          create: listing.imagePaths.map((path, position) => ({
            path,
            position,
          })),
        },
      },
      select: { id: true },
    });
    return id;
  }

  /**
   * Replaces a listing's fields and photos in one transaction, so an edit can
   * never leave it half updated. Removed photos are deleted afterwards.
   */
  async update(sellerId: string, id: string, listing: Listing): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id, sellerId },
      select: { images: { select: { path: true } } },
    });
    if (!product) throw listingNotFound();

    const previousPaths = product.images.map((image) => image.path);
    await this.assertCategory(listing.categoryId);
    await this.assertUsablePaths(
      sellerId,
      id,
      listing.imagePaths,
      previousPaths,
    );

    await this.prisma.$transaction([
      this.prisma.product.update({
        where: { id },
        data: this.toFields(listing),
      }),
      this.prisma.productImage.deleteMany({ where: { productId: id } }),
      this.prisma.productImage.createMany({
        data: listing.imagePaths.map((path, position) => ({
          productId: id,
          path,
          position,
        })),
      }),
    ]);

    await this.deps.media.remove(
      previousPaths.filter((p) => !listing.imagePaths.includes(p)),
    );
  }

  /** Sold listings stay visible (with a Sold badge) but leave the feed. */
  async setSold(sellerId: string, id: string, sold: boolean): Promise<void> {
    const { count } = await this.prisma.product.updateMany({
      where: { id, sellerId },
      data: { status: sold ? "sold" : "active" },
    });
    if (count === 0) throw listingNotFound();
  }

  async delete(sellerId: string, id: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id, sellerId },
      select: { images: { select: { path: true } } },
    });
    if (!product) throw listingNotFound();

    // Rows first (images cascade): if this fails, nothing is lost
    await this.prisma.product.delete({ where: { id } });
    await this.deps.media.remove(product.images.map((image) => image.path));
  }

  private toFields(listing: Listing) {
    return {
      title: listing.title,
      description: listing.description,
      price: listing.price,
      categoryId: listing.categoryId,
      condition: listing.condition,
      size: listing.size,
    };
  }

  private async assertCategory(categoryId: number): Promise<void> {
    const exists = await this.prisma.category.count({
      where: { id: categoryId },
    });
    if (exists === 0)
      throw new AppError(400, "validation_error", "Unknown category.");
  }

  /**
   * Photos must be the seller's own uploads (or ones the listing already
   * has), each once, and not used by another listing: deleting that one
   * would delete them.
   */
  private async assertUsablePaths(
    sellerId: string,
    productId: string | null,
    paths: readonly string[],
    currentPaths: readonly string[],
  ): Promise<void> {
    if (new Set(paths).size !== paths.length) {
      throw new AppError(
        400,
        "validation_error",
        "The same photo is listed twice.",
      );
    }
    const foreign = paths.some(
      (path) =>
        !currentPaths.includes(path) &&
        !this.deps.media.isOwnProductImage(sellerId, path),
    );
    if (foreign) {
      throw new AppError(
        403,
        "forbidden",
        "Photos must be uploaded by the seller.",
      );
    }
    const usedElsewhere = await this.prisma.productImage.count({
      where: {
        path: { in: [...paths] },
        ...(productId ? { productId: { not: productId } } : {}),
      },
    });
    if (usedElsewhere > 0) {
      throw new AppError(
        400,
        "validation_error",
        "A photo already belongs to another listing.",
      );
    }
  }
}

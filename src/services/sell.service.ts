import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { supabase } from "@/services/supabase";
import { useUser } from "@/providers/auth-provider";
import {
  PRODUCTS_QUERY_KEY,
  type ProductCondition,
} from "@/services/products.service";
import type { Tables } from "@/types/supabase";

export const MAX_PHOTOS = 8;
// Longest side after resizing: sharp on a phone, ~300 KB over mobile data
const PHOTO_MAX_SIDE = 1600;
const PHOTO_QUALITY = 0.7;

export type Category = Tables<"categories">;

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    // Categories change with a migration, not while the app runs
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("position");
      if (error) throw error;
      return data;
    },
  });
}

/** A photo in the form: picked on the phone, or already in Storage (edit). */
export type ListingPhoto =
  | { kind: "local"; uri: string; width: number; height: number }
  | { kind: "stored"; path: string };

export const photoKey = (photo: ListingPhoto) =>
  photo.kind === "local" ? photo.uri : photo.path;

export type ListingInput = {
  title: string;
  description: string;
  price: number;
  categoryId: number;
  condition: ProductCondition;
  size: string;
  // In display order: the first one is the cover
  photos: ListingPhoto[];
};

export type UploadProgress = { done: number; total: number };

/** Resizes and re-encodes a picked photo to a small JPEG. */
async function compressPhoto(photo: Extract<ListingPhoto, { kind: "local" }>) {
  const context = ImageManipulator.manipulate(photo.uri);
  if (Math.max(photo.width, photo.height) > PHOTO_MAX_SIDE) {
    context.resize(
      photo.width >= photo.height
        ? { width: PHOTO_MAX_SIDE }
        : { height: PHOTO_MAX_SIDE },
    );
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({
    compress: PHOTO_QUALITY,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}

/**
 * Uploads every local photo under <uid>/<productId>/ and returns the final
 * ordered list of Storage paths. Unique file names: an edited listing never
 * serves a cached old photo.
 */
async function uploadPhotos(
  userId: string,
  productId: string,
  photos: ListingPhoto[],
  onProgress: (progress: UploadProgress) => void,
  uploaded: string[],
) {
  const total = photos.filter((p) => p.kind === "local").length;
  const paths: string[] = [];
  onProgress({ done: 0, total });

  for (const photo of photos) {
    if (photo.kind === "stored") {
      paths.push(photo.path);
      continue;
    }

    const uri = await compressPhoto(photo);
    // fetch() on a file:// uri gives the bytes without base64 round trips
    const body = await fetch(uri).then((res) => res.arrayBuffer());
    const path = `${userId}/${productId}/${randomUUID()}.jpg`;

    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, body, { contentType: "image/jpeg" });
    if (error) throw error;

    uploaded.push(path);
    paths.push(path);
    onProgress({ done: uploaded.length, total });
  }

  return paths;
}

// Best effort: a leftover file only costs storage, never shows in the app
async function removeFiles(paths: string[]) {
  const ours = paths.filter((path) => !path.startsWith("http"));
  if (ours.length > 0) {
    await supabase.storage.from("product-images").remove(ours);
  }
}

const toRow = (input: ListingInput) => ({
  title: input.title.trim(),
  description: input.description.trim() || null,
  price: input.price,
  category_id: input.categoryId,
  condition: input.condition,
  size: input.size.trim() || null,
});

/** Publishes a new listing; resolves to its id. */
export function useCreateListing() {
  const queryClient = useQueryClient();
  const user = useUser();
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: ListingInput) => {
      // Known before the insert, so photos can go under the product's folder
      const productId = randomUUID();
      const uploaded: string[] = [];
      let created = false;

      try {
        const paths = await uploadPhotos(
          user.id,
          productId,
          input.photos,
          setProgress,
          uploaded,
        );

        const { error } = await supabase
          .from("products")
          .insert({ id: productId, seller_id: user.id, ...toRow(input) });
        if (error) throw error;
        created = true;

        const { error: imagesError } = await supabase.rpc(
          "set_product_images",
          { product: productId, paths },
        );
        if (imagesError) throw imagesError;

        return productId;
      } catch (error) {
        // Never leave a listing without photos, or photos without a listing
        if (created)
          await supabase.from("products").delete().eq("id", productId);
        await removeFiles(uploaded);
        throw error;
      } finally {
        setProgress(null);
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY }),
  });

  return { ...mutation, progress };
}

type UpdateListingVars = {
  id: string;
  input: ListingInput;
  // The listing's paths before the edit, to delete the removed ones
  previousPaths: string[];
};

export function useUpdateListing() {
  const queryClient = useQueryClient();
  const user = useUser();
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ id, input, previousPaths }: UpdateListingVars) => {
      const uploaded: string[] = [];

      try {
        const paths = await uploadPhotos(
          user.id,
          id,
          input.photos,
          setProgress,
          uploaded,
        );

        const { error } = await supabase
          .from("products")
          .update(toRow(input))
          .eq("id", id);
        if (error) throw error;

        const { error: imagesError } = await supabase.rpc(
          "set_product_images",
          { product: id, paths },
        );
        if (imagesError) throw imagesError;

        await removeFiles(previousPaths.filter((p) => !paths.includes(p)));
      } catch (error) {
        await removeFiles(uploaded);
        throw error;
      } finally {
        setProgress(null);
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY }),
  });

  return { ...mutation, progress };
}

/** Sold listings stay visible (with a Sold badge) but leave the feed. */
export function useSetListingSold() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, sold }: { id: string; sold: boolean }) => {
      const { error } = await supabase
        .from("products")
        .update({ status: sold ? "sold" : "active" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY }),
  });
}

export function useDeleteListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, paths }: { id: string; paths: string[] }) => {
      // Rows first: if this fails nothing is lost. Images rows cascade.
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
      await removeFiles(paths);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY }),
  });
}

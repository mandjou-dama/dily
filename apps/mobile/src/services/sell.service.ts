import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  categoriesSchema,
  type Category,
  createdListingSchema,
  type ListingBody,
  MAX_LISTING_PHOTOS,
  uploadedImageSchema,
} from "@dily/shared";

import { api } from "@/lib/api";
import { compressImage, imageFormData } from "@/lib/upload";
import {
  PRODUCTS_QUERY_KEY,
  type ProductCondition,
} from "@/services/products.service";

export const MAX_PHOTOS = MAX_LISTING_PHOTOS;
// Longest side sent: sharp on a phone, ~300 KB over mobile data
const PHOTO_MAX_SIDE = 1600;

export type { Category };

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    // Categories change with a migration, not while the app runs
    staleTime: Infinity,
    queryFn: () => api.request("/categories", { schema: categoriesSchema }),
  });
}

/** A photo in the form: picked on the phone, or already uploaded (edit). */
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
  pickup: boolean;
  // Null: no delivery
  deliveryFee: number | null;
};

export type UploadProgress = { done: number; total: number };

/**
 * Uploads every local photo and returns the final ordered list of image
 * paths. `uploaded` collects the new paths, to discard them if the listing
 * then fails to save.
 */
async function uploadPhotos(
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

    const uri = await compressImage(photo.uri, PHOTO_MAX_SIDE, photo);
    const { path } = await api.request("/media/product-images", {
      method: "POST",
      body: imageFormData(uri),
      schema: uploadedImageSchema,
    });

    uploaded.push(path);
    paths.push(path);
    onProgress({ done: uploaded.length, total });
  }

  return paths;
}

// Best effort: a leftover file only costs storage, never shows in the app
async function discardUploads(paths: string[]) {
  if (paths.length === 0) return;
  await api
    .request("/media/product-images", { method: "DELETE", body: { paths } })
    .catch(() => undefined);
}

const toBody = (input: ListingInput, imagePaths: string[]): ListingBody => ({
  title: input.title,
  description: input.description,
  price: input.price,
  categoryId: input.categoryId,
  condition: input.condition,
  size: input.size,
  imagePaths,
  pickup: input.pickup,
  deliveryFee: input.deliveryFee,
});

/** Publishes a new listing; resolves to its id. */
export function useCreateListing() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const mutation = useMutation({
    mutationFn: async (input: ListingInput) => {
      const uploaded: string[] = [];
      try {
        const paths = await uploadPhotos(input.photos, setProgress, uploaded);
        const { id } = await api.request("/listings", {
          method: "POST",
          body: toBody(input, paths),
          schema: createdListingSchema,
        });
        return id;
      } catch (error) {
        // Never leave photos without a listing
        await discardUploads(uploaded);
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
};

/** Saves an edit; the API deletes the photos the edit removed. */
export function useUpdateListing() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ id, input }: UpdateListingVars) => {
      const uploaded: string[] = [];
      try {
        const paths = await uploadPhotos(input.photos, setProgress, uploaded);
        await api.request(`/listings/${id}`, {
          method: "PUT",
          body: toBody(input, paths),
        });
      } catch (error) {
        await discardUploads(uploaded);
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
    mutationFn: ({ id, sold }: { id: string; sold: boolean }) =>
      api.request(`/listings/${id}/status`, {
        method: "PATCH",
        body: { sold },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY }),
  });
}

/** Deletes the listing; the API deletes its photos. */
export function useDeleteListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string }) =>
      api.request(`/listings/${id}`, { method: "DELETE" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: PRODUCTS_QUERY_KEY }),
  });
}

// Inlined by Metro at build time: process.env.EXPO_PUBLIC_X must be written in full
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export const env = {
  apiUrl,
  // Uploaded images: served by the API in development, a CDN later
  mediaUrl: process.env.EXPO_PUBLIC_MEDIA_URL ?? `${apiUrl}/media`,
} as const;

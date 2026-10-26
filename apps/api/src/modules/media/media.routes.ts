import { discardImagesBodySchema, MAX_IMAGE_UPLOAD_BYTES } from "@dily/shared";
import type {
  FastifyPluginAsync,
  FastifyRequest,
  preHandlerAsyncHookHandler,
} from "fastify";
import { authUser } from "../../lib/auth-guard.js";
import { AppError } from "../../lib/errors.js";
import type { RateLimiter, RateLimitRule } from "../../lib/rate-limit.js";
import { parseInput } from "../../lib/validation.js";
import type { MediaService } from "./media.service.js";

/** Bounds the disk space and CPU one account can take: 8 photos × ~12 listings an hour. */
export const UPLOAD_RATE_LIMIT: RateLimitRule = {
  max: 100,
  windowSeconds: 60 * 60,
};

/** Reads the single `file` part of a multipart request. */
export async function readImageUpload(
  request: FastifyRequest,
): Promise<Buffer> {
  if (!request.isMultipart()) {
    throw new AppError(
      400,
      "validation_error",
      "Send the image as multipart/form-data.",
    );
  }
  const file = await request.file({
    limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES, files: 1 },
  });
  if (!file)
    throw new AppError(400, "validation_error", "The `file` part is missing.");
  // Throws 413 past fileSize (RequestFileTooLargeError)
  return file.toBuffer();
}

export interface MediaRoutesOptions {
  media: MediaService;
  rateLimiter: RateLimiter;
  requireAuth: preHandlerAsyncHookHandler;
}

export const mediaRoutes: FastifyPluginAsync<MediaRoutesOptions> = async (
  app,
  { media, rateLimiter, requireAuth },
) => {
  app.addHook("preHandler", requireAuth);

  app.post("/media/product-images", async (request, reply) => {
    const user = authUser(request);
    await rateLimiter.consume(`upload:user:${user.id}`, UPLOAD_RATE_LIMIT);
    const path = await media.store(
      "products",
      user.id,
      await readImageUpload(request),
    );
    return reply.code(201).send({ path });
  });

  app.delete("/media/product-images", async (request, reply) => {
    const { paths } = parseInput(discardImagesBodySchema, request.body);
    await media.discard(authUser(request).id, paths);
    return reply.code(204).send();
  });
};

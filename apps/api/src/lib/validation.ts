import { z } from "zod";
import { AppError } from "./errors.js";

/** Validates network input against a shared schema; 400 `validation_error` otherwise. */
export function parseInput<T extends z.ZodType>(
  schema: T,
  input: unknown,
): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError(400, "validation_error", z.prettifyError(result.error));
  }
  return result.data;
}

export const uuidParamSchema = z.object({ id: z.uuid() });

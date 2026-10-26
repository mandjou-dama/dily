import { z } from "zod";
import { AppError } from "./errors.js";

// Keyset pagination, newest first: the cursor is the last item's (date, id).
// Stays right when new rows arrive while scrolling, unlike offsets.
const cursorSchema = z.object({ c: z.iso.datetime(), i: z.uuid() });

export const encodeCursor = (date: Date, id: string) =>
  Buffer.from(JSON.stringify({ c: date.toISOString(), i: id })).toString(
    "base64url",
  );

export function decodeCursor(cursor: string) {
  try {
    const { c, i } = cursorSchema.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
    );
    return { date: new Date(c), id: i };
  } catch {
    throw new AppError(400, "validation_error", "Invalid cursor.");
  }
}

/** One page out of `size` + 1 rows: the extra one tells whether another page follows. */
export function toPage<T, I>(
  rows: T[],
  size: number,
  toItem: (row: T) => I,
  cursorOf: (row: T) => string,
): { items: I[]; nextCursor: string | null } {
  const page = rows.slice(0, size);
  const last = page.at(-1);
  return {
    items: page.map(toItem),
    nextCursor: rows.length > size && last ? cursorOf(last) : null,
  };
}

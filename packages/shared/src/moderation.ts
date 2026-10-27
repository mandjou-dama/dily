import { z } from "zod";

/** Same limit as `reports_note_check`. */
export const REPORT_NOTE_MAX_LENGTH = 500;

export const reportReasons = [
  // Weapons, drugs, animals… what can't be sold on Dily
  "prohibited",
  "counterfeit",
  "scam",
  // Insults, threats, unwanted advances
  "harassment",
  // Shocking photos or words
  "offensive",
  "spam",
  "other",
] as const;
export const reportReasonSchema = z.enum(reportReasons);
export type ReportReason = z.infer<typeof reportReasonSchema>;

/** What a listing can be reported for, in the order the app lists them. */
export const listingReportReasons = [
  "prohibited",
  "counterfeit",
  "scam",
  "offensive",
  "spam",
  "other",
] as const satisfies readonly ReportReason[];

/** What a person can be reported for, from a conversation. */
export const userReportReasons = [
  "scam",
  "harassment",
  "offensive",
  "spam",
  "other",
] as const satisfies readonly ReportReason[];

const reportNoteSchema = z
  .string()
  .trim()
  .max(REPORT_NOTE_MAX_LENGTH)
  .nullish()
  .transform((value) => value || null);

/**
 * `POST /reports`: a listing, or the other person of a conversation. Dily
 * reads the conversation to check what happened.
 */
export const reportBodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("listing"),
    productId: z.uuid(),
    reason: z.enum(listingReportReasons),
    note: reportNoteSchema,
  }),
  z.object({
    kind: z.literal("user"),
    conversationId: z.uuid(),
    reason: z.enum(userReportReasons),
    note: reportNoteSchema,
  }),
]);
export type ReportBody = z.input<typeof reportBodySchema>;
export type ReportInput = z.output<typeof reportBodySchema>;

/** Someone the signed-in user blocked. */
export const blockedUserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  avatarPath: z.string().nullable(),
  blockedAt: z.iso.datetime(),
});
export type BlockedUser = z.infer<typeof blockedUserSchema>;

export const blockedUsersSchema = z.object({
  // The latest blocked first
  items: z.array(blockedUserSchema),
});
export type BlockedUsers = z.infer<typeof blockedUsersSchema>;

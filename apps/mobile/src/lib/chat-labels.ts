import i18n from "@/i18n";

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Separator between days of a conversation: "Aujourd'hui", "Hier", "lundi 12 octobre". */
export function chatDayLabel(isoDate: string, now = new Date()) {
  const date = new Date(isoDate);
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return i18n.t("chat.today");
  if (days === 1) return i18n.t("chat.yesterday");
  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** "10:02 · Lu" under a message the other person read; the time alone otherwise. */
export const messageMeta = (time: string, read: boolean) =>
  read ? `${time} · ${i18n.t("chat.read")}` : time;

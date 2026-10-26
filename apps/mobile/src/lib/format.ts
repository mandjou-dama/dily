/** 23000 → "23 000": whole F CFA with a space every three digits. */
export const formatPrice = (price: number) =>
  Math.round(price)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** "+22370000000" → "+223 70 00 00 00", the way Malians write numbers. */
export const formatPhone = (phone: string) =>
  phone.replace(/^\+(\d{3})(\d{2})(\d{2})(\d{2})(\d{2})$/, "+$1 $2 $3 $4 $5");

/** "just now", "5 min ago", "3 h ago", "2 d ago", then the date. */
export function timeAgo(isoDate: string, now = Date.now()) {
  const minutes = Math.floor((now - new Date(isoDate).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(isoDate).toLocaleDateString();
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** Whole days between the date and today: 0 today, 1 yesterday. */
const daysAgo = (date: Date, now: Date) =>
  Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);

/** "14:05", the time a message was sent. */
export const messageTime = (isoDate: string) =>
  new Date(isoDate).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

/** Conversation list: "14:05" today, "Yesterday", "Mon" this week, then the date. */
export function chatListTime(isoDate: string, now = new Date()) {
  const date = new Date(isoDate);
  const days = daysAgo(date, now);
  if (days <= 0) return messageTime(isoDate);
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

/** Separator between days of a conversation: "Today", "Yesterday", "Monday 12 October". */
export function chatDayLabel(isoDate: string, now = new Date()) {
  const date = new Date(isoDate);
  const days = daysAgo(date, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** Two dates on the same calendar day, in the device's time zone. */
export const isSameDay = (a: string, b: string) =>
  startOfDay(new Date(a)) === startOfDay(new Date(b));

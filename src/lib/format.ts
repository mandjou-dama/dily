/** 23000 → "23 000": whole F CFA with a space every three digits. */
export const formatPrice = (price: number) =>
  Math.round(price)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

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

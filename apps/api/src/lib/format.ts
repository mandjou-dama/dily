/** 17200 → "17 200": whole F CFA with a space every three digits, as in the app. */
export const formatPrice = (amount: number) =>
  Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");

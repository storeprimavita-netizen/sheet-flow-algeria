export function fmtDZD(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n) + " DZD";
}
export function fmtUSD(n: number): string {
  return "$" + new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}
export function fmt(n: number, currency: "DZD" | "USD"): string {
  return currency === "DZD" ? fmtDZD(n) : fmtUSD(n);
}
export function dual(dzd: number, usd: number): string {
  return `${fmtDZD(dzd)} • ${fmtUSD(usd)}`;
}

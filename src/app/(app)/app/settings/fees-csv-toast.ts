/** Which success toast a CSV apply gets: a commune-only file changes no fee, so say what did change. */
export function csvSuccessToast(changed: number, communeRows: number): { key: "success" | "successCommunes"; count: number } {
  return changed === 0 && communeRows > 0 ? { key: "successCommunes", count: communeRows } : { key: "success", count: changed };
}

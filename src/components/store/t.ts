import ar from "@/messages/ar.json";

/** The store is Arabic only and never reads the locale cookie: strings come straight from ar.json. */
// the admin strings live under store.admin and never reach the public bundle
const { admin: _admin, ...publicMessages } = ar.store as typeof ar.store & { admin?: unknown };
export const storeMessages = publicMessages as Omit<typeof ar.store, "admin">;

type Messages = typeof storeMessages;
type Leaf<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaf<T[K], `${P}${K}.`>;
}[keyof T & string];
export type StoreKey = Leaf<Messages>;

export function st(key: StoreKey, params?: Record<string, string | number>): string {
  const raw = key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], storeMessages);
  return String(raw).replace(/\{(\w+)\}/g, (_, k: string) => String(params?.[k] ?? ""));
}

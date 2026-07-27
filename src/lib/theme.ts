/** Theme preference — cookie-based, same no-JS pattern as the locale cookie. */

export const themes = ["dark", "light"] as const;
export type Theme = (typeof themes)[number];

export const defaultTheme: Theme = "dark";
export const THEME_COOKIE = "theme";

export function isTheme(value: string | undefined | null): value is Theme {
  return value === "dark" || value === "light";
}

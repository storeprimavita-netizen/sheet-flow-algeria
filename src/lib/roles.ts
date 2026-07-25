/** Client-safe role definitions (no server-only imports). */

export type Role = "admin" | "confirmation_agent" | "delivery_agent";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  confirmation_agent: "Confirmation Agent",
  delivery_agent: "Delivery Agent",
};

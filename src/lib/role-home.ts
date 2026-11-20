import type { Role } from "@/lib/roles";

/** Where a role lands: agents on "My day", admins on the dashboard, no role on login. */
export function roleHome(role: Role | null): string {
  if (role === "admin") return "/app/dashboard";
  if (role === "confirmation_agent" || role === "delivery_agent") return "/app/my-day";
  return "/login";
}

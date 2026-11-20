import { describe, expect, it } from "vitest";

import { roleHome } from "@/lib/role-home";

describe("roleHome", () => {
  it("agent -> /app/my-day, admin -> /app/dashboard, none -> /login", () => {
    expect(roleHome("confirmation_agent")).toBe("/app/my-day");
    expect(roleHome("delivery_agent")).toBe("/app/my-day");
    expect(roleHome("admin")).toBe("/app/dashboard");
    expect(roleHome(null)).toBe("/login");
  });
});

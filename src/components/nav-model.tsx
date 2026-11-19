import {
  LayoutDashboard,
  ListChecks,
  PhoneCall,
  Truck,
  Package,
  Boxes,
  Calculator,
  BarChart3,
  Receipt,
  Megaphone,
  Banknote,
  HandCoins,
  Landmark,
  Users,
  UserCog,
  Building2,
  BookText,
  CalendarClock,
  KanbanSquare,
  Gauge,
  ScrollText,
  Store,
  FileText,
  SlidersHorizontal,
  Settings as SettingsIcon,
  MapPinned,
  CalendarRange,
} from "lucide-react";

import type { Role } from "@/lib/roles";
import type { IconType } from "@/lib/statuses";

export type CounterKey = "confirmation" | "delivery" | "tasks";

export type NavLeaf = {
  key: string; // i18n key under nav.*
  oldKey?: string; // previous label, i18n key under navOld.* (⌘K matches it too)
  href: string;
  match?: string[]; // extra path prefixes that light this leaf (longest prefix wins)
  icon: IconType;
  adminOnly?: boolean;
  counter?: CounterKey;
};

export type NavGroup = {
  key: string; // i18n key under nav.*
  items: NavLeaf[];
  pinned?: "bottom";
  defaultClosed?: boolean; // collapsed until the user opens it (still forced open when active)
};

export type VisibleNav = { home: NavLeaf | null; groups: NavGroup[] };

export const HOME: NavLeaf = {
  key: "home",
  oldKey: "dashboard",
  href: "/app/dashboard",
  icon: LayoutDashboard,
  adminOnly: true,
};

// Only routes that exist today; empty groups are not rendered.
export const GROUPS: NavGroup[] = [
  {
    key: "groupSell",
    items: [
      { key: "confirmation", href: "/app/orders/confirmation", icon: PhoneCall, counter: "confirmation" },
      { key: "shipping", oldKey: "delivery", href: "/app/orders/delivery", icon: Truck, counter: "delivery" },
      { key: "all", href: "/app/orders/all", match: ["/app/orders"], icon: ListChecks, adminOnly: true },
      { key: "customers", oldKey: "contacts", href: "/app/contacts", icon: Users, adminOnly: true },
      { key: "statistics", href: "/app/statistics", icon: MapPinned, adminOnly: true },
    ],
  },
  {
    key: "groupCatalog",
    items: [
      { key: "products", href: "/app/products", icon: Package, adminOnly: true },
      { key: "stock", href: "/app/stock", icon: Boxes, adminOnly: true },
      { key: "pricing", oldKey: "planner", href: "/app/pricing", icon: Calculator, adminOnly: true },
    ],
  },
  {
    key: "groupStore",
    items: [
      { key: "storeHub", href: "/app/store", icon: Store, adminOnly: true },
      { key: "storePages", href: "/app/store/pages", icon: FileText, adminOnly: true },
      { key: "storeSettings", href: "/app/store/settings", icon: SlidersHorizontal, adminOnly: true },
    ],
  },
  {
    key: "groupMoney",
    items: [
      { key: "financeOverview", href: "/app/finance/overview", icon: BarChart3, adminOnly: true },
      { key: "accounts", href: "/app/finance/accounts", icon: Landmark, adminOnly: true },
      { key: "expenses", href: "/app/finance/expenses", icon: Receipt, adminOnly: true },
      { key: "adSpend", href: "/app/finance/ad-spend", icon: Megaphone, adminOnly: true },
      { key: "courierCash", oldKey: "cash", href: "/app/orders/cash", icon: HandCoins, adminOnly: true },
      { key: "income", href: "/app/finance/income", icon: Banknote, adminOnly: true },
      { key: "suppliers", href: "/app/contacts/suppliers", icon: Building2, adminOnly: true },
    ],
  },
  {
    key: "groupTeam",
    items: [
      { key: "tasks", href: "/app/team/tasks", icon: KanbanSquare, counter: "tasks", adminOnly: true },
      { key: "meetings", href: "/app/team/meetings", icon: CalendarClock, adminOnly: true },
      { key: "rules", href: "/app/team/rules", icon: BookText, adminOnly: true },
      { key: "performance", href: "/app/team/performance", icon: Gauge, adminOnly: true },
    ],
  },
  {
    key: "groupSettings",
    pinned: "bottom",
    defaultClosed: true,
    items: [
      { key: "settingsOverview", href: "/app/settings", icon: SettingsIcon, adminOnly: true },
      { key: "usersRoles", oldKey: "users", href: "/app/settings/users", icon: UserCog, adminOnly: true },
      { key: "seasons", href: "/app/settings/seasons", icon: CalendarRange, adminOnly: true },
      { key: "audit", href: "/app/settings/audit", icon: ScrollText, adminOnly: true },
    ],
  },
];

/**
 * Nav visible to a role. Admins see everything that exists. Agents see only
 * their own queue (confirmation_agent → Confirmation, delivery_agent →
 * Shipping) and no Home. No role → nothing. RLS is the real wall; this is UX.
 */
export function visibleNav(role: Role | null): VisibleNav {
  if (role === "admin") {
    return { home: HOME, groups: GROUPS.filter((g) => g.items.length > 0) };
  }
  const only =
    role === "confirmation_agent" ? "confirmation" : role === "delivery_agent" ? "shipping" : null;
  if (!only) return { home: null, groups: [] };
  const items = GROUPS.flatMap((g) => g.items).filter((i) => i.key === only);
  return { home: null, groups: [{ key: "groupSell", items }] };
}

/** Every visible destination, flat, in display order (⌘K). */
export function navLeaves(role: Role | null): NavLeaf[] {
  const { home, groups } = visibleNav(role);
  return [...(home ? [home] : []), ...groups.flatMap((g) => g.items)];
}

/** Longest-prefix match: exactly one leaf is active. */
export function activeLeafHref(role: Role | null, pathname: string): string | undefined {
  return navLeaves(role)
    .flatMap((l) => [l.href, ...(l.match ?? [])].map((p) => ({ p, href: l.href })))
    .filter(({ p }) => pathname === p || pathname.startsWith(p + "/"))
    .sort((a, b) => b.p.length - a.p.length)[0]?.href;
}

/** Parse the persisted user-collapsed map; anything malformed yields {}. */
export function groupCounterTotal(group: NavGroup, counts: Record<CounterKey, number>): number {
  return group.items.reduce((n, c) => n + (c.counter ? counts[c.counter] ?? 0 : 0), 0);
}

export function parseClosedGroups(raw: string | null): Record<string, boolean> {
  try {
    const v: unknown = JSON.parse(raw ?? "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === "boolean")) as Record<string, boolean>;
  } catch {
    return {};
  }
}

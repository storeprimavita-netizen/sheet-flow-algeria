import {
  Star,
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
  Sun,
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
  href: string; // hub page
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

/** Agents' Home (D86): a read-only "My day" page. Admins never see it. */
export const MY_DAY: NavLeaf = {
  key: "myDay",
  href: "/app/my-day",
  icon: Sun,
};

// Only routes that exist today; empty groups are not rendered.
export const GROUPS: NavGroup[] = [
  {
    key: "groupSell",
    href: "/app/sell",
    items: [
      { key: "confirmation", href: "/app/sell/confirmation", icon: PhoneCall, counter: "confirmation" },
      { key: "shipping", oldKey: "delivery", href: "/app/sell/shipping", icon: Truck, counter: "delivery" },
      { key: "all", href: "/app/sell/orders", icon: ListChecks, adminOnly: true },
      { key: "customers", oldKey: "contacts", href: "/app/sell/customers", icon: Users, adminOnly: true },
      { key: "statistics", href: "/app/statistics", icon: MapPinned, adminOnly: true },
    ],
  },
  {
    key: "groupCatalog",
    href: "/app/catalog",
    items: [
      { key: "products", href: "/app/catalog/products", icon: Package, adminOnly: true },
      { key: "stock", href: "/app/catalog/stock", icon: Boxes, adminOnly: true },
      { key: "pricing", oldKey: "planner", href: "/app/catalog/pricing", icon: Calculator, adminOnly: true },
    ],
  },
  {
    key: "groupStore",
    href: "/app/store",
    items: [
      { key: "storeHub", href: "/app/store", icon: Store, adminOnly: true },
      { key: "storePages", href: "/app/store/pages", icon: FileText, adminOnly: true },
      { key: "storeReviews", href: "/app/store/reviews", icon: Star, adminOnly: true },
      { key: "storeSettings", href: "/app/store/settings", icon: SlidersHorizontal, adminOnly: true },
    ],
  },
  {
    key: "groupMoney",
    href: "/app/money",
    items: [
      { key: "financeOverview", href: "/app/money/overview", icon: BarChart3, adminOnly: true },
      { key: "accounts", href: "/app/money/accounts", icon: Landmark, adminOnly: true },
      { key: "expenses", href: "/app/money/expenses", icon: Receipt, adminOnly: true },
      { key: "adSpend", href: "/app/money/ad-spend", icon: Megaphone, adminOnly: true },
      { key: "courierCash", oldKey: "cash", href: "/app/money/courier-cash", icon: HandCoins, adminOnly: true },
      { key: "suppliers", href: "/app/money/suppliers", icon: Building2, adminOnly: true },
    ],
  },
  {
    key: "groupTeam",
    href: "/app/team",
    items: [
      { key: "tasks", href: "/app/team/tasks", icon: KanbanSquare, counter: "tasks", adminOnly: true },
      { key: "meetings", href: "/app/team/meetings", icon: CalendarClock, adminOnly: true },
      { key: "rules", href: "/app/team/rules", icon: BookText, adminOnly: true },
      { key: "performance", href: "/app/team/performance", icon: Gauge, adminOnly: true },
    ],
  },
  {
    key: "groupSettings",
    href: "/app/settings",
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
 * My day plus their own queue (confirmation_agent → Confirmation,
 * delivery_agent → Shipping). No role → nothing. RLS is the real wall; this is UX.
 */
export function visibleNav(role: Role | null): VisibleNav {
  if (role === "admin") {
    return { home: HOME, groups: GROUPS.filter((g) => g.items.length > 0) };
  }
  const only =
    role === "confirmation_agent" ? "confirmation" : role === "delivery_agent" ? "shipping" : null;
  if (!only) return { home: null, groups: [] };
  const items = GROUPS.flatMap((g) => g.items).filter((i) => i.key === only);
  return { home: MY_DAY, groups: [{ key: "groupSell", href: "/app/sell", items }] };
}

const leafByHref = (href: string) =>
  [HOME, MY_DAY, ...GROUPS.flatMap((g) => g.items)].find((l) => l.href === href)!;

/**
 * Mobile bottom bar destinations (at most 4; "More" = the drawer is added by
 * the component). Derived from the model, so an agent never gets a link to a
 * page the guards refuse.
 */
export function bottomBar(role: Role | null): NavLeaf[] {
  if (role === "admin") {
    const money = GROUPS.find((g) => g.key === "groupMoney")!;
    return [
      HOME,
      leafByHref("/app/sell/confirmation"),
      { ...leafByHref("/app/sell/orders"), key: "orders" },
      { key: money.key, href: money.href, icon: HandCoins, adminOnly: true },
    ];
  }
  const { home, groups } = visibleNav(role);
  return [...(home ? [home] : []), ...groups.flatMap((g) => g.items)];
}

/** Active bar item: longest prefix match among the bar's own destinations ("More" is never active). */
export function activeBarHref(role: Role | null, pathname: string): string | undefined {
  return bottomBar(role)
    .flatMap((l) => [l.href, ...(l.match ?? [])].map((p) => ({ p, href: l.href })))
    .filter(({ p }) => pathname === p || pathname.startsWith(p + "/"))
    .sort((a, b) => b.p.length - a.p.length)[0]?.href;
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

/** i18n key (under navPurpose.*) of a leaf's one-line purpose. */
export const purposeKey = (leaf: NavLeaf) => `navPurpose.${leaf.key}`;

/** Where a role's order records live: an agent's own queue, otherwise All orders. */
export function orderHome(role: Role | null): NavLeaf {
  const own = role === "admin" ? undefined : visibleNav(role).groups[0]?.items[0];
  return own ?? leafByHref("/app/sell/orders");
}

export type Crumb = { labelKey: string; href?: string };

/**
 * Breadcrumb trail for a path: Group › Page › (new). Only parts the role may
 * see. Hub = group only; Home = none. Record names come from <CrumbRecord>.
 */
export function crumbsFor(role: Role | null, pathname: string): Crumb[] {
  const { groups } = visibleNav(role);
  const hub = groups.find((g) => g.href === pathname);
  if (hub) return [{ labelKey: `nav.${hub.key}` }];
  let href = activeLeafHref(role, pathname);
  // Order records belong to "All orders", which agents cannot see: file them under their own queue.
  if (!href && pathname.startsWith("/app/sell/orders/") && role !== "admin") href = orderHome(role).href;
  const group = groups.find((g) => g.items.some((l) => l.href === href));
  const leaf = group?.items.find((l) => l.href === href);
  if (!group || !leaf) return [];
  // A group with a single visible leaf redirects to it, so its crumb is not a link.
  const crumbs: Crumb[] = [{ labelKey: `nav.${group.key}`, href: group.items.length > 1 ? group.href : undefined }];
  if (leaf.href !== group.href) crumbs.push({ labelKey: `nav.${leaf.key}`, href: leaf.href });
  const prefix = [leaf.href, ...(leaf.match ?? [])]
    .filter((p) => pathname === p || pathname.startsWith(p + "/"))
    .sort((a, b) => b.length - a.length)[0];
  if (prefix && pathname.slice(prefix.length).split("/")[1] === "new") crumbs.push({ labelKey: "nav.newRecord" });
  return crumbs;
}

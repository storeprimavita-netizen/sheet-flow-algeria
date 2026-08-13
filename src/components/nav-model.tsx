import {
  LayoutDashboard,
  ShoppingBag,
  ListChecks,
  PhoneCall,
  Truck,
  Package,
  Wallet,
  BarChart3,
  Receipt,
  Megaphone,
  Banknote,
  Landmark,
  Users,
  Contact,
  Building2,
  UserCog,
  BookText,
  CalendarClock,
  KanbanSquare,
  Gauge,
  ScrollText,
  Settings as SettingsIcon,
} from "lucide-react";

import type { Role } from "@/lib/roles";
import type { IconType } from "@/lib/statuses";

export type CounterKey = "confirmation" | "delivery" | "tasks";

export type NavLeaf = {
  key: string; // i18n key under nav.*
  href: string;
  icon: IconType;
  adminOnly?: boolean;
  counter?: CounterKey;
};

export type NavSection = NavLeaf & { children?: NavLeaf[] };

export const NAV: NavSection[] = [
  { key: "dashboard", href: "/app/dashboard", icon: LayoutDashboard, adminOnly: true },
  {
    key: "orders",
    href: "/app/orders",
    icon: ShoppingBag,
    children: [
      { key: "all", href: "/app/orders/all", icon: ListChecks, adminOnly: true },
      { key: "confirmation", href: "/app/orders/confirmation", icon: PhoneCall, counter: "confirmation" },
      { key: "delivery", href: "/app/orders/delivery", icon: Truck, counter: "delivery" },
    ],
  },
  { key: "products", href: "/app/products", icon: Package, adminOnly: true },
  {
    key: "finance",
    href: "/app/finance",
    icon: Wallet,
    adminOnly: true,
    children: [
      { key: "financeOverview", href: "/app/finance/overview", icon: BarChart3 },
      { key: "expenses", href: "/app/finance/expenses", icon: Receipt },
      { key: "adSpend", href: "/app/finance/ad-spend", icon: Megaphone },
      { key: "income", href: "/app/finance/income", icon: Banknote },
      { key: "accounts", href: "/app/finance/accounts", icon: Landmark },
    ],
  },
  {
    key: "contacts",
    href: "/app/contacts",
    icon: Contact,
    adminOnly: true,
    children: [
      { key: "customers", href: "/app/contacts", icon: Users },
      { key: "suppliers", href: "/app/contacts/suppliers", icon: Building2 },
    ],
  },
  {
    key: "team",
    href: "/app/team",
    icon: UserCog,
    adminOnly: true,
    children: [
      { key: "rules", href: "/app/team/rules", icon: BookText },
      { key: "meetings", href: "/app/team/meetings", icon: CalendarClock },
      { key: "tasks", href: "/app/team/tasks", icon: KanbanSquare, counter: "tasks" },
      { key: "performance", href: "/app/team/performance", icon: Gauge },
      { key: "users", href: "/app/team", icon: Users },
      { key: "audit", href: "/app/team/audit", icon: ScrollText },
    ],
  },
  { key: "settings", href: "/app/settings", icon: SettingsIcon, adminOnly: true },
];

/**
 * Sections visible to a role. Admins see everything. Agents see only Orders,
 * narrowed to their own queue (confirmation_agent → Confirmation,
 * delivery_agent → Delivery). RLS is the real wall; this is UX.
 */
export function visibleNav(role: Role | null): NavSection[] {
  if (role === "admin") return NAV;
  const orders = NAV.find((s) => s.key === "orders")!;
  const child =
    role === "confirmation_agent" ? "confirmation" : role === "delivery_agent" ? "delivery" : null;
  return [
    {
      ...orders,
      children: orders.children?.filter((c) => !c.adminOnly && (!child || c.key === child)),
    },
  ];
}

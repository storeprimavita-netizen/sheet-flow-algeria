export type Partner = "Nadhir" | "Mahdi" | "Wail" | "Shared";

export const PARTNER_EMAIL_MAP: Record<string, Partner> = {
  nadhir: "Nadhir",
  mahdi: "Mahdi",
  wail: "Wail",
};

export function partnerFromEmail(email: string | null | undefined): Partner {
  if (!email) return "Nadhir";
  const local = email.toLowerCase().split("@")[0];
  for (const key of Object.keys(PARTNER_EMAIL_MAP)) {
    if (local.includes(key)) return PARTNER_EMAIL_MAP[key];
  }
  return "Nadhir";
}

export const ALL_PARTNERS: Partner[] = ["Nadhir", "Mahdi", "Wail", "Shared"];

export const EXPENSE_CATEGORIES = [
  "Facebook Ads",
  "TikTok Ads",
  "Product Sourcing",
  "Tissue/Packaging",
  "Creative Production",
  "Creative Fees",
  "Product Testing Fees",
  "Freelancer/Services",
  "Tools & Subscriptions",
  "Confirmation Agent",
  "Suivi Agent",
  "Returns",
  "Transfer Fees",
  "Other",
] as const;

export const INCOME_CATEGORIES = ["Delivered Orders", "Other"] as const;

export const PRODUCT_CATEGORIES = ["Clothes", "MDF & Wood Crafts", "Other"] as const;
export const PRODUCT_STATUSES = ["Active", "Testing", "Stopped", "Idea"] as const;

export const SPY_STATUSES = [
  "Researching",
  "Analyzing",
  "Validated",
  "Rejected",
  "Launched",
] as const;

export const CONTACT_SERVICES = [
  "Videography",
  "Photography",
  "Graphic Design",
  "Production/Manufacturing",
  "Tissue/Fabric Supplier",
  "MDF/Wood Supplier",
  "Packaging Supplier",
  "Delivery Service",
  "Confirmation Agent",
  "Suivi Agent",
  "Web Development",
  "Media Buying",
  "Influencer",
  "Other",
] as const;

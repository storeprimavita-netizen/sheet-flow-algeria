export interface Account {
  account_id: string;
  name: string;
  owner: string;
  currency: "DZD" | "USD";
  balance: number;
}

export interface Transaction {
  transaction_id: string;
  date: string;
  type: "Income" | "Expense" | "Transfer";
  amount: number;
  currency: "DZD" | "USD";
  amount_dzd: number;
  amount_usd: number;
  category: string;
  account_id: string;
  to_account_id: string;
  product_id: string;
  person: string;
  comment: string;
  status: "Confirmed" | "Pending" | "Cancelled";
  created_at: string;
}

export interface Product {
  product_id: string;
  name: string;
  category: string;
  status: string;
  product_cost: number;
  selling_price: number;
  confirmation_rate: number;
  delivery_rate: number;
  description: string;
  supplier_contact_id: string;
  launch_date: string;
  notes: string;
}

export interface SpyEntry {
  spy_id: string;
  product_name: string;
  category: string;
  status: string;
  source: string;
  source_url: string;
  estimated_cost: number;
  estimated_selling_price: number;
  tissue_needed: string;
  estimated_tissue_cost: number;
  target_audience: string;
  target_location: string;
  estimated_ad_budget: number;
  competitor_analysis: string;
  score: number;
  decision: string;
  added_by: string;
  date_found: string;
}

export interface Contact {
  contact_id: string;
  name: string;
  services: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  facebook: string;
  location: string;
  rating: number;
  price_range: string;
  notes: string;
  status: string;
}

export interface Settings {
  exchange_rate: number;
  last_updated: string;
  updated_by: string;
}

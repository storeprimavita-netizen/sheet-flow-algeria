import { Badge } from "@/components/ui/badge";

const MODULES = [
  { key: "Products", desc: "Catalog, costs & status lifecycle" },
  { key: "Orders", desc: "Confirmation queue → delivery handoff" },
  { key: "Contacts", desc: "Customers, suppliers & partners" },
  { key: "Expenses", desc: "Costs linked to products & orders" },
  { key: "BI", desc: "Margins, COD rates & reliability" },
  { key: "Settings", desc: "Webhooks, secrets & team" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gradient">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Welcome back. Here's what's being built.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <div key={m.key} className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {m.key}
              </span>
              <Badge variant="outline">soon</Badge>
            </div>
            <p className="mt-2 text-sm">{m.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

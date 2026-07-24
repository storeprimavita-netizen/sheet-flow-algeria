import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">Welcome back. Here's what's being built.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <Card key={m.key}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{m.key}</CardTitle>
                <Badge tone="neutral">soon</Badge>
              </div>
              <CardDescription>{m.desc}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}

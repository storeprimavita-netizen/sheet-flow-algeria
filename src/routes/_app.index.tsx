import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSheetsData } from "@/lib/sheets-hooks";
import { fmtDZD, fmtUSD } from "@/lib/format";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  CartesianGrid,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrendingUp, TrendingDown, Wallet, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

type Range = "all" | "month" | "week";

function withinRange(d: string, range: Range): boolean {
  if (range === "all") return true;
  const date = new Date(d);
  const now = new Date();
  if (range === "month")
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  if (range === "week") {
    const diff = (now.getTime() - date.getTime()) / 86400000;
    return diff <= 7;
  }
  return true;
}

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

function Dashboard() {
  const { data, isLoading, error } = useSheetsData();
  const [range, setRange] = useState<Range>("month");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [personFilter, setPersonFilter] = useState<string>("all");

  const filtered = useMemo<Transaction[]>(() => {
    if (!data) return [];
    return data.transactions.filter(
      (t) =>
        t.status === "Confirmed" &&
        withinRange(t.date, range) &&
        (accountFilter === "all" ||
          t.account_id === accountFilter ||
          t.to_account_id === accountFilter) &&
        (productFilter === "all" ||
          (productFilter === "none" ? !t.product_id : t.product_id === productFilter)) &&
        (personFilter === "all" || t.person === personFilter),
    );
  }, [data, range, accountFilter, productFilter, personFilter]);

  if (isLoading)
    return <div className="text-muted-foreground">Loading sheet data...</div>;
  if (error)
    return (
      <div className="glass-card rounded-xl p-6">
        <h2 className="text-lg font-semibold text-destructive">Failed to load Google Sheets</h2>
        <p className="mt-2 text-sm text-muted-foreground">{(error as Error).message}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          Make sure your service account has Editor access to the sheet, all 6 tabs exist
          (Accounts, Transactions, Products, Spy, Contacts, Settings) with the correct headers
          in row 1.
        </p>
      </div>
    );
  if (!data) return null;

  const rate = data.settings.exchange_rate;

  // Asset totals
  let totalDZD = 0;
  let totalUSD = 0;
  for (const a of data.accounts) {
    if (a.currency === "DZD") {
      totalDZD += a.balance;
      totalUSD += a.balance / rate;
    } else {
      totalUSD += a.balance;
      totalDZD += a.balance * rate;
    }
  }

  const income = filtered.filter((t) => t.type === "Income").reduce((s, t) => s + t.amount_dzd, 0);
  const expenses = filtered
    .filter((t) => t.type === "Expense")
    .reduce((s, t) => s + t.amount_dzd, 0);
  const net = income - expenses;

  // Time series
  const timeMap = new Map<string, { date: string; income: number; expenses: number }>();
  for (const t of filtered) {
    const key = t.date.slice(0, 7); // YYYY-MM
    const e = timeMap.get(key) ?? { date: key, income: 0, expenses: 0 };
    if (t.type === "Income") e.income += t.amount_dzd;
    if (t.type === "Expense") e.expenses += t.amount_dzd;
    timeMap.set(key, e);
  }
  const timeData = Array.from(timeMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Expenses by category
  const catMap = new Map<string, number>();
  for (const t of filtered.filter((t) => t.type === "Expense")) {
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount_dzd);
  }
  const catData = Array.from(catMap.entries()).map(([name, value]) => ({ name, value }));

  // Spend by product
  const prodMap = new Map<string, number>();
  for (const t of filtered.filter((t) => t.type === "Expense" && t.product_id)) {
    prodMap.set(t.product_id, (prodMap.get(t.product_id) ?? 0) + t.amount_dzd);
  }
  const prodData = Array.from(prodMap.entries()).map(([id, value]) => {
    const p = data.products.find((p) => p.product_id === id);
    return { name: p?.name ?? id, value };
  });

  // Per-person assets
  const personAssets = ["Nadhir", "Mahdi", "Wail", "Shared"].map((person) => {
    const accounts = data.accounts.filter((a) => a.owner === person);
    let dzd = 0,
      usd = 0;
    for (const a of accounts) {
      if (a.currency === "DZD") {
        dzd += a.balance;
      } else {
        usd += a.balance;
      }
    }
    return { person, accounts, dzd, usd, total_dzd: dzd + usd * rate };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live overview of your business finances</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
          {(["all", "month", "week"] as Range[]).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={range === r ? "default" : "ghost"}
              onClick={() => setRange(r)}
            >
              {r === "all" ? "All Time" : r === "month" ? "This Month" : "This Week"}
            </Button>
          ))}
        </div>
      </div>

      {/* Asset cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={<Wallet />} label="Total Assets (DZD)" value={fmtDZD(totalDZD)} />
        <StatCard icon={<DollarSign />} label="Total Assets (USD)" value={fmtUSD(totalUSD)} />
        <StatCard
          icon={<TrendingUp />}
          label="Income"
          value={fmtDZD(income)}
          tone="success"
        />
        <StatCard
          icon={<TrendingDown />}
          label="Expenses"
          value={fmtDZD(expenses)}
          tone="destructive"
        />
        <StatCard
          icon={net >= 0 ? <TrendingUp /> : <TrendingDown />}
          label="Net P/L"
          value={fmtDZD(net)}
          tone={net >= 0 ? "success" : "destructive"}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Income vs Expenses">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={timeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Expenses by Category">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={catData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                {catData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Spend by Product">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={prodData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={12} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8 }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Account Balances (DZD equivalent)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              layout="vertical"
              data={data.accounts.map((a) => ({
                name: a.name,
                value: a.currency === "DZD" ? a.balance : a.balance * rate,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis type="number" stroke="#94a3b8" fontSize={12} />
              <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} width={120} />
              <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8 }} />
              <Bar dataKey="value" fill="#10b981" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Per-person */}
      <div>
        <h2 className="mb-3 text-xl font-semibold">Per-Partner Assets</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {personAssets.map((p) => (
            <div key={p.person} className="glass-card rounded-xl p-5">
              <div className="text-sm text-muted-foreground">{p.person}</div>
              <div className="mt-1 text-xl font-bold">{fmtDZD(p.total_dzd)}</div>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                {p.accounts.map((a) => (
                  <div key={a.account_id} className="flex justify-between">
                    <span>{a.name}</span>
                    <span className="font-mono text-foreground">
                      {a.currency === "DZD" ? fmtDZD(a.balance) : fmtUSD(a.balance)}
                    </span>
                  </div>
                ))}
                {p.accounts.length === 0 && <div className="italic">No accounts</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent */}
      <div className="glass-card rounded-xl p-5">
        <h2 className="mb-3 text-lg font-semibold">Recent Transactions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2">Date</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Category</th>
                <th className="pb-2">Person</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered
                .slice()
                .reverse()
                .slice(0, 10)
                .map((t) => (
                  <tr key={t.transaction_id} className="border-t border-border/50">
                    <td className="py-2 text-muted-foreground">{t.date}</td>
                    <td className="py-2">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-xs",
                          t.type === "Income" && "bg-success/20 text-success",
                          t.type === "Expense" && "bg-destructive/20 text-destructive",
                          t.type === "Transfer" && "bg-info/20 text-info",
                        )}
                      >
                        {t.type}
                      </span>
                    </td>
                    <td className="py-2">{t.category}</td>
                    <td className="py-2">{t.person}</td>
                    <td className="py-2 text-right font-mono">
                      {t.currency === "DZD" ? fmtDZD(t.amount) : fmtUSD(t.amount)}
                    </td>
                  </tr>
                ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    No transactions in this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "success" | "destructive";
}) {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <span
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center [&>svg]:h-4 [&>svg]:w-4",
            tone === "success" && "bg-success/20 text-success",
            tone === "destructive" && "bg-destructive/20 text-destructive",
            !tone && "bg-info/20 text-info",
          )}
        >
          {icon}
        </span>
      </div>
      <div
        className={cn(
          "mt-3 text-2xl font-bold",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

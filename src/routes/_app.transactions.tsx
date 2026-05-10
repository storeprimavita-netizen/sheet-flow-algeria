import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSheetsData } from "@/lib/sheets-hooks";
import { fmtDZD, fmtUSD } from "@/lib/format";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AddTransactionDialog } from "@/components/add-transaction-dialog";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_app/transactions")({
  component: TransactionsPage,
});

function TransactionsPage() {
  const { data, isLoading } = useSheetsData();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [personFilter, setPersonFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.transactions
      .filter((t) => (typeFilter === "all" ? true : t.type === typeFilter))
      .filter((t) => (statusFilter === "all" ? true : t.status === statusFilter))
      .filter((t) => (personFilter === "all" ? true : t.person === personFilter))
      .filter((t) =>
        search ? `${t.comment} ${t.category}`.toLowerCase().includes(search.toLowerCase()) : true,
      )
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data, search, typeFilter, statusFilter, personFilter]);

  const stats = useMemo(() => {
    const inc = filtered.filter((t) => t.type === "Income" && t.status === "Confirmed");
    const exp = filtered.filter((t) => t.type === "Expense" && t.status === "Confirmed");
    return {
      income: inc.reduce((s, t) => s + t.amount_dzd, 0),
      expenses: exp.reduce((s, t) => s + t.amount_dzd, 0),
    };
  }, [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-sm text-muted-foreground">All money movements across your accounts</p>
        </div>
        <AddTransactionDialog />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatBox label="Income" value={fmtDZD(stats.income)} tone="success" />
        <StatBox label="Expenses" value={fmtDZD(stats.expenses)} tone="destructive" />
        <StatBox
          label="Net"
          value={fmtDZD(stats.income - stats.expenses)}
          tone={stats.income - stats.expenses >= 0 ? "success" : "destructive"}
        />
      </div>

      <div className="glass-card rounded-xl p-4">
        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search comments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Income">Income</SelectItem>
              <SelectItem value="Expense">Expense</SelectItem>
              <SelectItem value="Transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Confirmed">Confirmed</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={personFilter} onValueChange={setPersonFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Person" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Partners</SelectItem>
              <SelectItem value="Nadhir">Nadhir</SelectItem>
              <SelectItem value="Mahdi">Mahdi</SelectItem>
              <SelectItem value="Wail">Wail</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2">Date</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Category</th>
                <th className="pb-2">Account</th>
                <th className="pb-2">Person</th>
                <th className="pb-2">Comment</th>
                <th className="pb-2 text-right">DZD</th>
                <th className="pb-2 text-right">USD</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              )}
              {filtered.map((t) => {
                const acc = data?.accounts.find((a) => a.account_id === t.account_id);
                return (
                  <tr
                    key={t.transaction_id}
                    className={cn(
                      "border-t border-border/40 transition-colors",
                      t.type === "Income" && "hover:bg-success/5",
                      t.type === "Expense" && "hover:bg-destructive/5",
                      t.type === "Transfer" && "hover:bg-info/5",
                    )}
                  >
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
                    <td className="py-2 text-xs text-muted-foreground">{acc?.name ?? t.account_id}</td>
                    <td className="py-2">{t.person}</td>
                    <td className="py-2 text-xs text-muted-foreground" dir="auto">
                      {t.comment}
                    </td>
                    <td className="py-2 text-right font-mono">{fmtDZD(t.amount_dzd)}</td>
                    <td className="py-2 text-right font-mono text-xs text-muted-foreground">
                      {fmtUSD(t.amount_usd)}
                    </td>
                    <td className="py-2">
                      <span
                        className={cn(
                          "rounded px-2 py-0.5 text-xs",
                          t.status === "Confirmed" && "bg-success/10 text-success",
                          t.status === "Pending" && "bg-info/10 text-info",
                          t.status === "Cancelled" && "bg-muted text-muted-foreground line-through",
                        )}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-muted-foreground">
                    No transactions found
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

function StatBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "success" | "destructive";
}) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-bold", tone === "success" ? "text-success" : "text-destructive")}>
        {value}
      </div>
    </div>
  );
}

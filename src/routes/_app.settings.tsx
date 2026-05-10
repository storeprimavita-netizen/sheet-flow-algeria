import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSheetsData, useUpdateRate } from "@/lib/sheets-hooks";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data } = useSheetsData();
  const { user, partner } = useAuth();
  const update = useUpdateRate();
  const [rate, setRate] = useState("");

  const exportCSV = (filename: string, rows: any[]) => {
    if (rows.length === 0) return;
    const keys = Object.keys(rows[0]);
    const csv = [
      keys.join(","),
      ...rows.map((r) => keys.map((k) => `"${String(r[k] ?? "").replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure your workspace</p>
      </div>

      <div className="glass-card rounded-xl p-5">
        <h2 className="mb-3 text-lg font-semibold">Exchange Rate</h2>
        <div className="text-sm text-muted-foreground">
          Current: <span className="font-mono text-primary">1 USD = {data?.settings.exchange_rate} DZD</span>
        </div>
        <div className="mt-3 flex items-end gap-2">
          <div className="flex-1">
            <Label>New Rate</Label>
            <Input
              type="number"
              placeholder={String(data?.settings.exchange_rate ?? 250)}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <Button
            onClick={async () => {
              if (!rate) return;
              try {
                await update.mutateAsync({ rate: parseFloat(rate), updated_by: partner });
                toast.success("Rate updated");
                setRate("");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Update
          </Button>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Last updated: {data?.settings.last_updated} by {data?.settings.updated_by}
        </div>
      </div>

      <div className="glass-card rounded-xl p-5">
        <h2 className="mb-3 text-lg font-semibold">User Profile</h2>
        <div className="space-y-1 text-sm">
          <div>
            <span className="text-muted-foreground">Email:</span> {user?.email}
          </div>
          <div>
            <span className="text-muted-foreground">Partner:</span>{" "}
            <span className="font-semibold text-primary">{partner}</span>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <div className="font-semibold text-foreground">Partner email mapping</div>
          <div>nadhir@... → Nadhir</div>
          <div>mahdi@... → Mahdi</div>
          <div>wail@... → Wail</div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-5">
        <h2 className="mb-3 text-lg font-semibold">Google Sheet</h2>
        <p className="text-sm text-muted-foreground">
          All data is stored in your linked Google Spreadsheet. Make sure the service account has Editor
          access.
        </p>
        <a
          href="https://docs.google.com/spreadsheets"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Open Google Sheets <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="glass-card rounded-xl p-5">
        <h2 className="mb-3 text-lg font-semibold">Export Data</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCSV("transactions.csv", data?.transactions ?? [])}>
            <Download className="mr-1 h-4 w-4" /> Transactions
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCSV("accounts.csv", data?.accounts ?? [])}>
            <Download className="mr-1 h-4 w-4" /> Accounts
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCSV("products.csv", data?.products ?? [])}>
            <Download className="mr-1 h-4 w-4" /> Products
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCSV("contacts.csv", data?.contacts ?? [])}>
            <Download className="mr-1 h-4 w-4" /> Contacts
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportCSV("spy.csv", data?.spy ?? [])}>
            <Download className="mr-1 h-4 w-4" /> Spy
          </Button>
        </div>
      </div>
    </div>
  );
}

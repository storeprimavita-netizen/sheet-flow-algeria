import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  useSheetsData,
  useAddAccount,
  useUpdateAccount,
  useAddTransaction,
  useUpdateRate,
} from "@/lib/sheets-hooks";
import { fmtDZD, fmtUSD } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ALL_PARTNERS } from "@/lib/partners";
import { useAuth } from "@/lib/auth-context";
import { Plus, ArrowLeftRight, RefreshCw, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Account } from "@/lib/types";

export const Route = createFileRoute("/_app/accounts")({
  component: AccountsPage,
});

const currencyEmoji = (c: "DZD" | "USD") => (c === "DZD" ? "🇩🇿" : "💵");

function AccountsPage() {
  const { data, isLoading } = useSheetsData();
  const rate = data?.settings.exchange_rate ?? 250;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Accounts</h1>
          <p className="text-sm text-muted-foreground">Manage balances across DZD and USD wallets</p>
        </div>
        <div className="flex gap-2">
          <TransferDialog />
          <AccountDialog />
        </div>
      </div>

      <ExchangeRateCard
        rate={rate}
        updated={data?.settings.last_updated}
        updatedBy={data?.settings.updated_by}
      />

      {isLoading && <div className="text-muted-foreground">Loading...</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.accounts.map((a) => {
          const altCurrency = a.currency === "DZD" ? "USD" : "DZD";
          const altValue = a.currency === "DZD" ? a.balance / rate : a.balance * rate;
          const lastTx = data.transactions
            .filter((t) => t.account_id === a.account_id || t.to_account_id === a.account_id)
            .sort((x, y) => y.date.localeCompare(x.date))[0];
          return (
            <div key={a.account_id} className="glass-card rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info/15 text-2xl">
                    {currencyEmoji(a.currency)}
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {a.owner}
                    </div>
                    <div className="mt-0.5 text-lg font-semibold">{a.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-info/20 px-2 py-0.5 text-xs text-info">
                    {a.currency}
                  </span>
                  <AccountDialog existing={a} />
                </div>
              </div>
              <div className="mt-4 text-3xl font-bold text-primary">
                {a.currency === "DZD" ? fmtDZD(a.balance) : fmtUSD(a.balance)}
              </div>
              <div className="text-xs text-muted-foreground">
                ≈ {altCurrency === "DZD" ? fmtDZD(altValue) : fmtUSD(altValue)}
              </div>
              {lastTx && (
                <div className="mt-3 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                  Last activity: {lastTx.date} • {lastTx.type}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExchangeRateCard({
  rate,
  updated,
  updatedBy,
}: {
  rate: number;
  updated?: string;
  updatedBy?: string;
}) {
  const { partner } = useAuth();
  const update = useUpdateRate();
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(String(rate));

  return (
    <div className="glass-card flex flex-wrap items-center justify-between gap-4 rounded-xl p-5">
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Exchange Rate</div>
        <div className="mt-1 text-2xl font-bold">
          1 USD = <span className="text-primary">{rate}</span> DZD
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          Updated {updated || "—"} by {updatedBy || "—"}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <RefreshCw className="mr-1 h-4 w-4" /> Update Rate
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Exchange Rate</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>1 USD = ? DZD</Label>
            <Input type="number" value={val} onChange={(e) => setVal(e.target.value)} />
          </div>
          <DialogFooter>
            <Button
              disabled={update.isPending}
              onClick={async () => {
                try {
                  await update.mutateAsync({ rate: parseFloat(val), updated_by: partner });
                  toast.success("Exchange rate updated");
                  setOpen(false);
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountDialog({ existing }: { existing?: Account }) {
  const add = useAddAccount();
  const update = useUpdateAccount();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(existing?.name ?? "");
  const [owner, setOwner] = useState(existing?.owner ?? "Nadhir");
  const [currency, setCurrency] = useState<"DZD" | "USD">(existing?.currency ?? "DZD");
  const [balance, setBalance] = useState(String(existing?.balance ?? "0"));

  useEffect(() => {
    if (open && existing) {
      setName(existing.name);
      setOwner(existing.owner);
      setCurrency(existing.currency);
      setBalance(String(existing.balance));
    }
  }, [open, existing]);

  const isEdit = !!existing;
  const pending = add.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button size="icon" variant="ghost" className="h-7 w-7">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button variant="outline">
            <Plus className="mr-1 h-4 w-4" /> Add Account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            <span className="mr-2">{currencyEmoji(currency)}</span>
            {isEdit ? "Edit Account" : "New Account"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Owner</Label>
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_PARTNERS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DZD">🇩🇿 DZD</SelectItem>
                  <SelectItem value="USD">💵 USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>{isEdit ? "Balance" : "Initial Balance"}</Label>
            <Input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} />
            {isEdit && (
              <p className="mt-1 text-xs text-muted-foreground">
                Editing balance directly overrides the stored value. Use a transaction to keep the
                ledger in sync.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={async () => {
              if (!name) return toast.error("Name required");
              try {
                if (isEdit) {
                  await update.mutateAsync({
                    account_id: existing!.account_id,
                    name,
                    owner,
                    currency,
                    balance: parseFloat(balance) || 0,
                  });
                  toast.success("Account updated");
                } else {
                  await add.mutateAsync({
                    name,
                    owner,
                    currency,
                    balance: parseFloat(balance) || 0,
                  });
                  toast.success("Account added");
                }
                setOpen(false);
                if (!isEdit) {
                  setName("");
                  setBalance("0");
                }
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransferDialog() {
  const { data } = useSheetsData();
  const { partner } = useAuth();
  const add = useAddTransaction();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");

  const fromAcc = data?.accounts.find((a) => a.account_id === from);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <ArrowLeftRight className="mr-1 h-4 w-4" /> Transfer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>🔄 Transfer Money</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>From</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger>
                <SelectValue placeholder="Source account" />
              </SelectTrigger>
              <SelectContent>
                {data?.accounts.map((a) => (
                  <SelectItem key={a.account_id} value={a.account_id}>
                    {currencyEmoji(a.currency)} {a.name} ({a.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>To</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger>
                <SelectValue placeholder="Destination" />
              </SelectTrigger>
              <SelectContent>
                {data?.accounts
                  .filter((a) => a.account_id !== from)
                  .map((a) => (
                    <SelectItem key={a.account_id} value={a.account_id}>
                      {currencyEmoji(a.currency)} {a.name} ({a.currency})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Amount ({fromAcc?.currency ?? "—"})</Label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={add.isPending}
            onClick={async () => {
              if (!from || !to || !amount) return toast.error("Fill all fields");
              try {
                await add.mutateAsync({
                  date: new Date().toISOString().slice(0, 10),
                  type: "Transfer",
                  amount: parseFloat(amount),
                  currency: fromAcc!.currency,
                  category: "Internal Transfer",
                  account_id: from,
                  to_account_id: to,
                  product_id: "",
                  person: partner,
                  comment: "",
                  status: "Confirmed",
                });
                toast.success("Transfer complete");
                setOpen(false);
                setAmount("");
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            {add.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

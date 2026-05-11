import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  ALL_PARTNERS,
} from "@/lib/partners";
import { useAddTransaction, useSheetsData } from "@/lib/sheets-hooks";
import { useAuth } from "@/lib/auth-context";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const currencyEmoji = (c: "DZD" | "USD") => (c === "DZD" ? "🇩🇿" : "💵");

const STATUS_META: Record<string, { emoji: string; cls: string }> = {
  Confirmed: { emoji: "✅", cls: "text-success" },
  Pending: { emoji: "⏳", cls: "text-info" },
  Cancelled: { emoji: "❌", cls: "text-destructive" },
};

export function AddTransactionDialog({
  defaultProductId,
  trigger,
}: {
  defaultProductId?: string;
  trigger?: React.ReactNode;
}) {
  const { partner } = useAuth();
  const { data } = useSheetsData();
  const add = useAddTransaction();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"Income" | "Expense" | "Transfer">("Expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"DZD" | "USD">("DZD");
  const [accountId, setAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [category, setCategory] = useState("");
  const [productId, setProductId] = useState(defaultProductId ?? "");
  const [person, setPerson] = useState<string>(partner);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"Confirmed" | "Pending" | "Cancelled">("Confirmed");
  const [submitting, setSubmitting] = useState(false);

  const cats =
    type === "Income"
      ? INCOME_CATEGORIES
      : type === "Expense"
        ? EXPENSE_CATEGORIES
        : (["Internal Transfer"] as const);

  const onSubmit = async () => {
    if (submitting || add.isPending) return; // hard guard against double-click
    if (!amount || !accountId || (type !== "Transfer" && !category) || (type === "Transfer" && !toAccountId)) {
      toast.error("Fill all required fields");
      return;
    }
    setSubmitting(true);
    try {
      await add.mutateAsync({
        date,
        type,
        amount: parseFloat(amount),
        currency,
        category: type === "Transfer" ? "Internal Transfer" : category,
        account_id: accountId,
        to_account_id: type === "Transfer" ? toAccountId : "",
        product_id: productId,
        person,
        comment,
        status,
      });
      toast.success("Transaction added");
      setOpen(false);
      setAmount("");
      setComment("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || add.isPending;

  const typeMeta = {
    Income: { icon: TrendingUp, emoji: "🟢", bg: "bg-success", fg: "text-success-foreground" },
    Expense: { icon: TrendingDown, emoji: "🔴", bg: "bg-destructive", fg: "text-destructive-foreground" },
    Transfer: { icon: ArrowLeftRight, emoji: "🔄", bg: "bg-info", fg: "text-info-foreground" },
  } as const;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy && !o) return; // don't close mid-submit
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-1 h-4 w-4" /> Add Transaction
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{typeMeta[type].emoji}</span> New Transaction
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {(["Income", "Expense", "Transfer"] as const).map((t) => {
              const m = typeMeta[t];
              const Icon = m.icon;
              const active = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t);
                    setCategory("");
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition ${
                    active ? `${m.bg} ${m.fg}` : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Currency</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as "DZD" | "USD")}>
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
            <Label>{type === "Transfer" ? "From Account" : "Account"}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
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

          {type === "Transfer" && (
            <div>
              <Label>To Account</Label>
              <Select value={toAccountId} onValueChange={setToAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {data?.accounts
                    .filter((a) => a.account_id !== accountId)
                    .map((a) => (
                      <SelectItem key={a.account_id} value={a.account_id}>
                        {currencyEmoji(a.currency)} {a.name} ({a.currency})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {type !== "Transfer" && (
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {cats.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Product (optional)</Label>
              <Select value={productId || "none"} onValueChange={(v) => setProductId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {data?.products.map((p) => (
                    <SelectItem key={p.product_id} value={p.product_id}>
                      📦 {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Person</Label>
              <Select value={person} onValueChange={setPerson}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_PARTNERS.filter((p) => p !== "Shared").map((p) => (
                    <SelectItem key={p} value={p}>
                      👤 {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["Confirmed", "Pending", "Cancelled"] as const).map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className={STATUS_META[s].cls}>
                        {STATUS_META[s].emoji} {s}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Comment</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional notes — Arabic supported"
              dir="auto"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={busy} className="min-w-[160px]">
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving to Sheets...
              </>
            ) : (
              "Save Transaction"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

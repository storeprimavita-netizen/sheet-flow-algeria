import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useSheetsData, useAddProduct, useUpdateProduct } from "@/lib/sheets-hooks";
import { fmtDZD } from "@/lib/format";
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
import { PRODUCT_CATEGORIES, PRODUCT_STATUSES } from "@/lib/partners";
import { Plus, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

export const Route = createFileRoute("/_app/products")({
  component: ProductsPage,
});

function ProductsPage() {
  const { data } = useSheetsData();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">Track P&L per product</p>
        </div>
        <ProductDialog />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data?.products.map((p) => {
          const txs = data.transactions.filter(
            (t) => t.product_id === p.product_id && t.status === "Confirmed",
          );
          const adSpend = txs
            .filter((t) => t.type === "Expense")
            .reduce((s, t) => s + t.amount_dzd, 0);
          const revenue = txs
            .filter((t) => t.type === "Income")
            .reduce((s, t) => s + t.amount_dzd, 0);
          const profit = revenue - adSpend;
          const cpdo =
            p.confirmation_rate > 0 && p.delivery_rate > 0
              ? p.product_cost / ((p.confirmation_rate / 100) * (p.delivery_rate / 100))
              : 0;
          return (
            <div key={p.product_id} className="glass-card rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">{p.category}</div>
                  <h3 className="mt-1 text-lg font-semibold" dir="auto">
                    {p.name}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={p.status} />
                  <ProductDialog existing={p} />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Cost</div>
                  <div className="font-mono">{fmtDZD(p.product_cost)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Selling</div>
                  <div className="font-mono">{fmtDZD(p.selling_price)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Confirmation</div>
                  <div className="font-mono">{p.confirmation_rate}%</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Delivery</div>
                  <div className="font-mono">{p.delivery_rate}%</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">CPDO</div>
                  <div className="font-mono">{cpdo > 0 ? fmtDZD(cpdo) : "—"}</div>
                </div>
              </div>
              <div className="mt-4 space-y-1 border-t border-border/40 pt-3 text-sm">
                <Row label="Ad Spend" value={fmtDZD(adSpend)} />
                <Row label="Revenue" value={fmtDZD(revenue)} tone="success" />
                <Row
                  label="Profit"
                  value={fmtDZD(profit)}
                  tone={profit >= 0 ? "success" : "destructive"}
                />
              </div>
              {p.description && (
                <p className="mt-3 text-xs text-muted-foreground" dir="auto">
                  {p.description}
                </p>
              )}
            </div>
          );
        })}
        {data && data.products.length === 0 && (
          <div className="glass-card col-span-full rounded-xl p-10 text-center text-muted-foreground">
            No products yet. Add your first product to track its P&L.
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono",
          tone === "success" && "text-success",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Active: "bg-success/20 text-success",
    Testing: "bg-info/20 text-info",
    Stopped: "bg-destructive/20 text-destructive",
    Idea: "bg-muted text-muted-foreground",
  };
  const emoji: Record<string, string> = {
    Active: "🟢",
    Testing: "🧪",
    Stopped: "🛑",
    Idea: "💡",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs", map[status] || "bg-muted")}>
      {emoji[status] || ""} {status}
    </span>
  );
}

function ProductDialog({ existing }: { existing?: Product }) {
  const add = useAddProduct();
  const update = useUpdateProduct();
  const [open, setOpen] = useState(false);
  const isEdit = !!existing;
  const [form, setForm] = useState({
    name: existing?.name ?? "",
    category: existing?.category ?? "Clothes",
    status: existing?.status ?? "Idea",
    product_cost: String(existing?.product_cost ?? "0"),
    selling_price: String(existing?.selling_price ?? "0"),
    confirmation_rate: String(existing?.confirmation_rate ?? "0"),
    delivery_rate: String(existing?.delivery_rate ?? "0"),
    description: existing?.description ?? "",
    notes: existing?.notes ?? "",
  });

  useEffect(() => {
    if (open && existing) {
      setForm({
        name: existing.name,
        category: existing.category || "Clothes",
        status: existing.status || "Idea",
        product_cost: String(existing.product_cost),
        selling_price: String(existing.selling_price),
        confirmation_rate: String(existing.confirmation_rate),
        delivery_rate: String(existing.delivery_rate),
        description: existing.description ?? "",
        notes: existing.notes ?? "",
      });
    }
  }, [open, existing]);

  const pending = add.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button size="icon" variant="ghost" className="h-7 w-7">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button>
            <Plus className="mr-1 h-4 w-4" /> Add Product
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📦 {isEdit ? "Edit Product" : "New Product"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} dir="auto" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cost (DZD)</Label>
              <Input
                type="number"
                value={form.product_cost}
                onChange={(e) => setForm({ ...form, product_cost: e.target.value })}
              />
            </div>
            <div>
              <Label>Selling Price (DZD)</Label>
              <Input
                type="number"
                value={form.selling_price}
                onChange={(e) => setForm({ ...form, selling_price: e.target.value })}
              />
            </div>
            <div>
              <Label>Confirmation %</Label>
              <Input
                type="number"
                value={form.confirmation_rate}
                onChange={(e) => setForm({ ...form, confirmation_rate: e.target.value })}
              />
            </div>
            <div>
              <Label>Delivery %</Label>
              <Input
                type="number"
                value={form.delivery_rate}
                onChange={(e) => setForm({ ...form, delivery_rate: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              dir="auto"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={async () => {
              if (!form.name) return toast.error("Name required");
              const payload = {
                name: form.name,
                category: form.category,
                status: form.status,
                product_cost: parseFloat(form.product_cost) || 0,
                selling_price: parseFloat(form.selling_price) || 0,
                confirmation_rate: parseFloat(form.confirmation_rate) || 0,
                delivery_rate: parseFloat(form.delivery_rate) || 0,
                description: form.description,
                notes: form.notes,
              };
              try {
                if (isEdit) {
                  await update.mutateAsync({ product_id: existing!.product_id, ...payload });
                  toast.success("Product updated");
                } else {
                  await add.mutateAsync(payload);
                  toast.success("Product added");
                }
                setOpen(false);
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

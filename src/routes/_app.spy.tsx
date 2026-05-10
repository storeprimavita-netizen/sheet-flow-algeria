import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSheetsData, useAddSpy } from "@/lib/sheets-hooks";
import { useAuth } from "@/lib/auth-context";
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
import { SPY_STATUSES, PRODUCT_CATEGORIES } from "@/lib/partners";
import { Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { fmtDZD } from "@/lib/format";

export const Route = createFileRoute("/_app/spy")({
  component: SpyPage,
});

function SpyPage() {
  const { data } = useSheetsData();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Spy & Research</h1>
          <p className="text-sm text-muted-foreground">Track product opportunities through the pipeline</p>
        </div>
        <AddSpyDialog />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {SPY_STATUSES.map((status) => {
          const items = data?.spy.filter((s) => s.status === status) ?? [];
          return (
            <div key={status} className="glass-card rounded-xl p-3">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{status}</h3>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map((s) => (
                  <div key={s.spy_id} className="rounded-lg border border-border bg-background/40 p-3">
                    <div className="text-sm font-medium" dir="auto">
                      {s.product_name}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{s.category}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="text-xs font-mono text-muted-foreground">
                        {fmtDZD(s.estimated_cost)}
                      </div>
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 ${
                              i < s.score ? "fill-primary text-primary" : "text-muted"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">by {s.added_by}</div>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border/50 p-4 text-center text-xs text-muted-foreground">
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddSpyDialog() {
  const { partner } = useAuth();
  const add = useAddSpy();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    product_name: "",
    category: "Clothes",
    status: "Researching",
    source: "",
    source_url: "",
    estimated_cost: "0",
    estimated_selling_price: "0",
    target_audience: "",
    target_location: "Algeria",
    estimated_ad_budget: "0",
    score: 3,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-1 h-4 w-4" /> Add Entry
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Spy Entry</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Product Name</Label>
            <Input
              value={form.product_name}
              onChange={(e) => setForm({ ...form, product_name: e.target.value })}
              dir="auto"
            />
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
                  {SPY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Source</Label>
              <Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
            </div>
            <div>
              <Label>Source URL</Label>
              <Input
                value={form.source_url}
                onChange={(e) => setForm({ ...form, source_url: e.target.value })}
              />
            </div>
            <div>
              <Label>Est. Cost (DZD)</Label>
              <Input
                type="number"
                value={form.estimated_cost}
                onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })}
              />
            </div>
            <div>
              <Label>Est. Selling (DZD)</Label>
              <Input
                type="number"
                value={form.estimated_selling_price}
                onChange={(e) => setForm({ ...form, estimated_selling_price: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label>Target Audience</Label>
            <Textarea
              value={form.target_audience}
              onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
            />
          </div>
          <div>
            <Label>Score (1-5)</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm({ ...form, score: n })}
                  className="p-1"
                >
                  <Star
                    className={`h-6 w-6 ${
                      n <= form.score ? "fill-primary text-primary" : "text-muted"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={async () => {
              if (!form.product_name) return toast.error("Product name required");
              try {
                await add.mutateAsync({
                  product_name: form.product_name,
                  category: form.category,
                  status: form.status,
                  source: form.source,
                  source_url: form.source_url,
                  estimated_cost: parseFloat(form.estimated_cost) || 0,
                  estimated_selling_price: parseFloat(form.estimated_selling_price) || 0,
                  tissue_needed: "",
                  estimated_tissue_cost: 0,
                  target_audience: form.target_audience,
                  target_location: form.target_location,
                  estimated_ad_budget: parseFloat(form.estimated_ad_budget) || 0,
                  competitor_analysis: "",
                  score: form.score,
                  decision: "",
                  added_by: partner,
                });
                toast.success("Entry added");
                setOpen(false);
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import * as React from "react";
import { toast } from "sonner";
import { MoreHorizontal, Trash2, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import { tableClass } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui/chip";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { StatusPill } from "@/components/status-pill";
import { StatusSelect } from "@/components/status-select";
import { RiskBadge } from "@/components/risk-badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Sheet, SheetTrigger, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { MoneyField } from "@/components/fields/money-field";
import { PercentField } from "@/components/fields/percent-field";
import { PhoneField } from "@/components/fields/phone-field";
import { WilayaCombobox, CommuneCombobox, ProductCombobox } from "@/components/fields/comboboxes";
import { QuantityStepper } from "@/components/fields/quantity-stepper";
import { DateField, DateRangeField } from "@/components/fields/date-field";
import { CategorySelect } from "@/components/fields/category-select";
import { OptionSelect, OptionMultiSelect } from "@/components/fields/option-select";
import { AutoTextarea } from "@/components/fields/auto-textarea";
import { SettingSwitch } from "@/components/fields/setting-switch";
import { STATUS_KINDS, type StatusKind } from "@/lib/statuses";

const WILAYAS = [
  { code: "16", name: "Alger" },
  { code: "31", name: "Oran" },
  { code: "09", name: "Blida" },
  { code: "25", name: "Constantine" },
  { code: "06", name: "Béjaïa" },
  { code: "19", name: "Sétif" },
];
const COMMUNES = ["Bab El Oued", "Hydra", "Kouba", "Bir Mourad Raïs"];
const PRODUCTS = [
  { id: "1", name: "Robe de soirée", status: "confirmed" },
  { id: "2", name: "Sac à main cuir", status: "tested" },
  { id: "3", name: "Foulard soie", status: "to_be_tested" },
];
const OPTIONS = [
  { value: "cotton", label: "Cotton" },
  { value: "silk", label: "Silk" },
  { value: "wool", label: "Wool" },
];

// ── Contrast measurement (canvas sampling → WCAG ratio) ───────────────
function toRGBA(css: string): [number, number, number, number] {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const ctx = cv.getContext("2d")!;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3] / 255];
}
function over(fg: number[], bg: number[]): number[] {
  const a = fg[3];
  return [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a), 1];
}
function lum([r, g, b]: number[]): number {
  const f = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(fg: number[], bg: number[]): number {
  const a = Math.max(lum(fg), lum(bg));
  const b = Math.min(lum(fg), lum(bg));
  return (a + 0.05) / (b + 0.05);
}
function readVar(container: HTMLElement, cssVar: string, kind: "color" | "bg"): number[] {
  const el = document.createElement("span");
  if (kind === "bg") el.style.backgroundColor = `var(${cssVar})`;
  else el.style.color = `var(${cssVar})`;
  container.appendChild(el);
  const v = getComputedStyle(el)[kind === "bg" ? "backgroundColor" : "color"];
  container.removeChild(el);
  return toRGBA(v);
}

const SEMANTIC = ["success", "warning", "danger", "info", "neutral", "indigo", "cyan", "violet", "orange", "rose"];

type Check = { name: string; ratio: number; gate: boolean };

function measure(container: HTMLElement): Check[] {
  const surface = readVar(container, "--surface", "bg");
  const checks: Check[] = [];
  for (const s of SEMANTIC) {
    const fg = readVar(container, `--${s}`, "color");
    const bg = over(readVar(container, `--${s}-bg`, "bg"), surface);
    checks.push({ name: `${s} on tint`, ratio: ratio(fg, bg), gate: true });
  }
  checks.push({ name: "text on surface", ratio: ratio(readVar(container, "--text", "color"), surface), gate: true });
  checks.push({
    name: "text-muted on surface",
    ratio: ratio(readVar(container, "--text-muted", "color"), surface),
    gate: true,
  });
  checks.push({
    name: "text-faint (placeholder)",
    ratio: ratio(readVar(container, "--text-faint", "color"), surface),
    gate: false,
  });
  checks.push({
    name: "primary-fg on primary",
    ratio: ratio(readVar(container, "--primary-fg", "color"), readVar(container, "--primary", "bg")),
    gate: true,
  });
  return checks;
}

const CORE_TOKENS = [
  "--bg",
  "--surface",
  "--surface-raised",
  "--border",
  "--border-strong",
  "--text",
  "--text-muted",
  "--text-faint",
  "--primary",
  "--primary-fg",
  "--focus",
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Swatch({ token }: { token: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="h-8 w-8 shrink-0 rounded-md border border-border" style={{ background: `var(${token})` }} />
      <code className="text-muted-foreground">{token}</code>
    </div>
  );
}

function ContrastTable({ checks }: { checks: Check[] }) {
  return (
    <table className={cn(tableClass, "text-xs")}>
      <tbody>
        {checks.map((c) => {
          const fail = c.gate && c.ratio < 4.5;
          return (
            <tr key={c.name}>
              <td>{c.name}</td>
              <td className="num text-end">{c.ratio.toFixed(2)}:1</td>
              <td className="text-end">
                {c.gate ? (
                  <Chip token={fail ? "danger" : "success"} size="sm">
                    {fail ? "FAIL" : "pass"}
                  </Chip>
                ) : (
                  <span className="text-faint">n/a</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function DesignPreview() {
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");
  const [rtl, setRtl] = React.useState(false);
  const darkRef = React.useRef<HTMLDivElement>(null);
  const lightRef = React.useRef<HTMLDivElement>(null);
  const [checks, setChecks] = React.useState<{ dark: Check[]; light: Check[] } | null>(null);

  React.useEffect(() => {
    if (darkRef.current && lightRef.current) {
      setChecks({ dark: measure(darkRef.current), light: measure(lightRef.current) });
    }
  }, []);

  // Apply theme + dir on <html> (not a wrapper) so Radix portals inherit them too.
  React.useEffect(() => {
    const html = document.documentElement;
    const prevClass = html.className;
    const prevDir = html.getAttribute("dir") ?? "ltr";
    html.classList.remove("light", "dark");
    html.classList.add(theme);
    html.setAttribute("dir", rtl ? "rtl" : "ltr");
    return () => {
      html.className = prevClass;
      html.setAttribute("dir", prevDir);
    };
  }, [theme, rtl]);

  return (
    <TooltipProvider delayDuration={200}>
      {/* offscreen themed probes for contrast measurement */}
      <div ref={darkRef} className="dark pointer-events-none fixed opacity-0" aria-hidden />
      <div ref={lightRef} className="light pointer-events-none fixed opacity-0" aria-hidden />

      <div>
        <div className="min-h-screen bg-background p-6 text-foreground">
          <div className="mx-auto max-w-5xl space-y-10">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">Design preview</h1>
                <p className="text-sm text-muted-foreground">Direction A — Slate &amp; Emerald · every token &amp; component, both themes.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
                  Theme: {theme}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setRtl((r) => !r)}>
                  {rtl ? "RTL" : "LTR"}
                </Button>
              </div>
            </header>

            {/* 1 — Swatches + contrast */}
            <Section title="1 · Tokens & contrast">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {CORE_TOKENS.map((t) => (
                  <Swatch key={t} token={t} />
                ))}
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="card-surface p-4">
                  <h3 className="mb-2 text-sm font-medium">Dark contrast</h3>
                  {checks ? <ContrastTable checks={checks.dark} /> : <p className="text-xs text-muted-foreground">measuring…</p>}
                </div>
                <div className="card-surface p-4">
                  <h3 className="mb-2 text-sm font-medium">Light contrast</h3>
                  {checks ? <ContrastTable checks={checks.light} /> : <p className="text-xs text-muted-foreground">measuring…</p>}
                </div>
              </div>
            </Section>

            {/* 2 — Typography */}
            <Section title="2 · Typography">
              <div className="card-surface space-y-1 p-4">
                <p className="text-[32px] font-semibold leading-tight num">1 234 567 DA</p>
                <p className="text-2xl">Sétif · Béjaïa · Tizi Ouzou</p>
                <p className="text-xl" dir="rtl">فاطمة الزهراء بن عيسى</p>
                <p className="text-base font-medium">Section title (16 / 500)</p>
                <p className="text-sm">Body / table cell — the workhorse (14 / 400)</p>
                <p className="text-xs text-muted-foreground">Caption &amp; table meta (12)</p>
                <table className={cn(tableClass, "mt-3 max-w-xs")}>
                  <tbody>
                    <tr><td>Revenue</td><td className="num text-end">1 234 567 DA</td></tr>
                    <tr><td>Net profit</td><td className="num text-end text-success">+ 245 900 DA</td></tr>
                    <tr><td>Loss</td><td className="num text-end text-danger">− 45 000 DA</td></tr>
                    <tr><td>Missing</td><td className="num text-end text-faint">—</td></tr>
                  </tbody>
                </table>
              </div>
            </Section>

            {/* 3 — Status pills */}
            <Section title="3 · Status system">
              {(Object.keys(STATUS_KINDS) as StatusKind[]).map((kind) => (
                <div key={kind} className="space-y-2">
                  <h3 className="text-sm font-medium capitalize text-muted-foreground">{kind}</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(STATUS_KINDS[kind]).map((key) => (
                      <StatusPill key={key} kind={kind} status={key} />
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <RiskBadge score={12} />
                <RiskBadge score={45} />
                <RiskBadge score={80} />
                <Chip token="neutral" size="sm">Shopify</Chip>
                <Chip token="neutral" size="sm">Manual</Chip>
              </div>
              <div className="max-w-xs">
                <p className="mb-1 text-xs text-muted-foreground">StatusSelect (legal transitions only, pill in trigger + options):</p>
                <StatusSelect kind="delivery" value="in_transit" />
              </div>
            </Section>

            {/* 4 — Fields */}
            <Section title="4 · Fields">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Labeled label="Money (DZD)"><MoneyField defaultValue={125000} /></Labeled>
                <Labeled label="Money (USD → DZD)"><MoneyField defaultValue={100} currency="USD" rate={268.4} /></Labeled>
                <Labeled label="Percent"><PercentField defaultValue={64.3} /></Labeled>
                <Labeled label="Phone (dup hint)"><PhoneField defaultValue="0555123456" dupHint={{ label: "Existing customer — 3 orders", href: "#" }} /></Labeled>
                <Labeled label="Wilaya"><WilayaCombobox wilayas={WILAYAS} /></Labeled>
                <Labeled label="Commune (disabled until wilaya)"><CommuneCombobox communes={COMMUNES} wilayaSet={false} /></Labeled>
                <Labeled label="Product"><ProductCombobox products={PRODUCTS} /></Labeled>
                <Labeled label="Quantity"><QuantityStepper defaultValue={2} /></Labeled>
                <Labeled label="Date"><DateField /></Labeled>
                <Labeled label="Category"><CategorySelect defaultValue="packaging" /></Labeled>
                <Labeled label="Option (+ Create)"><OptionSelect options={OPTIONS} onCreate={(l) => toast.success(`Create ${l}`)} /></Labeled>
                <Labeled label="Options (multi)"><OptionMultiSelect options={OPTIONS} value={["cotton"]} onCreate={(l) => toast.success(`Create ${l}`)} /></Labeled>
                <Labeled label="Disabled"><Input disabled placeholder="Disabled input" /></Labeled>
                <Labeled label="Error"><Input aria-invalid className="border-danger" defaultValue="bad@" /></Labeled>
              </div>
              <Labeled label="Date range (presets)"><DateRangeField /></Labeled>
              <Labeled label="Notes (auto-grow)"><AutoTextarea placeholder="Type several lines…" /></Labeled>
              <div className="card-surface p-4">
                <SettingSwitch label="Low-stock alerts" description="Notify when a product falls below its threshold." defaultChecked />
                <SettingSwitch label="Auto-flag duplicates" description="Flag same phone + product within the window." />
              </div>
            </Section>

            {/* 5 — Buttons */}
            <Section title="5 · Buttons">
              <div className="flex flex-wrap items-center gap-3">
                <Button>Default</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="link">Link</Button>
                <Button disabled>Disabled</Button>
                <Button size="sm">Small</Button>
                <Button size="lg">Large</Button>
                <Checkbox defaultChecked />
                <Switch defaultChecked />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="destructive">Delete</Button>
              </div>
            </Section>

            {/* 6 — Data table */}
            <Section title="6 · Data table">
              <div className="card-surface overflow-hidden">
                <table className={tableClass}>
                  <thead>
                    <tr>
                      <th className="w-8"><Checkbox /></th>
                      <th>Order</th>
                      <th>Customer</th>
                      <th className="text-end">Total ↓</th>
                      <th>Status</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["1042", "Amine B.", 8200, "confirmed"],
                      ["1041", "Sara K.", 5400, "wait_for_confirmation"],
                      ["1040", "Yacine M.", 12750, "no_answer"],
                      ["1039", "Lina T.", 3600, "cancelled"],
                    ].map(([id, cust, total, st]) => (
                      <tr key={id as string} className="hover:bg-surface-raised">
                        <td><Checkbox /></td>
                        <td className="num">{id}</td>
                        <td>{cust}</td>
                        <td className="num text-end">{(total as number).toLocaleString("en-US").replace(/,/g, " ")} DA</td>
                        <td><StatusPill kind="confirmation" status={st as string} size="sm" /></td>
                        <td>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Row actions">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem><Pencil className="h-4 w-4" /> Edit</DropdownMenuItem>
                              <DropdownMenuItem destructive><Trash2 className="h-4 w-4" /> Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="card-surface space-y-2 p-4">
                  <p className="text-xs font-medium text-muted-foreground">Loading</p>
                  <Skeleton /><Skeleton /><Skeleton />
                </div>
                <div className="card-surface p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">No orders yet</p>
                  <p className="mt-1">Create your first order to see it here.</p>
                  <Button size="sm" className="mt-3">New order</Button>
                </div>
                <div className="card-surface p-4 text-sm">
                  <p className="font-medium text-danger">Couldn&apos;t load orders</p>
                  <p className="mt-1 text-muted-foreground">The request timed out.</p>
                  <Button size="sm" variant="outline" className="mt-3">Retry</Button>
                </div>
              </div>
            </Section>

            {/* 7 — Cards & charts */}
            <Section title="7 · Cards & charts">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="card-surface p-4">
                  <p className="text-xs text-muted-foreground">Net profit</p>
                  <p className="num mt-1 text-[32px] font-semibold leading-none text-success">245 900</p>
                  <p className="num mt-1 text-xs text-success">▲ 12.4% vs prev</p>
                  <svg viewBox="0 0 100 24" className="mt-2 h-6 w-full" preserveAspectRatio="none">
                    <polyline points="0,20 20,14 40,16 60,8 80,10 100,3" fill="none" stroke="var(--primary)" strokeWidth="2" />
                  </svg>
                </div>
                <div className="card-surface space-y-2 p-4">
                  <p className="text-xs text-muted-foreground">Bar chart (loading)</p>
                  <Skeleton /><Skeleton /><Skeleton />
                </div>
                <div className="card-surface p-4 text-sm text-muted-foreground">
                  <p className="text-xs">Line chart</p>
                  <p className="mt-6 text-center">No orders in this range — try Last 30 days.</p>
                </div>
                <div className="card-surface p-4">
                  <p className="mb-2 text-xs text-muted-foreground">Delivery rate (choropleth legend)</p>
                  <div className="space-y-1 text-xs">
                    {[["danger", "< 40%"], ["orange", "40–55%"], ["neutral", "n/a"], ["info", "55–70%"], ["success", "> 70%"]].map(([tok, range]) => (
                      <div key={range} className="flex items-center gap-2">
                        <span className="h-3 w-6 rounded" style={{ background: `var(--${tok})` }} />
                        {range}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* 8 — Feedback */}
            <Section title="8 · Feedback">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={() => toast.success("Changes saved")}>Toast: success</Button>
                <Button variant="outline" onClick={() => toast.error("Couldn't save — try again")}>Toast: error</Button>
                <Button variant="outline" onClick={() => toast("Order archived", { action: { label: "Undo", onClick: () => toast("Restored") } })}>Toast: undo</Button>
                <Dialog>
                  <DialogTrigger asChild><Button variant="destructive">Confirm dialog</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Delete order 1042?</DialogTitle>
                      <DialogDescription>This cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                      <DialogClose asChild><Button variant="destructive">Delete</Button></DialogClose>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Sheet>
                  <SheetTrigger asChild><Button variant="outline">Detail sheet</Button></SheetTrigger>
                  <SheetContent>
                    <SheetTitle>Order 1042</SheetTitle>
                    <SheetDescription>Amine B. · 0555 12 34 56</SheetDescription>
                    <StatusPill kind="confirmation" status="confirmed" />
                  </SheetContent>
                </Sheet>
                <Tooltip>
                  <TooltipTrigger asChild><Button variant="ghost">Hover me</Button></TooltipTrigger>
                  <TooltipContent>3 returns / 7 orders</TooltipContent>
                </Tooltip>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Skeleton() {
  return <div className="h-4 w-full animate-pulse rounded bg-surface-raised" />;
}

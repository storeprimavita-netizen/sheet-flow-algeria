import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useSheetsData, useAddContact, useUpdateContact } from "@/lib/sheets-hooks";
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
import { CONTACT_SERVICES } from "@/lib/partners";
import {
  Plus,
  Star,
  Phone,
  Mail,
  MessageCircle,
  Search,
  Pencil,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { Contact } from "@/lib/types";

export const Route = createFileRoute("/_app/contacts")({
  component: ContactsPage,
});

function ContactsPage() {
  const { data } = useSheetsData();
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");

  const filtered = (data?.contacts ?? [])
    .filter((c) =>
      search ? c.name.toLowerCase().includes(search.toLowerCase()) : true,
    )
    .filter((c) =>
      serviceFilter ? c.services.toLowerCase().includes(serviceFilter.toLowerCase()) : true,
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-sm text-muted-foreground">Suppliers, agents, and service providers</p>
        </div>
        <ContactDialog />
      </div>

      <div className="glass-card rounded-xl p-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Input
            placeholder="Filter by service..."
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <div key={c.contact_id} className="glass-card rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold">{c.name}</h3>
                <div className="text-xs text-muted-foreground">{c.location || "—"}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${
                        i < c.rating ? "fill-primary text-primary" : "text-muted"
                      }`}
                    />
                  ))}
                </div>
                <ContactDialog existing={c} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {c.services
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .map((s) => (
                  <span key={s} className="rounded-full bg-info/20 px-2 py-0.5 text-xs text-info">
                    {s}
                  </span>
                ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {c.phone && (
                <a
                  href={`tel:${c.phone}`}
                  className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs hover:bg-accent"
                >
                  <Phone className="h-3 w-3" /> Call
                </a>
              )}
              {c.whatsapp && (
                <a
                  href={`https://wa.me/${c.whatsapp.replace(/[^0-9]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 rounded-md bg-success/20 px-2 py-1 text-xs text-success"
                >
                  <MessageCircle className="h-3 w-3" /> WhatsApp
                </a>
              )}
              {c.email && (
                <a
                  href={`mailto:${c.email}`}
                  className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs hover:bg-accent"
                >
                  <Mail className="h-3 w-3" /> Email
                </a>
              )}
            </div>
            {c.notes && (
              <p className="mt-3 border-t border-border/40 pt-3 text-xs text-muted-foreground" dir="auto">
                {c.notes}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ContactDialog({ existing }: { existing?: Contact }) {
  const add = useAddContact();
  const update = useUpdateContact();
  const [open, setOpen] = useState(false);
  const isEdit = !!existing;

  const initial = () => ({
    name: existing?.name ?? "",
    services: (existing?.services ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    phone: existing?.phone ?? "",
    whatsapp: existing?.whatsapp ?? "",
    email: existing?.email ?? "",
    instagram: existing?.instagram ?? "",
    facebook: existing?.facebook ?? "",
    location: existing?.location ?? "",
    rating: existing?.rating ?? 0,
    notes: existing?.notes ?? "",
    status: existing?.status ?? "Active",
  });
  const [form, setForm] = useState(initial);

  useEffect(() => {
    if (open) setForm(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggleService = (s: string) => {
    setForm({
      ...form,
      services: form.services.includes(s)
        ? form.services.filter((x) => x !== s)
        : [...form.services, s],
    });
  };

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
            <Plus className="mr-1 h-4 w-4" /> Add Contact
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>👤 {isEdit ? "Edit Contact" : "New Contact"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Services</Label>
            <div className="flex flex-wrap gap-1">
              {CONTACT_SERVICES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleService(s)}
                  className={`rounded-full px-2 py-1 text-xs transition ${
                    form.services.includes(s)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <Label>Instagram</Label>
              <Input value={form.instagram} onChange={(e) => setForm({ ...form, instagram: e.target.value })} />
            </div>
            <div>
              <Label>Facebook</Label>
              <Input value={form.facebook} onChange={(e) => setForm({ ...form, facebook: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Rating</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setForm({ ...form, rating: n })}>
                  <Star
                    className={`h-6 w-6 ${
                      n <= form.rating ? "fill-primary text-primary" : "text-muted"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
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
                services: form.services.join(", "),
                phone: form.phone,
                whatsapp: form.whatsapp,
                email: form.email,
                instagram: form.instagram,
                facebook: form.facebook,
                location: form.location,
                rating: form.rating,
                price_range: "",
                notes: form.notes,
                status: form.status,
              };
              try {
                if (isEdit) {
                  await update.mutateAsync({ contact_id: existing!.contact_id, ...payload });
                  toast.success("Contact updated");
                } else {
                  await add.mutateAsync(payload);
                  toast.success("Contact added");
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

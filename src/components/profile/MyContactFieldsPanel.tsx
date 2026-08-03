"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";

interface FormState {
  firstName: string;
  lastName: string;
  company: string;
  phone: string;
  website: string;
  notes: string;
}

const EMPTY: FormState = { firstName: "", lastName: "", company: "", phone: "", website: "", notes: "" };

export function MyContactFieldsPanel() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/profile/contact")
      .then((res) => res.json())
      .then((data) => {
        const c = data.contact;
        if (c) {
          setForm({
            firstName: c.firstName ?? "",
            lastName: c.lastName ?? "",
            company: c.company ?? "",
            phone: c.phone ?? "",
            website: c.website ?? "",
            notes: c.notes ?? "",
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile/contact", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast.success("Contact details saved");
    } catch {
      toast.error("Failed to save contact details");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-text-muted text-sm">Loading...</p>;

  return (
    <div className="border-border rounded-card border bg-white p-5">
      <h3 className="text-text-primary text-sm font-semibold">Custom Fields</h3>
      <p className="text-text-secondary mt-0.5 text-sm">
        Your details, kept in sync with the Contacts list and available as custom values in emails.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First Name">
          <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </Field>
        <Field label="Last Name">
          <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </Field>
        <Field label="Company">
          <Input value={form.company} onChange={(e) => set("company", e.target.value)} />
        </Field>
        <Field label="Contact Number">
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label="Website">
          <Input value={form.website} onChange={(e) => set("website", e.target.value)} />
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Details">
          <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={handleSave} loading={saving}>
          Save
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-text-secondary text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

interface Props {
  teamPanel: React.ReactNode;
  companyPanel: React.ReactNode;
  documentsPanel: React.ReactNode;
  categoriesPanel: React.ReactNode;
  emailPanel: React.ReactNode;
  phonePanel: React.ReactNode;
  customFieldsPanel: React.ReactNode;
  customValuesPanel: React.ReactNode;
  tagsPanel: React.ReactNode;
}

const GROUPS = [
  {
    label: "Workspace",
    items: [
      { id: "team", label: "Team" },
      { id: "company", label: "Company Branding" },
    ],
  },
  {
    label: "Content",
    items: [
      { id: "documents", label: "Documents" },
      { id: "categories", label: "Note Categories" },
    ],
  },
  {
    label: "Communication",
    items: [
      { id: "email", label: "Agency Email" },
      { id: "phone", label: "Calling" },
    ],
  },
  {
    label: "Data Management",
    items: [
      { id: "customFields", label: "Custom Fields" },
      { id: "customValues", label: "Custom Values" },
      { id: "tags", label: "Tags" },
    ],
  },
] as const;

type TabId = (typeof GROUPS)[number]["items"][number]["id"];

/** GHL-style Settings layout: a left nav (grouped, with a Back-to-Dashboard link above it) and the selected panel on the right -- replaces the old horizontal tab bar, which stopped fitting once Custom Fields/Values/Tags pushed the tab count to nine. */
export function SettingsNav({
  teamPanel,
  companyPanel,
  documentsPanel,
  categoriesPanel,
  emailPanel,
  phonePanel,
  customFieldsPanel,
  customValuesPanel,
  tagsPanel,
}: Props) {
  const [active, setActive] = useState<TabId>("team");

  const panels: Record<TabId, React.ReactNode> = {
    team: teamPanel,
    company: companyPanel,
    documents: documentsPanel,
    categories: categoriesPanel,
    email: emailPanel,
    phone: phonePanel,
    customFields: customFieldsPanel,
    customValues: customValuesPanel,
    tags: tagsPanel,
  };

  return (
    <div className="flex gap-8">
      <nav className="w-56 flex-shrink-0 space-y-6">
        <div className="space-y-3">
          <Link
            href="/"
            className="text-text-secondary hover:text-text-primary -ml-1 inline-flex items-center gap-1.5 rounded-btn px-1 py-1 text-sm font-medium transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-text-primary text-xl font-semibold">Settings</h1>
        </div>

        {GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-text-muted mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={cn(
                    "w-full rounded-btn px-2 py-1.5 text-left text-sm font-medium transition-colors",
                    active === item.id
                      ? "bg-brand-primary/10 text-brand-primary"
                      : "text-text-secondary hover:bg-surface-hover hover:text-text-primary",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="min-w-0 flex-1">{panels[active]}</div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  companyPanel: React.ReactNode;
  documentsPanel: React.ReactNode;
  categoriesPanel: React.ReactNode;
}

const TABS = [
  { id: "company", label: "Company Branding" },
  { id: "documents", label: "Documents" },
  { id: "categories", label: "Note Categories" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SettingsTabs({ companyPanel, documentsPanel, categoriesPanel }: Props) {
  const [active, setActive] = useState<TabId>("company");

  return (
    <div>
      <div className="flex border-b border-border mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
              active === tab.id
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "company" && companyPanel}
      {active === "documents" && documentsPanel}
      {active === "categories" && categoriesPanel}
    </div>
  );
}

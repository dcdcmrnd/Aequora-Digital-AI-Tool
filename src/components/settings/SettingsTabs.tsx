"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  teamPanel: React.ReactNode;
  companyPanel: React.ReactNode;
  documentsPanel: React.ReactNode;
  categoriesPanel: React.ReactNode;
  emailPanel: React.ReactNode;
  phonePanel: React.ReactNode;
}

const TABS = [
  { id: "team", label: "Team" },
  { id: "company", label: "Company Branding" },
  { id: "documents", label: "Documents" },
  { id: "categories", label: "Note Categories" },
  { id: "email", label: "Agency Email" },
  { id: "phone", label: "Calling" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SettingsTabs({ teamPanel, companyPanel, documentsPanel, categoriesPanel, emailPanel, phonePanel }: Props) {
  const [active, setActive] = useState<TabId>("team");

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

      {active === "team" && teamPanel}
      {active === "company" && companyPanel}
      {active === "documents" && documentsPanel}
      {active === "categories" && categoriesPanel}
      {active === "email" && emailPanel}
      {active === "phone" && phonePanel}
    </div>
  );
}

"use client";

import { X } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/Select";
import { cn } from "@/lib/utils";

const ANY = "__any__";

interface CreatorOption {
  id: string;
  name: string;
}

interface StageOption {
  id: string;
  name: string;
}

interface ContactsFilterBarProps {
  availableTags: string[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;

  availableCompanies: string[];
  selectedCompany: string | null;
  onCompanyChange: (company: string | null) => void;

  stages: StageOption[];
  selectedStageId: string | null;
  onStageChange: (stageId: string | null) => void;

  creators: CreatorOption[];
  selectedCreatedById: string | null;
  onCreatedByChange: (id: string | null) => void;

  onClearAll: () => void;
}

export function ContactsFilterBar({
  availableTags,
  selectedTags,
  onToggleTag,
  availableCompanies,
  selectedCompany,
  onCompanyChange,
  stages,
  selectedStageId,
  onStageChange,
  creators,
  selectedCreatedById,
  onCreatedByChange,
  onClearAll,
}: ContactsFilterBarProps) {
  const hasActiveFilters =
    selectedTags.length > 0 || !!selectedCompany || !!selectedStageId || !!selectedCreatedById;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {availableCompanies.length > 0 && (
          <Select value={selectedCompany ?? ANY} onValueChange={(v) => onCompanyChange(v === ANY ? null : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Company" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>All companies</SelectItem>
              {availableCompanies.map((company) => (
                <SelectItem key={company} value={company}>
                  {company}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {stages.length > 0 && (
          <Select value={selectedStageId ?? ANY} onValueChange={(v) => onStageChange(v === ANY ? null : v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Pipeline stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any pipeline stage</SelectItem>
              {stages.map((stage) => (
                <SelectItem key={stage.id} value={stage.id}>
                  {stage.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {creators.length > 0 && (
          <Select value={selectedCreatedById ?? ANY} onValueChange={(v) => onCreatedByChange(v === ANY ? null : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Added by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Anyone</SelectItem>
              {creators.map((creator) => (
                <SelectItem key={creator.id} value={creator.id}>
                  {creator.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-text-muted hover:text-text-primary flex items-center gap-1 text-xs"
          >
            <X className="size-3.5" />
            Clear filters
          </button>
        )}
      </div>

      {availableTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {availableTags.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => onToggleTag(tag)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-brand-primary bg-brand-primary/10 text-brand-primary font-medium"
                    : "border-border text-text-secondary hover:border-brand-primary hover:text-brand-primary",
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { X } from "lucide-react";

import { SECTION_TEMPLATES, type SectionTemplate } from "@/lib/site-builder/sectionTemplates";

interface SectionTemplatePickerProps {
  onPick: (template: SectionTemplate) => void;
  onClose: () => void;
}

export function SectionTemplatePicker({ onPick, onClose }: SectionTemplatePickerProps) {
  return (
    <div className="fixed inset-y-0 right-0 z-40 w-[26rem] border-l border-border bg-white shadow-2xl flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-text-primary text-sm font-semibold">Add a Section</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-3">
          {SECTION_TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onPick(template)}
              className="hover:border-brand-primary group rounded-md border border-border p-2 text-left transition-colors"
            >
              <SectionMockup type={template.mockup} />
              <p className="text-text-primary group-hover:text-brand-primary mt-2 text-xs font-medium">{template.label}</p>
              <p className="text-text-muted text-[10px]">{template.category}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Small CSS-drawn schematic of the layout -- not a rendered screenshot, just enough to communicate shape at a glance. */
function SectionMockup({ type }: { type: SectionTemplate["mockup"] }) {
  const bar = (widthClass: string, className = "bg-gray-300") => <div className={`h-1.5 rounded-full ${widthClass} ${className}`} />;

  return (
    <div className="flex h-20 flex-col items-center justify-center gap-1.5 rounded bg-gray-50 p-3">
      {type === "hero" && (
        <>
          {bar("w-3/4", "bg-gray-400")}
          {bar("w-1/2")}
          <div className="mt-1 h-2.5 w-10 rounded-full bg-gray-800" />
        </>
      )}
      {type === "features" && (
        <div className="flex w-full gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1 rounded bg-white p-1.5">
              <div className="size-2.5 rounded-full bg-gray-400" />
              {bar("w-full")}
              {bar("w-2/3")}
            </div>
          ))}
        </div>
      )}
      {type === "textImage" && (
        <div className="flex w-full items-center gap-2">
          <div className="flex-1 space-y-1.5">
            {bar("w-full", "bg-gray-400")}
            {bar("w-full")}
            {bar("w-2/3")}
          </div>
          <div className="aspect-square flex-1 rounded bg-gray-300" />
        </div>
      )}
      {type === "testimonial" && (
        <>
          {bar("w-4/5")}
          {bar("w-3/5")}
          <div className="mt-1.5 h-2 w-16 rounded-full bg-gray-400" />
        </>
      )}
      {type === "cta" && (
        <div className="flex w-full flex-col items-center gap-1.5 rounded bg-gray-800 p-2.5">
          {bar("w-2/3", "bg-gray-300")}
          <div className="mt-0.5 h-2.5 w-9 rounded-full bg-white" />
        </div>
      )}
    </div>
  );
}

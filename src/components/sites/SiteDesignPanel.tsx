"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useSite } from "@/hooks/useSites";
import { DESIGN_PRESETS } from "@/lib/site-builder/designPresets";
import { parseThemeTokens } from "@/lib/site-builder/theme";
import type { ThemeTokens } from "@/lib/site-builder/types";

interface SiteDesignPanelProps {
  siteId: string;
  themeTokensJson: string;
  onClose: () => void;
}

export function SiteDesignPanel({ siteId, themeTokensJson, onClose }: SiteDesignPanelProps) {
  const { updateThemeTokens } = useSite(siteId);
  const [tokens, setTokens] = useState<ThemeTokens>(() => parseThemeTokens(themeTokensJson));

  function applyPreset(presetId: string) {
    const preset = DESIGN_PRESETS.find((p) => p.id === presetId);
    if (preset) setTokens({ preset: preset.id, ...preset.tokens });
  }

  function setColor(key: keyof ThemeTokens["colors"], value: string) {
    setTokens((prev) => ({ ...prev, colors: { ...prev.colors, [key]: value } }));
  }

  function handleSave() {
    updateThemeTokens.mutate(JSON.stringify(tokens), { onSuccess: onClose });
  }

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 border-l border-border bg-white shadow-2xl flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-text-primary text-sm font-semibold">Site Design</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div>
          <p className="text-text-secondary mb-2 text-xs font-medium">Style</p>
          <div className="grid grid-cols-2 gap-2">
            {DESIGN_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyPreset(preset.id)}
                className={`relative rounded-md border p-3 text-left transition-colors ${
                  tokens.preset === preset.id ? "border-brand-primary ring-1 ring-brand-primary" : "border-border hover:border-brand-primary/50"
                }`}
              >
                {tokens.preset === preset.id && <Check className="text-brand-primary absolute right-2 top-2 size-3.5" />}
                <p className="text-sm font-semibold" style={{ fontFamily: preset.tokens.fonts.heading, color: preset.tokens.colors.primary }}>
                  {preset.label}
                </p>
                <div className="mt-1.5 flex gap-1">
                  {Object.values(preset.tokens.colors).map((c, i) => (
                    <div key={i} className="size-3 rounded-full border border-black/10" style={{ backgroundColor: c }} />
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-text-secondary mb-2 text-xs font-medium">Fine-tune colors</p>
          <div className="grid grid-cols-2 gap-3">
            <ColorField label="Primary" value={tokens.colors.primary} onChange={(v) => setColor("primary", v)} />
            <ColorField label="Secondary" value={tokens.colors.secondary} onChange={(v) => setColor("secondary", v)} />
            <ColorField label="Background" value={tokens.colors.background} onChange={(v) => setColor("background", v)} />
            <ColorField label="Text" value={tokens.colors.text} onChange={(v) => setColor("text", v)} />
          </div>
        </div>

        <p className="text-text-muted text-xs">Applies to every page on this site -- section templates and buttons use these colors automatically.</p>
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-border p-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSave} loading={updateThemeTokens.isPending}>
          Save
        </Button>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1">
      <span className="text-text-secondary text-xs font-medium">{label}</span>
      <Input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 p-1" />
    </label>
  );
}

import type { ThemeTokens } from "./types";

/**
 * Curated font-pair + color-palette bundles, Squarespace-style -- the primary Design flow is
 * "pick a preset," not raw font/color pickers (those exist too, as fine-tuning underneath).
 * Font families are pulled from a small fixed Google Fonts list (GOOGLE_FONT_FAMILIES below), so
 * every preset here only ever references a font already in that list -- keeps font loading
 * bounded rather than arbitrary.
 */
export interface DesignPreset {
  id: string;
  label: string;
  tokens: Omit<ThemeTokens, "preset">;
}

export const DESIGN_PRESETS: DesignPreset[] = [
  {
    id: "modern",
    label: "Modern",
    tokens: {
      fonts: { heading: "Inter", body: "Inter" },
      colors: { primary: "#111827", secondary: "#6B7280", background: "#FFFFFF", text: "#1F2937" },
    },
  },
  {
    id: "editorial",
    label: "Editorial",
    tokens: {
      fonts: { heading: "Playfair Display", body: "Source Serif 4" },
      colors: { primary: "#1C1917", secondary: "#78716C", background: "#FAF9F7", text: "#292524" },
    },
  },
  {
    id: "bold",
    label: "Bold",
    tokens: {
      fonts: { heading: "Poppins", body: "Inter" },
      colors: { primary: "#DC2626", secondary: "#0F172A", background: "#FFFFFF", text: "#0F172A" },
    },
  },
  {
    id: "organic",
    label: "Organic",
    tokens: {
      fonts: { heading: "Fraunces", body: "Karla" },
      colors: { primary: "#4D7C0F", secondary: "#A16207", background: "#FBFAF5", text: "#292524" },
    },
  },
  {
    id: "minimal",
    label: "Minimal",
    tokens: {
      fonts: { heading: "Inter", body: "Inter" },
      colors: { primary: "#000000", secondary: "#737373", background: "#FFFFFF", text: "#171717" },
    },
  },
  {
    id: "corporate",
    label: "Corporate",
    tokens: {
      fonts: { heading: "IBM Plex Sans", body: "IBM Plex Sans" },
      colors: { primary: "#0F7B8A", secondary: "#0A2540", background: "#FFFFFF", text: "#1A1D23" },
    },
  },
];

/** Every font family referenced by a preset above, plus the app's default -- the full set requested from Google Fonts, see the <link> built in SiteBuilderCanvas.tsx / the public page layout. */
export const GOOGLE_FONT_FAMILIES = [
  "Inter:wght@400;500;600;700",
  "Playfair Display:wght@400;600;700",
  "Source Serif 4:wght@400;500;600",
  "Poppins:wght@400;500;600;700",
  "Fraunces:wght@400;500;600",
  "Karla:wght@400;500;600",
  "IBM Plex Sans:wght@400;500;600;700",
];

export function googleFontsHref(): string {
  return `https://fonts.googleapis.com/css2?${GOOGLE_FONT_FAMILIES.map((f) => `family=${encodeURIComponent(f)}`).join("&")}&display=swap`;
}

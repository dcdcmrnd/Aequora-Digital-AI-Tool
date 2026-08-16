import type { ThemeTokens } from "./types";

export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  preset: "modern",
  fonts: { heading: "Inter", body: "Inter" },
  colors: { primary: "#111827", secondary: "#6B7280", background: "#FFFFFF", text: "#1F2937" },
};

/** Parses Site.themeTokens (JSON string) with fallback, same parse-with-fallback shape as parseFlow()/parseContent(). */
export function parseThemeTokens(themeTokensJson: string | null | undefined): ThemeTokens {
  if (!themeTokensJson) return DEFAULT_THEME_TOKENS;
  try {
    const parsed = JSON.parse(themeTokensJson);
    return {
      preset: parsed.preset ?? DEFAULT_THEME_TOKENS.preset,
      fonts: { ...DEFAULT_THEME_TOKENS.fonts, ...parsed.fonts },
      colors: { ...DEFAULT_THEME_TOKENS.colors, ...parsed.colors },
    };
  } catch {
    return DEFAULT_THEME_TOKENS;
  }
}

/**
 * Maps theme tokens to CSS custom properties, consumed by .site-content's rules in globals.css.
 * Used identically by the public render path and the editor canvas artboard so neither can drift
 * from the other.
 */
export function themeTokensToCssVars(tokens: ThemeTokens): React.CSSProperties {
  return {
    "--site-font-heading": tokens.fonts.heading,
    "--site-font-body": tokens.fonts.body,
    "--site-color-primary": tokens.colors.primary,
    "--site-color-secondary": tokens.colors.secondary,
    "--site-color-background": tokens.colors.background,
    "--site-color-text": tokens.colors.text,
  } as React.CSSProperties;
}

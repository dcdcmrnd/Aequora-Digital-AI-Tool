/**
 * Small, abstract, decorative panels that peek from behind each service card -- not literal
 * dashboards, just enough visual texture to hint at "webpage", "software", "automation".
 * Purely decorative: aria-hidden, no text content of their own.
 */
export function ServiceVisual({ kind }: { kind: "web" | "software" | "automation" }) {
  if (kind === "web") {
    return (
      <svg aria-hidden="true" viewBox="0 0 140 100" className="h-full w-full">
        <rect x="4" y="4" width="132" height="92" rx="10" fill="#FFFFFF" stroke="#E2E8F0" />
        <rect x="4" y="4" width="132" height="20" rx="10" fill="#F1F5F9" />
        <circle cx="16" cy="14" r="2.5" fill="#CBD5E1" />
        <circle cx="25" cy="14" r="2.5" fill="#CBD5E1" />
        <circle cx="34" cy="14" r="2.5" fill="#CBD5E1" />
        <rect x="16" y="34" width="70" height="8" rx="4" fill="#1E293B" opacity={0.85} />
        <rect x="16" y="48" width="94" height="5" rx="2.5" fill="#CBD5E1" />
        <rect x="16" y="58" width="80" height="5" rx="2.5" fill="#CBD5E1" />
        <rect x="16" y="72" width="34" height="12" rx="6" fill="#2563EB" />
      </svg>
    );
  }

  if (kind === "software") {
    return (
      <svg aria-hidden="true" viewBox="0 0 140 100" className="h-full w-full">
        <rect x="4" y="4" width="132" height="92" rx="10" fill="#FFFFFF" stroke="#E2E8F0" />
        <rect x="4" y="4" width="34" height="92" rx="10" fill="#F1F5F9" />
        <rect x="12" y="18" width="18" height="5" rx="2.5" fill="#94A3B8" />
        <rect x="12" y="30" width="18" height="5" rx="2.5" fill="#CBD5E1" />
        <rect x="12" y="42" width="18" height="5" rx="2.5" fill="#CBD5E1" />
        <rect x="48" y="18" width="76" height="24" rx="6" fill="#EFF6FF" stroke="#DBEAFE" />
        <rect x="56" y="26" width="34" height="5" rx="2.5" fill="#2563EB" opacity={0.7} />
        <rect x="56" y="34" width="50" height="4" rx="2" fill="#93C5FD" />
        <rect x="48" y="50" width="36" height="34" rx="6" fill="#F8FAFC" stroke="#E2E8F0" />
        <rect x="88" y="50" width="36" height="34" rx="6" fill="#F8FAFC" stroke="#E2E8F0" />
        <rect x="55" y="58" width="20" height="4" rx="2" fill="#CBD5E1" />
        <rect x="55" y="66" width="16" height="4" rx="2" fill="#CBD5E1" />
        <rect x="95" y="58" width="20" height="4" rx="2" fill="#CBD5E1" />
        <rect x="95" y="66" width="16" height="4" rx="2" fill="#CBD5E1" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 140 100" className="h-full w-full">
      <rect x="4" y="4" width="132" height="92" rx="10" fill="#FFFFFF" stroke="#E2E8F0" />
      <path d="M28 30 L70 50 L28 70" fill="none" stroke="#BFDBFE" strokeWidth="1.5" strokeDasharray="3 4" />
      <path d="M112 30 L70 50 L112 70" fill="none" stroke="#BFDBFE" strokeWidth="1.5" strokeDasharray="3 4" />
      <circle cx="28" cy="30" r="7" fill="#F8FAFC" stroke="#CBD5E1" />
      <circle cx="28" cy="70" r="7" fill="#F8FAFC" stroke="#CBD5E1" />
      <circle cx="112" cy="30" r="7" fill="#F8FAFC" stroke="#CBD5E1" />
      <circle cx="112" cy="70" r="7" fill="#F8FAFC" stroke="#CBD5E1" />
      <circle cx="70" cy="50" r="11" fill="#2563EB" />
      <circle cx="70" cy="50" r="4" fill="#EFF6FF" />
    </svg>
  );
}

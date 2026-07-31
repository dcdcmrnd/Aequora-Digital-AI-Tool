import { Globe, ShieldAlert, XCircle } from "lucide-react";

interface WebsiteStatusProps {
  website: string | null;
  httpsEnabled?: boolean | null;
}

function hostnameFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function WebsiteStatus({ website, httpsEnabled }: WebsiteStatusProps) {
  if (!website) {
    return (
      <span className="text-text-muted inline-flex items-center gap-1.5 text-sm">
        <XCircle className="size-3.5" />
        No Website
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <a
        href={website}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand-primary inline-flex items-center gap-1.5 text-sm hover:underline"
      >
        <Globe className="size-3.5" />
        {hostnameFor(website)}
      </a>
      {httpsEnabled === false && (
        <span title="No HTTPS">
          <ShieldAlert className="size-3.5 text-amber-500" aria-label="No HTTPS" />
        </span>
      )}
    </div>
  );
}

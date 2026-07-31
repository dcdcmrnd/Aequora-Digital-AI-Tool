import { MapPin, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { cn, formatDate } from "@/lib/utils";
import type { LeadSearch } from "@/types";

interface SearchHistoryCardProps {
  search: LeadSearch;
  onRerun: () => void;
  isRerunning?: boolean;
}

export function SearchHistoryCard({ search, onRerun, isRerunning }: SearchHistoryCardProps) {
  return (
    <div className="rounded-card border-border flex items-center justify-between gap-4 border bg-white p-4">
      <div className="min-w-0">
        <p className="text-text-primary truncate font-medium">{search.keyword}</p>
        <p className="text-text-muted flex items-center gap-1 text-xs">
          <MapPin className="size-3.5" />
          {search.location}
        </p>
        <p className="text-text-muted text-xs">
          {formatDate(search.createdAt)} · {search.resultsCount} results
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRerun} disabled={isRerunning}>
        <RotateCw className={cn("size-3.5", isRerunning && "animate-spin")} />
        Rerun
      </Button>
    </div>
  );
}

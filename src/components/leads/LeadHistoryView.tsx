"use client";

import { useRouter } from "next/navigation";

import { SearchHistoryCard } from "@/components/leads/SearchHistoryCard";
import { useLeadSearch } from "@/hooks/useLeadSearch";
import type { LeadSearch } from "@/types";

export function LeadHistoryView() {
  const { history, search } = useLeadSearch();
  const router = useRouter();

  function handleRerun(item: LeadSearch) {
    search.mutate(
      { keyword: item.keyword, location: item.location, radiusMeters: item.radius ?? undefined },
      { onSuccess: () => router.push("/leads") },
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-text-primary text-2xl font-semibold tracking-tight">Search History</h1>
        <p className="text-text-muted text-sm">Review and rerun your past searches.</p>
      </div>

      {history.isLoading ? (
        <p className="text-text-muted text-sm">Loading...</p>
      ) : history.data && history.data.searches.length > 0 ? (
        <div className="space-y-2">
          {history.data.searches.map((item) => (
            <SearchHistoryCard
              key={item.id}
              search={item}
              onRerun={() => handleRerun(item)}
              isRerunning={search.isPending}
            />
          ))}
        </div>
      ) : (
        <p className="text-text-muted text-sm">No searches yet. Run a search to get started.</p>
      )}
    </div>
  );
}

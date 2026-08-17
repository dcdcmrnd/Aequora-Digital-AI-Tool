"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { PeopleTable } from "@/components/leads/PeopleTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { useBulkSavePeopleAsContacts } from "@/hooks/usePeople";
import { useRemoteHiringSearch, type RemoteHiringSearchResponse } from "@/hooks/useRemoteHiringSearch";
import type { LeadPerson, RemoteHiringPost } from "@/types";

function postStatus(post: RemoteHiringPost) {
  if (!post.leadId) return <Badge variant="muted">No match — research manually</Badge>;
  if ((post.lead?.people.length ?? 0) > 0) return <Badge variant="success">Contact found</Badge>;
  return <Badge variant="warning">Matched, no contact</Badge>;
}

// Survives switching tabs away and back within the same browser session (the
// component unmounts/remounts each time, which would otherwise blank the
// view and re-run the search) -- module-level rather than component state
// specifically so re-mounting doesn't lose it. Not persisted beyond a
// reload: each search does a real, billed Google Places lookup per matched
// company, so auto-firing it again on every reload isn't worth avoiding one
// extra click.
let cachedResult: RemoteHiringSearchResponse | null = null;

/**
 * Sources hiring signals from a live remote job board (Remotive) instead of
 * an Industry + Location business search: finds companies currently posting
 * remote roles, best-effort matches each to a real business via Google
 * Places, then crawls its site for a named contact -- same pipeline as
 * People Search, so results land in the same "Found People" pool.
 */
export function RemoteHiringView() {
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | undefined>();
  const [cached, setCached] = useState<RemoteHiringSearchResponse | null>(cachedResult);

  const search = useRemoteHiringSearch();
  const saveAsContacts = useBulkSavePeopleAsContacts();

  // Auto-loads the current top remote-hiring listings (empty keyword = no
  // filter, see searchRemoteHiringJobs) so the tab shows something on open
  // instead of an empty form -- but only once per session (see cachedResult
  // above), since each run does a real Places lookup per matched company.
  useEffect(() => {
    if (cachedResult || search.isPending) return;
    search.mutate(
      { keyword: "", location: undefined },
      { onSuccess: (result) => { cachedResult = result; setCached(result); } },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const data = search.data ?? cached;
  const posts = data?.posts ?? [];

  // PeopleTable expects each person's `lead` relation for its Company
  // column/link -- the nested crawl result doesn't carry it back (it's
  // selected under Lead, not re-joined to itself), so it's reattached here
  // from the post it came from.
  const people: LeadPerson[] = posts.flatMap((post) =>
    (post.lead?.people ?? []).map((person) => ({
      ...person,
      lead: { id: post.leadId as string, name: post.companyName, city: null, state: null, website: post.companyWebsite },
    })),
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSelectedIds(new Set());
    search.mutate(
      { keyword: keyword.trim(), location: location.trim() || undefined },
      { onSuccess: (result) => { cachedResult = result; setCached(result); } },
    );
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(idsOnPage: string[]) {
    setSelectedIds((prev) => {
      const allSelected = idsOnPage.length > 0 && idsOnPage.every((id) => prev.has(id));
      const next = new Set(prev);
      idsOnPage.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  function handleSaveAsContact(person: LeadPerson) {
    setSavingId(person.id);
    saveAsContacts.mutate([person.id], { onSettled: () => setSavingId(undefined) });
  }

  function handleBulkSaveAsContact() {
    saveAsContacts.mutate(Array.from(selectedIds), { onSuccess: () => setSelectedIds(new Set()) });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-text-secondary mb-1 block text-xs font-medium">Role or keyword</label>
          <Input
            placeholder="Leave blank to see all current listings"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-64"
          />
        </div>
        <div>
          <label className="text-text-secondary mb-1 block text-xs font-medium">Location (optional)</label>
          <Input
            placeholder="e.g. USA only"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-52"
          />
        </div>
        <Button type="submit" loading={search.isPending}>
          <Search className="size-3.5" />
          Search
        </Button>
      </form>

      {search.isPending && (
        <p className="text-text-muted text-sm">
          Checking remote job boards and looking up each company — this can take up to a minute.
        </p>
      )}

      {search.isError && <p className="text-danger text-sm">That search failed. Please try again.</p>}

      {data && !search.isPending && (
        <>
          <p className="text-text-muted text-sm">
            Found {data.jobsFound} job posts, matched {data.companiesMatched} to a real business —{" "}
            {data.peopleFound} {data.peopleFound === 1 ? "person" : "people"} found.
          </p>

          <div className="rounded-card border-border overflow-x-auto border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Hiring for</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Listing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.length ? (
                  posts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell className="whitespace-nowrap font-medium text-text-primary">
                        {post.leadId ? (
                          <Link href={`/leads/${post.leadId}`} className="hover:underline">
                            {post.companyName}
                          </Link>
                        ) : (
                          post.companyName
                        )}
                      </TableCell>
                      <TableCell>{post.position}</TableCell>
                      <TableCell className="text-text-muted whitespace-nowrap">{post.candidateLocation ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{postStatus(post)}</TableCell>
                      <TableCell>
                        <a
                          href={post.applyUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-primary hover:underline"
                        >
                          View
                        </a>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-text-muted h-24 text-center">
                      No remote job posts matched that search.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {people.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-text-primary text-sm font-semibold">People found</h4>

              {selectedIds.size > 0 && (
                <div className="border-border bg-surface-secondary flex items-center gap-3 rounded-btn border px-3 py-2 text-sm">
                  <span>{selectedIds.size} selected</span>
                  <Button size="sm" variant="outline" onClick={handleBulkSaveAsContact} disabled={saveAsContacts.isPending}>
                    Save as Contact
                  </Button>
                </div>
              )}

              <PeopleTable
                data={people}
                page={1}
                pageSize={Math.max(people.length, 1)}
                total={people.length}
                onPageChange={() => {}}
                selectedIds={selectedIds}
                onToggle={toggle}
                onToggleAll={toggleAll}
                onSaveAsContact={handleSaveAsContact}
                savingId={savingId}
              />
            </div>
          )}
        </>
      )}

      {!data && !search.isPending && !search.isError && (
        <p className="text-text-muted text-xs">
          Searches Remotive for companies currently posting remote-hiring job ads, then best-effort matches each to a
          real business (via Google Places) and crawls its site for a named contact — phone included when the
          business has one on file. Companies with no confident match still show up so you can look into them
          manually.
        </p>
      )}
    </div>
  );
}

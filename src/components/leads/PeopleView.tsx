"use client";

import { FoundPeopleView } from "@/components/leads/FoundPeopleView";
import { PeopleSearchView } from "@/components/leads/PeopleSearchView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";

/**
 * Two independent ways to find people, kept deliberately separate: people
 * found manually via "Find People" on a business in the Company tab
 * (FoundPeopleView), and people auto-discovered by Position + Industry +
 * Location (PeopleSearchView, PeopleSearch-tagged results).
 */
export function PeopleView() {
  return (
    <Tabs defaultValue="found">
      <TabsList>
        <TabsTrigger value="found">Found People</TabsTrigger>
        <TabsTrigger value="search">People Search</TabsTrigger>
      </TabsList>

      <TabsContent value="found">
        <FoundPeopleView />
      </TabsContent>

      <TabsContent value="search">
        <PeopleSearchView />
      </TabsContent>
    </Tabs>
  );
}

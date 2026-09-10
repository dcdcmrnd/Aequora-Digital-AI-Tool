"use client";

import { FoundPeopleView } from "@/components/leads/FoundPeopleView";
import { IdentifyEmailView } from "@/components/leads/IdentifyEmailView";
import { PeopleSearchView } from "@/components/leads/PeopleSearchView";
import { RemoteHiringView } from "@/components/leads/RemoteHiringView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";

/**
 * Four independent ways to find or identify people, kept deliberately
 * separate: people found manually via "Find People" on a business in the
 * Company tab (FoundPeopleView), people auto-discovered by Position +
 * Industry + Location (PeopleSearchView, PeopleSearch-tagged results),
 * companies actively hiring remote staff right now (RemoteHiringView,
 * sourced from a live job board instead of a business search), and reverse
 * lookup from a single email address to its company/owner (IdentifyEmailView).
 */
export function PeopleView() {
  return (
    <Tabs defaultValue="found">
      <TabsList>
        <TabsTrigger value="found">Found People</TabsTrigger>
        <TabsTrigger value="search">People Search</TabsTrigger>
        <TabsTrigger value="hiring">Hiring Now</TabsTrigger>
        <TabsTrigger value="identify">Identify Email</TabsTrigger>
      </TabsList>

      <TabsContent value="found">
        <FoundPeopleView />
      </TabsContent>

      <TabsContent value="search">
        <PeopleSearchView />
      </TabsContent>

      <TabsContent value="hiring">
        <RemoteHiringView />
      </TabsContent>

      <TabsContent value="identify">
        <IdentifyEmailView />
      </TabsContent>
    </Tabs>
  );
}

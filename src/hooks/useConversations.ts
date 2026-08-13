"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

export interface EmailTimelineItem {
  type: "email";
  id: string;
  threadId: string;
  date: string;
  from: string;
  to: string;
  isOutgoing: boolean;
  subject: string;
  html: string;
  text: string;
}

export interface CallTimelineItem {
  type: "call";
  id: string;
  date: string;
  status: string;
  durationSec: number | null;
  recordingSid: string | null;
  answeredBy: string | null;
  userName: string;
}

export type TimelineItem = EmailTimelineItem | CallTimelineItem;

export interface ContactTimeline {
  items: TimelineItem[];
  gmailConnected: boolean;
  contactEmail: string | null;
}

export function useContactTimeline(contactId: string | null) {
  const query = useQuery({
    queryKey: ["contact-timeline", contactId],
    queryFn: () => apiFetch<ContactTimeline>(`/api/contacts/${contactId}/timeline`),
    enabled: !!contactId,
  });
  return { ...query, items: query.data?.items ?? [] };
}

export interface ContactAutomationRun {
  id: string;
  status: string;
  automationId: string;
  automationName: string;
  createdAt: string;
  updatedAt: string;
}

export function useContactAutomationRuns(contactId: string | null) {
  const query = useQuery({
    queryKey: ["contact-automation-runs", contactId],
    queryFn: () => apiFetch<{ runs: ContactAutomationRun[] }>(`/api/contacts/${contactId}/automation-runs`),
    enabled: !!contactId,
  });
  return { ...query, runs: query.data?.runs ?? [] };
}

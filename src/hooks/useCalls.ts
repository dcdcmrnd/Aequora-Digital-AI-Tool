"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api-client";

export interface CallListItem {
  id: string;
  toNumber: string;
  fromNumber: string;
  status: string;
  durationSec: number | null;
  recordingSid: string | null;
  recordingDurationSec: number | null;
  createdAt: string;
  contact: { id: string; name: string; company: string | null } | null;
  user: { id: string; name: string };
}

export interface ListCallsResponse {
  calls: CallListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function useCalls(page: number) {
  return useQuery({
    queryKey: ["calls", page],
    queryFn: () => apiFetch<ListCallsResponse>(`/api/calls?page=${page}`),
  });
}

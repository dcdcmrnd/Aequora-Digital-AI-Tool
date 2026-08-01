"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { Contact } from "@/types";

export interface ContactInput {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  website?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
  twitterUrl?: string;
  address?: string;
  notes?: string;
  tags?: string[];
  sourceLeadId?: string;
}

export interface ContactUpdateInput extends Partial<ContactInput> {
  id: string;
}

function toastErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

export function useContacts() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["contacts"],
    queryFn: () => apiFetch<{ contacts: Contact[] }>("/api/contacts"),
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
  }

  const createContact = useMutation({
    mutationFn: (input: ContactInput) =>
      apiFetch<{ contact: Contact }>("/api/contacts", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Contact added");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to add contact")),
  });

  const updateContact = useMutation({
    mutationFn: ({ id, ...input }: ContactUpdateInput) =>
      apiFetch<{ contact: Contact }>(`/api/contacts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Contact updated");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to update contact")),
  });

  const deleteContact = useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/api/contacts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      invalidate();
      toast.success("Contact deleted");
    },
    onError: (error) => toast.error(toastErrorMessage(error, "Failed to delete contact")),
  });

  return { ...query, contacts: query.data?.contacts, createContact, updateContact, deleteContact };
}

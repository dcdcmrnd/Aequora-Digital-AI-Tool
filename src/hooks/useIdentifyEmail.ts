"use client";

import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiFetch, ApiError } from "@/lib/api-client";
import type { EmailIdentityResult } from "@/lib/leads/emailIdentity";

/** Looks up a single email address: domain-level verification plus, best-effort, the company and matching person found on that company's own website. */
export function useIdentifyEmail() {
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch<EmailIdentityResult>("/api/leads/identify-email", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Lookup failed. Please try again.");
    },
  });
}

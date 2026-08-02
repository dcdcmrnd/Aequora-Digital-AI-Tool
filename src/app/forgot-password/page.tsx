"use client";

import Link from "next/link";
import { useState } from "react";
import toast from "react-hot-toast";

import { Button } from "@/components/ui/Button";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <img src="/logo.png?v=3" alt="Aequora Digital" className="w-10 h-10 rounded-btn object-contain" />
            <span className="text-white text-xl font-semibold">Aequora Digital</span>
          </div>
          <h1 className="text-white text-2xl font-bold">Reset your password</h1>
          <p className="text-[#64748B] mt-2 text-sm">
            {sent ? "Check your inbox for a reset link." : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        <div className="bg-white rounded-card p-8 shadow-2xl">
          {sent ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-text-secondary">
                If an account exists for <strong>{email}</strong>, a password reset link is on its way. The link
                expires in 1 hour.
              </p>
              <Link href="/login" className="text-brand-primary text-sm font-medium hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="you@aequora.digital"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
                />
              </div>

              <Button type="submit" loading={loading} className="w-full" size="lg">
                Send Reset Link
              </Button>

              <Link href="/login" className="block text-center text-text-secondary text-sm hover:text-text-primary">
                Back to sign in
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

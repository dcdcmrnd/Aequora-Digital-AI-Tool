"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (result?.ok) {
        if (!remember) {
          // Demote the session cookie to browser-session-only so the user
          // is logged out when they close the browser.
          await fetch("/api/auth/forget-me", { method: "POST" });
        }
        router.push(callbackUrl);
        router.refresh();
      } else {
        toast.error("Invalid email or password.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1.5">
          Email Address
        </label>
        <input
          type="email"
          required
          autoComplete="username"
          placeholder="you@aequora.digital"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1.5">
          Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Your password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full px-3 py-2 pr-10 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-text-secondary select-none">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-4 w-4 rounded border-border text-brand-primary focus:ring-brand-primary"
        />
        Remember me and keep me signed in
      </label>

      <Button type="submit" loading={loading} className="w-full" size="lg">
        Sign In
      </Button>
    </form>
  );
}

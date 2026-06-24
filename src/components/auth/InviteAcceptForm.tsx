"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import toast from "react-hot-toast";

interface Props {
  token: string;
  defaultName: string;
  email: string;
}

export function InviteAcceptForm({ token, defaultName, email }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: defaultName,
    password: "",
    confirmPassword: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/invitations/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, password: form.password }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to create account.");
        return;
      }

      const signInResult = await signIn("credentials", {
        email,
        password: form.password,
        redirect: false,
      });

      if (signInResult?.ok) {
        toast.success(`Welcome to Aequora Digital, ${form.name}!`);
        router.push("/");
      } else {
        toast.success("Account created! Please sign in.");
        router.push("/login");
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
        <label className="block text-sm font-medium text-text-secondary mb-1">
          Joining as
        </label>
        <p className="text-sm text-text-primary font-medium">{email}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1.5">
          Display Name
        </label>
        <input
          type="text"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1.5">
          Set a Password
        </label>
        <input
          type="password"
          required
          minLength={8}
          placeholder="Minimum 8 characters"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1.5">
          Confirm Password
        </label>
        <input
          type="password"
          required
          placeholder="Repeat password"
          value={form.confirmPassword}
          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
          className="w-full px-3 py-2 border border-border rounded-input text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
      </div>

      <Button type="submit" loading={loading} className="w-full" size="lg">
        Create My Account
      </Button>
    </form>
  );
}

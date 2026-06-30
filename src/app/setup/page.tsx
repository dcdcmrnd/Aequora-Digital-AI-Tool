import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SetupForm } from "@/components/auth/SetupForm";

export default async function SetupPage() {
  const session = await getServerSession(authOptions);
  const userCount = await prisma.user.count();

  // If setup is done, redirect
  if (userCount > 0) {
    if (session) redirect("/");
    else redirect("/login");
  }

  return (
    <div className="min-h-screen bg-brand-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <img src="/logo.png" alt="Aequora Digital" className="w-10 h-10 rounded-btn object-contain" />
            <span className="text-white text-xl font-semibold">Aequora Digital</span>
          </div>
          <h1 className="text-white text-2xl font-bold">Set up your workspace</h1>
          <p className="text-[#64748B] mt-2 text-sm">
            Create the admin account to get started.
          </p>
        </div>

        <div className="bg-white rounded-card p-8 shadow-2xl">
          <SetupForm />
        </div>
      </div>
    </div>
  );
}


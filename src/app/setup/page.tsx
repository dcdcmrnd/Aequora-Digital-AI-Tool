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
            <div className="w-10 h-10 rounded-btn bg-brand-primary flex items-center justify-center">
              <WaveIcon />
            </div>
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

function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth={2}>
      <path d="M3 12c1.5-3 3-4.5 4.5-4.5S10.5 9 12 9s3-1.5 4.5-1.5S19.5 9 21 12" strokeLinecap="round" />
      <path d="M3 17c1.5-3 3-4.5 4.5-4.5S10.5 14.5 12 14.5s3-1.5 4.5-1.5S19.5 14.5 21 17" strokeLinecap="round" />
    </svg>
  );
}

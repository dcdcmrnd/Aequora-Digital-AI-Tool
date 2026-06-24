import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile/ProfileForm";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">My Profile</h1>
        <p className="text-sm text-text-secondary mt-0.5">Update your name, avatar, and password</p>
      </div>
      <ProfileForm
        initialName={session.user.name ?? ""}
        initialAvatarUrl={session.user.avatarUrl ?? ""}
        email={session.user.email ?? ""}
        role={session.user.role}
      />
    </div>
  );
}

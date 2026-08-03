import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConnectedEmails } from "@/lib/gmail";
import { redirect } from "next/navigation";
import { AgencyEmailPanel } from "@/components/settings/AgencyEmailPanel";
import { CategoryManager } from "@/components/settings/CategoryManager";
import { CompanySettingsPanel } from "@/components/settings/CompanySettingsPanel";
import { DocumentsManager } from "@/components/settings/DocumentsManager";
import { SettingsTabs } from "@/components/settings/SettingsTabs";
import { TeamView } from "@/components/team/TeamView";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { MyContactFieldsPanel } from "@/components/profile/MyContactFieldsPanel";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isAdmin = session.user.role === "admin";

  if (!isAdmin) {
    return (
      <div className="max-w-xl space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
          <p className="text-sm text-text-secondary mt-0.5">Update your profile and contact details.</p>
        </div>
        <ProfileForm
          initialName={session.user.name ?? ""}
          initialAvatarUrl={session.user.avatarUrl ?? ""}
          email={session.user.email ?? ""}
          role={session.user.role}
        />
        <MyContactFieldsPanel />
      </div>
    );
  }

  const [categories, companySettings, documents, connectedEmails, teamUsers] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { notes: true } } },
    }),
    prisma.companySettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    }),
    prisma.companyDocument.findMany({
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    getConnectedEmails(null),
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        status: true,
        invitedAt: true,
        activatedAt: true,
        createdAt: true,
        permissions: { select: { permissionType: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const serializedDocuments = documents.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
  }));

  const serializedTeam = teamUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as "admin" | "member",
    status: u.status as "invited" | "active" | "suspended",
    avatarUrl: u.avatarUrl,
    invitedAt: u.invitedAt?.toISOString() ?? null,
    activatedAt: u.activatedAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    permissions: u.permissions.map((p) => p.permissionType),
  }));

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary mt-0.5">Admin settings for your workspace</p>
      </div>

      <SettingsTabs
        teamPanel={<TeamView users={serializedTeam} isAdmin={isAdmin} currentUserId={session.user.id} />}
        companyPanel={
          <CompanySettingsPanel
            initial={{
              name: companySettings.name,
              description: companySettings.description,
              logoUrl: companySettings.logoUrl,
              primaryColor: companySettings.primaryColor,
            }}
          />
        }
        documentsPanel={<DocumentsManager initial={serializedDocuments as any} />}
        categoriesPanel={<CategoryManager categories={categories as any} />}
        emailPanel={<AgencyEmailPanel emails={connectedEmails} />}
      />
    </div>
  );
}

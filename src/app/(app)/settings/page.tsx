import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { CategoryManager } from "@/components/settings/CategoryManager";
import { CompanySettingsPanel } from "@/components/settings/CompanySettingsPanel";
import { DocumentsManager } from "@/components/settings/DocumentsManager";
import { SettingsTabs } from "@/components/settings/SettingsTabs";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "admin") redirect("/");

  const [categories, companySettings, documents] = await Promise.all([
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
  ]);

  const serializedDocuments = documents.map((d) => ({
    ...d,
    createdAt: d.createdAt.toISOString(),
  }));

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
        <p className="text-sm text-text-secondary mt-0.5">Admin settings for your workspace</p>
      </div>

      <SettingsTabs
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
      />
    </div>
  );
}

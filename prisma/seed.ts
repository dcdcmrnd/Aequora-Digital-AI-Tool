import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const categories = [
    {
      name: "Meeting Notes",
      color: "#3B82F6",
      icon: "📋",
      description: "Notes from team and client meetings",
    },
    {
      name: "SOPs",
      color: "#10B981",
      icon: "📖",
      description: "Standard operating procedures",
    },
    {
      name: "Client Info",
      color: "#F59E0B",
      icon: "🏢",
      description: "Client details and account information",
    },
    {
      name: "Ideas",
      color: "#8B5CF6",
      icon: "💡",
      description: "Ideas and brainstorming",
    },
    {
      name: "Reference",
      color: "#6B7280",
      icon: "📚",
      description: "Reference materials and resources",
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  console.log("✅ Seeded default categories");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../src/db";
import { seedAdminUser } from "../src/modules/admin/admin.seed";
import { generateTableQr } from "../src/utils/qr";

type SeedMenuItem = {
  name: string;
  price: number;
  stock?: number;
  isAvailable?: boolean;
  imageUrl?: string | null;
};

type SeedMenuCategory = {
  name: string;
  items?: SeedMenuItem[];
};

type SeedData = {
  tables?: {
    count?: number;
  };
  menuCategories?: SeedMenuCategory[];
};

async function loadSeedData(): Promise<SeedData | null> {
  const seedPath = path.resolve(process.cwd(), "prisma", "seed-data.json");
  try {
    const raw = await fs.readFile(seedPath, "utf8");
    return JSON.parse(raw) as SeedData;
  } catch (_err) {
    return null;
  }
}

function parseSeedCount(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

async function seedTables(count: number) {
  if (count <= 0) return;

  const existing = await prisma.table.count();
  if (existing > 0) return;

  const data = await Promise.all(
    Array.from({ length: count }, async (_v, i) => {
      const tableNumber = i + 1;
      const qrCode = await generateTableQr(tableNumber);
      return { tableNumber, qrCode, isActive: true };
    })
  );

  await prisma.table.createMany({ data, skipDuplicates: true });
}

async function seedMenu(categories: SeedMenuCategory[]) {
  if (!categories.length) return;

  const existing = await prisma.menuCategory.count();
  if (existing > 0) return;

  for (const category of categories) {
    const items = (category.items ?? []).map((item) => ({
      name: item.name,
      price: item.price,
      stock: item.stock ?? 0,
      isAvailable: item.isAvailable ?? true,
      isArchived: false,
      imageUrl: item.imageUrl ?? null
    }));

    await prisma.menuCategory.create({
      data: {
        name: category.name,
        items: items.length ? { create: items } : undefined
      }
    });
  }
}

async function main() {
  const seedData = await loadSeedData();

  await seedAdminUser();

  const envTableCount = parseSeedCount(process.env.SEED_TABLE_COUNT);
  const tableCount = envTableCount ?? seedData?.tables?.count ?? 0;
  await seedTables(tableCount);

  await seedMenu(seedData?.menuCategories ?? []);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

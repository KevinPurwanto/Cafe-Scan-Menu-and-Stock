"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const db_1 = require("../src/db");
const admin_seed_1 = require("../src/modules/admin/admin.seed");
const qr_1 = require("../src/utils/qr");
async function loadSeedData() {
    const seedPath = node_path_1.default.resolve(process.cwd(), "prisma", "seed-data.json");
    try {
        const raw = await promises_1.default.readFile(seedPath, "utf8");
        return JSON.parse(raw);
    }
    catch (_err) {
        return null;
    }
}
function parseSeedCount(v) {
    if (!v)
        return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0)
        return null;
    return Math.floor(n);
}
async function seedTables(count) {
    if (count <= 0)
        return;
    const existing = await db_1.prisma.table.count();
    if (existing > 0)
        return;
    const data = await Promise.all(Array.from({ length: count }, async (_v, i) => {
        const tableNumber = i + 1;
        const qrCode = await (0, qr_1.generateTableQr)(tableNumber);
        return { tableNumber, qrCode, isActive: true };
    }));
    await db_1.prisma.table.createMany({ data, skipDuplicates: true });
}
async function seedMenu(categories) {
    if (!categories.length)
        return;
    const existing = await db_1.prisma.menuCategory.count();
    if (existing > 0)
        return;
    for (const category of categories) {
        const items = (category.items ?? []).map((item) => ({
            name: item.name,
            price: item.price,
            stock: item.stock ?? 0,
            isAvailable: item.isAvailable ?? true,
            isArchived: false,
            imageUrl: item.imageUrl ?? null
        }));
        await db_1.prisma.menuCategory.create({
            data: {
                name: category.name,
                items: items.length ? { create: items } : undefined
            }
        });
    }
}
async function main() {
    const seedData = await loadSeedData();
    await (0, admin_seed_1.seedAdminUser)();
    const envTableCount = parseSeedCount(process.env.SEED_TABLE_COUNT);
    const tableCount = envTableCount ?? seedData?.tables?.count ?? 0;
    await seedTables(tableCount);
    await seedMenu(seedData?.menuCategories ?? []);
}
main()
    .then(async () => {
    await db_1.prisma.$disconnect();
})
    .catch(async (err) => {
    console.error(err);
    await db_1.prisma.$disconnect();
    process.exit(1);
});

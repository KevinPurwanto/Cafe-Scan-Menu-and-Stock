import bcrypt from "bcryptjs";
import { prisma } from "../../db";

type SeedUser = {
  username?: string;
  email?: string;
  password?: string;
  role: string;
};

async function createUserIfMissing({ username, email, password, role }: SeedUser) {
  if (!username || !email || !password) return;

  const existing = await prisma.adminUser.findFirst({
    where: {
      OR: [{ username }, { email: email.toLowerCase() }]
    }
  });
  if (existing) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.create({
    data: {
      username,
      email: email.toLowerCase(),
      passwordHash,
      role
    }
  });
}

export async function seedAdminUser() {
  await createUserIfMissing({
    username: process.env.ADMIN_SEED_USERNAME?.trim(),
    email: process.env.ADMIN_SEED_EMAIL?.trim(),
    password: process.env.ADMIN_SEED_PASSWORD,
    role: "owner"
  });

  await createUserIfMissing({
    username: process.env.KITCHEN_SEED_USERNAME?.trim(),
    email: process.env.KITCHEN_SEED_EMAIL?.trim(),
    password: process.env.KITCHEN_SEED_PASSWORD,
    role: "kitchen"
  });
}

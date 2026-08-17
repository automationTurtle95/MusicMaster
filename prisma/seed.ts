import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@musicmaster.app").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";
  const hash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", password: hash },
    create: {
      email,
      name: "Administrator",
      role: "ADMIN",
      password: hash,
    },
  });

  console.log(`Seeded admin user: ${user.email} (role=${user.role})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

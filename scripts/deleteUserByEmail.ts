import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const emailArg = process.argv[2];

  if (!emailArg) {
    console.error('Usage: ts-node scripts/deleteUserByEmail.ts <email>');
    process.exit(1);
  }

  const email = emailArg.toLowerCase();
  console.log(`🔍 Looking for user with email: ${email}`);

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.log('No user found for', email);
    return;
  }

  console.log('Found user', user.id, 'role:', user.role);

  // Clean up related records (best-effort)
  await prisma.serviceProvider.deleteMany({ where: { userId: user.id } });
  await prisma.customer.deleteMany({ where: { userId: user.id } });
  await prisma.adminOTP.deleteMany({ where: { adminEmail: email } });
  await prisma.adminVerification.deleteMany({ where: { adminEmail: email } });

  await prisma.user.delete({ where: { id: user.id } });

  console.log('✅ Deleted user and related records for', email);
}

main()
  .catch((e) => {
    console.error('Error during delete:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


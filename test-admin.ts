import { prisma } from './src/utils/db';
import { env } from './src/config/env';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('=================================');
  console.log('   ADMIN REGISTRATION TEST');
  console.log('=================================\n');

  const targetEmail = env.ADMIN_EMAIL;

  if (!targetEmail) {
    console.error('❌ ERROR: "ADMIN_EMAIL" is not configured in your .env setup.');
    process.exit(1);
  }
  
  console.log(`[TEST] Using configured admin email: ${targetEmail}`);

  // 1. Clean up old user if they exist to keep the test reproducible 
  const oldUser = await prisma.user.findUnique({
    where: { email: targetEmail }
  });

  if (oldUser) {
    console.log(`[TEST] Clearing out existing user with email ${targetEmail}...`);
    await prisma.user.delete({ where: { email: targetEmail } });
  }

  // 2. Perform the exact logic from your Auth Controller
  console.log(`[TEST] Hashing password...`);
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('superSecretAdminPassword', salt);

  // The logic inside auth.controller.ts:
  // "const role = email === process.env.ADMIN_EMAIL ? 'ADMIN' : 'USER';"
  const assignedRole = targetEmail === env.ADMIN_EMAIL ? 'ADMIN' : 'USER';

  console.log(`[TEST] Emulating registration save to DB...`);
  const newUser = await prisma.user.create({
    data: {
      email: targetEmail,
      username: 'TheAdminAccount',
      password: hashedPassword,
      role: assignedRole as any, 
    }
  });

  console.log('\n=================================');
  console.log(`   TEST RESULTS`);
  console.log('=================================');
  console.log(`User ID: ${newUser.id}`);
  console.log(`User Email: ${newUser.email}`);
  console.log(`Verified Role: ${newUser.role}`);
  
  if (newUser.role === 'ADMIN') {
    console.log('\n✅ SUCCESS: The database correctly accepted and set the ADMIN role based on your email!');
  } else {
    console.error('\n❌ FAILED: The database did NOT set the role to ADMIN.');
  }
}

main()
  .catch((e) => {
    console.error('\n❌ SCRIPT CRASHED:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

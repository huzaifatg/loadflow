import { PrismaClient } from '@prisma/client';
import { getAuthContext } from '../lib/auth';

const prisma = new PrismaClient();

// We need a fake request or we can just mock Supabase in lib/auth?
// Actually, it's easier to just query the DB directly to simulate what getAuthContext does,
// since getAuthContext relies on cookies which we don't have in a CLI script.
async function simulateGetAuthContext(userId: string) {
  const member = await prisma.companyMember.findFirst({
    where: { userId },
    include: { company: true }
  });

  return {
    userId,
    companyId: member?.company?.id,
    companyName: member?.company?.name,
    role: member?.role
  };
}

async function main() {
  console.log('--- FINAL ISOLATION AUDIT ---\n');

  // Fetch Users
  const users = await prisma.$queryRaw<{ id: string; email: string }[]>`SELECT id, email FROM auth.users`;
  const demoUser = users.find(u => u.email === 'demo@loadflow.app');
  const adminUser = users.find(u => u.email === 'huz@comp.com');

  if (!demoUser || !adminUser) {
    console.error('Users not found');
    return;
  }

  // 1. Resolve Auth Contexts
  const adminAuth = await simulateGetAuthContext(adminUser.id);
  const demoAuth = await simulateGetAuthContext(demoUser.id);

  console.log('[ADMIN ACCOUNT RESOLUTION]');
  console.log(`Email:       ${adminUser.email}`);
  console.log(`User ID:     ${adminAuth.userId}`);
  console.log(`Company ID:  ${adminAuth.companyId}`);
  console.log(`Company:     ${adminAuth.companyName}`);
  console.log(`Role:        ${adminAuth.role}`);

  console.log('\n[DEMO ACCOUNT RESOLUTION]');
  console.log(`Email:       ${demoUser.email}`);
  console.log(`User ID:     ${demoAuth.userId}`);
  console.log(`Company ID:  ${demoAuth.companyId}`);
  console.log(`Company:     ${demoAuth.companyName}`);
  console.log(`Role:        ${demoAuth.role}`);

  console.log('\n[ISOLATION VERIFICATION]');
  console.log(`Company IDs differ: ${adminAuth.companyId !== demoAuth.companyId ? '✅ YES' : '❌ NO'}`);
  
  if (adminAuth.companyId && demoAuth.companyId) {
    // Admin Counts
    const aDeliveries = await prisma.delivery.count({ where: { companyId: adminAuth.companyId } });
    const aTrucks = await prisma.truck.count({ where: { companyId: adminAuth.companyId } });
    const aDrivers = await prisma.driver.count({ where: { companyId: adminAuth.companyId } });
    const aLoadPlans = await prisma.loadPlan.count({ where: { companyId: adminAuth.companyId } });
    
    // Demo Counts
    const dDeliveries = await prisma.delivery.count({ where: { companyId: demoAuth.companyId } });
    const dTrucks = await prisma.truck.count({ where: { companyId: demoAuth.companyId } });
    const dDrivers = await prisma.driver.count({ where: { companyId: demoAuth.companyId } });
    const dLoadPlans = await prisma.loadPlan.count({ where: { companyId: demoAuth.companyId } });

    console.log('\n--- DATA COUNTS ---');
    console.log(`Metric       | Admin (${adminAuth.companyName}) | Demo (${demoAuth.companyName})`);
    console.log('-------------|-----------------------|-----------------------');
    console.log(`Deliveries   | ${aDeliveries.toString().padEnd(21)} | ${dDeliveries}`);
    console.log(`Trucks       | ${aTrucks.toString().padEnd(21)} | ${dTrucks}`);
    console.log(`Drivers      | ${aDrivers.toString().padEnd(21)} | ${dDrivers}`);
    console.log(`Load Plans   | ${aLoadPlans.toString().padEnd(21)} | ${dLoadPlans}`);
  }

  console.log('\n--- AUDIT COMPLETE ---');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- MIGRATION REPORT ---');

  // 1. All Users
  console.log('\n[USERS]');
  try {
    const users: any[] = await prisma.$queryRaw`SELECT id, email, created_at FROM auth.users ORDER BY created_at ASC`;
    users.forEach(u => console.log(`- ${u.email} (ID: ${u.id})`));
  } catch (e) {
    console.error('Failed to fetch users from auth.users:', e);
  }

  // 2. All Companies
  console.log('\n[COMPANIES]');
  const companies = await prisma.company.findMany();
  for (const c of companies) {
    console.log(`- ${c.name} (ID: ${c.id})`);
    
    // Counts
    const deliveryCount = await prisma.delivery.count({ where: { companyId: c.id } });
    const truckCount = await prisma.truck.count({ where: { companyId: c.id } });
    const driverCount = await prisma.driver.count({ where: { companyId: c.id } });
    const loadPlanCount = await prisma.loadPlan.count({ where: { companyId: c.id } });

    console.log(`  Deliveries: ${deliveryCount}`);
    console.log(`  Trucks:     ${truckCount}`);
    console.log(`  Drivers:    ${driverCount}`);
    console.log(`  Load Plans: ${loadPlanCount}`);
  }

  // 3. Exact records identified as demo data
  console.log('\n[DEMO DATA TO BE MOVED]');
  
  const demoDeliveries = await prisma.delivery.findMany({
    where: { notes: { contains: '[DEMO]' } },
    select: { id: true, customerName: true }
  });
  console.log(`\nDemo Deliveries (${demoDeliveries.length}):`);
  demoDeliveries.forEach(d => console.log(`  - ${d.customerName} (${d.id})`));

  const demoTrucks = await prisma.truck.findMany({
    where: { notes: { contains: '[DEMO]' } },
    select: { id: true, name: true, plateNumber: true }
  });
  console.log(`\nDemo Trucks (${demoTrucks.length}):`);
  demoTrucks.forEach(t => console.log(`  - ${t.name} [${t.plateNumber}] (${t.id})`));

  const demoDrivers = await prisma.driver.findMany({
    where: { notes: { contains: '[DEMO]' } },
    select: { id: true, name: true }
  });
  console.log(`\nDemo Drivers (${demoDrivers.length}):`);
  demoDrivers.forEach(d => console.log(`  - ${d.name} (${d.id})`));

  // For Load Plans, we identify them if notes contain [DEMO], OR truck notes contain [DEMO], OR driver notes contain [DEMO]
  const demoLoadPlans = await prisma.loadPlan.findMany({
    where: {
      OR: [
        { notes: { contains: '[DEMO]' } },
        { truck: { notes: { contains: '[DEMO]' } } },
        { driver: { notes: { contains: '[DEMO]' } } }
      ]
    },
    select: { id: true, date: true }
  });
  console.log(`\nDemo Load Plans (${demoLoadPlans.length}):`);
  demoLoadPlans.forEach(lp => console.log(`  - ${lp.date.toISOString().split('T')[0]} (${lp.id})`));

  console.log('\n--- END MIGRATION REPORT ---');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });

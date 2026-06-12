import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- STARTING TENANT MIGRATION ---');

  // 1. Fetch Users
  const users: any[] = await prisma.$queryRaw`SELECT id, email FROM auth.users`;
  const demoUser = users.find(u => u.email === 'demo@loadflow.app');
  const adminUsers = users.filter(u => u.email !== 'demo@loadflow.app');

  if (!demoUser) {
    throw new Error('Demo user not found in auth.users!');
  }

  // 2. Fetch the current existing company
  const existingCompany = await prisma.company.findFirst({
    where: { name: 'hifco ltd.' }
  });

  if (!existingCompany) {
    throw new Error('Original company not found!');
  }

  // 3. Assign Admin Users to existing company
  console.log(`Assigning ${adminUsers.length} admin users to existing company...`);
  for (const admin of adminUsers) {
    await prisma.companyMember.upsert({
      where: {
        companyId_userId: {
          companyId: existingCompany.id,
          userId: admin.id
        }
      },
      create: {
        companyId: existingCompany.id,
        userId: admin.id,
        role: Role.OWNER
      },
      update: {}
    });
  }

  // 4. Create Demo Company and assign Demo User
  console.log('Creating demo company...');
  let demoCompany = await prisma.company.findFirst({
    where: { name: 'LoadFlow Demo Logistics' }
  });

  if (!demoCompany) {
    demoCompany = await prisma.company.create({
      data: {
        name: 'LoadFlow Demo Logistics',
        fullName: 'Demo Logistics',
        members: {
          create: {
            userId: demoUser.id,
            role: Role.OWNER
          }
        }
      }
    });
  } else {
    // Ensure membership exists
    await prisma.companyMember.upsert({
      where: {
        companyId_userId: {
          companyId: demoCompany.id,
          userId: demoUser.id
        }
      },
      create: {
        companyId: demoCompany.id,
        userId: demoUser.id,
        role: Role.OWNER
      },
      update: {}
    });
  }

  // 5. Move Demo Data to Demo Company
  console.log('Moving demo data out of the admin company...');

  const updateResultDeliveries = await prisma.delivery.updateMany({
    where: { companyId: existingCompany.id, notes: { contains: '[DEMO]' } },
    data: { companyId: demoCompany.id }
  });
  console.log(`Moved ${updateResultDeliveries.count} deliveries.`);

  const updateResultTrucks = await prisma.truck.updateMany({
    where: { companyId: existingCompany.id, notes: { contains: '[DEMO]' } },
    data: { companyId: demoCompany.id }
  });
  console.log(`Moved ${updateResultTrucks.count} trucks.`);

  const updateResultDrivers = await prisma.driver.updateMany({
    where: { companyId: existingCompany.id, notes: { contains: '[DEMO]' } },
    data: { companyId: demoCompany.id }
  });
  console.log(`Moved ${updateResultDrivers.count} drivers.`);

  const updateResultLoadPlans = await prisma.loadPlan.updateMany({
    where: {
      companyId: existingCompany.id,
      OR: [
        { notes: { contains: '[DEMO]' } },
        { truck: { notes: { contains: '[DEMO]' } } },
        { driver: { notes: { contains: '[DEMO]' } } }
      ]
    },
    data: { companyId: demoCompany.id }
  });
  console.log(`Moved ${updateResultLoadPlans.count} load plans.`);

  console.log('--- TENANT MIGRATION COMPLETE ---');
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });

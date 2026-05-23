import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const LBS_TO_KG = 0.453592;

async function main() {
  console.log('Starting migration to kg...');

  // 1. Update Trucks
  const trucks = await prisma.truck.findMany();
  for (const truck of trucks) {
    const newCapacity = truck.weightCapacity * LBS_TO_KG;
    await prisma.truck.update({
      where: { id: truck.id },
      data: { weightCapacity: newCapacity },
    });
  }
  console.log(`Updated ${trucks.length} trucks.`);

  // 2. Update Deliveries
  const deliveries = await prisma.delivery.findMany();
  for (const delivery of deliveries) {
    const newWeight = delivery.weight * LBS_TO_KG;
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { weight: newWeight },
    });
  }
  console.log(`Updated ${deliveries.length} deliveries.`);

  // 3. Update Company settings
  const companies = await prisma.company.findMany();
  for (const company of companies) {
    await prisma.company.update({
      where: { id: company.id },
      data: { units: 'metric' },
    });
  }
  console.log(`Updated ${companies.length} companies to metric units.`);

  console.log('Migration complete!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

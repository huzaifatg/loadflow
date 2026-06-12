import { PrismaClient, DeliveryStatus, TruckStatus, DriverStatus, LoadPlanStatus, UnitType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting demo seed process...');

  // Find the Demo User's Company securely via auth.users and CompanyMember
  const users = await prisma.$queryRaw<{ id: string; email: string }[]>`SELECT id, email FROM auth.users WHERE email = 'demo@loadflow.app' LIMIT 1`;
  
  if (!users || users.length === 0) {
    console.error('Demo user (demo@loadflow.app) not found in auth.users!');
    process.exit(1);
  }

  const demoUserId = users[0].id;

  const member = await prisma.companyMember.findFirst({
    where: { userId: demoUserId },
    include: { company: true }
  });

  if (!member?.company) {
    console.error('Demo company not found for demo user! Ensure the tenant migration has run.');
    process.exit(1);
  }

  const company = member.company;

  console.log(`Using Company: ${company.name} (${company.id})`);

  console.log('Cleaning up existing demo data...');
  // Delete any existing demo records to ensure clean slate (idempotency after failure)
  // Delete delivery items first
  await prisma.deliveryItem.deleteMany({
    where: { delivery: { notes: { contains: '[DEMO]' } } }
  });
  // Delete load plan deliveries
  await prisma.loadPlanItem.deleteMany({
    where: { delivery: { notes: { contains: '[DEMO]' } } }
  });
  // Delete deliveries
  await prisma.delivery.deleteMany({
    where: { companyId: company.id, notes: { contains: '[DEMO]' } }
  });
  // Delete load plans
  await prisma.loadPlan.deleteMany({
    where: {
      OR: [
        { notes: { contains: '[DEMO]' } },
        { truck: { notes: { contains: '[DEMO]' } } },
        { driver: { notes: { contains: '[DEMO]' } } }
      ]
    }
  });
  // Delete trucks
  await prisma.truck.deleteMany({
    where: { companyId: company.id, notes: { contains: '[DEMO]' } }
  });
  // Delete drivers
  await prisma.driver.deleteMany({
    where: { companyId: company.id, notes: { contains: '[DEMO]' } }
  });
  console.log('Cleaned up previous demo data.');

  console.log('Creating demo drivers...');
  const driverData = [
    { companyId: company.id, name: 'Ahmed Khalil', phone: '555-0101', licenseNumber: 'CDL-AK-98432', status: DriverStatus.ON_TRIP, notes: 'Route lead, morning shifts [DEMO]' },
    { companyId: company.id, name: 'Sarah Mitchell', phone: '555-0102', licenseNumber: 'CDL-SM-45122', status: DriverStatus.ON_TRIP, notes: 'Certified for refrigerated transport [DEMO]' },
    { companyId: company.id, name: 'James Rodriguez', phone: '555-0103', licenseNumber: 'CDL-JR-77321', status: DriverStatus.AVAILABLE, notes: 'Flexible scheduling [DEMO]' },
    { companyId: company.id, name: 'Maria Santos', phone: '555-0104', licenseNumber: 'CDL-MS-88210', status: DriverStatus.ON_TRIP, notes: 'Heavy load specialist [DEMO]' },
    { companyId: company.id, name: 'David Park', phone: '555-0105', licenseNumber: 'CDL-DP-33921', status: DriverStatus.AVAILABLE, notes: 'Weekend coverage [DEMO]' },
    { companyId: company.id, name: 'Fatima Al-Hassan', phone: '555-0106', licenseNumber: 'CDL-FA-11234', status: DriverStatus.AVAILABLE, notes: 'City deliveries expert [DEMO]' },
    { companyId: company.id, name: 'Thomas Weber', phone: '555-0107', licenseNumber: 'CDL-TW-22345', status: DriverStatus.OFF_DUTY, notes: 'Returns Monday [DEMO]' },
    { companyId: company.id, name: 'Rachel Kim', phone: '555-0108', licenseNumber: 'CDL-RK-33456', status: DriverStatus.AVAILABLE, notes: 'Night shift coverage [DEMO]' },
    { companyId: company.id, name: 'Omar Farouk', phone: '555-0109', licenseNumber: 'CDL-OF-44567', status: DriverStatus.ON_TRIP, notes: 'Long-haul experienced [DEMO]' }
  ];

  const drivers = [];
  for (const data of driverData) {
    drivers.push(await prisma.driver.create({ data }));
  }
  console.log(`✅ Created ${drivers.length} demo drivers.`);

  console.log('Creating demo trucks...');
  const truckData = [
    { companyId: company.id, name: 'Box Truck 01', type: 'Box Truck', plateNumber: 'BXT-101', weightCapacity: 8000, status: TruckStatus.AVAILABLE, notes: '[DEMO]' },
    { companyId: company.id, name: 'Box Truck 02', type: 'Box Truck', plateNumber: 'BXT-102', weightCapacity: 8000, status: TruckStatus.IN_USE, notes: '[DEMO]' },
    { companyId: company.id, name: 'Flatbed 03', type: 'Flatbed', plateNumber: 'FLT-201', weightCapacity: 15000, status: TruckStatus.IN_USE, notes: '[DEMO]' },
    { companyId: company.id, name: 'Refrigerated 04', type: 'Refrigerated Truck', plateNumber: 'REF-301', weightCapacity: 10000, status: TruckStatus.IN_USE, notes: '[DEMO]' },
    { companyId: company.id, name: 'Sprinter Van 05', type: 'Sprinter Van', plateNumber: 'SPV-401', weightCapacity: 3500, status: TruckStatus.AVAILABLE, notes: '[DEMO]' },
    { companyId: company.id, name: 'Heavy Hauler 06', type: 'Semi Trailer', plateNumber: 'HH-501', weightCapacity: 25000, status: TruckStatus.AVAILABLE, notes: '[DEMO]' },
    { companyId: company.id, name: 'City Runner 07', type: 'Cargo Van', plateNumber: 'CR-601', weightCapacity: 2500, status: TruckStatus.MAINTENANCE, notes: '[DEMO]' }
  ];

  const trucks = [];
  for (const data of truckData) {
    trucks.push(await prisma.truck.create({ data }));
  }
  console.log(`✅ Created ${trucks.length} demo trucks.`);

  console.log('Creating demo deliveries...');

  const deliveryData = [
    { customer: 'TechVault Electronics', address: '12 Silicon Way, Tech Park', notes: 'Fragile. Use tail lift. [DEMO]', status: DeliveryStatus.DELIVERED,
      items: [{ name: 'LED Televisions 65"', sku: 'TV-LED-65', qty: 15, unit: 'cartons', type: 'STANDARD_WEIGHT', uWeight: 22, tWeight: 330 }, { name: 'Laptop Computers', sku: 'LPT-01', qty: 40, unit: 'boxes', type: 'STANDARD_WEIGHT', uWeight: 3.5, tWeight: 140 }] },
    { customer: 'FreshMart Supermarket', address: '45 Retail Ave', notes: 'Temperature controlled. [DEMO]', status: DeliveryStatus.IN_TRANSIT,
      items: [{ name: 'Dairy Pallet', sku: 'DRY-PAL', qty: 2, unit: 'pallets', type: 'STANDARD_WEIGHT', uWeight: 450, tWeight: 900 }, { name: 'Fresh Produce', sku: 'PRD-FRSH', qty: 120, unit: 'crates', type: 'VARIABLE_WEIGHT', uWeight: 15, tWeight: 1800 }] },
    { customer: 'BuildRight Construction', address: 'Site 4B, Industrial Zone', notes: 'Call site manager 30m before. [DEMO]', status: DeliveryStatus.ASSIGNED,
      items: [{ name: 'Cement Bags', sku: 'CMT-BG', qty: 200, unit: 'bags', type: 'STANDARD_WEIGHT', uWeight: 25, tWeight: 5000 }, { name: 'Ceramic Tiles', sku: 'TIL-CER', qty: 4, unit: 'pallets', type: 'STANDARD_WEIGHT', uWeight: 800, tWeight: 3200 }] },
    { customer: 'Metro Office Supplies', address: 'Downtown Business Center', notes: 'Deliver to loading dock 2. [DEMO]', status: DeliveryStatus.PENDING,
      items: [{ name: 'Printer Paper A4', sku: 'PPR-A4', qty: 50, unit: 'cartons', type: 'STANDARD_WEIGHT', uWeight: 12, tWeight: 600 }, { name: 'Office Chairs', sku: 'FUR-CHR', qty: 12, unit: 'pieces', type: 'PIECE_BASED', uWeight: 15, tWeight: 180 }] },
    { customer: 'CoolBrew Beverage Co.', address: 'Beverage Dist Center', notes: 'Verify seals. [DEMO]', status: DeliveryStatus.DELIVERED,
      items: [{ name: 'Craft Beer Kegs', sku: 'KEG-CB', qty: 30, unit: 'units', type: 'STANDARD_WEIGHT', uWeight: 55, tWeight: 1650 }, { name: 'Sparkling Water', sku: 'WTR-SPK', qty: 5, unit: 'pallets', type: 'STANDARD_WEIGHT', uWeight: 600, tWeight: 3000 }] },
    { customer: 'Pinnacle Manufacturing', address: 'Factory Row, Unit 8', notes: 'Heavy machinery parts. [DEMO]', status: DeliveryStatus.IN_TRANSIT,
      items: [{ name: 'Steel Rods', sku: 'STL-RD', qty: 50, unit: 'bundles', type: 'STANDARD_WEIGHT', uWeight: 100, tWeight: 5000 }, { name: 'Industrial Bearings', sku: 'BRG-IND', qty: 10, unit: 'boxes', type: 'STANDARD_WEIGHT', uWeight: 25, tWeight: 250 }] },
    { customer: 'Garden Grove Nursery', address: 'Greenery Lane', notes: 'Unload near greenhouse. [DEMO]', status: DeliveryStatus.PENDING,
      items: [{ name: 'Potting Soil', sku: 'SOIL-PT', qty: 100, unit: 'bags', type: 'STANDARD_WEIGHT', uWeight: 20, tWeight: 2000 }, { name: 'Ceramic Planters', sku: 'PLN-CER', qty: 3, unit: 'pallets', type: 'STANDARD_WEIGHT', uWeight: 350, tWeight: 1050 }] },
    { customer: 'Riverside Medical Center', address: 'Hospital Receiving Bay', notes: 'Urgent medical supplies. [DEMO]', status: DeliveryStatus.DELIVERED,
      items: [{ name: 'PPE Kits', sku: 'MED-PPE', qty: 40, unit: 'cartons', type: 'STANDARD_WEIGHT', uWeight: 5, tWeight: 200 }, { name: 'Hand Sanitizer', sku: 'MED-SAN', qty: 25, unit: 'boxes', type: 'STANDARD_WEIGHT', uWeight: 12, tWeight: 300 }] },
    { customer: 'The Daily Grind Café', address: 'High Street, Shop 4', notes: 'Morning delivery only. [DEMO]', status: DeliveryStatus.ASSIGNED,
      items: [{ name: 'Coffee Beans', sku: 'COF-BN', qty: 20, unit: 'bags', type: 'STANDARD_WEIGHT', uWeight: 15, tWeight: 300 }, { name: 'Paper Cups', sku: 'CUP-PPR', qty: 30, unit: 'cartons', type: 'STANDARD_WEIGHT', uWeight: 8, tWeight: 240 }] },
    { customer: 'Atlas Auto Parts', address: 'Auto Hub Center', notes: '[DEMO]', status: DeliveryStatus.PENDING,
      items: [{ name: 'Brake Pads', sku: 'AUT-BRK', qty: 50, unit: 'boxes', type: 'STANDARD_WEIGHT', uWeight: 10, tWeight: 500 }, { name: 'Engine Components', sku: 'AUT-ENG', qty: 2, unit: 'pallets', type: 'STANDARD_WEIGHT', uWeight: 400, tWeight: 800 }] },
    { customer: 'Luxe Home Furnishings', address: 'Design District Blvd', notes: 'White glove delivery needed. [DEMO]', status: DeliveryStatus.IN_TRANSIT,
      items: [{ name: 'Dining Tables', sku: 'FUR-DT', qty: 5, unit: 'pieces', type: 'PIECE_BASED', uWeight: 45, tWeight: 225 }, { name: 'Floor Lamps', sku: 'LMP-FL', qty: 15, unit: 'boxes', type: 'STANDARD_WEIGHT', uWeight: 8, tWeight: 120 }] },
    { customer: 'FreshMart - Westside', address: 'Westside Mall, Dock A', notes: 'Frozen goods included. [DEMO]', status: DeliveryStatus.DELIVERED,
      items: [{ name: 'Frozen Foods', sku: 'FRZ-FD', qty: 3, unit: 'pallets', type: 'STANDARD_WEIGHT', uWeight: 500, tWeight: 1500 }, { name: 'Canned Goods', sku: 'CND-GD', qty: 60, unit: 'cartons', type: 'STANDARD_WEIGHT', uWeight: 18, tWeight: 1080 }] },
    { customer: 'Summit Sports & Outdoors', address: 'Adventure Park Mall', notes: '[DEMO]', status: DeliveryStatus.PENDING,
      items: [{ name: 'Mountain Bikes', sku: 'BIK-MTN', qty: 12, unit: 'pieces', type: 'PIECE_BASED', uWeight: 18, tWeight: 216 }, { name: 'Camping Tents', sku: 'TNT-CMP', qty: 25, unit: 'cartons', type: 'STANDARD_WEIGHT', uWeight: 14, tWeight: 350 }] },
    { customer: 'Greenfield Organic Farm', address: 'Rural Route 9', notes: 'Farm pickup. [DEMO]', status: DeliveryStatus.ASSIGNED,
      items: [{ name: 'Organic Produce', sku: 'ORG-PRD', qty: 80, unit: 'crates', type: 'VARIABLE_WEIGHT', uWeight: 12, tWeight: 960 }, { name: 'Fresh Eggs', sku: 'EGG-FR', qty: 40, unit: 'boxes', type: 'STANDARD_WEIGHT', uWeight: 15, tWeight: 600 }] },
    { customer: 'DataCore Solutions', address: 'Tech Park, Building 3', notes: 'Server racks. [DEMO]', status: DeliveryStatus.IN_TRANSIT,
      items: [{ name: 'Server Racks', sku: 'IT-SRV', qty: 4, unit: 'pieces', type: 'PIECE_BASED', uWeight: 120, tWeight: 480 }, { name: 'UPS Units', sku: 'IT-UPS', qty: 10, unit: 'boxes', type: 'STANDARD_WEIGHT', uWeight: 45, tWeight: 450 }] },
    { customer: 'Harbor Seafood Market', address: 'Pier 4, Fish Market', notes: 'Must arrive before 6 AM. [DEMO]', status: DeliveryStatus.DELIVERED,
      items: [{ name: 'Fresh Salmon', sku: 'SEA-SAL', qty: 30, unit: 'boxes', type: 'VARIABLE_WEIGHT', uWeight: 25, tWeight: 750 }, { name: 'Ice Packs', sku: 'ICE-PCK', qty: 10, unit: 'cartons', type: 'STANDARD_WEIGHT', uWeight: 20, tWeight: 200 }] },
    { customer: 'Bright Spark Electrical', address: 'Industrial Park South', notes: '[DEMO]', status: DeliveryStatus.PENDING,
      items: [{ name: 'Electrical Cables', sku: 'ELC-CBL', qty: 40, unit: 'bundles', type: 'STANDARD_WEIGHT', uWeight: 30, tWeight: 1200 }, { name: 'Distribution Panels', sku: 'ELC-PNL', qty: 8, unit: 'pieces', type: 'PIECE_BASED', uWeight: 25, tWeight: 200 }] },
    { customer: 'King\'s Bakery Wholesale', address: 'Baker\'s Avenue', notes: '[DEMO]', status: DeliveryStatus.ASSIGNED,
      items: [{ name: 'Bread Flour', sku: 'FLR-BRD', qty: 100, unit: 'bags', type: 'STANDARD_WEIGHT', uWeight: 25, tWeight: 2500 }, { name: 'Baking Sugar', sku: 'SGR-BAK', qty: 50, unit: 'bags', type: 'STANDARD_WEIGHT', uWeight: 25, tWeight: 1250 }] },
    { customer: 'ProFit Gym Equipment', address: 'Fitness Plaza', notes: 'Heavy lifting required. [DEMO]', status: DeliveryStatus.IN_TRANSIT,
      items: [{ name: 'Dumbbell Sets', sku: 'GYM-DMB', qty: 20, unit: 'boxes', type: 'STANDARD_WEIGHT', uWeight: 40, tWeight: 800 }, { name: 'Gym Mats', sku: 'GYM-MAT', qty: 50, unit: 'bundles', type: 'STANDARD_WEIGHT', uWeight: 15, tWeight: 750 }] },
    { customer: 'Crescent Pharma Dist.', address: 'Pharma Park, Unit 1', notes: 'Temperature logs required. [DEMO]', status: DeliveryStatus.DELIVERED,
      items: [{ name: 'OTC Medications', sku: 'PHM-OTC', qty: 60, unit: 'cartons', type: 'STANDARD_WEIGHT', uWeight: 10, tWeight: 600 }, { name: 'First Aid Kits', sku: 'PHM-FAK', qty: 30, unit: 'boxes', type: 'STANDARD_WEIGHT', uWeight: 5, tWeight: 150 }] },
    { customer: 'Urban Style Clothing', address: 'Fashion Mall, Store 204', notes: '[DEMO]', status: DeliveryStatus.PENDING,
      items: [{ name: 'Apparel Cartons', sku: 'CLO-APP', qty: 45, unit: 'cartons', type: 'STANDARD_WEIGHT', uWeight: 15, tWeight: 675 }, { name: 'Shoe Boxes', sku: 'CLO-SHO', qty: 100, unit: 'boxes', type: 'STANDARD_WEIGHT', uWeight: 2, tWeight: 200 }] },
    { customer: 'GreenLeaf Landscaping', address: 'County Road 12', notes: 'Drop off in back yard. [DEMO]', status: DeliveryStatus.ASSIGNED,
      items: [{ name: 'Pine Mulch', sku: 'LND-MUL', qty: 80, unit: 'bags', type: 'STANDARD_WEIGHT', uWeight: 20, tWeight: 1600 }, { name: 'Garden Pavers', sku: 'LND-PVR', qty: 2, unit: 'pallets', type: 'STANDARD_WEIGHT', uWeight: 900, tWeight: 1800 }] },
    { customer: 'SavorBite Restaurant Group', address: 'Culinary District', notes: 'Multi-stop delivery. [DEMO]', status: DeliveryStatus.IN_TRANSIT,
      items: [{ name: 'Premium Meats', sku: 'RST-MET', qty: 25, unit: 'boxes', type: 'VARIABLE_WEIGHT', uWeight: 18, tWeight: 450 }, { name: 'Sauces & Condiments', sku: 'RST-SAU', qty: 15, unit: 'cartons', type: 'STANDARD_WEIGHT', uWeight: 22, tWeight: 330 }] },
    { customer: 'Pacific Paper & Packaging', address: 'Paper Mill Way', notes: '[DEMO]', status: DeliveryStatus.DELIVERED,
      items: [{ name: 'Cardboard Boxes', sku: 'PKG-CDB', qty: 5, unit: 'pallets', type: 'STANDARD_WEIGHT', uWeight: 250, tWeight: 1250 }, { name: 'Packing Tape', sku: 'PKG-TAP', qty: 40, unit: 'cartons', type: 'STANDARD_WEIGHT', uWeight: 12, tWeight: 480 }] },
    { customer: 'TechVault - Warehouse', address: 'Central Storage', notes: 'High value goods. [DEMO]', status: DeliveryStatus.PENDING,
      items: [{ name: 'Smartphones', sku: 'PHN-SMT', qty: 10, unit: 'cartons', type: 'STANDARD_WEIGHT', uWeight: 15, tWeight: 150 }, { name: 'Tablets', sku: 'TAB-SMT', qty: 8, unit: 'cartons', type: 'STANDARD_WEIGHT', uWeight: 18, tWeight: 144 }] }
  ];

  const deliveries: any[] = [];
  let itemCount = 0;

  for (const del of deliveryData) {
    const totalDeliveryWeight = del.items.reduce((sum, item) => sum + item.tWeight, 0);

    const createdDelivery = await prisma.delivery.create({
      data: {
        companyId: company.id,
        customerName: del.customer,
        pickupAddress: 'Main Distribution Center',
        deliveryAddress: del.address,
        notes: del.notes,
        status: del.status,
        weight: totalDeliveryWeight,
        items: {
          create: del.items.map((item, index) => ({
            productName: item.name,
            sku: item.sku,
            quantity: item.qty,
            quantityUnit: item.unit,
            unitType: UnitType[item.type as keyof typeof UnitType],
            unitWeight: item.uWeight,
            totalWeight: item.tWeight,
            sortOrder: index,
          }))
        }
      },
      include: {
        items: true
      }
    });
    
    deliveries.push(createdDelivery);
    itemCount += createdDelivery.items.length;
  }

  console.log(`✅ Created ${deliveries.length} demo deliveries with ${itemCount} total items.`);

  console.log('Creating demo load plans...');
  
  // Find specific trucks and drivers for load plans
  const bt02 = trucks.find(t => t.plateNumber === 'BXT-102');
  const flt03 = trucks.find(t => t.plateNumber === 'FLT-201');
  const ref04 = trucks.find(t => t.plateNumber === 'REF-301');
  const bt01 = trucks.find(t => t.plateNumber === 'BXT-101');

  const ak = drivers.find(d => d.name === 'Ahmed Khalil');
  const ms = drivers.find(d => d.name === 'Maria Santos');
  const sm = drivers.find(d => d.name === 'Sarah Mitchell');
  const jr = drivers.find(d => d.name === 'James Rodriguez');

  const createLoadPlan = async (date: Date, truck: any, driver: any, status: LoadPlanStatus, delIndices: number[]) => {
    if (!truck || !driver) return;
    
    const lp = await prisma.loadPlan.create({
      data: {
        companyId: company.id,
        date,
        truckId: truck.id,
        driverId: driver.id,
        status,
        notes: 'Generated for demo purposes [DEMO]',
      }
    });

    for (let i = 0; i < delIndices.length; i++) {
      const delivery = deliveries[delIndices[i]];
      if (delivery) {
        await prisma.loadPlanItem.create({
          data: {
            loadPlanId: lp.id,
            deliveryId: delivery.id,
            sortOrder: i + 1
          }
        });
      }
    }
  };

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  await createLoadPlan(today, bt02, ak, LoadPlanStatus.DISPATCHED, [1, 8]); // Deliveries 2, 9
  await createLoadPlan(today, flt03, ms, LoadPlanStatus.DISPATCHED, [2, 5]); // Deliveries 3, 6
  await createLoadPlan(tomorrow, ref04, sm, LoadPlanStatus.READY, [13, 17]); // Deliveries 14, 18
  await createLoadPlan(tomorrow, bt01, jr, LoadPlanStatus.DRAFT, [3, 6]); // Deliveries 4, 7

  console.log('✅ Created 4 demo load plans.');
  console.log('---');
  console.log('Demo environment seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

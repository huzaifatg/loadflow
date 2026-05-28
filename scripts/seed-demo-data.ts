import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed process...');

  // Get or find the first company
  let company = await prisma.company.findFirst();

  if (!company) {
    console.log('No company found. Creating a default company...');
    company = await prisma.company.create({
      data: {
        name: 'LoadFlow Meat Logistics',
      },
    });
  }

  console.log(`Using Company: ${company.name} (${company.id})`);

  console.log('Checking for existing demo data...');
  // Delete any existing demo records to ensure clean slate (idempotency after failure)
  await prisma.deliveryItem.deleteMany({
    where: { delivery: { notes: { contains: '[DEMO]' } } }
  });
  await prisma.delivery.deleteMany({
    where: { companyId: company.id, notes: { contains: '[DEMO]' } }
  });
  await prisma.truck.deleteMany({
    where: { companyId: company.id, notes: { contains: '[DEMO]' } }
  });
  await prisma.driver.deleteMany({
    where: { companyId: company.id, notes: { contains: '[DEMO]' } }
  });
  console.log('Cleaned up any previous demo data.');

  console.log('Creating demo drivers...');
  const driverData = [
    { companyId: company.id, name: 'James Harrison', phone: '555-0101', licenseNumber: 'CDL-JH-98432', notes: 'Reliable. Good with refrigerated transport. [DEMO]' },
    { companyId: company.id, name: 'Michael Chen', phone: '555-0102', licenseNumber: 'CDL-MC-45122', notes: 'Morning shift preferred. [DEMO]' },
    { companyId: company.id, name: 'David Torres', phone: '555-0103', licenseNumber: 'CDL-DT-77321', notes: 'Experienced with heavy loads. [DEMO]' },
    { companyId: company.id, name: 'Robert Fox', phone: '555-0104', licenseNumber: 'CDL-RF-88210', notes: '[DEMO]' },
    { companyId: company.id, name: 'William Wright', phone: '555-0105', licenseNumber: 'CDL-WW-33921', notes: '[DEMO]' },
    { companyId: company.id, name: 'Thomas Anderson', phone: '555-0106', licenseNumber: 'CDL-TA-11234', notes: 'Available for weekend dispatch. [DEMO]' }
  ];

  for (const data of driverData) {
    await prisma.driver.create({ data });
  }
  console.log(`✅ Created ${driverData.length} demo drivers.`);

  console.log('Creating demo trucks...');
  const truckData = [
    { companyId: company.id, name: 'Reefer Unit 01', type: 'Refrigerated Box Truck', plateNumber: 'RFR-101', weightCapacity: 12000, notes: 'Dual temp zone capable. [DEMO]' },
    { companyId: company.id, name: 'Reefer Unit 02', type: 'Refrigerated Box Truck', plateNumber: 'RFR-102', weightCapacity: 10000, notes: 'Standard chiller. [DEMO]' },
    { companyId: company.id, name: 'Heavy Reefer 03', type: 'Refrigerated Trailer', plateNumber: 'HRF-201', weightCapacity: 25000, notes: 'For large supermarket deliveries. [DEMO]' },
    { companyId: company.id, name: 'Heavy Reefer 04', type: 'Refrigerated Trailer', plateNumber: 'HRF-202', weightCapacity: 25000, notes: '[DEMO]' },
    { companyId: company.id, name: 'City Reefer 05', type: 'Refrigerated Sprinter', plateNumber: 'CRF-301', weightCapacity: 4500, notes: 'Urban deliveries. Butcheries only. [DEMO]' }
  ];

  for (const data of truckData) {
    await prisma.truck.create({ data });
  }
  console.log(`✅ Created ${truckData.length} demo trucks.`);

  console.log('Creating demo deliveries and items...');

  const deliveryData = [
    {
      customerName: 'Lulu Hypermarket - Downtown',
      pickupAddress: 'Main Distribution Center, Dock 4',
      deliveryAddress: 'Lulu Hypermarket, Downtown Branch, Receiving Bay B',
      notes: 'Morning delivery window required. [DEMO]',
      items: [
        {
          productName: 'New Zealand Topside',
          sku: 'NZ-TOP-01',
          quantity: 45,
          quantityUnit: 'cartons',
          unitType: 'STANDARD_WEIGHT',
          unitWeight: 20,
          totalWeight: 900,
        },
        {
          productName: 'Brazilian Ribeye',
          sku: 'BR-RIB-02',
          quantity: 30,
          quantityUnit: 'cartons',
          unitType: 'VARIABLE_WEIGHT',
          unitWeight: 18.5,
          totalWeight: 555,
        },
        {
          productName: 'Australian Lamb Rack',
          sku: 'AU-LAMB-RACK',
          quantity: 120,
          quantityUnit: 'pcs',
          unitType: 'PIECE_BASED',
          unitWeight: 1.2,
          totalWeight: 144,
        },
        {
          productName: 'Beef Tenderloin',
          sku: 'BF-TEND-01',
          quantity: 25,
          quantityUnit: 'boxes',
          unitType: 'VARIABLE_WEIGHT',
          unitWeight: 15.3,
          totalWeight: 382.5,
        },
      ],
    },
    {
      customerName: 'Carrefour - City Center',
      pickupAddress: 'Main Distribution Center, Dock 2',
      deliveryAddress: 'Carrefour Hypermarket, City Center Mall, Loading Dock 1',
      notes: 'Check temperature logs on arrival. [DEMO]',
      items: [
        {
          productName: 'Beef Striploin',
          sku: 'BF-STRIP-04',
          quantity: 40,
          quantityUnit: 'cartons',
          unitType: 'STANDARD_WEIGHT',
          unitWeight: 22.5,
          totalWeight: 900,
        },
        {
          productName: 'Wagyu Chuck Roll',
          sku: 'WG-CHUCK-01',
          quantity: 15,
          quantityUnit: 'boxes',
          unitType: 'VARIABLE_WEIGHT',
          unitWeight: 16.8,
          totalWeight: 252,
        },
        {
          productName: 'Mutton Leg',
          sku: 'MUT-LEG-01',
          quantity: 80,
          quantityUnit: 'pcs',
          unitType: 'PIECE_BASED',
          unitWeight: 2.5,
          totalWeight: 200,
        },
      ],
    },
    {
      customerName: 'The Prime Butchery',
      pickupAddress: 'Main Distribution Center, Dock 1',
      deliveryAddress: '45 Culinary Ave, The Prime Butchery',
      notes: 'Boutique butcher. Need driver to help unload. [DEMO]',
      items: [
        {
          productName: 'Wagyu Chuck Roll',
          sku: 'WG-CHUCK-01',
          quantity: 5,
          quantityUnit: 'boxes',
          unitType: 'VARIABLE_WEIGHT',
          unitWeight: 16.5,
          totalWeight: 82.5,
        },
        {
          productName: 'Beef Brisket',
          sku: 'BF-BRIS-02',
          quantity: 10,
          quantityUnit: 'cartons',
          unitType: 'STANDARD_WEIGHT',
          unitWeight: 25,
          totalWeight: 250,
        },
        {
          productName: 'Lamb Chops',
          sku: 'LAMB-CHOP-01',
          quantity: 150,
          quantityUnit: 'pcs',
          unitType: 'PIECE_BASED',
          unitWeight: 0.8,
          totalWeight: 120,
        },
        {
          productName: 'Veal Leg',
          sku: 'VL-LEG-03',
          quantity: 8,
          quantityUnit: 'pcs',
          unitType: 'PIECE_BASED',
          unitWeight: 12,
          totalWeight: 96,
        },
      ],
    },
    {
      customerName: 'Sultan Center - Salmiya',
      pickupAddress: 'Main Distribution Center, Dock 3',
      deliveryAddress: 'Sultan Center, Salmiya Salem Al Mubarak St',
      notes: '[DEMO]',
      items: [
        {
          productName: 'Beef Mince',
          sku: 'BF-MINC-05',
          quantity: 50,
          quantityUnit: 'cartons',
          unitType: 'STANDARD_WEIGHT',
          unitWeight: 10,
          totalWeight: 500,
        },
        {
          productName: 'New Zealand Topside',
          sku: 'NZ-TOP-01',
          quantity: 20,
          quantityUnit: 'cartons',
          unitType: 'STANDARD_WEIGHT',
          unitWeight: 20,
          totalWeight: 400,
        },
        {
          productName: 'Short Ribs',
          sku: 'SH-RIB-02',
          quantity: 18,
          quantityUnit: 'boxes',
          unitType: 'VARIABLE_WEIGHT',
          unitWeight: 14.2,
          totalWeight: 255.6,
        },
      ],
    },
    {
      customerName: 'Grand Hyper',
      pickupAddress: 'Main Distribution Center, Dock 5',
      deliveryAddress: 'Grand Hypermarket, Industrial Area',
      notes: 'Pallet jack required. [DEMO]',
      items: [
        {
          productName: 'Beef Cubes',
          sku: 'BF-CUB-01',
          quantity: 60,
          quantityUnit: 'cartons',
          unitType: 'STANDARD_WEIGHT',
          unitWeight: 15,
          totalWeight: 900,
        },
        {
          productName: 'Lamb Shoulder',
          sku: 'LAMB-SHO-02',
          quantity: 25,
          quantityUnit: 'boxes',
          unitType: 'VARIABLE_WEIGHT',
          unitWeight: 18.4,
          totalWeight: 460,
        },
        {
          productName: 'Beef Shank',
          sku: 'BF-SHK-03',
          quantity: 40,
          quantityUnit: 'pcs',
          unitType: 'PIECE_BASED',
          unitWeight: 3.5,
          totalWeight: 140,
        },
      ],
    },
    {
      customerName: 'Gourmet Restaurant Group',
      pickupAddress: 'Main Distribution Center, Dock 1',
      deliveryAddress: 'Central Kitchen, 12 Chef Lane',
      notes: 'Strict temperature requirements. [DEMO]',
      items: [
        {
          productName: 'Beef Tenderloin',
          sku: 'BF-TEND-01',
          quantity: 12,
          quantityUnit: 'boxes',
          unitType: 'VARIABLE_WEIGHT',
          unitWeight: 15.5,
          totalWeight: 186,
        },
        {
          productName: 'Australian Lamb Rack',
          sku: 'AU-LAMB-RACK',
          quantity: 40,
          quantityUnit: 'pcs',
          unitType: 'PIECE_BASED',
          unitWeight: 1.1,
          totalWeight: 44,
        },
        {
          productName: 'Wagyu Chuck Roll',
          sku: 'WG-CHUCK-01',
          quantity: 3,
          quantityUnit: 'boxes',
          unitType: 'VARIABLE_WEIGHT',
          unitWeight: 16.2,
          totalWeight: 48.6,
        },
      ],
    },
    {
      customerName: 'Marriott City Hotel',
      pickupAddress: 'Main Distribution Center, Dock 2',
      deliveryAddress: 'Marriott Hotel Loading Bay, City District',
      notes: 'Security clearance required at gate. [DEMO]',
      items: [
        {
          productName: 'Beef Striploin',
          sku: 'BF-STRIP-04',
          quantity: 15,
          quantityUnit: 'cartons',
          unitType: 'STANDARD_WEIGHT',
          unitWeight: 22.5,
          totalWeight: 337.5,
        },
        {
          productName: 'Veal Leg',
          sku: 'VL-LEG-03',
          quantity: 5,
          quantityUnit: 'pcs',
          unitType: 'PIECE_BASED',
          unitWeight: 11.5,
          totalWeight: 57.5,
        },
        {
          productName: 'Brazilian Ribeye',
          sku: 'BR-RIB-02',
          quantity: 8,
          quantityUnit: 'cartons',
          unitType: 'VARIABLE_WEIGHT',
          unitWeight: 19.1,
          totalWeight: 152.8,
        },
        {
          productName: 'Lamb Chops',
          sku: 'LAMB-CHOP-01',
          quantity: 60,
          quantityUnit: 'pcs',
          unitType: 'PIECE_BASED',
          unitWeight: 0.75,
          totalWeight: 45,
        },
      ],
    }
  ];

  let deliveryCount = 0;
  let itemCount = 0;

  for (const del of deliveryData) {
    const totalDeliveryWeight = del.items.reduce((sum, item) => sum + item.totalWeight, 0);

    const createdDelivery = await prisma.delivery.create({
      data: {
        companyId: company.id,
        customerName: del.customerName,
        pickupAddress: del.pickupAddress,
        deliveryAddress: del.deliveryAddress,
        notes: del.notes,
        weight: totalDeliveryWeight,
        items: {
          create: del.items.map((item, index) => ({
            productName: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            quantityUnit: item.quantityUnit,
            // @ts-ignore
            unitType: item.unitType,
            unitWeight: item.unitWeight,
            totalWeight: item.totalWeight,
            sortOrder: index,
          }))
        }
      },
      include: {
        items: true
      }
    });
    
    deliveryCount++;
    itemCount += createdDelivery.items.length;
  }

  console.log(`✅ Created ${deliveryCount} demo deliveries with ${itemCount} total items.`);
  console.log('---');
  console.log('Seed completed successfully!');
  console.log(`Summary:
  - Deliveries Added: ${deliveryCount}
  - Delivery Items Added: ${itemCount}
  - Drivers Added: ${driverData.length}
  - Trucks Added: ${truckData.length}
  - No existing data was removed or modified.
  - No load plans were created (deliveries are unassigned).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

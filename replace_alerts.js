const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'components/deliveries/DeliveriesTable.tsx',
  'components/deliveries/DeliveryDetailClient.tsx',
  'components/drivers/DriverDetailClient.tsx',
  'components/loads/AllocationPanel.tsx',
  'components/loads/LoadPlanActions.tsx',
  'components/trucks/TruckCard.tsx',
  'components/trucks/TruckDetailClient.tsx'
];

filesToUpdate.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) return;
  let content = fs.readFileSync(fullPath, 'utf8');

  // Insert import if not exists
  if (!content.includes("import { toast } from 'sonner'")) {
    content = content.replace(/(import .*;\n)+/m, match => match + `import { toast } from 'sonner';\n`);
  }

  // Replace alert(msg) with toast.error(msg)
  content = content.replace(/alert\((.*)\)/g, 'toast.error($1)');

  fs.writeFileSync(fullPath, content);
  console.log('Updated ' + file);
});

const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'app/(dashboard)/layout.tsx',
  'app/(dashboard)/dashboard/page.tsx',
  'app/(dashboard)/settings/page.tsx',
  'app/(dashboard)/schedule/page.tsx',
  'app/(dashboard)/deliveries/page.tsx',
  'app/(dashboard)/deliveries/[id]/page.tsx',
  'app/(dashboard)/trucks/page.tsx',
  'app/(dashboard)/trucks/[id]/page.tsx',
  'app/(dashboard)/drivers/page.tsx',
  'app/(dashboard)/drivers/[id]/page.tsx',
  'app/(dashboard)/loads/page.tsx',
  'app/(dashboard)/loads/new/page.tsx',
  'app/(dashboard)/loads/[id]/page.tsx'
];

filesToUpdate.forEach(relPath => {
  const file = path.join('c:/Users/huzai/OneDrive/Desktop/LoadFlow', relPath);
  if (!fs.existsSync(file)) return;
  
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (!content.includes("import { getAuthContext } from '@/lib/auth';") && !content.includes('import { getAuthContext } from "@/lib/auth";')) {
    const importMatch = content.lastIndexOf('import ');
    if (importMatch !== -1) {
       const endOfImport = content.indexOf('\n', importMatch) + 1;
       content = content.slice(0, endOfImport) + "import { getAuthContext } from '@/lib/auth';\n" + content.slice(endOfImport);
       changed = true;
    } else {
       content = "import { getAuthContext } from '@/lib/auth';\n" + content;
       changed = true;
    }
  }

  if (changed) fs.writeFileSync(file, content);
});

console.log('Fixed auth imports.');

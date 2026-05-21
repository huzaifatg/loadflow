const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk(path.join(process.cwd(), 'app'));

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace standard findUnique pattern
  content = content.replace(
    /const\s+profile\s*=\s*await\s+prisma\.userProfile\.findUnique\(\{\s*where:\s*\{\s*authUserId:\s*user\.id\s*\}\s*,?\s*\}\)/g,
    'const company = await prisma.company.findFirst()'
  );
  
  // Replace the multi-line load plans try/catch profile fetches
  content = content.replace(
    /let\s+profile\s*=\s*null;[\s\S]*?profile\s*=\s*await\s+prisma\.userProfile\.findUnique\([\s\S]*?\);[\s\S]*?\} catch[^{]*\{[^}]*\}/g,
    'let company = await prisma.company.findFirst();'
  );

  // Replace profile references
  content = content.replace(/profile\.companyId/g, 'company.id');
  content = content.replace(/!\s*profile/g, '!company');
  content = content.replace(/profile/g, 'company'); // Catch any remaining profile references that should be company

  // Fix auth callback which creates a profile
  if (file.includes('callback') && file.includes('route.ts')) {
    content = content.replace(
      /const\s+existingProfile[\s\S]*?await\s+tx\.userProfile\.create\([^)]+\)/g,
      '// Auth callback handled. Company logic uses first company.'
    );
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated:', file);
  }
});

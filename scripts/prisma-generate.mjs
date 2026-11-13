import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const prismaClientDir = path.join(rootDir, 'node_modules', '.prisma', 'client');
const dllName = 'query_engine-windows.dll.node';
const dllPath = path.join(prismaClientDir, dllName);

const REQUIRED_MODELS = [
  'Company',
  'CompanyMember',
  'Truck',
  'Driver',
  'Delivery',
  'DeliveryItem',
  'LoadPlan',
  'LoadPlanItem',
  'ImportJob',
  'ImportRow',
  'ActivityEvent',
  'SavedView',
  'NotificationState',
  'ShipmentTrackingLink',
  'DeliveryTrackingEvent',
];

function cleanupTempAndBackupDlls() {
  if (!fs.existsSync(prismaClientDir)) return;
  for (const entry of fs.readdirSync(prismaClientDir)) {
    if (
      entry.startsWith(`${dllName}.tmp`) ||
      entry.startsWith(`${dllName}.bak`) ||
      entry.startsWith(`${dllName}.old`)
    ) {
      try {
        fs.unlinkSync(path.join(prismaClientDir, entry));
      } catch {
        // Still mapped by an active process; will be cleaned up on a subsequent run
      }
    }
  }
}

function runPrismaGenerate() {
  const prismaCliPath = path.join(rootDir, 'node_modules', 'prisma', 'build', 'index.js');
  return spawnSync(process.execPath, [prismaCliPath, 'generate'], {
    cwd: rootDir,
    stdio: 'pipe',
    encoding: 'utf8',
  });
}

function verifyGeneratedClient() {
  const indexPath = path.join(prismaClientDir, 'index.js');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Generated Prisma Client missing at ${indexPath}`);
  }
  const content = fs.readFileSync(indexPath, 'utf8');
  const missing = REQUIRED_MODELS.filter((m) => !content.includes(`${m}: '${m}'`));
  if (missing.length > 0) {
    throw new Error(
      `Generated Prisma Client at ${indexPath} is missing models: ${missing.join(', ')}`
    );
  }
}

cleanupTempAndBackupDlls();

let result = runPrismaGenerate();

if (result.status !== 0 && process.platform === 'win32' && fs.existsSync(dllPath)) {
  const combinedOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (combinedOutput.includes('EPERM') && combinedOutput.includes(dllName)) {
    const backupPath = path.join(prismaClientDir, `${dllName}.old.${Date.now()}`);
    try {
      fs.renameSync(dllPath, backupPath);
      cleanupTempAndBackupDlls();
      result = runPrismaGenerate();
      try {
        fs.unlinkSync(backupPath);
      } catch {
        // Locked by running process; safe to remove on next run
      }
    } catch (renameErr) {
      console.error('[prisma-generate] Failed to move locked Windows engine DLL:', renameErr);
    }
  }
}

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

verifyGeneratedClient();
cleanupTempAndBackupDlls();

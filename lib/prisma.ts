import { PrismaClient } from '@prisma/client';
import { createRequire } from 'node:module';
import path from 'node:path';

const REQUIRED_DELEGATES = [
  'company',
  'companyMember',
  'truck',
  'driver',
  'delivery',
  'deliveryItem',
  'loadPlan',
  'loadPlanItem',
  'importJob',
  'importRow',
  'activityEvent',
  'savedView',
  'notificationState',
  'shipmentTrackingLink',
  'deliveryTrackingEvent',
] as const;

type PrismaLogLevel = ('warn' | 'error')[];

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getClientOptions(): { log: PrismaLogLevel; datasourceUrl: string | undefined } {
  return {
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasourceUrl: process.env.DATABASE_URL,
  };
}

export function hasCurrentDelegates(client: unknown): client is PrismaClient {
  if (!client || typeof client !== 'object') return false;
  const candidate = client as Record<string, unknown>;
  return REQUIRED_DELEGATES.every((delegateName) => {
    const delegate = candidate[delegateName] as Record<string, unknown> | undefined;
    return (
      typeof delegate === 'object' &&
      delegate !== null &&
      typeof delegate.count === 'function' &&
      typeof delegate.findFirst === 'function'
    );
  });
}

function disconnectQuietly(client: unknown): void {
  if (!client || typeof client !== 'object') return;
  const disconnect = (client as { $disconnect?: () => Promise<unknown> }).$disconnect;
  if (typeof disconnect === 'function') {
    void disconnect.call(client).catch(() => {});
  }
}

function loadFreshPrismaClientFromDisk(): PrismaClient | null {
  try {
    const nodeRequire = createRequire(path.join(process.cwd(), 'package.json'));
    const cache = nodeRequire.cache;
    if (cache) {
      for (const key of Object.keys(cache)) {
        if (
          key.includes(`${path.sep}.prisma${path.sep}client`) ||
          key.includes(`${path.sep}@prisma${path.sep}client`)
        ) {
          delete cache[key];
        }
      }
    }
    const generatedIndexPath = path.join(
      process.cwd(),
      'node_modules',
      '.prisma',
      'client',
      'index.js'
    );
    const freshModule = nodeRequire(generatedIndexPath) as {
      PrismaClient?: new (options: ReturnType<typeof getClientOptions>) => PrismaClient;
    };
    if (typeof freshModule?.PrismaClient === 'function') {
      return new freshModule.PrismaClient(getClientOptions());
    }
  } catch (err) {
    console.error('[prisma] Failed to reload fresh PrismaClient from disk:', err);
  }
  return null;
}

function resolvePrismaClient(): PrismaClient {
  const existing: unknown = globalForPrisma.prisma;
  if (hasCurrentDelegates(existing)) {
    return existing;
  }

  if (existing) {
    disconnectQuietly(existing);
    globalForPrisma.prisma = undefined;
  }

  const primaryClient: unknown = new PrismaClient(getClientOptions());
  if (hasCurrentDelegates(primaryClient)) {
    return primaryClient;
  }

  disconnectQuietly(primaryClient);

  const reloadedClient: unknown = loadFreshPrismaClientFromDisk();
  if (hasCurrentDelegates(reloadedClient)) {
    return reloadedClient;
  }

  throw new Error(
    '[prisma] PrismaClient is missing required Sprint 16/17 model delegates (e.g. shipmentTrackingLink). Run `npm run prisma:generate` and restart the server.'
  );
}

export const prisma: PrismaClient = resolvePrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export function getPrismaRuntimeDiagnostics() {
  const candidate = prisma as unknown as Record<string, unknown>;
  const runtimeDataModel = candidate._runtimeDataModel as
    | { models?: Record<string, unknown> }
    | undefined;

  return {
    prismaClientVersion: (candidate._clientVersion as string | undefined) ?? null,
    runtimeModels: Object.keys(runtimeDataModel?.models ?? {}),
    delegates: {
      shipmentTrackingLink:
        typeof candidate.shipmentTrackingLink === 'object' &&
        candidate.shipmentTrackingLink !== null,
      deliveryTrackingEvent:
        typeof candidate.deliveryTrackingEvent === 'object' &&
        candidate.deliveryTrackingEvent !== null,
      activityEvent:
        typeof candidate.activityEvent === 'object' &&
        candidate.activityEvent !== null,
      savedView:
        typeof candidate.savedView === 'object' &&
        candidate.savedView !== null,
      notificationState:
        typeof candidate.notificationState === 'object' &&
        candidate.notificationState !== null,
    },
    matchesCurrentSchema: hasCurrentDelegates(prisma),
  };
}

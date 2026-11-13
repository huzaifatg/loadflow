import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    datasourceUrl: process.env.DATABASE_URL,
  });
}

function hasCurrentDelegates(client: PrismaClient | undefined): client is PrismaClient {
  if (!client) return false;
  const candidate = client as unknown as Record<string, unknown>;
  return (
    typeof candidate.shipmentTrackingLink === 'object' &&
    candidate.shipmentTrackingLink !== null &&
    typeof candidate.deliveryTrackingEvent === 'object' &&
    candidate.deliveryTrackingEvent !== null &&
    typeof candidate.activityEvent === 'object' &&
    candidate.activityEvent !== null &&
    typeof candidate.savedView === 'object' &&
    candidate.savedView !== null &&
    typeof candidate.notificationState === 'object' &&
    candidate.notificationState !== null
  );
}

export const prisma = hasCurrentDelegates(globalForPrisma.prisma)
  ? globalForPrisma.prisma
  : createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;


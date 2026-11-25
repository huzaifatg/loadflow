import { revalidatePath } from 'next/cache';

const CORE_OPERATIONAL_PATHS = [
  '/loads',
  '/dispatch',
  '/dispatch/calendar',
  '/dashboard',
  '/deliveries',
] as const;

export function revalidateLoadPlanViews(planId?: string): void {
  if (planId) {
    revalidatePath(`/loads/${planId}`);
  }
  for (const path of CORE_OPERATIONAL_PATHS) {
    revalidatePath(path);
  }
}

export function revalidateDeliveryViews(deliveryId?: string): void {
  if (deliveryId) {
    revalidatePath(`/deliveries/${deliveryId}`);
  }
  for (const path of CORE_OPERATIONAL_PATHS) {
    revalidatePath(path);
  }
}

export function revalidateFleetViews(
  kind: 'trucks' | 'drivers',
  entityId?: string,
): void {
  revalidatePath(`/${kind}`);
  if (entityId) {
    revalidatePath(`/${kind}/${entityId}`);
  }
  revalidatePath('/loads');
  revalidatePath('/dispatch');
  revalidatePath('/dispatch/calendar');
  revalidatePath('/dashboard');
}

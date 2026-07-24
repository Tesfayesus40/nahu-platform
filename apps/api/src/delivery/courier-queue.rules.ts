/**
 * D7 — Courier list/queue query rules (pure).
 * Mirrors shared/delivery/queueSections.js for Nest filtering.
 */

export const COURIER_QUEUE_SECTIONS = [
  'available',
  'accepted',
  'active',
  'completed_today',
  'failed',
  'returned',
] as const;

export type CourierQueueSection = (typeof COURIER_QUEUE_SECTIONS)[number];

export const COURIER_QUEUE_STATUSES: Record<
  CourierQueueSection,
  readonly string[]
> = {
  available: ['ASSIGNED'],
  accepted: ['ACCEPTED'],
  active: ['PICKED_UP', 'IN_TRANSIT', 'ARRIVED', 'DELIVERED', 'BUYER_CONFIRMED'],
  completed_today: ['COMPLETED'],
  failed: ['FAILED'],
  returned: ['RETURNED'],
};

export function isCourierQueueSection(
  value: string,
): value is CourierQueueSection {
  return (COURIER_QUEUE_SECTIONS as readonly string[]).includes(value);
}

export function statusesForCourierSection(
  section: string,
): string[] | null {
  if (!isCourierQueueSection(section)) return null;
  return [...COURIER_QUEUE_STATUSES[section]];
}

export function startOfUtcDay(d = new Date()): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

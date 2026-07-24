/**
 * D8 — Party (farmer/buyer) tracking helpers (pure).
 * Progress is state-based only — not ETA/distance.
 */

export const TRACKING_STEPS = [
  'PREPARING',
  'ASSIGNED',
  'PICKED_UP',
  'IN_TRANSIT',
  'ARRIVED',
  'DELIVERED',
  'COMPLETED',
] as const;

export type TrackingStep = (typeof TRACKING_STEPS)[number];

/** Map shipment status → progress step index (0-based). Terminal failures use -1. */
export function trackingStepIndex(status: string): number {
  switch (status) {
    case 'CREATED':
    case 'AWAITING_ASSIGNMENT':
      return 0;
    case 'ASSIGNED':
    case 'ACCEPTED':
      return 1;
    case 'PICKED_UP':
      return 2;
    case 'IN_TRANSIT':
      return 3;
    case 'ARRIVED':
      return 4;
    case 'DELIVERED':
    case 'BUYER_CONFIRMED':
      return 5;
    case 'COMPLETED':
      return 6;
    case 'CANCELLED':
    case 'FAILED':
    case 'RETURNED':
      return -1;
    default:
      return 0;
  }
}

export function trackingStepCode(status: string): TrackingStep | 'EXCEPTION' {
  const idx = trackingStepIndex(status);
  if (idx < 0) return 'EXCEPTION';
  return TRACKING_STEPS[idx];
}

export function isExceptionShipmentStatus(status: string): boolean {
  return ['CANCELLED', 'FAILED', 'RETURNED'].includes(status);
}

/** Events safe to show farmers/buyers (omit internal dispatch noise optionally). */
export function isPartyVisibleEvent(eventType: string): boolean {
  if (!eventType) return false;
  if (eventType.startsWith('delivery.earning.')) return false;
  if (eventType === 'delivery.courier.availability_changed') return false;
  return true;
}

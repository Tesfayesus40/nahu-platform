/**
 * D9 — Admin web progress helpers (mirrors shared/delivery/trackingProgress.js + tracking.rules.ts).
 * Status-based only — no ETA.
 */

export const TRACKING_STEPS = [
  "PREPARING",
  "ASSIGNED",
  "PICKED_UP",
  "IN_TRANSIT",
  "ARRIVED",
  "DELIVERED",
  "COMPLETED",
] as const;

export function trackingStepIndex(status: string): number {
  switch (status) {
    case "CREATED":
    case "AWAITING_ASSIGNMENT":
      return 0;
    case "ASSIGNED":
    case "ACCEPTED":
      return 1;
    case "PICKED_UP":
      return 2;
    case "IN_TRANSIT":
      return 3;
    case "ARRIVED":
      return 4;
    case "DELIVERED":
    case "BUYER_CONFIRMED":
      return 5;
    case "COMPLETED":
      return 6;
    case "CANCELLED":
    case "FAILED":
    case "RETURNED":
      return -1;
    default:
      return 0;
  }
}

export function isExceptionShipmentStatus(status: string): boolean {
  return ["CANCELLED", "FAILED", "RETURNED"].includes(status);
}

export function trackingStepLabel(stepCode: string): string {
  const labels: Record<string, string> = {
    PREPARING: "Preparing",
    ASSIGNED: "Courier assigned",
    PICKED_UP: "Picked up",
    IN_TRANSIT: "In transit",
    ARRIVED: "Arrived",
    DELIVERED: "Delivered",
    COMPLETED: "Completed",
    EXCEPTION: "Exception",
  };
  return labels[stepCode] ?? stepCode;
}

export function progressFromStatus(status: string) {
  const stepIndex = trackingStepIndex(status);
  const isException = stepIndex < 0;
  return {
    stepIndex,
    stepCode: isException
      ? "EXCEPTION"
      : TRACKING_STEPS[Math.max(0, stepIndex)],
    isException,
    totalSteps: TRACKING_STEPS.length,
  };
}

export function shortEventLabel(eventType: string): string {
  return eventType.replace(/^delivery\.(shipment\.)?/, "").replaceAll("_", " ");
}

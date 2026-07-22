export const ORDER_ADMIN_ACTIONS = [
  'CONFIRM_PAYMENT_SIMULATION',
  'CANCEL_UNPAID',
  'START_FULFILLMENT',
  'MARK_SHIPPED',
  'MARK_DELIVERED',
  'COMPLETE_ORDER',
  'NOTE',
] as const;

export type OrderAdminAction = (typeof ORDER_ADMIN_ACTIONS)[number];

const TRANSITIONS: Record<
  Exclude<OrderAdminAction, 'NOTE'>,
  { from: string[]; to: string }
> = {
  CONFIRM_PAYMENT_SIMULATION: {
    from: ['PENDING_PAYMENT'],
    to: 'PAID_ESCROW',
  },
  CANCEL_UNPAID: { from: ['PENDING_PAYMENT'], to: 'CANCELLED' },
  START_FULFILLMENT: { from: ['PAID_ESCROW'], to: 'CONFIRMED' },
  MARK_SHIPPED: { from: ['CONFIRMED'], to: 'SHIPPED' },
  MARK_DELIVERED: { from: ['SHIPPED', 'CONFIRMED'], to: 'DELIVERED' },
  COMPLETE_ORDER: {
    from: ['DELIVERED', 'PAID_ESCROW', 'CONFIRMED', 'SHIPPED'],
    to: 'COMPLETED',
  },
};

export function nextOrderStatus(
  action: OrderAdminAction,
  current: string,
): string | null {
  if (action === 'NOTE') return current;
  const rule = TRANSITIONS[action];
  if (!rule.from.includes(current)) return null;
  return rule.to;
}

export function requiresOrderActionReason(action: OrderAdminAction): boolean {
  return (
    action === 'CANCEL_UNPAID' ||
    action === 'CONFIRM_PAYMENT_SIMULATION' ||
    action === 'COMPLETE_ORDER'
  );
}

export function isStalledEscrow(status: string, paidAt: Date | null, days = 3): boolean {
  if (status !== 'PAID_ESCROW' || !paidAt) return false;
  const ageMs = Date.now() - paidAt.getTime();
  return ageMs >= days * 24 * 60 * 60 * 1000;
}

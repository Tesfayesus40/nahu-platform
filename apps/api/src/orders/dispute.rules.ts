export const DISPUTE_STATUSES = [
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED',
  'CLOSED',
  'ESCALATED',
] as const;

export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const OPEN_DISPUTE_STATUSES: DisputeStatus[] = [
  'OPEN',
  'UNDER_REVIEW',
  'ESCALATED',
];

export const DISPUTE_ACTIONS = [
  'START_REVIEW',
  'REQUEST_INFO',
  'REFUND',
  'RESOLVE',
  'REJECT',
  'CLOSE',
  'ESCALATE',
  'ASSIGN',
  'NOTE',
] as const;

export type DisputeAction = (typeof DISPUTE_ACTIONS)[number];

export function statusAfterDisputeAction(
  action: DisputeAction,
  current: DisputeStatus,
): DisputeStatus {
  switch (action) {
    case 'START_REVIEW':
      return 'UNDER_REVIEW';
    case 'REQUEST_INFO':
      return current === 'CLOSED' || current === 'RESOLVED'
        ? current
        : 'UNDER_REVIEW';
    case 'RESOLVE':
    case 'REJECT':
      return 'RESOLVED';
    case 'CLOSE':
      return 'CLOSED';
    case 'ESCALATE':
      return 'ESCALATED';
    case 'REFUND':
    case 'ASSIGN':
    case 'NOTE':
      return current;
    default:
      return current;
  }
}

export function requiresDisputeReason(action: DisputeAction): boolean {
  return (
    action === 'REQUEST_INFO' ||
    action === 'RESOLVE' ||
    action === 'REJECT' ||
    action === 'CLOSE' ||
    action === 'ESCALATE' ||
    action === 'REFUND'
  );
}

export function isOpenDisputeStatus(status: string): boolean {
  return (OPEN_DISPUTE_STATUSES as readonly string[]).includes(status);
}

/** Terminal cases should not accept most workflow actions. */
export function canApplyDisputeAction(
  action: DisputeAction,
  status: DisputeStatus,
): boolean {
  if (action === 'NOTE' || action === 'ASSIGN') return true;
  if (status === 'CLOSED') return false;
  if (status === 'RESOLVED' && action !== 'CLOSE') return false;
  return true;
}

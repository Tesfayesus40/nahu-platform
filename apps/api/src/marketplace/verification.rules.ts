export const VERIFICATION_SUBJECT_TYPES = [
  'FARMER',
  'BUYER',
  'MERCHANT',
  'ORGANIZATION',
] as const;

export type VerificationSubjectType =
  (typeof VERIFICATION_SUBJECT_TYPES)[number];

export const VERIFICATION_STATUSES = [
  'PENDING',
  'IN_REVIEW',
  'NEEDS_INFO',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const PENDING_VERIFICATION_STATUSES: VerificationStatus[] = [
  'PENDING',
  'IN_REVIEW',
  'NEEDS_INFO',
];

export const VERIFICATION_DECISIONS = [
  'APPROVE',
  'REJECT',
  'REQUEST_INFO',
  'SUSPEND',
  'START_REVIEW',
  'NOTE',
] as const;

export type VerificationDecisionCode =
  (typeof VERIFICATION_DECISIONS)[number];

const DECIDE_PERMISSION_BY_SUBJECT: Record<VerificationSubjectType, string> = {
  FARMER: 'farmers.verify',
  BUYER: 'buyers.verify',
  MERCHANT: 'marketplace.merchants.verify',
  ORGANIZATION: 'identity.organizations.verify',
};

export function decidePermissionForSubject(
  subjectType: string,
): string | null {
  if (
    (VERIFICATION_SUBJECT_TYPES as readonly string[]).includes(subjectType)
  ) {
    return DECIDE_PERMISSION_BY_SUBJECT[subjectType as VerificationSubjectType];
  }
  return null;
}

export function canDecideSubject(
  heldPermissions: string[],
  subjectType: string,
): boolean {
  const required = decidePermissionForSubject(subjectType);
  return Boolean(required && heldPermissions.includes(required));
}

export function canReadVerification(heldPermissions: string[]): boolean {
  if (heldPermissions.includes('verification.read')) return true;
  return (
    heldPermissions.includes('farmers.verify') ||
    heldPermissions.includes('buyers.verify') ||
    heldPermissions.includes('marketplace.merchants.verify') ||
    heldPermissions.includes('identity.organizations.verify')
  );
}

/** Map a decision to the resulting case status (NOTE leaves status unchanged). */
export function statusAfterDecision(
  decision: VerificationDecisionCode,
  currentStatus: VerificationStatus,
): VerificationStatus {
  switch (decision) {
    case 'APPROVE':
      return 'APPROVED';
    case 'REJECT':
      return 'REJECTED';
    case 'REQUEST_INFO':
      return 'NEEDS_INFO';
    case 'SUSPEND':
      return 'SUSPENDED';
    case 'START_REVIEW':
      return 'IN_REVIEW';
    case 'NOTE':
      return currentStatus;
    default:
      return currentStatus;
  }
}

export function isPendingVerificationStatus(status: string): boolean {
  return (PENDING_VERIFICATION_STATUSES as readonly string[]).includes(status);
}

export function requiresReason(decision: VerificationDecisionCode): boolean {
  return (
    decision === 'REJECT' ||
    decision === 'REQUEST_INFO' ||
    decision === 'SUSPEND'
  );
}

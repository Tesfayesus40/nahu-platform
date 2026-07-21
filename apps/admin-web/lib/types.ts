// Response shapes mirrored from the Nest A1 admin services.

export type MeResponse = {
  id: string;
  email: string | null;
  phone: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  roles: string[];
  authzVersion: number;
  mfaRequired: boolean;
  mustResetPassword: boolean;
};

export type CapabilitiesResponse = {
  roles: string[];
  permissions: string[];
};

export type DashboardSummaryResponse = {
  status: string;
  message: string;
  asOf?: string;
  placeholders: {
    pendingVerifications: number | null;
    pendingVerificationsByType?: {
      FARMER: number;
      BUYER: number;
      MERCHANT: number;
      ORGANIZATION: number;
    };
    openDisputes: number | null;
    disputesByStatus?: {
      OPEN: number;
      UNDER_REVIEW: number;
      RESOLVED: number;
      CLOSED: number;
      ESCALATED: number;
    };
    activeListings: number | null;
    pendingListingModeration?: number | null;
    listingsByModeration?: {
      PENDING: number;
      APPROVED: number;
      REJECTED: number;
      SUSPENDED: number;
      FLAGGED: number;
    };
  };
};

export type SystemHealthResponse = {
  status: "ok" | "degraded";
  service: string;
  timestamp: string;
  dependencies: { database: "up" | "down" };
};

export type AuditEvent = {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  actorSessionId: string | null;
  permissionCode: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  requestId: string | null;
  reason: string | null;
  outcome: "SUCCESS" | "FAILED" | "DENIED";
  ip: string | null;
  userAgent: string | null;
};

export type AuditEventsResponse = {
  page: number;
  limit: number;
  total: number;
  items: AuditEvent[];
};

export type UserListItem = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string;
  status: string;
  roles: string[];
  mfaRequired: boolean;
  mfaEnrolled: boolean;
  mustResetPassword: boolean;
  lockedUntil: string | null;
  workforceCapable: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UsersListResponse = {
  page: number;
  limit: number;
  total: number;
  items: UserListItem[];
};

export type UserDetail = UserListItem & {
  middleName: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  preferredLanguage: string;
  authzVersion: number;
  deletedAt: string | null;
  credential: {
    hasPassword: boolean;
    failedLoginAttempts: number;
    lockedUntil: string | null;
    passwordChangedAt: string | null;
    lastLoginAt: string | null;
  } | null;
  mfaFactors: Array<{
    id: string;
    type: string;
    label: string | null;
    verifiedAt: string | null;
    disabledAt: string | null;
    createdAt: string;
  }>;
  activeAdminSessionCount: number;
};

export type RolesListResponse = {
  items: Array<{
    id: string;
    code: string;
    displayName: string;
    description: string | null;
  }>;
  assignableCodes: string[];
  workforceCodes: string[];
};

export type MfaResetResponse = {
  ok: boolean;
  enrollToken: string;
  expiresAt: string;
  userId: string;
};

export type PasswordResetResponse = {
  ok: boolean;
  temporaryPassword: string;
  userId: string;
  mustResetPassword: boolean;
};

export type VerificationCaseListItem = {
  id: string;
  subjectType: string;
  subjectId: string;
  status: string;
  displayName: string | null;
  region: string | null;
  reviewerUserId: string | null;
  submittedAt: string;
  updatedAt: string;
  decidedAt: string | null;
  documentCount: number;
  decisionCount: number;
  canDecide: boolean;
};

export type VerificationCasesResponse = {
  page: number;
  limit: number;
  total: number;
  items: VerificationCaseListItem[];
};

export type VerificationCaseDetail = VerificationCaseListItem & {
  reviewerNotes: string | null;
  infoRequestMessage: string | null;
  subject: unknown;
  documents: Array<{
    id: string;
    label: string;
    fileUrl: string;
    contentType: string | null;
    uploadedByUserId: string | null;
    createdAt: string;
  }>;
  decisions: Array<{
    id: string;
    decision: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    notes: string | null;
    actorUserId: string;
    createdAt: string;
  }>;
};

export type ListingModerationListItem = {
  id: string;
  farmerId: string;
  region: string;
  status: string;
  moderationStatus: string;
  quantityKg: string | number;
  pricePerKg: string | number;
  grade: string;
  processMethod: string;
  variety: string | null;
  photoUrls: string[];
  createdAt: string;
  updatedAt: string;
  sellerName: string | null;
  sellerPhone: string | null;
  categoryCode: string | null;
  productCode: string | null;
  decisionCount?: number;
};

export type ListingModerationListResponse = {
  page: number;
  limit: number;
  total: number;
  items: ListingModerationListItem[];
};

export type ListingModerationDetail = ListingModerationListItem & {
  moderationNotes: string | null;
  moderatedAt: string | null;
  moderatedByUserId: string | null;
  photoUrls: string[];
  decisions: Array<{
    id: string;
    decision: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    notes: string | null;
    actorUserId: string;
    createdAt: string;
  }>;
  farmer?: unknown;
  category?: unknown;
  product?: unknown;
};

export type DisputeListItem = {
  id: string;
  orderId: string;
  status: string;
  assignedToUserId: string | null;
  reasonCode: string | null;
  summary: string | null;
  refundStatus: string;
  openedAt: string;
  updatedAt: string;
  orderStatus: string | null;
  totalEtb: string | number | null;
  buyerName: string | null;
  buyerPhone: string | null;
  sellerName: string | null;
  sellerPhone: string | null;
  listingRegion: string | null;
  listingVariety: string | null;
  eventCount?: number;
  evidenceCount?: number;
  noteCount?: number;
  canManage: boolean;
};

export type DisputesListResponse = {
  page: number;
  limit: number;
  total: number;
  items: DisputeListItem[];
};

export type DisputeDetail = DisputeListItem & {
  resolutionCode: string | null;
  resolutionNotes: string | null;
  infoRequestMessage: string | null;
  refundAmountEtb: string | number | null;
  refundNotes: string | null;
  escalatedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  openedByUserId: string | null;
  openedByRole: string | null;
  order: {
    id: string;
    status: string;
    totalEtb: string | number;
    commissionEtb: string | number;
    farmerPayoutEtb: string | number;
    quantityKg: string | number;
    quantity: string | number | null;
    unitCode: string | null;
    paymentMethod: string;
    paymentReference: string | null;
    deliveryAddress: string;
    paidAt: string | null;
    deliveredAt: string | null;
    completedAt: string | null;
    createdAt: string;
    listing: unknown;
  };
  buyer: {
    id: string;
    email: string | null;
    phone: string;
    firstName: string | null;
    lastName: string | null;
    status: string;
  };
  seller: {
    farmerProfileId: string;
    region: string;
    woreda: string | null;
    verified: boolean;
    cooperative: { id: string; name: string; verified: boolean } | null;
    user: {
      id: string;
      email: string | null;
      phone: string;
      firstName: string | null;
      lastName: string | null;
      status: string;
    };
  };
  timeline: Array<{
    id: string;
    eventType: string;
    fromStatus: string | null;
    toStatus: string | null;
    message: string | null;
    actorUserId: string | null;
    metadataJson: unknown;
    createdAt: string;
  }>;
  evidence: Array<{
    id: string;
    label: string;
    fileUrl: string;
    contentType: string | null;
    uploadedByUserId: string | null;
    createdAt: string;
  }>;
  notes: Array<{
    id: string;
    body: string;
    isInternal: boolean;
    authorUserId: string;
    createdAt: string;
  }>;
};

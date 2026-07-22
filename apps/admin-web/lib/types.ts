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
  trendDays?: number;
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
  queues?: {
    pendingVerifications: number | null;
    pendingListingModeration: number | null;
    openDisputes: number | null;
    lockedUsers: number | null;
    recentDeniedActions: number | null;
    pendingPaymentOrders?: number | null;
    stalledEscrowOrders?: number | null;
    openFulfillments?: number | null;
    deliveryExceptions?: number | null;
    unreadNotifications?: number | null;
    alertBreaches?: number | null;
  };
  kpis?: {
    activeApprovedListings: number | null;
    activeUsers: number | null;
    ordersLast7d: number | null;
    disputePressure: number | null;
    trendOrders14d: number | null;
    activePromotions?: number | null;
    verifiedCooperatives?: number | null;
    unreadNotifications?: number | null;
    alertBreaches?: number | null;
  };
  sections?: {
    users: {
      total: number;
      byStatus: Record<string, number>;
      locked: number;
      workforce: number;
      created7d: number;
      created30d: number;
    } | null;
    verification: {
      pending: number;
      byStatus: Record<string, number>;
      pendingByType: Record<string, number>;
    } | null;
    listings: {
      actionable: number;
      activeApproved: number;
      byModeration: Record<string, number>;
      byCommercial: Record<string, number>;
    } | null;
    disputes: {
      open: number;
      byStatus: Record<string, number>;
    } | null;
    marketplace: {
      byOrderStatus: Record<string, number>;
      ordersCreated7d: number;
      ordersCreated30d: number;
      disputedOrders: number;
    } | null;
    commerce?: {
      pendingPayment: number;
      stalledEscrow: number;
      byStatus: Record<string, number>;
    } | null;
    delivery?: {
      open: number;
      exceptions: number;
      byStatus: Record<string, number>;
    } | null;
    promotions?: {
      byStatus: Record<string, number>;
    } | null;
    cooperatives?: {
      total: number;
      verified: number;
    } | null;
    security: {
      denied7d: number;
      failed7d: number;
      byOutcome7d: Record<string, number>;
    } | null;
    health: { status: string; database: string } | null;
  };
  trends?: {
    ordersCreated: Array<{ date: string; count: number }>;
    usersCreated: Array<{ date: string; count: number }>;
    disputesOpened: Array<{ date: string; count: number }>;
    verificationsSubmitted: Array<{ date: string; count: number }>;
  };
};

export type SystemHealthResponse = {
  status: "ok" | "degraded";
  service: string;
  timestamp: string;
  version?: string;
  nodeEnv?: string;
  uptimeSeconds?: number;
  dependencies: { database: "up" | "down" };
};

export type SystemOverviewResponse = {
  health: SystemHealthResponse;
  activeAdminSessions: number;
  pendingInvitations: number;
  featureFlags: Array<{
    id: string;
    code: string;
    displayName: string;
    description: string | null;
    enabled: boolean;
    updatedAt: string;
    updatedByUserId: string | null;
  }>;
  migrations: {
    appliedCount: number;
    latestFilename: string | null;
    latestAppliedAt: string | null;
  };
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
  beforeJson?: unknown;
  afterJson?: unknown;
  metadataJson?: unknown;
};

export type AuditSummaryResponse = {
  days: number;
  since: string;
  byOutcome: Record<string, number>;
  topActions: Array<{ action: string; count: number }>;
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

export type OrderListItem = {
  id: string;
  status: string;
  totalEtb: string | number;
  paymentMethod: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  buyerName: string | null;
  buyerPhone: string | null;
  sellerName: string | null;
  sellerPhone: string | null;
  listingRegion: string | null;
  listingVariety: string | null;
  disputeId: string | null;
  disputeStatus: string | null;
  stalledEscrow: boolean;
};

export type OrdersListResponse = {
  page: number;
  limit: number;
  total: number;
  items: OrderListItem[];
};

export type OrderDetail = OrderListItem & {
  quantity: string | number | null;
  unitCode: string | null;
  pricePerUnit: string | number | null;
  commissionEtb: string | number;
  farmerPayoutEtb: string | number;
  paymentReference: string | null;
  deliveryAddress: string;
  deliveredAt: string | null;
  completedAt: string | null;
  payment: {
    method: string;
    reference: string | null;
    paidAt: string | null;
    providerStatus: string;
    providerLabel: string;
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
  listing: unknown;
  disputeCase: { id: string; status: string; refundStatus?: string } | null;
  certificate: unknown;
  fulfillmentCase: { id: string; status: string } | null;
  adminNotes: Array<{
    id: string;
    body: string;
    authorUserId: string;
    createdAt: string;
  }>;
};

export type FulfillmentListItem = {
  id: string;
  orderId: string;
  status: string;
  carrierCode: string | null;
  trackingRef: string | null;
  assignedToUserId: string | null;
  updatedAt: string;
  orderStatus: string | null;
  totalEtb: string | number | null;
  deliveryAddress: string | null;
};

export type FulfillmentsListResponse = {
  page: number;
  limit: number;
  total: number;
  items: FulfillmentListItem[];
};

export type FulfillmentDetail = FulfillmentListItem & {
  pickupNotes: string | null;
  deliveryNotes: string | null;
  exceptionCode: string | null;
  exceptionNotes: string | null;
  readyAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  closedAt: string | null;
  createdAt: string;
  events: Array<{
    id: string;
    eventType: string;
    fromStatus: string | null;
    toStatus: string | null;
    message: string | null;
    actorUserId: string | null;
    createdAt: string;
  }>;
  order: {
    id: string;
    status: string;
    totalEtb: string | number;
    deliveryAddress: string;
    paymentMethod: string;
    buyer?: {
      id: string;
      phone: string;
      firstName: string | null;
      lastName: string | null;
    };
    farmer?: {
      user?: {
        id: string;
        phone: string;
        firstName: string | null;
        lastName: string | null;
      };
    };
  };
};

export type Promotion = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  scopeType: string;
  scopeRef: string | null;
  discountType: string | null;
  discountValue: string | number | null;
  startsAt: string | null;
  endsAt: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PromotionsListResponse = {
  page: number;
  limit: number;
  total: number;
  items: Promotion[];
};

export type CooperativeListItem = {
  id: string;
  name: string;
  unionName: string | null;
  region: string | null;
  zone: string | null;
  licenseNumber: string | null;
  verified: boolean;
  verificationStatus: string | null;
  farmerCount: number;
  updatedAt: string;
};

export type CooperativesListResponse = {
  page: number;
  limit: number;
  total: number;
  items: CooperativeListItem[];
};

export type CooperativeDetail = Omit<CooperativeListItem, "farmerCount"> & {
  farmerCount?: number;
  verificationNotes: string | null;
  farmerProfiles?: Array<{
    id: string;
    user: {
      id: string;
      phone: string;
      firstName: string | null;
      lastName: string | null;
    };
    _count?: { listings: number; orders: number };
  }>;
};

export type ReportCatalogType = {
  type: string;
  label: string;
  description: string;
};

export type ReportCatalogResponse = {
  types: ReportCatalogType[];
  rowCap: number;
  note: string;
};

export type ReportJob = {
  id: string;
  reportType: string;
  label: string;
  status: string;
  rowCount: number | null;
  errorMessage?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export type ReportJobsResponse = {
  page: number;
  limit: number;
  total: number;
  items: ReportJob[];
};

export type ReportExportResult = {
  id: string;
  reportType: string;
  label: string;
  status: string;
  rowCount: number | null;
  completedAt?: string | null;
  artifactCsv?: string | null;
};

export type AdminNotification = {
  id: string;
  recipientUserId: string | null;
  audience: string;
  audienceRole: string | null;
  severity: string;
  title: string;
  body: string;
  linkPath: string | null;
  sourceModule: string;
  dedupeKey: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsListResponse = {
  page: number;
  limit: number;
  total: number;
  unreadCount: number;
  items: AdminNotification[];
};

export type MonitoringAlert = {
  id: string;
  code: string;
  displayName: string;
  description: string | null;
  metricKey: string;
  value: number;
  warnAbove: number | null;
  criticalAbove: number | null;
  enabled: boolean;
  level: "OK" | "WARN" | "CRITICAL";
};

export type MonitoringSnapshotResponse = {
  asOf: string;
  health: SystemHealthResponse;
  metrics: Record<string, number>;
  alerts: MonitoringAlert[];
  summary: {
    breachCount: number;
    criticalCount: number;
    okCount: number;
  };
  extensibility: string;
};

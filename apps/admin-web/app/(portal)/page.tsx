"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { usePortal } from "@/components/PortalShell";
import { bffGet } from "@/lib/client";
import type {
  DashboardSummaryResponse,
  SystemHealthResponse,
} from "@/lib/types";

const ENV_LABEL =
  process.env.NODE_ENV === "production" ? "production" : "development";

export default function DashboardPage() {
  const { me, capabilities } = usePortal();
  const canReadHealth = capabilities.permissions.includes(
    "admin.system.health.read",
  );
  const canReadSummary = capabilities.permissions.includes(
    "admin.dashboard.read",
  );
  const canReadAudit = capabilities.permissions.includes("audit.read");
  const canReadVerification = capabilities.permissions.includes(
    "verification.read",
  );
  const canReadListings = capabilities.permissions.includes(
    "marketplace.listings.read",
  );
  const canReadDisputes = capabilities.permissions.includes(
    "orders.disputes.read",
  );

  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);

  useEffect(() => {
    if (canReadHealth) {
      bffGet<SystemHealthResponse>("/api/system/health")
        .then(setHealth)
        .catch(() => setHealth(null));
    }
    if (canReadSummary) {
      bffGet<DashboardSummaryResponse>("/api/dashboard/summary")
        .then(setSummary)
        .catch(() => setSummary(null));
    }
  }, [canReadHealth, canReadSummary]);

  const pending = summary?.placeholders.pendingVerifications;
  const byType = summary?.placeholders.pendingVerificationsByType;
  const pendingListings = summary?.placeholders.pendingListingModeration;
  const listingsByMod = summary?.placeholders.listingsByModeration;
  const openDisputes = summary?.placeholders.openDisputes;
  const disputesByStatus = summary?.placeholders.disputesByStatus;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Nahu platform administration overview"
        actions={
          <StatusBadge
            status={ENV_LABEL}
            tone={ENV_LABEL === "production" ? "danger" : "neutral"}
          />
        }
      />

      <div className="card-grid">
        {canReadHealth ? (
          <div className="card">
            <h2>System status</h2>
            {health ? (
              <dl className="kv">
                <dt>Status</dt>
                <dd>
                  <StatusBadge status={health.status} />
                </dd>
                <dt>Service</dt>
                <dd>{health.service}</dd>
                <dt>Database</dt>
                <dd>
                  <StatusBadge status={health.dependencies.database} />
                </dd>
                <dt>Checked at</dt>
                <dd>{new Date(health.timestamp).toLocaleString()}</dd>
              </dl>
            ) : (
              <div className="loading">Checking system health…</div>
            )}
          </div>
        ) : null}

        <div className="card">
          <h2>Your session</h2>
          <dl className="kv">
            <dt>Email</dt>
            <dd>{me.email ?? "—"}</dd>
            <dt>Roles</dt>
            <dd>{me.roles.join(", ") || "—"}</dd>
            <dt>Status</dt>
            <dd>
              <StatusBadge status={me.status} />
            </dd>
            <dt>MFA</dt>
            <dd>{me.mfaRequired ? "Enforced" : "Not enforced"}</dd>
          </dl>
        </div>
      </div>

      {canReadSummary ? (
        <div className="card">
          <h2>Operational queues</h2>
          <p className="muted" style={{ margin: "0 0 12px" }}>
            {summary?.message ?? "Loading queue counts…"}
          </p>
          <dl className="kv">
            <dt>Pending verifications</dt>
            <dd>
              {typeof pending === "number" ? (
                canReadVerification ? (
                  <Link href="/verification?queue=pending" className="table-link">
                    {pending}
                  </Link>
                ) : (
                  pending
                )
              ) : (
                "—"
              )}
            </dd>
            {byType ? (
              <>
                <dt>Farmers</dt>
                <dd>
                  {canReadVerification ? (
                    <Link
                      href="/verification?queue=pending&subjectType=FARMER"
                      className="table-link"
                    >
                      {byType.FARMER}
                    </Link>
                  ) : (
                    byType.FARMER
                  )}
                </dd>
                <dt>Buyers</dt>
                <dd>
                  {canReadVerification ? (
                    <Link
                      href="/verification?queue=pending&subjectType=BUYER"
                      className="table-link"
                    >
                      {byType.BUYER}
                    </Link>
                  ) : (
                    byType.BUYER
                  )}
                </dd>
                <dt>Merchants</dt>
                <dd>
                  {canReadVerification ? (
                    <Link
                      href="/verification?queue=pending&subjectType=MERCHANT"
                      className="table-link"
                    >
                      {byType.MERCHANT}
                    </Link>
                  ) : (
                    byType.MERCHANT
                  )}
                </dd>
                <dt>Organizations</dt>
                <dd>
                  {canReadVerification ? (
                    <Link
                      href="/verification?queue=pending&subjectType=ORGANIZATION"
                      className="table-link"
                    >
                      {byType.ORGANIZATION}
                    </Link>
                  ) : (
                    byType.ORGANIZATION
                  )}
                </dd>
              </>
            ) : null}
            <dt>Open disputes</dt>
            <dd>
              {typeof openDisputes === "number" ? (
                canReadDisputes ? (
                  <Link href="/disputes?queue=open" className="table-link">
                    {openDisputes}
                  </Link>
                ) : (
                  openDisputes
                )
              ) : (
                "—"
              )}
            </dd>
            {disputesByStatus ? (
              <>
                <dt>Disputes under review</dt>
                <dd>
                  {canReadDisputes ? (
                    <Link
                      href="/disputes?status=UNDER_REVIEW"
                      className="table-link"
                    >
                      {disputesByStatus.UNDER_REVIEW}
                    </Link>
                  ) : (
                    disputesByStatus.UNDER_REVIEW
                  )}
                </dd>
                <dt>Disputes escalated</dt>
                <dd>
                  {canReadDisputes ? (
                    <Link
                      href="/disputes?status=ESCALATED"
                      className="table-link"
                    >
                      {disputesByStatus.ESCALATED}
                    </Link>
                  ) : (
                    disputesByStatus.ESCALATED
                  )}
                </dd>
                <dt>Disputes resolved</dt>
                <dd>
                  {canReadDisputes ? (
                    <Link
                      href="/disputes?status=RESOLVED"
                      className="table-link"
                    >
                      {disputesByStatus.RESOLVED}
                    </Link>
                  ) : (
                    disputesByStatus.RESOLVED
                  )}
                </dd>
              </>
            ) : null}
            <dt>Active listings (approved)</dt>
            <dd>{summary?.placeholders.activeListings ?? "—"}</dd>
            <dt>Pending listing moderation</dt>
            <dd>
              {typeof pendingListings === "number" ? (
                canReadListings ? (
                  <Link
                    href="/listings?queue=pending"
                    className="table-link"
                  >
                    {pendingListings}
                  </Link>
                ) : (
                  pendingListings
                )
              ) : (
                "—"
              )}
            </dd>
            {listingsByMod ? (
              <>
                <dt>Listings flagged</dt>
                <dd>
                  {canReadListings ? (
                    <Link
                      href="/listings?moderationStatus=FLAGGED"
                      className="table-link"
                    >
                      {listingsByMod.FLAGGED}
                    </Link>
                  ) : (
                    listingsByMod.FLAGGED
                  )}
                </dd>
                <dt>Listings rejected</dt>
                <dd>
                  {canReadListings ? (
                    <Link
                      href="/listings?moderationStatus=REJECTED"
                      className="table-link"
                    >
                      {listingsByMod.REJECTED}
                    </Link>
                  ) : (
                    listingsByMod.REJECTED
                  )}
                </dd>
                <dt>Listings suspended</dt>
                <dd>
                  {canReadListings ? (
                    <Link
                      href="/listings?moderationStatus=SUSPENDED"
                      className="table-link"
                    >
                      {listingsByMod.SUSPENDED}
                    </Link>
                  ) : (
                    listingsByMod.SUSPENDED
                  )}
                </dd>
              </>
            ) : null}
          </dl>
        </div>
      ) : null}

      {canReadAudit ? (
        <div className="card">
          <h2>Recent activity</h2>
          <p className="muted" style={{ margin: 0 }}>
            Review recent admin actions in the{" "}
            <Link href="/audit">audit log</Link>.
          </p>
        </div>
      ) : null}
    </>
  );
}

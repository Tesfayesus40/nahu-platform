"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { SimpleBarChart } from "@/components/SimpleBarChart";
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
  const canReadOrders = capabilities.permissions.includes("orders.read");
  const canReadDelivery = capabilities.permissions.includes("delivery.read");
  const canReadPromotions = capabilities.permissions.includes(
    "marketplace.promotions.read",
  );
  const canReadCooperatives = capabilities.permissions.includes(
    "marketplace.cooperatives.read",
  );
  const canReadUsers = capabilities.permissions.includes("identity.users.read");

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

  const sections = summary?.sections;
  const queues = summary?.queues;
  const kpis = summary?.kpis;
  const trends = summary?.trends;

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Live operational analytics across identity, marketplace, and orders"
        actions={
          <div className="action-row">
            <StatusBadge
              status={ENV_LABEL}
              tone={ENV_LABEL === "production" ? "danger" : "neutral"}
            />
            {summary?.asOf ? (
              <span className="muted">
                as of {new Date(summary.asOf).toLocaleString()}
              </span>
            ) : null}
          </div>
        }
      />

      {canReadSummary ? (
        <div className="kpi-row">
          <Kpi
            label="Active users"
            value={kpis?.activeUsers}
            href={canReadUsers ? "/users?status=ACTIVE" : undefined}
          />
          <Kpi
            label="Orders (7d)"
            value={kpis?.ordersLast7d}
          />
          <Kpi
            label="Approved listings"
            value={kpis?.activeApprovedListings}
            href={canReadListings ? "/listings?moderationStatus=APPROVED" : undefined}
          />
          <Kpi
            label="Dispute pressure"
            value={kpis?.disputePressure}
            href={canReadDisputes ? "/disputes?queue=open" : undefined}
          />
          <Kpi
            label="Active promotions"
            value={kpis?.activePromotions}
            href={canReadPromotions ? "/promotions?status=ACTIVE" : undefined}
          />
          <Kpi
            label="Verified coops"
            value={kpis?.verifiedCooperatives}
            href={
              canReadCooperatives ? "/cooperatives?verified=true" : undefined
            }
          />
        </div>
      ) : null}

      {canReadSummary ? (
        <div className="card">
          <h2>Priority queues</h2>
          <dl className="kv">
            <dt>Pending verifications</dt>
            <dd>
              <QueueLink
                value={queues?.pendingVerifications}
                href="/verification?queue=pending"
                allowed={canReadVerification}
              />
            </dd>
            <dt>Listing moderation</dt>
            <dd>
              <QueueLink
                value={queues?.pendingListingModeration}
                href="/listings?queue=pending"
                allowed={canReadListings}
              />
            </dd>
            <dt>Open disputes</dt>
            <dd>
              <QueueLink
                value={queues?.openDisputes}
                href="/disputes?queue=open"
                allowed={canReadDisputes}
              />
            </dd>
            <dt>Locked credentials</dt>
            <dd>
              <QueueLink
                value={queues?.lockedUsers}
                href="/users"
                allowed={canReadUsers}
              />
            </dd>
            <dt>Denied actions (7d)</dt>
            <dd>
              <QueueLink
                value={queues?.recentDeniedActions}
                href="/audit?outcome=DENIED"
                allowed={canReadAudit}
              />
            </dd>
            <dt>Pending payment</dt>
            <dd>
              <QueueLink
                value={queues?.pendingPaymentOrders}
                href="/orders?queue=pending_payment"
                allowed={canReadOrders}
              />
            </dd>
            <dt>Stalled escrow</dt>
            <dd>
              <QueueLink
                value={queues?.stalledEscrowOrders}
                href="/orders?queue=stalled_escrow"
                allowed={canReadOrders}
              />
            </dd>
            <dt>Open fulfillments</dt>
            <dd>
              <QueueLink
                value={queues?.openFulfillments}
                href="/delivery?queue=open"
                allowed={canReadDelivery}
              />
            </dd>
            <dt>Delivery exceptions</dt>
            <dd>
              <QueueLink
                value={queues?.deliveryExceptions}
                href="/delivery?queue=exceptions"
                allowed={canReadDelivery}
              />
            </dd>
          </dl>
        </div>
      ) : null}

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
                <dt>Database</dt>
                <dd>
                  <StatusBadge status={health.dependencies.database} />
                </dd>
                <dt>Version</dt>
                <dd className="mono">{health.version ?? "—"}</dd>
                <dt>Uptime</dt>
                <dd>
                  {typeof health.uptimeSeconds === "number"
                    ? `${Math.floor(health.uptimeSeconds / 60)} min`
                    : "—"}
                </dd>
              </dl>
            ) : (
              <div className="loading">Checking system health…</div>
            )}
            <p style={{ marginTop: 12 }}>
              <Link href="/system" className="table-link">
                Open system administration →
              </Link>
            </p>
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
          </dl>
        </div>

        {sections?.users ? (
          <div className="card">
            <h2>Users</h2>
            <SimpleBarChart
              items={Object.entries(sections.users.byStatus).map(
                ([label, value]) => ({ label, value }),
              )}
            />
            <dl className="kv" style={{ marginTop: 12 }}>
              <dt>Total</dt>
              <dd>{sections.users.total}</dd>
              <dt>Workforce</dt>
              <dd>{sections.users.workforce}</dd>
              <dt>Created 7d / 30d</dt>
              <dd>
                {sections.users.created7d} / {sections.users.created30d}
              </dd>
            </dl>
          </div>
        ) : null}

        {sections?.verification ? (
          <div className="card">
            <h2>Verification</h2>
            <SimpleBarChart
              items={Object.entries(sections.verification.pendingByType).map(
                ([label, value]) => ({ label, value }),
              )}
            />
            <p className="muted" style={{ marginTop: 8 }}>
              Pending total: {sections.verification.pending}
            </p>
          </div>
        ) : null}

        {sections?.listings ? (
          <div className="card">
            <h2>Listings (moderation)</h2>
            <SimpleBarChart
              items={Object.entries(sections.listings.byModeration).map(
                ([label, value]) => ({ label, value }),
              )}
            />
          </div>
        ) : null}

        {sections?.disputes ? (
          <div className="card">
            <h2>Disputes</h2>
            <SimpleBarChart
              items={Object.entries(sections.disputes.byStatus).map(
                ([label, value]) => ({ label, value }),
              )}
            />
          </div>
        ) : null}

        {sections?.marketplace ? (
          <div className="card">
            <h2>Marketplace activity</h2>
            <SimpleBarChart
              items={Object.entries(sections.marketplace.byOrderStatus).map(
                ([label, value]) => ({ label, value }),
              )}
            />
            <dl className="kv" style={{ marginTop: 12 }}>
              <dt>Orders 7d / 30d</dt>
              <dd>
                {sections.marketplace.ordersCreated7d} /{" "}
                {sections.marketplace.ordersCreated30d}
              </dd>
              <dt>Disputed orders</dt>
              <dd>{sections.marketplace.disputedOrders}</dd>
            </dl>
          </div>
        ) : null}

        {sections?.commerce ? (
          <div className="card">
            <h2>Commerce (orders)</h2>
            <SimpleBarChart
              items={Object.entries(sections.commerce.byStatus).map(
                ([label, value]) => ({ label, value }),
              )}
            />
            <dl className="kv" style={{ marginTop: 12 }}>
              <dt>Pending payment</dt>
              <dd>{sections.commerce.pendingPayment}</dd>
              <dt>Stalled escrow</dt>
              <dd>{sections.commerce.stalledEscrow}</dd>
            </dl>
          </div>
        ) : null}

        {sections?.delivery ? (
          <div className="card">
            <h2>Delivery</h2>
            <SimpleBarChart
              items={Object.entries(sections.delivery.byStatus).map(
                ([label, value]) => ({ label, value }),
              )}
            />
            <dl className="kv" style={{ marginTop: 12 }}>
              <dt>Open</dt>
              <dd>{sections.delivery.open}</dd>
              <dt>Exceptions</dt>
              <dd>{sections.delivery.exceptions}</dd>
            </dl>
          </div>
        ) : null}

        {sections?.promotions ? (
          <div className="card">
            <h2>Promotions</h2>
            <SimpleBarChart
              items={Object.entries(sections.promotions.byStatus).map(
                ([label, value]) => ({ label, value }),
              )}
            />
            <p className="muted" style={{ marginTop: 8 }}>
              Not applied at checkout yet.
            </p>
          </div>
        ) : null}

        {sections?.cooperatives ? (
          <div className="card">
            <h2>Cooperatives</h2>
            <dl className="kv">
              <dt>Total</dt>
              <dd>{sections.cooperatives.total}</dd>
              <dt>Verified</dt>
              <dd>{sections.cooperatives.verified}</dd>
            </dl>
          </div>
        ) : null}

        {sections?.security ? (
          <div className="card">
            <h2>Security (7d)</h2>
            <SimpleBarChart
              items={Object.entries(sections.security.byOutcome7d).map(
                ([label, value]) => ({ label, value }),
              )}
            />
          </div>
        ) : null}
      </div>

      {trends ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Trends ({summary?.trendDays ?? 14} days)</h2>
          <div className="trend-grid">
            <TrendBlock title="Orders created" points={trends.ordersCreated} />
            {trends.usersCreated.length ? (
              <TrendBlock title="Users created" points={trends.usersCreated} />
            ) : null}
            {trends.disputesOpened.length ? (
              <TrendBlock
                title="Disputes opened"
                points={trends.disputesOpened}
              />
            ) : null}
            {trends.verificationsSubmitted.length ? (
              <TrendBlock
                title="Verifications submitted"
                points={trends.verificationsSubmitted}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function Kpi({
  label,
  value,
  href,
}: {
  label: string;
  value: number | null | undefined;
  href?: string;
}) {
  const display = typeof value === "number" ? value : "—";
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {href && typeof value === "number" ? (
          <Link href={href} className="table-link">
            {display}
          </Link>
        ) : (
          display
        )}
      </div>
    </div>
  );
}

function QueueLink({
  value,
  href,
  allowed,
}: {
  value: number | null | undefined;
  href: string;
  allowed: boolean;
}) {
  if (typeof value !== "number") return <>—</>;
  if (!allowed) return <>{value}</>;
  return (
    <Link href={href} className="table-link">
      {value}
    </Link>
  );
}

function TrendBlock({
  title,
  points,
}: {
  title: string;
  points: Array<{ date: string; count: number }>;
}) {
  const max = Math.max(1, ...points.map((p) => p.count));
  const total = points.reduce((a, p) => a + p.count, 0);
  return (
    <div className="trend-block">
      <div className="trend-title">
        {title} <span className="muted">Σ {total}</span>
      </div>
      <div className="sparkline" aria-hidden>
        {points.map((p) => (
          <span
            key={p.date}
            title={`${p.date}: ${p.count}`}
            style={{ height: `${Math.max(4, (p.count / max) * 100)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

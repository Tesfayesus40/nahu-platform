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
          <h2>Operational queues (A2+)</h2>
          <p className="muted" style={{ margin: "0 0 12px" }}>
            {summary?.message ??
              "Operational queues and domain KPIs arrive in A2+."}
          </p>
          <dl className="kv">
            <dt>Pending verifications</dt>
            <dd>{summary?.placeholders.pendingVerifications ?? "—"}</dd>
            <dt>Open disputes</dt>
            <dd>{summary?.placeholders.openDisputes ?? "—"}</dd>
            <dt>Active listings</dt>
            <dd>{summary?.placeholders.activeListings ?? "—"}</dd>
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

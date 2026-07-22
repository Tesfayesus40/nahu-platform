"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmActionModal } from "@/components/ConfirmActionModal";
import { usePortal } from "@/components/PortalShell";
import { bffGet, bffPatch, bffPost, type BffError } from "@/lib/client";
import type { SystemHealthResponse, SystemOverviewResponse } from "@/lib/types";

type Invitation = {
  id: string;
  email: string;
  phone: string | null;
  roleCodes: string[];
  status: string;
  expiresAt: string;
  createdAt: string;
};

export default function SystemPage() {
  const { capabilities } = usePortal();
  const canHealth = capabilities.permissions.includes(
    "admin.system.health.read",
  );
  const canConfig = capabilities.permissions.includes(
    "admin.system.config.read",
  );
  const canWrite = capabilities.permissions.includes(
    "admin.system.config.write",
  );
  const canInvite = capabilities.permissions.includes("identity.users.invite");

  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [overview, setOverview] = useState<SystemOverviewResponse | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flagId, setFlagId] = useState<string | null>(null);
  const [flagEnabled, setFlagEnabled] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (canHealth) {
        setHealth(await bffGet<SystemHealthResponse>("/api/system/health"));
      }
      if (canConfig) {
        setOverview(
          await bffGet<SystemOverviewResponse>("/api/system/overview"),
        );
      }
      if (canInvite) {
        const inv = await bffGet<{ items: Invitation[] }>(
          "/api/auth/invitations",
        );
        setInvitations(inv.items);
      }
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setLoading(false);
    }
  }, [canHealth, canConfig, canInvite]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFlag(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    if (!flagId) return;
    await bffPatch(`/api/system/feature-flags/${flagId}`, {
      enabled: flagEnabled,
      reauthPassword: input.reauthPassword,
      reason: input.reason,
    });
    setFlash(`Feature flag updated.`);
    await load();
  }

  async function revokeInvite(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    if (!revokeId) return;
    await bffPost(`/api/auth/invitations/${revokeId}/revoke`, {
      reauthPassword: input.reauthPassword,
      reason: input.reason,
    });
    setFlash("Invitation revoked.");
    await load();
  }

  return (
    <>
      <PageHeader
        title="System administration"
        subtitle="Health, release metadata, feature flags, and invitations"
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {flash ? <p className="flash-ok">{flash}</p> : null}
      {error ? <div className="form-error">{error}</div> : null}

      {health ? (
        <div className="card">
          <h2>API health</h2>
          <dl className="kv">
            <dt>Overall</dt>
            <dd>
              <StatusBadge status={health.status} />
            </dd>
            <dt>Service</dt>
            <dd>{health.service}</dd>
            <dt>Database</dt>
            <dd>
              <StatusBadge status={health.dependencies.database} />
            </dd>
            <dt>Version</dt>
            <dd className="mono">{health.version ?? "—"}</dd>
            <dt>Node env</dt>
            <dd>{health.nodeEnv ?? "—"}</dd>
            <dt>Uptime</dt>
            <dd>
              {typeof health.uptimeSeconds === "number"
                ? `${health.uptimeSeconds}s`
                : "—"}
            </dd>
            <dt>Last checked</dt>
            <dd>{new Date(health.timestamp).toLocaleString()}</dd>
          </dl>
        </div>
      ) : !error && canHealth ? (
        <div className="loading">Checking system health…</div>
      ) : null}

      {overview ? (
        <div className="card-grid" style={{ marginTop: 16 }}>
          <div className="card">
            <h2>Operations snapshot</h2>
            <dl className="kv">
              <dt>Active admin sessions</dt>
              <dd>{overview.activeAdminSessions}</dd>
              <dt>Pending invitations</dt>
              <dd>{overview.pendingInvitations}</dd>
              <dt>Migrations applied</dt>
              <dd>{overview.migrations.appliedCount}</dd>
              <dt>Latest migration</dt>
              <dd className="mono">
                {overview.migrations.latestFilename ?? "—"}
              </dd>
            </dl>
          </div>

          <div className="card">
            <h2>Feature flags</h2>
            {overview.featureFlags.length === 0 ? (
              <p className="muted">No flags seeded.</p>
            ) : (
              <ul className="flag-list">
                {overview.featureFlags.map((f) => (
                  <li key={f.id}>
                    <div>
                      <strong>{f.displayName}</strong>
                      <div className="muted mono">{f.code}</div>
                      <div className="muted">{f.description}</div>
                    </div>
                    <div className="action-row">
                      <StatusBadge
                        status={f.enabled ? "ENABLED" : "DISABLED"}
                      />
                      {canWrite ? (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setFlagId(f.id);
                            setFlagEnabled(!f.enabled);
                          }}
                        >
                          {f.enabled ? "Disable" : "Enable"}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {canInvite ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Admin invitations</h2>
          {invitations.length === 0 ? (
            <p className="muted">No invitations found.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id}>
                    <td>{inv.email}</td>
                    <td>{inv.roleCodes.join(", ")}</td>
                    <td>
                      <StatusBadge status={inv.status} />
                    </td>
                    <td>{new Date(inv.expiresAt).toLocaleString()}</td>
                    <td>
                      {inv.status === "PENDING" ? (
                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => setRevokeId(inv.id)}
                        >
                          Revoke
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      <ConfirmActionModal
        open={Boolean(flagId)}
        title={flagEnabled ? "Enable feature flag" : "Disable feature flag"}
        requireReason
        confirmLabel="Confirm"
        onClose={() => setFlagId(null)}
        onConfirm={toggleFlag}
      />

      <ConfirmActionModal
        open={Boolean(revokeId)}
        title="Revoke invitation"
        requireReason
        danger
        confirmLabel="Revoke"
        onClose={() => setRevokeId(null)}
        onConfirm={revokeInvite}
      />
    </>
  );
}

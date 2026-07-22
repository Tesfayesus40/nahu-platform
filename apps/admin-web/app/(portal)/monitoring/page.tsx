"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { usePortal } from "@/components/PortalShell";
import { bffGet, bffPost, type BffError } from "@/lib/client";
import type { MonitoringSnapshotResponse } from "@/lib/types";

export default function MonitoringPage() {
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("monitoring.read");
  const [data, setData] = useState<MonitoringSnapshotResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [emitting, setEmitting] = useState(false);

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      setData(await bffGet<MonitoringSnapshotResponse>(`/api/monitoring`));
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setLoading(false);
    }
  }, [canRead]);

  useEffect(() => {
    void load();
  }, [load]);

  async function emitNotices() {
    setEmitting(true);
    setError(null);
    try {
      setData(
        await bffPost<MonitoringSnapshotResponse>(
          "/api/monitoring/emit-notices",
        ),
      );
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setEmitting(false);
    }
  }

  if (!canRead) {
    return <p className="form-error">Missing monitoring.read permission.</p>;
  }

  return (
    <>
      <PageHeader
        title="Platform monitoring"
        subtitle="Live health, metrics, and alert threshold evaluation"
        actions={
          <div className="action-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void emitNotices()}
              disabled={loading || emitting}
            >
              {emitting ? "Emitting…" : "Emit alert notices"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
            <Link className="btn btn-secondary" href="/system">
              System
            </Link>
          </div>
        }
      />

      {error ? <div className="form-error">{error}</div> : null}

      {data ? (
        <>
          <div className="kpi-row">
            <div className="kpi">
              <div className="kpi-label">Health</div>
              <div className="kpi-value">
                <StatusBadge status={data.health.status} />
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Alert breaches</div>
              <div className="kpi-value">{data.summary.breachCount}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Critical</div>
              <div className="kpi-value">{data.summary.criticalCount}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">OK</div>
              <div className="kpi-value">{data.summary.okCount}</div>
            </div>
          </div>

          <div className="card-grid">
            <div className="card">
              <h2>API health</h2>
              <dl className="kv">
                <dt>Database</dt>
                <dd>
                  <StatusBadge status={data.health.dependencies.database} />
                </dd>
                <dt>Version</dt>
                <dd className="mono">{data.health.version ?? "—"}</dd>
                <dt>Uptime</dt>
                <dd>
                  {typeof data.health.uptimeSeconds === "number"
                    ? `${data.health.uptimeSeconds}s`
                    : "—"}
                </dd>
                <dt>As of</dt>
                <dd>{new Date(data.asOf).toLocaleString()}</dd>
              </dl>
            </div>

            <div className="card">
              <h2>Live metrics</h2>
              <dl className="kv">
                {Object.entries(data.metrics).map(([key, value]) => (
                  <div key={key} style={{ display: "contents" }}>
                    <dt className="mono">{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <p className="muted" style={{ marginTop: 12 }}>
                {data.extensibility}
              </p>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h2>Alert thresholds</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Alert</th>
                  <th>Metric</th>
                  <th>Value</th>
                  <th>Warn / Critical</th>
                  <th>Level</th>
                </tr>
              </thead>
              <tbody>
                {data.alerts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.displayName}</strong>
                      <div className="muted mono">{a.code}</div>
                    </td>
                    <td className="mono">{a.metricKey}</td>
                    <td>{a.value}</td>
                    <td>
                      {a.warnAbove ?? "—"} / {a.criticalAbove ?? "—"}
                    </td>
                    <td>
                      <StatusBadge status={a.level} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : !error ? (
        <div className="loading">Loading monitoring snapshot…</div>
      ) : null}
    </>
  );
}

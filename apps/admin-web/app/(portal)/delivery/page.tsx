"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { OpsAlertsPanel } from "@/components/delivery/OpsAlertsPanel";
import { usePortal } from "@/components/PortalShell";
import { bffGet, type BffError } from "@/lib/client";
import type { DeliveryOpsMetrics } from "@/lib/types";

const BUCKET_LINKS: Array<{ key: string; label: string }> = [
  { key: "AWAITING_ASSIGNMENT", label: "Awaiting assignment" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "IN_TRANSIT", label: "In transit" },
  { key: "ARRIVED", label: "Arrived" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "BUYER_CONFIRMATION_PENDING", label: "Buyer confirmation" },
  { key: "COMPLETED", label: "Completed" },
  { key: "FAILED", label: "Failed" },
  { key: "RETURNED", label: "Returned" },
  { key: "CANCELLED", label: "Cancelled" },
];

export default function DeliveryOpsDashboardPage() {
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("delivery.read");
  const [data, setData] = useState<DeliveryOpsMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await bffGet<DeliveryOpsMetrics>("/api/delivery/ops/metrics"));
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canRead) void load();
    else setLoading(false);
  }, [canRead, load]);

  if (!canRead) {
    return (
      <div>
        <PageHeader title="Delivery ops" subtitle="delivery.read required" />
        <p className="form-error">Missing permission.</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Delivery operations"
        subtitle="Operational readiness — status counts, ShipmentEvent today, SLA delays, courier utilization."
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => void load()}>
            Refresh
          </button>
        }
      />

      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Loading metrics…</p> : null}

      {data ? (
        <>
          <div className="kpi-row">
            <div className="kpi-card">
              <div className="kpi-label">Assignment backlog</div>
              <div className="kpi-value">{data.assignmentBacklog ?? data.awaitingAssignment}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Active deliveries</div>
              <div className="kpi-value">{data.activeDeliveries}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Delayed in-transit</div>
              <div className="kpi-value">{data.delayedInTransit ?? 0}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                &gt;{data.sla?.inTransitHours ?? 24}h
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Delayed POD-pending</div>
              <div className="kpi-value">{data.delayedPodPending ?? 0}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                &gt;{data.sla?.podPendingHours ?? 12}h
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Open failed</div>
              <div className="kpi-value">{data.openFailed ?? data.failedToday}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Open returned</div>
              <div className="kpi-value">{data.openReturned ?? data.returnedToday}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Completed today</div>
              <div className="kpi-value">{data.completedToday}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Courier busy %</div>
              <div className="kpi-value">
                {data.courierUtilization.busyRate ?? "—"}
              </div>
            </div>
          </div>

          {data.alerts ? <OpsAlertsPanel alerts={data.alerts} /> : null}

          <div className="card" style={{ marginTop: 16 }}>
            <h2>Shipment status summaries</h2>
            <div className="queue-tabs" style={{ flexWrap: "wrap" }}>
              {BUCKET_LINKS.map((b) => (
                <Link
                  key={b.key}
                  href={`/delivery/shipments?bucket=${b.key}`}
                  className="btn btn-secondary sort-chip"
                >
                  {b.label} ({data.buckets[b.key] ?? 0})
                </Link>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h2>Courier utilization</h2>
            <dl className="kv">
              <dt>Online</dt>
              <dd>
                {data.courierUtilization.onlineCouriers} /{" "}
                {data.courierUtilization.totalActiveCouriers} (
                {data.courierUtilization.onlineRate ?? "—"}%)
              </dd>
              <dt>With active shipments</dt>
              <dd>{data.courierUtilization.couriersWithActiveShipments}</dd>
              <dt>Max active / courier</dt>
              <dd>
                {data.courierUtilization.maxActiveShipmentsPerCourier ?? "—"}
              </dd>
              <dt>Avg duration (min)</dt>
              <dd>{data.averageDeliveryDurationMin ?? "—"}</dd>
              <dt>Health</dt>
              <dd>
                {data.health
                  ? `${data.health.criticalCount} critical · ${data.health.warnCount} warn`
                  : "—"}
              </dd>
            </dl>
            <Link href="/delivery/couriers" className="btn btn-secondary">
              Courier workload →
            </Link>
          </div>

          <p className="muted" style={{ marginTop: 12 }}>
            As of {new Date(data.asOf).toLocaleString()} · today from{" "}
            {new Date(data.dayStart).toLocaleDateString()} UTC · completed today
            counts ShipmentEvent <code>delivery.shipment.completed</code> only
          </p>
        </>
      ) : null}
    </div>
  );
}

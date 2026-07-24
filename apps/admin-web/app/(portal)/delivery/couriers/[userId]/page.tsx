"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { usePortal } from "@/components/PortalShell";
import { bffGet, type BffError } from "@/lib/client";
import type { CourierOpsDetail } from "@/lib/types";

export default function CourierDetailPage() {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("delivery.read");

  const [detail, setDetail] = useState<CourierOpsDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(
        await bffGet<CourierOpsDetail>(`/api/delivery/couriers/${userId}`),
      );
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (canRead) void load();
    else {
      setLoading(false);
      setError("Missing delivery.read");
    }
  }, [canRead, load]);

  if (loading) return <p className="muted">Loading courier…</p>;
  if (error && !detail) {
    return (
      <div>
        <PageHeader title="Courier" />
        <p className="form-error">{error}</p>
        <Link href="/delivery/couriers" className="btn btn-secondary">
          Back
        </Link>
      </div>
    );
  }
  if (!detail) return null;

  return (
    <div>
      <PageHeader
        title={detail.displayName ?? `Courier ${detail.userId.slice(0, 8)}…`}
        subtitle={detail.availabilityUi}
        actions={
          <Link href="/delivery/couriers" className="btn btn-secondary">
            Back to couriers
          </Link>
        }
      />

      <div className="card-grid">
        <div className="card">
          <h2>Profile</h2>
          <dl className="kv">
            <dt>Availability</dt>
            <dd>
              <StatusBadge status={detail.availabilityUi} /> ({detail.availability})
            </dd>
            <dt>Active</dt>
            <dd>{detail.active ? "Yes" : "No"}</dd>
            <dt>Verified</dt>
            <dd>{detail.verified ? "Yes" : "No"}</dd>
            <dt>Phone</dt>
            <dd>{detail.phone ?? "—"}</dd>
            <dt>Vehicle</dt>
            <dd>{detail.vehicleType ?? "—"}</dd>
            <dt>Regions</dt>
            <dd>
              {detail.serviceRegions?.length
                ? detail.serviceRegions.join(", ")
                : "—"}
            </dd>
            <dt>Workload</dt>
            <dd>{detail.activeWorkload}</dd>
            <dt>Completed</dt>
            <dd>{detail.completedCount ?? detail.completedDeliveries}</dd>
          </dl>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Assigned / active shipments</h2>
        {!detail.assignedShipments?.length ? (
          <p className="muted">No active shipments.</p>
        ) : (
          <ul>
            {detail.assignedShipments.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/delivery/shipments/${s.id}`}
                  className="table-link"
                >
                  {s.id.slice(0, 8)}…
                </Link>{" "}
                <StatusBadge status={s.currentStatus} /> ·{" "}
                {s.deliveryZone ?? "—"}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Recent completed</h2>
        {!detail.recentCompleted?.length ? (
          <p className="muted">No completed deliveries listed.</p>
        ) : (
          <ul>
            {detail.recentCompleted.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/delivery/shipments/${s.id}`}
                  className="table-link"
                >
                  {s.id.slice(0, 8)}…
                </Link>{" "}
                {s.completedAt
                  ? new Date(s.completedAt).toLocaleString()
                  : "—"}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Recent assignments</h2>
        {!detail.recentAssignments?.length ? (
          <p className="muted">No assignment history.</p>
        ) : (
          <ul>
            {detail.recentAssignments.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/delivery/shipments/${a.shipmentId}`}
                  className="table-link"
                >
                  {a.shipmentId.slice(0, 8)}…
                </Link>{" "}
                {a.isActive ? <StatusBadge status="ACTIVE" /> : null} ·{" "}
                {new Date(a.assignedAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

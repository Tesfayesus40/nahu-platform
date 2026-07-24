"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmActionModal } from "@/components/ConfirmActionModal";
import { ShipmentProgress } from "@/components/delivery/ShipmentProgress";
import { ShipmentTimeline } from "@/components/delivery/ShipmentTimeline";
import { CourierSummaryCard } from "@/components/delivery/CourierSummaryCard";
import { usePortal } from "@/components/PortalShell";
import { bffGet, bffPost, type BffError } from "@/lib/client";
import type { ShipmentOpsDetail } from "@/lib/types";

type OpsAction =
  | "release"
  | "assign"
  | "reassign"
  | "unassign"
  | "cancel"
  | "retry"
  | null;

export default function ShipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("delivery.read");
  const canManage = capabilities.permissions.includes("delivery.manage");

  const [detail, setDetail] = useState<ShipmentOpsDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [action, setAction] = useState<OpsAction>(null);
  const [courierUserId, setCourierUserId] = useState("");
  const [candidates, setCandidates] = useState<
    Array<{ userId: string; score: number }>
  >([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bffGet<ShipmentOpsDetail>(
        `/api/delivery/shipments/${id}`,
      );
      setDetail(data);
      setCourierUserId(data.courierUserId ?? "");
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (canRead) void load();
    else {
      setLoading(false);
      setError("Missing delivery.read");
    }
  }, [canRead, load]);

  async function loadCandidates() {
    try {
      const res = await bffGet<{
        candidates: Array<{ userId: string; score: number }>;
      }>(`/api/delivery/shipments/${id}/courier-candidates`);
      setCandidates(res.candidates ?? []);
    } catch {
      setCandidates([]);
    }
  }

  async function runAction(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    if (!action) return;
    const body: Record<string, unknown> = {
      reauthPassword: input.reauthPassword,
      reason: input.reason,
    };
    if (
      (action === "assign" || action === "reassign") &&
      courierUserId.trim()
    ) {
      body.courierUserId = courierUserId.trim();
    }
    await bffPost(`/api/delivery/shipments/${id}/${action}`, body);
    setFlash(`Action recorded: ${action}`);
    setAction(null);
    await load();
  }

  if (loading) return <p className="muted">Loading shipment…</p>;
  if (error && !detail) {
    return (
      <div>
        <PageHeader title="Shipment" />
        <p className="form-error">{error}</p>
        <Link href="/delivery/shipments" className="btn btn-secondary">
          Back
        </Link>
      </div>
    );
  }
  if (!detail) return null;

  const a = detail.actions;

  return (
    <div>
      <PageHeader
        title={`Shipment ${detail.id.slice(0, 8)}…`}
        subtitle={detail.currentStatus}
        actions={
          <Link href="/delivery/shipments" className="btn btn-secondary">
            Back to shipments
          </Link>
        }
      />

      {flash ? <p className="flash-ok">{flash}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Progress</h2>
        <ShipmentProgress status={detail.currentStatus} />
      </div>

      <div className="card-grid">
        <div className="card">
          <h2>Summary</h2>
          <dl className="kv">
            <dt>Status</dt>
            <dd>
              <StatusBadge status={detail.currentStatus} />
            </dd>
            <dt>Bucket</dt>
            <dd>{detail.bucket?.replaceAll("_", " ") ?? "—"}</dd>
            <dt>Type</dt>
            <dd>{detail.shipmentType}</dd>
            <dt>Zone</dt>
            <dd>{detail.deliveryZone ?? "—"}</dd>
            <dt>Notes</dt>
            <dd>{detail.notes ?? "—"}</dd>
            <dt>Updated</dt>
            <dd>{new Date(detail.updatedAt).toLocaleString()}</dd>
          </dl>
        </div>

        <div className="card">
          <h2>Fulfillment case</h2>
          {detail.fulfillment ? (
            <dl className="kv">
              <dt>Case</dt>
              <dd>
                <Link
                  href={`/delivery/fulfillments/${detail.fulfillment.id}`}
                  className="table-link"
                >
                  {detail.fulfillment.id.slice(0, 8)}…
                </Link>
              </dd>
              <dt>Status</dt>
              <dd>
                <StatusBadge status={detail.fulfillment.status} />
              </dd>
              <dt>Order</dt>
              <dd>
                <Link
                  href={`/orders/${detail.fulfillment.orderId}`}
                  className="table-link"
                >
                  {detail.fulfillment.orderId.slice(0, 8)}…
                </Link>
              </dd>
              <dt>Tracking</dt>
              <dd className="mono">
                {detail.fulfillment.trackingRef ?? "—"}
              </dd>
            </dl>
          ) : (
            <p className="muted">No fulfillment linked.</p>
          )}
        </div>

        <CourierSummaryCard courier={detail.courier} />
      </div>

      {canManage ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Manual operations</h2>
          <p className="muted">
            Assign/reassign/unassign/release call DispatchService. Cancel/retry
            call AdminOpsService → ShipmentAggregateService.
          </p>
          <div style={{ maxWidth: 420, marginBottom: 12 }}>
            <label className="field">
              Courier user ID (optional for auto-select)
              <input
                value={courierUserId}
                onChange={(e) => setCourierUserId(e.target.value)}
                placeholder="UUID"
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ marginTop: 8 }}
              onClick={() => void loadCandidates()}
            >
              Load candidates
            </button>
            {candidates.length ? (
              <ul className="muted" style={{ marginTop: 8 }}>
                {candidates.slice(0, 5).map((c) => (
                  <li key={c.userId}>
                    <button
                      type="button"
                      className="table-link"
                      onClick={() => setCourierUserId(c.userId)}
                    >
                      {c.userId.slice(0, 8)}… (score {c.score})
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="action-row" style={{ flexWrap: "wrap", gap: 8 }}>
            {a.canRelease ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAction("release")}
              >
                Release
              </button>
            ) : null}
            {a.canAssign ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setAction("assign")}
              >
                Assign
              </button>
            ) : null}
            {a.canReassign ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAction("reassign")}
              >
                Reassign
              </button>
            ) : null}
            {a.canUnassign ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAction("unassign")}
              >
                Unassign
              </button>
            ) : null}
            {a.canRetry ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setAction("retry")}
              >
                Retry failed
              </button>
            ) : null}
            {a.canCancel ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => setAction("cancel")}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Stops</h2>
        {!detail.stops.length ? (
          <p className="muted">No stops.</p>
        ) : (
          <ul>
            {detail.stops.map((st) => (
              <li key={st.id}>
                #{st.sequence} {st.stopType} ·{" "}
                <StatusBadge status={st.status} /> ·{" "}
                {st.addressText ?? "No address"}
                {st.contactPhone ? ` · ${st.contactPhone}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Assignment history</h2>
        {!detail.assignmentHistory.length ? (
          <p className="muted">No assignments.</p>
        ) : (
          <ul>
            {detail.assignmentHistory.map((as) => (
              <li key={as.id}>
                <Link
                  href={`/delivery/couriers/${as.courierUserId}`}
                  className="table-link"
                >
                  {as.courierUserId.slice(0, 8)}…
                </Link>{" "}
                {as.isActive ? <StatusBadge status="ACTIVE" /> : null} ·{" "}
                {new Date(as.assignedAt).toLocaleString()}
                {as.acceptedAt ? " · accepted" : ""}
                {as.rejectedAt ? " · rejected" : ""}
                {as.cancelledAt ? " · cancelled" : ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Proof of Delivery (read-only)</h2>
        {!detail.pods?.length ? (
          <p className="muted">No POD captured yet.</p>
        ) : (
          <ul>
            {detail.pods.map((p) => (
              <li key={p.id} style={{ marginBottom: 12 }}>
                <div>
                  <strong>{p.method}</strong> ·{" "}
                  {new Date(p.capturedAt).toLocaleString()}
                </div>
                <div className="muted">
                  Recipient: {p.recipientName ?? "—"} · OTP:{" "}
                  {p.otpVerified ? "verified" : "not verified"}
                  {p.otpVerifiedAt
                    ? ` (${new Date(p.otpVerifiedAt).toLocaleString()})`
                    : ""}
                </div>
                <div className="muted">
                  Photo: {p.hasPhoto ? "available" : "none"}
                  {p.photoUrl ? (
                    <>
                      {" "}
                      ·{" "}
                      <a href={p.photoUrl} target="_blank" rel="noreferrer">
                        open
                      </a>
                    </>
                  ) : null}{" "}
                  · GPS:{" "}
                  {p.gps
                    ? `${p.gps.lat.toFixed(5)}, ${p.gps.lng.toFixed(5)}`
                    : "—"}
                </div>
                {p.notes ? <div>Notes: {p.notes}</div> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Timeline (ShipmentEvent)</h2>
        <ShipmentTimeline events={detail.timeline} />
      </div>

      <ConfirmActionModal
        open={Boolean(action)}
        title={action ? action.toUpperCase() : ""}
        description={
          action === "assign" || action === "reassign"
            ? courierUserId.trim()
              ? `Courier ${courierUserId.trim().slice(0, 8)}…`
              : "Auto-select best ONLINE courier."
            : undefined
        }
        requireReason={action === "cancel" || action === "retry"}
        danger={action === "cancel"}
        confirmLabel="Confirm"
        onClose={() => setAction(null)}
        onConfirm={runAction}
      />
    </div>
  );
}

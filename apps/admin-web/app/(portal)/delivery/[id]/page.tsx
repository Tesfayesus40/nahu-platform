"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmActionModal } from "@/components/ConfirmActionModal";
import { usePortal } from "@/components/PortalShell";
import { bffGet, bffPost, type BffError } from "@/lib/client";
import type { FulfillmentDetail } from "@/lib/types";

type Action =
  | "MARK_READY"
  | "MARK_IN_TRANSIT"
  | "MARK_DELIVERED"
  | "RAISE_EXCEPTION"
  | "CLOSE"
  | "UPDATE_LOGISTICS"
  | null;

export default function DeliveryDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("delivery.read");
  const canManage = capabilities.permissions.includes("delivery.manage");

  const [detail, setDetail] = useState<FulfillmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [carrierCode, setCarrierCode] = useState("");
  const [trackingRef, setTrackingRef] = useState("");
  const [exceptionCode, setExceptionCode] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bffGet<FulfillmentDetail>(
        `/api/delivery/fulfillments/${id}`,
      );
      setDetail(data);
      setCarrierCode(data.carrierCode ?? "");
      setTrackingRef(data.trackingRef ?? "");
      setExceptionCode(data.exceptionCode ?? "");
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

  async function runAction(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    if (!action) return;
    const body: Record<string, unknown> = {
      action,
      reauthPassword: input.reauthPassword,
      reason: input.reason,
    };
    if (action === "UPDATE_LOGISTICS" || action === "MARK_IN_TRANSIT") {
      body.carrierCode = carrierCode.trim() || undefined;
      body.trackingRef = trackingRef.trim() || undefined;
    }
    if (action === "RAISE_EXCEPTION") {
      body.exceptionCode = exceptionCode.trim() || "MANUAL";
    }
    await bffPost(`/api/delivery/fulfillments/${id}/actions`, body);
    setFlash(`Action recorded: ${action}`);
    await load();
  }

  if (loading) return <p className="muted">Loading fulfillment…</p>;
  if (error && !detail) {
    return (
      <div>
        <PageHeader title="Fulfillment" />
        <p className="form-error">{error}</p>
        <Link href="/delivery" className="btn btn-secondary">
          Back
        </Link>
      </div>
    );
  }
  if (!detail) return null;

  const buyer = detail.order.buyer;
  const seller = detail.order.farmer?.user;
  const buyerLabel =
    [buyer?.firstName, buyer?.lastName].filter(Boolean).join(" ") ||
    buyer?.phone ||
    "—";
  const sellerLabel =
    [seller?.firstName, seller?.lastName].filter(Boolean).join(" ") ||
    seller?.phone ||
    "—";

  return (
    <div>
      <PageHeader
        title={`Fulfillment ${detail.id.slice(0, 8)}…`}
        subtitle={detail.status}
        actions={
          <Link href="/delivery" className="btn btn-secondary">
            Back to queue
          </Link>
        }
      />

      {flash ? <p className="flash-ok">{flash}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="card-grid">
        <div className="card">
          <h2>Case</h2>
          <dl className="kv">
            <dt>Status</dt>
            <dd>
              <StatusBadge status={detail.status} />
            </dd>
            <dt>Order</dt>
            <dd>
              <Link href={`/orders/${detail.orderId}`} className="table-link">
                {detail.orderId.slice(0, 8)}… · {detail.order.status}
              </Link>
            </dd>
            <dt>Address</dt>
            <dd>{detail.order.deliveryAddress}</dd>
            <dt>Assigned</dt>
            <dd>{detail.assignedToUserId ?? "—"}</dd>
            <dt>Updated</dt>
            <dd>{new Date(detail.updatedAt).toLocaleString()}</dd>
          </dl>
        </div>

        <div className="card">
          <h2>Logistics</h2>
          <dl className="kv">
            <dt>Carrier</dt>
            <dd>{detail.carrierCode ?? "—"}</dd>
            <dt>Tracking</dt>
            <dd className="mono">{detail.trackingRef ?? "—"}</dd>
            <dt>Pickup notes</dt>
            <dd>{detail.pickupNotes ?? "—"}</dd>
            <dt>Delivery notes</dt>
            <dd>{detail.deliveryNotes ?? "—"}</dd>
            <dt>Exception</dt>
            <dd>
              {detail.exceptionCode ?? "—"}
              {detail.exceptionNotes ? (
                <>
                  <br />
                  <span className="muted">{detail.exceptionNotes}</span>
                </>
              ) : null}
            </dd>
          </dl>
        </div>

        <div className="card">
          <h2>Parties</h2>
          <dl className="kv">
            <dt>Buyer</dt>
            <dd>{buyerLabel}</dd>
            <dt>Seller</dt>
            <dd>{sellerLabel}</dd>
            <dt>Total</dt>
            <dd>{String(detail.order.totalEtb)} ETB</dd>
          </dl>
        </div>
      </div>

      {canManage ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Actions</h2>
          <div className="action-row" style={{ flexWrap: "wrap", gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAction("MARK_READY")}
            >
              Mark ready
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAction("MARK_IN_TRANSIT")}
            >
              Mark in transit
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAction("MARK_DELIVERED")}
            >
              Mark delivered
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setAction("RAISE_EXCEPTION")}
            >
              Raise exception
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAction("CLOSE")}
            >
              Close
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAction("UPDATE_LOGISTICS")}
            >
              Update logistics
            </button>
          </div>
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gap: 8,
              maxWidth: 420,
            }}
          >
            <label className="field">
              Carrier code
              <input
                value={carrierCode}
                onChange={(e) => setCarrierCode(e.target.value)}
              />
            </label>
            <label className="field">
              Tracking ref
              <input
                value={trackingRef}
                onChange={(e) => setTrackingRef(e.target.value)}
              />
            </label>
            <label className="field">
              Exception code
              <input
                value={exceptionCode}
                onChange={(e) => setExceptionCode(e.target.value)}
                placeholder="MANUAL"
              />
            </label>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Events</h2>
        {!detail.events?.length ? (
          <p className="muted">No events yet.</p>
        ) : (
          <ul className="timeline-list">
            {detail.events.map((e) => (
              <li key={e.id}>
                <strong>{e.eventType}</strong>{" "}
                <StatusBadge status={e.toStatus ?? e.fromStatus ?? "—"} />
                <div className="muted">
                  {new Date(e.createdAt).toLocaleString()}
                  {e.message ? ` · ${e.message}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmActionModal
        open={Boolean(action)}
        title={action ? action.replaceAll("_", " ") : ""}
        description={
          action === "UPDATE_LOGISTICS" || action === "MARK_IN_TRANSIT"
            ? "Carrier and tracking from the fields above will be sent."
            : action === "RAISE_EXCEPTION"
              ? "Exception code from the field above will be sent."
              : undefined
        }
        requireReason={
          action === "RAISE_EXCEPTION" || action === "CLOSE"
        }
        danger={action === "RAISE_EXCEPTION" || action === "CLOSE"}
        confirmLabel="Confirm"
        onClose={() => setAction(null)}
        onConfirm={runAction}
      />
    </div>
  );
}

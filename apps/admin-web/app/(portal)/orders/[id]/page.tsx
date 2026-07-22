"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmActionModal } from "@/components/ConfirmActionModal";
import { usePortal } from "@/components/PortalShell";
import { bffGet, bffPost, type BffError } from "@/lib/client";
import type { OrderDetail } from "@/lib/types";

type Action =
  | "CONFIRM_PAYMENT_SIMULATION"
  | "CANCEL_UNPAID"
  | "START_FULFILLMENT"
  | "MARK_SHIPPED"
  | "MARK_DELIVERED"
  | "COMPLETE_ORDER"
  | null;

const ACTIONS: Array<{ action: NonNullable<Action>; label: string; danger?: boolean }> = [
  { action: "CONFIRM_PAYMENT_SIMULATION", label: "Confirm payment (sim)" },
  { action: "CANCEL_UNPAID", label: "Cancel unpaid", danger: true },
  { action: "START_FULFILLMENT", label: "Start fulfillment" },
  { action: "MARK_SHIPPED", label: "Mark shipped" },
  { action: "MARK_DELIVERED", label: "Mark delivered" },
  { action: "COMPLETE_ORDER", label: "Complete order" },
];

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("orders.read");
  const canTransition = capabilities.permissions.includes("orders.transition");

  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [noteOpen, setNoteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await bffGet<OrderDetail>(`/api/orders/${id}`));
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
      setError("Missing orders.read");
    }
  }, [canRead, load]);

  async function runAction(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    if (!action) return;
    await bffPost(`/api/orders/${id}/actions`, {
      action,
      reauthPassword: input.reauthPassword,
      reason: input.reason,
    });
    setFlash(`Action recorded: ${action}`);
    await load();
  }

  async function runNote(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    if (!input.reason?.trim()) throw { message: "Note required" };
    await bffPost(`/api/orders/${id}/notes`, {
      body: input.reason.trim(),
      reauthPassword: input.reauthPassword,
    });
    setFlash("Internal note saved.");
    await load();
  }

  if (loading) return <p className="muted">Loading order…</p>;
  if (error && !detail) {
    return (
      <div>
        <PageHeader title="Order" />
        <p className="form-error">{error}</p>
        <Link href="/orders" className="btn btn-secondary">
          Back
        </Link>
      </div>
    );
  }
  if (!detail) return null;

  const buyerLabel =
    [detail.buyer.firstName, detail.buyer.lastName].filter(Boolean).join(" ") ||
    detail.buyer.phone;
  const sellerLabel =
    [detail.seller.user.firstName, detail.seller.user.lastName]
      .filter(Boolean)
      .join(" ") || detail.seller.user.phone;

  return (
    <div>
      <PageHeader
        title={`Order ${detail.id.slice(0, 8)}…`}
        subtitle={`${detail.status}${detail.stalledEscrow ? " · stalled escrow" : ""}`}
        actions={
          <Link href="/orders" className="btn btn-secondary">
            Back to queue
          </Link>
        }
      />

      {flash ? <p className="flash-ok">{flash}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="card-grid">
        <div className="card">
          <h2>Order</h2>
          <dl className="kv">
            <dt>Status</dt>
            <dd>
              <StatusBadge status={detail.status} />
            </dd>
            <dt>Total</dt>
            <dd>{String(detail.totalEtb)} ETB</dd>
            <dt>Commission</dt>
            <dd>{String(detail.commissionEtb)} ETB</dd>
            <dt>Seller payout</dt>
            <dd>{String(detail.farmerPayoutEtb)} ETB</dd>
            <dt>Qty</dt>
            <dd>
              {String(detail.quantity ?? "—")} {detail.unitCode ?? ""}
            </dd>
            <dt>Delivery</dt>
            <dd>{detail.deliveryAddress}</dd>
            <dt>Created</dt>
            <dd>{new Date(detail.createdAt).toLocaleString()}</dd>
          </dl>
        </div>

        <div className="card">
          <h2>Payment</h2>
          <dl className="kv">
            <dt>Method</dt>
            <dd>{detail.payment.providerLabel}</dd>
            <dt>Provider</dt>
            <dd>
              <StatusBadge status={detail.payment.providerStatus} />
            </dd>
            <dt>Reference</dt>
            <dd className="mono">{detail.payment.reference ?? "—"}</dd>
            <dt>Paid at</dt>
            <dd>
              {detail.payment.paidAt
                ? new Date(detail.payment.paidAt).toLocaleString()
                : "—"}
            </dd>
          </dl>
        </div>

        <div className="card">
          <h2>Buyer</h2>
          <dl className="kv">
            <dt>Name</dt>
            <dd>{buyerLabel}</dd>
            <dt>Phone</dt>
            <dd>{detail.buyer.phone}</dd>
            <dt>Email</dt>
            <dd>{detail.buyer.email ?? "—"}</dd>
            <dt>Status</dt>
            <dd>
              <StatusBadge status={detail.buyer.status} />
            </dd>
          </dl>
        </div>

        <div className="card">
          <h2>Seller</h2>
          <dl className="kv">
            <dt>Name</dt>
            <dd>{sellerLabel}</dd>
            <dt>Phone</dt>
            <dd>{detail.seller.user.phone}</dd>
            <dt>Region</dt>
            <dd>{detail.seller.region}</dd>
            <dt>Cooperative</dt>
            <dd>{detail.seller.cooperative?.name ?? "—"}</dd>
          </dl>
        </div>
      </div>

      {canTransition ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Actions</h2>
          <div className="action-row" style={{ flexWrap: "wrap", gap: 8 }}>
            {ACTIONS.map((a) => (
              <button
                key={a.action}
                type="button"
                className={a.danger ? "btn btn-danger" : "btn btn-secondary"}
                onClick={() => setAction(a.action)}
              >
                {a.label}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setNoteOpen(true)}
            >
              Add note
            </button>
          </div>
          {detail.fulfillmentCase ? (
            <p className="muted" style={{ marginTop: 8 }}>
              Fulfillment:{" "}
              <Link
                href={`/delivery/${detail.fulfillmentCase.id}`}
                className="table-link"
              >
                {detail.fulfillmentCase.status}
              </Link>
            </p>
          ) : null}
          {detail.disputeCase ? (
            <p className="muted" style={{ marginTop: 4 }}>
              Dispute:{" "}
              <Link
                href={`/disputes/${detail.disputeCase.id}`}
                className="table-link"
              >
                {detail.disputeCase.status}
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Admin notes</h2>
        {detail.adminNotes.length === 0 ? (
          <p className="muted">No notes yet.</p>
        ) : (
          <ul>
            {detail.adminNotes.map((n) => (
              <li key={n.id}>
                <div>{n.body}</div>
                <div className="muted">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmActionModal
        open={Boolean(action)}
        title={action ? action.replaceAll("_", " ") : ""}
        requireReason={
          action === "CANCEL_UNPAID" ||
          action === "CONFIRM_PAYMENT_SIMULATION" ||
          action === "COMPLETE_ORDER"
        }
        danger={action === "CANCEL_UNPAID"}
        confirmLabel="Confirm"
        onClose={() => setAction(null)}
        onConfirm={runAction}
      />

      <ConfirmActionModal
        open={noteOpen}
        title="Add note"
        requireReason
        confirmLabel="Save note"
        onClose={() => setNoteOpen(false)}
        onConfirm={runNote}
      />
    </div>
  );
}

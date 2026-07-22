"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmActionModal } from "@/components/ConfirmActionModal";
import { usePortal } from "@/components/PortalShell";
import { bffGet, bffPost, type BffError } from "@/lib/client";
import type { DisputeDetail } from "@/lib/types";

type Action =
  | "START_REVIEW"
  | "REQUEST_INFO"
  | "REFUND"
  | "RESOLVE"
  | "REJECT"
  | "CLOSE"
  | "ESCALATE"
  | null;

export default function DisputeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { me, capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("orders.disputes.read");
  const canManage = capabilities.permissions.includes("orders.disputes.manage");

  const [detail, setDetail] = useState<DisputeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [evidenceLabel, setEvidenceLabel] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await bffGet<DisputeDetail>(`/api/disputes/${id}`));
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
      setError("Missing orders.disputes.read");
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
      notes: input.reason,
    };
    if (action === "REFUND") {
      const amount = Number(refundAmount);
      if (!Number.isFinite(amount) || amount < 0) {
        throw { message: "Enter a valid refund amount (ETB)" };
      }
      body.refundAmountEtb = amount;
    }
    await bffPost(`/api/disputes/${id}/actions`, body);
    setFlash(`Action recorded: ${action}`);
    setRefundAmount("");
    await load();
  }

  async function runNote(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    if (!input.reason?.trim()) throw { message: "Note required" };
    await bffPost(`/api/disputes/${id}/notes`, {
      body: input.reason.trim(),
      reauthPassword: input.reauthPassword,
    });
    setFlash("Internal note saved.");
    await load();
  }

  async function runAssign(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    await bffPost(`/api/disputes/${id}/assign`, {
      assigneeUserId: me.id,
      reauthPassword: input.reauthPassword,
      reason: input.reason,
    });
    setFlash("Assigned to you.");
    await load();
  }

  async function addEvidence(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    if (!evidenceLabel.trim() || !evidenceUrl.trim()) {
      setError("Evidence label and URL are required");
      throw { message: "Evidence label and URL are required" };
    }
    await bffPost(`/api/disputes/${id}/evidence`, {
      label: evidenceLabel.trim(),
      fileUrl: evidenceUrl.trim(),
      reauthPassword: input.reauthPassword,
      reason: input.reason,
    });
    setEvidenceLabel("");
    setEvidenceUrl("");
    setEvidenceOpen(false);
    setFlash("Evidence added.");
    await load();
  }

  if (loading) return <p className="muted">Loading dispute…</p>;
  if (error && !detail) {
    return (
      <div>
        <PageHeader title="Dispute" />
        <p className="form-error">{error}</p>
        <Link href="/disputes" className="btn btn-secondary">
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
        title={`Dispute ${detail.id.slice(0, 8)}…`}
        subtitle={`Order ${detail.orderId.slice(0, 8)}… · ${detail.status}`}
        actions={
          <Link href="/disputes" className="btn btn-secondary">
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
            <dt>Refund</dt>
            <dd>
              <StatusBadge status={detail.refundStatus} />
              {detail.refundAmountEtb != null
                ? ` · ${detail.refundAmountEtb} ETB`
                : ""}
            </dd>
            <dt>Assigned</dt>
            <dd>{detail.assignedToUserId ?? "—"}</dd>
            <dt>Opened</dt>
            <dd>{new Date(detail.openedAt).toLocaleString()}</dd>
            <dt>Summary</dt>
            <dd>{detail.summary ?? "—"}</dd>
            <dt>Info request</dt>
            <dd>{detail.infoRequestMessage ?? "—"}</dd>
            <dt>Resolution</dt>
            <dd>
              {detail.resolutionCode ?? "—"}
              {detail.resolutionNotes ? (
                <>
                  <br />
                  <span className="muted">{detail.resolutionNotes}</span>
                </>
              ) : null}
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
            <dd>
              {[detail.seller.region, detail.seller.woreda]
                .filter(Boolean)
                .join(" · ")}
            </dd>
            <dt>Verified</dt>
            <dd>{detail.seller.verified ? "Yes" : "No"}</dd>
            <dt>Cooperative</dt>
            <dd>{detail.seller.cooperative?.name ?? "—"}</dd>
          </dl>
        </div>

        <div className="card">
          <h2>Order</h2>
          <dl className="kv">
            <dt>Status</dt>
            <dd>
              <StatusBadge status={detail.order.status} />
            </dd>
            <dt>Total</dt>
            <dd>{String(detail.order.totalEtb)} ETB</dd>
            <dt>Payout</dt>
            <dd>{String(detail.order.farmerPayoutEtb)} ETB</dd>
            <dt>Qty</dt>
            <dd>
              {String(detail.order.quantity ?? detail.order.quantityKg)}{" "}
              {detail.order.unitCode ?? "kg"}
            </dd>
            <dt>Payment</dt>
            <dd>
              {detail.order.paymentMethod}
              {detail.order.paymentReference
                ? ` · ${detail.order.paymentReference}`
                : ""}
            </dd>
            <dt>Delivery</dt>
            <dd>{detail.order.deliveryAddress}</dd>
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
              onClick={() => setAssignOpen(true)}
            >
              Assign to me
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAction("START_REVIEW")}
            >
              Start review
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAction("REQUEST_INFO")}
            >
              Request info
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAction("REFUND")}
            >
              Record refund intent
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAction("RESOLVE")}
            >
              Resolve
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setAction("REJECT")}
            >
              Reject
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAction("ESCALATE")}
            >
              Escalate
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
              onClick={() => setNoteOpen(true)}
            >
              Internal note
            </button>
          </div>
          {action === "REFUND" || refundAmount ? (
            <label className="field" style={{ marginTop: 12, maxWidth: 240 }}>
              Refund amount (ETB)
              <input
                type="number"
                min={0}
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            </label>
          ) : null}
          <p className="muted" style={{ marginTop: 8 }}>
            Refund records intent only — no payment provider settlement.
          </p>
        </div>
      ) : null}

      <div className="card-grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>Timeline</h2>
          {detail.timeline.length === 0 ? (
            <p className="muted">No events yet.</p>
          ) : (
            <ul className="timeline-list">
              {detail.timeline.map((e) => (
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

        <div className="card">
          <h2>Evidence</h2>
          {detail.evidence.length === 0 ? (
            <p className="muted">No evidence attached.</p>
          ) : (
            <ul>
              {detail.evidence.map((e) => (
                <li key={e.id}>
                  <a href={e.fileUrl} target="_blank" rel="noreferrer">
                    {e.label}
                  </a>
                  <div className="muted">
                    {new Date(e.createdAt).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {canManage ? (
            <div style={{ marginTop: 12 }}>
              <label className="field">
                Label
                <input
                  value={evidenceLabel}
                  onChange={(e) => setEvidenceLabel(e.target.value)}
                />
              </label>
              <label className="field">
                File URL
                <input
                  value={evidenceUrl}
                  onChange={(e) => setEvidenceUrl(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEvidenceOpen(true)}
                disabled={!evidenceLabel.trim() || !evidenceUrl.trim()}
              >
                Add evidence…
              </button>
            </div>
          ) : null}
        </div>

        <div className="card">
          <h2>Internal notes</h2>
          {detail.notes.length === 0 ? (
            <p className="muted">No notes yet.</p>
          ) : (
            <ul>
              {detail.notes.map((n) => (
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
      </div>

      <ConfirmActionModal
        open={Boolean(action)}
        title={action ? action.replaceAll("_", " ") : ""}
        description={
          action === "REFUND"
            ? "Records refund intent only. Enter amount above, then confirm with password and reason."
            : undefined
        }
        requireReason={
          action === "REQUEST_INFO" ||
          action === "REFUND" ||
          action === "RESOLVE" ||
          action === "REJECT" ||
          action === "CLOSE" ||
          action === "ESCALATE"
        }
        danger={action === "REJECT" || action === "CLOSE"}
        confirmLabel="Confirm"
        onClose={() => setAction(null)}
        onConfirm={runAction}
      />

      <ConfirmActionModal
        open={noteOpen}
        title="Internal note"
        requireReason
        confirmLabel="Save note"
        onClose={() => setNoteOpen(false)}
        onConfirm={runNote}
      />

      <ConfirmActionModal
        open={assignOpen}
        title="Assign to me"
        confirmLabel="Assign"
        onClose={() => setAssignOpen(false)}
        onConfirm={runAssign}
      />

      <ConfirmActionModal
        open={evidenceOpen}
        title="Add evidence"
        requireReason
        confirmLabel="Add evidence"
        onClose={() => setEvidenceOpen(false)}
        onConfirm={addEvidence}
      />
    </div>
  );
}

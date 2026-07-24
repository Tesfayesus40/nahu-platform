"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmActionModal } from "@/components/ConfirmActionModal";
import { usePortal } from "@/components/PortalShell";
import { bffGet, bffPost, type BffError } from "@/lib/client";
import type { EarningDetail } from "@/lib/types";

type Action = "approve" | "mark-paid" | "adjust" | "reverse" | null;

export default function EarningDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("delivery.earnings.read");
  const canManage = capabilities.permissions.includes(
    "delivery.earnings.manage",
  );

  const [detail, setDetail] = useState<EarningDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [adjustAmount, setAdjustAmount] = useState("0");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bffGet<EarningDetail>(
        `/api/delivery/earnings/${id}`,
      );
      setDetail(data);
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
      setError("Missing delivery.earnings.read");
    }
  }, [canRead, load]);

  async function runAction(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    if (!action) return;
    const body: Record<string, unknown> = {
      reauthPassword: input.reauthPassword,
      reason: input.reason,
    };
    if (action === "adjust") {
      body.correctionAmount = Number(adjustAmount);
    }
    await bffPost(`/api/delivery/earnings/${id}/${action}`, body);
    setFlash(`Recorded: ${action}`);
    setAction(null);
    await load();
  }

  if (loading) return <p className="muted">Loading earning…</p>;
  if (error && !detail) {
    return (
      <div>
        <PageHeader title="Earning" />
        <p className="form-error">{error}</p>
        <Link href="/delivery/earnings" className="btn btn-secondary">
          Back
        </Link>
      </div>
    );
  }
  if (!detail) return null;

  const status = detail.settlementStatus;
  const canApprove = canManage && (status === "ELIGIBLE" || status === "PENDING");
  const canMarkPaid =
    canManage && (status === "APPROVED" || status === "ELIGIBLE");
  const canReverse =
    canManage && status !== "REVERSED" && status !== "PAID";
  const canAdjust = canManage && status !== "REVERSED";

  return (
    <div>
      <PageHeader
        title={`Earning ${detail.id.slice(0, 8)}…`}
        subtitle={`${detail.earningType} · ${detail.amount.toFixed(2)} ${detail.currency}`}
        actions={
          <Link href="/delivery/earnings" className="btn btn-secondary">
            Back to earnings
          </Link>
        }
      />
      {flash && <p className="form-success">{flash}</p>}
      {error && <p className="form-error">{error}</p>}

      <div className="detail-grid">
        <div>
          <span className="muted">Settlement</span>
          <div>
            <StatusBadge status={detail.settlementStatus} />
          </div>
        </div>
        <div>
          <span className="muted">Ledger row</span>
          <div>
            <StatusBadge status={detail.ledgerStatus} />
          </div>
        </div>
        <div>
          <span className="muted">Shipment</span>
          <div>
            <Link
              href={`/delivery/shipments/${detail.shipmentId}`}
              className="table-link"
            >
              {detail.shipmentId.slice(0, 8)}…
            </Link>
          </div>
        </div>
        <div>
          <span className="muted">Courier</span>
          <div>
            <Link
              href={`/delivery/couriers/${detail.courierUserId}`}
              className="table-link"
            >
              {detail.courierUserId.slice(0, 8)}…
            </Link>
          </div>
        </div>
        <div>
          <span className="muted">Reference</span>
          <div>{detail.reference ?? "—"}</div>
        </div>
        <div>
          <span className="muted">Created</span>
          <div>{new Date(detail.createdAt).toLocaleString()}</div>
        </div>
      </div>

      {canManage && (
        <div className="btn-row" style={{ marginTop: 16, gap: 8 }}>
          {canApprove && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAction("approve")}
            >
              Approve
            </button>
          )}
          {canMarkPaid && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAction("mark-paid")}
            >
              Mark paid (ops)
            </button>
          )}
          {canAdjust && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setAction("adjust")}
            >
              Adjust
            </button>
          )}
          {canReverse && (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setAction("reverse")}
            >
              Reverse
            </button>
          )}
        </div>
      )}

      {action === "adjust" && (
        <label className="field" style={{ marginTop: 12, display: "block" }}>
          Correction amount (ETB, signed delta)
          <input
            type="number"
            step="0.01"
            value={adjustAmount}
            onChange={(e) => setAdjustAmount(e.target.value)}
          />
        </label>
      )}

      <h3 style={{ marginTop: 24 }}>Ledger history</h3>
      <p className="muted">
        Append-only. Corrections add rows; historical amounts are never updated.
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Reference</th>
          </tr>
        </thead>
        <tbody>
          {detail.history.map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.createdAt).toLocaleString()}</td>
              <td>{row.earningType}</td>
              <td>{row.amount.toFixed(2)}</td>
              <td>
                <StatusBadge status={row.ledgerStatus} />
              </td>
              <td>{row.reference ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <ConfirmActionModal
        open={action === "approve"}
        title="Approve earning"
        description="Marks settlement APPROVED via a zero-amount marker row. No payout."
        confirmLabel="Approve"
        requireReason
        onClose={() => setAction(null)}
        onConfirm={runAction}
      />
      <ConfirmActionModal
        open={action === "mark-paid"}
        title="Mark paid (ops marker)"
        description="Ops-only PAID marker for future payout rails. Does not move money."
        confirmLabel="Mark paid"
        requireReason
        onClose={() => setAction(null)}
        onConfirm={runAction}
      />
      <ConfirmActionModal
        open={action === "adjust"}
        title="Adjust earning"
        description={`Append ADJUSTMENT of ${adjustAmount} ETB. Original row stays unchanged.`}
        confirmLabel="Adjust"
        requireReason
        onClose={() => setAction(null)}
        onConfirm={runAction}
      />
      <ConfirmActionModal
        open={action === "reverse"}
        title="Reverse earning"
        description="Appends a REVERSAL that nets the primary earning to zero."
        confirmLabel="Reverse"
        requireReason
        onClose={() => setAction(null)}
        onConfirm={runAction}
      />
    </div>
  );
}

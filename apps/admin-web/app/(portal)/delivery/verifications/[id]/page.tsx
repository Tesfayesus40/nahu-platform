"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { usePortal } from "@/components/PortalShell";
import { bffGet, bffPost, type BffError } from "@/lib/client";

type Doc = { id: string; side: string; fileUrl: string };
type Detail = {
  id: string;
  courierUserId: string;
  documentType: string;
  documentNumber: string;
  status: string;
  rejectionReason?: string | null;
  submittedAt: string;
  documents: Doc[];
  courier?: {
    phone?: string | null;
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
};

export default function CourierVerificationDetailPage() {
  const params = useParams<{ id: string }>();
  const caseId = params.id;
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("delivery.read");
  const canManage = capabilities.permissions.includes(
    "delivery.couriers.manage",
  );

  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(
        await bffGet<Detail>(`/api/delivery/courier-verifications/${caseId}`),
      );
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (canRead) void load();
    else {
      setLoading(false);
      setError("Missing delivery.read");
    }
  }, [canRead, load]);

  async function approve() {
    setBusy(true);
    setError(null);
    try {
      await bffPost(`/api/delivery/courier-verifications/${caseId}/approve`, {});
      setFlash("Approved");
      await load();
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (rejectReason.trim().length < 3) {
      setError("Rejection reason is required (min 3 characters)");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await bffPost(`/api/delivery/courier-verifications/${caseId}/reject`, {
        reason: rejectReason.trim(),
      });
      setFlash("Rejected");
      await load();
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="muted">Loading case…</p>;
  if (error && !detail) {
    return (
      <div>
        <PageHeader title="Courier verification" />
        <p className="form-error">{error}</p>
        <Link href="/delivery/verifications" className="btn btn-secondary">
          Back
        </Link>
      </div>
    );
  }
  if (!detail) return null;

  const name = [
    detail.courier?.firstName,
    detail.courier?.middleName,
    detail.courier?.lastName,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <PageHeader
        title="Courier verification case"
        subtitle={detail.documentType}
        actions={
          <Link href="/delivery/verifications" className="btn btn-secondary">
            Back to queue
          </Link>
        }
      />

      {flash && <p className="form-success">{flash}</p>}
      {error && <p className="form-error">{error}</p>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Courier</h2>
        <dl className="kv">
          <dt>Name</dt>
          <dd>{name || "—"}</dd>
          <dt>Phone</dt>
          <dd>{detail.courier?.phone || "—"}</dd>
          <dt>Email</dt>
          <dd>{detail.courier?.email || "—"}</dd>
          <dt>Status</dt>
          <dd>
            <StatusBadge status={detail.status} />
          </dd>
          <dt>Document #</dt>
          <dd>{detail.documentNumber}</dd>
          <dt>Submitted</dt>
          <dd>{new Date(detail.submittedAt).toLocaleString()}</dd>
          {detail.rejectionReason && (
            <>
              <dt>Rejection reason</dt>
              <dd>{detail.rejectionReason}</dd>
            </>
          )}
        </dl>
        <p>
          <Link href={`/delivery/couriers/${detail.courierUserId}`}>
            Open courier profile
          </Link>
        </p>
      </div>

      <div className="card-grid">
        {detail.documents.map((doc) => (
          <div className="card" key={doc.id}>
            <h3>{doc.side}</h3>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={doc.fileUrl}
              alt={doc.side}
              style={{
                width: "100%",
                maxHeight: 320,
                objectFit: "contain",
                background: "#f5f5f5",
              }}
            />
            <p>
              <a href={doc.fileUrl} target="_blank" rel="noreferrer">
                Open full size
              </a>
            </p>
          </div>
        ))}
      </div>

      {detail.status === "PENDING" && canManage && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Decision</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void approve()}
            >
              Approve
            </button>
          </div>
          <div style={{ marginTop: 16 }}>
            <label>
              Rejection reason
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                style={{ width: "100%", display: "block", marginTop: 6 }}
                placeholder="Explain what the courier must fix"
              />
            </label>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              style={{ marginTop: 8 }}
              onClick={() => void reject()}
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

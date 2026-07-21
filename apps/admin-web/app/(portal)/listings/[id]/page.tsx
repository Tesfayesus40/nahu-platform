"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmActionModal } from "@/components/ConfirmActionModal";
import { usePortal } from "@/components/PortalShell";
import { bffGet, bffPost, type BffError } from "@/lib/client";
import type { ListingModerationDetail } from "@/lib/types";

type Decision =
  | "APPROVE"
  | "REJECT"
  | "SUSPEND"
  | "FLAG"
  | "CLEAR_FLAG"
  | null;

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes(
    "marketplace.listings.read",
  );
  const canModerate = capabilities.permissions.includes(
    "marketplace.listings.moderate",
  );

  const [detail, setDetail] = useState<ListingModerationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [noteOpen, setNoteOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await bffGet<ListingModerationDetail>(`/api/listings/${id}`));
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
      setError("Missing marketplace.listings.read");
    }
  }, [canRead, load]);

  async function runDecision(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    if (!decision) return;
    await bffPost(`/api/listings/${id}/moderation-decisions`, {
      decision,
      reauthPassword: input.reauthPassword,
      reason: input.reason,
      notes: input.reason,
    });
    setFlash(`Decision recorded: ${decision}`);
    await load();
  }

  async function runNote(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    if (!input.reason?.trim()) throw { message: "Notes required" };
    await bffPost(`/api/listings/${id}/moderation-notes`, {
      notes: input.reason.trim(),
      reauthPassword: input.reauthPassword,
    });
    setFlash("Moderator note saved.");
    await load();
  }

  if (loading) return <p className="muted">Loading listing…</p>;
  if (error && !detail) {
    return (
      <div>
        <PageHeader title="Listing" />
        <p className="form-error">{error}</p>
        <Link href="/listings" className="btn btn-secondary">
          Back
        </Link>
      </div>
    );
  }
  if (!detail) return null;

  return (
    <div>
      <PageHeader
        title={detail.sellerName || "Listing"}
        subtitle={`${detail.region} · ${detail.moderationStatus}`}
        actions={
          <Link href="/listings?queue=pending" className="btn btn-secondary">
            Back to queue
          </Link>
        }
      />

      {flash ? <p className="flash-ok">{flash}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="card-grid">
        <section className="card">
          <h2>Listing</h2>
          <dl className="kv">
            <div>
              <dt>Moderation</dt>
              <dd>
                <StatusBadge status={detail.moderationStatus} />
              </dd>
            </div>
            <div>
              <dt>Commercial</dt>
              <dd>
                <StatusBadge status={detail.status} />
              </dd>
            </div>
            <div>
              <dt>Grade / process</dt>
              <dd>
                {detail.grade} · {detail.processMethod}
              </dd>
            </div>
            <div>
              <dt>Qty / price</dt>
              <dd>
                {String(detail.quantityKg)} · {String(detail.pricePerKg)}
              </dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{detail.moderationNotes ?? "—"}</dd>
            </div>
          </dl>
          {detail.photoUrls?.length ? (
            <div className="photo-row">
              {detail.photoUrls.slice(0, 4).map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" width={96} height={96} />
                </a>
              ))}
            </div>
          ) : null}
        </section>

        <section className="card">
          <h2>Seller / taxonomy</h2>
          <pre className="subject-json">
            {JSON.stringify(
              {
                seller: detail.sellerName,
                phone: detail.sellerPhone,
                category: detail.categoryCode,
                product: detail.productCode,
                farmer: detail.farmer,
              },
              null,
              2,
            )}
          </pre>
        </section>
      </div>

      {canModerate ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Actions</h2>
          <div className="action-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setDecision("APPROVE")}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setDecision("REJECT")}
            >
              Reject
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDecision("SUSPEND")}
            >
              Suspend
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDecision("FLAG")}
            >
              Flag
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setDecision("CLEAR_FLAG")}
            >
              Clear flag / approve
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setNoteOpen(true)}
            >
              Add note
            </button>
          </div>
        </section>
      ) : null}

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Decision history</h2>
        {detail.decisions.length === 0 ? (
          <p className="muted">No decisions yet.</p>
        ) : (
          <ul className="decision-list">
            {detail.decisions.map((d) => (
              <li key={d.id}>
                <strong>{d.decision}</strong> {d.fromStatus ?? "—"} →{" "}
                {d.toStatus}
                {d.reason ? (
                  <div className="muted">Reason: {d.reason}</div>
                ) : null}
                <div className="muted">
                  {new Date(d.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmActionModal
        open={Boolean(decision)}
        title={`${decision ?? ""} listing`}
        requireReason={
          decision === "REJECT" ||
          decision === "SUSPEND" ||
          decision === "FLAG"
        }
        danger={decision === "REJECT" || decision === "SUSPEND"}
        confirmLabel="Confirm"
        onClose={() => setDecision(null)}
        onConfirm={runDecision}
      />
      <ConfirmActionModal
        open={noteOpen}
        title="Moderator note"
        requireReason
        confirmLabel="Save note"
        onClose={() => setNoteOpen(false)}
        onConfirm={runNote}
      />
    </div>
  );
}

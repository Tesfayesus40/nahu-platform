"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmActionModal } from "@/components/ConfirmActionModal";
import { usePortal } from "@/components/PortalShell";
import { bffGet, bffPost, type BffError } from "@/lib/client";
import type { VerificationCaseDetail } from "@/lib/types";

type DecisionModal = {
  decision: "APPROVE" | "REJECT" | "REQUEST_INFO" | "SUSPEND" | "START_REVIEW";
  title: string;
  requireReason: boolean;
  danger?: boolean;
} | null;

export default function VerificationDetailPage() {
  const params = useParams<{ id: string }>();
  const caseId = params.id;
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("verification.read");

  const [detail, setDetail] = useState<VerificationCaseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [modal, setModal] = useState<DecisionModal>(null);
  const [docLabel, setDocLabel] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [docOpen, setDocOpen] = useState(false);
  const [noteModal, setNoteModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bffGet<VerificationCaseDetail>(
        `/api/verification/cases/${caseId}`,
      );
      setDetail(data);
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
      setError("You do not have permission to view verification cases.");
    }
  }, [canRead, load]);

  async function runDecision(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    if (!modal) return;
    await bffPost(`/api/verification/cases/${caseId}/decisions`, {
      decision: modal.decision,
      reauthPassword: input.reauthPassword,
      reason: input.reason,
      notes: input.reason,
    });
    setFlash(`Decision recorded: ${modal.decision}`);
    await load();
  }

  async function runNote(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    if (!input.reason?.trim()) {
      throw { message: "Notes are required" };
    }
    await bffPost(`/api/verification/cases/${caseId}/notes`, {
      notes: input.reason.trim(),
      reauthPassword: input.reauthPassword,
    });
    setFlash("Reviewer note saved.");
    await load();
  }

  async function addDocument(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    if (!docLabel.trim() || !docUrl.trim()) {
      throw { message: "Document label and URL are required" };
    }
    await bffPost(`/api/verification/cases/${caseId}/documents`, {
      label: docLabel.trim(),
      fileUrl: docUrl.trim(),
      reauthPassword: input.reauthPassword,
      reason: input.reason,
    });
    setDocLabel("");
    setDocUrl("");
    setDocOpen(false);
    setFlash("Document reference added.");
    await load();
  }

  if (loading) return <p className="muted">Loading case…</p>;

  if (error && !detail) {
    return (
      <div>
        <PageHeader title="Verification case" />
        <p className="form-error">{error}</p>
        <Link href="/verification" className="btn btn-secondary">
          Back to queue
        </Link>
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div>
      <PageHeader
        title={detail.displayName || "Verification case"}
        subtitle={`${detail.subjectType} · ${detail.subjectId}`}
        actions={
          <Link href="/verification?queue=pending" className="btn btn-secondary">
            Back to queue
          </Link>
        }
      />

      {flash ? <p className="flash-ok">{flash}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="card-grid">
        <section className="card">
          <h2>Case</h2>
          <dl className="kv">
            <div>
              <dt>Status</dt>
              <dd>
                <StatusBadge status={detail.status} />
              </dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{detail.subjectType}</dd>
            </div>
            <div>
              <dt>Region</dt>
              <dd>{detail.region ?? "—"}</dd>
            </div>
            <div>
              <dt>Submitted</dt>
              <dd>{new Date(detail.submittedAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt>Info request</dt>
              <dd>{detail.infoRequestMessage ?? "—"}</dd>
            </div>
            <div>
              <dt>Reviewer notes</dt>
              <dd>{detail.reviewerNotes ?? "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="card">
          <h2>Subject detail</h2>
          <pre className="subject-json">
            {JSON.stringify(detail.subject, null, 2)}
          </pre>
        </section>
      </div>

      {detail.canDecide ? (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Actions</h2>
          <div className="action-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setModal({
                  decision: "START_REVIEW",
                  title: "Start review",
                  requireReason: false,
                })
              }
            >
              Start review
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                setModal({
                  decision: "APPROVE",
                  title: "Approve verification",
                  requireReason: false,
                })
              }
            >
              Approve
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setModal({
                  decision: "REQUEST_INFO",
                  title: "Request additional information",
                  requireReason: true,
                })
              }
            >
              Request info
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() =>
                setModal({
                  decision: "REJECT",
                  title: "Reject verification",
                  requireReason: true,
                  danger: true,
                })
              }
            >
              Reject
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() =>
                setModal({
                  decision: "SUSPEND",
                  title: "Suspend subject",
                  requireReason: true,
                  danger: true,
                })
              }
            >
              Suspend
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setNoteModal(true)}
            >
              Add reviewer note
            </button>
          </div>

          <div className="doc-form">
            <h3>Attach document reference</h3>
            <p className="muted">
              Store a label + URL (for example an uploaded file under
              /uploads/files/…). Binary upload stays on the existing uploads
              endpoint.
            </p>
            <label className="field">
              Label
              <input
                value={docLabel}
                onChange={(e) => setDocLabel(e.target.value)}
              />
            </label>
            <label className="field">
              File URL
              <input
                value={docUrl}
                onChange={(e) => setDocUrl(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!docLabel.trim() || !docUrl.trim()}
              onClick={() => setDocOpen(true)}
            >
              Add document…
            </button>
          </div>
        </section>
      ) : (
        <p className="muted" style={{ marginTop: 16 }}>
          You can view this case but cannot record decisions for this subject
          type.
        </p>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Documents</h2>
        {detail.documents.length === 0 ? (
          <p className="muted">No documents attached.</p>
        ) : (
          <ul className="doc-list">
            {detail.documents.map((d) => (
              <li key={d.id}>
                <a href={d.fileUrl} target="_blank" rel="noreferrer">
                  {d.label}
                </a>
                <span className="muted">
                  {" "}
                  · {new Date(d.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Decision history</h2>
        {detail.decisions.length === 0 ? (
          <p className="muted">No decisions yet.</p>
        ) : (
          <ul className="decision-list">
            {detail.decisions.map((d) => (
              <li key={d.id}>
                <strong>{d.decision}</strong> {d.fromStatus ?? "—"} → {d.toStatus}
                {d.reason ? <div className="muted">Reason: {d.reason}</div> : null}
                {d.notes ? <div className="muted">Notes: {d.notes}</div> : null}
                <div className="muted">
                  {new Date(d.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmActionModal
        open={Boolean(modal)}
        title={modal?.title ?? "Confirm"}
        description="Requires your password. Outcome is audited."
        requireReason={modal?.requireReason}
        danger={modal?.danger}
        confirmLabel="Confirm decision"
        onClose={() => setModal(null)}
        onConfirm={runDecision}
      />

      <ConfirmActionModal
        open={noteModal}
        title="Add reviewer note"
        description="Stored on the case and in decision history."
        requireReason
        confirmLabel="Save note"
        onClose={() => setNoteModal(false)}
        onConfirm={runNote}
      />

      <ConfirmActionModal
        open={docOpen}
        title="Attach document reference"
        requireReason
        confirmLabel="Add document"
        onClose={() => setDocOpen(false)}
        onConfirm={addDocument}
      />
    </div>
  );
}

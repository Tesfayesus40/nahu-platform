"use client";

import { useEffect, useId, useState } from "react";

export function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  danger = false,
  requireReason = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  requireReason?: boolean;
  onClose: () => void;
  onConfirm: (input: {
    reauthPassword: string;
    reason?: string;
  }) => Promise<void>;
}) {
  const titleId = useId();
  const [reauthPassword, setReauthPassword] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReauthPassword("");
      setReason("");
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm({
        reauthPassword,
        reason: reason.trim() || undefined,
      });
      onClose();
    } catch (err) {
      const message =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "Action failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{title}</h2>
        {description ? <p className="muted">{description}</p> : null}
        <form onSubmit={handleSubmit}>
          <label className="field">
            Your password (re-authenticate)
            <input
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={reauthPassword}
              onChange={(e) => setReauthPassword(e.target.value)}
            />
          </label>
          <label className="field">
            Reason{requireReason ? "" : " (optional)"}
            <input
              type="text"
              required={requireReason}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={danger ? "btn btn-danger" : "btn btn-primary"}
              disabled={submitting}
            >
              {submitting ? "Working…" : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmActionModal } from "@/components/ConfirmActionModal";
import { usePortal } from "@/components/PortalShell";
import { bffPost, type BffError } from "@/lib/client";

export default function AccountPage() {
  const router = useRouter();
  const { me } = usePortal();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);

  async function handleLogout() {
    setBusy(true);
    setError(null);
    try {
      await bffPost("/api/auth/logout");
    } catch {
      // Cookies cleared regardless; continue to login.
    }
    router.replace("/login");
    router.refresh();
  }

  async function handleLogoutAll(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    setBusy(true);
    setError(null);
    try {
      await bffPost("/api/auth/logout-all", {
        reauthPassword: input.reauthPassword,
        reason: input.reason,
      });
      router.replace("/login");
      router.refresh();
    } catch (err) {
      setError((err as BffError).message);
      setBusy(false);
      throw err;
    }
  }

  return (
    <>
      <PageHeader title="Account" subtitle="Your admin profile and sessions" />

      {error ? <div className="form-error">{error}</div> : null}

      <div className="card">
        <h2>Profile</h2>
        <dl className="kv">
          <dt>Name</dt>
          <dd>
            {[me.firstName, me.lastName].filter(Boolean).join(" ") || "—"}
          </dd>
          <dt>Email</dt>
          <dd>{me.email ?? "—"}</dd>
          <dt>Phone</dt>
          <dd>{me.phone}</dd>
          <dt>Status</dt>
          <dd>
            <StatusBadge status={me.status} />
          </dd>
          <dt>Roles</dt>
          <dd>{me.roles.join(", ") || "—"}</dd>
          <dt>MFA</dt>
          <dd>{me.mfaRequired ? "Enforced" : "Not enforced"}</dd>
        </dl>
      </div>

      <div className="card">
        <h2>Sessions</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Sign out of this browser, or revoke every active session for your
          account (for example if a device was lost).
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleLogout}
            disabled={busy}
          >
            Sign out
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setLogoutAllOpen(true)}
            disabled={busy}
          >
            Sign out everywhere
          </button>
        </div>
      </div>

      <ConfirmActionModal
        open={logoutAllOpen}
        title="Sign out everywhere"
        description="Revokes every active session for your account, including this one."
        requireReason
        danger
        confirmLabel="Sign out everywhere"
        onClose={() => setLogoutAllOpen(false)}
        onConfirm={handleLogoutAll}
      />
    </>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { RoleChips } from "@/components/RoleChips";
import { ConfirmActionModal } from "@/components/ConfirmActionModal";
import { usePortal } from "@/components/PortalShell";
import {
  bffGet,
  bffPatch,
  bffPost,
  bffPut,
  type BffError,
} from "@/lib/client";
import type {
  MfaResetResponse,
  PasswordResetResponse,
  RolesListResponse,
  UserDetail,
} from "@/lib/types";

type ModalKind =
  | null
  | { type: "status"; targetStatus: string }
  | { type: "roles" }
  | { type: "mfa" }
  | { type: "password" }
  | { type: "sessions" };

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params.id;
  const { me, capabilities } = usePortal();
  const perms = capabilities.permissions;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [rolesCatalog, setRolesCatalog] = useState<RolesListResponse | null>(
    null,
  );
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalKind>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [secretOnce, setSecretOnce] = useState<{
    kind: "enroll" | "password";
    value: string;
  } | null>(null);

  const isSelf = me.id === userId;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await bffGet<UserDetail>(`/api/users/${userId}`);
      setUser(detail);
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (perms.includes("identity.roles.read")) {
      bffGet<RolesListResponse>("/api/roles")
        .then(setRolesCatalog)
        .catch(() => setRolesCatalog(null));
    }
  }, [perms]);

  useEffect(() => {
    if (perms.includes("identity.users.read")) {
      void load();
    } else {
      setLoading(false);
      setError("You do not have permission to view users.");
    }
  }, [load, perms]);

  useEffect(() => {
    if (!user) return;
    const assignable =
      rolesCatalog?.assignableCodes ?? ["PLATFORM_ADMIN", "AUDITOR"];
    setSelectedRoles(user.roles.filter((r) => assignable.includes(r)));
  }, [user, rolesCatalog]);

  const assignableCodes = useMemo(
    () => rolesCatalog?.assignableCodes ?? ["PLATFORM_ADMIN", "AUDITOR"],
    [rolesCatalog],
  );

  async function runConfirm(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    if (!modal || !user) return;
    setFlash(null);
    setSecretOnce(null);

    if (modal.type === "status") {
      await bffPatch<UserDetail>(`/api/users/${userId}/status`, {
        targetStatus: modal.targetStatus,
        reauthPassword: input.reauthPassword,
        reason: input.reason,
      });
      setFlash(`Status updated to ${modal.targetStatus}.`);
    } else if (modal.type === "roles") {
      await bffPut<UserDetail>(`/api/users/${userId}/roles`, {
        roleCodes: selectedRoles,
        reauthPassword: input.reauthPassword,
        reason: input.reason,
      });
      setFlash("Roles updated. Active admin sessions were revoked.");
    } else if (modal.type === "mfa") {
      const result = await bffPost<MfaResetResponse>(
        `/api/users/${userId}/mfa/reset`,
        {
          reauthPassword: input.reauthPassword,
          reason: input.reason,
        },
      );
      setSecretOnce({ kind: "enroll", value: result.enrollToken });
      setFlash("MFA reset. Share the enroll link out-of-band once.");
    } else if (modal.type === "password") {
      const result = await bffPost<PasswordResetResponse>(
        `/api/users/${userId}/password/reset`,
        {
          reauthPassword: input.reauthPassword,
          reason: input.reason,
        },
      );
      setSecretOnce({ kind: "password", value: result.temporaryPassword });
      setFlash("Password reset. Share the temporary password out-of-band once.");
    } else if (modal.type === "sessions") {
      await bffPost(`/api/users/${userId}/sessions/revoke`, {
        reauthPassword: input.reauthPassword,
        reason: input.reason,
      });
      setFlash("Admin sessions revoked.");
    }

    await load();
  }

  if (loading) {
    return <p className="muted">Loading user…</p>;
  }

  if (error && !user) {
    return (
      <div>
        <PageHeader title="User" />
        <p className="form-error">{error}</p>
        <Link href="/users" className="btn btn-secondary">
          Back to users
        </Link>
      </div>
    );
  }

  if (!user) return null;

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email ||
    user.phone;

  const canStatus = perms.includes("identity.users.status.write") && !isSelf;
  const canRoles =
    perms.includes("identity.roles.assign") &&
    user.workforceCapable &&
    !isSelf;
  const canMfa =
    perms.includes("identity.users.mfa.reset") &&
    user.workforceCapable &&
    !isSelf;
  const canPassword =
    perms.includes("identity.users.password.reset") &&
    Boolean(user.credential?.hasPassword) &&
    !isSelf;
  const canSessions =
    perms.includes("identity.sessions.revoke") && !isSelf;

  return (
    <div>
      <PageHeader
        title={displayName}
        subtitle={user.email ?? user.phone}
        actions={
          <Link href="/users" className="btn btn-secondary">
            Back
          </Link>
        }
      />

      {flash ? <p className="flash-ok">{flash}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {secretOnce ? (
        <div className="secret-once">
          <strong>
            {secretOnce.kind === "enroll"
              ? "One-time MFA enroll token"
              : "Temporary password"}
          </strong>
          <div className="secret-box">{secretOnce.value}</div>
          {secretOnce.kind === "enroll" ? (
            <p className="mono wrap">
              /enroll-mfa?token={secretOnce.value}
            </p>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              void navigator.clipboard.writeText(
                secretOnce.kind === "enroll"
                  ? `/enroll-mfa?token=${secretOnce.value}`
                  : secretOnce.value,
              );
            }}
          >
            Copy
          </button>
        </div>
      ) : null}

      <div className="card-grid">
        <section className="card">
          <h2>Profile</h2>
          <dl className="kv">
            <div>
              <dt>Status</dt>
              <dd>
                <StatusBadge status={user.status} />
              </dd>
            </div>
            <div>
              <dt>Roles</dt>
              <dd>
                <RoleChips roles={user.roles} />
              </dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{user.phone}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{user.email ?? "—"}</dd>
            </div>
            <div>
              <dt>Authz version</dt>
              <dd>{user.authzVersion}</dd>
            </div>
            <div>
              <dt>MFA</dt>
              <dd>
                {user.mfaEnrolled
                  ? "Enrolled"
                  : user.mfaRequired
                    ? "Required"
                    : "Not required"}
              </dd>
            </div>
            <div>
              <dt>Must reset password</dt>
              <dd>{user.mustResetPassword ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Active admin sessions</dt>
              <dd>{user.activeAdminSessionCount}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{new Date(user.createdAt).toLocaleString()}</dd>
            </div>
          </dl>
        </section>

        <section className="card">
          <h2>Credential</h2>
          {user.credential ? (
            <dl className="kv">
              <div>
                <dt>Has password</dt>
                <dd>{user.credential.hasPassword ? "Yes" : "No"}</dd>
              </div>
              <div>
                <dt>Failed logins</dt>
                <dd>{user.credential.failedLoginAttempts}</dd>
              </div>
              <div>
                <dt>Locked until</dt>
                <dd>
                  {user.credential.lockedUntil
                    ? new Date(user.credential.lockedUntil).toLocaleString()
                    : "—"}
                </dd>
              </div>
              <div>
                <dt>Last login</dt>
                <dd>
                  {user.credential.lastLoginAt
                    ? new Date(user.credential.lastLoginAt).toLocaleString()
                    : "—"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="muted">No password credential (OTP-only account).</p>
          )}
        </section>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <h2>Actions</h2>
        {isSelf ? (
          <p className="muted">
            Privileged actions on your own account are blocked. Use Account /
            logout for self-service.
          </p>
        ) : null}

        <div className="action-row">
          {canStatus ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setModal({ type: "status", targetStatus: "ACTIVE" })
                }
              >
                Activate
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setModal({ type: "status", targetStatus: "SUSPENDED" })
                }
              >
                Suspend
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  setModal({ type: "status", targetStatus: "LOCKED" })
                }
              >
                Lock
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() =>
                  setModal({ type: "status", targetStatus: "DEACTIVATED" })
                }
              >
                Deactivate
              </button>
            </>
          ) : null}

          {canRoles ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setModal({ type: "roles" })}
            >
              Assign roles
            </button>
          ) : null}

          {canMfa ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setModal({ type: "mfa" })}
            >
              Reset MFA
            </button>
          ) : null}

          {canPassword ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setModal({ type: "password" })}
            >
              Reset password
            </button>
          ) : null}

          {canSessions ? (
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => setModal({ type: "sessions" })}
            >
              Revoke sessions
            </button>
          ) : null}
        </div>

        {canRoles ? (
          <div className="role-pick" style={{ marginTop: 16 }}>
            <p className="muted">
              Assignable workforce roles (SUPER_ADMIN and mobile roles are
              preserved automatically):
            </p>
            <div className="role-pick-list">
              {assignableCodes.map((code) => (
                <label key={code} className="role-pick-item">
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(code)}
                    onChange={(e) => {
                      setSelectedRoles((prev) =>
                        e.target.checked
                          ? [...prev, code]
                          : prev.filter((r) => r !== code),
                      );
                    }}
                  />
                  {code}
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <ConfirmActionModal
        open={modal?.type === "status"}
        title={
          modal?.type === "status"
            ? `Set status to ${modal.targetStatus}`
            : "Change status"
        }
        description="Requires your password. Sessions may be revoked."
        danger={
          modal?.type === "status" &&
          (modal.targetStatus === "DEACTIVATED" ||
            modal.targetStatus === "LOCKED")
        }
        confirmLabel="Update status"
        onClose={() => setModal(null)}
        onConfirm={runConfirm}
      />

      <ConfirmActionModal
        open={modal?.type === "roles"}
        title="Confirm role assignment"
        description={`Apply: ${selectedRoles.join(", ") || "(none — keep SUPER_ADMIN / non-workforce only)"}`}
        confirmLabel="Save roles"
        onClose={() => setModal(null)}
        onConfirm={runConfirm}
      />

      <ConfirmActionModal
        open={modal?.type === "mfa"}
        title="Reset MFA"
        description="Clears authenticator factors and issues a one-time enroll token."
        danger
        confirmLabel="Reset MFA"
        onClose={() => setModal(null)}
        onConfirm={runConfirm}
      />

      <ConfirmActionModal
        open={modal?.type === "password"}
        title="Reset password"
        description="Issues a temporary password and forces reset on next login."
        danger
        confirmLabel="Reset password"
        onClose={() => setModal(null)}
        onConfirm={runConfirm}
      />

      <ConfirmActionModal
        open={modal?.type === "sessions"}
        title="Revoke admin sessions"
        description="Signs the user out of all Admin Portal sessions."
        danger
        confirmLabel="Revoke sessions"
        onClose={() => setModal(null)}
        onConfirm={runConfirm}
      />
    </div>
  );
}

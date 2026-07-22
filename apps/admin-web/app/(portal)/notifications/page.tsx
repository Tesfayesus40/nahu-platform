"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmActionModal } from "@/components/ConfirmActionModal";
import { usePortal } from "@/components/PortalShell";
import { bffGet, bffPost, type BffError } from "@/lib/client";
import type {
  AdminNotification,
  NotificationsListResponse,
} from "@/lib/types";

const emptyForm = {
  title: "",
  body: "",
  severity: "INFO",
  audience: "BROADCAST",
  sourceModule: "platform",
  linkPath: "",
};

export default function NotificationsPage() {
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("notifications.read");
  const canManage = capabilities.permissions.includes("notifications.manage");
  const canMarkRead = capabilities.permissions.includes("notifications.read");

  const [data, setData] = useState<NotificationsListResponse | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (unreadOnly) params.set("unreadOnly", "true");
      setData(
        await bffGet<NotificationsListResponse>(
          `/api/notifications?${params.toString()}`,
        ),
      );
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setLoading(false);
    }
  }, [canRead, unreadOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    try {
      await bffPost(`/api/notifications/${id}/read`);
      await load();
    } catch (err) {
      setError((err as BffError).message);
    }
  }

  async function markAll() {
    try {
      await bffPost("/api/notifications/read-all");
      setFlash("All visible notifications marked read.");
      await load();
    } catch (err) {
      setError((err as BffError).message);
    }
  }

  async function publish(input: { reauthPassword: string; reason?: string }) {
    await bffPost("/api/notifications/publish", {
      ...form,
      linkPath: form.linkPath || undefined,
      reauthPassword: input.reauthPassword,
      reason: input.reason,
    });
    setFlash("Notification published.");
    setConfirmOpen(false);
    setShowForm(false);
    setForm(emptyForm);
    await load();
  }

  if (!canRead) {
    return (
      <p className="form-error">Missing notifications.read permission.</p>
    );
  }

  return (
    <>
      <PageHeader
        title="Notification Center"
        subtitle="Operational notices for Admin Portal (source_module ready for Farms, Delivery, AI)"
        actions={
          <div className="action-row">
            <label className="muted">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
              />{" "}
              Unread only
            </label>
            {canMarkRead ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void markAll()}
              >
                Mark all read
              </button>
            ) : null}
            {canManage ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowForm(true)}
              >
                Publish
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => void load()}
              disabled={loading}
            >
              Refresh
            </button>
          </div>
        }
      />

      {flash ? <p className="flash-ok">{flash}</p> : null}
      {error ? <div className="form-error">{error}</div> : null}

      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-label">Unread</div>
          <div className="kpi-value">{data?.unreadCount ?? "—"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Listed</div>
          <div className="kpi-value">{data?.total ?? "—"}</div>
        </div>
      </div>

      {showForm && canManage ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Publish notice</h2>
          <label className="field">
            <span>Title</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Body</span>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={3}
            />
          </label>
          <label className="field">
            <span>Severity</span>
            <select
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
            >
              <option value="INFO">INFO</option>
              <option value="WARN">WARN</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </label>
          <label className="field">
            <span>Source module</span>
            <input
              value={form.sourceModule}
              onChange={(e) =>
                setForm({ ...form, sourceModule: e.target.value })
              }
              placeholder="platform | farms | delivery | ai"
            />
          </label>
          <label className="field">
            <span>Link path (optional)</span>
            <input
              value={form.linkPath}
              onChange={(e) => setForm({ ...form, linkPath: e.target.value })}
              placeholder="/monitoring"
            />
          </label>
          <div className="action-row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!form.title.trim() || !form.body.trim()}
              onClick={() => setConfirmOpen(true)}
            >
              Confirm with re-auth…
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="card">
        {!data || data.items.length === 0 ? (
          <p className="muted">No notifications.</p>
        ) : (
          <ul className="flag-list">
            {data.items.map((n: AdminNotification) => (
              <li key={n.id}>
                <div>
                  <div className="action-row">
                    <strong>{n.title}</strong>
                    <StatusBadge status={n.severity} />
                    {!n.readAt ? <StatusBadge status="UNREAD" /> : null}
                  </div>
                  <p>{n.body}</p>
                  <div className="muted">
                    {n.sourceModule} · {n.audience}
                    {n.audienceRole ? `:${n.audienceRole}` : ""} ·{" "}
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                  {n.linkPath ? (
                    <Link href={n.linkPath}>{n.linkPath}</Link>
                  ) : null}
                </div>
                {canMarkRead && !n.readAt ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void markRead(n.id)}
                  >
                    Mark read
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmActionModal
        open={confirmOpen}
        title="Publish notification"
        requireReason
        confirmLabel="Publish"
        onClose={() => setConfirmOpen(false)}
        onConfirm={publish}
      />
    </>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmActionModal } from "@/components/ConfirmActionModal";
import { usePortal } from "@/components/PortalShell";
import { bffGet, bffPatch, type BffError } from "@/lib/client";
import type { Promotion } from "@/lib/types";

const STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "ENDED"];
const SCOPE_TYPES = [
  "PLATFORM",
  "CATEGORY",
  "PRODUCT",
  "LISTING",
  "REGION",
];

export default function PromotionDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes(
    "marketplace.promotions.read",
  );
  const canManage = capabilities.permissions.includes(
    "marketplace.promotions.manage",
  );

  const [detail, setDetail] = useState<Promotion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    status: "DRAFT",
    scopeType: "PLATFORM",
    scopeRef: "",
    discountType: "PERCENT",
    discountValue: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bffGet<Promotion>(`/api/promotions/${id}`);
      setDetail(data);
      setForm({
        code: data.code,
        name: data.name,
        description: data.description ?? "",
        status: data.status,
        scopeType: data.scopeType,
        scopeRef: data.scopeRef ?? "",
        discountType: data.discountType ?? "PERCENT",
        discountValue:
          data.discountValue != null ? String(data.discountValue) : "",
      });
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
      setError("Missing marketplace.promotions.read");
    }
  }, [canRead, load]);

  async function runSave(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    const discountValue = form.discountValue
      ? Number(form.discountValue)
      : undefined;
    if (
      form.discountValue &&
      (discountValue === undefined || !Number.isFinite(discountValue))
    ) {
      throw { message: "Enter a valid discount value" };
    }
    await bffPatch(`/api/promotions/${id}`, {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      scopeType: form.scopeType,
      scopeRef: form.scopeRef.trim() || undefined,
      discountType: form.discountType || undefined,
      discountValue,
      reauthPassword: input.reauthPassword,
      reason: input.reason,
    });
    setFlash("Promotion updated.");
    await load();
  }

  if (loading) return <p className="muted">Loading promotion…</p>;
  if (error && !detail) {
    return (
      <div>
        <PageHeader title="Promotion" />
        <p className="form-error">{error}</p>
        <Link href="/promotions" className="btn btn-secondary">
          Back
        </Link>
      </div>
    );
  }
  if (!detail) return null;

  return (
    <div>
      <PageHeader
        title={detail.code}
        subtitle={`${detail.name} · Not applied at checkout yet`}
        actions={
          <Link href="/promotions" className="btn btn-secondary">
            Back to list
          </Link>
        }
      />

      {flash ? <p className="flash-ok">{flash}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="card">
        <h2>Promotion</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Not applied at checkout yet.
        </p>
        <dl className="kv">
          <dt>Status</dt>
          <dd>
            <StatusBadge status={detail.status} />
          </dd>
          <dt>Scope</dt>
          <dd>
            {[detail.scopeType, detail.scopeRef].filter(Boolean).join(" · ")}
          </dd>
          <dt>Discount</dt>
          <dd>
            {detail.discountType
              ? `${detail.discountType} ${detail.discountValue ?? ""}`
              : "—"}
          </dd>
          <dt>Updated</dt>
          <dd>{new Date(detail.updatedAt).toLocaleString()}</dd>
        </dl>
      </div>

      {canManage ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Edit</h2>
          <div style={{ display: "grid", gap: 8, maxWidth: 480 }}>
            <label className="field">
              Code
              <input
                value={form.code}
                onChange={(e) =>
                  setForm((p) => ({ ...p, code: e.target.value }))
                }
              />
            </label>
            <label className="field">
              Name
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
              />
            </label>
            <label className="field">
              Description
              <input
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </label>
            <label className="field">
              Status
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((p) => ({ ...p, status: e.target.value }))
                }
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Scope
              <select
                value={form.scopeType}
                onChange={(e) =>
                  setForm((p) => ({ ...p, scopeType: e.target.value }))
                }
              >
                {SCOPE_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Scope ref
              <input
                value={form.scopeRef}
                onChange={(e) =>
                  setForm((p) => ({ ...p, scopeRef: e.target.value }))
                }
              />
            </label>
            <label className="field">
              Discount type
              <select
                value={form.discountType}
                onChange={(e) =>
                  setForm((p) => ({ ...p, discountType: e.target.value }))
                }
              >
                <option value="PERCENT">PERCENT</option>
                <option value="FIXED_ETB">FIXED_ETB</option>
              </select>
            </label>
            <label className="field">
              Discount value
              <input
                type="number"
                value={form.discountValue}
                onChange={(e) =>
                  setForm((p) => ({ ...p, discountValue: e.target.value }))
                }
              />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setSaveOpen(true)}
            >
              Save changes
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmActionModal
        open={saveOpen}
        title="Save promotion"
        confirmLabel="Save"
        onClose={() => setSaveOpen(false)}
        onConfirm={runSave}
      />
    </div>
  );
}

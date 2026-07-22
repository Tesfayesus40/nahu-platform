"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfirmActionModal } from "@/components/ConfirmActionModal";
import { usePortal } from "@/components/PortalShell";
import { bffGet, bffPatch, type BffError } from "@/lib/client";
import type { CooperativeDetail } from "@/lib/types";

export default function CooperativeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes(
    "marketplace.cooperatives.read",
  );
  const canManage = capabilities.permissions.includes(
    "marketplace.cooperatives.manage",
  );

  const [detail, setDetail] = useState<CooperativeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [unionName, setUnionName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await bffGet<CooperativeDetail>(`/api/cooperatives/${id}`);
      setDetail(data);
      setVerificationNotes(data.verificationNotes ?? "");
      setLicenseNumber(data.licenseNumber ?? "");
      setUnionName(data.unionName ?? "");
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
      setError("Missing marketplace.cooperatives.read");
    }
  }, [canRead, load]);

  async function runSave(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    await bffPatch(`/api/cooperatives/${id}`, {
      verificationNotes,
      licenseNumber,
      unionName,
      reauthPassword: input.reauthPassword,
      reason: input.reason,
    });
    setFlash("Cooperative updated.");
    await load();
  }

  if (loading) return <p className="muted">Loading cooperative…</p>;
  if (error && !detail) {
    return (
      <div>
        <PageHeader title="Cooperative" />
        <p className="form-error">{error}</p>
        <Link href="/cooperatives" className="btn btn-secondary">
          Back
        </Link>
      </div>
    );
  }
  if (!detail) return null;

  return (
    <div>
      <PageHeader
        title={detail.name}
        subtitle={[detail.region, detail.zone].filter(Boolean).join(" · ")}
        actions={
          <Link href="/cooperatives" className="btn btn-secondary">
            Back to list
          </Link>
        }
      />

      {flash ? <p className="flash-ok">{flash}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      <div className="card-grid">
        <div className="card">
          <h2>Overview</h2>
          <dl className="kv">
            <dt>Verified</dt>
            <dd>
              <StatusBadge
                status={detail.verified ? "VERIFIED" : "UNVERIFIED"}
              />
            </dd>
            <dt>Verification status</dt>
            <dd>{detail.verificationStatus ?? "—"}</dd>
            <dt>Farmers</dt>
            <dd>
              {detail.farmerCount ?? detail.farmerProfiles?.length ?? "—"}
            </dd>
            <dt>License</dt>
            <dd>{detail.licenseNumber ?? "—"}</dd>
            <dt>Union</dt>
            <dd>{detail.unionName ?? "—"}</dd>
            <dt>Notes</dt>
            <dd>{detail.verificationNotes ?? "—"}</dd>
          </dl>
        </div>

        {canManage ? (
          <div className="card">
            <h2>Update</h2>
            <div style={{ display: "grid", gap: 8 }}>
              <label className="field">
                Verification notes
                <textarea
                  rows={3}
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                />
              </label>
              <label className="field">
                License number
                <input
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                />
              </label>
              <label className="field">
                Union name
                <input
                  value={unionName}
                  onChange={(e) => setUnionName(e.target.value)}
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
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Farmers (sample)</h2>
        {!detail.farmerProfiles?.length ? (
          <p className="muted">No linked farmers in this sample.</p>
        ) : (
          <ul>
            {detail.farmerProfiles.map((f) => {
              const label =
                [f.user.firstName, f.user.lastName].filter(Boolean).join(" ") ||
                f.user.phone;
              return (
                <li key={f.id}>
                  {label}
                  <span className="muted">
                    {" "}
                    · listings {f._count?.listings ?? 0} · orders{" "}
                    {f._count?.orders ?? 0}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ConfirmActionModal
        open={saveOpen}
        title="Update cooperative"
        confirmLabel="Save"
        onClose={() => setSaveOpen(false)}
        onConfirm={runSave}
      />
    </div>
  );
}

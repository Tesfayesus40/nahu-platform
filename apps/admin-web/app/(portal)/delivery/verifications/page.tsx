"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { usePortal } from "@/components/PortalShell";
import { bffGet, type BffError } from "@/lib/client";

type CaseRow = {
  id: string;
  courierUserId: string;
  documentType: string;
  documentNumber: string;
  status: string;
  submittedAt: string;
  courier?: {
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

type ListResponse = {
  items: CaseRow[];
  total: number;
  page: number;
  limit: number;
};

export default function CourierVerificationsPage() {
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("delivery.read");
  const [status, setStatus] = useState("PENDING");
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ status, limit: "50" });
      setData(
        await bffGet<ListResponse>(
          `/api/delivery/courier-verifications?${q.toString()}`,
        ),
      );
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    if (canRead) void load();
    else {
      setLoading(false);
      setError("Missing delivery.read");
    }
  }, [canRead, load]);

  return (
    <div>
      <PageHeader
        title="Courier identity verification"
        subtitle="Review National ID, driving licence, and passport submissions"
      />

      <div className="toolbar" style={{ marginBottom: 16, gap: 8, display: "flex" }}>
        {(["PENDING", "APPROVED", "REJECTED", ""].map((s) => (
          <button
            key={s || "ALL"}
            type="button"
            className={`btn ${status === s ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setStatus(s)}
          >
            {s || "All"}
          </button>
        )))}
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          Refresh
        </button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <p className="muted">Loading…</p>}

      {!loading && data && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Courier</th>
              <th>Phone</th>
              <th>Document</th>
              <th>Number</th>
              <th>Status</th>
              <th>Submitted</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No cases
                </td>
              </tr>
            )}
            {data.items.map((row) => {
              const name = [row.courier?.firstName, row.courier?.lastName]
                .filter(Boolean)
                .join(" ");
              return (
                <tr key={row.id}>
                  <td>{name || row.courierUserId.slice(0, 8)}</td>
                  <td>{row.courier?.phone || "—"}</td>
                  <td>{row.documentType}</td>
                  <td>{row.documentNumber}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td>{new Date(row.submittedAt).toLocaleString()}</td>
                  <td>
                    <Link
                      href={`/delivery/verifications/${row.id}`}
                      className="btn btn-secondary"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

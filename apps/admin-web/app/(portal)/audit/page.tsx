"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { DataTable, type Column } from "@/components/DataTable";
import { bffGet, type BffError } from "@/lib/client";
import type { AuditEvent, AuditEventsResponse } from "@/lib/types";

const PAGE_SIZE = 20;

const columns: Column<AuditEvent>[] = [
  {
    key: "occurredAt",
    header: "When",
    render: (row) => (
      <span title={row.occurredAt}>
        {new Date(row.occurredAt).toLocaleString()}
      </span>
    ),
  },
  {
    key: "action",
    header: "Action",
    render: (row) => <code>{row.action}</code>,
  },
  {
    key: "outcome",
    header: "Outcome",
    render: (row) => <StatusBadge status={row.outcome} />,
  },
  {
    key: "actor",
    header: "Actor",
    render: (row) =>
      row.actorUserId ? (
        <span className="mono" title={row.actorUserId}>
          {row.actorUserId.slice(0, 8)}…
        </span>
      ) : (
        <span className="muted">—</span>
      ),
  },
  {
    key: "target",
    header: "Target",
    render: (row) =>
      row.targetType ? (
        <span>
          {row.targetType}
          {row.targetId ? (
            <>
              {" "}
              <span className="mono muted" title={row.targetId}>
                {row.targetId.slice(0, 8)}…
              </span>
            </>
          ) : null}
        </span>
      ) : (
        <span className="muted">—</span>
      ),
  },
  {
    key: "ip",
    header: "IP",
    render: (row) => row.ip ?? <span className="muted">—</span>,
  },
];

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditEventsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await bffGet<AuditEventsResponse>(
        `/api/audit/events?page=${targetPage}&limit=${PAGE_SIZE}`,
      );
      setData(result);
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [page, load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Read-only record of admin actions and authentication events"
      />

      {error ? <div className="form-error">{error}</div> : null}

      {loading && !data ? (
        <div className="loading">Loading audit events…</div>
      ) : data ? (
        <>
          <DataTable
            columns={columns}
            rows={data.items}
            rowKey={(row) => row.id}
            emptyMessage="No audit events recorded yet."
          />
          <div className="pagination">
            <span>
              Page {data.page} of {totalPages} · {data.total} events
            </span>
            <div className="buttons">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

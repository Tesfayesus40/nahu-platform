"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { DataTable, type Column } from "@/components/DataTable";
import { FilterBar, type FilterField } from "@/components/FilterBar";
import { usePortal } from "@/components/PortalShell";
import { bffGet, readCsrfCookie, type BffError } from "@/lib/client";
import { CSRF_HEADER } from "@/lib/csrf-constants";
import type {
  AuditEvent,
  AuditEventsResponse,
  AuditSummaryResponse,
} from "@/lib/types";

const PAGE_SIZE = 20;

function AuditCenter() {
  const searchParams = useSearchParams();
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("audit.read");
  const canExport = capabilities.permissions.includes("audit.export");

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    actionPrefix: "",
    outcome: searchParams.get("outcome") ?? "",
    actorUserId: "",
    targetType: "",
    from: "",
    to: "",
  });
  const [applied, setApplied] = useState(filters);
  const [data, setData] = useState<AuditEventsResponse | null>(null);
  const [summary, setSummary] = useState<AuditSummaryResponse | null>(null);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const filterFields: FilterField[] = useMemo(
    () => [
      {
        key: "actionPrefix",
        label: "Action prefix",
        type: "text",
        placeholder: "orders.dispute",
      },
      {
        key: "outcome",
        label: "Outcome",
        type: "select",
        options: [
          { value: "SUCCESS", label: "SUCCESS" },
          { value: "DENIED", label: "DENIED" },
          { value: "FAILED", label: "FAILED" },
        ],
      },
      { key: "actorUserId", label: "Actor user ID", type: "text" },
      { key: "targetType", label: "Target type", type: "text" },
      { key: "from", label: "From (ISO)", type: "text", placeholder: "2026-07-01" },
      { key: "to", label: "To (ISO)", type: "text", placeholder: "2026-07-22" },
    ],
    [],
  );

  const queryString = useCallback(
    (targetPage: number) => {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: String(PAGE_SIZE),
      });
      if (applied.actionPrefix.trim())
        params.set("actionPrefix", applied.actionPrefix.trim());
      if (applied.outcome) params.set("outcome", applied.outcome);
      if (applied.actorUserId.trim())
        params.set("actorUserId", applied.actorUserId.trim());
      if (applied.targetType.trim())
        params.set("targetType", applied.targetType.trim());
      if (applied.from.trim()) params.set("from", applied.from.trim());
      if (applied.to.trim()) params.set("to", applied.to.trim());
      return params.toString();
    },
    [applied],
  );

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const [events, sum] = await Promise.all([
          bffGet<AuditEventsResponse>(
            `/api/audit/events?${queryString(targetPage)}`,
          ),
          bffGet<AuditSummaryResponse>("/api/audit/summary?days=7"),
        ]);
        setData(events);
        setSummary(sum);
        setPage(targetPage);
      } catch (err) {
        setError((err as BffError).message);
      } finally {
        setLoading(false);
      }
    },
    [queryString],
  );

  useEffect(() => {
    if (canRead) void load(1);
  }, [canRead, load]);

  if (!canRead) {
    return (
      <>
        <PageHeader title="Audit Center" subtitle="Privileged action history" />
        <p className="form-error">Missing audit.read permission.</p>
      </>
    );
  }

  async function openDetail(id: string) {
    try {
      setSelected(await bffGet<AuditEvent>(`/api/audit/events/${id}`));
    } catch (err) {
      setError((err as BffError).message);
    }
  }

  async function exportCsv() {
    const res = await fetch(`/api/audit/events/export?${queryString(1)}`, {
      headers: { [CSRF_HEADER]: readCsrfCookie() },
    });
    if (!res.ok) {
      setError(`Export failed (${res.status})`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const columns: Column<AuditEvent>[] = [
    {
      key: "occurredAt",
      header: "When",
      render: (row) => new Date(row.occurredAt).toLocaleString(),
    },
    {
      key: "action",
      header: "Action",
      render: (row) => (
        <button
          type="button"
          className="table-link"
          style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
          onClick={() => void openDetail(row.id)}
        >
          <code>{row.action}</code>
        </button>
      ),
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
          <span className="mono">{row.actorUserId.slice(0, 8)}…</span>
        ) : (
          "—"
        ),
    },
    {
      key: "target",
      header: "Target",
      render: (row) =>
        row.targetType ? (
          <span>
            {row.targetType}{" "}
            {row.targetId ? (
              <span className="mono muted">{row.targetId.slice(0, 8)}…</span>
            ) : null}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "ip",
      header: "IP",
      render: (row) => row.ip ?? "—",
    },
  ];

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <>
      <PageHeader
        title="Audit Center"
        subtitle="Search, inspect, and export privileged activity"
        actions={
          canExport ? (
            <button type="button" className="btn btn-secondary" onClick={() => void exportCsv()}>
              Export CSV
            </button>
          ) : null
        }
      />

      {summary ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Last {summary.days} days</h2>
          <dl className="kv">
            <dt>SUCCESS</dt>
            <dd>{summary.byOutcome.SUCCESS}</dd>
            <dt>DENIED</dt>
            <dd>{summary.byOutcome.DENIED}</dd>
            <dt>FAILED</dt>
            <dd>{summary.byOutcome.FAILED}</dd>
          </dl>
          {summary.topActions.length ? (
            <p className="muted" style={{ marginTop: 8 }}>
              Top:{" "}
              {summary.topActions
                .slice(0, 5)
                .map((a) => `${a.action} (${a.count})`)
                .join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}

      <FilterBar
        fields={filterFields}
        values={filters}
        onChange={(key, value) =>
          setFilters((prev) => ({ ...prev, [key]: value }))
        }
        onSubmit={() => setApplied(filters)}
        onReset={() => {
          const empty = {
            actionPrefix: "",
            outcome: "",
            actorUserId: "",
            targetType: "",
            from: "",
            to: "",
          };
          setFilters(empty);
          setApplied(empty);
        }}
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
            emptyMessage="No audit events match these filters."
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
                onClick={() => void load(page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page >= totalPages || loading}
                onClick={() => void load(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}

      {selected ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>Event detail</h2>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSelected(null)}
          >
            Close
          </button>
          <dl className="kv" style={{ marginTop: 12 }}>
            <dt>Action</dt>
            <dd>
              <code>{selected.action}</code>
            </dd>
            <dt>Outcome</dt>
            <dd>
              <StatusBadge status={selected.outcome} />
            </dd>
            <dt>When</dt>
            <dd>{new Date(selected.occurredAt).toLocaleString()}</dd>
            <dt>Permission</dt>
            <dd>{selected.permissionCode ?? "—"}</dd>
            <dt>Reason</dt>
            <dd>{selected.reason ?? "—"}</dd>
            <dt>Request ID</dt>
            <dd className="mono">{selected.requestId ?? "—"}</dd>
          </dl>
          <h3 style={{ marginTop: 12 }}>Before</h3>
          <pre className="subject-json">
            {JSON.stringify(selected.beforeJson ?? null, null, 2)}
          </pre>
          <h3 style={{ marginTop: 12 }}>After</h3>
          <pre className="subject-json">
            {JSON.stringify(selected.afterJson ?? null, null, 2)}
          </pre>
        </div>
      ) : null}
    </>
  );
}

export default function AuditPage() {
  return (
    <Suspense fallback={<p className="muted">Loading audit…</p>}>
      <AuditCenter />
    </Suspense>
  );
}

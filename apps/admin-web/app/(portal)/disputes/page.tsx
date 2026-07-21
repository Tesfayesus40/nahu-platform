"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { DataTable, type Column } from "@/components/DataTable";
import { FilterBar, type FilterField } from "@/components/FilterBar";
import { ConfirmActionModal } from "@/components/ConfirmActionModal";
import { usePortal } from "@/components/PortalShell";
import { bffGet, bffPost, type BffError } from "@/lib/client";
import type { DisputeListItem, DisputesListResponse } from "@/lib/types";

const PAGE_SIZE = 20;

const STATUSES = [
  "OPEN",
  "UNDER_REVIEW",
  "RESOLVED",
  "CLOSED",
  "ESCALATED",
].map((value) => ({
  value,
  label: value.replaceAll("_", " "),
}));

function DisputesQueue() {
  const searchParams = useSearchParams();
  const { me, capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("orders.disputes.read");
  const canManage = capabilities.permissions.includes("orders.disputes.manage");

  const initialStatus = searchParams.get("status") ?? "";
  const initialQueue = searchParams.get("queue") ?? "open";

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    q: "",
    status: initialStatus,
    queue: initialQueue === "all" ? "all" : "open",
  });
  const [applied, setApplied] = useState(filters);
  const [data, setData] = useState<DisputesListResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

  const filterFields: FilterField[] = useMemo(
    () => [
      {
        key: "q",
        label: "Search",
        type: "text",
        placeholder: "Buyer, seller, order id…",
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: STATUSES,
      },
      {
        key: "queue",
        label: "Queue",
        type: "select",
        options: [
          { value: "open", label: "Open queue" },
          { value: "all", label: "All" },
        ],
      },
    ],
    [],
  );

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: String(PAGE_SIZE),
          order: "desc",
        });
        if (applied.q.trim()) params.set("q", applied.q.trim());
        if (applied.status) {
          params.set("status", applied.status);
        } else if (applied.queue === "open") {
          params.set("queue", "open");
        } else {
          params.set("queue", "all");
        }
        const result = await bffGet<DisputesListResponse>(
          `/api/disputes?${params.toString()}`,
        );
        setData(result);
        setPage(targetPage);
        setSelected(new Set());
      } catch (err) {
        setError((err as BffError).message);
      } finally {
        setLoading(false);
      }
    },
    [applied],
  );

  useEffect(() => {
    if (canRead) void load(1);
    else setLoading(false);
  }, [canRead, load]);

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulkAssign(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    const result = await bffPost<{
      results: Array<{ id: string; ok: boolean; error?: string }>;
    }>("/api/disputes/assign/bulk", {
      disputeIds: [...selected],
      assigneeUserId: me.id,
      reauthPassword: input.reauthPassword,
      reason: input.reason,
    });
    const ok = result.results.filter((r) => r.ok).length;
    const fail = result.results.length - ok;
    setFlash(`Bulk assign to you: ${ok} succeeded, ${fail} failed.`);
    await load(page);
  }

  const columns: Column<DisputeListItem>[] = [
    {
      key: "select",
      header: "",
      render: (row) =>
        canManage ? (
          <input
            type="checkbox"
            checked={selected.has(row.id)}
            onChange={() => toggleRow(row.id)}
            aria-label={`Select ${row.id}`}
          />
        ) : null,
    },
    {
      key: "case",
      header: "Case",
      render: (row) => (
        <Link href={`/disputes/${row.id}`} className="table-link">
          {row.id.slice(0, 8)}…
        </Link>
      ),
    },
    {
      key: "parties",
      header: "Buyer / Seller",
      render: (row) => (
        <span>
          {row.buyerName || row.buyerPhone || "—"}
          <br />
          <span className="muted">
            {row.sellerName || row.sellerPhone || "—"}
          </span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "order",
      header: "Order",
      render: (row) => (
        <span>
          <StatusBadge status={row.orderStatus ?? "—"} />
          <br />
          <span className="muted">{row.totalEtb != null ? `${row.totalEtb} ETB` : "—"}</span>
        </span>
      ),
    },
    {
      key: "region",
      header: "Listing",
      render: (row) =>
        [row.listingRegion, row.listingVariety].filter(Boolean).join(" · ") ||
        "—",
    },
    {
      key: "openedAt",
      header: "Opened",
      render: (row) => new Date(row.openedAt).toLocaleString(),
    },
  ];

  if (!canRead) {
    return (
      <div>
        <PageHeader title="Disputes" subtitle="orders.disputes.read required" />
        <p className="form-error">You do not have permission to view disputes.</p>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      <PageHeader
        title="Disputes"
        subtitle="Open, under review, resolved, closed, and escalated cases."
      />

      <div className="queue-tabs">
        {STATUSES.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`btn btn-secondary sort-chip${
              applied.status === opt.value ? " active" : ""
            }`}
            onClick={() => {
              const next = {
                ...filters,
                status: opt.value,
                queue: "all",
              };
              setFilters(next);
              setApplied(next);
            }}
          >
            {opt.label}
          </button>
        ))}
        <button
          type="button"
          className={`btn btn-secondary sort-chip${
            !applied.status && applied.queue === "open" ? " active" : ""
          }`}
          onClick={() => {
            const next = { ...filters, status: "", queue: "open" };
            setFilters(next);
            setApplied(next);
          }}
        >
          Open queue
        </button>
      </div>

      <FilterBar
        fields={filterFields}
        values={filters}
        onChange={(key, value) =>
          setFilters((prev) => ({ ...prev, [key]: value }))
        }
        onSubmit={() => setApplied(filters)}
        onReset={() => {
          const empty = { q: "", status: "", queue: "open" };
          setFilters(empty);
          setApplied(empty);
        }}
      />

      {canManage && selected.size > 0 ? (
        <div className="action-row" style={{ marginBottom: 12 }}>
          <span className="muted">{selected.size} selected</span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setBulkAssignOpen(true)}
          >
            Assign to me
          </button>
        </div>
      ) : null}

      {flash ? <p className="flash-ok">{flash}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Loading disputes…</p> : null}

      {!loading && data ? (
        <>
          <DataTable
            columns={columns}
            rows={data.items}
            rowKey={(row) => row.id}
            emptyMessage="No disputes match these filters."
          />
          <div className="pagination">
            <span className="muted">
              Page {data.page} of {totalPages} · {data.total} total
            </span>
            <div className="buttons">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page <= 1}
                onClick={() => void load(page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={page >= totalPages}
                onClick={() => void load(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}

      <ConfirmActionModal
        open={bulkAssignOpen}
        title="Bulk assign to me"
        description={`Assign ${selected.size} dispute(s) to your account.`}
        confirmLabel="Assign"
        onClose={() => setBulkAssignOpen(false)}
        onConfirm={runBulkAssign}
      />
    </div>
  );
}

export default function DisputesPage() {
  return (
    <Suspense fallback={<p className="muted">Loading disputes…</p>}>
      <DisputesQueue />
    </Suspense>
  );
}

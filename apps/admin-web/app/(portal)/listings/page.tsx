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
import type {
  ListingModerationListItem,
  ListingModerationListResponse,
} from "@/lib/types";

const PAGE_SIZE = 20;

const MOD_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
  "FLAGGED",
].map((value) => ({ value, label: value }));

function ListingsQueue() {
  const searchParams = useSearchParams();
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes(
    "marketplace.listings.read",
  );
  const canModerate = capabilities.permissions.includes(
    "marketplace.listings.moderate",
  );

  const initialStatus = searchParams.get("moderationStatus") ?? "";
  const initialQueue = searchParams.get("queue") ?? "pending";

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    q: "",
    moderationStatus: initialStatus,
    queue: initialQueue === "all" ? "all" : "pending",
    region: "",
  });
  const [applied, setApplied] = useState(filters);
  const [data, setData] = useState<ListingModerationListResponse | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [bulkDecision, setBulkDecision] = useState<
    "APPROVE" | "REJECT" | "SUSPEND" | "FLAG" | "CLEAR_FLAG" | null
  >(null);

  const filterFields: FilterField[] = useMemo(
    () => [
      { key: "q", label: "Search", type: "text", placeholder: "Region, variety…" },
      {
        key: "moderationStatus",
        label: "Moderation",
        type: "select",
        options: MOD_STATUSES,
      },
      {
        key: "queue",
        label: "Queue",
        type: "select",
        options: [
          { value: "pending", label: "Actionable (pending/flagged)" },
          { value: "all", label: "All" },
        ],
      },
      { key: "region", label: "Region", type: "text" },
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
        if (applied.region.trim()) params.set("region", applied.region.trim());
        if (applied.moderationStatus) {
          params.set("moderationStatus", applied.moderationStatus);
        } else if (applied.queue === "pending") {
          params.set("queue", "pending");
        }
        const result = await bffGet<ListingModerationListResponse>(
          `/api/listings?${params.toString()}`,
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

  async function runBulk(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    if (!bulkDecision) return;
    const result = await bffPost<{
      results: Array<{ id: string; ok: boolean; error?: string }>;
    }>("/api/listings/moderation/bulk", {
      listingIds: [...selected],
      decision: bulkDecision,
      reauthPassword: input.reauthPassword,
      reason: input.reason,
      notes: input.reason,
    });
    const ok = result.results.filter((r) => r.ok).length;
    const fail = result.results.length - ok;
    setFlash(`Bulk ${bulkDecision}: ${ok} succeeded, ${fail} failed.`);
    await load(page);
  }

  const columns: Column<ListingModerationListItem>[] = [
    {
      key: "select",
      header: "",
      render: (row) =>
        canModerate ? (
          <input
            type="checkbox"
            checked={selected.has(row.id)}
            onChange={() => toggleRow(row.id)}
            aria-label={`Select ${row.id}`}
          />
        ) : null,
    },
    {
      key: "seller",
      header: "Seller",
      render: (row) => (
        <Link href={`/listings/${row.id}`} className="table-link">
          {row.sellerName || row.sellerPhone || row.id.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: "region",
      header: "Region",
      render: (row) => row.region,
    },
    {
      key: "moderationStatus",
      header: "Moderation",
      render: (row) => <StatusBadge status={row.moderationStatus} />,
    },
    {
      key: "status",
      header: "Commercial",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "price",
      header: "Price / qty",
      render: (row) => (
        <span>
          {String(row.pricePerKg)} · {String(row.quantityKg)}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      render: (row) => new Date(row.createdAt).toLocaleString(),
    },
  ];

  if (!canRead) {
    return (
      <div>
        <PageHeader title="Listings" subtitle="marketplace.listings.read required" />
        <p className="form-error">You do not have permission to view listings.</p>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      <PageHeader
        title="Listing moderation"
        subtitle="Review pending, flagged, approved, rejected, and suspended listings."
      />

      <div className="queue-tabs">
        {MOD_STATUSES.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`btn btn-secondary sort-chip${
              applied.moderationStatus === opt.value ? " active" : ""
            }`}
            onClick={() => {
              const next = {
                ...filters,
                moderationStatus: opt.value,
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
            !applied.moderationStatus && applied.queue === "pending"
              ? " active"
              : ""
          }`}
          onClick={() => {
            const next = {
              ...filters,
              moderationStatus: "",
              queue: "pending",
            };
            setFilters(next);
            setApplied(next);
          }}
        >
          Actionable
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
          const empty = {
            q: "",
            moderationStatus: "",
            queue: "pending",
            region: "",
          };
          setFilters(empty);
          setApplied(empty);
        }}
      />

      {canModerate && selected.size > 0 ? (
        <div className="action-row" style={{ marginBottom: 12 }}>
          <span className="muted">{selected.size} selected</span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setBulkDecision("APPROVE")}
          >
            Approve
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setBulkDecision("REJECT")}
          >
            Reject
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setBulkDecision("SUSPEND")}
          >
            Suspend
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setBulkDecision("FLAG")}
          >
            Flag
          </button>
        </div>
      ) : null}

      {flash ? <p className="flash-ok">{flash}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Loading listings…</p> : null}

      {!loading && data ? (
        <>
          <DataTable
            columns={columns}
            rows={data.items}
            rowKey={(row) => row.id}
            emptyMessage="No listings match these filters."
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
        open={Boolean(bulkDecision)}
        title={`Bulk ${bulkDecision ?? ""}`}
        description={`Apply to ${selected.size} listing(s).`}
        requireReason={
          bulkDecision === "REJECT" ||
          bulkDecision === "SUSPEND" ||
          bulkDecision === "FLAG"
        }
        danger={bulkDecision === "REJECT" || bulkDecision === "SUSPEND"}
        confirmLabel="Confirm bulk action"
        onClose={() => setBulkDecision(null)}
        onConfirm={runBulk}
      />
    </div>
  );
}

export default function ListingsPage() {
  return (
    <Suspense fallback={<p className="muted">Loading listings…</p>}>
      <ListingsQueue />
    </Suspense>
  );
}

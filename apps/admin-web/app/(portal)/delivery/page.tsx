"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { DataTable, type Column } from "@/components/DataTable";
import { FilterBar, type FilterField } from "@/components/FilterBar";
import { usePortal } from "@/components/PortalShell";
import { bffGet, type BffError } from "@/lib/client";
import type {
  FulfillmentListItem,
  FulfillmentsListResponse,
} from "@/lib/types";

const PAGE_SIZE = 20;

const STATUSES = [
  "PENDING_HANDOFF",
  "READY",
  "IN_TRANSIT",
  "DELIVERED",
  "EXCEPTION",
  "CLOSED",
].map((value) => ({
  value,
  label: value.replaceAll("_", " "),
}));

function DeliveryQueue() {
  const searchParams = useSearchParams();
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("delivery.read");

  const initialStatus = searchParams.get("status") ?? "";
  const initialQueue = searchParams.get("queue") ?? "open";

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    q: "",
    status: initialStatus,
    queue:
      initialQueue === "exceptions" || initialQueue === "all"
        ? initialQueue
        : "open",
  });
  const [applied, setApplied] = useState(filters);
  const [data, setData] = useState<FulfillmentsListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const filterFields: FilterField[] = useMemo(
    () => [
      {
        key: "q",
        label: "Search",
        type: "text",
        placeholder: "Tracking, carrier, address…",
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
          { value: "open", label: "Open" },
          { value: "exceptions", label: "Exceptions" },
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
        });
        if (applied.q.trim()) params.set("q", applied.q.trim());
        if (applied.status) {
          params.set("status", applied.status);
        } else {
          params.set("queue", applied.queue);
        }
        const result = await bffGet<FulfillmentsListResponse>(
          `/api/delivery/fulfillments?${params.toString()}`,
        );
        setData(result);
        setPage(targetPage);
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

  const columns: Column<FulfillmentListItem>[] = [
    {
      key: "id",
      header: "Fulfillment",
      render: (row) => (
        <Link href={`/delivery/${row.id}`} className="table-link">
          {row.id.slice(0, 8)}…
        </Link>
      ),
    },
    {
      key: "order",
      header: "Order",
      render: (row) => (
        <span>
          <Link href={`/orders/${row.orderId}`} className="table-link">
            {row.orderId.slice(0, 8)}…
          </Link>
          <br />
          <StatusBadge status={row.orderStatus ?? "—"} />
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "carrier",
      header: "Carrier / tracking",
      render: (row) =>
        [row.carrierCode, row.trackingRef].filter(Boolean).join(" · ") || "—",
    },
    {
      key: "address",
      header: "Address",
      render: (row) => row.deliveryAddress ?? "—",
    },
    {
      key: "total",
      header: "Total",
      render: (row) =>
        row.totalEtb != null ? `${row.totalEtb} ETB` : "—",
    },
    {
      key: "updatedAt",
      header: "Updated",
      render: (row) => new Date(row.updatedAt).toLocaleString(),
    },
  ];

  if (!canRead) {
    return (
      <div>
        <PageHeader title="Delivery" subtitle="delivery.read required" />
        <p className="form-error">
          You do not have permission to view delivery.
        </p>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      <PageHeader
        title="Delivery"
        subtitle="Fulfillment cases — handoff, transit, exceptions."
      />

      <div className="queue-tabs">
        {(
          [
            { value: "open", label: "Open" },
            { value: "exceptions", label: "Exceptions" },
            { value: "all", label: "All" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`btn btn-secondary sort-chip${
              !applied.status && applied.queue === opt.value ? " active" : ""
            }`}
            onClick={() => {
              const next = { ...filters, status: "", queue: opt.value };
              setFilters(next);
              setApplied(next);
            }}
          >
            {opt.label}
          </button>
        ))}
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

      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Loading fulfillments…</p> : null}

      {!loading && data ? (
        <>
          <DataTable
            columns={columns}
            rows={data.items}
            rowKey={(row) => row.id}
            emptyMessage="No fulfillments match these filters."
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
    </div>
  );
}

export default function DeliveryPage() {
  return (
    <Suspense fallback={<p className="muted">Loading delivery…</p>}>
      <DeliveryQueue />
    </Suspense>
  );
}

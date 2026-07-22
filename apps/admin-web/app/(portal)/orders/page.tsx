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
import type { OrderListItem, OrdersListResponse } from "@/lib/types";

const PAGE_SIZE = 20;

const STATUSES = [
  "PENDING_PAYMENT",
  "PAID_ESCROW",
  "CONFIRMED",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
].map((value) => ({
  value,
  label: value.replaceAll("_", " "),
}));

function OrdersQueue() {
  const searchParams = useSearchParams();
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("orders.read");

  const initialStatus = searchParams.get("status") ?? "";
  const initialQueue = searchParams.get("queue") ?? "all";

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    q: "",
    status: initialStatus,
    queue:
      initialQueue === "pending_payment" || initialQueue === "stalled_escrow"
        ? initialQueue
        : "all",
  });
  const [applied, setApplied] = useState(filters);
  const [data, setData] = useState<OrdersListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const filterFields: FilterField[] = useMemo(
    () => [
      {
        key: "q",
        label: "Search",
        type: "text",
        placeholder: "Buyer, seller, reference…",
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
          { value: "pending_payment", label: "Pending payment" },
          { value: "stalled_escrow", label: "Stalled escrow" },
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
        } else if (
          applied.queue === "pending_payment" ||
          applied.queue === "stalled_escrow"
        ) {
          params.set("queue", applied.queue);
        } else {
          params.set("queue", "all");
        }
        const result = await bffGet<OrdersListResponse>(
          `/api/orders?${params.toString()}`,
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

  const columns: Column<OrderListItem>[] = [
    {
      key: "id",
      header: "Order",
      render: (row) => (
        <Link href={`/orders/${row.id}`} className="table-link">
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
      render: (row) => (
        <span>
          <StatusBadge status={row.status} />
          {row.stalledEscrow ? (
            <>
              <br />
              <span className="muted">Stalled escrow</span>
            </>
          ) : null}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      render: (row) => `${row.totalEtb} ETB`,
    },
    {
      key: "payment",
      header: "Payment",
      render: (row) => row.paymentMethod,
    },
    {
      key: "listing",
      header: "Listing",
      render: (row) =>
        [row.listingRegion, row.listingVariety].filter(Boolean).join(" · ") ||
        "—",
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
        <PageHeader title="Orders" subtitle="orders.read required" />
        <p className="form-error">You do not have permission to view orders.</p>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle="Payment, escrow, fulfillment, and completion lifecycle."
      />

      <div className="queue-tabs">
        {(
          [
            { value: "pending_payment", label: "Pending payment" },
            { value: "stalled_escrow", label: "Stalled escrow" },
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
          const empty = { q: "", status: "", queue: "all" };
          setFilters(empty);
          setApplied(empty);
        }}
      />

      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Loading orders…</p> : null}

      {!loading && data ? (
        <>
          <DataTable
            columns={columns}
            rows={data.items}
            rowKey={(row) => row.id}
            emptyMessage="No orders match these filters."
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

export default function OrdersPage() {
  return (
    <Suspense fallback={<p className="muted">Loading orders…</p>}>
      <OrdersQueue />
    </Suspense>
  );
}

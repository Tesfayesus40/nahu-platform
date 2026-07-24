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
import type { ShipmentOpsListItem, ShipmentsListResponse } from "@/lib/types";

const PAGE_SIZE = 20;

const BUCKETS = [
  "AWAITING_ASSIGNMENT",
  "ASSIGNED",
  "IN_TRANSIT",
  "ARRIVED",
  "DELIVERED",
  "BUYER_CONFIRMATION_PENDING",
  "COMPLETED",
  "FAILED",
  "RETURNED",
  "CANCELLED",
].map((value) => ({
  value,
  label: value.replaceAll("_", " "),
}));

const STATUSES = [
  "CREATED",
  "AWAITING_ASSIGNMENT",
  "ASSIGNED",
  "ACCEPTED",
  "PICKED_UP",
  "IN_TRANSIT",
  "ARRIVED",
  "DELIVERED",
  "BUYER_CONFIRMED",
  "COMPLETED",
  "FAILED",
  "RETURNED",
  "CANCELLED",
].map((value) => ({ value, label: value }));

const SORT_OPTIONS = [
  { value: "updatedAt", label: "Updated" },
  { value: "createdAt", label: "Created" },
  { value: "currentStatus", label: "Status" },
  { value: "assignedAt", label: "Assigned" },
];

const STALE_OPTIONS = [
  { value: "6", label: "Older than 6h" },
  { value: "12", label: "Older than 12h" },
  { value: "24", label: "Older than 24h" },
  { value: "48", label: "Older than 48h" },
];

function ShipmentsQueue() {
  const searchParams = useSearchParams();
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("delivery.read");
  const canManage = capabilities.permissions.includes("delivery.manage");
  const initialBucket = searchParams.get("bucket") ?? "";
  const initialStale = searchParams.get("staleHours") ?? "";

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("updatedAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState({
    q: "",
    bucket: initialBucket,
    status: "",
    courierUserId: "",
    fulfillmentId: "",
    staleHours: initialStale,
  });
  const [applied, setApplied] = useState(filters);
  const [data, setData] = useState<ShipmentsListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"cancel" | "retry" | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const filterFields: FilterField[] = useMemo(
    () => [
      {
        key: "q",
        label: "Search",
        type: "text",
        placeholder: "Zone, notes, or UUID…",
      },
      { key: "bucket", label: "Bucket", type: "select", options: BUCKETS },
      { key: "status", label: "Status", type: "select", options: STATUSES },
      {
        key: "courierUserId",
        label: "Courier user ID",
        type: "text",
        placeholder: "UUID",
      },
      {
        key: "fulfillmentId",
        label: "Fulfillment ID",
        type: "text",
        placeholder: "UUID",
      },
      {
        key: "staleHours",
        label: "Stale",
        type: "select",
        options: STALE_OPTIONS,
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
          sort,
          order,
        });
        if (applied.q.trim()) params.set("q", applied.q.trim());
        if (applied.bucket) params.set("bucket", applied.bucket);
        if (applied.status) params.set("status", applied.status);
        if (applied.courierUserId.trim()) {
          params.set("courierUserId", applied.courierUserId.trim());
        }
        if (applied.fulfillmentId.trim()) {
          params.set("fulfillmentId", applied.fulfillmentId.trim());
        }
        if (applied.staleHours) params.set("staleHours", applied.staleHours);
        const result = await bffGet<ShipmentsListResponse>(
          `/api/delivery/shipments?${params.toString()}`,
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
    [applied, sort, order],
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

  async function runBulk(input: { reauthPassword: string; reason?: string }) {
    if (!bulkAction || selected.size === 0) return;
    const res = await bffPost<{
      succeeded: number;
      failed: number;
      processed: number;
    }>("/api/delivery/shipments/bulk", {
      action: bulkAction,
      shipmentIds: [...selected],
      reauthPassword: input.reauthPassword,
      reason: input.reason,
    });
    setFlash(
      `Bulk ${bulkAction}: ${res.succeeded} succeeded, ${res.failed} failed of ${res.processed}`,
    );
    setBulkAction(null);
    await load(page);
  }

  const columns: Column<ShipmentOpsListItem>[] = [
    {
      key: "select",
      header: "",
      render: (row) =>
        canManage &&
        (row.currentStatus === "FAILED" ||
          !["COMPLETED", "CANCELLED", "RETURNED"].includes(row.currentStatus)) ? (
          <input
            type="checkbox"
            checked={selected.has(row.id)}
            onChange={() => toggleRow(row.id)}
            aria-label={`Select ${row.id}`}
          />
        ) : null,
    },
    {
      key: "id",
      header: "Shipment",
      render: (row) => (
        <Link href={`/delivery/shipments/${row.id}`} className="table-link">
          {row.id.slice(0, 8)}…
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.currentStatus} />,
    },
    {
      key: "bucket",
      header: "Bucket",
      render: (row) => row.bucket?.replaceAll("_", " ") ?? "—",
    },
    {
      key: "zone",
      header: "Zone",
      render: (row) => row.deliveryZone ?? "—",
    },
    {
      key: "courier",
      header: "Courier",
      render: (row) =>
        row.courierUserId ? (
          <Link
            href={`/delivery/couriers/${row.courierUserId}`}
            className="table-link"
          >
            {row.courierUserId.slice(0, 8)}…
          </Link>
        ) : (
          "—"
        ),
    },
    {
      key: "stops",
      header: "Stops",
      render: (row) => String(row.stopCount),
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
        <PageHeader title="Shipments" subtitle="delivery.read required" />
        <p className="form-error">Missing permission.</p>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;
  const bucketCounts = data?.buckets.buckets ?? {};

  return (
    <div>
      <PageHeader
        title="Shipment operations"
        subtitle="Filter by bucket/status/courier · stale age · bulk cancel/retry via AdminOpsService."
      />

      {flash ? <p className="flash-ok">{flash}</p> : null}

      <div className="queue-tabs" style={{ flexWrap: "wrap" }}>
        {BUCKETS.map((b) => (
          <button
            key={b.value}
            type="button"
            className={`btn btn-secondary sort-chip${
              applied.bucket === b.value ? " active" : ""
            }`}
            onClick={() => {
              const next = { ...filters, bucket: b.value, status: "" };
              setFilters(next);
              setApplied(next);
            }}
          >
            {b.label}
            {bucketCounts[b.value] != null ? ` (${bucketCounts[b.value]})` : ""}
          </button>
        ))}
        <button
          type="button"
          className={`btn btn-secondary sort-chip${!applied.bucket ? " active" : ""}`}
          onClick={() => {
            const next = { ...filters, bucket: "" };
            setFilters(next);
            setApplied(next);
          }}
        >
          All
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
            bucket: "",
            status: "",
            courierUserId: "",
            fulfillmentId: "",
            staleHours: "",
          };
          setFilters(empty);
          setApplied(empty);
        }}
      />

      <div className="queue-tabs">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`btn btn-secondary sort-chip${
              sort === opt.value ? " active" : ""
            }`}
            onClick={() => {
              if (sort === opt.value) {
                setOrder((o) => (o === "asc" ? "desc" : "asc"));
              } else {
                setSort(opt.value);
                setOrder("desc");
              }
            }}
          >
            {opt.label}
            {sort === opt.value ? (order === "asc" ? " ↑" : " ↓") : ""}
          </button>
        ))}
      </div>

      {canManage && selected.size > 0 ? (
        <div className="bulk-bar">
          <span className="muted">{selected.size} selected</span>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setBulkAction("retry")}
          >
            Bulk retry failed
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setBulkAction("cancel")}
          >
            Bulk cancel
          </button>
        </div>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Loading shipments…</p> : null}

      {!loading && data ? (
        <>
          <DataTable
            columns={columns}
            rows={data.items}
            rowKey={(row) => row.id}
            emptyMessage="No shipments match these filters."
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
        open={Boolean(bulkAction)}
        title={bulkAction ? `Bulk ${bulkAction}` : ""}
        description={`${selected.size} shipment(s). Max 20 per request.`}
        requireReason
        danger={bulkAction === "cancel"}
        confirmLabel="Confirm bulk"
        onClose={() => setBulkAction(null)}
        onConfirm={runBulk}
      />
    </div>
  );
}

export default function ShipmentsPage() {
  return (
    <Suspense fallback={<p className="muted">Loading shipments…</p>}>
      <ShipmentsQueue />
    </Suspense>
  );
}

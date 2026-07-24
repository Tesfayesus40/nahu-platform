"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { DataTable, type Column } from "@/components/DataTable";
import { FilterBar, type FilterField } from "@/components/FilterBar";
import { usePortal } from "@/components/PortalShell";
import { bffGet, type BffError } from "@/lib/client";
import type { CourierOpsListItem, CouriersListResponse } from "@/lib/types";

const PAGE_SIZE = 20;

const AVAILABILITY = ["AVAILABLE", "OFFLINE", "BUSY", "ON_BREAK"].map(
  (value) => ({
    value,
    label: value.replaceAll("_", " "),
  }),
);

function CouriersQueue() {
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("delivery.read");

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ q: "", availability: "" });
  const [applied, setApplied] = useState(filters);
  const [data, setData] = useState<CouriersListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const filterFields: FilterField[] = useMemo(
    () => [
      {
        key: "q",
        label: "Search",
        type: "text",
        placeholder: "Name, phone, or UUID…",
      },
      {
        key: "availability",
        label: "Availability",
        type: "select",
        options: AVAILABILITY,
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
        if (applied.availability) {
          params.set("availability", applied.availability);
        }
        const result = await bffGet<CouriersListResponse>(
          `/api/delivery/couriers?${params.toString()}`,
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

  const columns: Column<CourierOpsListItem>[] = [
    {
      key: "name",
      header: "Courier",
      render: (row) => (
        <Link
          href={`/delivery/couriers/${row.userId}`}
          className="table-link"
        >
          {row.displayName ?? row.userId.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: "availability",
      header: "Availability",
      render: (row) => <StatusBadge status={row.availabilityUi} />,
    },
    {
      key: "workload",
      header: "Workload",
      render: (row) =>
        `${row.activeWorkload}${
          row.maxActiveShipments != null ? ` / ${row.maxActiveShipments}` : ""
        }${row.capacityPct != null ? ` (${row.capacityPct}%)` : ""}`,
    },
    {
      key: "completed",
      header: "Completed",
      render: (row) => String(row.completedDeliveries),
    },
    {
      key: "verified",
      header: "Verified",
      render: (row) => (row.verified ? "Yes" : "No"),
    },
    {
      key: "phone",
      header: "Phone",
      render: (row) => row.phone ?? "—",
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
        <PageHeader title="Couriers" subtitle="delivery.read required" />
        <p className="form-error">Missing permission.</p>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      <PageHeader
        title="Courier operations"
        subtitle="Availability, workload, and delivery history."
      />

      <FilterBar
        fields={filterFields}
        values={filters}
        onChange={(key, value) =>
          setFilters((prev) => ({ ...prev, [key]: value }))
        }
        onSubmit={() => setApplied(filters)}
        onReset={() => {
          const empty = { q: "", availability: "" };
          setFilters(empty);
          setApplied(empty);
        }}
      />

      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Loading couriers…</p> : null}

      {!loading && data ? (
        <>
          <DataTable
            columns={columns}
            rows={data.items}
            rowKey={(row) => row.userId}
            emptyMessage="No couriers match these filters."
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

export default function CouriersPage() {
  return (
    <Suspense fallback={<p className="muted">Loading couriers…</p>}>
      <CouriersQueue />
    </Suspense>
  );
}

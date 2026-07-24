"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { DataTable, type Column } from "@/components/DataTable";
import { FilterBar, type FilterField } from "@/components/FilterBar";
import { usePortal } from "@/components/PortalShell";
import { bffGet, type BffError } from "@/lib/client";
import type { EarningListItem, EarningsListResponse } from "@/lib/types";

const PAGE_SIZE = 20;

const LEDGER_STATUSES = [
  "ELIGIBLE",
  "APPROVED",
  "PAID",
  "REVERSED",
  "PENDING",
  "ACCRUED",
  "ADJUSTED",
  "VOID",
].map((value) => ({ value, label: value }));

function EarningsQueue() {
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("delivery.earnings.read");

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    q: "",
    ledgerStatus: "",
    courierUserId: "",
  });
  const [applied, setApplied] = useState(filters);
  const [data, setData] = useState<EarningsListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const filterFields: FilterField[] = useMemo(
    () => [
      {
        key: "q",
        label: "Search",
        type: "text",
        placeholder: "Reference, policy, or UUID…",
      },
      {
        key: "ledgerStatus",
        label: "Ledger status",
        type: "select",
        options: LEDGER_STATUSES,
      },
      {
        key: "courierUserId",
        label: "Courier user ID",
        type: "text",
        placeholder: "UUID…",
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
        if (applied.ledgerStatus) {
          params.set("ledgerStatus", applied.ledgerStatus);
        }
        if (applied.courierUserId.trim()) {
          params.set("courierUserId", applied.courierUserId.trim());
        }
        const result = await bffGet<EarningsListResponse>(
          `/api/delivery/earnings?${params.toString()}`,
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

  const columns: Column<EarningListItem>[] = [
    {
      key: "id",
      header: "Earning",
      render: (row) => (
        <Link href={`/delivery/earnings/${row.id}`} className="table-link">
          {row.id.slice(0, 8)}…
        </Link>
      ),
    },
    {
      key: "settlementStatus",
      header: "Settlement",
      render: (row) => <StatusBadge status={row.settlementStatus} />,
    },
    {
      key: "ledgerStatus",
      header: "Ledger",
      render: (row) => <StatusBadge status={row.ledgerStatus} />,
    },
    {
      key: "amount",
      header: "Amount",
      render: (row) => `${row.amount.toFixed(2)} ${row.currency ?? "ETB"}`,
    },
    {
      key: "earningType",
      header: "Type",
      render: (row) => row.earningType,
    },
    {
      key: "shipmentId",
      header: "Shipment",
      render: (row) => (
        <Link
          href={`/delivery/shipments/${row.shipmentId}`}
          className="table-link"
        >
          {row.shipmentId.slice(0, 8)}…
        </Link>
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
        <PageHeader title="Earnings" subtitle="Settlement review" />
        <p className="form-error">Missing delivery.earnings.read</p>
      </div>
    );
  }

  const summary = data?.operationalSummary?.byStatus ?? {};
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      <PageHeader
        title="Earnings"
        subtitle="Courier settlement ledger (no payouts)"
      />
      {Object.keys(summary).length > 0 && (
        <div className="metric-strip" style={{ marginBottom: 16 }}>
          {Object.entries(summary).map(([status, stats]) => (
            <div key={status} className="metric-card">
              <div className="muted">{status}</div>
              <strong>
                {stats.count} · {stats.sumEtb.toFixed(0)} ETB
              </strong>
            </div>
          ))}
        </div>
      )}
      <FilterBar
        fields={filterFields}
        values={filters}
        onChange={(key, value) =>
          setFilters((prev) => ({ ...prev, [key]: value }))
        }
        onSubmit={() => setApplied(filters)}
        onReset={() => {
          const empty = { q: "", ledgerStatus: "", courierUserId: "" };
          setFilters(empty);
          setApplied(empty);
        }}
      />
      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Loading earnings…</p> : null}
      {!loading && data ? (
        <>
          <DataTable
            columns={columns}
            rows={data.items}
            rowKey={(row) => row.id}
            emptyMessage="No earnings yet."
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

export default function EarningsPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <EarningsQueue />
    </Suspense>
  );
}

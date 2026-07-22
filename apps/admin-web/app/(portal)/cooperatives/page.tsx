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
  CooperativeListItem,
  CooperativesListResponse,
} from "@/lib/types";

const PAGE_SIZE = 20;

function CooperativesQueue() {
  const searchParams = useSearchParams();
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes(
    "marketplace.cooperatives.read",
  );

  const initialVerified = searchParams.get("verified") ?? "";

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    q: "",
    region: "",
    verified: initialVerified,
  });
  const [applied, setApplied] = useState(filters);
  const [data, setData] = useState<CooperativesListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const filterFields: FilterField[] = useMemo(
    () => [
      {
        key: "q",
        label: "Search",
        type: "text",
        placeholder: "Name, union, license…",
      },
      { key: "region", label: "Region", type: "text" },
      {
        key: "verified",
        label: "Verified",
        type: "select",
        options: [
          { value: "true", label: "Verified" },
          { value: "false", label: "Unverified" },
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
        if (applied.region.trim()) params.set("region", applied.region.trim());
        if (applied.verified) params.set("verified", applied.verified);
        const result = await bffGet<CooperativesListResponse>(
          `/api/cooperatives?${params.toString()}`,
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

  const columns: Column<CooperativeListItem>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <Link href={`/cooperatives/${row.id}`} className="table-link">
          {row.name}
        </Link>
      ),
    },
    {
      key: "region",
      header: "Region",
      render: (row) =>
        [row.region, row.zone].filter(Boolean).join(" · ") || "—",
    },
    {
      key: "union",
      header: "Union",
      render: (row) => row.unionName ?? "—",
    },
    {
      key: "verified",
      header: "Verified",
      render: (row) => (
        <StatusBadge status={row.verified ? "VERIFIED" : "UNVERIFIED"} />
      ),
    },
    {
      key: "farmers",
      header: "Farmers",
      render: (row) => row.farmerCount,
    },
    {
      key: "license",
      header: "License",
      render: (row) => row.licenseNumber ?? "—",
    },
  ];

  if (!canRead) {
    return (
      <div>
        <PageHeader
          title="Cooperatives"
          subtitle="marketplace.cooperatives.read required"
        />
        <p className="form-error">
          You do not have permission to view cooperatives.
        </p>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      <PageHeader
        title="Cooperatives"
        subtitle="Farmer cooperatives — verification notes, licenses, unions."
      />

      <FilterBar
        fields={filterFields}
        values={filters}
        onChange={(key, value) =>
          setFilters((prev) => ({ ...prev, [key]: value }))
        }
        onSubmit={() => setApplied(filters)}
        onReset={() => {
          const empty = { q: "", region: "", verified: "" };
          setFilters(empty);
          setApplied(empty);
        }}
      />

      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Loading cooperatives…</p> : null}

      {!loading && data ? (
        <>
          <DataTable
            columns={columns}
            rows={data.items}
            rowKey={(row) => row.id}
            emptyMessage="No cooperatives match these filters."
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

export default function CooperativesPage() {
  return (
    <Suspense fallback={<p className="muted">Loading cooperatives…</p>}>
      <CooperativesQueue />
    </Suspense>
  );
}

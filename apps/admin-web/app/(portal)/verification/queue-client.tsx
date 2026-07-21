"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { DataTable, type Column } from "@/components/DataTable";
import { FilterBar, type FilterField } from "@/components/FilterBar";
import { usePortal } from "@/components/PortalShell";
import { bffGet, type BffError } from "@/lib/client";
import type {
  VerificationCaseListItem,
  VerificationCasesResponse,
} from "@/lib/types";

const PAGE_SIZE = 20;

const SUBJECT_OPTIONS = [
  { value: "FARMER", label: "Farmer" },
  { value: "BUYER", label: "Buyer" },
  { value: "MERCHANT", label: "Merchant" },
  { value: "ORGANIZATION", label: "Organization" },
];

const STATUS_OPTIONS = [
  "PENDING",
  "IN_REVIEW",
  "NEEDS_INFO",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
].map((value) => ({ value, label: value }));

export default function VerificationQueuePage() {
  const searchParams = useSearchParams();
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("verification.read");

  const initialType = searchParams.get("subjectType") ?? "";
  const initialQueue = searchParams.get("queue") ?? "pending";

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    q: "",
    subjectType: initialType,
    status: "",
    queue: initialQueue === "all" ? "all" : "pending",
  });
  const [applied, setApplied] = useState(filters);
  const [data, setData] = useState<VerificationCasesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const filterFields: FilterField[] = useMemo(
    () => [
      {
        key: "q",
        label: "Search",
        type: "text",
        placeholder: "Name or region",
      },
      {
        key: "subjectType",
        label: "Type",
        type: "select",
        options: SUBJECT_OPTIONS,
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: STATUS_OPTIONS,
      },
      {
        key: "queue",
        label: "Queue",
        type: "select",
        options: [
          { value: "pending", label: "Pending only" },
          { value: "all", label: "All cases" },
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
        if (applied.subjectType) params.set("subjectType", applied.subjectType);
        if (applied.status) {
          params.set("status", applied.status);
        } else if (applied.queue === "pending") {
          params.set("queue", "pending");
        }
        const result = await bffGet<VerificationCasesResponse>(
          `/api/verification/cases?${params.toString()}`,
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

  const columns: Column<VerificationCaseListItem>[] = [
    {
      key: "displayName",
      header: "Subject",
      render: (row) => (
        <Link href={`/verification/${row.id}`} className="table-link">
          {row.displayName || row.subjectId.slice(0, 8)}
        </Link>
      ),
    },
    {
      key: "subjectType",
      header: "Type",
      render: (row) => row.subjectType,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "region",
      header: "Region",
      render: (row) => row.region ?? <span className="muted">—</span>,
    },
    {
      key: "docs",
      header: "Docs",
      render: (row) => row.documentCount,
    },
    {
      key: "submittedAt",
      header: "Submitted",
      render: (row) => new Date(row.submittedAt).toLocaleString(),
    },
  ];

  if (!canRead) {
    return (
      <div>
        <PageHeader
          title="Verification"
          subtitle="Permission required: verification.read"
        />
        <p className="form-error">
          You do not have permission to view verification queues.
        </p>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      <PageHeader
        title="Verification queue"
        subtitle="Review farmer, buyer, merchant, and organization verification requests."
      />

      <div className="queue-tabs">
        {SUBJECT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`btn btn-secondary sort-chip${
              applied.subjectType === opt.value ? " active" : ""
            }`}
            onClick={() => {
              const next = {
                ...filters,
                subjectType: opt.value,
                queue: "pending",
                status: "",
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
            !applied.subjectType ? " active" : ""
          }`}
          onClick={() => {
            const next = {
              ...filters,
              subjectType: "",
              queue: "pending",
              status: "",
            };
            setFilters(next);
            setApplied(next);
          }}
        >
          All types
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
            subjectType: "",
            status: "",
            queue: "pending",
          };
          setFilters(empty);
          setApplied(empty);
        }}
      />

      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Loading cases…</p> : null}

      {!loading && data ? (
        <>
          <DataTable
            columns={columns}
            rows={data.items}
            rowKey={(row) => row.id}
            emptyMessage="No verification cases match these filters."
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

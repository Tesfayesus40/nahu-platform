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
import type { Promotion, PromotionsListResponse } from "@/lib/types";

const PAGE_SIZE = 20;

const STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "ENDED"].map((value) => ({
  value,
  label: value,
}));

const SCOPE_TYPES = [
  "PLATFORM",
  "CATEGORY",
  "PRODUCT",
  "LISTING",
  "REGION",
].map((value) => ({ value, label: value }));

function PromotionsQueue() {
  const searchParams = useSearchParams();
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes(
    "marketplace.promotions.read",
  );
  const canManage = capabilities.permissions.includes(
    "marketplace.promotions.manage",
  );

  const initialStatus = searchParams.get("status") ?? "";

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    q: "",
    status: initialStatus,
  });
  const [applied, setApplied] = useState(filters);
  const [data, setData] = useState<PromotionsListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    status: "DRAFT",
    scopeType: "PLATFORM",
    scopeRef: "",
    discountType: "PERCENT",
    discountValue: "",
  });

  const filterFields: FilterField[] = useMemo(
    () => [
      {
        key: "q",
        label: "Search",
        type: "text",
        placeholder: "Code or name…",
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: STATUSES,
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
        if (applied.status) params.set("status", applied.status);
        const result = await bffGet<PromotionsListResponse>(
          `/api/promotions?${params.toString()}`,
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

  async function runCreate(input: {
    reauthPassword: string;
    reason?: string;
  }) {
    if (!form.code.trim() || !form.name.trim()) {
      throw { message: "Code and name are required" };
    }
    const discountValue = form.discountValue
      ? Number(form.discountValue)
      : undefined;
    if (
      form.discountValue &&
      (discountValue === undefined || !Number.isFinite(discountValue))
    ) {
      throw { message: "Enter a valid discount value" };
    }
    await bffPost<Promotion>("/api/promotions", {
      code: form.code.trim(),
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      scopeType: form.scopeType,
      scopeRef: form.scopeRef.trim() || undefined,
      discountType: form.discountType || undefined,
      discountValue,
      reauthPassword: input.reauthPassword,
      reason: input.reason,
    });
    setFlash("Promotion created.");
    setShowForm(false);
    setForm({
      code: "",
      name: "",
      description: "",
      status: "DRAFT",
      scopeType: "PLATFORM",
      scopeRef: "",
      discountType: "PERCENT",
      discountValue: "",
    });
    await load(1);
  }

  const columns: Column<Promotion>[] = [
    {
      key: "code",
      header: "Code",
      render: (row) => (
        <Link href={`/promotions/${row.id}`} className="table-link">
          {row.code}
        </Link>
      ),
    },
    {
      key: "name",
      header: "Name",
      render: (row) => row.name,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "scope",
      header: "Scope",
      render: (row) =>
        [row.scopeType, row.scopeRef].filter(Boolean).join(" · "),
    },
    {
      key: "discount",
      header: "Discount",
      render: (row) =>
        row.discountType
          ? `${row.discountType} ${row.discountValue ?? ""}`
          : "—",
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
        <PageHeader
          title="Promotions"
          subtitle="marketplace.promotions.read required"
        />
        <p className="form-error">
          You do not have permission to view promotions.
        </p>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      <PageHeader
        title="Promotions"
        subtitle="Catalog of promotional codes. Not applied at checkout yet."
        actions={
          canManage ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowForm(true)}
            >
              Create promotion
            </button>
          ) : undefined
        }
      />

      <p className="muted" style={{ marginBottom: 12 }}>
        Not applied at checkout yet — definitions only for admin tooling.
      </p>

      <FilterBar
        fields={filterFields}
        values={filters}
        onChange={(key, value) =>
          setFilters((prev) => ({ ...prev, [key]: value }))
        }
        onSubmit={() => setApplied(filters)}
        onReset={() => {
          const empty = { q: "", status: "" };
          setFilters(empty);
          setApplied(empty);
        }}
      />

      {flash ? <p className="flash-ok">{flash}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Loading promotions…</p> : null}

      {!loading && data ? (
        <>
          <DataTable
            columns={columns}
            rows={data.items}
            rowKey={(row) => row.id}
            emptyMessage="No promotions match these filters."
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

      {canManage && showForm ? (
        <div className="card" style={{ marginTop: 16 }}>
          <h2>New promotion</h2>
          <div
            style={{
              display: "grid",
              gap: 8,
              maxWidth: 480,
            }}
          >
            <label className="field">
              Code
              <input
                value={form.code}
                onChange={(e) =>
                  setForm((p) => ({ ...p, code: e.target.value }))
                }
              />
            </label>
            <label className="field">
              Name
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
              />
            </label>
            <label className="field">
              Description
              <input
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </label>
            <label className="field">
              Status
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((p) => ({ ...p, status: e.target.value }))
                }
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Scope
              <select
                value={form.scopeType}
                onChange={(e) =>
                  setForm((p) => ({ ...p, scopeType: e.target.value }))
                }
              >
                {SCOPE_TYPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Scope ref
              <input
                value={form.scopeRef}
                onChange={(e) =>
                  setForm((p) => ({ ...p, scopeRef: e.target.value }))
                }
              />
            </label>
            <label className="field">
              Discount type
              <select
                value={form.discountType}
                onChange={(e) =>
                  setForm((p) => ({ ...p, discountType: e.target.value }))
                }
              >
                <option value="PERCENT">PERCENT</option>
                <option value="FIXED_ETB">FIXED_ETB</option>
              </select>
            </label>
            <label className="field">
              Discount value
              <input
                type="number"
                value={form.discountValue}
                onChange={(e) =>
                  setForm((p) => ({ ...p, discountValue: e.target.value }))
                }
              />
            </label>
            <div className="action-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCreateOpen(true)}
              >
                Confirm create…
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmActionModal
        open={createOpen && canManage}
        title="Create promotion"
        description="Creates a promotion definition. Not applied at checkout yet."
        confirmLabel="Create"
        onClose={() => setCreateOpen(false)}
        onConfirm={runCreate}
      />
    </div>
  );
}

export default function PromotionsPage() {
  return (
    <Suspense fallback={<p className="muted">Loading promotions…</p>}>
      <PromotionsQueue />
    </Suspense>
  );
}

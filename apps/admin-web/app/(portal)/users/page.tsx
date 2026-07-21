"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { DataTable, type Column } from "@/components/DataTable";
import { FilterBar, type FilterField } from "@/components/FilterBar";
import { RoleChips } from "@/components/RoleChips";
import { usePortal } from "@/components/PortalShell";
import { bffGet, type BffError } from "@/lib/client";
import type { RolesListResponse, UsersListResponse, UserListItem } from "@/lib/types";

const PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
  "LOCKED",
  "DEACTIVATED",
].map((value) => ({ value, label: value }));

type SortKey = "createdAt" | "email" | "status" | "updatedAt";

export default function UsersPage() {
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("identity.users.read");

  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortKey>("createdAt");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState({ q: "", status: "", role: "" });
  const [applied, setApplied] = useState({ q: "", status: "", role: "" });
  const [roles, setRoles] = useState<RolesListResponse | null>(null);
  const [data, setData] = useState<UsersListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!capabilities.permissions.includes("identity.roles.read")) return;
    bffGet<RolesListResponse>("/api/roles")
      .then(setRoles)
      .catch(() => setRoles(null));
  }, [capabilities.permissions]);

  const filterFields: FilterField[] = useMemo(
    () => [
      {
        key: "q",
        label: "Search",
        type: "text",
        placeholder: "Email, phone, or name",
      },
      {
        key: "status",
        label: "Status",
        type: "select",
        options: STATUS_OPTIONS,
      },
      {
        key: "role",
        label: "Role",
        type: "select",
        options: (roles?.items ?? []).map((r) => ({
          value: r.code,
          label: r.code,
        })),
      },
    ],
    [roles],
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
        if (applied.status) params.set("status", applied.status);
        if (applied.role) params.set("role", applied.role);
        const result = await bffGet<UsersListResponse>(
          `/api/users?${params.toString()}`,
        );
        setData(result);
        setPage(targetPage);
      } catch (err) {
        setError((err as BffError).message);
      } finally {
        setLoading(false);
      }
    },
    [applied, order, sort],
  );

  useEffect(() => {
    if (canRead) {
      void load(1);
    } else {
      setLoading(false);
    }
  }, [canRead, load]);

  function toggleSort(key: SortKey) {
    if (sort === key) {
      setOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setOrder(key === "email" ? "asc" : "desc");
    }
  }

  const columns: Column<UserListItem>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => (
        <Link href={`/users/${row.id}`} className="table-link">
          {[row.firstName, row.lastName].filter(Boolean).join(" ") || "—"}
        </Link>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (row) => row.email ?? <span className="muted">—</span>,
    },
    {
      key: "phone",
      header: "Phone",
      render: (row) => row.phone,
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "roles",
      header: "Roles",
      render: (row) => <RoleChips roles={row.roles} />,
    },
    {
      key: "mfa",
      header: "MFA",
      render: (row) =>
        row.mfaEnrolled ? (
          <StatusBadge status="enrolled" tone="ok" />
        ) : row.mfaRequired ? (
          <StatusBadge status="required" tone="warn" />
        ) : (
          <span className="muted">—</span>
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
        <PageHeader title="Users" subtitle="Permission required: identity.users.read" />
        <p className="form-error">You do not have permission to view users.</p>
      </div>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Search and manage platform identity accounts."
      />

      <FilterBar
        fields={filterFields}
        values={filters}
        onChange={(key, value) =>
          setFilters((prev) => ({ ...prev, [key]: value }))
        }
        onSubmit={() => {
          setApplied(filters);
        }}
        onReset={() => {
          const empty = { q: "", status: "", role: "" };
          setFilters(empty);
          setApplied(empty);
        }}
      />

      <div className="sort-bar">
        <span className="muted">Sort by</span>
        {(
          [
            ["createdAt", "Created"],
            ["email", "Email"],
            ["status", "Status"],
            ["updatedAt", "Updated"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`btn btn-secondary sort-chip${sort === key ? " active" : ""}`}
            onClick={() => toggleSort(key)}
          >
            {label}
            {sort === key ? (order === "asc" ? " ↑" : " ↓") : ""}
          </button>
        ))}
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Loading users…</p> : null}

      {!loading && data ? (
        <>
          <DataTable
            columns={columns}
            rows={data.items}
            rowKey={(row) => row.id}
            emptyMessage="No users match these filters."
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

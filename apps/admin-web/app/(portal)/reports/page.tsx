"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { usePortal } from "@/components/PortalShell";
import { bffGet, bffPost, readCsrfCookie, type BffError } from "@/lib/client";
import { CSRF_HEADER } from "@/lib/csrf-constants";
import type {
  ReportCatalogResponse,
  ReportJobsResponse,
  ReportExportResult,
} from "@/lib/types";

export default function ReportsPage() {
  const { capabilities } = usePortal();
  const canRead = capabilities.permissions.includes("reports.read");
  const canExport = capabilities.permissions.includes("reports.export");

  const [catalog, setCatalog] = useState<ReportCatalogResponse | null>(null);
  const [jobs, setJobs] = useState<ReportJobsResponse | null>(null);
  const [selectedType, setSelectedType] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    if (!canRead) return;
    setLoading(true);
    setError(null);
    try {
      const [cat, jobList] = await Promise.all([
        bffGet<ReportCatalogResponse>("/api/reports/catalog"),
        bffGet<ReportJobsResponse>("/api/reports/jobs?page=1&limit=20"),
      ]);
      setCatalog(cat);
      setJobs(jobList);
      if (!selectedType && cat.types[0]) setSelectedType(cat.types[0].type);
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setLoading(false);
    }
  }, [canRead, selectedType]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load once
  }, [canRead]);

  async function runExport() {
    if (!selectedType) return;
    setRunning(true);
    setError(null);
    setFlash(null);
    try {
      const filters: Record<string, string> = {};
      if (statusFilter.trim()) filters.status = statusFilter.trim();
      if (selectedType === "audit.events" && statusFilter.trim()) {
        filters.outcome = statusFilter.trim();
        delete filters.status;
      }
      const result = await bffPost<ReportExportResult>("/api/reports/export", {
        reportType: selectedType,
        filters,
      });
      setFlash(
        `Export ${result.reportType} succeeded (${result.rowCount ?? 0} rows).`,
      );
      if (result.artifactCsv) {
        const blob = new Blob([result.artifactCsv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `report-${result.reportType}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      await load();
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setRunning(false);
    }
  }

  async function downloadJob(id: string) {
    const res = await fetch(`/api/reports/jobs/${id}/download`, {
      headers: { [CSRF_HEADER]: readCsrfCookie() },
    });
    if (!res.ok) {
      setError(`Download failed (${res.status})`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!canRead) {
    return <p className="form-error">Missing reports.read permission.</p>;
  }

  return (
    <>
      <PageHeader
        title="Reporting & BI"
        subtitle="Domain report catalog and export jobs (extensible for Farms, Delivery, AI)"
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {flash ? <p className="flash-ok">{flash}</p> : null}
      {error ? <div className="form-error">{error}</div> : null}

      <div className="card-grid">
        <div className="card">
          <h2>Report catalog</h2>
          {catalog ? (
            <ul className="flag-list">
              {catalog.types.map((t) => (
                <li key={t.type}>
                  <div>
                    <strong>{t.label}</strong>
                    <div className="muted mono">{t.type}</div>
                    <div className="muted">{t.description}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Loading catalog…</p>
          )}
          {catalog ? (
            <p className="muted" style={{ marginTop: 12 }}>
              Row cap: {catalog.rowCap}. {catalog.note}
            </p>
          ) : null}
        </div>

        {canExport ? (
          <div className="card">
            <h2>Run export</h2>
            <label className="field">
              <span>Report type</span>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
              >
                {(catalog?.types ?? []).map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Optional status / outcome filter</span>
              <input
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                placeholder="e.g. PAID_ESCROW or DENIED"
              />
            </label>
            <button
              type="button"
              className="btn btn-primary"
              disabled={running || !selectedType}
              onClick={() => void runExport()}
            >
              {running ? "Running…" : "Run export"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Recent jobs</h2>
        {!jobs || jobs.items.length === 0 ? (
          <p className="muted">No report jobs yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Type</th>
                <th>Status</th>
                <th>Rows</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {jobs.items.map((job) => (
                <tr key={job.id}>
                  <td>{new Date(job.createdAt).toLocaleString()}</td>
                  <td>
                    <div>{job.label}</div>
                    <div className="muted mono">{job.reportType}</div>
                  </td>
                  <td>
                    <StatusBadge status={job.status} />
                  </td>
                  <td>{job.rowCount ?? "—"}</td>
                  <td>
                    {job.status === "SUCCEEDED" ? (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void downloadJob(job.id)}
                      >
                        Download
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

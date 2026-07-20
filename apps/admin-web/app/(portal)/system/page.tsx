"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { bffGet, type BffError } from "@/lib/client";
import type { SystemHealthResponse } from "@/lib/types";

export default function SystemPage() {
  const [health, setHealth] = useState<SystemHealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHealth(await bffGet<SystemHealthResponse>("/api/system/health"));
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="System"
        subtitle="Health of the Nahu platform API and its dependencies"
        actions={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {error ? <div className="form-error">{error}</div> : null}

      {health ? (
        <div className="card">
          <h2>API health</h2>
          <dl className="kv">
            <dt>Overall</dt>
            <dd>
              <StatusBadge status={health.status} />
            </dd>
            <dt>Service</dt>
            <dd>{health.service}</dd>
            <dt>Database</dt>
            <dd>
              <StatusBadge status={health.dependencies.database} />
            </dd>
            <dt>Last checked</dt>
            <dd>{new Date(health.timestamp).toLocaleString()}</dd>
          </dl>
        </div>
      ) : !error ? (
        <div className="loading">Checking system health…</div>
      ) : null}
    </>
  );
}

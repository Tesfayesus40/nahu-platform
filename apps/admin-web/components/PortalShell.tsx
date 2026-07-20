"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { bffGet, type BffError } from "@/lib/client";
import type { CapabilitiesResponse, MeResponse } from "@/lib/types";

type PortalContextValue = {
  me: MeResponse;
  capabilities: CapabilitiesResponse;
};

const PortalContext = createContext<PortalContextValue | null>(null);

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) {
    throw new Error("usePortal must be used inside PortalShell");
  }
  return ctx;
}

export function PortalShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const [session, setSession] = useState<PortalContextValue | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [me, capabilities] = await Promise.all([
          bffGet<MeResponse>("/api/auth/me"),
          bffGet<CapabilitiesResponse>("/api/auth/capabilities"),
        ]);
        if (!cancelled) {
          setSession({ me, capabilities });
        }
      } catch (err) {
        if (cancelled) return;
        if ((err as BffError).status === 401) {
          router.replace("/login");
        } else {
          setError((err as BffError).message);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-brand">
            <span className="mark">N</span>
            <span className="name">Nahu Admin</span>
          </div>
          <div className="form-error">{error}</div>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="auth-wrap">
        <div className="loading">Loading portal…</div>
      </div>
    );
  }

  return (
    <PortalContext.Provider value={session}>
      <div className="portal">
        <Nav
          permissions={session.capabilities.permissions}
          email={session.me.email}
        />
        <div className="main">
          <div className="content">{children}</div>
        </div>
      </div>
    </PortalContext.Provider>
  );
}

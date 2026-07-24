"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";

type Courier = {
  userId: string;
  displayName: string | null;
  phone: string | null;
  availabilityUi: string;
  verified: boolean;
  activeWorkload?: number;
  maxActiveShipments?: number;
  capacityPct?: number | null;
};

type Props = {
  courier: Courier | null;
};

export function CourierSummaryCard({ courier }: Props) {
  if (!courier) {
    return (
      <div className="card">
        <h2>Courier</h2>
        <p className="muted">No courier assigned.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Courier</h2>
      <dl className="kv">
        <dt>Name</dt>
        <dd>
          <Link
            href={`/delivery/couriers/${courier.userId}`}
            className="table-link"
          >
            {courier.displayName ?? courier.userId.slice(0, 8)}
          </Link>
        </dd>
        <dt>Phone</dt>
        <dd>{courier.phone ?? "—"}</dd>
        <dt>Availability</dt>
        <dd>
          <StatusBadge status={courier.availabilityUi} />
        </dd>
        <dt>Verified</dt>
        <dd>{courier.verified ? "Yes" : "No"}</dd>
        {courier.activeWorkload != null ? (
          <>
            <dt>Workload</dt>
            <dd>
              {courier.activeWorkload}
              {courier.maxActiveShipments != null
                ? ` / ${courier.maxActiveShipments}`
                : ""}
              {courier.capacityPct != null ? ` (${courier.capacityPct}%)` : ""}
            </dd>
          </>
        ) : null}
      </dl>
    </div>
  );
}

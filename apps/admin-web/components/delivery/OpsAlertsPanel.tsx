"use client";

import Link from "next/link";

export type OpsAlert = {
  code: string;
  label: string;
  value: number;
  warnAbove: number;
  criticalAbove: number;
  severity: "ok" | "warn" | "critical";
};

type Props = {
  alerts: OpsAlert[];
};

function hrefForAlert(code: string): string | null {
  switch (code) {
    case "delivery.in_transit":
      return "/delivery/shipments?bucket=IN_TRANSIT";
    case "delivery.pod_pending":
      return "/delivery/shipments?bucket=ARRIVED";
    case "delivery.delayed_in_transit":
      return "/delivery/shipments?bucket=IN_TRANSIT&staleHours=24";
    case "delivery.delayed_pod_pending":
      return "/delivery/shipments?bucket=DELIVERED&staleHours=12";
    case "delivery.assignment_backlog":
      return "/delivery/shipments?bucket=AWAITING_ASSIGNMENT";
    default:
      return null;
  }
}

export function OpsAlertsPanel({ alerts }: Props) {
  const actionable = alerts.filter((a) => a.severity !== "ok");
  if (!actionable.length) {
    return (
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Operational alerts</h2>
        <p className="muted">All monitored thresholds are within range.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2>Operational alerts</h2>
      <ul className="ops-alerts">
        {actionable.map((a) => {
          const href = hrefForAlert(a.code);
          return (
            <li key={a.code} className={`ops-alert ops-alert-${a.severity}`}>
              <div>
                <strong>{a.label}</strong>
                <div className="muted">
                  {a.value} (warn ≥ {a.warnAbove}, critical ≥ {a.criticalAbove})
                </div>
              </div>
              {href ? (
                <Link href={href} className="btn btn-secondary">
                  Open queue
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

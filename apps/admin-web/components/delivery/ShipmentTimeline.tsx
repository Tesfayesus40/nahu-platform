"use client";

import { StatusBadge } from "@/components/StatusBadge";
import { shortEventLabel } from "@/lib/deliveryProgress";

export type TimelineEvent = {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorUserId: string | null;
  message: string | null;
  occurredAt: string;
  payloadJson?: unknown;
};

type Props = {
  events: TimelineEvent[];
};

export function ShipmentTimeline({ events }: Props) {
  if (!events.length) {
    return <p className="muted">No ShipmentEvent rows yet.</p>;
  }

  return (
    <ol className="shipment-timeline">
      {events.map((e) => (
        <li key={e.id} className="shipment-timeline-item">
          <div className="shipment-timeline-head">
            <strong>{shortEventLabel(e.eventType)}</strong>
            {e.fromStatus || e.toStatus ? (
              <span className="shipment-timeline-status">
                {e.fromStatus ? <StatusBadge status={e.fromStatus} /> : null}
                {e.fromStatus && e.toStatus ? (
                  <span className="muted"> → </span>
                ) : null}
                {e.toStatus ? <StatusBadge status={e.toStatus} /> : null}
              </span>
            ) : null}
          </div>
          <div className="muted shipment-timeline-meta">
            {new Date(e.occurredAt).toLocaleString()}
            {e.actorUserId ? ` · actor ${e.actorUserId.slice(0, 8)}…` : ""}
            {e.message ? ` · ${e.message}` : ""}
          </div>
          {e.payloadJson != null && typeof e.payloadJson === "object" ? (
            <details className="shipment-timeline-payload">
              <summary className="muted">Payload</summary>
              <pre className="mono">{JSON.stringify(e.payloadJson, null, 2)}</pre>
            </details>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

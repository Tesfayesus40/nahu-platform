"use client";

import { TRACKING_STEPS, progressFromStatus, trackingStepLabel } from "@/lib/deliveryProgress";
import { StatusBadge } from "@/components/StatusBadge";

type Props = {
  status: string;
};

export function ShipmentProgress({ status }: Props) {
  const progress = progressFromStatus(status);

  if (progress.isException) {
    return (
      <div className="delivery-progress">
        <StatusBadge status={status} />
        <span className="muted" style={{ marginLeft: 8 }}>
          {trackingStepLabel("EXCEPTION")}
        </span>
      </div>
    );
  }

  return (
    <div className="delivery-progress">
      <div className="delivery-progress-row" aria-hidden>
        {TRACKING_STEPS.map((code, idx) => {
          const done = idx <= progress.stepIndex;
          return (
            <div key={code} className="delivery-progress-step">
              <span
                className={`delivery-progress-dot${done ? " done" : ""}`}
                title={trackingStepLabel(code)}
              />
              {idx < TRACKING_STEPS.length - 1 ? (
                <span
                  className={`delivery-progress-line${
                    done && idx < progress.stepIndex ? " done" : ""
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
        {trackingStepLabel(progress.stepCode)}
      </div>
    </div>
  );
}

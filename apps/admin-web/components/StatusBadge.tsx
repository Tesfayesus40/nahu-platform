type Tone = "ok" | "warn" | "danger" | "neutral";

const TONE_BY_STATUS: Record<string, Tone> = {
  ok: "ok",
  up: "ok",
  success: "ok",
  succeeded: "ok",
  active: "ok",
  approved: "ok",
  enrolled: "ok",
  enabled: "ok",
  delivered: "ok",
  completed: "ok",
  verified: "ok",
  degraded: "warn",
  pending: "warn",
  pending_payment: "warn",
  pending_handoff: "warn",
  denied: "warn",
  suspended: "warn",
  in_review: "warn",
  under_review: "warn",
  needs_info: "warn",
  required: "warn",
  flagged: "warn",
  warn: "warn",
  info: "warn",
  unread: "warn",
  open: "warn",
  ready: "warn",
  in_transit: "warn",
  paused: "warn",
  draft: "neutral",
  down: "danger",
  failed: "danger",
  error: "danger",
  locked: "danger",
  deactivated: "danger",
  rejected: "danger",
  critical: "danger",
  exception: "danger",
  escalated: "danger",
  disabled: "danger",
  revoked: "danger",
};

export function StatusBadge({
  status,
  tone,
}: {
  status: string;
  tone?: Tone;
}) {
  const key = status.toLowerCase().replace(/\s+/g, "_");
  const resolved = tone ?? TONE_BY_STATUS[key] ?? "neutral";
  return (
    <span className={`badge badge-${resolved}`}>
      <span className="dot" />
      {status}
    </span>
  );
}

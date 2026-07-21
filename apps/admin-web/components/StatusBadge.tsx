type Tone = "ok" | "warn" | "danger" | "neutral";

const TONE_BY_STATUS: Record<string, Tone> = {
  ok: "ok",
  up: "ok",
  success: "ok",
  active: "ok",
  approved: "ok",
  enrolled: "ok",
  degraded: "warn",
  pending: "warn",
  denied: "warn",
  suspended: "warn",
  in_review: "warn",
  needs_info: "warn",
  required: "warn",
  flagged: "warn",
  down: "danger",
  failed: "danger",
  error: "danger",
  locked: "danger",
  deactivated: "danger",
  rejected: "danger",
};

export function StatusBadge({
  status,
  tone,
}: {
  status: string;
  tone?: Tone;
}) {
  const resolved = tone ?? TONE_BY_STATUS[status.toLowerCase()] ?? "neutral";
  return (
    <span className={`badge badge-${resolved}`}>
      <span className="dot" />
      {status}
    </span>
  );
}

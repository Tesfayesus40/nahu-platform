"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { bffPost, type BffError } from "@/lib/client";

function EnrollMfaFlow() {
  const searchParams = useSearchParams();
  const tokenFromQuery = searchParams.get("token") ?? "";

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);
  const [enrollment, setEnrollment] = useState<{
    otpauthUrl: string;
    secret: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  async function startEnrollment() {
    setError(null);
    setSubmitting(true);
    try {
      await bffPost("/api/auth/mfa/enroll/session", {
        token: tokenFromQuery,
      });
      const enrolled = await bffPost<{ otpauthUrl: string; secret: string }>(
        "/api/auth/mfa/enroll/totp",
        {},
      );
      setEnrollment(enrolled);
      setReady(true);
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const confirmed = await bffPost<{ recoveryCodes: string[] }>(
        "/api/auth/mfa/enroll/totp/confirm",
        { totpCode: totpCode.trim() },
      );
      setRecoveryCodes(confirmed.recoveryCodes ?? []);
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!tokenFromQuery) {
    return (
      <div className="auth-card">
        <h1>MFA enrollment</h1>
        <p className="muted">Missing enrollment token. Use the bootstrap enroll URL.</p>
      </div>
    );
  }

  if (recoveryCodes.length > 0) {
    return (
      <div className="auth-card">
        <h1>Save recovery codes</h1>
        <p className="muted">Shown once. Store them securely out-of-band.</p>
        <ul className="recovery-list">
          {recoveryCodes.map((code) => (
            <li key={code}>
              <code>{code}</code>
            </li>
          ))}
        </ul>
        <Link className="btn primary" href="/login">
          Continue to login
        </Link>
      </div>
    );
  }

  if (!ready || !enrollment) {
    return (
      <div className="auth-card">
        <h1>Complete MFA enrollment</h1>
        <p className="muted">
          Bootstrap and invitation flows finish here before the first admin login.
        </p>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="btn primary" type="button" disabled={submitting} onClick={startEnrollment}>
          {submitting ? "Starting…" : "Start authenticator setup"}
        </button>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h1>Add authenticator</h1>
      <p className="muted">Scan or enter this secret in your TOTP app, then confirm a code.</p>
      <p className="mono wrap">
        <a href={enrollment.otpauthUrl}>{enrollment.otpauthUrl}</a>
      </p>
      <div className="secret-box">{enrollment.secret}</div>
      {error ? <p className="form-error">{error}</p> : null}
      <form onSubmit={handleConfirm}>
        <label>
          Authentication code
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            required
          />
        </label>
        <button className="btn primary" type="submit" disabled={submitting}>
          {submitting ? "Confirming…" : "Confirm enrollment"}
        </button>
      </form>
    </div>
  );
}

export default function EnrollMfaPage() {
  return (
    <Suspense fallback={<div className="auth-card">Loading…</div>}>
      <EnrollMfaFlow />
    </Suspense>
  );
}

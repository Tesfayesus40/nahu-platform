"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { bffPost, type BffError } from "@/lib/client";

type Mode = "totp" | "recovery";

export default function MfaPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("totp");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await bffPost("/api/auth/mfa/verify", {
        ...(mode === "totp"
          ? { totpCode: code.trim() }
          : { recoveryCode: code.trim() }),
      });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as BffError).message);
      setSubmitting(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setCode("");
    setError(null);
  }

  return (
    <div className="auth-card">
      <div className="auth-brand">
        <span className="mark">N</span>
        <span className="name">Nahu Admin</span>
      </div>
      <h1 className="auth-title">Verify it&apos;s you</h1>
      <p className="auth-sub">
        {mode === "totp"
          ? "Enter the 6-digit code from your authenticator app."
          : "Enter one of your single-use recovery codes."}
      </p>

      {error ? <div className="form-error">{error}</div> : null}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="code">
            {mode === "totp" ? "Authenticator code" : "Recovery code"}
          </label>
          <input
            id="code"
            type="text"
            inputMode={mode === "totp" ? "numeric" : "text"}
            autoComplete="one-time-code"
            autoFocus
            required
            minLength={mode === "totp" ? 6 : 8}
            maxLength={mode === "totp" ? 8 : 64}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={submitting}
        >
          {submitting ? "Verifying…" : "Verify"}
        </button>
      </form>

      <p className="auth-footer">
        {mode === "totp" ? (
          <button
            type="button"
            className="btn btn-secondary btn-block"
            style={{ marginTop: 10 }}
            onClick={() => switchMode("recovery")}
          >
            Use a recovery code instead
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-secondary btn-block"
            style={{ marginTop: 10 }}
            onClick={() => switchMode("totp")}
          >
            Use authenticator code instead
          </button>
        )}
      </p>
      <p className="auth-footer">
        <Link href="/login">Back to sign in</Link>
      </p>
    </div>
  );
}

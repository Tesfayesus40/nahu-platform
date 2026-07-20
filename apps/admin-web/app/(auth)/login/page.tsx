"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bffPost, type BffError } from "@/lib/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await bffPost<{ mfaRequired: boolean }>(
        "/api/auth/login",
        { email, password },
      );
      if (result.mfaRequired) {
        router.push("/mfa");
      } else {
        router.push("/");
      }
    } catch (err) {
      setError((err as BffError).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="auth-brand">
        <span className="mark">N</span>
        <span className="name">Nahu Admin</span>
      </div>
      <h1 className="auth-title">Sign in</h1>
      <p className="auth-sub">Administrator access to the Nahu platform.</p>

      {error ? <div className="form-error">{error}</div> : null}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={submitting}
        >
          {submitting ? "Signing in…" : "Continue"}
        </button>
      </form>

      <p className="auth-footer">
        Multi-factor authentication is required for all admin accounts.
      </p>
    </div>
  );
}

"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { bffPost, type BffError } from "@/lib/client";

type Step = "password" | "enroll" | "recovery";

function StepIndicator({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "password", label: "1. Password" },
    { id: "enroll", label: "2. Authenticator" },
    { id: "recovery", label: "3. Recovery codes" },
  ];
  return (
    <div className="step-indicator">
      {steps.map((step) => (
        <span key={step.id} className={step.id === current ? "current" : ""}>
          {step.label}
        </span>
      ))}
    </div>
  );
}

function AcceptInviteFlow() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("token") ?? "";

  const [step, setStep] = useState<Step>("password");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  const [enrollment, setEnrollment] = useState<{
    otpauthUrl: string;
    secret: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  async function handleAccept(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setSubmitting(true);
    try {
      await bffPost("/api/auth/invitations/accept", {
        token: inviteToken,
        password,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(phone ? { phone } : {}),
      });
      const enrolled = await bffPost<{ otpauthUrl: string; secret: string }>(
        "/api/auth/mfa/enroll/totp",
        {},
      );
      setEnrollment(enrolled);
      setStep("enroll");
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
      const result = await bffPost<{
        verified: boolean;
        recoveryCodes: string[];
      }>("/api/auth/mfa/enroll/totp/confirm", { totpCode: totpCode.trim() });
      setRecoveryCodes(result.recoveryCodes);
      setStep("recovery");
    } catch (err) {
      setError((err as BffError).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!inviteToken) {
    return (
      <div className="auth-card">
        <div className="auth-brand">
          <span className="mark">N</span>
          <span className="name">Nahu Admin</span>
        </div>
        <h1 className="auth-title">Invitation link invalid</h1>
        <p className="auth-sub">
          This page requires an invitation token. Please open the invitation
          link you were sent, or ask an administrator to issue a new one.
        </p>
        <p className="auth-footer">
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="auth-card wide">
      <div className="auth-brand">
        <span className="mark">N</span>
        <span className="name">Nahu Admin</span>
      </div>
      <StepIndicator current={step} />

      {error ? <div className="form-error">{error}</div> : null}

      {step === "password" ? (
        <>
          <h1 className="auth-title">Accept your invitation</h1>
          <p className="auth-sub">
            Set a password to activate your admin account. MFA enrollment
            follows immediately after.
          </p>
          <form onSubmit={handleAccept}>
            <div className="field">
              <label htmlFor="firstName">First name (optional)</label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="lastName">Last name (optional)</label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="phone">Phone (optional)</label>
              <input
                id="phone"
                type="tel"
                placeholder="+2519XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <span className="hint">
                Ethiopian format +251XXXXXXXXX. Required if your invitation did
                not include a phone number.
              </span>
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="hint">At least 10 characters.</span>
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={submitting}
            >
              {submitting ? "Setting up…" : "Set password & continue"}
            </button>
          </form>
        </>
      ) : null}

      {step === "enroll" && enrollment ? (
        <>
          <h1 className="auth-title">Set up your authenticator</h1>
          <p className="auth-sub">
            Add Nahu Admin to your authenticator app (Google Authenticator,
            1Password, Aegis, etc.), then confirm with a generated code.
          </p>
          <p style={{ fontSize: 14, marginBottom: 6 }}>
            <strong>Option A —</strong> open this link on the device with your
            authenticator app:
          </p>
          <div className="secret-box">
            <a href={enrollment.otpauthUrl}>{enrollment.otpauthUrl}</a>
          </div>
          <p style={{ fontSize: 14, marginBottom: 6 }}>
            <strong>Option B —</strong> enter this secret key manually:
          </p>
          <div className="secret-box">{enrollment.secret}</div>
          <form onSubmit={handleConfirm}>
            <div className="field">
              <label htmlFor="totpCode">6-digit code from your app</label>
              <input
                id="totpCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                minLength={6}
                maxLength={8}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={submitting}
            >
              {submitting ? "Confirming…" : "Confirm & finish enrollment"}
            </button>
          </form>
        </>
      ) : null}

      {step === "recovery" ? (
        <>
          <h1 className="auth-title">Save your recovery codes</h1>
          <p className="auth-sub">
            These single-use codes are shown <strong>only once</strong>. Store
            them somewhere safe — each can sign you in if you lose access to
            your authenticator.
          </p>
          <div className="recovery-grid">
            {recoveryCodes.map((code) => (
              <code key={code}>{code}</code>
            ))}
          </div>
          <div className="form-success">
            Your account is active and MFA is enrolled.
          </div>
          <Link href="/login" className="btn btn-primary btn-block">
            Go to sign in
          </Link>
        </>
      ) : null}
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="auth-card">
          <div className="loading">Loading invitation…</div>
        </div>
      }
    >
      <AcceptInviteFlow />
    </Suspense>
  );
}

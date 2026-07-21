"use client";

import { Suspense } from "react";
import VerificationQueuePage from "./queue-client";

export default function VerificationPage() {
  return (
    <Suspense fallback={<p className="muted">Loading verification queue…</p>}>
      <VerificationQueuePage />
    </Suspense>
  );
}

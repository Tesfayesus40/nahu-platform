/**
 * D10 — Proof of Delivery rules (pure).
 * Controllers/UI must not reimplement; ProofOfDeliveryService owns POD lifecycle.
 */

import {
  PodMethod,
  isValidPodCapture,
} from './shipment.domain.rules';

export type PodErrorCode =
  | 'SHIPMENT_NOT_FOUND'
  | 'STOP_NOT_FOUND'
  | 'INVALID_STATUS'
  | 'POD_REQUIREMENTS_FAILED'
  | 'OTP_INVALID'
  | 'OTP_REQUIRED'
  | 'PHOTO_REQUIRED'
  | 'GPS_REQUIRED'
  | 'RECIPIENT_REQUIRED'
  | 'SIGNATURE_NOT_SUPPORTED'
  | 'NOT_ASSIGNED_COURIER';

export class PodDomainError extends Error {
  constructor(
    public readonly code: PodErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PodDomainError';
  }
}

export type PodRequirements = {
  otpRequired: boolean;
  photoRequired: boolean;
  gpsRequired: boolean;
  recipientNameRequired: boolean;
};

export type PodCaptureInput = {
  otpCode?: string | null;
  photoUrl?: string | null;
  mediaUrls?: string[] | null;
  recipientName?: string | null;
  lat?: number | null;
  lng?: number | null;
  accuracyM?: number | null;
  notes?: string | null;
  /** Schema-ready only — must not be required in D10. */
  signatureUrl?: string | null;
  signaturePayloadJson?: unknown;
  stopId?: string | null;
};

export const POD_EVENT_TYPES = {
  started: 'delivery.pod.started',
  verified: 'delivery.pod.verified',
  failed: 'delivery.pod.failed',
  captured: 'delivery.pod.captured',
} as const;

export function derivePodMethod(requirements: PodRequirements): PodMethod {
  if (requirements.photoRequired && requirements.otpRequired) {
    return 'PHOTO_AND_OTP';
  }
  if (requirements.photoRequired) return 'PHOTO';
  if (requirements.otpRequired) return 'OTP';
  if (requirements.gpsRequired) return 'GPS_ONLY';
  return 'PHOTO';
}

export function hashDeliveryOtp(code: string): string {
  // Deterministic non-crypto hash for verification (OTP is short-lived).
  // Uses FNV-1a 32-bit + salt prefix so plaintext is never stored.
  const normalized = code.trim();
  let hash = 0x811c9dc5;
  const input = `nahu-pod-otp:${normalized}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function generateDeliveryOtp(length = 6): string {
  const digits = '0123456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += digits[Math.floor(Math.random() * 10)];
  }
  // Avoid trivial all-zeros
  if (/^0+$/.test(out)) out = '1' + out.slice(1);
  return out;
}

export function verifyDeliveryOtp(
  code: string | null | undefined,
  expectedHash: string | null | undefined,
): boolean {
  if (!code || !expectedHash) return false;
  return hashDeliveryOtp(code) === expectedHash;
}

/**
 * Validate capture against configurable requirements + method shape.
 * Signature capture is schema-ready but not required/accepted as a requirement in D10.
 */
export function validatePodAgainstRequirements(input: {
  requirements: PodRequirements;
  capture: PodCaptureInput;
  otpVerified: boolean;
  capturedAt: Date;
}): { ok: true; method: PodMethod } | { ok: false; error: PodDomainError } {
  const { requirements, capture, otpVerified, capturedAt } = input;

  if (capture.signatureUrl || capture.signaturePayloadJson) {
    return {
      ok: false,
      error: new PodDomainError(
        'SIGNATURE_NOT_SUPPORTED',
        'Signature capture is not enabled yet',
      ),
    };
  }

  if (requirements.otpRequired && !otpVerified) {
    return {
      ok: false,
      error: new PodDomainError(
        'OTP_REQUIRED',
        'Valid delivery OTP is required',
      ),
    };
  }

  const hasPhoto =
    Boolean(capture.photoUrl?.trim()) ||
    (Array.isArray(capture.mediaUrls) && capture.mediaUrls.length > 0);
  if (requirements.photoRequired && !hasPhoto) {
    return {
      ok: false,
      error: new PodDomainError(
        'PHOTO_REQUIRED',
        'Delivery photo reference is required',
      ),
    };
  }

  const hasGps =
    capture.lat != null &&
    capture.lng != null &&
    Number.isFinite(capture.lat) &&
    Number.isFinite(capture.lng);
  if (requirements.gpsRequired && !hasGps) {
    return {
      ok: false,
      error: new PodDomainError(
        'GPS_REQUIRED',
        'GPS coordinates are required',
      ),
    };
  }

  if (
    requirements.recipientNameRequired &&
    !capture.recipientName?.trim()
  ) {
    return {
      ok: false,
      error: new PodDomainError(
        'RECIPIENT_REQUIRED',
        'Recipient name is required',
      ),
    };
  }

  const anyRequired =
    requirements.otpRequired ||
    requirements.photoRequired ||
    requirements.gpsRequired ||
    requirements.recipientNameRequired;

  const method = derivePodMethod(requirements);
  if (!anyRequired) {
    return { ok: true, method };
  }

  const shape = isValidPodCapture({
    method,
    photoUrl: capture.photoUrl,
    mediaUrls: capture.mediaUrls,
    signatureUrl: null,
    otpVerified,
    lat: capture.lat,
    lng: capture.lng,
    recipientName: capture.recipientName,
    capturedAt,
  });
  if (!shape.ok) {
    return {
      ok: false,
      error: new PodDomainError('POD_REQUIREMENTS_FAILED', shape.reason),
    };
  }

  return { ok: true, method };
}

/** Sanitized POD for farmer/buyer — no OTP codes, photo URLs, or GPS. */
export function toPartyPodStatus(pod: {
  id: string;
  method: string;
  capturedAt: Date | string;
  otpVerified: boolean;
  photoUrl?: string | null;
  lat?: number | null;
  lng?: number | null;
  recipientName?: string | null;
} | null) {
  if (!pod) {
    return {
      status: 'NONE' as const,
      verified: false,
      hasPhoto: false,
      otpVerified: false,
      hasGps: false,
      capturedAt: null,
    };
  }
  return {
    status: 'VERIFIED' as const,
    verified: true,
    hasPhoto: Boolean(pod.photoUrl),
    otpVerified: Boolean(pod.otpVerified),
    hasGps: pod.lat != null && pod.lng != null,
    capturedAt: pod.capturedAt,
    method: pod.method,
    // recipient first name only — no OTP / photo URL / coordinates
    recipientPresent: Boolean(pod.recipientName?.trim()),
  };
}

/** Admin read-only POD view (includes GPS + photo availability, not OTP code). */
export function toAdminPodView(pod: {
  id: string;
  stopId: string;
  attemptNo: number;
  method: string;
  photoUrl: string | null;
  mediaUrls: string[];
  signatureUrl: string | null;
  otpVerified: boolean;
  otpVerifiedAt: Date | null;
  otpReference: string | null;
  recipientName: string | null;
  lat: number | null;
  lng: number | null;
  accuracyM: number | null;
  capturedAt: Date;
  capturedByUserId: string | null;
  notes: string | null;
}) {
  return {
    id: pod.id,
    stopId: pod.stopId,
    attemptNo: pod.attemptNo,
    method: pod.method,
    recipientName: pod.recipientName,
    capturedAt: pod.capturedAt,
    capturedByUserId: pod.capturedByUserId,
    notes: pod.notes,
    otpVerified: pod.otpVerified,
    otpVerifiedAt: pod.otpVerifiedAt,
    otpReference: pod.otpReference,
    hasPhoto: Boolean(pod.photoUrl) || (pod.mediaUrls?.length ?? 0) > 0,
    photoUrl: pod.photoUrl,
    mediaCount: pod.mediaUrls?.length ?? 0,
    hasSignature: Boolean(pod.signatureUrl),
    gps:
      pod.lat != null && pod.lng != null
        ? { lat: pod.lat, lng: pod.lng, accuracyM: pod.accuracyM }
        : null,
  };
}

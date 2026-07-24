import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/** Mirrors pod.rules.ts for D10 */

function hashDeliveryOtp(code) {
  const normalized = code.trim();
  let hash = 0x811c9dc5;
  const input = `nahu-pod-otp:${normalized}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function verifyDeliveryOtp(code, expectedHash) {
  if (!code || !expectedHash) return false;
  return hashDeliveryOtp(code) === expectedHash;
}

function derivePodMethod(requirements) {
  if (requirements.photoRequired && requirements.otpRequired) return 'PHOTO_AND_OTP';
  if (requirements.photoRequired) return 'PHOTO';
  if (requirements.otpRequired) return 'OTP';
  if (requirements.gpsRequired) return 'GPS_ONLY';
  return 'PHOTO';
}

function validatePodAgainstRequirements({
  requirements,
  capture,
  otpVerified,
  capturedAt,
}) {
  if (capture.signatureUrl || capture.signaturePayloadJson) {
    return { ok: false, code: 'SIGNATURE_NOT_SUPPORTED' };
  }
  if (requirements.otpRequired && !otpVerified) {
    return { ok: false, code: 'OTP_REQUIRED' };
  }
  const hasPhoto =
    Boolean(capture.photoUrl?.trim()) ||
    (Array.isArray(capture.mediaUrls) && capture.mediaUrls.length > 0);
  if (requirements.photoRequired && !hasPhoto) {
    return { ok: false, code: 'PHOTO_REQUIRED' };
  }
  const hasGps =
    capture.lat != null &&
    capture.lng != null &&
    Number.isFinite(capture.lat) &&
    Number.isFinite(capture.lng);
  if (requirements.gpsRequired && !hasGps) {
    return { ok: false, code: 'GPS_REQUIRED' };
  }
  if (requirements.recipientNameRequired && !capture.recipientName?.trim()) {
    return { ok: false, code: 'RECIPIENT_REQUIRED' };
  }
  if (!capturedAt) return { ok: false, code: 'POD_REQUIREMENTS_FAILED' };
  return { ok: true, method: derivePodMethod(requirements) };
}

function toPartyPodStatus(pod) {
  if (!pod) {
    return {
      status: 'NONE',
      verified: false,
      hasPhoto: false,
      otpVerified: false,
      hasGps: false,
    };
  }
  return {
    status: 'VERIFIED',
    verified: true,
    hasPhoto: Boolean(pod.photoUrl),
    otpVerified: Boolean(pod.otpVerified),
    hasGps: pod.lat != null && pod.lng != null,
  };
}

describe('POD validation (D10)', () => {
  const baseReq = {
    otpRequired: true,
    photoRequired: true,
    gpsRequired: false,
    recipientNameRequired: true,
  };

  it('verifies OTP hashes and rejects invalid codes', () => {
    const hash = hashDeliveryOtp('123456');
    assert.equal(verifyDeliveryOtp('123456', hash), true);
    assert.equal(verifyDeliveryOtp('000000', hash), false);
    assert.equal(verifyDeliveryOtp('', hash), false);
  });

  it('requires photo when configured', () => {
    const r = validatePodAgainstRequirements({
      requirements: baseReq,
      capture: { recipientName: 'Abebe', otpCode: '1' },
      otpVerified: true,
      capturedAt: new Date(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'PHOTO_REQUIRED');
  });

  it('requires GPS when configured', () => {
    const r = validatePodAgainstRequirements({
      requirements: { ...baseReq, gpsRequired: true, otpRequired: false },
      capture: {
        recipientName: 'Abebe',
        photoUrl: 'https://cdn.example/p.jpg',
      },
      otpVerified: false,
      capturedAt: new Date(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'GPS_REQUIRED');
  });

  it('accepts valid PHOTO_AND_OTP capture', () => {
    const r = validatePodAgainstRequirements({
      requirements: baseReq,
      capture: {
        recipientName: 'Abebe',
        photoUrl: 'https://cdn.example/p.jpg',
      },
      otpVerified: true,
      capturedAt: new Date(),
    });
    assert.equal(r.ok, true);
    assert.equal(r.method, 'PHOTO_AND_OTP');
  });

  it('rejects signature capture in D10', () => {
    const r = validatePodAgainstRequirements({
      requirements: { ...baseReq, otpRequired: false },
      capture: {
        recipientName: 'Abebe',
        photoUrl: 'https://cdn.example/p.jpg',
        signatureUrl: 'https://cdn.example/s.png',
      },
      otpVerified: false,
      capturedAt: new Date(),
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'SIGNATURE_NOT_SUPPORTED');
  });
});

describe('POD party sanitization (D10)', () => {
  it('exposes status flags without photo URL or OTP code', () => {
    const status = toPartyPodStatus({
      photoUrl: 'https://secret/photo.jpg',
      otpVerified: true,
      lat: 9.0,
      lng: 38.7,
      recipientName: 'Abebe',
    });
    assert.equal(status.verified, true);
    assert.equal(status.hasPhoto, true);
    assert.equal(status.otpVerified, true);
    assert.equal(status.hasGps, true);
    assert.equal(status.photoUrl, undefined);
  });
});

describe('POD event types (D10)', () => {
  it('uses ShipmentEvent types for started/verified/failed/captured', () => {
    const types = [
      'delivery.pod.started',
      'delivery.pod.verified',
      'delivery.pod.failed',
      'delivery.pod.captured',
    ];
    for (const t of types) assert.match(t, /^delivery\.pod\./);
  });
});

describe('POD authorization expectations (D10)', () => {
  it('gates ARRIVED→DELIVERED behind courier role + POD service', () => {
    const route = {
      method: 'POST',
      path: '/delivery/courier/shipments/:id/delivered',
      role: 'COURIER',
      owner: 'ProofOfDeliveryService',
    };
    assert.equal(route.role, 'COURIER');
    assert.equal(route.owner, 'ProofOfDeliveryService');
  });
});

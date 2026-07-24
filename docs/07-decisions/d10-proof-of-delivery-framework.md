# D10 — Proof of Delivery (POD) Framework

**Status:** Implemented (dev) — pause for review before D11  
**Date:** 2026-07-23  
**Depends on:** D2 schema · D5 execution · D9 ops readiness  
**Repos:** `nahu-platform` · `nahu-buna-gebaya` (courier + shared tracking)

> **Note:** Roadmap v1.9 listed D10 as earnings hardening. Product gate redefined D10 as **POD Framework**; earnings remain deferred.

---

## 1. Service interaction

```text
Courier App (PodCapture)
        │
        ▼
CourierDeliveryController  POST …/delivered
        │
        ▼
DeliveryExecutionService.markDelivered
        │
        ▼
ProofOfDeliveryService ★ create / validate / verify / complete
        │
        ├─► ShipmentAggregateService.createPod + transitionStatus
        └─► DeliveryEventsPublisher (started / verified / failed / captured / delivered)
```

Boundaries unchanged: aggregate owns state; Dispatch owns assignment; Execution owns flow; AdminOps owns admin ops; POD is a **component of the Shipment aggregate**, not a parallel subsystem.

---

## 2. Lifecycle gate

```text
… → IN_TRANSIT → ARRIVED  ──(issue OTP if required)──►
                         │
                         ▼
              ProofOfDeliveryService
              (OTP / photo / GPS / recipient)
                         │
                         ▼
                    DELIVERED
```

ARRIVED → DELIVERED is **blocked** until configured POD requirements pass.

---

## 3. Configuration (`DeliveryConfigService`)

| Flag | Default | Effect |
|------|---------|--------|
| `delivery.pod.otp_required` | true | OTP must verify |
| `delivery.pod.photo_required` | true | photo URL / media required |
| `delivery.pod.gps_required` | false | lat/lng required |
| `delivery.pod.recipient_required` | true | recipient name required |

Migration: `ops/009_ops_delivery_pod_requirements.sql`.  
Signature columns remain schema-ready; capture rejected in D10.

---

## 4. Events (ShipmentEvent only)

| Type | When |
|------|------|
| `delivery.pod.started` | Capture attempt begins (success path) |
| `delivery.pod.verified` | Requirements satisfied |
| `delivery.pod.captured` | Pod row persisted |
| `delivery.pod.failed` | Invalid OTP / missing photo/GPS/recipient |
| `delivery.shipment.delivered` | After verified POD |

---

## 5. Surfaces

| Surface | Behavior |
|---------|----------|
| Courier | `PodCaptureScreen` → POST delivered with OTP/photo/recipient/GPS/notes |
| Admin | Read-only POD panel (recipient, timestamp, GPS, OTP status, photo link, notes) |
| Buyer | POD status + handoff PIN while ARRIVED (PIN cleared after verify) |
| Farmer | POD status only (no PIN, no photo URL, no OTP code) |

---

## 6. Out of scope

Earnings · payouts · AI · Maps · ETA · offline · push · signature capture UI

---

## 7. Next

**Paused for architectural review.** On approval → **D11**.

**Completion report:** [`docs/08-guides/d10-pod-framework-completion-report.md`](../08-guides/d10-pod-framework-completion-report.md)

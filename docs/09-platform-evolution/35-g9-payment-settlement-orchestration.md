# 35 — G9 Payment & Settlement Orchestration

**Status:** Implemented (backend orchestration layer)  
**Depends on:** RC1 Revenue Engine snapshots, pricing payment intent stubs, G8 fulfilment (independent)

---

## What shipped

| Area | Change |
|------|--------|
| Migration | `payments/001_payment_orchestration.sql` — cases, events, escrow ledger, settlement lines |
| Permissions | `identity/029` — `payment.read` / `payment.manage` |
| Rules | `payment-orchestration.rules.ts` — payment FSM + settlement plan from Revenue Engine |
| Providers | Interface + `TEST` + stub Telebirr/CBE/Chapa/… (no live gateways) |
| Services | Escrow, Settlement orchestrator, Refund orchestrator, Payment orchestration |
| APIs | Additive `/payments/orders/:id/*` + `/admin/payments/*` |
| RC1 hooks | createOrder → PENDING; confirm-payment → ESCROWED; complete → settle; dispute REFUND ack; cancel/decline → CANCELLED |

Out of scope: live Telebirr/CBE, finance reports, accounting, tax engine, AI fraud.

---

## Payment status machine

```
CREATED → PENDING → AUTHORIZED → CAPTURED → ESCROWED
  → PARTIALLY_SETTLED → SETTLED
Also: REFUNDED | FAILED | CANCELLED
```

RC1 shortcut: `CAPTURE_TO_ESCROW` (PENDING → ESCROWED) used by `confirm-payment`.

---

## Settlement (Revenue Engine)

Buyer charge in escrow → release lines:

- **FARMER** ← `farmer_payout_etb`
- **COURIER** ← `courier_payout_etb`
- **PLATFORM** ← buyer fee + farmer fee + delivery commission

---

## Additive APIs

- `GET /payments/orders/:orderId/status|escrow|settlement|refund|events`
- `POST /admin/payments/orders/:orderId/settle`
- `POST /admin/payments/orders/:orderId/refund` — reasons: `SELLER_REJECTION`, `BUYER_CANCELLATION`, `DELIVERY_FAILURE`, `ADMIN_CANCELLATION`

Existing `GET /payments/methods` and `PATCH /orders/:id/confirm-payment` unchanged in contract.

---

## Tests

```bash
cd apps/api
node --test src/payments/payment-orchestration.rules.test.mjs
npx prisma generate
npx tsc --noEmit
```

Apply `payments/001` + `identity/029` before using new tables.

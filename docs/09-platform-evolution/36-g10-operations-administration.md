# 36 — G10 Operations & Administration

**Status:** Implemented (additive admin ops APIs)  
**Depends on:** G7 sellers, G8 fulfilment, G9 payments, existing audit / dashboard

---

## What shipped

| Area | APIs |
|------|------|
| Ops dashboard | `GET /admin/ops/dashboard` |
| Health | `GET /admin/ops/health` — stuck orders, expired offers, pending settlements |
| Order inspection | `GET /admin/ops/orders/:orderId` — timeline + fulfilment + payment + audit |
| Sellers | `GET /admin/sellers`, `GET /admin/sellers/:id`, `POST /admin/sellers/:id/actions` (`VERIFY` / `REJECT` / `SUSPEND` / `ACTIVATE`) |
| Couriers | `GET /admin/ops/couriers`, `GET …/assignments`, `POST /admin/ops/shipments/:id/reassign` |
| Payments | `GET /admin/ops/payments`, `GET /admin/ops/payments/orders/:orderId` |
| Audit search | `GET /admin/ops/audit/search?domain=orders\|fulfilment\|payments\|sellers` |

No Marketplace / Fulfilment / Payment redesign. Existing `admin/dashboard/summary`, `admin/audit`, G8/G9 routes unchanged.

---

## Permissions

Reuses: `admin.dashboard.read`, `monitoring.read`, `orders.read`, `seller.read` / `seller.write`, `delivery.read` / `delivery.manage`, `payment.read`, `audit.read`.

---

## Tests

```bash
cd apps/api
node --test src/ops/ops.rules.test.mjs
npx tsc --noEmit
```

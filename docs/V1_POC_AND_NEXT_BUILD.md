# SHOP v1 — proof of concept baseline

Recorded 25 September 2026. Baseline commit: `143e96dadada489ab21c533a3575d08a47866ad8` on `fix/dev-csp-unsafe-eval-20260924` (draft PR #80).

This is a development baseline, not a production release or a claim that the admin and catalogue have passed full user acceptance testing. The local installation reported `/api/ready` with database, auth and contact configured; a user has entered varieties and identified the admin workload and sales gap as limits.

## What v1 does

- Stores varieties in PostgreSQL, with price, a manually edited stock quantity, and draft/published visibility.
- Lets one configured administrator create, edit and delete varieties.
- Lists published varieties publicly and offers an email enquiry link.
- Provides health/readiness checks and an authenticated admin surface.

## Known limits

- Email enquiries are not orders. There is no order record, checkout, payment processing, reservation, automatic stock deduction, stock movement history, or refund workflow.
- Stock is a manually edited number and can become stale if sales happen elsewhere.
- The admin list and one-by-one edit form will become cumbersome with many varieties.
- The local PostgreSQL installation is a test environment and is not a public shop deployment.

## Successive build: orders, inventory and payments

Implement in stages, preserving this v1 baseline as a point of comparison:

1. **Admin at scale.** Search, filter, paginate and sort varieties; support deliberate bulk updates where useful. Show published status and low-stock/unknown-stock states clearly.
2. **Inventory ledger.** Add recorded adjustments with quantity, reason, time and actor. Track stock in integer sale units (for example packets), with a clear policy for unknown stock, zero stock and concurrent edits. Migrate existing `Variety.stock` without silently changing its meaning.
3. **Orders before payments.** Add order and line-item records with an explicit state flow (for example pending, confirmed, fulfilled, cancelled), immutable price/quantity snapshots, and an admin workflow for manually confirmed enquiry orders. An enquiry alone must not reduce stock. A confirmed order must change stock once, atomically, and never take available stock below zero. Cancellation/restocking must be recorded.
4. **Hosted payment integration.** Select a suitable provider after confirming fees, UK availability, supported payment methods and operational needs. Use hosted checkout so the app does not handle card details. Verify signed webhooks, process them idempotently, reconcile payment/order state, and handle retries, failures and refunds. Decide and test reservation/expiry behaviour before accepting payment so two shoppers cannot buy the same last packet.
5. **Operational testing.** Cover simultaneous purchases, duplicate webhook delivery, abandoned checkout, sold-out items, manual adjustments during checkout, cancellation, refunds, database failure and admin access. Verify backup/restore and deployment before taking real orders.

Do not infer that payment success by itself guarantees fulfilment: inventory, payment and order state must reconcile, and the administrator must be able to see exceptions.

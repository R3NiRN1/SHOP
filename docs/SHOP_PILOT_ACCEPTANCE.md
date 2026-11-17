# SHOP disposable pilot — user acceptance sheet

Status: for testing the current **enquiry catalogue**, not a released multi-user e-commerce shop. Relates to [#99](https://github.com/R3NiRN1/SHOP/issues/99) and [roadmap](./SHOP_DELIVERY_ROADMAP.md).

## Scope and safety

Use an isolated local/staging PostgreSQL database with invented data. The automated browser suite intentionally refuses to clean data unless the local database is named `shop_test`, owned by `shop_test`. Do not run that suite against personal, user or production data. Never share live administrator credentials or make the test site publicly orderable. Any database migration or reset needs its own explicit verification.

PR #94 contains a proposed guided setup and Windows launcher but is **not** merged; until reviewed, follow the main README for local setup. Confirm `/api/ready` returns 200 before assessing admin/catalogue. Browser-based access on Android requires safe staging or an appropriate controlled local network, not an exposed development server.

## Pilot listings (fictional names, not real seed sales)

Enter about 15–20 example entries manually or as reviewable test fixtures, spanning broad beans, kale populations, squash and beans. Include multiple crops, long and short descriptions, zero stock, unknown stock, five-or-fewer stock, unpublished entries and different prices. Mark all data explicitly as test material, not validated seed provenance or guaranteed saleable stock.

## Human task checklist

| Task | Expected result | Record result |
| --- | --- | --- |
| Start and health | App starts; health and readiness clearly distinguish server from database/config status | PASS / FAIL / N/A |
| Visitor browse | Public home and catalogue render without signing in | PASS / FAIL / N/A |
| Published/draft | Draft is absent publicly, visible to authorised admin | PASS / FAIL / N/A |
| Stock language | Zero shows sold out; unknown shows stock TBC; low stock is distinguishable | PASS / FAIL / N/A |
| Contact | When configured, an enquiry link opens a compose action for the correct variety | PASS / FAIL / N/A |
| Failed sign-in | Bad password is rejected without opening admin | PASS / FAIL / N/A |
| Admin CRUD | Create, edit, unpublish and delete one fictional seed entry; verify persist/reload | PASS / FAIL / N/A |
| Form and errors | Try missing name, duplicate slug, decimal price and malformed stock; check clear error messages | PASS / FAIL / N/A |
| Accessibility | Keyboard only: sign in, move through form, submit and return; check contrast/focus/zoom | PASS / FAIL / N/A |
| Mobile | Verify public catalogue and admin form at narrow width and on an Android browser when accessible | PASS / FAIL / N/A |
| Recovery | Disconnect disposable DB to verify graceful errors and restore service; never substitute demo stock | PASS / FAIL / N/A |

## Do not interpret as passed

Named grower accounts, MFA, seed lot tracking, stock movements, recorded orders, payment flows, customer records and live deployment are **not implemented** on the current main branch. They require later roadmap milestones and separate verification.

## What to capture

Record date and app commit, Windows/Android and browser version, test environment, pass/fail per task, a short reproduction for each defect, screenshot only when no personal data is exposed, severity and retest outcome. Link the resulting evidence to issue #99.

## Automated coverage

`apps/web/e2e/shop.e2e.ts` covers login failures, role-protected admin CRUD, published filtering, CSP, readiness and an expanded sold-out/low-stock/unknown/draft seed-state scenario. GitHub CI performs these checks on a disposable PostgreSQL database and built application. They are necessary but not a substitute for actual human usability or a production security assessment.

## Existing PR review gate

Review PR #94 for installer/recovery/startup experience after rebasing it onto current `main`; do not assume its October checks certify the November release. PR #91 overlaps preview/CSP. PR #82 contains large order/payment changes but should be split into small risk-bounded increments with migrations separately rehearsed. Do not merge these branches wholesale merely to complete the pilot.

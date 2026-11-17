# SHOP delivery roadmap — reusable platform + Living Seeds CIC profile

Status: implementation plan (not a production certification). Approved scope must be verified by code, green CI and human acceptance. Started 17 November 2026. Source of truth for milestones is [programme issue #98](https://github.com/R3NiRN1/SHOP/issues/98) and its linked issues. The current `main` application is a single-administrator enquiry catalogue, **not** a multi-user shop or online checkout.

## Goals and constraints

1. Create a clear, accessible, secure seed catalogue and operational shop that is inexpensive for a small CIC to run.
2. Enable several **independently authenticated** staff and growers, with least-privilege permissions and restricted personal/customer data.
3. Support seed populations, local adaptation, grower provenance, seed lots and multiple pack sizes. Attribution does not imply genetic-resource ownership.
4. Support public enquiries and manual orders first; optional hosted card payments only after stock accounting and fulfilment are reliable.
5. Keep the core platform reusable. Living Seeds settings and community modes are an optional **per-deployment** profile; separate shops have separate deployments/databases/secrets. Multi-tenancy is **out of scope**.
6. Make development reproducible and increasingly automated, while protecting the user's time and budget. Shipping real orders, purchasing services, moving production data or accepting live payments are never unattended actions.

## Baseline: preserve and reuse

| Existing work | Status/decision |
| --- | --- |
| `main` after #97 | CI and security checks passed at the dependency fix; still enquiry-only, single configured admin |
| [#53](https://github.com/R3NiRN1/SHOP/issues/53) | Protected Grower/Story CRUD proposed; revisit with permissions and provenance |
| [#81](https://github.com/R3NiRN1/SHOP/issues/81) | Orders, inventory and payments parent; keep open |
| [PR #82](https://github.com/R3NiRN1/SHOP/pull/82) | ~1,900 lines of implementation, unmerged/conflicted; review for safe extraction in small PRs, do **not** merge as-is |
| [PR #94](https://github.com/R3NiRN1/SHOP/pull/94) | Guided Windows setup/recovery, previously green; review/rebase and re-test before adoption |
| [PR #91](https://github.com/R3NiRN1/SHOP/pull/91) | Preview/CSP overlap; check for already incorporated changes |
| [#98](https://github.com/R3NiRN1/SHOP/issues/98) | Master programme and decision register |

## Delivery order

| Stage | Tracking | First useful result | Gate |
| --- | --- | --- | --- |
| M0 — reliable pilot | [#99](https://github.com/R3NiRN1/SHOP/issues/99) | Windows installation, sample catalogue and admin test session | Reproducible disposable DB + startup + all CI checks |
| M1 — seed provenance | [#100](https://github.com/R3NiRN1/SHOP/issues/100), #53 | Varieties and evolving populations with distinct, traceable harvest lots and packet units | Migration rehearsal, stock unit policy, provenance and privacy tests |
| M2 — named users | [#101](https://github.com/R3NiRN1/SHOP/issues/101) | Separate admin, editor and grower login with MFA | Negative role-isolation tests + audited revocation |
| M2 — usability and accessibility | [#102](https://github.com/R3NiRN1/SHOP/issues/102) | Searchable public/admin catalogues, keyboard and mobile journeys | Usability pilot and WCAG 2.2 AA test evidence |
| M3 — stock/orders | [#103](https://github.com/R3NiRN1/SHOP/issues/103), #81 | Manual orders, inventory ledger, packing/dispatch flow | Atomic, once-only stock updates incl. concurrent last-unit attempts |
| M4 — Living Seeds profile | [#105](https://github.com/R3NiRN1/SHOP/issues/105) | Customisable network shop with distribution/exchange modes | Generic-shop regression + seed-network scenario tests |
| M4 — optional hosted payment | [#104](https://github.com/R3NiRN1/SHOP/issues/104) | Test-mode checkout, refunds and reconciliation | Verified webhook/idempotency/reservation, explicit live-mode approval |
| M5 — operational launch | [#106](https://github.com/R3NiRN1/SHOP/issues/106) | Controlled staging acceptance and deployment plan | Owner approval, legal checks, backup restore, accessibility + security review |

Stages may overlap only where domain models and permissions are stable. Do **not** build payments ahead of stock integrity. Prefer the smallest testable increment in each stage.

## Seed-domain decisions to resolve early

- **Variety versus seed lot:** a variety or genetically diverse population can have several harvest lots from different growers/years. Prices and saleable stock attach to correctly identified pack options/lots, not to an ambiguous aggregate `Variety.stock`.
- **Population records:** open-pollinated named variety, landrace, heterogeneous/evolving population, crowd-breeding project and trial material must be clearly distinguishable without implying exclusive ownership, genetic uniformity, certification or sale eligibility.
- **Source and traceability:** region, grower/steward attribution (consent controlled), harvest year, lot identifier, germination test with date, pack quantity and optional cultural notes. Do not invent missing data; unknown is a valid state.
- **Inventory and money:** integer units, atomic reservations/deductions, immutable order-line price snapshots, auditable adjustments, cancellations and restocking. No order can be confirmed twice or drive stock below zero.
- **Distribution mode:** enquiry/manual sale, future paid checkout, no-cost exchange and membership allocation need distinct transaction/stock rules. Unpriced trial material must not be presented as saleable.
- **Data protection:** customer addresses and order history are not visible to unrelated growers. Public grower stories/attribution are opt-in; separate subscribers from customer data.
- **Legal gate:** before any public marketing/selling, research current applicable UK seed-marketing categories/authorisations, labelling and product representations. Record decisions and reviewers; no generic legal exemption is assumed for enquiries, swaps or heterogeneous populations.

## Role/permission target

| Actor | Public browse | Own grower/lot contributions | All seed catalogue | Orders/customer PII | Accounts / security |
| --- | --- | --- | --- | --- | --- |
| Visitor/guest | Yes | No | Published only | Own order via protected token when implemented | No |
| Grower | Yes | Scoped create/edit (approval workflow) | Published only | No | Own profile only |
| Editor/stock steward | Yes | Assigned contributions | Draft/stock within explicit scope | No by default | No |
| Fulfilment operator | Yes | View permitted lot metadata | Read needed for packing | Assigned operational orders only | No |
| Shop admin/owner | Yes | Yes | Yes | Yes as necessary | Invite/revoke/audit with MFA |

Final permissions must be enforced in database/API operations and verified with negative tests; UI hiding alone is insufficient. Public customer accounts are optional; do not force registration to enquire or buy.

## Acceptance tests: automate where possible

**Every PR:** pinned frozen install, dependency audit, Prisma generation/migrations, lint, typecheck, unit tests, disposable PostgreSQL integration, Chromium browser journeys, CodeQL/security scan, standalone Linux release and PR contract. Build/test must use the PR head and then the merge candidate. No weakening tests or ignoring advisories to obtain green checks.

**Seed catalogue:** publish/unpublish, two growers and two lots for one variety, zero/unknown stock, distinct packet sizes, revoked grower, private provenance, migration preservation and generic-shop configuration.

**Identity:** independent sessions, MFA, blocked cross-grower reads/writes, privileged action audit, session revoke, recovery, same-origin protection and throttling.

**Orders:** two simultaneous orders for last packet, repeated confirmation, duplicate webhook, missed webhook, abandoned payment, manual stock adjustment, cancellation/refund, isolated DB rollback and preserved order-line price/quantity.

**Human acceptance:** representative Windows and Android use; public finding and enquiring, admin entering/editing 20 varieties, grower updating their own lot, packing and issuing refunds, keyboard-only tasks, visible focus, 200–400% zoom, NVDA/VoiceOver checks. Record defects and retest.

## Release stages and safety

- **Development:** disposable data, local services, no public sales.
- **Pilot/staging:** realistic fabricated listings and dedicated accounts, isolated database and credentials, access limited; no real customer information, no real payments.
- **Controlled live:** only after signed acceptance, provisioned host, HTTPS, WAF/distributed throttling, secret management, database backups and demonstrated restore, monitoring/alerts, UK compliance review, accessibility evidence, privacy/retention and terms.
- **Payments live:** separate decision from shop deployment. Hosted checkout, merchant credentials, signed webhooks and incident/reconciliation plan required.
- **Rollback:** keep a reviewed prior application artifact; do not assume a database migration can be reversed. Backup and migration rehearsals before changing real data.

## Automated development operating contract

1. Each run reads [#98](https://github.com/R3NiRN1/SHOP/issues/98), this document, active issues, open PRs and latest GitHub Actions results.
2. Prefer correcting failed or conflicted PRs before starting a new feature. Never duplicate #82 or #94 without comparative review.
3. Select **one** unblocked, low-risk, reviewable piece of work (or a bounded code review) with explicit acceptance tests; leave a clear GitHub trail.
4. Change code/tests on a branch; open a PR with `## Summary`, `## Acceptance Criteria`, `## Changes`, `## Verification`, `## Risk & Rollback` and `ALLOW_CONFIG_CHANGE` only when configuration actually changes.
5. Re-check normal CI/security results and address failures caused by the change if feasible. A failing or untested PR stays open and is not marked done.
6. Never auto-merge, auto-release, change production data, enable billing/payment, provision paid services, change ownership/permissions, or force-push.
7. Communicate only verified completed changes, blocking questions and a direct next action. Avoid routine notifications when nothing substantive changed.
8. If future automation lacks repository write/tools/test-run access, stop and report the limitation rather than claiming work was performed.

See `docs/SHOP_AUTOMATION_PLAYBOOK.md` for the execution loop.

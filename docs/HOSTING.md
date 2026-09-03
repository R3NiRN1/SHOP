# SHOP hosting, installation and maintenance guide

Status: provider-neutral deployment runbook
Applies to: the enquiry-based SHOP application on `main`
Target architecture: existing website plus an isolated managed application service and managed PostgreSQL
Last verified: 3 September 2026

## 1. Recommended topology

Keep the existing public website and SHOP operationally separate:

```text
www.example.org    existing website / WordPress
shop.example.org   SHOP application
                         |
                         +-- private connection --> managed PostgreSQL
```

The SHOP service should run on a paid managed application or container platform. PostgreSQL should run as a managed service in the same region and, where the provider supports it, communicate with SHOP over a private network. The public application edge must provide HTTPS, request-size and timeout controls, distributed rate limiting, and protection against common denial-of-service traffic.

A subdomain is the preferred first deployment. It avoids introducing path rewriting, full-page cache exclusions, authentication-cookie scope and proxy-header ambiguity into the initial release. A later `/shop` reverse proxy can be evaluated after the subdomain deployment is stable.

If the existing website is hosted on 34SP WordPress Hosting, 34SP documents support for proxying a path to a remote non-WordPress service. Before using that option, obtain written confirmation that `/shop/api/*`, `/shop/admin/*` and `/shop/api/auth/*` can bypass every full-page cache. Never cache authenticated, personalised or nonce-bearing HTML.

## 2. Current application boundaries

The current release is:

- a Next.js 16.3.4 standalone Node.js application;
- pinned to Node.js 24.20.0 and pnpm 11.25.0 for build and verification;
- backed by PostgreSQL through Prisma 7.10.0;
- an enquiry catalogue, not a payment-card processing system;
- configured for one production administrator; and
- designed as one shop per deployment.

The schema has no tenant or shop identifier. Do not place unrelated shops in one database and assume their data is isolated. Until multi-tenancy is separately designed and tested, deploy each shop with its own domain, service, database and secrets.

## 3. Provider acceptance requirements

Reject a provider or plan that cannot satisfy every mandatory item.

| Area | Mandatory requirement | Preferred evidence |
| --- | --- | --- |
| Runtime | Linux x64; persistent Node service; Node 24.20.0 or a container that pins it; configurable start command and port | Successful boot of the verified standalone artifact |
| Database | Supported PostgreSQL; encrypted connection; restricted credentials; export and restore | Private networking and point-in-time recovery |
| Edge | Custom domain, TLS, HTTP-to-HTTPS redirect, request limits and distributed rate limiting | Managed WAF and DDoS mitigation |
| Secrets | Encrypted runtime secret store; values excluded from source, image layers and logs | Scoped deployment identities and audited access |
| Operations | Health checks, restart on failure, logs, metrics and alerts | Deployment history and instant application rollback |
| Backups | Automated database backups plus downloadable logical export | Documented retention and a tested isolated restore |
| Access | MFA for every privileged account; least-privilege roles | Passkeys, audit logs and separate billing/technical roles |
| Data governance | Named data region, data-processing agreement and subprocessors | UK or suitable European region with documented transfers |
| Portability | Standard PostgreSQL export and application artifact/image export | No proprietary database features required by SHOP |
| Support | Published incident/status route and recoverable account ownership | Human support appropriate to the shop's service level |

Free tiers are not acceptable for production when they sleep, omit backups, provide only ephemeral storage, or exclude meaningful support and recovery.

## 4. Information required before installation

Record these values in the deployment change record:

- provider, account owner, plan and billing owner;
- application and database region;
- production domain and DNS administrator;
- service size, scaling limits and expected traffic;
- PostgreSQL version, database name and connection/pooling method;
- backup frequency, retention, restore owner and recovery objectives;
- WAF and distributed rate-limit controls;
- log retention and security-alert recipients;
- deployment identity and repository access scope;
- maintenance window and rollback decision owner; and
- whether the database is new or already contains SHOP data.

Do not install against an existing database until its schema and migration history have been inspected under `docs/RELEASE.md`.

## 5. Production configuration

Store all values in the provider's runtime secret/configuration store. Never commit them, place them in an image, paste them into an issue, or print them in build logs.

| Variable | Requirement |
| --- | --- |
| `DATABASE_URL` | PostgreSQL URL for a least-privilege application role; use the provider's private endpoint where possible |
| `AUTH_SECRET` or `NEXTAUTH_SECRET` | Cryptographically random value of at least 32 characters |
| `ADMIN_EMAIL` | Real administrator email; not an example or CI value |
| `ADMIN_PASSWORD` | Unique password of at least 16 characters; store it in a password manager |
| `SHOP_CONTACT_EMAIL` | Monitored enquiry destination |
| `NEXTAUTH_URL` | Canonical origin-only HTTPS URL, such as `https://shop.example.org` |
| `TRUST_PROXY_HEADERS` | Leave unset/false until the provider confirms it overwrites and sanitises forwarding headers |
| `READINESS_DETAILS` | Leave unset/false on a public endpoint |
| `ENABLE_STARTER_CATALOG` | Leave unset/false; production code refuses demo data |

Run `pnpm doctor` in a production-shaped administrative environment before release. Treat every warning as unresolved until it has written justification.

## 6. Installation procedure

### 6.1 Approve the release candidate

1. Select an exact commit on `main`.
2. Confirm CI, PostgreSQL integration, Browser E2E, CodeQL, Release Build and the PR contract are green for that commit.
3. Download the matching Linux x64 Release Build artifact.
4. Retain the GitHub artifact checksum and verify the inner archive checksum.
5. Read `RELEASE-MANIFEST.txt` and confirm the source SHA and runtime versions.

The precise artifact verification and extraction commands are maintained in `docs/RELEASE.md`.

### 6.2 Provision the platform

1. Create the managed PostgreSQL service in the chosen region.
2. Create a dedicated database and restricted application credential.
3. Enable automated backups and take an initial logical export.
4. Prove that the export can be restored into an isolated database.
5. Create the managed application service in the same region.
6. Configure its internal port from `PORT`; do not expose the Node process directly without the platform edge or reverse proxy.
7. Add the production variables through the provider's secret store.
8. Configure `/api/health` as the liveness path and `/api/ready` as the dependency-readiness path if the platform distinguishes them.
9. Configure restart-on-failure, graceful termination, log capture and alerts.

### 6.3 Apply the database migration

For a new empty database, run from the exact approved source release with the production `DATABASE_URL` supplied securely:

```bash
pnpm -C apps/web exec prisma migrate status
pnpm -C apps/web exec prisma migrate deploy
pnpm -C apps/web exec prisma migrate status
```

For an existing database, stop and follow the backup, schema comparison, restore rehearsal and baseline procedure in `docs/RELEASE.md`. Never use `prisma db push` in production. Never mark a migration as applied merely to suppress an error.

### 6.4 Start the verified standalone service

After verifying and extracting the release artifact, start from its application directory:

```bash
cd release/apps/web
PORT=3001 HOSTNAME=0.0.0.0 node server.js
```

Use the provider-assigned `PORT` in production. The platform must terminate HTTPS before forwarding traffic to this internal service. It must not expose the internal database publicly merely to connect the application.

If the provider builds from source instead of consuming the verified artifact, pin the repository commit, Node and pnpm versions, use `pnpm install --frozen-lockfile`, run Prisma generation, and reproduce the repository's Release Build assembly and smoke test. Record that this is a separate build from the GitHub-verified artifact.

### 6.5 Configure DNS and HTTPS

1. Add `shop.example.org` as the platform custom domain.
2. Add only the DNS records specified by the selected provider.
3. Confirm certificate issuance and automatic renewal.
4. Confirm HTTP redirects to HTTPS.
5. Set `NEXTAUTH_URL` to the final HTTPS origin and restart the service.
6. Keep the existing website and SHOP DNS records independently reversible.

### 6.6 Configure edge protection

At minimum, configure:

- provider-level distributed throttling for authentication, administrative writes and public APIs;
- request-body limits and sane connection/request timeouts;
- bot/DDoS protection appropriate to a public catalogue;
- no shared caching of `/admin/*`, `/api/*`, `/api/auth/*` or HTML containing CSP nonces;
- security alerts for repeated authentication failures and unusual error rates; and
- forwarding-header sanitisation before considering `TRUST_PROXY_HEADERS=true`.

The in-process limiter is a secondary control only. It does not coordinate counters across replicas and resets when an instance restarts.

## 7. Deployment acceptance test

Complete and record all checks before linking the public website to SHOP:

- [ ] `GET /api/health` returns HTTP 200.
- [ ] `GET /api/ready` returns HTTP 200.
- [ ] `GET /` and `GET /varieties` return HTTP 200 over the canonical HTTPS domain.
- [ ] HTTP redirects to HTTPS without a redirect loop.
- [ ] An unauthenticated administrative mutation is rejected.
- [ ] The administrator can sign in and create, edit, publish, unpublish and delete one controlled test variety.
- [ ] An unpublished variety does not appear publicly.
- [ ] A conflicting cross-origin write is rejected.
- [ ] CSP script nonces exist and differ between requests.
- [ ] Authenticated and nonce-bearing responses are not stored in a shared cache.
- [ ] Application-to-database traffic uses the intended private or restricted path.
- [ ] Logs contain no secrets, credentials or full database URLs.
- [ ] Alerts reach the named recipient.
- [ ] The previous application artifact remains available for rollback.

## 8. Accessibility acceptance

Hosting does not establish accessibility conformance. Target WCAG 2.2 Level AA for the public catalogue and administrator workflow.

Before launch:

- add automated Axe checks to the Playwright suite;
- complete every public and administrator action using only a keyboard;
- confirm visible, logical and unobscured focus;
- test meaningful headings, labels, link names, status messages and errors;
- verify text and non-text contrast;
- test at 200% and 400% zoom without loss of content or function;
- test mobile reflow and pointer targets;
- respect reduced-motion preferences;
- test current NVDA with a supported Windows browser; and
- test VoiceOver on Safari/iOS where practical.

Automated checks cannot replace assistive-technology and human task testing. Record defects, affected tasks, severity, remediation and retest evidence. Do not claim WCAG conformance until the defined pages and processes have been evaluated.

## 9. Maintenance schedule

### Continuous / automated

- Monitor liveness, readiness, error rate, latency, resource saturation and certificate status.
- Alert on failed deployments, failed backups, authentication anomalies and database exhaustion.
- Retain application and platform audit logs for the approved period.

### Daily or each working day

- Review service, database and security alerts.
- Confirm the latest scheduled database backup succeeded.
- Check enquiries reach the monitored mailbox.

### Weekly

- Review error trends, rejected requests, authentication failures and resource usage.
- Confirm the production domain, catalogue and administrator sign-in operate normally.
- Review provider incident notices and outstanding dependency alerts.

### Monthly

- Export a logical PostgreSQL backup to independently controlled encrypted storage.
- Review privileged users, MFA status, deployment identities and repository access.
- Review spending, capacity and rate-limit effectiveness.
- Triage dependency and framework updates; never update production directly.
- Run automated accessibility tests and recheck changed journeys manually.

### Quarterly

- Restore a current backup into an isolated environment and run readiness, authentication and CRUD tests.
- Exercise application rollback using a previous verified artifact.
- Review the provider against security, data-location, subprocessor and portability requirements.
- Review recovery-time and recovery-point objectives against the restore evidence.
- Complete a focused WCAG 2.2 AA regression review.

### Annually and after major change

- Review the threat model, incident contacts, data-retention policy and privacy information.
- Rotate administrator credentials and application secrets under a controlled session-invalidation plan.
- Review domain ownership, recovery methods and billing continuity.
- Conduct a fuller accessibility evaluation with representative users where feasible.

## 10. Safe update procedure

1. Open a dependency or application change in a pull request.
2. Require the complete CI, PostgreSQL, browser and security gates.
3. Build an immutable release candidate from the approved commit.
4. Rehearse schema changes against a restored production-representative database.
5. Take and verify the pre-deployment database backup.
6. Deploy the application without deleting the previous artifact.
7. Run the complete deployment acceptance test.
8. Observe the service through the agreed verification window.
9. Promote the release record only after evidence is retained.

Do not combine an untested database migration, major framework upgrade and hosting change in one production event.

## 11. Incident and rollback procedure

If the application fails but the database remains healthy, direct traffic to the previous verified artifact and preserve the database. Reverting application code does not reverse a schema migration.

If data corruption or loss is suspected:

1. restrict administrative writes;
2. preserve logs and record the incident time;
3. identify the last known-good recovery point;
4. restore into isolation first;
5. validate data and application behaviour;
6. obtain the named owner's approval before replacing production; and
7. record cause, impact, corrective action and prevention work.

Rotate any exposed credential immediately. Removing it from a file or commit is not sufficient after disclosure.

## 12. Portability and additional shops

Keep the application portable by retaining standard PostgreSQL migrations, provider-neutral environment variables, immutable release artifacts and downloadable backups. Avoid introducing proprietary database features without an explicit exit plan.

For a second shop, create a second deployment profile with:

- a separate domain;
- a separate application service;
- a separate database and credentials;
- separate administrator and contact settings;
- separate backup and restore evidence; and
- separately tested branding, content and accessibility.

Configuration-driven branding and optional catalogue modules can reuse the codebase. True multi-tenancy is a separate security architecture requiring tenant identifiers, tenant-aware unique constraints, role-based access, domain mapping, audit trails and cross-tenant isolation tests.

## 13. Provider decision record

Before the first production installation, complete this record in a deployment issue or controlled operations document:

| Decision | Recorded value |
| --- | --- |
| Application provider and plan | `[required]` |
| PostgreSQL provider and plan | `[required]` |
| Application/database region | `[required]` |
| Production domain | `[required]` |
| Account and recovery owner | `[required]` |
| Backup/PITR retention | `[required]` |
| Proven restore date and evidence | `[required]` |
| WAF/rate-limit configuration | `[required]` |
| Log retention and alert owner | `[required]` |
| Deployment and rollback owner | `[required]` |
| Approved source SHA | `[required]` |
| Release artifact checksum | `[required]` |

## 14. Authoritative references

- [SHOP release procedure](./RELEASE.md)
- [Next.js self-hosting guidance](https://nextjs.org/docs/app/guides/self-hosting)
- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [NCSC Cloud Security Principles](https://www.ncsc.gov.uk/collection/cloud/the-cloud-security-principles)
- [W3C Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/)
- [34SP WordPress Hosting and remote proxy support](https://www.34sp.com/wordpress-hosting/)
- [Render web-service controls](https://render.com/docs/web-services)
- [Render PostgreSQL backup and recovery](https://render.com/docs/postgresql-backups)
- [Vercel security overview](https://vercel.com/docs/security)
- [Stripe integration security guide](https://docs.stripe.com/security/guide)

Provider feature statements are not independent assurance. Verify the selected plan, contract, region, backup behaviour and security controls before supplying production data.

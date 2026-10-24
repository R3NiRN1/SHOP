# SHOP: guided installation and team handover

This walkthrough installs the current catalogue and administrator app. Ordering is by enquiry email; checkout and payments are not included.

## 1. Start here

You need Node.js **24.20.0** (the version in `.nvmrc`), an internet connection and a terminal. Node must include Corepack; if `corepack` is missing, ask your IT administrator to install the project's pinned Node toolchain. Reopen your terminal after installation. No global pnpm installation is needed: the wizard uses Corepack to select pnpm **11.25.0** from the repository.

**Team ZIP route (no Git required):** extract the entire SHOP setup ZIP into a normal folder first; do not run files from inside the ZIP viewer. On Windows, double-click `Setup-SHOP.cmd`. On macOS/Linux, open a terminal in the extracted folder and run `node scripts/bootstrap.mjs`. Skip the Git commands below. Every computer runs its own questionnaire; the ZIP contains no preconfigured passwords or database credentials.

Alternatively, if you use Git, download the repository once:

```sh
git clone https://github.com/R3NiRN1/SHOP.git
cd SHOP
```

If the installer is still under PR review, first run `git switch --track origin/feat/guided-bootstrap`. Once it is merged into main, this extra step is unnecessary. If you already have a checkout, use that folder; do not clone another copy inside it.

Check prerequisites without changing application configuration:

```sh
node scripts/bootstrap.mjs --check
```

Start the questionnaire:

```sh
node scripts/bootstrap.mjs
```

On Windows, you can also double-click **`Setup-SHOP.cmd`** in the repository folder. It checks for Node, launches the same questionnaire and leaves the window open so you can read the result.

After dependencies are installed, `corepack pnpm bootstrap` opens the same questionnaire. Passwords and database URLs are hidden while you type. Paste them once, then press Enter; the blank display is intentional. Press Ctrl+C at any time to stop. Work already completed is kept.

## 2. Pick your route

| Choice | Best for | What you need | What you get |
| --- | --- | --- | --- |
| **1 — Quick preview** | Seeing the app for the first time | Node and internet | Labelled sample catalogue; no database or admin login |
| **2 — Full local app** | Using the catalogue and admin on your computer | A new, empty PostgreSQL database | Real database storage and administrator login |
| **3 — Production preparation** | Preparing a deployment | A new production PostgreSQL database, public HTTPS URL and real email addresses | Validated configuration and optional initial database migration; hosting/deployment still required |

For your first look, choose **1**, accept the final confirmation, then run:

```sh
corepack pnpm dev
```

Open **http://localhost:3001**. Keep the terminal open while you use the app. Press Ctrl+C in that terminal to stop it.

Preview mode deliberately has no administrator login. For real catalogue editing, stop the server and rerun the wizard with choice **2**. It offers to back up the preview configuration before replacing it.

## 3. Questionnaire checklist for full setup

Get these answers from the team before starting. Do not put passwords into a shared checklist.

| Question | How to answer |
| --- | --- |
| Installation route | Local app or production preparation |
| PostgreSQL connection URL | Ask the database owner for the complete URL, including database name, username and any required SSL options. It is entered hidden. |
| Administrator email | The person who will manage the catalogue; use a real work email. |
| Administrator password | At least 16 characters, entered twice. Press Enter to generate a strong password instead. Double quotes, backslashes and line breaks are rejected to keep configuration unambiguous. |
| Customer enquiry email | The public inbox that should receive enquiries. |
| Site address | `http://localhost:3001` locally; your public `https://...` origin in production. No `/admin` or other path. |
| Apply migrations? | Choose yes only for a new, empty database dedicated to this installation. The wizard checks emptiness before applying anything. |

The authentication secret is generated automatically. Nothing secret is printed in the final summary. If you requested a generated administrator password, open **`apps/web/.env.local`** privately and copy the `ADMIN_PASSWORD` value into your password manager.

## 4. Get a database

For a managed PostgreSQL service, ask your database administrator to create a **new database and its own login**, and supply the connection URL. Preserve any SSL parameters supplied by the provider. Do not point a new install at an existing company database.

If Docker is already installed, a developer can create a disposable local PostgreSQL database. Replace `YOUR_UNIQUE_LOCAL_PASSWORD` in both places with the same strong password. The port is bound to your computer only:

```sh
docker run --name shop-local-postgres -e POSTGRES_DB=shop -e POSTGRES_USER=shop -e POSTGRES_PASSWORD=YOUR_UNIQUE_LOCAL_PASSWORD -p 127.0.0.1:5432:5432 -v shop-local-postgres-data:/var/lib/postgresql/data -d postgres:17.6-bookworm@sha256:f3bd19c606e442c3d7bdfa8002e03fe260a1023351e0ea4598032022b68dd6e3
```

In the questionnaire, paste:

```text
postgresql://shop:YOUR_UNIQUE_LOCAL_PASSWORD@127.0.0.1:5432/shop?schema=public
```

Use a URL-safe generated password (letters, numbers, hyphens and underscores) for this example. Otherwise the database password must be URL-encoded in the connection URL. The Docker command stores the password in local shell history; a database administrator should provision production credentials through the team's secret-management process instead.

If Docker says the container name already exists, start the existing container with `docker start shop-local-postgres`; do not create another one. If port 5432 is already occupied, ask the database owner whether you should use the existing server or choose another host port. Never delete a database volume to fix a setup error.

The wizard checks connectivity only when you choose to apply the initial migration. It refuses a database containing tables, views or sequences. Existing databases need the reviewed procedure in [RELEASE.md](RELEASE.md); the wizard does not reset, drop, seed or overwrite database records.

## 5. Confirm that it works

After a successful local database setup:

1. Run `corepack pnpm dev` and open **http://localhost:3001**.
2. Open **http://localhost:3001/admin** and sign in using the configured email and password. Admin accounts use the configured credentials, not email invitations or self-registration.
3. Create a test catalogue item, save it unpublished, then publish it when ready.
4. Open **http://localhost:3001/varieties** and check the published item appears.
5. Open **http://localhost:3001/api/ready**. A full installation should return `ready: true`. Preview mode intentionally reports not ready because it has no database/admin configuration.

For database mode, an empty catalogue is normal until an administrator adds and publishes items. The installer does not populate live inventory.

## 6. Production handover

Choice 3 prepares configuration; it does **not** create hosting, install a service, configure DNS/TLS, open firewall ports or start a public server.

- Transfer environment values to the deployment platform's secret/configuration store. Do not email the `.env.local` file or commit it to Git.
- Keep the configured `NEXTAUTH_URL` equal to the real public HTTPS origin.
- Run the locked installation and `corepack pnpm build` on the supported deployment environment, then follow the [release procedure](RELEASE.md) for the standalone artifact, migrations and startup.
- Verify `/api/health`, `/api/ready`, administrator sign-in, published catalogue visibility and the enquiry email destination.
- Record who owns the database, backups, hosting, domain, administrator credentials and public enquiry inbox.

For configuration only, with no package install or database operations:

```sh
node scripts/bootstrap.mjs --configure-only
```

This mode explicitly leaves dependencies, database and production build unfinished. To finish manually, run `corepack pnpm setup`, then arrange the reviewed database migration before starting the app. Prisma migration commands need `DATABASE_URL` in their process environment; Prisma does not automatically read Next.js's `.env.local`. The wizard passes it securely when it runs the migration.

## 7. If something goes wrong

| What you see | What to do |
| --- | --- |
| `node` is not recognized / wrong Node version | Install the pinned Node version and reopen the terminal. |
| Corepack is missing or cannot download pnpm | Ask IT to fix the pinned Node/Corepack installation or registry/proxy access; do not switch to npm install. |
| Existing `.env.local` found | Keep it and exit, or choose to back it up and reconfigure. The backup stays beside it with a `.backup-...` suffix and is also Git-ignored. |
| Password input looks blank | It is hidden intentionally. Type/paste once and press Enter. |
| Configuration rejected | Follow the displayed explanation and retry that answer. No configuration is written until the final confirmation. |
| Database connection cannot be verified | Check the server is running, URL, credentials, database name, SSL options and network access with the database owner. No migration was run. |
| Database already contains tables | Stop and use the existing-database release procedure. Do not drop tables to bypass the check. |
| Package install failed | Fix the reported network/toolchain issue, then run `corepack pnpm setup`. Saved configuration is retained. Database migration may still be outstanding. |
| Port 3001 is in use | Stop the other SHOP terminal with Ctrl+C, then retry `corepack pnpm dev`. |
| Admin login is unavailable | Preview mode has no login. Use database mode, finish migration and restart the server after changing environment settings. |
| Catalogue is empty | In database mode, create and publish an item through `/admin`. Preview mode needs a restart after its configuration is saved. |
| Readiness returns 503 | Expected in preview mode; for a full install check database access and all required auth/contact settings. |

For help, share the failed step and the redacted error message. Never share your environment file, password, authentication secret or full database URL.

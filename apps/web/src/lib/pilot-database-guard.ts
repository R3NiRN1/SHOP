/**
 * Precondition for a future pilot fixture loader. This is not permission to
 * mutate a database: the loader must also verify the connected database and
 * its disposable marker before writing.
 */
export function assertPilotDatabaseUrl(value: string | undefined): void {
  if (!value) throw new Error("Explicit pilot database URL required");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Invalid pilot database URL");
  }
  if (
    !["postgresql:", "postgres:"].includes(url.protocol) ||
    !["127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.port !== "5432" ||
    url.pathname !== "/shop_pilot_disposable" ||
    url.username !== "shop_pilot" ||
    !url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Pilot requires the dedicated local disposable database and role");
  }
}

/**
 * A second, independent pre-write gate. The caller must obtain every field
 * from the *same live PostgreSQL connection* used for subsequent fixture
 * writes; never derive these values from the connection URL or user input.
 * A disposable marker must be provisioned out-of-band by the pilot operator.
 */
export interface ConnectedPilotIdentity {
  database: string;
  role: string;
  isSuperuser: boolean;
  canCreateDatabase: boolean;
  canCreateRole: boolean;
  disposableMarker: string | null;
}

export function assertConnectedPilotIdentity(identity: ConnectedPilotIdentity): void {
  if (
    identity.database !== "shop_pilot_disposable" ||
    identity.role !== "shop_pilot" ||
    identity.isSuperuser !== false ||
    identity.canCreateDatabase !== false ||
    identity.canCreateRole !== false ||
    identity.disposableMarker !== "SHOP_DISPOSABLE_PILOT_V1"
  ) {
    throw new Error("Connected database is not an approved disposable pilot");
  }
}


/**
 * Read identity from the actual PostgreSQL session, not the connection URL.
 * The database COMMENT is an operator-provisioned marker, never created here.
 * A fixture writer must call this inside its own transaction on the SAME
 * client and must not release that client before completing its writes.
 */
export async function verifyConnectedPilotDatabase(client: {
  query: (sql: string) => Promise<{ rows: unknown[] }>;
}): Promise<void> {
  const result = await client.query(`
    SELECT current_database() AS database,
           current_user AS role,
           r.rolsuper AS "isSuperuser",
           r.rolcreatedb AS "canCreateDatabase",
           r.rolcreaterole AS "canCreateRole",
           shobj_description(d.oid, 'pg_database') AS "disposableMarker"
    FROM pg_database d
    JOIN pg_roles r ON r.rolname = current_user
    WHERE d.datname = current_database()
  `);
  if (result.rows.length !== 1) {
    throw new Error("Connected database is not an approved disposable pilot");
  }
  assertConnectedPilotIdentity(result.rows[0] as ConnectedPilotIdentity);
}

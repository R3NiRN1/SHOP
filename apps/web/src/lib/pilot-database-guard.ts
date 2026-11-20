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

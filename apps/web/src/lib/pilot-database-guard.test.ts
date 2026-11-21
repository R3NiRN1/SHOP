import { describe, expect, it } from "vitest";
import { assertConnectedPilotIdentity, assertPilotDatabaseUrl, verifyConnectedPilotDatabase, withVerifiedPilotTransaction } from "./pilot-database-guard";

const safe = "postgresql://shop_pilot:fictional@127.0.0.1:5432/shop_pilot_disposable";

describe("disposable pilot database URL precondition", () => {
  it("accepts the explicit local pilot role and database", () => {
    expect(() => assertPilotDatabaseUrl(safe)).not.toThrow();
    expect(() => assertPilotDatabaseUrl(safe.replace("127.0.0.1", "[::1]"))).not.toThrow();
  });
  it.each([
    undefined, "", "not a URL",
    safe.replace("127.0.0.1", "example.invalid"),
    safe.replace("127.0.0.1", "localhost"),
    safe.replace("shop_pilot:", "postgres:"),
    safe.replace(":fictional@", "@"),
    safe.replace("/shop_pilot_disposable", "/shop"),
    safe.replace(":5432", ":5433"),
    safe.replace("postgresql:", "https:"),
    safe + "?host=example.invalid",
    safe + "#fragment",
  ])("rejects unsafe pilot connection input", (value) => {
    expect(() => assertPilotDatabaseUrl(value)).toThrow();
  });
  it("does not echo credentials in errors", () => {
    expect(() => assertPilotDatabaseUrl(safe.replace("/shop_pilot_disposable", "/shop")))
      .toThrow("Pilot requires the dedicated local disposable database and role");
  });
});

describe("connected disposable PostgreSQL identity", () => {
  const approved = {
    database: "shop_pilot_disposable",
    role: "shop_pilot",
    isSuperuser: false,
    canCreateDatabase: false,
    canCreateRole: false,
    canBypassRowSecurity: false,
    canReplicate: false,
    disposableMarker: "SHOP_DISPOSABLE_PILOT_V1",
  } as const;

  it("accepts a verified least-privilege disposable identity", () => {
    expect(() => assertConnectedPilotIdentity(approved)).not.toThrow();
  });

  it.each([
    { database: "shop" },
    { role: "postgres" },
    { isSuperuser: true },
    { canCreateDatabase: true },
    { canCreateRole: true },
    { canBypassRowSecurity: true },
    { canReplicate: true },
    { disposableMarker: null },
    { disposableMarker: "SHOP_DISPOSABLE_PILOT_V2" },
  ])("fails closed for mismatched connected identity: %j", (change) => {
    expect(() => assertConnectedPilotIdentity({ ...approved, ...change })).toThrow(
      "Connected database is not an approved disposable pilot",
    );
  });
});

describe("live-session pilot identity verification", () => {
  const identity = {
    database: "shop_pilot_disposable", role: "shop_pilot",
    isSuperuser: false, canCreateDatabase: false, canCreateRole: false,
    canBypassRowSecurity: false, canReplicate: false,
    disposableMarker: "SHOP_DISPOSABLE_PILOT_V1",
  };
  it("reads identity from a PostgreSQL session", async () => {
    const queries: string[] = [];
    await verifyConnectedPilotDatabase({
      query: async (sql) => { queries.push(sql); return { rows: [identity] }; },
    });
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain("current_database()");
    expect(queries[0]).toContain("current_user");
    expect(queries[0]).toContain("shobj_description");
    expect(queries[0]).toContain("rolbypassrls");
    expect(queries[0]).toContain("rolreplication");
  });
  it("rejects a missing database row", async () => {
    await expect(verifyConnectedPilotDatabase({
      query: async () => ({ rows: [] }),
    })).rejects.toThrow("Connected database is not an approved disposable pilot");
  });
  it("rejects a mismatched database comment", async () => {
    await expect(verifyConnectedPilotDatabase({
      query: async () => ({ rows: [{ ...identity, disposableMarker: null }] }),
    })).rejects.toThrow("Connected database is not an approved disposable pilot");
  });
  it("propagates connection failures without writing", async () => {
    await expect(verifyConnectedPilotDatabase({
      query: async () => { throw new Error("connection unavailable"); },
    })).rejects.toThrow("connection unavailable");
  });
});

describe("transaction-bound pilot verification", () => {
  const identity = {
    database: "shop_pilot_disposable", role: "shop_pilot",
    isSuperuser: false, canCreateDatabase: false, canCreateRole: false,
    canBypassRowSecurity: false, canReplicate: false,
    disposableMarker: "SHOP_DISPOSABLE_PILOT_V1",
  };
  it("checks identity before writing and commits on success", async () => {
    const calls: string[] = [];
    const client = { query: async (sql: string) => {
      calls.push(sql);
      return { rows: sql.includes("current_database()") ? [identity] : [] };
    } };
    const result = await withVerifiedPilotTransaction(client, async (connection) => {
      await connection.query("INSERT INTO fictional_fixture VALUES (1)");
      return "ok";
    });
    expect(result).toBe("ok");
    expect(calls[0]).toBe("BEGIN");
    expect(calls[1]).toContain("current_database()");
    expect(calls[2]).toContain("INSERT");
    expect(calls[3]).toBe("COMMIT");
  });
  it("never calls the writer when connected identity fails", async () => {
    const calls: string[] = [];
    let wrote = false;
    const client = { query: async (sql: string) => {
      calls.push(sql);
      return { rows: [] };
    } };
    await expect(withVerifiedPilotTransaction(client, async () => {
      wrote = true;
    })).rejects.toThrow("Connected database is not an approved disposable pilot");
    expect(wrote).toBe(false);
    expect(calls.at(-1)).toBe("ROLLBACK");
    expect(calls).not.toContain("COMMIT");
  });
  it("preserves the original failure when rollback also fails", async () => {
    const calls: string[] = [];
    const client = { query: async (sql: string) => {
      calls.push(sql);
      if (sql === "ROLLBACK") throw new Error("rollback unavailable");
      return { rows: sql.includes("current_database()") ? [identity] : [] };
    } };
    await expect(withVerifiedPilotTransaction(client, async () => {
      throw new Error("fixture rejected");
    })).rejects.toThrow("fixture rejected");
    expect(calls.at(-1)).toBe("ROLLBACK");
    expect(calls).not.toContain("COMMIT");
  });
  it("does not invoke the writer if BEGIN fails", async () => {
    let invoked = false;
    const client = { query: async (_sql: string): Promise<{ rows: unknown[] }> => {
      throw new Error("transaction unavailable");
    } };
    await expect(withVerifiedPilotTransaction(client, async () => {
      invoked = true;
    })).rejects.toThrow("transaction unavailable");
    expect(invoked).toBe(false);
  });
  it("rolls back a failed fixture callback", async () => {
    const calls: string[] = [];
    const client = { query: async (sql: string) => {
      calls.push(sql);
      return { rows: sql.includes("current_database()") ? [identity] : [] };
    } };
    await expect(withVerifiedPilotTransaction(client, async () => {
      throw new Error("fixture rejected");
    })).rejects.toThrow("fixture rejected");
    expect(calls.at(-1)).toBe("ROLLBACK");
    expect(calls).not.toContain("COMMIT");
  });
});

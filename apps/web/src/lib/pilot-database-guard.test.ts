import { describe, expect, it } from "vitest";
import { assertConnectedPilotIdentity, assertPilotDatabaseUrl } from "./pilot-database-guard";

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
    { disposableMarker: null },
    { disposableMarker: "SHOP_DISPOSABLE_PILOT_V2" },
  ])("fails closed for mismatched connected identity: %j", (change) => {
    expect(() => assertConnectedPilotIdentity({ ...approved, ...change })).toThrow(
      "Connected database is not an approved disposable pilot",
    );
  });
});

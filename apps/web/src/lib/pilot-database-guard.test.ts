import { describe, expect, it } from "vitest";
import { assertPilotDatabaseUrl } from "./pilot-database-guard";

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

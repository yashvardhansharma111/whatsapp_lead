import test from "node:test";
import assert from "node:assert/strict";
import { nextRenewalPeriod } from "../backend/apps/billing/src/renewal-period";

test("early renewal starts after the current period and adds one monthly cycle", () => {
  const currentEnd = new Date("2026-01-31T12:00:00.000Z");
  const { startsAt, endsAt } = nextRenewalPeriod(
    currentEnd,
    "MONTHLY",
    new Date("2026-01-01T00:00:00.000Z"),
  );
  assert.equal(startsAt.toISOString(), currentEnd.toISOString());
  assert.equal(endsAt.toISOString(), "2026-02-28T12:00:00.000Z");
});

test("late renewal starts now and honors annual leap-year dates", () => {
  const { startsAt, endsAt } = nextRenewalPeriod(
    new Date("2026-01-01T00:00:00.000Z"),
    "ANNUAL",
    new Date("2028-02-29T12:00:00.000Z"),
  );
  assert.equal(startsAt.toISOString(), "2028-02-29T12:00:00.000Z");
  assert.equal(endsAt.toISOString(), "2029-02-28T12:00:00.000Z");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";

test("GET /health responde com status ok", async () => {
  const app = buildApp();
  const res = await app.inject({ method: "GET", url: "/health" });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { status: "ok", service: "prismo-connect" });

  await app.close();
});

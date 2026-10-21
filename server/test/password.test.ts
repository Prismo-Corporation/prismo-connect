import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/auth/password.js";

test("hash de senha verifica a senha correta e rejeita a errada", async () => {
  const hash = await hashPassword("senha-forte-123");

  assert.ok(hash.startsWith("scrypt:"));
  assert.equal(await verifyPassword("senha-forte-123", hash), true);
  assert.equal(await verifyPassword("senha-errada", hash), false);
});

test("o mesmo texto gera hashes diferentes (sal aleatório)", async () => {
  const a = await hashPassword("mesma-senha");
  const b = await hashPassword("mesma-senha");

  assert.notEqual(a, b);
});

test("hash malformado não é aceito", async () => {
  assert.equal(await verifyPassword("qualquer", "texto-sem-formato"), false);
  assert.equal(await verifyPassword("qualquer", "md5:abc:def"), false);
});

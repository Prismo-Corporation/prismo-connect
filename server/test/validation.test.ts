import { test } from "node:test";
import assert from "node:assert/strict";
import { ageOn, meetsMinimumAge, registerSchema, usernameSchema } from "../src/auth/validation.js";

test("idade é calculada pelo aniversário, não só pelo ano", () => {
  const antesDoAniversario = new Date("2026-10-20T12:00:00Z");
  assert.equal(ageOn("2013-10-21", antesDoAniversario), 12);
  assert.equal(ageOn("2013-10-20", antesDoAniversario), 13);
});

test("idade mínima é 13 anos, no limite exato", () => {
  const hoje = new Date("2026-10-20T12:00:00Z");
  assert.equal(meetsMinimumAge("2013-10-20", hoje), true);
  assert.equal(meetsMinimumAge("2013-10-21", hoje), false);
});

test("nome de usuário aceita letras, números, ponto e sublinhado, com 3 a 32 caracteres", () => {
  assert.equal(usernameSchema.safeParse("ana.silva_99").success, true);
  assert.equal(usernameSchema.safeParse("ab").success, false);
  assert.equal(usernameSchema.safeParse("a".repeat(33)).success, false);
  assert.equal(usernameSchema.safeParse("com espaco").success, false);
});

test("cadastro rejeita data de nascimento inexistente", () => {
  const result = registerSchema.safeParse({
    email: "a@exemplo.com",
    username: "ana",
    password: "senha-forte-123",
    birthDate: "2000-02-30",
  });
  assert.equal(result.success, false);
});

test("e-mail é normalizado para minúsculas", () => {
  const result = registerSchema.safeParse({
    email: "  Ana@Exemplo.COM ",
    username: "ana",
    password: "senha-forte-123",
    birthDate: "2000-01-01",
  });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.email, "ana@exemplo.com");
});

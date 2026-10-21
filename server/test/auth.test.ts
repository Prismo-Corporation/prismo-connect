import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { buildApp } from "../src/app.js";
import { createPool, migrate } from "../src/db.js";

// Estes testes precisam de um PostgreSQL. Sem DATABASE_URL, são ignorados.
const databaseUrl = process.env.DATABASE_URL;
const skip = databaseUrl ? false : "DATABASE_URL não definido; testes de banco ignorados";

function sessionCookieFrom(headers: Record<string, unknown>): string {
  const raw = headers["set-cookie"];
  const list = Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : [];
  const cookie = list.find((c) => c.startsWith("prismo_session="));
  assert.ok(cookie, "cookie de sessão ausente na resposta");
  return cookie.split(";")[0];
}

describe("API de contas", { skip }, () => {
  let pool: pg.Pool;
  let app: FastifyInstance;

  before(async () => {
    pool = createPool(databaseUrl!);
    await migrate(pool);
    app = await buildApp({ pool });
  });

  after(async () => {
    await app.close();
    await pool.end();
  });

  function novoUsuario() {
    const s = randomUUID().slice(0, 8);
    return {
      email: `t${s}@exemplo.com`,
      username: `u_${s}`,
      password: "senha-forte-123",
      birthDate: "2000-05-10",
    };
  }

  async function cadastrar(usuario = novoUsuario()) {
    const res = await app.inject({ method: "POST", url: "/auth/register", payload: usuario });
    assert.equal(res.statusCode, 201, res.body);
    return { usuario, cookie: sessionCookieFrom(res.headers) };
  }

  test("cadastro cria conta e sessão", async () => {
    const { usuario, cookie } = await cadastrar();

    const me = await app.inject({ method: "GET", url: "/me", headers: { cookie } });
    assert.equal(me.statusCode, 200);
    assert.equal(me.json().user.username, usuario.username);
    assert.equal(me.json().user.email, usuario.email);
  });

  test("cadastro rejeita e-mail ou nome de usuário já existente", async () => {
    const { usuario } = await cadastrar();

    const dup = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { ...novoUsuario(), username: usuario.username.toUpperCase() },
    });
    assert.equal(dup.statusCode, 409);
  });

  test("cadastro rejeita menor de 13 anos", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { ...novoUsuario(), birthDate: new Date().getUTCFullYear() - 10 + "-01-01" },
    });
    assert.equal(res.statusCode, 422);
    assert.equal(res.json().error, "idade_minima");
  });

  test("login aceita nome de usuário e e-mail, e rejeita senha errada", async () => {
    const { usuario } = await cadastrar();

    const porUsuario = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { identifier: usuario.username, password: usuario.password },
    });
    assert.equal(porUsuario.statusCode, 200);

    const porEmail = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { identifier: usuario.email, password: usuario.password },
    });
    assert.equal(porEmail.statusCode, 200);

    const errada = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { identifier: usuario.username, password: "outra-senha" },
    });
    assert.equal(errada.statusCode, 401);
  });

  test("após 5 tentativas erradas, a conta fica bloqueada mesmo com a senha certa", async () => {
    const { usuario } = await cadastrar();

    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: { identifier: usuario.username, password: "errada-123" },
      });
      assert.equal(res.statusCode, 401);
    }

    const certa = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { identifier: usuario.username, password: usuario.password },
    });
    assert.equal(certa.statusCode, 429);
  });

  test("rotas protegidas exigem sessão", async () => {
    const res = await app.inject({ method: "GET", url: "/me" });
    assert.equal(res.statusCode, 401);
  });

  test("perfil pode ser atualizado e o nome de usuário não pode repetir", async () => {
    const { cookie } = await cadastrar();
    const outro = await cadastrar();

    const ok = await app.inject({
      method: "PATCH",
      url: "/me",
      headers: { cookie },
      payload: { bio: "Oi, sou eu", status: "dnd" },
    });
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.json().user.bio, "Oi, sou eu");
    assert.equal(ok.json().user.status, "dnd");

    const repetido = await app.inject({
      method: "PATCH",
      url: "/me",
      headers: { cookie },
      payload: { username: outro.usuario.username },
    });
    assert.equal(repetido.statusCode, 409);
  });

  test("sessões podem ser listadas e encerradas individualmente", async () => {
    const { usuario, cookie: primeira } = await cadastrar();

    const segundo = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { identifier: usuario.username, password: usuario.password },
    });
    const segundaCookie = sessionCookieFrom(segundo.headers);

    const lista = await app.inject({ method: "GET", url: "/auth/sessions", headers: { cookie: primeira } });
    assert.equal(lista.json().sessions.length, 2);

    const idOutra = lista.json().sessions.find((s: { current: boolean }) => !s.current).id;
    const encerra = await app.inject({
      method: "DELETE",
      url: `/auth/sessions/${idOutra}`,
      headers: { cookie: primeira },
    });
    assert.equal(encerra.statusCode, 204);

    const derrubada = await app.inject({ method: "GET", url: "/me", headers: { cookie: segundaCookie } });
    assert.equal(derrubada.statusCode, 401);
  });

  test("logout encerra a sessão atual", async () => {
    const { cookie } = await cadastrar();

    const out = await app.inject({ method: "POST", url: "/auth/logout", headers: { cookie } });
    assert.equal(out.statusCode, 204);

    const depois = await app.inject({ method: "GET", url: "/me", headers: { cookie } });
    assert.equal(depois.statusCode, 401);
  });

  test("excluir conta exige senha e impede novo login", async () => {
    const { usuario, cookie } = await cadastrar();

    const semSenha = await app.inject({
      method: "DELETE",
      url: "/me",
      headers: { cookie },
      payload: { password: "errada-123" },
    });
    assert.equal(semSenha.statusCode, 401);

    const exclui = await app.inject({
      method: "DELETE",
      url: "/me",
      headers: { cookie },
      payload: { password: usuario.password },
    });
    assert.equal(exclui.statusCode, 204);

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { identifier: usuario.username, password: usuario.password },
    });
    assert.equal(login.statusCode, 401);
  });
});

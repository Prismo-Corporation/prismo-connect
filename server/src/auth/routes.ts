import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import type pg from "pg";
import { requireAuth } from "./middleware.js";
import { hashPassword, verifyPassword } from "./password.js";
import { SESSION_COOKIE, SESSION_TTL_DAYS, generateSessionToken, hashSessionToken } from "./session.js";
import {
  MIN_AGE,
  deleteAccountSchema,
  loginSchema,
  meetsMinimumAge,
  registerSchema,
  updateProfileSchema,
  uuidParamSchema,
} from "./validation.js";

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

const USER_COLUMNS = "id, username, display_name, email, bio, status, avatar_url, created_at";

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  email: string;
  bio: string;
  status: string;
  avatar_url: string | null;
  created_at: Date;
}

interface LoginRow extends UserRow {
  password_hash: string;
  failed_login_count: number;
  locked_until: Date | null;
}

// Hash usado quando o usuário não existe, para o tempo de resposta não revelar contas.
const dummyHashPromise = hashPassword(randomBytes(16).toString("hex"));

function toPublicUser(row: UserRow) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    status: row.status,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at.toISOString(),
  };
}

function toOwnUser(row: UserRow) {
  return { ...toPublicUser(row), email: row.email };
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  };
}

async function createSession(pool: pg.Pool, userId: string, userAgent: string | undefined): Promise<string> {
  const token = generateSessionToken();
  await pool.query(
    "INSERT INTO sessions (user_id, token_hash, user_agent, expires_at) VALUES ($1, $2, $3, now() + make_interval(days => $4))",
    [userId, hashSessionToken(token), userAgent ?? null, SESSION_TTL_DAYS],
  );
  return token;
}

function startSession(reply: FastifyReply, token: string) {
  reply.setCookie(SESSION_COOKIE, token, cookieOptions());
}

function endSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

function validationError(reply: FastifyReply, issues: { path: PropertyKey[]; message: string }[]) {
  return reply.code(400).send({
    error: "dados_invalidos",
    issues: issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })),
  });
}

export function registerAuthRoutes(app: FastifyInstance, pool: pg.Pool) {
  const authenticated = { preHandler: requireAuth(pool) };

  app.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    const body = parsed.data;
    if (!meetsMinimumAge(body.birthDate)) {
      return reply.code(422).send({
        error: "idade_minima",
        message: `A idade mínima para se cadastrar é ${MIN_AGE} anos`,
      });
    }

    const passwordHash = await hashPassword(body.password);

    let user: UserRow;
    try {
      const { rows } = await pool.query<UserRow>(
        `INSERT INTO users (username, display_name, email, password_hash, birth_date)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${USER_COLUMNS}`,
        [body.username, body.displayName ?? body.username, body.email, passwordHash, body.birthDate],
      );
      user = rows[0];
    } catch (err) {
      if (isUniqueViolation(err)) {
        return reply.code(409).send({ error: "ja_cadastrado", message: "E-mail ou nome de usuário já está em uso" });
      }
      throw err;
    }

    const token = await createSession(pool, user.id, request.headers["user-agent"]);
    startSession(reply, token);
    return reply.code(201).send({ user: toOwnUser(user) });
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    const { identifier, password } = parsed.data;
    const { rows } = await pool.query<LoginRow>(
      `SELECT ${USER_COLUMNS}, password_hash, failed_login_count, locked_until
       FROM users
       WHERE lower(username) = lower($1) OR email = lower($1)`,
      [identifier],
    );
    const user = rows[0];

    if (user?.locked_until && user.locked_until > new Date()) {
      return reply.code(429).send({
        error: "bloqueado",
        message: `Muitas tentativas erradas. Tente de novo em até ${LOCK_MINUTES} minutos`,
      });
    }

    const storedHash = user?.password_hash ?? (await dummyHashPromise);
    const passwordOk = await verifyPassword(password, storedHash);

    if (!user || !passwordOk) {
      if (user) {
        const attempts = user.failed_login_count + 1;
        const shouldLock = attempts >= MAX_FAILED_LOGINS;
        await pool.query(
          `UPDATE users
           SET failed_login_count = $2,
               locked_until = CASE WHEN $3 THEN now() + make_interval(mins => $4) ELSE locked_until END
           WHERE id = $1`,
          [user.id, shouldLock ? 0 : attempts, shouldLock, LOCK_MINUTES],
        );
      }
      return reply.code(401).send({ error: "credenciais_invalidas", message: "E-mail, usuário ou senha incorretos" });
    }

    await pool.query("UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1", [user.id]);

    const token = await createSession(pool, user.id, request.headers["user-agent"]);
    startSession(reply, token);
    return reply.send({ user: toOwnUser(user) });
  });

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) {
      await pool.query("DELETE FROM sessions WHERE token_hash = $1", [hashSessionToken(token)]);
    }
    endSessionCookie(reply);
    return reply.code(204).send();
  });

  app.get("/auth/sessions", authenticated, async (request, reply) => {
    const { auth } = request;
    const { rows } = await pool.query<{ id: string; created_at: Date; expires_at: Date; user_agent: string | null }>(
      `SELECT id, created_at, expires_at, user_agent
       FROM sessions
       WHERE user_id = $1 AND expires_at > now()
       ORDER BY created_at DESC`,
      [auth!.userId],
    );
    return reply.send({
      sessions: rows.map((s) => ({
        id: s.id,
        createdAt: s.created_at.toISOString(),
        expiresAt: s.expires_at.toISOString(),
        userAgent: s.user_agent,
        current: s.id === auth!.sessionId,
      })),
    });
  });

  app.delete("/auth/sessions/:id", authenticated, async (request, reply) => {
    const params = uuidParamSchema.safeParse(request.params);
    if (!params.success) return validationError(reply, params.error.issues);

    const { auth } = request;
    const { rowCount } = await pool.query("DELETE FROM sessions WHERE id = $1 AND user_id = $2", [
      params.data.id,
      auth!.userId,
    ]);
    if (!rowCount) return reply.code(404).send({ error: "nao_encontrado", message: "Sessão não encontrada" });

    if (params.data.id === auth!.sessionId) endSessionCookie(reply);
    return reply.code(204).send();
  });

  app.get("/me", authenticated, async (request, reply) => {
    const { rows } = await pool.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [
      request.auth!.userId,
    ]);
    if (!rows[0]) return reply.code(404).send({ error: "nao_encontrado" });
    return reply.send({ user: toOwnUser(rows[0]) });
  });

  app.patch("/me", authenticated, async (request, reply) => {
    const parsed = updateProfileSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    const body = parsed.data;
    const sets: string[] = [];
    const values: unknown[] = [];
    const add = (column: string, value: unknown) => {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    };

    if (body.username !== undefined) add("username", body.username);
    if (body.displayName !== undefined) add("display_name", body.displayName);
    if (body.bio !== undefined) add("bio", body.bio);
    if (body.status !== undefined) add("status", body.status);

    values.push(request.auth!.userId);
    try {
      const { rows } = await pool.query<UserRow>(
        `UPDATE users SET ${sets.join(", ")} WHERE id = $${values.length} RETURNING ${USER_COLUMNS}`,
        values,
      );
      return reply.send({ user: toOwnUser(rows[0]) });
    } catch (err) {
      if (isUniqueViolation(err)) {
        return reply.code(409).send({ error: "ja_cadastrado", message: "Nome de usuário já está em uso" });
      }
      throw err;
    }
  });

  app.delete("/me", authenticated, async (request, reply) => {
    const parsed = deleteAccountSchema.safeParse(request.body);
    if (!parsed.success) return validationError(reply, parsed.error.issues);

    const { rows } = await pool.query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [
      request.auth!.userId,
    ]);
    const user = rows[0];
    if (!user || !(await verifyPassword(parsed.data.password, user.password_hash))) {
      return reply.code(401).send({ error: "credenciais_invalidas", message: "Senha incorreta" });
    }

    // As sessões são removidas em cascata pela chave estrangeira.
    await pool.query("DELETE FROM users WHERE id = $1", [request.auth!.userId]);
    endSessionCookie(reply);
    return reply.code(204).send();
  });
}

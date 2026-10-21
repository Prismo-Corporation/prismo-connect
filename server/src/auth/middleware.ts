import type { FastifyReply, FastifyRequest } from "fastify";
import type pg from "pg";
import { SESSION_COOKIE, hashSessionToken } from "./session.js";

export interface AuthContext {
  userId: string;
  sessionId: string;
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

/**
 * Exige uma sessão válida. Também estende a validade da sessão quando ela
 * já passou de 1 dia desde a última renovação, para não gravar a cada requisição.
 */
export function requireAuth(pool: pg.Pool) {
  return async function requireAuthHook(request: FastifyRequest, reply: FastifyReply) {
    const token = request.cookies[SESSION_COOKIE];
    if (!token) {
      return reply.code(401).send({ error: "nao_autenticado", message: "Faça login para continuar" });
    }

    const { rows } = await pool.query<{ id: string; user_id: string }>(
      "SELECT id, user_id FROM sessions WHERE token_hash = $1 AND expires_at > now()",
      [hashSessionToken(token)],
    );
    const session = rows[0];
    if (!session) {
      return reply.code(401).send({ error: "nao_autenticado", message: "Sessão expirada. Faça login novamente" });
    }

    await pool.query(
      "UPDATE sessions SET expires_at = now() + interval '30 days' WHERE id = $1 AND expires_at < now() + interval '29 days'",
      [session.id],
    );

    request.auth = { userId: session.user_id, sessionId: session.id };
  };
}

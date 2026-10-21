import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE = "prismo_session";
export const SESSION_TTL_DAYS = 30;

/** Token aleatório enviado ao navegador. Nunca é guardado em texto puro. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Hash do token, este sim guardado no banco. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

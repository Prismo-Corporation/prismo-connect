import cookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import type pg from "pg";
import { registerAuthRoutes } from "./auth/routes.js";

export interface AppOptions {
  /** Pool do PostgreSQL. Sem ele, só as rotas que não usam banco ficam disponíveis. */
  pool?: pg.Pool;
}

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(cookie);

  app.get("/health", async () => {
    return { status: "ok", service: "prismo-connect" };
  });

  if (options.pool) {
    registerAuthRoutes(app, options.pool);
  }

  return app;
}

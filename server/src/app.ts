import Fastify from "fastify";

export function buildApp() {
  const app = Fastify({ logger: false });

  app.get("/health", async () => {
    return { status: "ok", service: "prismo-connect" };
  });

  return app;
}

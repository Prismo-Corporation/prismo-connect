import { buildApp } from "./app.js";
import { createPool, migrate } from "./db.js";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL não definido. Copie .env.example para .env e ajuste os valores.");
  process.exit(1);
}

const pool = createPool(databaseUrl);

try {
  const applied = await migrate(pool);
  if (applied.length > 0) console.log(`Migrações aplicadas: ${applied.join(", ")}`);

  const app = await buildApp({ pool });
  await app.listen({ port, host });
  console.log(`Prismo Connect ouvindo em http://${host}:${port}`);
} catch (err) {
  console.error(err);
  await pool.end();
  process.exit(1);
}

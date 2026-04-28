import "dotenv/config";
import { defineConfig } from "prisma/config";

const url = process.env["DATABASE_URL"];
const authToken = process.env["TURSO_AUTH_TOKEN"];

// Para CLI (prisma db push / migrate): embed o token na URL se for Turso
const datasourceUrl = url && authToken && url.startsWith("libsql://")
  ? `${url}?authToken=${authToken}`
  : url;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: datasourceUrl,
  },
});

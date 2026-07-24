import { execSync } from "child_process";
import { createApp } from "./app";
import { requireEnv } from "./utils/env";

requireEnv("DATABASE_URL");

// Auto-migration
try {
  console.log("Starting auto-migrations...");
  execSync("npx prisma db push", { stdio: "inherit" });
  console.log("Auto-migrations completed successfully.");
} catch (error) {
  console.error("Auto-migration failed:", error);
}

const app = createApp();
const port = Number(process.env.PORT ?? 3000);

app.listen(port, "0.0.0.0", () => {
  console.log(`API running on:`);
  console.log(`- Local   : http://localhost:${port}`);
  console.log(`- Network : http://<IP-PC>:${port}`);
});

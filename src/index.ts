import { createApp } from "./app";
import { requireEnv } from "./utils/env";

const app = createApp();
const port = Number(process.env.PORT ?? 3000);

requireEnv("DATABASE_URL");

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});

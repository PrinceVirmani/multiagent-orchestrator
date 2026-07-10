import "./tools/builtins.js";
import { createServer } from "./server.js";
import { settings } from "./config.js";

const app = createServer();
app.listen(settings.PORT, () => {
  console.log(`multiagent-orchestrator listening on http://localhost:${settings.PORT}`);
});
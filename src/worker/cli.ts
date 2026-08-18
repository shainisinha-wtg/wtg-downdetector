import { startWorker } from "./index";

startWorker().catch(() => {
  console.error("Notification worker stopped because of a fatal error");
  process.exitCode = 1;
});

// Keep this launcher alive while the HTTP server restarts.
const { fork } = require("node:child_process");
const path = require("node:path");
let child;
let stopping = false;
function launch() {
  child = fork(path.join(__dirname, "app.js"), [], {
    stdio: ["inherit", "inherit", "inherit", "ipc"],
    windowsHide: true,
    env: { ...process.env, STREAMTOOLS_SUPERVISED: "1" }
  });
  child.on("error", (error) => {
    console.error("[Server launcher]", error);
    process.exitCode = 1;
  });
  child.on("exit", (code) => {
    if (!stopping && code === 75) {
      console.log("[Server launcher] Restarting...");
      launch();
    } else {
      process.exitCode = stopping ? 0 : (code || 1);
    }
  });
}
process.on("disconnect", () => {
  stopping = true;
  if (child && child.exitCode === null) child.kill();
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopping = true;
    if (child && child.exitCode === null) child.kill(signal);
  });
}
launch();

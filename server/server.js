const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
require("dotenv").config();

const healthRoutes = require("./routes/health");
const timerRoutes = require("./routes/timers");
const pishockRoutes = require("./routes/pishock");

const app = express();

const PORT = process.env.PORT || 3030;
const HOST = process.env.HOST || "0.0.0.0";

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false
  })
);
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Static widget files
app.use(express.static(path.join(__dirname, "../public")));

app.use("/", healthRoutes);
app.use("/api", healthRoutes);
app.use("/api/timers", timerRoutes);
app.use("/api/pishock", pishockRoutes);

app.listen(PORT, HOST, () => {
  console.log(`StreamTools server running at http://${HOST}:${PORT}`);
});

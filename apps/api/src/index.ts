import express from "express";
import { config } from "./config.js";
import { parseCookies } from "./cookies.js";
import { SESSION_COOKIE } from "./session.js";
import { authRouter } from "./routes/auth.js";
import { tasksRouter } from "./routes/tasks.js";
import { locationRouter } from "./routes/location.js";
import { pointsRouter, leaderboardRouter, epochsRouter } from "./routes/stats.js";
import { claimRouter } from "./routes/claim.js";

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "256kb" }));

// Attach parsed cookies (tiny built-in parser; no extra dep).
app.use((req, _res, next) => {
  req.cookies = parseCookies(req.headers.cookie);
  next();
});

// Basic CORS for the web app.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && (origin === config.webUrl || origin === "http://localhost:5173")) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    cluster: config.solanaCluster,
    mintConfigured: Boolean(config.orvaMint),
    xConfigured: Boolean(config.xClientId),
  });
});

app.use("/api/auth", authRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/location", locationRouter);
app.use("/api/points", pointsRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/epochs", epochsRouter);
app.use("/api/claim", claimRouter);

// Session cookie name check route for debugging (no secret exposure).
app.get("/api/_session-cookie", (_req, res) => {
  res.json({ cookieName: SESSION_COOKIE });
});

// 404 + error handler
app.use((_req, res) => res.status(404).json({ error: "not found" }));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
);

app.listen(config.port, () => {
  console.log(`oruva-points api listening on :${config.port}`);
});

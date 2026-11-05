
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pool from "./db.js";

const PgSession = connectPgSimple(session);

export function createSessionMiddleware() {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET must contain at least 32 characters"
    );
  }

  const isProduction = process.env.NODE_ENV === "production";

  const store = new PgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: false
  });

  return session({
    name: "naude.sid",
    store,
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/"
    }
  });
}

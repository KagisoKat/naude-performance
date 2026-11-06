
import {
  randomBytes,
  timingSafeEqual
} from "node:crypto";

const SAFE_METHODS = new Set([
  "GET",
  "HEAD",
  "OPTIONS"
]);

export function generateCsrfToken(req) {
  if (!req.session) {
    throw new Error("Session middleware is required");
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken =
      randomBytes(32).toString("hex");
  }

  return req.session.csrfToken;
}

export function requireCsrfToken(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const expected = req.session?.csrfToken;
  const supplied = req.get("X-CSRF-Token");

  if (
    typeof expected !== "string" ||
    typeof supplied !== "string"
  ) {
    return res.status(403).json({
      success: false,
      message: "Invalid or missing CSRF token"
    });
  }

  const expectedBuffer = Buffer.from(expected, "utf8");
  const suppliedBuffer = Buffer.from(supplied, "utf8");

  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    return res.status(403).json({
      success: false,
      message: "Invalid or missing CSRF token"
    });
  }

  return next();
}

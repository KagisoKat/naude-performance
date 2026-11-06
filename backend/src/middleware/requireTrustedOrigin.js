
const SAFE_METHODS = new Set([
  "GET",
  "HEAD",
  "OPTIONS"
]);

export function requireTrustedOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const origin = req.get("Origin");

  // Some non-browser clients omit Origin.
  // Reject those requests in this initial policy.
  if (!origin) {
    return res.status(403).json({
      success: false,
      message: "Request origin required"
    });
  }

  const allowedOrigins = [
    process.env.FRONTEND_ORIGIN
  ].filter(Boolean);

  if (!allowedOrigins.includes(origin)) {
    return res.status(403).json({
      success: false,
      message: "Untrusted request origin"
    });
  }

  next();
}


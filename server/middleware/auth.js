function requireBearerToken(req, res, next) {
  const expectedToken = process.env.BEARER_TOKEN;

  if (!expectedToken) {
    return res.status(500).json({
      ok: false,
      error: "Server bearer token is not configured"
    });
  }

  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || token !== expectedToken) {
    return res.status(401).json({
      ok: false,
      error: "Unauthorized"
    });
  }

  next();
}

module.exports = {
  requireBearerToken
};
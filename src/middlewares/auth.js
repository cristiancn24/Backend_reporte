const jwt = require("jsonwebtoken");
const cookie = require("cookie");

const secret = process.env.JWT_SECRET || require('../config').jwt.secret;

const verificarToken = (req, res, next) => {
  try {
    const rawCookies = req.headers.cookie;

    if (!rawCookies) {
      return res.status(401).json({ error: "Acceso denegado. Cookie no enviada." });
    }

    const cookies = cookie.parse(rawCookies);
    const token = cookies.auth_token;

    if (!token) {
      return res.status(401).json({ error: "Acceso denegado. Token no presente." });
    }

    const decoded = jwt.verify(token, secret);

    // Guardar datos del usuario en la request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role_id: decoded.role_id
    };

    next();
  } catch (error) {
    console.error("Error en verificación de token:", error.message);
    return res.status(401).json({ error: "Token inválido o expirado." });
  }
};

module.exports = verificarToken;

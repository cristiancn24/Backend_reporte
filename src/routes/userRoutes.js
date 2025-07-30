const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const verificarToken = require('../middlewares/auth');
const cookie = require('cookie');

router.get('/', verificarToken, userController.getAllUsers);
router.get('/estadisticas', userController.getEstadisticasSoportes);
router.get('/tecnicos', userController.getTechnicians);
router.get('/:id', userController.getUserById);
router.post('/', verificarToken, userController.createUser);
router.patch('/:id', verificarToken, userController.updateUser);
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña son requeridos" })
    }

    const result = await userController.login(email, password) // debe devolver { token, user }

    // Serializar la cookie del JWT
    const serializedCookie = cookie.serialize("auth_token", result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24, // 1 día
      path: "/",
    })

    res.setHeader("Set-Cookie", serializedCookie)

    // Puedes devolver solo info del usuario (no el token)
    res.status(200).json({
      message: "Login exitoso",
      user: result.user,
    })
  } catch (error) {
    console.error("Error en login:", error.message)
    res.status(401).json({ error: error.message || "Error de autenticación" })
  }
});
router.post('/logout', verificarToken, userController.logout);


module.exports = router;
const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const verificarToken = require('../middlewares/auth');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads");

// configuración de Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // guardamos por ticket: uploads/tickets/:id
    const dir = path.join(UPLOAD_ROOT, "tickets", String(req.params.id));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safeOriginal = file.originalname.replace(/[^\w.\-]/g, "_");
    cb(null, `${Date.now()}_${safeOriginal}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB por archivo
  fileFilter: (_req, file, cb) => {
    // opcional: limitar tipos
    const allowed = [
      "application/pdf",
      "image/png", "image/jpeg", "image/gif",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "application/zip", "application/x-rar-compressed"
    ];
    if (!allowed.includes(file.mimetype)) return cb(new Error("Tipo de archivo no permitido"));
    cb(null, true);
  }
});

router.post('/', verificarToken, ticketController.createTicket);
router.get('/', ticketController.getTickets);
router.get('/status-options', ticketController.getStatusOptions);
router.get('/filters', ticketController.handler);
router.get('/:id', ticketController.getTicketById);
router.get('/assigned/:userId', ticketController.getTicketsByAssignedUserId);
router.patch('/:id', verificarToken, ticketController.updateTicket);
router.delete('/:id', verificarToken, ticketController.deleteTicket);
router.post('/:id/attachments', verificarToken, upload.array('files'), ticketController.addAttachments);
router.post('/:id/comments', verificarToken, ticketController.addTicketComment);

module.exports = router;
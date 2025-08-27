const express = require('express');
const morgan = require('morgan');
const config = require('./config');
const cors = require('cors');
const path = require('path');
const fs = require('fs');


const UPLOAD_ROOT = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
const userRoutes = require('./routes/userRoutes');  
const ticketRoutes = require('./routes/ticketRoutes');
const faqRoutes = require('./routes/faqRoutes');
const roleRoutes = require('./routes/roleRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const officesRoutes = require('./routes/officesRoutes');
const departmentsRoutes = require('./routes/departmentsRoutes'); 
const categoryServiceRoutes = require('./routes/categoryServiceRoutes');
const app = express();
const cookieParser = require("cookie-parser");
app.use(cookieParser());

app.use(morgan('dev'));
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true // 🔥 necesario para permitir cookies
}));
app.use(express.urlencoded({extended: true}));
app.set('port', config.app.port);



//rutas
app.use('/uploads', express.static(UPLOAD_ROOT)); // Servir archivos estáticos desde el directorio de uploads
app.use('/api/users', userRoutes)
app.use('/api/tickets', ticketRoutes)
app.use('/api/faq', faqRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/offices', officesRoutes);
app.use('/api/departments', departmentsRoutes); 
app.use('/api/categoryServices', categoryServiceRoutes);
//app.use('/api/tickets', tickets)
//app.use('/api/users', users)

module.exports = app;
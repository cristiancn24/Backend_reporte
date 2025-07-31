const express = require('express');
const morgan = require('morgan');
const config = require('./config');
const cors = require('cors');

const userRoutes = require('./routes/userRoutes');  
const ticketRoutes = require('./routes/ticketRoutes');
const faqRoutes = require('./routes/faqRoutes');
const roleRoutes = require('./routes/roleRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const officesRoutes = require('./routes/officesRoutes');
const departmentsRoutes = require('./routes/departmentsRoutes'); 
const app = express();

app.use(morgan('dev'));
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true // 🔥 necesario para permitir cookies
}));
app.use(express.urlencoded({extended: true}));
app.set('port', config.app.port);



//rutas
app.use('/api/users', userRoutes)
app.use('/api/tickets', ticketRoutes)
app.use('/api/faq', faqRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/offices', officesRoutes);
app.use('/api/departments', departmentsRoutes); 
//app.use('/api/tickets', tickets)
//app.use('/api/users', users)

module.exports = app;
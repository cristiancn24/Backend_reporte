const express = require('express');
const morgan = require('morgan');
const config = require('./config');
const cors = require('cors');

const users = require('./routes/users/routes.js');
const tickets = require('./routes/tickets/routes.js');
const userRoutes = require('./routes/userRoutes');  
const ticketRoutes = require('./routes/ticketRoutes');

const app = express();

app.use(morgan('dev'));
app.use(express.json());
app.use(cors({origin: 'http://localhost:3000'}));
app.use(express.urlencoded({extended: true}));
app.set('port', config.app.port);



//rutas
app.use('/api/users', userRoutes)
app.use('/api/tickets', ticketRoutes)
//app.use('/api/tickets', tickets)
//app.use('/api/users', users)

module.exports = app;
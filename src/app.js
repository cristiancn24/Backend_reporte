const express = require('express');
const morgan = require('morgan');
const config = require('./config');
const cors = require('cors');

const users = require('./routes/users/routes.js');
const tickets = require('./routes/tickets/routes.js');  

const app = express();

app.use(morgan('dev'));
app.use(express.json());
app.use(cors({origin: 'http://localhost:3000'}));
app.use(express.urlencoded({extended: true}));
app.set('port', config.app.port);



//rutas
app.use('/api/users', users)
app.use('/api/tickets', tickets)

module.exports = app;
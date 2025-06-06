const jwt = require('jsonwebtoken');
const config = require('../config');

const secret = config.jwt.secret || process.env.JWT_SECRET;

function asignarToken(data) {
  return jwt.sign(
    {
      id: data.id,       
      email: data.email,
      role_id: data.role_id 
    },
    secret,
    {
      expiresIn: '8h',
      algorithm: 'HS256'
    }
  );
}

module.exports = {
    asignarToken
};
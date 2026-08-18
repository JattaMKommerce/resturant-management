const jwt = require('jsonwebtoken');

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role_name || user.role
    },
    process.env.JWT_SECRET || 'super_secret_hotel_jwt_key_2026',
    { expiresIn: '24h' }
  );
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET || 'super_secret_hotel_jwt_key_2026');
}

module.exports = {
  generateToken,
  verifyToken
};

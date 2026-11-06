const { signToken, verifyToken } = require('./authSession');

function generateToken(user) {
  return signToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role_name || user.role
  });
}

module.exports = {
  generateToken,
  verifyToken
};

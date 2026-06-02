const jwt = require('jsonwebtoken');

const AUTH_HEADER = 'authorization';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 chars');
  }
  return secret;
}

function readBearerToken(event) {
  const headers = event.headers || {};
  const raw = headers[AUTH_HEADER] || headers.Authorization || '';
  if (!raw || !raw.startsWith('Bearer ')) return null;
  return raw.slice('Bearer '.length).trim();
}

function signAccessToken(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '8h' });
}

function signOtpChallenge(payload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '5m' });
}

function verifyJwt(token) {
  return jwt.verify(token, getJwtSecret());
}

function requireAuth(event) {
  const token = readBearerToken(event);
  if (!token) {
    return { ok: false, statusCode: 401, error: 'Missing bearer token' };
  }

  try {
    const claims = verifyJwt(token);
    if (!claims || !claims.sub || !claims.officeId || !claims.role) {
      return { ok: false, statusCode: 401, error: 'Invalid token claims' };
    }
    return { ok: true, claims };
  } catch {
    return { ok: false, statusCode: 401, error: 'Invalid or expired token' };
  }
}

module.exports = {
  signAccessToken,
  signOtpChallenge,
  verifyJwt,
  requireAuth
};

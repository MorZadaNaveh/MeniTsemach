const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const { signAccessToken, signOtpChallenge, verifyJwt } = require('./_auth');

const USER_KEY = 'users';
const DEMO_LOGIN_ENABLED = process.env.ALLOW_DEMO_LOGIN === 'true';
const DEMO_EMAIL = (process.env.DEMO_EMAIL || 'demo@mazkir.co.il').trim().toLowerCase();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo1234';
const DEMO_OTP = process.env.DEMO_OTP || '123456';
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function getAuthStore() {
  try {
    const { getStore } = require('@netlify/blobs');
    const store = getStore('auth');
    return {
      async get(key) { return store.get(key, { type: 'json' }); },
      async set(key, data) { await store.setJSON(key, data); }
    };
  } catch {
    const dir = path.resolve(__dirname, '../../.local-store/auth');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return {
      async get(key) {
        const file = path.join(dir, `${key}.json`);
        if (!fs.existsSync(file)) return null;
        return JSON.parse(fs.readFileSync(file, 'utf-8'));
      },
      async set(key, data) {
        fs.writeFileSync(path.join(dir, `${key}.json`), JSON.stringify(data, null, 2));
      }
    };
  }
}

function normalizeEmail(v) {
  return String(v || '').trim().toLowerCase();
}

function hashToken(v) {
  return crypto.createHash('sha256').update(v).digest('hex');
}

function withoutSecrets(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    officeId: user.officeId,
    active: user.active
  };
}

async function ensureSeedAdmin(store) {
  const current = await store.get(USER_KEY);
  if (Array.isArray(current) && current.length > 0) return current;

  const email = normalizeEmail(process.env.ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD || '';
  const officeId = process.env.ADMIN_OFFICE_ID || 'default-office';
  const role = process.env.ADMIN_ROLE || 'admin';
  const hasPresetTotp = Boolean(process.env.ADMIN_TOTP_SECRET);
  const totpSecret = process.env.ADMIN_TOTP_SECRET || authenticator.generateSecret();

  if (!email || !password) return [];

  const passwordHash = await bcrypt.hash(password, 12);
  const seeded = [{
    id: 'user_admin',
    email,
    passwordHash,
    role,
    officeId,
    active: true,
    totpSecret,
    failedAttempts: 0,
    lockUntil: null,
    createdAt: new Date().toISOString()
  }];

  await store.set(USER_KEY, seeded);
  if (!hasPresetTotp) {
    const uri = authenticator.keyuri(email, 'MeniDashboard', totpSecret);
    console.warn('Generated ADMIN_TOTP_SECRET for bootstrap user. Save it securely and set ADMIN_TOTP_SECRET in env.');
    console.warn('Bootstrap TOTP URI:', uri);
  }
  return seeded;
}

function parseBody(event) {
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf-8')
    : event.body || '{}';
  return JSON.parse(raw);
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = parseBody(event);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Invalid JSON' }) };
  }

  const action = body.action;
  const store = getAuthStore();
  const users = await ensureSeedAdmin(store);

  if (action === 'login') {
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');

    if (DEMO_LOGIN_ENABLED && email === DEMO_EMAIL && password === DEMO_PASSWORD) {
      const challengeToken = signOtpChallenge({
        sub: 'demo_user',
        officeId: process.env.DEMO_OFFICE_ID || 'default-office',
        role: process.env.DEMO_ROLE || 'admin',
        type: 'otp_demo'
      });
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          requiresOtp: true,
          challengeToken,
          isDemo: true
        })
      };
    }

    const user = users.find(u => u.email === email && u.active);
    const invalid = { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: 'Invalid credentials' }) };
    if (!user) return invalid;

    const now = Date.now();
    if (user.lockUntil && now < user.lockUntil) {
      return {
        statusCode: 423,
        headers,
        body: JSON.stringify({ ok: false, error: 'Account temporarily locked. Try again later.' })
      };
    }

    const passOk = await bcrypt.compare(password, user.passwordHash);
    if (!passOk) {
      user.failedAttempts = (user.failedAttempts || 0) + 1;
      if (user.failedAttempts >= 5) {
        user.lockUntil = now + 15 * 60 * 1000;
        user.failedAttempts = 0;
      }
      await store.set(USER_KEY, users);
      return invalid;
    }

    user.failedAttempts = 0;
    user.lockUntil = null;
    await store.set(USER_KEY, users);

    const challengeId = crypto.randomUUID();
    const challengeToken = signOtpChallenge({
      sub: user.id,
      officeId: user.officeId,
      role: user.role,
      challengeId,
      type: 'otp'
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        requiresOtp: true,
        challengeToken
      })
    };
  }

  if (action === 'verifyOtp') {
    const code = String(body.code || '').trim();
    const challengeToken = String(body.challengeToken || '');
    if (!challengeToken || !code) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Missing challenge token or code' }) };
    }

    let challenge;
    try {
      challenge = verifyJwt(challengeToken);
    } catch {
      return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: 'Invalid OTP challenge' }) };
    }

    if (challenge.type !== 'otp' || !challenge.sub) {
      if (challenge.type === 'otp_demo') {
        if (code !== DEMO_OTP) {
          return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: 'Invalid OTP code' }) };
        }
        const jti = crypto.randomUUID();
        const accessToken = signAccessToken({
          sub: 'demo_user',
          officeId: challenge.officeId || (process.env.DEMO_OFFICE_ID || 'default-office'),
          role: challenge.role || (process.env.DEMO_ROLE || 'admin'),
          jti,
          jtiHash: hashToken(jti)
        });
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            ok: true,
            accessToken,
            user: {
              id: 'demo_user',
              email: DEMO_EMAIL,
              role: challenge.role || (process.env.DEMO_ROLE || 'admin'),
              officeId: challenge.officeId || (process.env.DEMO_OFFICE_ID || 'default-office'),
              active: true
            },
            isDemo: true
          })
        };
      }
      return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: 'Invalid OTP challenge' }) };
    }

    const user = users.find(u => u.id === challenge.sub && u.active);
    if (!user) {
      return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: 'User not found' }) };
    }

    const otpOk = authenticator.check(code, user.totpSecret);
    if (!otpOk) {
      return { statusCode: 401, headers, body: JSON.stringify({ ok: false, error: 'Invalid OTP code' }) };
    }

    const jti = crypto.randomUUID();
    const accessToken = signAccessToken({
      sub: user.id,
      officeId: user.officeId,
      role: user.role,
      jti,
      jtiHash: hashToken(jti)
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        accessToken,
        user: withoutSecrets(user)
      })
    };
  }

  return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'Unknown action' }) };
};

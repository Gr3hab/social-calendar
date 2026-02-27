import { createHmac, randomInt, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createSmsSender, SmsDeliveryError } from './smsProviders.mjs';
import { createDataRepository } from './dataRepository.mjs';

class HttpError extends Error {
  constructor(statusCode, payload) {
    super(payload?.error?.message ?? 'Request failed');
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

function parseIntWithFallback(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

function parseBoolWithFallback(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') {
    return true;
  }
  if (normalized === 'false' || normalized === '0') {
    return false;
  }
  return fallback;
}

function normalizeSmsProvider(value, fallback) {
  const normalized = String(value ?? fallback ?? 'mock').trim().toLowerCase();
  if (normalized === 'twilio') {
    return 'twilio';
  }
  return 'mock';
}

function normalizeDataStore(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'postgres') {
    return 'postgres';
  }
  return 'memory';
}

function validateAuthConfig(config) {
  const isProduction = config.nodeEnv === 'production';
  if (config.smsProvider !== 'mock' && config.smsProvider !== 'twilio') {
    throw new Error('AUTH_SMS_PROVIDER must be either "mock" or "twilio"');
  }
  if (config.dataStore !== 'memory' && config.dataStore !== 'postgres') {
    throw new Error('DATA_STORE must be either "memory" or "postgres"');
  }
  if (config.port <= 0 || config.port > 65535) {
    throw new Error('AUTH_API_PORT must be a valid port');
  }
  if (isProduction && config.secret.length < 32) {
    throw new Error('AUTH_API_SECRET must be at least 32 chars in production');
  }
  if (isProduction && config.corsOrigin === '*') {
    throw new Error('AUTH_API_CORS_ORIGIN cannot be "*" in production');
  }
  if (config.store === 'redis' && !config.redisUrl) {
    throw new Error('AUTH_REDIS_URL is required when AUTH_STORE=redis');
  }
  if (config.dataStore === 'postgres' && !config.dataPostgresUrl) {
    throw new Error('DATA_POSTGRES_URL is required when DATA_STORE=postgres');
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(config.dataTableName)) {
    throw new Error('DATA_TABLE_NAME contains invalid characters');
  }
  if (typeof config.dataScope !== 'string' || config.dataScope.trim().length === 0) {
    throw new Error('DATA_SCOPE must be a non-empty string');
  }
  if (typeof config.dataInviteSecret !== 'string' || config.dataInviteSecret.trim().length < 8) {
    throw new Error('DATA_INVITE_SECRET must be at least 8 chars');
  }
  if (isProduction && config.dataInviteSecret.trim().length < 32) {
    throw new Error('DATA_INVITE_SECRET must be at least 32 chars in production');
  }
  if (config.smsRequestTimeoutMs < 1_000) {
    throw new Error('AUTH_SMS_REQUEST_TIMEOUT_MS must be >= 1000');
  }
  if (config.smsMaxRetries < 0 || config.smsMaxRetries > 5) {
    throw new Error('AUTH_SMS_MAX_RETRIES must be between 0 and 5');
  }
  if (isProduction && config.exposeDebugCode) {
    throw new Error('AUTH_EXPOSE_DEBUG_CODE must be false in production');
  }
  if (isProduction && config.smsProvider !== 'twilio') {
    throw new Error('AUTH_SMS_PROVIDER must be "twilio" in production');
  }
  if (config.smsProvider === 'twilio') {
    if (!config.twilioAccountSid || !config.twilioAuthToken) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required for Twilio SMS');
    }
    if (!config.smsFrom && !config.twilioMessagingServiceSid) {
      throw new Error('AUTH_SMS_FROM or TWILIO_MESSAGING_SERVICE_SID is required for Twilio SMS');
    }
  }
}

export function loadAuthConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  const smsProvider = normalizeSmsProvider(env.AUTH_SMS_PROVIDER, isProduction ? 'twilio' : 'mock');
  const config = {
    host: env.AUTH_API_HOST ?? '127.0.0.1',
    port: parseIntWithFallback(env.AUTH_API_PORT, 8787),
    corsOrigin: env.AUTH_API_CORS_ORIGIN ?? '*',
    secret: env.AUTH_API_SECRET ?? 'dev-change-me',
    nodeEnv,
    otpTtlMs: parseIntWithFallback(env.OTP_TTL_MS, 5 * 60 * 1000),
    otpResendCooldownMs: parseIntWithFallback(env.OTP_RESEND_COOLDOWN_MS, 30_000),
    otpVerifyAttemptsMax: parseIntWithFallback(env.OTP_VERIFY_ATTEMPTS_MAX, 5),
    otpVerifyLockMs: parseIntWithFallback(env.OTP_VERIFY_LOCK_MS, 5 * 60 * 1000),
    sendIpLimit: parseIntWithFallback(env.SEND_IP_LIMIT, 30),
    sendPhoneLimit: parseIntWithFallback(env.SEND_PHONE_LIMIT, 5),
    verifyIpLimit: parseIntWithFallback(env.VERIFY_IP_LIMIT, 50),
    verifyPhoneLimit: parseIntWithFallback(env.VERIFY_PHONE_LIMIT, 12),
    rateLimitWindowMs: parseIntWithFallback(env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    store: env.AUTH_STORE === 'redis' ? 'redis' : 'memory',
    redisUrl: env.AUTH_REDIS_URL ?? '',
    redisPrefix: env.AUTH_REDIS_PREFIX ?? 'social-cal-auth',
    dataStore: normalizeDataStore(env.DATA_STORE),
    dataPostgresUrl: env.DATA_POSTGRES_URL ?? '',
    dataPostgresSsl: parseBoolWithFallback(env.DATA_POSTGRES_SSL, false),
    dataScope: env.DATA_SCOPE ?? 'default',
    dataTableName: env.DATA_TABLE_NAME ?? 'app_data_state',
    dataInviteSecret: env.DATA_INVITE_SECRET ?? env.AUTH_API_SECRET ?? 'dev-change-me',
    publicAppBaseUrl: env.PUBLIC_APP_BASE_URL ?? 'http://127.0.0.1:5173',
    smsProvider,
    smsFrom: env.AUTH_SMS_FROM ?? '',
    smsRequestTimeoutMs: parseIntWithFallback(env.AUTH_SMS_REQUEST_TIMEOUT_MS, 10_000),
    smsMaxRetries: parseIntWithFallback(env.AUTH_SMS_MAX_RETRIES, 2),
    twilioAccountSid: env.TWILIO_ACCOUNT_SID ?? '',
    twilioAuthToken: env.TWILIO_AUTH_TOKEN ?? '',
    twilioMessagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID ?? '',
    exposeDebugCode: parseBoolWithFallback(env.AUTH_EXPOSE_DEBUG_CODE, !isProduction),
  };

  validateAuthConfig(config);
  return config;
}

function normalizePhoneNumber(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return '';
  }

  const raw = trimmed.replace(/[^\d+]/g, '');
  if (!raw) {
    return '';
  }

  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '');
    return digits ? `+${digits}` : '';
  }

  if (raw.startsWith('00')) {
    const digits = raw.slice(2).replace(/\D/g, '');
    return digits ? `+${digits}` : '';
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    return '';
  }

  if (digits.startsWith('0')) {
    return `+49${digits.slice(1)}`;
  }

  return `+${digits}`;
}

function isValidPhoneNumber(phoneNumber) {
  return /^\+\d{8,15}$/.test(phoneNumber);
}

function isValidOtpCode(code) {
  return /^\d{6}$/.test(String(code ?? ''));
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

function maskPhone(phoneNumber) {
  if (phoneNumber.length <= 5) {
    return phoneNumber;
  }
  return `${phoneNumber.slice(0, 4)}***${phoneNumber.slice(-2)}`;
}

function hashOtp(secret, phoneNumber, code, salt) {
  return createHmac('sha256', secret)
    .update(`${phoneNumber}:${code}:${salt}`)
    .digest('hex');
}

function buildToken(secret, payload) {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function parseSignedToken(secret, token) {
  if (typeof token !== 'string') {
    return null;
  }
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  const [encoded, signature] = parts;
  const expectedSignature = createHmac('sha256', secret).update(encoded).digest('base64url');
  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const decoded = Buffer.from(encoded, 'base64url').toString('utf8');
    const payload = JSON.parse(decoded);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

function getBearerToken(req) {
  const header = req.headers.authorization;
  if (typeof header !== 'string') {
    return null;
  }
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function requirePrivateAuth(req, config, nowMs) {
  const token = getBearerToken(req);
  if (!token) {
    throw new HttpError(401, {
      ok: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required.',
      },
    });
  }

  const claims = parseSignedToken(config.secret, token);
  if (!claims || typeof claims.sub !== 'string' || typeof claims.phoneNumber !== 'string') {
    throw new HttpError(401, {
      ok: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentication required.',
      },
    });
  }

  if (typeof claims.exp === 'number' && claims.exp * 1000 < nowMs) {
    throw new HttpError(401, {
      ok: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Session expired. Please login again.',
      },
    });
  }

  return claims;
}

function getSearchParam(url, key) {
  try {
    return new URL(url, 'http://localhost').searchParams.get(key);
  } catch {
    return null;
  }
}

function getInviteValueFromLink(link, key) {
  if (!link || typeof link !== 'string') {
    return null;
  }
  try {
    return new URL(link).searchParams.get(key);
  } catch {
    return null;
  }
}

function isValidPublicInviteRequest(event, inviteCode, inviteToken, config, nowMs) {
  if (!event) {
    return false;
  }

  const expiresAtMs = event.linkExpiresAt ? new Date(event.linkExpiresAt).getTime() : null;
  if (typeof expiresAtMs === 'number' && Number.isFinite(expiresAtMs) && nowMs > expiresAtMs) {
    return false;
  }

  const expectedCode = String(event.invitationCode ?? getInviteValueFromLink(event.invitationLink, 'code') ?? '').trim();
  if (!expectedCode || inviteCode !== expectedCode) {
    return false;
  }

  const expectedToken = String(getInviteValueFromLink(event.invitationLink, 'token') ?? '').trim();
  if (!expectedToken) {
    // Backward-compatible for old invite links without token.
    return true;
  }
  if (!inviteToken || inviteToken !== expectedToken) {
    return false;
  }

  const payload = parseSignedToken(config.dataInviteSecret, inviteToken);
  if (!payload) {
    return false;
  }
  if (payload.eventId !== event.id || payload.code !== expectedCode) {
    return false;
  }
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < nowMs) {
    return false;
  }

  return true;
}

export class InMemoryAuthRepository {
  constructor() {
    this.otpMap = new Map();
    this.userMap = new Map();
    this.rateMap = new Map();
  }

  cleanup(now) {
    for (const [key, value] of this.otpMap.entries()) {
      if (value.expiresAt <= now) {
        this.otpMap.delete(key);
      }
    }

    for (const [key, value] of this.rateMap.entries()) {
      if (value.expiresAt <= now) {
        this.rateMap.delete(key);
      }
    }
  }

  async getOtp(phoneNumber, now) {
    this.cleanup(now);
    const value = this.otpMap.get(phoneNumber);
    return value ? { ...value.data } : null;
  }

  async saveOtp(phoneNumber, data, ttlMs, now) {
    this.cleanup(now);
    this.otpMap.set(phoneNumber, {
      data: { ...data },
      expiresAt: now + Math.max(ttlMs, 1_000),
    });
  }

  async deleteOtp(phoneNumber) {
    this.otpMap.delete(phoneNumber);
  }

  async getUser(phoneNumber) {
    const user = this.userMap.get(phoneNumber);
    return user ? { ...user } : null;
  }

  async saveUser(phoneNumber, user) {
    this.userMap.set(phoneNumber, { ...user });
  }

  async consumeRateLimit(key, limit, windowMs, now) {
    this.cleanup(now);
    const current = this.rateMap.get(key);
    if (!current) {
      this.rateMap.set(key, {
        count: 1,
        expiresAt: now + windowMs,
      });
      return { blocked: false, retryAfterMs: 0 };
    }

    current.count += 1;
    this.rateMap.set(key, current);
    if (current.count > limit) {
      return {
        blocked: true,
        retryAfterMs: Math.max(1_000, current.expiresAt - now),
      };
    }

    return { blocked: false, retryAfterMs: 0 };
  }

  async close() {
    this.otpMap.clear();
    this.userMap.clear();
    this.rateMap.clear();
  }
}

class RedisAuthRepository {
  constructor(redis, prefix) {
    this.redis = redis;
    this.prefix = prefix;
  }

  otpKey(phoneNumber) {
    return `${this.prefix}:otp:${phoneNumber}`;
  }

  userKey(phoneNumber) {
    return `${this.prefix}:user:${phoneNumber}`;
  }

  rateKey(key) {
    return `${this.prefix}:rate:${key}`;
  }

  async getOtp(phoneNumber, now) {
    const raw = await this.redis.get(this.otpKey(phoneNumber));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (parsed.expiresAt <= now) {
      await this.redis.del(this.otpKey(phoneNumber));
      return null;
    }
    return parsed;
  }

  async saveOtp(phoneNumber, data, ttlMs) {
    await this.redis.set(this.otpKey(phoneNumber), JSON.stringify(data), 'PX', Math.max(ttlMs, 1_000));
  }

  async deleteOtp(phoneNumber) {
    await this.redis.del(this.otpKey(phoneNumber));
  }

  async getUser(phoneNumber) {
    const raw = await this.redis.get(this.userKey(phoneNumber));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  }

  async saveUser(phoneNumber, user) {
    await this.redis.set(this.userKey(phoneNumber), JSON.stringify(user));
  }

  async consumeRateLimit(key, limit, windowMs) {
    const redisKey = this.rateKey(key);
    const results = await this.redis.multi().incr(redisKey).pttl(redisKey).exec();
    const count = Number(results?.[0]?.[1] ?? 0);
    let ttl = Number(results?.[1]?.[1] ?? -1);

    if (count === 1 || ttl < 0) {
      await this.redis.pexpire(redisKey, windowMs);
      ttl = windowMs;
    }

    if (count > limit) {
      return {
        blocked: true,
        retryAfterMs: Math.max(1_000, ttl),
      };
    }

    return { blocked: false, retryAfterMs: 0 };
  }

  async close() {
    await this.redis.quit();
  }
}

async function createRepository(config) {
  if (config.store !== 'redis') {
    return new InMemoryAuthRepository();
  }

  const module = await import('ioredis');
  const Redis = module.default;
  const redis = new Redis(config.redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });
  await redis.connect();
  await redis.ping();
  return new RedisAuthRepository(redis, config.redisPrefix);
}

export function createAuthService(options) {
  const { config, repository, smsSender } = options;
  const nowFn = options.now ?? Date.now;
  if (!smsSender || typeof smsSender.sendOtp !== 'function') {
    throw new Error('smsSender with sendOtp() is required');
  }

  async function hitRateLimitOrThrow(params) {
    const { key, limit, windowMs, message } = params;
    const result = await repository.consumeRateLimit(key, limit, windowMs, nowFn());
    if (result.blocked) {
      throw new HttpError(429, {
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message,
          retryAfterMs: result.retryAfterMs,
        },
      });
    }
  }

  return {
    async sendCode(payload) {
      const phoneNumber = normalizePhoneNumber(payload.phoneNumber);
      if (!isValidPhoneNumber(phoneNumber)) {
        throw new HttpError(400, {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Please provide a valid phone number.',
          },
        });
      }

      await hitRateLimitOrThrow({
        key: `send:ip:${payload.clientIp}`,
        limit: config.sendIpLimit,
        windowMs: config.rateLimitWindowMs,
        message: 'Too many requests from this network.',
      });

      await hitRateLimitOrThrow({
        key: `send:phone:${phoneNumber}`,
        limit: config.sendPhoneLimit,
        windowMs: config.rateLimitWindowMs,
        message: 'Too many OTP requests for this phone number.',
      });

      const now = nowFn();
      const existing = await repository.getOtp(phoneNumber, now);
      if (existing && now < existing.resendAvailableAt) {
        throw new HttpError(429, {
          ok: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Please wait before requesting a new code.',
            retryAfterMs: existing.resendAvailableAt - now,
          },
        });
      }

      const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
      const salt = randomUUID();
      const otpEntry = {
        codeHash: hashOtp(config.secret, phoneNumber, code, salt),
        salt,
        expiresAt: now + config.otpTtlMs,
        resendAvailableAt: now + config.otpResendCooldownMs,
        attempts: 0,
        lockedUntil: 0,
      };

      try {
        await smsSender.sendOtp({
          phoneNumber,
          code,
          expiresInMs: config.otpTtlMs,
        });
      } catch (error) {
        if (error instanceof SmsDeliveryError && error.retryAfterMs > 0) {
          throw new HttpError(429, {
            ok: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'SMS gateway is busy. Please retry shortly.',
              retryAfterMs: error.retryAfterMs,
            },
          });
        }

        throw new HttpError(503, {
          ok: false,
          error: {
            code: 'SMS_DELIVERY_FAILED',
            message: 'Could not deliver SMS code. Please try again.',
          },
        });
      }

      const ttlMs = Math.max(config.otpTtlMs, config.otpResendCooldownMs, config.otpVerifyLockMs);
      await repository.saveOtp(phoneNumber, otpEntry, ttlMs, now);

      console.log(`[auth-api] OTP sent to ${maskPhone(phoneNumber)} via ${smsSender.provider ?? 'sms'}`);

      return {
        expiresInMs: config.otpTtlMs,
        resendInMs: config.otpResendCooldownMs,
        ...(config.exposeDebugCode ? { debugCode: code } : {}),
      };
    },

    async verifyCode(payload) {
      const phoneNumber = normalizePhoneNumber(payload.phoneNumber);
      const code = String(payload.code ?? '');
      if (!isValidPhoneNumber(phoneNumber) || !isValidOtpCode(code)) {
        throw new HttpError(400, {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Phone number or OTP code is invalid.',
          },
        });
      }

      await hitRateLimitOrThrow({
        key: `verify:ip:${payload.clientIp}`,
        limit: config.verifyIpLimit,
        windowMs: config.rateLimitWindowMs,
        message: 'Too many verification attempts from this network.',
      });

      await hitRateLimitOrThrow({
        key: `verify:phone:${phoneNumber}`,
        limit: config.verifyPhoneLimit,
        windowMs: config.rateLimitWindowMs,
        message: 'Too many verification attempts for this phone number.',
      });

      const now = nowFn();
      const otpEntry = await repository.getOtp(phoneNumber, now);
      if (!otpEntry) {
        throw new HttpError(401, {
          ok: false,
          error: {
            code: 'INVALID_CODE',
            message: 'Code invalid or expired.',
          },
        });
      }

      if (otpEntry.lockedUntil && now < otpEntry.lockedUntil) {
        throw new HttpError(429, {
          ok: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many incorrect codes. Try again later.',
            retryAfterMs: otpEntry.lockedUntil - now,
          },
        });
      }

      if (otpEntry.expiresAt <= now) {
        await repository.deleteOtp(phoneNumber);
        throw new HttpError(401, {
          ok: false,
          error: {
            code: 'CODE_EXPIRED',
            message: 'Code expired.',
          },
        });
      }

      const receivedHash = hashOtp(config.secret, phoneNumber, code, otpEntry.salt);
      if (receivedHash !== otpEntry.codeHash) {
        otpEntry.attempts += 1;
        if (otpEntry.attempts >= config.otpVerifyAttemptsMax) {
          otpEntry.lockedUntil = now + config.otpVerifyLockMs;
          const ttlMs = Math.max(otpEntry.expiresAt - now, config.otpVerifyLockMs);
          await repository.saveOtp(phoneNumber, otpEntry, ttlMs, now);
          throw new HttpError(429, {
            ok: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many incorrect codes. Please wait.',
              retryAfterMs: config.otpVerifyLockMs,
            },
          });
        }

        const ttlMs = Math.max(otpEntry.expiresAt - now, 1_000);
        await repository.saveOtp(phoneNumber, otpEntry, ttlMs, now);
        throw new HttpError(401, {
          ok: false,
          error: {
            code: 'INVALID_CODE',
            message: 'Code not correct.',
            remainingAttempts: config.otpVerifyAttemptsMax - otpEntry.attempts,
          },
        });
      }

      await repository.deleteOtp(phoneNumber);

      let user = await repository.getUser(phoneNumber);
      if (!user) {
        user = {
          id: randomUUID(),
          name: '',
          phoneNumber,
          createdAt: new Date(now).toISOString(),
        };
        await repository.saveUser(phoneNumber, user);
      }

      const token = buildToken(config.secret, {
        sub: user.id,
        phoneNumber: user.phoneNumber,
        iat: Math.floor(now / 1000),
        exp: Math.floor((now + 7 * 24 * 60 * 60 * 1000) / 1000),
      });

      return {
        token,
        user,
      };
    },

    health() {
      return {
        status: 'ok',
        store: config.store,
        dataStore: config.dataStore,
        smsProvider: config.smsProvider,
        env: config.nodeEnv,
        timestamp: new Date(nowFn()).toISOString(),
      };
    },
  };
}

function setCorsHeaders(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

function sendJson(res, statusCode, payload, corsOrigin) {
  setCorsHeaders(res, corsOrigin);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function getPathname(url) {
  try {
    return new URL(url, 'http://localhost').pathname;
  } catch {
    return String(url ?? '').split('?')[0] || '/';
  }
}

function decodePathPart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function toValidationError(message) {
  return new HttpError(400, {
    ok: false,
    error: {
      code: 'VALIDATION_ERROR',
      message,
    },
  });
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let length = 0;

    req.on('data', (chunk) => {
      length += chunk.length;
      if (length > 10_000) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }

      try {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });

    req.on('error', reject);
  });
}

export async function createAuthServer(options = {}) {
  const nowFn = typeof options.now === 'function' ? options.now : Date.now;
  const baseConfig = loadAuthConfig(options.env ?? process.env);
  const config = {
    ...baseConfig,
    ...(options.configOverrides ?? {}),
  };
  validateAuthConfig(config);

  const repository = options.repository ?? (await createRepository(config));
  const smsSender = options.smsSender ?? createSmsSender(config, options.smsOptions ?? {});
  const dataRepository = options.dataRepository ?? (await createDataRepository(config, options.dataOptions ?? {}));
  const authService = createAuthService({
    config,
    repository,
    smsSender,
    now: nowFn,
  });

  const handler = async (req, res) => {
    if (!req.url || !req.method) {
      sendJson(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }, config.corsOrigin);
      return;
    }
    const pathname = getPathname(req.url);

    if (req.method === 'OPTIONS') {
      setCorsHeaders(res, config.corsOrigin);
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      if (req.method === 'GET' && pathname === '/api/auth/health') {
        sendJson(
          res,
          200,
          {
            ok: true,
            data: authService.health(),
          },
          config.corsOrigin,
        );
        return;
      }

      if (req.method === 'POST' && pathname === '/api/auth/send-code') {
        const body = await readJsonBody(req);
        const result = await authService.sendCode({
          phoneNumber: body.phoneNumber,
          clientIp: getClientIp(req),
        });
        sendJson(res, 200, { ok: true, data: result }, config.corsOrigin);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/auth/verify-code') {
        const body = await readJsonBody(req);
        const result = await authService.verifyCode({
          phoneNumber: body.phoneNumber,
          code: body.code,
          clientIp: getClientIp(req),
        });
        sendJson(res, 200, { ok: true, data: result }, config.corsOrigin);
        return;
      }

      const publicEventGetMatch = pathname.match(/^\/api\/data\/public\/events\/([^/]+)$/);
      if (req.method === 'GET' && publicEventGetMatch) {
        const eventId = decodePathPart(publicEventGetMatch[1]);
        if (!eventId) {
          throw toValidationError('eventId is required.');
        }

        const inviteCode = String(getSearchParam(req.url, 'code') ?? '').trim();
        const inviteToken = String(getSearchParam(req.url, 'token') ?? '').trim() || null;
        const event = await dataRepository.getEventById(eventId);
        if (!isValidPublicInviteRequest(event, inviteCode, inviteToken, config, nowFn())) {
          sendJson(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'Event not found.' } }, config.corsOrigin);
          return;
        }

        sendJson(res, 200, { ok: true, data: event }, config.corsOrigin);
        return;
      }

      const publicRespondMatch = pathname.match(/^\/api\/data\/public\/events\/([^/]+)\/respond$/);
      if (req.method === 'POST' && publicRespondMatch) {
        const eventId = decodePathPart(publicRespondMatch[1]);
        if (!eventId) {
          throw toValidationError('eventId is required.');
        }

        const body = await readJsonBody(req);
        const inviteCode = String(body.code ?? '').trim();
        const inviteToken = String(body.token ?? '').trim() || null;
        const event = await dataRepository.getEventById(eventId);
        if (!isValidPublicInviteRequest(event, inviteCode, inviteToken, config, nowFn())) {
          sendJson(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'Event not found.' } }, config.corsOrigin);
          return;
        }

        const result = await dataRepository.respondToInvitation({
          eventId,
          name: body.name,
          phoneNumber: body.phoneNumber,
          status: body.status,
        });
        sendJson(res, 200, { ok: true, data: result }, config.corsOrigin);
        return;
      }

      const isPrivateDataRoute = pathname.startsWith('/api/data/') && !pathname.startsWith('/api/data/public/');
      if (isPrivateDataRoute) {
        requirePrivateAuth(req, config, nowFn());
      }

      if (req.method === 'GET' && pathname === '/api/data/state') {
        const result = await dataRepository.listState();
        sendJson(res, 200, { ok: true, data: result }, config.corsOrigin);
        return;
      }

      const eventGetMatch = pathname.match(/^\/api\/data\/events\/([^/]+)$/);
      if (req.method === 'GET' && eventGetMatch) {
        const eventId = decodePathPart(eventGetMatch[1]);
        if (!eventId) {
          throw toValidationError('eventId is required.');
        }
        const result = await dataRepository.getEventById(eventId);
        sendJson(res, 200, { ok: true, data: result }, config.corsOrigin);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/data/events') {
        const body = await readJsonBody(req);
        const result = await dataRepository.createEvent(body);
        sendJson(res, 200, { ok: true, data: result }, config.corsOrigin);
        return;
      }

      const respondMatch = pathname.match(/^\/api\/data\/events\/([^/]+)\/respond$/);
      if (req.method === 'POST' && respondMatch) {
        const eventId = decodePathPart(respondMatch[1]);
        const body = await readJsonBody(req);
        const result = await dataRepository.respondToInvitation({
          eventId,
          name: body.name,
          phoneNumber: body.phoneNumber,
          status: body.status,
        });
        sendJson(res, 200, { ok: true, data: result }, config.corsOrigin);
        return;
      }

      const reminderMatch = pathname.match(/^\/api\/data\/events\/([^/]+)\/reminder$/);
      if (req.method === 'POST' && reminderMatch) {
        const eventId = decodePathPart(reminderMatch[1]);
        const body = await readJsonBody(req);
        const result = await dataRepository.toggleEventReminder(eventId, body.enabled);
        sendJson(res, 200, { ok: true, data: result }, config.corsOrigin);
        return;
      }

      const nudgeMatch = pathname.match(/^\/api\/data\/events\/([^/]+)\/nudge$/);
      if (req.method === 'POST' && nudgeMatch) {
        const eventId = decodePathPart(nudgeMatch[1]);
        const result = await dataRepository.sendRsvpNudge(eventId);
        sendJson(res, 200, { ok: true, data: result }, config.corsOrigin);
        return;
      }

      if (req.method === 'POST' && pathname === '/api/data/groups') {
        const body = await readJsonBody(req);
        const result = await dataRepository.createGroup(body);
        sendJson(res, 200, { ok: true, data: result }, config.corsOrigin);
        return;
      }

      const groupMemberMatch = pathname.match(/^\/api\/data\/groups\/([^/]+)\/members$/);
      if (req.method === 'POST' && groupMemberMatch) {
        const groupId = decodePathPart(groupMemberMatch[1]);
        const body = await readJsonBody(req);
        const result = await dataRepository.addMembersToGroup(groupId, body.members ?? []);
        sendJson(res, 200, { ok: true, data: result }, config.corsOrigin);
        return;
      }

      sendJson(res, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }, config.corsOrigin);
    } catch (error) {
      if (error instanceof Error && error.message === 'VALIDATION_ERROR') {
        sendJson(
          res,
          400,
          { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request payload.' } },
          config.corsOrigin,
        );
        return;
      }

      if (error instanceof HttpError) {
        sendJson(res, error.statusCode, error.payload, config.corsOrigin);
        return;
      }

      if (error instanceof Error && error.message === 'PAYLOAD_TOO_LARGE') {
        sendJson(
          res,
          413,
          { ok: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large' } },
          config.corsOrigin,
        );
        return;
      }

      if (error instanceof Error && error.message === 'INVALID_JSON') {
        sendJson(
          res,
          400,
          { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
          config.corsOrigin,
        );
        return;
      }

      sendJson(
        res,
        500,
        { ok: false, error: { code: 'UNKNOWN_ERROR', message: 'Internal server error' } },
        config.corsOrigin,
      );
    }
  };

  const server = createServer(handler);

  const close = async () => {
    if (server.listening) {
      await new Promise((resolve) => {
        server.close(() => resolve(undefined));
      });
    }
    await repository.close?.();
    await smsSender.close?.();
    await dataRepository.close?.();
  };

  return {
    handler,
    server,
    config,
    repository,
    smsSender,
    dataRepository,
    close,
  };
}

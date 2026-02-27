import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

function maskPhone(phoneNumber) {
  if (!phoneNumber || phoneNumber.length <= 5) {
    return phoneNumber;
  }
  return `${phoneNumber.slice(0, 4)}***${phoneNumber.slice(-2)}`;
}

function parseRetryAfterMs(value) {
  if (!value) {
    return 0;
  }

  const seconds = Number.parseInt(String(value), 10);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1_000;
  }

  const dateValue = new Date(value).getTime();
  if (Number.isNaN(dateValue)) {
    return 0;
  }

  return Math.max(0, dateValue - Date.now());
}

function computeBackoffMs(attemptIndex) {
  return Math.min(3_000, 300 * 2 ** attemptIndex);
}

function buildOtpMessage(code, expiresInMs) {
  const ttlMinutes = Math.max(1, Math.round(expiresInMs / 60_000));
  return `Dein PlanIt Code: ${code}. Gueltig fuer ${ttlMinutes} Min.`;
}

async function safeParseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export class SmsDeliveryError extends Error {
  constructor(options = {}) {
    super(options.message ?? 'SMS delivery failed.');
    this.name = 'SmsDeliveryError';
    this.code = options.code ?? 'SMS_DELIVERY_FAILED';
    this.retryAfterMs = Number(options.retryAfterMs ?? 0);
    this.statusCode = Number(options.statusCode ?? 503);
    this.providerStatus = options.providerStatus ?? null;
    this.cause = options.cause;
  }
}

export function createMockSmsSender(options = {}) {
  const log = options.log ?? console.log;

  return {
    provider: 'mock',
    async sendOtp(payload) {
      log(`[auth-api] [mock-sms] OTP for ${maskPhone(payload.phoneNumber)}: ${payload.code}`);
      return {
        messageId: `mock-${randomUUID()}`,
      };
    },
  };
}

export function createTwilioSmsSender(config, options = {}) {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const sleepFn = options.sleepFn ?? ((ms) => sleep(ms));

  if (typeof fetchFn !== 'function') {
    throw new Error('Fetch API is required for Twilio SMS sender.');
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${config.twilioAccountSid}/Messages.json`;
  const authHeader = `Basic ${Buffer.from(`${config.twilioAccountSid}:${config.twilioAuthToken}`).toString('base64')}`;

  return {
    provider: 'twilio',
    async sendOtp(payload) {
      const message = buildOtpMessage(payload.code, payload.expiresInMs);
      let lastFailure = null;

      for (let attempt = 0; attempt <= config.smsMaxRetries; attempt += 1) {
        const body = new URLSearchParams({
          To: payload.phoneNumber,
          Body: message,
        });

        if (config.twilioMessagingServiceSid) {
          body.set('MessagingServiceSid', config.twilioMessagingServiceSid);
        } else {
          body.set('From', config.smsFrom);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.smsRequestTimeoutMs);

        try {
          const response = await fetchFn(endpoint, {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const parsed = await safeParseJson(response);
            return {
              messageId: parsed?.sid ?? `twilio-${randomUUID()}`,
            };
          }

          const providerRetryMs = parseRetryAfterMs(response.headers.get('retry-after'));
          const isRetryable = response.status === 429 || response.status >= 500;
          if (isRetryable && attempt < config.smsMaxRetries) {
            const waitMs = providerRetryMs > 0 ? providerRetryMs : computeBackoffMs(attempt);
            await sleepFn(waitMs);
            continue;
          }

          if (response.status === 429) {
            throw new SmsDeliveryError({
              code: 'SMS_RATE_LIMITED',
              message: 'SMS provider is temporarily rate-limited.',
              retryAfterMs: providerRetryMs > 0 ? providerRetryMs : computeBackoffMs(attempt),
              statusCode: 429,
              providerStatus: 429,
            });
          }

          lastFailure = new SmsDeliveryError({
            code: 'SMS_DELIVERY_FAILED',
            message: 'SMS provider rejected the request.',
            statusCode: 502,
            providerStatus: response.status,
          });
          break;
        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof SmsDeliveryError) {
            throw error;
          }

          lastFailure = new SmsDeliveryError({
            code: 'SMS_DELIVERY_FAILED',
            message: 'SMS provider unavailable.',
            statusCode: 503,
            cause: error,
          });
          if (attempt < config.smsMaxRetries) {
            await sleepFn(computeBackoffMs(attempt));
            continue;
          }
          break;
        }
      }

      throw lastFailure ?? new SmsDeliveryError();
    },
  };
}

export function createSmsSender(config, options = {}) {
  if (config.smsProvider === 'twilio') {
    return createTwilioSmsSender(config, options);
  }
  return createMockSmsSender(options);
}

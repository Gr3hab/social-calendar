import { ServiceError } from './serviceErrors';

export const MOCK_FAULTS_STORAGE_KEY = 'social-calendar:mock-faults:v1';

export type MockFaultType = 'network' | 'rate_limit';

export interface MockFaultConfig {
  type: MockFaultType;
  remaining?: number;
  retryAfterMs?: number;
  message?: string;
}

type MockFaultMap = Record<string, MockFaultConfig>;

function readFaults(): MockFaultMap {
  if (typeof window === 'undefined') {
    return {};
  }

  const raw = window.localStorage.getItem(MOCK_FAULTS_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as MockFaultMap;
  } catch {
    return {};
  }
}

function writeFaults(faults: MockFaultMap): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(MOCK_FAULTS_STORAGE_KEY, JSON.stringify(faults));
}

function resolveRemaining(config: MockFaultConfig): number {
  if (typeof config.remaining !== 'number') {
    return 1;
  }
  return Math.max(0, Math.floor(config.remaining));
}

function toServiceError(operation: string, config: MockFaultConfig): ServiceError {
  if (config.type === 'rate_limit') {
    return new ServiceError({
      code: 'RATE_LIMITED',
      message: config.message || `Rate limit for ${operation}`,
      retryAfterMs: config.retryAfterMs,
    });
  }

  return new ServiceError({
    code: 'NETWORK_ERROR',
    message: config.message || `Network unavailable for ${operation}`,
  });
}

export function setMockFault(operation: string, config: MockFaultConfig): void {
  const faults = readFaults();
  faults[operation] = config;
  writeFaults(faults);
}

export function clearMockFault(operation: string): void {
  const faults = readFaults();
  delete faults[operation];
  writeFaults(faults);
}

export function clearAllMockFaults(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(MOCK_FAULTS_STORAGE_KEY);
}

export function maybeThrowMockFault(operation: string): void {
  const faults = readFaults();
  const config = faults[operation];
  if (!config) {
    return;
  }

  const remaining = resolveRemaining(config);
  if (remaining <= 1) {
    delete faults[operation];
  } else {
    faults[operation] = { ...config, remaining: remaining - 1 };
  }
  writeFaults(faults);

  throw toServiceError(operation, config);
}

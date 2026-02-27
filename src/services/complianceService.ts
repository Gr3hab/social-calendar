export interface DataExportRequest {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  requestedAt: string;
}

export interface DeletionRequest {
  id: string;
  userId: string;
  reason?: string;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  requestedAt: string;
}

export interface AbuseReport {
  id: string;
  eventId?: string;
  reporterUserId?: string;
  reason: string;
  details?: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  createdAt: string;
}

const EXPORT_KEY = 'social-calendar:compliance:data-export-jobs:v1';
const DELETION_KEY = 'social-calendar:compliance:deletion-requests:v1';
const ABUSE_KEY = 'social-calendar:compliance:abuse-reports:v1';

function readJsonArray<T>(key: string): T[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeJsonArray<T>(key: string, value: T[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function requestDataExport(userId: string): Promise<DataExportRequest> {
  const payload: DataExportRequest = {
    id: createId('export'),
    userId,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };
  const jobs = readJsonArray<DataExportRequest>(EXPORT_KEY);
  jobs.unshift(payload);
  writeJsonArray(EXPORT_KEY, jobs);
  return payload;
}

export async function requestAccountDeletion(userId: string, reason?: string): Promise<DeletionRequest> {
  const payload: DeletionRequest = {
    id: createId('delete'),
    userId,
    reason: reason?.trim() || undefined,
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };
  const requests = readJsonArray<DeletionRequest>(DELETION_KEY);
  requests.unshift(payload);
  writeJsonArray(DELETION_KEY, requests);
  return payload;
}

export async function submitAbuseReport(input: {
  eventId?: string;
  reporterUserId?: string;
  reason: string;
  details?: string;
}): Promise<AbuseReport> {
  const payload: AbuseReport = {
    id: createId('abuse'),
    eventId: input.eventId,
    reporterUserId: input.reporterUserId,
    reason: input.reason.trim(),
    details: input.details?.trim() || undefined,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  const reports = readJsonArray<AbuseReport>(ABUSE_KEY);
  reports.unshift(payload);
  writeJsonArray(ABUSE_KEY, reports);
  return payload;
}


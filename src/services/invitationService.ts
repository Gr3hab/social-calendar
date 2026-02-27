import type { Event } from '../types';

export interface PlaceholderResult {
  provider: 'whatsapp' | 'instagram' | 'snapchat' | 'tiktok' | 'google' | 'outlook' | 'ics';
  status: 'mock';
  message: string;
}

function getBaseUrl(): string {
  if (typeof window === 'undefined') {
    return 'https://social-cal.local';
  }
  return window.location.origin;
}

function generateUniqueCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let code = '';
  for (let index = 0; index < length; index += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function generateInvitationLink(eventId: string): string {
  return `${getBaseUrl()}/invite/${eventId}?code=${generateUniqueCode()}`;
}

export function parseInvitationUrl(url: string): { eventId: string; code: string } | null {
  const match = url.match(/\/invite\/([^?]+)\?code=([^&]+)/);
  if (!match) {
    return null;
  }
  return { eventId: match[1], code: match[2] };
}

export function shareViaWhatsApp(link: string, message: string): PlaceholderResult {
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${message}\n\n${link}`)}`;
  if (typeof window !== 'undefined') {
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  }
  return {
    provider: 'whatsapp',
    status: 'mock',
    message: 'WhatsApp Share im Mock-Modus gestartet.',
  };
}

export async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === 'undefined') {
    return;
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand('copy');
  document.body.removeChild(textArea);
}

export function shareViaInstagram(link: string): PlaceholderResult {
  void copyToClipboard(link);
  return {
    provider: 'instagram',
    status: 'mock',
    message: 'Instagram unterstützt keine direkten DM-Links im Web. Link wurde kopiert.',
  };
}

export function shareViaSnapchat(link: string): PlaceholderResult {
  void copyToClipboard(link);
  return {
    provider: 'snapchat',
    status: 'mock',
    message: 'Snapchat Share ist als Platzhalter vorhanden. Link wurde kopiert.',
  };
}

export function shareViaTikTok(link: string): PlaceholderResult {
  void copyToClipboard(link);
  return {
    provider: 'tiktok',
    status: 'mock',
    message: 'TikTok Share ist als Platzhalter vorhanden. Link wurde kopiert.',
  };
}

export function syncToGoogleCalendar(event: Event): PlaceholderResult {
  console.log('Mock Google Calendar Sync', event.id);
  return {
    provider: 'google',
    status: 'mock',
    message: 'Google Calendar Sync (OAuth) ist als Mock-Service vorbereitet.',
  };
}

export function syncToOutlook(event: Event): PlaceholderResult {
  console.log('Mock Outlook Sync', event.id);
  return {
    provider: 'outlook',
    status: 'mock',
    message: 'Outlook Sync (Microsoft Graph) ist als Mock-Service vorbereitet.',
  };
}

export function generateICSFeedUrl(userId: string): string {
  return `${getBaseUrl()}/api/mock/ics/${userId}/calendar.ics`;
}

export function loginWithInstagram(): PlaceholderResult {
  return {
    provider: 'instagram',
    status: 'mock',
    message: 'Instagram Login (OAuth) ist als Platzhalter-Service hinterlegt.',
  };
}

export function loginWithSnapchat(): PlaceholderResult {
  return {
    provider: 'snapchat',
    status: 'mock',
    message: 'Snapchat Login ist als Platzhalter-Service hinterlegt.',
  };
}

export function loginWithTikTok(): PlaceholderResult {
  return {
    provider: 'tiktok',
    status: 'mock',
    message: 'TikTok Login (OAuth) ist als Platzhalter-Service hinterlegt.',
  };
}

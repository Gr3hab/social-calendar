import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarIcon, MapPinIcon, UserGroupIcon, CheckIcon, XMarkIcon, LinkIcon, ShareIcon } from '@heroicons/react/24/outline';
import { useData } from '../context/DataContext';
import { shareViaWhatsApp, copyToClipboard } from '../services/invitationService';
import { getErrorMessage } from '../services/serviceErrors';
import type { Event } from '../types';
import { submitAbuseReport } from '../services/complianceService';
import {
  getPublicEventByInviteApi,
  isApiDataEnabled,
  respondToInvitationPublicApi,
} from '../services/dataApi';

const INVITE_IDENTITY_STORAGE_KEY = 'social-calendar:invite-identity:v1';

interface InviteIdentity {
  name: string;
  phoneNumber: string;
}

function normalizePhoneNumber(value: string): string {
  const trimmed = value.trim();
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

function extractInvitationCode(link?: string): string | null {
  if (!link) {
    return null;
  }
  const match = link.match(/[?&]code=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function readStoredIdentity(): InviteIdentity {
  if (typeof window === 'undefined') {
    return { name: '', phoneNumber: '' };
  }

  try {
    const raw = window.localStorage.getItem(INVITE_IDENTITY_STORAGE_KEY);
    if (!raw) {
      return { name: '', phoneNumber: '' };
    }
    const parsed = JSON.parse(raw) as InviteIdentity;
    return {
      name: parsed.name ?? '',
      phoneNumber: parsed.phoneNumber ?? '',
    };
  } catch {
    return { name: '', phoneNumber: '' };
  }
}

export default function PublicEvent() {
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const token = searchParams.get('token');
  const dataApiEnabled = isApiDataEnabled();
  const { events, respondToEvent, isLoading: contextLoading } = useData();
  const initialIdentity = readStoredIdentity();

  const [name, setName] = useState(initialIdentity.name);
  const [phoneNumber, setPhoneNumber] = useState(initialIdentity.phoneNumber);
  const [publicEvent, setPublicEvent] = useState<Event | null>(null);
  const [isPublicLoading, setIsPublicLoading] = useState(dataApiEnabled);
  const [response, setResponse] = useState<'accepted' | 'declined' | null>(null);
  const [localLateResponse, setLocalLateResponse] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [lastAttemptStatus, setLastAttemptStatus] = useState<'accepted' | 'declined' | null>(null);
  const [abuseMessage, setAbuseMessage] = useState('');

  useEffect(() => {
    if (!dataApiEnabled) {
      return;
    }

    let isMounted = true;
    const loadPublicEvent = async () => {
      if (!eventId || !code) {
        setPublicEvent(null);
        setIsPublicLoading(false);
        return;
      }

      setIsPublicLoading(true);
      try {
        const loaded = await getPublicEventByInviteApi(eventId, code, token);
        if (isMounted) {
          setPublicEvent(loaded);
        }
      } catch {
        if (isMounted) {
          setPublicEvent(null);
        }
      } finally {
        if (isMounted) {
          setIsPublicLoading(false);
        }
      }
    };

    void loadPublicEvent();
    return () => {
      isMounted = false;
    };
  }, [code, dataApiEnabled, eventId, token]);

  const event = useMemo(
    () => (dataApiEnabled ? publicEvent : events.find((entry) => entry.id === eventId) ?? null),
    [dataApiEnabled, eventId, events, publicEvent],
  );

  const inviteCode = useMemo(
    () => event?.invitationCode ?? extractInvitationCode(event?.invitationLink),
    [event?.invitationCode, event?.invitationLink],
  );

  const isExpired = Boolean(event?.linkExpiresAt && new Date() > event.linkExpiresAt);
  const hasValidCode = Boolean(!inviteCode || code === inviteCode);
  const isValidInvite = dataApiEnabled ? Boolean(event) : Boolean(event && hasValidCode && !isExpired);
  const isLoading = dataApiEnabled ? isPublicLoading : contextLoading;

  const participantMatch = useMemo(
    () =>
      event?.participants.find(
        (participant) =>
          normalizePhoneNumber(participant.phoneNumber) &&
          normalizePhoneNumber(participant.phoneNumber) === normalizePhoneNumber(phoneNumber),
      ),
    [event?.participants, phoneNumber],
  );

  const hasResponded = participantMatch
    ? participantMatch.status === 'accepted' || participantMatch.status === 'declined'
    : response !== null;

  const handleResponse = async (status: 'accepted' | 'declined') => {
    if (!event) {
      return;
    }

    const normalizedName = name.trim();
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    if (!normalizedName && !normalizedPhone) {
      alert('Bitte gib deinen Namen und deine Telefonnummer ein 📱');
      return;
    }

    if (!normalizedName) {
      alert('Bitte gib deinen Namen ein 👤');
      return;
    }

    if (!normalizedPhone) {
      alert('Bitte gib eine gültige Telefonnummer ein 📱');
      return;
    }

    setSubmitError('');
    setLastAttemptStatus(status);
    setPhoneNumber(normalizedPhone);
    setIsSubmitting(true);

    try {
      const updated = dataApiEnabled
        ? await respondToInvitationPublicApi({
            eventId: event.id,
            name: normalizedName,
            phoneNumber: normalizedPhone,
            status,
            code: code ?? '',
            token: token ?? undefined,
          })
        : await respondToEvent({
            eventId: event.id,
            name: normalizedName,
            phoneNumber: normalizedPhone,
            status,
          });

      if (!updated) {
        setSubmitError('Event konnte nicht aktualisiert werden.');
        return;
      }

      const latestParticipant = updated.participants.find(
        (participant) => normalizePhoneNumber(participant.phoneNumber) === normalizedPhone,
      );
      if (dataApiEnabled) {
        setPublicEvent(updated);
      }
      setLocalLateResponse(Boolean(latestParticipant?.isLateResponse));
      setResponse(status);

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          INVITE_IDENTITY_STORAGE_KEY,
          JSON.stringify({
            name: normalizedName,
            phoneNumber: normalizedPhone,
          } satisfies InviteIdentity),
        );
      }

      console.log('Response submitted:', { status, eventId, code });
    } catch (error) {
      setSubmitError(
        getErrorMessage(error, {
          fallback: 'Antwort konnte nicht gespeichert werden.',
          network: 'Deine Antwort konnte wegen Verbindungsproblemen nicht gespeichert werden.',
          rateLimit: 'Zu viele Antworten in kurzer Zeit.',
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    if (!lastAttemptStatus) {
      return;
    }
    void handleResponse(lastAttemptStatus);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-300">Event lädt...</div>
      </div>
    );
  }

  if (!event || !isValidInvite) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center p-6">
        <div className="max-w-sm text-center bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-lg">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Event nicht gefunden</h1>
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            Der Link ist abgelaufen oder ungültig.
          </p>
        </div>
      </div>
    );
  }

  const acceptedCount = event.participants.filter((participant) => participant.status === 'accepted').length;
  const declinedCount = event.participants.filter((participant) => participant.status === 'declined').length;
  const pendingCount = event.participants.filter((participant) => participant.status === 'pending').length;

  const handleShare = (platform: string) => {
    const link = event.invitationLink || window.location.href;
    const message = `Kommst du mit zu "${event.title}"?`;
    
    if (platform === 'whatsapp') {
      shareViaWhatsApp(link, message);
    }

    if (platform === 'copy') {
      void copyToClipboard(link);
      alert('📋 Link kopiert');
    }

    setShowShareMenu(false);
  };

  const handleAbuseReport = async () => {
    if (!event) {
      return;
    }
    await submitAbuseReport({
      eventId: event.id,
      reason: 'public_invite_misuse',
      details: 'Report submitted from public invite page.',
    });
    setAbuseMessage('Danke. Dein Report wurde erfasst und wird geprüft.');
  };

  const resolvedStatus = participantMatch?.status ?? response;
  const isLateStatus = participantMatch?.isLateResponse ?? localLateResponse;

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-100 to-amber-100 dark:from-slate-950 dark:to-slate-900">
      <div className="max-w-lg mx-auto min-h-screen bg-white dark:bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-br from-sky-600 to-cyan-500 p-8 pb-12 rounded-b-[2rem] relative">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-xl rounded-2xl mb-4">
              <CalendarIcon className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2">{event.title}</h1>
            <p className="text-white/80">Du bist eingeladen! 🎉</p>
          </div>

          {/* Share Button */}
          <button 
            onClick={() => setShowShareMenu(!showShareMenu)}
            className="absolute top-4 right-4 p-3 bg-white/20 backdrop-blur-xl rounded-xl hover:bg-white/30 transition-colors"
          >
            <ShareIcon className="w-5 h-5 text-white" />
          </button>

          {/* Share Menu */}
          {showShareMenu && (
            <div className="absolute top-16 right-4 bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-2 z-50 animate-scale-in">
              <button 
                onClick={() => handleShare('whatsapp')}
                className="flex items-center w-full p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
              >
                <span className="text-xl mr-3">💬</span>
                <span className="font-medium">WhatsApp</span>
              </button>
              <button 
                onClick={() => handleShare('copy')}
                className="flex items-center w-full p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl"
              >
                <LinkIcon className="w-5 h-5 mr-3 text-gray-500" />
                <span className="font-medium">Link kopieren</span>
              </button>
            </div>
          )}
        </div>

        {/* Event Details */}
        <div className="p-6 -mt-6">
          <div className="bg-white dark:bg-gray-700 rounded-3xl p-6 shadow-lg mb-6">
            {event.description && (
              <p className="text-gray-600 dark:text-gray-300 mb-4 text-center">
                {event.description}
              </p>
            )}

            <div className="space-y-3">
              <div className="flex items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-2xl">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mr-3">
                  <CalendarIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-bold uppercase">Wann</p>
                  <p className="font-bold text-gray-900 dark:text-white">
                    {format(event.date, "EEEE, d. MMMM 'um' HH:mm", { locale: de })}
                  </p>
                </div>
              </div>

              {event.location && (
                <div className="flex items-center p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl">
                  <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center mr-3">
                    <MapPinIcon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-cyan-600 dark:text-cyan-400 font-bold uppercase">Wo</p>
                    <p className="font-bold text-gray-900 dark:text-white">{event.location}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-2xl">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mr-3">
                  <UserGroupIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs text-green-600 dark:text-green-400 font-bold uppercase">Wer kommt</p>
                  <p className="font-bold text-gray-900 dark:text-white">
                    {acceptedCount} Zusagen • {pendingCount} Unsicher • {declinedCount} Absagen
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Participant List */}
          <div className="bg-white dark:bg-gray-700 rounded-3xl p-6 shadow-lg mb-6">
            <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center">
              <UserGroupIcon className="w-5 h-5 mr-2 text-purple-500" />
              Teilnehmer ({event.participants.length})
            </h3>
            <div className="space-y-2">
              {event.participants.map((participant) => (
                <div 
                  key={participant.userId}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-600 rounded-xl"
                >
                  <div className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                      participant.status === 'accepted' ? 'bg-green-500' :
                      participant.status === 'declined' ? 'bg-red-500' : 'bg-yellow-500'
                    }`}>
                      {participant.status === 'accepted' ? (
                        <CheckIcon className="w-4 h-4 text-white" />
                      ) : participant.status === 'declined' ? (
                        <XMarkIcon className="w-4 h-4 text-white" />
                      ) : (
                        <span className="text-white text-xs">?</span>
                      )}
                    </div>
                    <span className="font-medium text-gray-900 dark:text-white">{participant.name}</span>
                  </div>
                  <span className={`text-xs font-bold ${
                    participant.status === 'accepted' ? 'text-green-600 dark:text-green-400' :
                    participant.status === 'declined' ? 'text-red-600 dark:text-red-400' :
                    'text-yellow-600 dark:text-yellow-400'
                  }`}>
                    {participant.status === 'accepted'
                      ? participant.isLateResponse ? '⏰ Späte Zusage' : '✓ Zusage'
                      : participant.status === 'declined'
                        ? participant.isLateResponse ? '⏰ Späte Absage' : '✕ Absage'
                        : 'Ausstehend'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Response Section */}
          {!hasResponded ? (
            <div className="bg-white dark:bg-gray-700 rounded-3xl p-6 shadow-lg">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-center text-xl">
                Kommst du? 🤔
              </h3>
              
              <div className="space-y-3 mb-4">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dein Name"
                  className="input"
                />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Deine Telefonnummer"
                  className="input"
                />
              </div>

              {submitError && (
                <div className="mb-4 rounded-2xl border border-rose-300 bg-rose-50 p-3 text-center text-sm font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                  <p>{submitError}</p>
                  {lastAttemptStatus && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={isSubmitting}
                      className="mt-2 rounded-xl bg-rose-500/15 px-3 py-1 text-xs font-bold hover:bg-rose-500/25 disabled:opacity-60"
                    >
                      Erneut versuchen
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  onClick={() => handleResponse('accepted')}
                  disabled={isSubmitting}
                  className="btn tap-target bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold"
                >
                  {isSubmitting ? 'Sende...' : '✓ Ich komme!'}
                </button>
                <button
                  onClick={() => handleResponse('declined')}
                  disabled={isSubmitting}
                  className="btn tap-target bg-gradient-to-r from-red-500 to-rose-500 text-white font-bold"
                >
                  {isSubmitting ? 'Sende...' : '✕ Absagen'}
                </button>
              </div>
            </div>
          ) : (
            <div className={`rounded-3xl p-6 shadow-lg text-center ${
              resolvedStatus === 'accepted'
                ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
                : 'bg-gradient-to-r from-red-500 to-rose-500'
            }`}>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                {resolvedStatus === 'accepted' ? (
                  <CheckIcon className="w-8 h-8 text-white" />
                ) : (
                  <XMarkIcon className="w-8 h-8 text-white" />
                )}
              </div>
              <h3 className="font-black text-white text-2xl mb-1">
                {resolvedStatus === 'accepted'
                  ? isLateStatus ? 'Späte Zusage ⏰' : 'Super! 🎉'
                  : isLateStatus ? 'Späte Absage ⏰' : 'Schade! 😕'}
              </h3>
              <p className="text-white/80">
                {resolvedStatus === 'accepted'
                  ? isLateStatus ? 'Danke trotzdem für die Rückmeldung!' : 'Wir freuen uns auf dich!'
                  : isLateStatus ? 'Danke für deine verspätete Rückmeldung.' : 'Vielleicht beim nächsten Mal!'}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 text-center">
          <button
            onClick={() => void handleAbuseReport()}
            className="mb-3 text-sm font-medium text-rose-600 underline dark:text-rose-300"
          >
            Missbrauch melden
          </button>
          {abuseMessage && (
            <p className="mb-3 text-xs text-rose-600 dark:text-rose-300">{abuseMessage}</p>
          )}
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Erstellt mit <span className="text-purple-500 font-bold">Plan It.</span>
          </p>
        </div>
      </div>
    </div>
  );
}

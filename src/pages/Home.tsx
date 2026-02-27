import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  BellAlertIcon,
  BellSlashIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClockIcon,
  LinkIcon,
  MapPinIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { copyToClipboard } from '../services/invitationService';
import { getErrorMessage } from '../services/serviceErrors';
import type { Event } from '../types';

export default function Home() {
  const { state: authState } = useAuth();
  const { events, isLoading, respondToEvent, toggleEventReminder, sendRsvpNudge } = useData();
  const navigate = useNavigate();
  const [animatingEventId, setAnimatingEventId] = useState<string | null>(null);

  const upcomingEvents = useMemo(
    () =>
      [...events]
        .filter((event) => event.date.getTime() >= new Date().setHours(0, 0, 0, 0))
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [events],
  );

  const getMyStatus = (event: Event) => {
    if (!authState.user) {
      return 'pending' as const;
    }
    const me = event.participants.find(
      (participant) => participant.phoneNumber === authState.user?.phoneNumber,
    );
    return me?.status ?? 'pending';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white';
      case 'declined':
        return 'bg-gradient-to-r from-red-500 to-rose-500 text-white';
      default:
        return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'Zusage';
      case 'declined':
        return 'Absage';
      default:
        return 'Ausstehend';
    }
  };

  const handleStatusChange = async (eventId: string, status: 'accepted' | 'declined') => {
    if (!authState.user) {
      return;
    }

    // Trigger animation
    setAnimatingEventId(eventId);
    
    try {
      await respondToEvent({
        eventId,
        name: authState.user.name.trim() || 'Du',
        phoneNumber: authState.user.phoneNumber,
        status,
      });
      
      // Remove animation after delay
      setTimeout(() => setAnimatingEventId(null), 500);
    } catch (error) {
      setAnimatingEventId(null);
      alert(
        getErrorMessage(error, {
          fallback: 'Antwort konnte nicht gespeichert werden.',
          network: 'Deine Antwort konnte wegen Verbindungsproblemen nicht gespeichert werden.',
          rateLimit: 'Zu viele Antworten in kurzer Zeit.',
        }),
      );
    }
  };

  const handleShareLink = async (event: Event) => {
    if (!event.invitationLink) {
      return;
    }
    await copyToClipboard(event.invitationLink);
    alert('📋 Einladungslink kopiert');
  };

  const handleReminderToggle = async (event: Event) => {
    try {
      await toggleEventReminder(event.id, !event.reminderEnabled);
    } catch (error) {
      alert(
        getErrorMessage(error, {
          fallback: 'Reminder konnte nicht aktualisiert werden.',
          network: 'Reminder konnte wegen Verbindungsproblemen nicht aktualisiert werden.',
          rateLimit: 'Reminder gerade zu oft geändert. Bitte kurz warten.',
        }),
      );
    }
  };

  const handleSendRsvpNudge = async (event: Event) => {
    try {
      const result = await sendRsvpNudge(event.id);
      alert(`🔔 ${result.nudgedCount} Erinnerungen gesendet (Mock)`);
    } catch (error) {
      alert(
        getErrorMessage(error, {
          fallback: 'Erinnerung konnte nicht gesendet werden.',
          network: 'Erinnerung konnte wegen Verbindungsproblemen nicht gesendet werden.',
          rateLimit: 'Zu viele Erinnerungen in kurzer Zeit.',
        }),
      );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-28">
      {/* Header */}
      <div className="bg-gradient-ocean dark:bg-gradient-dark pt-12 pb-6 px-4 rounded-b-[2rem]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-black text-white mb-1">
              Plan It.
            </h1>
            <p className="text-white/80 font-medium">
              {isLoading ? 'Lädt...' : `${upcomingEvents.length} kommende Events`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Quick Stats */}
            {!isLoading && upcomingEvents.length > 0 && (
              <div className="hidden sm:flex items-center gap-1 bg-white/20 backdrop-blur-xl rounded-full px-3 py-1.5">
                <span className="text-white font-bold text-sm">
                  {upcomingEvents.reduce((acc, e) => acc + e.participants.filter(p => p.status === 'accepted').length, 0)}
                </span>
                <span className="text-white/70 text-xs">kommen</span>
              </div>
            )}
            {/* Poll Button */}
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-poll'))}
              className="w-10 h-10 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center tap-target"
            >
              <ChartBarIcon className="w-5 h-5 text-white" />
            </button>
            {/* Profile Avatar */}
            <button
              onClick={() => navigate('/profile')}
              className="w-10 h-10 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center tap-target overflow-hidden"
            >
              {authState.user?.avatar ? (
                <img src={authState.user.avatar} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                <span className="text-white font-bold text-sm">
                  {authState.user?.name?.charAt(0).toUpperCase() || '?'}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 -mt-5 space-y-4">
        {!isLoading && upcomingEvents.length === 0 ? (
          <div className="text-center py-12 animate-fade-in">
            <div className="w-24 h-24 bg-gradient-to-br from-emerald-100 to-sky-100 dark:from-slate-800 dark:to-slate-700 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <CalendarDaysIcon className="w-12 h-12 text-sky-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Keine Events 🎉
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-xs mx-auto">
              Erstelle deinen ersten Termin mit dem + Button unten rechts.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingEvents.map((event, index) => (
              <div
                key={event.id}
                className={`card p-5 md:p-6 animate-slide-up transition-all duration-300 ${
                  animatingEventId === event.id ? 'scale-95 opacity-50' : ''
                }`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {(() => {
                  const status = getMyStatus(event);
                  const pendingCount = event.participants.filter((participant) => participant.status === 'pending').length;
                  const hasLateResponses = event.participants.some((participant) => participant.isLateResponse);
                  const isHost = authState.user?.id === event.createdBy;
                  return (
                    <>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                            {event.title}
                          </h3>
                          {event.description && (
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                              {event.description}
                            </p>
                          )}
                        </div>
                        <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${getStatusBadge(status)}`}>
                          {getStatusText(status)}
                        </div>
                      </div>

                      <div className="mb-3 flex flex-wrap gap-2">
                        {event.rsvpDeadline && (
                          <span className="inline-flex items-center rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300">
                            Antwort bis {format(event.rsvpDeadline, "d. MMM 'um' HH:mm", { locale: de })}
                          </span>
                        )}
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                          {pendingCount} ausstehend
                        </span>
                      </div>

                      {hasLateResponses && (
                        <p className="mb-3 text-xs font-medium text-rose-600 dark:text-rose-300">
                          Späte Antworten enthalten
                        </p>
                      )}

                      <div className="space-y-3 text-sm mb-1">
                        <div className="flex items-center text-gray-700 dark:text-gray-300">
                          <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-lg flex items-center justify-center mr-3">
                            <CalendarDaysIcon className="w-4 h-4 text-white" />
                          </div>
                          <span className="font-medium">
                            {format(event.date, "EEEE, d. MMMM 'um' HH:mm", { locale: de })}
                          </span>
                        </div>

                        {event.location && (
                          <div className="flex items-center text-gray-700 dark:text-gray-300">
                            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center mr-3">
                              <MapPinIcon className="w-4 h-4 text-white" />
                            </div>
                            <span className="font-medium">{event.location}</span>
                          </div>
                        )}

                        <div className="flex items-center text-gray-700 dark:text-gray-300">
                          <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg flex items-center justify-center mr-3">
                            <UserGroupIcon className="w-4 h-4 text-white" />
                          </div>
                          <span className="font-medium">{event.participants.length} Teilnehmer</span>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleStatusChange(event.id, 'accepted')}
                          className="btn btn-gradient text-sm font-bold tap-target"
                        >
                          ✓ Zusage
                        </button>
                        <button
                          onClick={() => handleStatusChange(event.id, 'declined')}
                          className="btn btn-secondary text-sm font-bold tap-target"
                        >
                          ✕ Absage
                        </button>
                      </div>

                      {/* Live Status - I'm running late */}
                      {status === 'accepted' && (
                        <div className="mt-2">
                          <button
                            onClick={() => {
                              alert('⏰ Update gesendet: Du kommst später! Alle Teilnehmer werden benachrichtigt.');
                            }}
                            className="btn btn-ghost w-full text-sm font-medium border border-orange-200 text-orange-700 dark:border-orange-800 dark:text-orange-300 tap-target"
                          >
                            <ClockIcon className="w-4 h-4 mr-2" />
                            Ich komme später
                          </button>
                        </div>
                      )}

                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button
                          onClick={() => handleShareLink(event)}
                          className="btn btn-ghost text-sm font-medium border border-gray-200 dark:border-slate-700 tap-target"
                        >
                          <LinkIcon className="w-4 h-4 mr-2" />
                          Teilen
                        </button>
                        <button
                          onClick={() => handleReminderToggle(event)}
                          className="btn btn-ghost text-sm font-medium border border-gray-200 dark:border-slate-700 tap-target"
                        >
                          {event.reminderEnabled ? (
                            <BellAlertIcon className="w-4 h-4 mr-2 text-emerald-500" />
                          ) : (
                            <BellSlashIcon className="w-4 h-4 mr-2 text-gray-500" />
                          )}
                          {event.reminderEnabled ? 'Reminder an' : 'Reminder aus'}
                        </button>
                      </div>

                      {isHost && pendingCount > 0 && (
                        <div className="mt-2">
                          <button
                            onClick={() => handleSendRsvpNudge(event)}
                            className="btn btn-ghost w-full text-sm font-medium border border-amber-200 text-amber-700 dark:border-amber-800 dark:text-amber-300 tap-target"
                          >
                            Ausstehende erinnern
                          </button>
                          {event.lastNudgeAt && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Letzte Erinnerung: {format(event.lastNudgeAt, "d. MMM 'um' HH:mm", { locale: de })}
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

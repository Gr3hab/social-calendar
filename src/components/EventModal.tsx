import { useMemo, useState } from 'react';
import {
  BellIcon,
  CalendarIcon,
  LinkIcon,
  MapPinIcon,
  UserPlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import TimePicker from './TimePicker';
import type { CreateEventInput, Friend, Group } from '../types';
import { getErrorMessage } from '../services/serviceErrors';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (event: Omit<CreateEventInput, 'createdBy'>) => Promise<void> | void;
  groups: Group[];
  friends: Friend[];
}

type DeadlinePreset = 'none' | 'today-20' | '24h-before' | '2h-before';

const DEADLINE_OPTIONS: Array<{ value: DeadlinePreset; label: string }> = [
  { value: 'today-20', label: 'Heute 20:00' },
  { value: '24h-before', label: '24h vorher' },
  { value: '2h-before', label: '2h vorher' },
  { value: 'none', label: 'Keine Deadline' },
];

const INITIAL_STATE = {
  title: '',
  description: '',
  date: '',
  time: '',
  deadlinePreset: 'none' as DeadlinePreset,
  location: '',
  participants: [] as Array<{ name: string; phoneNumber: string; avatar?: string }>,
  selectedGroupIds: [] as string[],
  reminderEnabled: true,
};

function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getQuickDate(baseDate: Date, weekday: number): Date {
  const result = new Date(baseDate);
  const delta = (weekday - baseDate.getDay() + 7) % 7;
  result.setDate(baseDate.getDate() + delta);
  return result;
}

function buildDateQuickOptions() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const formatHint = (date: Date) =>
    date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
  return [
    { label: 'Heute', value: toDateInputValue(now), hint: formatHint(now) },
    { label: 'Morgen', value: toDateInputValue(tomorrow), hint: formatHint(tomorrow) },
    { label: 'Freitag', value: toDateInputValue(getQuickDate(now, 5)), hint: formatHint(getQuickDate(now, 5)) },
    { label: 'Samstag', value: toDateInputValue(getQuickDate(now, 6)), hint: formatHint(getQuickDate(now, 6)) },
  ];
}

function formatEventPreview(date: string, time: string): string {
  if (!date || !time) {
    return 'Wähle Datum und Uhrzeit für eine Vorschau.';
  }
  const eventDateTime = new Date(`${date}T${time}`);
  if (Number.isNaN(eventDateTime.getTime())) {
    return 'Ungültiges Datum oder Uhrzeit.';
  }
  return eventDateTime.toLocaleString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildEventDateTime(date: string, time: string): Date | null {
  if (!date || !time) {
    return null;
  }

  const eventDateTime = new Date(`${date}T${time}`);
  if (Number.isNaN(eventDateTime.getTime())) {
    return null;
  }
  return eventDateTime;
}

function resolveRsvpDeadline(preset: DeadlinePreset, date: string, time: string): Date | undefined {
  if (preset === 'none') {
    return undefined;
  }

  if (preset === 'today-20') {
    const now = new Date();
    const todayAtTwenty = new Date(now);
    todayAtTwenty.setHours(20, 0, 0, 0);
    return todayAtTwenty;
  }

  const eventDateTime = buildEventDateTime(date, time);
  if (!eventDateTime) {
    return undefined;
  }

  const deadline = new Date(eventDateTime);
  if (preset === '24h-before') {
    deadline.setHours(deadline.getHours() - 24);
    return deadline;
  }

  deadline.setHours(deadline.getHours() - 2);
  return deadline;
}

export default function EventModal({ isOpen, onClose, onCreate, groups, friends }: EventModalProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState(INITIAL_STATE);
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const selectedParticipantPhones = useMemo(
    () => new Set(formData.participants.map((participant) => participant.phoneNumber)),
    [formData.participants],
  );
  const dateQuickOptions = useMemo(() => buildDateQuickOptions(), []);
  const todayDate = useMemo(() => toDateInputValue(new Date()), []);

  if (!isOpen) return null;

  const resetModal = () => {
    setStep(1);
    setFormData(INITIAL_STATE);
    setManualName('');
    setManualPhone('');
    setIsSubmitting(false);
    setSubmitError('');
  };

  const closeModal = () => {
    resetModal();
    onClose();
  };

  const addParticipant = (participant: { name: string; phoneNumber: string; avatar?: string }) => {
    const phoneNumber = participant.phoneNumber.trim();
    if (!phoneNumber) {
      return;
    }

    setFormData((current) => {
      if (current.participants.some((entry) => entry.phoneNumber === phoneNumber)) {
        return current;
      }

      return {
        ...current,
        participants: [...current.participants, { ...participant, phoneNumber }],
      };
    });
  };

  const removeParticipant = (phoneNumber: string) => {
    setFormData((current) => ({
      ...current,
      participants: current.participants.filter((participant) => participant.phoneNumber !== phoneNumber),
    }));
  };

  const handleToggleFriend = (friend: Friend) => {
    if (selectedParticipantPhones.has(friend.phoneNumber)) {
      removeParticipant(friend.phoneNumber);
      return;
    }

    addParticipant({
      name: friend.name,
      phoneNumber: friend.phoneNumber,
      avatar: friend.avatar,
    });
  };

  const handleAddManualParticipant = () => {
    addParticipant({
      name: manualName.trim() || 'Kontakt',
      phoneNumber: manualPhone,
    });
    setManualName('');
    setManualPhone('');
  };

  const toggleGroup = (groupId: string) => {
    setFormData((current) => {
      const exists = current.selectedGroupIds.includes(groupId);
      return {
        ...current,
        selectedGroupIds: exists
          ? current.selectedGroupIds.filter((id) => id !== groupId)
          : [...current.selectedGroupIds, groupId],
      };
    });
  };

  const handleSubmit = async () => {
    if (!formData.date || !formData.time) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const rsvpDeadline = resolveRsvpDeadline(formData.deadlinePreset, formData.date, formData.time);

      await onCreate({
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        date: new Date(`${formData.date}T${formData.time}`),
        time: formData.time,
        location: formData.location.trim() || undefined,
        rsvpDeadline,
        participants: formData.participants,
        groupIds: formData.selectedGroupIds,
        reminderEnabled: formData.reminderEnabled,
      });

      closeModal();
    } catch (error) {
      setSubmitError(
        getErrorMessage(error, {
          fallback: 'Event konnte nicht erstellt werden.',
          network: 'Event konnte wegen Verbindungsfehler nicht erstellt werden.',
          rateLimit: 'Zu viele Event-Anfragen.',
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return Boolean(formData.title.trim() && formData.date && formData.time);
      case 2:
      case 3:
      default:
        return true;
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4 animate-slide-up">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-sky-500 to-cyan-500 rounded-2xl mb-3">
                <CalendarIcon className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">Neuer Termin 🎉</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Was planst du?</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Titel *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData((current) => ({ ...current, title: e.target.value }))}
                placeholder="z.B. Pizza Abend 🍕"
                className="input"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Beschreibung
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((current) => ({ ...current, description: e.target.value }))
                }
                placeholder="Was sollten die Leute wissen?"
                className="input min-h-[80px] resize-none"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Datum *
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((current) => ({ ...current, date: e.target.value }))}
                min={todayDate}
                className="input"
              />
            </div>

            <TimePicker
              value={formData.time}
              onChange={(time) => setFormData((current) => ({ ...current, time }))}
              label="Uhrzeit *"
            />

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Schnellwahl
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {dateQuickOptions.map((option) => {
                  const isSelected = formData.date === option.value;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setFormData((current) => ({ ...current, date: option.value }))}
                      className={`rounded-2xl border px-3 py-2 text-left transition-all ${
                        isSelected
                          ? 'border-sky-500 bg-sky-100 text-sky-800 shadow-sm dark:bg-sky-900/30 dark:text-sky-200'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-sky-300 dark:border-gray-700 dark:bg-slate-900 dark:text-gray-300 dark:hover:border-sky-600'
                      }`}
                    >
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="text-xs opacity-75">{option.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-200/70 bg-cyan-50/70 p-3 dark:border-cyan-800/60 dark:bg-cyan-900/20">
              <p className="text-xs font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                Termin-Preview
              </p>
              <p className="mt-1 font-semibold text-cyan-900 dark:text-cyan-100">
                {formatEventPreview(formData.date, formData.time)}
              </p>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4 animate-slide-up">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-2xl mb-3">
                <MapPinIcon className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">Wo? 📍</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Optional, aber hilfreich</p>
            </div>

            <div>
              <p className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                RSVP-Deadline (optional)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {DEADLINE_OPTIONS.map((option) => {
                  const isSelected = formData.deadlinePreset === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setFormData((current) => ({ ...current, deadlinePreset: option.value }))
                      }
                      className={`rounded-2xl border px-3 py-2 text-sm font-medium transition-all ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300'
                          : 'border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Ort
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData((current) => ({ ...current, location: e.target.value }))}
                placeholder="z.B. Pizza Italia, Hauptstraße 1"
                className="input"
              />
            </div>

            <div>
              <p className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Gruppen-Kalender (optional)
              </p>
              <div className="grid grid-cols-1 gap-2 max-h-36 overflow-y-auto">
                {groups.map((group) => {
                  const isSelected = formData.selectedGroupIds.includes(group.id);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <p className="font-semibold text-gray-900 dark:text-white">{group.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {group.members.length} Mitglieder
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setFormData((current) => ({
                  ...current,
                  reminderEnabled: !current.reminderEnabled,
                }))
              }
              className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${
                formData.reminderEnabled
                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex items-center">
                <BellIcon className="w-5 h-5 mr-2 text-emerald-600" />
                <span className="font-medium text-gray-900 dark:text-white">Push-Reminder (Mock)</span>
              </div>
              <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                {formData.reminderEnabled ? 'AN' : 'AUS'}
              </span>
            </button>

            <div className="bg-sky-50 dark:bg-sky-900/20 rounded-2xl p-4">
              <p className="text-sm text-sky-700 dark:text-sky-300">
                💡 Tipp: Wähle direkt eine Gruppe, dann erscheint der Termin im Gruppen-Kalender.
              </p>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4 animate-slide-up">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-2xl mb-3">
                <UserPlusIcon className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">Wer kommt? 👥</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Teilnehmer hinzufügen</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Per Telefonnummer hinzufügen
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="Name (optional)"
                  className="input"
                />
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="+49 123 456789"
                    className="input flex-1"
                  />
                  <button
                    type="button"
                    onClick={handleAddManualParticipant}
                    className="btn btn-secondary px-5 tap-target"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div>
              <p className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                Aus Freundesliste wählen
              </p>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {friends.map((friend) => {
                  const selected = selectedParticipantPhones.has(friend.phoneNumber);
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => handleToggleFriend(friend)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        selected
                          ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <p className="font-semibold text-gray-900 dark:text-white">{friend.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{friend.phoneNumber}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {formData.participants.length > 0 && (
              <div>
                <p className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                  Ausgewählte Teilnehmer ({formData.participants.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {formData.participants.map((participant) => (
                    <button
                      type="button"
                      key={participant.phoneNumber}
                      onClick={() => removeParticipant(participant.phoneNumber)}
                      className="inline-flex items-center px-3 py-2 rounded-full bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-200 text-sm font-medium"
                    >
                      {participant.name}
                      <XMarkIcon className="w-4 h-4 ml-1" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 rounded-2xl p-4">
              <div className="flex items-center mb-2">
                <LinkIcon className="w-5 h-5 text-sky-500 mr-2" />
                <span className="font-bold text-sky-700 dark:text-sky-300">Einladungslink</span>
              </div>
              <p className="text-sm text-sky-600 dark:text-sky-400">
                Nach dem Erstellen wird automatisch ein einzigartiger Link erstellt.
              </p>
            </div>
          </div>
        );

    }
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={closeModal}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center">
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i === step 
                      ? 'bg-gradient-to-r from-sky-500 to-cyan-500 w-6' 
                      : i < step 
                        ? 'bg-green-500' 
                        : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                />
              ))}
            </div>
            <span className="ml-3 text-sm font-medium text-gray-500 dark:text-gray-400">
              Schritt {step}/3
            </span>
          </div>
          <button
            onClick={closeModal}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          {submitError && (
            <div className="mb-3 rounded-2xl border border-rose-300 bg-rose-50 p-3 text-sm font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
              {submitError}
            </div>
          )}
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="btn btn-secondary flex-1 tap-target"
              >
                ← Zurück
              </button>
            )}
            
            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                className="btn btn-gradient flex-1 tap-target disabled:opacity-50"
              >
                Weiter →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="btn btn-gradient flex-1 font-bold tap-target disabled:opacity-60"
              >
                {isSubmitting ? 'Speichern...' : '🎉 Event erstellen'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

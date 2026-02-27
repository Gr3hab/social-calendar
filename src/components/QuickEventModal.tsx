import { useState } from 'react';
import { BoltIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { shareViaWhatsApp } from '../services/invitationService';

interface QuickEventModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_OPTIONS = [
  { id: 'heute-jetzt', label: 'Heute jetzt', emoji: '🔥', hours: 0 },
  { id: 'heute-abend', label: 'Heute Abend', emoji: '🌙', hours: 4 },
  { id: 'morgen-mittag', label: 'Morgen Mittag', emoji: '☀️', hours: 20 },
  { id: 'morgen-abend', label: 'Morgen Abend', emoji: '🎉', hours: 24 },
  { id: 'wochenende', label: 'Wochenende', emoji: '🎊', hours: 48 },
];

export default function QuickEventModal({ isOpen, onClose }: QuickEventModalProps) {
  const { state: authState } = useAuth();
  const { createEvent } = useData();
  
  const [title, setTitle] = useState('');
  const [selectedOption, setSelectedOption] = useState<string>('heute-jetzt');
  const [location, setLocation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const getEventDateTime = (optionId: string) => {
    const now = new Date();
    const option = QUICK_OPTIONS.find(o => o.id === optionId);
    if (!option) return now;
    
    const eventTime = new Date(now);
    eventTime.setHours(eventTime.getHours() + option.hours);
    
    // Round to next 15 min
    const minutes = eventTime.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    eventTime.setMinutes(roundedMinutes);
    eventTime.setSeconds(0);
    
    return eventTime;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Heute';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Morgen';
    }
    return date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' });
  };

  const handleSubmit = async () => {
    if (!authState.user || !title.trim()) return;

    setIsSubmitting(true);
    try {
      const eventDateTime = getEventDateTime(selectedOption);
      
      const createdEvent = await createEvent({
        title: title.trim(),
        date: eventDateTime,
        time: formatTime(eventDateTime),
        location: location.trim() || undefined,
        createdBy: authState.user.id,
        participants: [{
          name: authState.user.name.trim() || 'Du',
          phoneNumber: authState.user.phoneNumber,
        }],
        reminderEnabled: true,
      });

      // WhatsApp Share with pre-filled message
      if (createdEvent.invitationLink) {
        const message = `🔥 Kommst du mit?\n\n${title.trim()}\n📅 ${formatDate(eventDateTime)} um ${formatTime(eventDateTime)}${location.trim() ? `\n📍 ${location.trim()}` : ''}\n\nAntworte hier: ${createdEvent.invitationLink}`;
        
        shareViaWhatsApp(createdEvent.invitationLink, message);
      }
      
      onClose();
      setTitle('');
      setLocation('');
      setSelectedOption('heute-jetzt');
    } catch (error) {
      console.error('Quick event error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center mr-3">
              <BoltIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Schnell-Event ⚡</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">In 10 Sekunden erstellt</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl">
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Title Input */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Was planst du? z.B. 🍕 Pizza"
              className="input text-lg"
              autoFocus
            />
          </div>

          {/* Quick Time Options */}
          <div>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Wann?</p>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_OPTIONS.map((option) => {
                const eventTime = getEventDateTime(option.id);
                const isSelected = selectedOption === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedOption(option.id)}
                    className={`p-3 rounded-2xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                        : 'border-gray-200 dark:border-slate-700 hover:border-orange-300'
                    }`}
                  >
                    <div className="text-2xl mb-1">{option.emoji}</div>
                    <div className="font-bold text-gray-900 dark:text-white text-sm">{option.label}</div>
                    <div className="text-xs text-gray-500">{formatTime(eventTime)}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location (optional) */}
          <div>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="📍 Ort (optional)"
              className="input"
            />
          </div>

          {/* Preview */}
          {title.trim() && (
            <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-2xl p-4">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                📢 Nach dem Erstellen wird automatisch ein WhatsApp-Link zum Teilen generiert!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <button
            onClick={handleSubmit}
            disabled={!title.trim() || isSubmitting}
            className="btn btn-gradient w-full font-bold tap-target disabled:opacity-50"
          >
            {isSubmitting ? 'Erstelle...' : '⚡ In 10 Sekunden erstellen & teilen'}
          </button>
        </div>
      </div>
    </div>
  );
}

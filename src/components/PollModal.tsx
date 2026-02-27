import { useState } from 'react';
import { XMarkIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { shareViaWhatsApp } from '../services/invitationService';
import TimePicker from './TimePicker';

interface PollModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PollOption = {
  id: string;
  label: string;
  date: Date;
  time: string;
};

export default function PollModal({ isOpen, onClose }: PollModalProps) {
  const { state: authState } = useAuth();
  const { createEvent, friends } = useData();
  
  const [title, setTitle] = useState('');
  const [options, setOptions] = useState<PollOption[]>([
    { id: '1', label: 'Freitag', date: new Date(), time: '18:00' },
    { id: '2', label: 'Samstag', date: new Date(), time: '18:00' },
    { id: '3', label: 'Sonntag', date: new Date(), time: '14:00' },
  ]);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const getNextWeekend = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
    const daysUntilSunday = (0 - dayOfWeek + 7) % 7 || 7;
    
    const friday = new Date(today);
    friday.setDate(friday.getDate() + daysUntilFriday);
    
    const saturday = new Date(today);
    saturday.setDate(saturday.getDate() + daysUntilSaturday);
    
    const sunday = new Date(today);
    sunday.setDate(sunday.getDate() + daysUntilSunday);
    
    return { friday, saturday, sunday };
  };

  const initializeOptions = () => {
    const { friday, saturday, sunday } = getNextWeekend();
    return [
      { id: '1', label: 'Freitag', date: friday, time: '18:00' },
      { id: '2', label: 'Samstag', date: saturday, time: '18:00' },
      { id: '3', label: 'Sonntag', date: sunday, time: '14:00' },
    ];
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const toggleFriend = (friendId: string) => {
    setSelectedFriends(prev => 
      prev.includes(friendId) 
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleCreatePoll = async () => {
    if (!authState.user || !title.trim()) return;

    setIsSubmitting(true);
    try {
      // Create a poll event with all options in description
      const pollOptionsText = options.map(o => `• ${o.label}: ${formatDate(o.date)} um ${o.time}`).join('\n');
      
      const createdEvent = await createEvent({
        title: `📊 ${title.trim()} - Abstimmung`,
        description: `Abstimmung:\n${pollOptionsText}\n\nStimme hier ab:`,
        date: options[0].date,
        time: options[0].time,
        createdBy: authState.user.id,
        participants: [
          { name: authState.user.name.trim() || 'Du', phoneNumber: authState.user.phoneNumber },
          ...friends.filter(f => selectedFriends.includes(f.id)).map(f => ({
            name: f.name,
            phoneNumber: f.phoneNumber,
          })),
        ],
        reminderEnabled: false,
      });

      // Share poll via WhatsApp
      if (createdEvent.invitationLink) {
        const message = `📊 Abstimmung: ${title.trim()}\n\nWann soll es stattfinden?\n\n${options.map(o => `${o.label}: ${formatDate(o.date)} um ${o.time}`).join('\n')}\n\nAbstimmen: ${createdEvent.invitationLink}`;
        
        shareViaWhatsApp(createdEvent.invitationLink, message);
      }
      
      onClose();
      setTitle('');
      setOptions(initializeOptions());
      setSelectedFriends([]);
    } catch (error) {
      console.error('Poll error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mr-3">
              <ChartBarIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Umfrage 📊</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Findet den besten Termin</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl">
            <XMarkIcon className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Was wollt ihr machen? z.B. 🎬 Filmabend"
              className="input text-lg"
              autoFocus
            />
          </div>

          {/* Time Options */}
          <div>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Wähle Termine</p>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={option.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={option.label}
                    onChange={(e) => {
                      const newOptions = [...options];
                      newOptions[index].label = e.target.value;
                      setOptions(newOptions);
                    }}
                    placeholder="z.B. Freitag"
                    className="input flex-1"
                  />
                  <div className="w-28">
                    <TimePicker
                      value={option.time}
                      onChange={(time) => {
                        const newOptions = [...options];
                        newOptions[index].time = time;
                        setOptions(newOptions);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setOptions([...options, { id: Date.now().toString(), label: '', date: new Date(), time: '18:00' }])}
              className="mt-2 text-sm text-purple-600 dark:text-purple-400 font-medium"
            >
              + Weitere Option hinzufügen
            </button>
          </div>

          {/* Friends Selection */}
          <div>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">An wen geht die Umfrage?</p>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
              {friends.map((friend) => (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => toggleFriend(friend.id)}
                  className={`p-3 rounded-2xl border-2 text-left transition-all ${
                    selectedFriends.includes(friend.id)
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-gray-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 dark:text-white">{friend.name}</span>
                    {selectedFriends.includes(friend.id) && (
                      <span className="text-purple-500">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-4">
            <p className="text-sm text-purple-800 dark:text-purple-200">
              📢 Alle können über den Link abstimmen! Das Ergebnis siehst du in der App.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-0 sticky bottom-0 bg-white dark:bg-slate-900">
          <button
            onClick={handleCreatePoll}
            disabled={!title.trim() || isSubmitting}
            className="btn btn-gradient w-full font-bold tap-target disabled:opacity-50"
          >
            {isSubmitting ? 'Erstelle...' : '📊 Umfrage erstellen & teilen'}
          </button>
        </div>
      </div>
    </div>
  );
}

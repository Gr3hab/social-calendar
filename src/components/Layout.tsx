import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { HomeIcon, CalendarDaysIcon, UserGroupIcon, UserIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useApp } from '../context/AppContext';
import { useState, useRef } from 'react';
import EventModal from './EventModal';
import QuickEventModal from './QuickEventModal';
import PollModal from './PollModal';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { copyToClipboard } from '../services/invitationService';
import type { CreateEventInput } from '../types';

export default function Layout() {
  const { dispatch } = useApp();
  const { state: authState } = useAuth();
  const { createEvent, groups, friends } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isQuickEventOpen, setIsQuickEventOpen] = useState(false);
  const [isPollOpen, setIsPollOpen] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFabPress = () => {
    setIsEventModalOpen(true);
  };

  const handleFabLongPress = () => {
    setIsQuickEventOpen(true);
  };

  // Listen for poll trigger from Home
  useState(() => {
    const handleOpenPoll = () => setIsPollOpen(true);
    window.addEventListener('open-poll', handleOpenPoll);
    return () => window.removeEventListener('open-poll', handleOpenPoll);
  });

  const handleFabTouchStart = () => {
    pressTimer.current = setTimeout(handleFabLongPress, 500);
  };

  const handleFabTouchEnd = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
      handleFabPress();
    }
  };

  const handleFabMouseDown = () => {
    pressTimer.current = setTimeout(handleFabLongPress, 500);
  };

  const handleFabMouseUp = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
      handleFabPress();
    }
  };

  const handleFabMouseLeave = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handleCreateEvent = async (
    eventData: Omit<CreateEventInput, 'createdBy' | 'participants'> & {
      participants: CreateEventInput['participants'];
    },
  ) => {
    if (!authState.user) {
      return;
    }

    const creatorParticipant = {
      name: authState.user.name.trim() || 'Du',
      phoneNumber: authState.user.phoneNumber,
      avatar: authState.user.avatar,
    };

    const createdEvent = await createEvent({
      ...eventData,
      createdBy: authState.user.id,
      participants: [creatorParticipant, ...eventData.participants],
    });

    if (createdEvent.invitationLink) {
      try {
        await copyToClipboard(createdEvent.invitationLink);
        alert('🎉 Event erstellt! Einladungslink wurde in die Zwischenablage kopiert.');
      } catch {
        alert('🎉 Event erstellt! Link konnte nicht automatisch kopiert werden.');
      }
    }
  };

  const navigation = [
    { name: 'Home', icon: HomeIcon, view: 'home' as const, path: '/' },
    { name: 'Kalender', icon: CalendarDaysIcon, view: 'calendar' as const, path: '/calendar' },
    { name: 'Gruppen', icon: UserGroupIcon, view: 'groups' as const, path: '/groups' },
    { name: 'Freunde', icon: UserIcon, view: 'friends' as const, path: '/friends' },
  ];

  const handleNavClick = (item: typeof navigation[0]) => {
    dispatch({ type: 'SET_CURRENT_VIEW', payload: item.view });
    navigate(item.path);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-lg mx-auto bg-white dark:bg-slate-900 min-h-screen relative shadow-2xl">
        <Outlet />

        {/* Floating Action Button */}
        <button 
          onClick={handleFabPress}
          onMouseDown={handleFabMouseDown}
          onMouseUp={handleFabMouseUp}
          onMouseLeave={handleFabMouseLeave}
          onTouchStart={handleFabTouchStart}
          onTouchEnd={handleFabTouchEnd}
          className="fab fab-pos fixed z-50 flex items-center justify-center tap-target"
          aria-label="Neuer Termin (Long-press für Schnell-Event)"
        >
          <PlusIcon className="w-7 h-7" />
        </button>

        {/* Quick Event Modal */}
        <QuickEventModal
          isOpen={isQuickEventOpen}
          onClose={() => setIsQuickEventOpen(false)}
        />

        {/* Poll Modal */}
        <PollModal
          isOpen={isPollOpen}
          onClose={() => setIsPollOpen(false)}
        />

        {/* Event Modal */}
        <EventModal 
          isOpen={isEventModalOpen}
          onClose={() => setIsEventModalOpen(false)}
          onCreate={handleCreateEvent}
          groups={groups}
          friends={friends}
        />

        {/* Bottom Navigation */}
        <nav className="bottom-nav z-40">
          <div className="max-w-lg mx-auto px-4">
            <div className="flex justify-around py-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNavClick(item)}
                    className={`tap-target flex flex-col items-center px-3 py-2 rounded-2xl transition-all duration-300 ${
                      isActive
                        ? 'text-sky-700 dark:text-sky-300 scale-[1.04]'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                    }`}
                  >
                    <div className={`p-2 rounded-xl transition-all duration-300 ${
                      isActive 
                        ? 'bg-gradient-to-br from-sky-500 to-cyan-500 shadow-lg' 
                        : ''
                    }`}>
                      <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
                    </div>
                    <span className={`text-xs mt-1 font-medium ${isActive ? 'font-bold' : ''}`}>
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}

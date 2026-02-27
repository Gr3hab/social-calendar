import { useMemo, useState } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { useApp } from '../context/AppContext';
import { useData } from '../context/DataContext';

export default function Calendar() {
  const { state, dispatch } = useApp();
  const { events } = useData();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleDateClick = (date: Date) => {
    dispatch({ type: 'SET_SELECTED_DATE', payload: date });
  };

  const selectedDateEvents = useMemo(
    () =>
      events
        .filter((event) => isSameDay(event.date, state.selectedDate))
        .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [events, state.selectedDate],
  );

  const getDayEvents = (date: Date) =>
    events.filter((event) => isSameDay(event.date, date)).sort((a, b) => a.date.getTime() - b.date.getTime());

  const renderMonthView = () => (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handlePreviousMonth}
          className="tap-target p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-md hover:shadow-lg transition-all"
        >
          <ChevronLeftIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
        
        <h2 className="text-xl font-black text-gray-900 dark:text-white">
          {format(currentMonth, 'MMMM yyyy', { locale: de })}
        </h2>
        
        <button
          onClick={handleNextMonth}
          className="tap-target p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-md hover:shadow-lg transition-all"
        >
          <ChevronRightIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-3">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-bold text-sky-600 dark:text-sky-300 py-2"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = isSameDay(day, state.selectedDate);
          const isToday = isSameDay(day, new Date());
          const dayEvents = getDayEvents(day);

          return (
            <button
              key={day.toString()}
              onClick={() => handleDateClick(day)}
              className={`
                aspect-square flex items-center justify-center rounded-2xl text-sm font-medium transition-all
                ${isCurrentMonth ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'}
                ${isSelected ? 'bg-gradient-to-br from-sky-500 to-cyan-500 text-white shadow-lg scale-[1.06]' : ''}
                ${isToday && !isSelected ? 'bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-md' : ''}
                ${!isSelected && !isToday ? 'hover:bg-sky-100 dark:hover:bg-sky-900/30' : ''}
              `}
            >
              <div className="flex flex-col items-center">
                <span>{format(day, 'd')}</span>
                {dayEvents.length > 0 && (
                  <span className="mt-0.5 inline-flex gap-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white/90' : 'bg-sky-500'}`}
                      />
                    ))}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 p-5 bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-slate-800 dark:to-slate-700 rounded-3xl">
        <h3 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">
          {format(state.selectedDate, 'EEEE, d. MMMM', { locale: de })}
        </h3>
        {selectedDateEvents.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">Keine Termine 📅</p>
        ) : (
          <div className="space-y-2">
            {selectedDateEvents.map((event) => (
              <div key={event.id} className="p-3 rounded-2xl bg-white/80 dark:bg-gray-900/60">
                <p className="font-semibold text-gray-900 dark:text-white">{event.title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {format(event.date, 'HH:mm')} {event.location ? `• ${event.location}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderWeekView = () => {
    const weekStart = startOfWeek(state.selectedDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <div className="p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Wochenansicht
          </h2>
          <button
            onClick={() => dispatch({ type: 'SET_CALENDAR_VIEW', payload: 'month' })}
            className="btn btn-ghost text-sm"
          >
            Monat
          </button>
        </div>

        <div className="space-y-2">
          {weekDays.map((day) => {
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, state.selectedDate);
            const dayEvents = getDayEvents(day);

            return (
              <button
                key={day.toString()}
                onClick={() => handleDateClick(day)}
                className={`
                  w-full p-3 rounded-xl text-left transition-colors
                  ${isSelected ? 'bg-sky-100 dark:bg-sky-900/30 border-2 border-sky-500' : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700'}
                  ${isToday && !isSelected ? 'border-sky-300 dark:border-sky-700' : ''}
                `}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {format(day, 'EEEE', { locale: de })}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {format(day, 'd. MMMM', { locale: de })}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {dayEvents.length === 0 ? 'Keine Termine' : `${dayEvents.length} Termine`}
                  </div>
                </div>
                {dayEvents.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        className="px-2 py-1 rounded-full text-xs bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                      >
                        {event.title}
                      </span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-28">
      {/* Header */}
      <div className="bg-gradient-to-br from-sky-600 to-cyan-500 pt-12 pb-7 px-4 rounded-b-[2rem]">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center mr-4">
              <CalendarIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white">Kalender</h1>
              <p className="text-white/80 text-sm">Plan deine Events</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => dispatch({ type: 'SET_CALENDAR_VIEW', payload: 'month' })}
              className={`tap-target px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                state.calendarView === 'month' 
                  ? 'bg-white text-sky-700' 
                  : 'bg-white/20 text-white'
              }`}
            >
              Monat
            </button>
            <button 
              onClick={() => dispatch({ type: 'SET_CALENDAR_VIEW', payload: 'week' })}
              className={`tap-target px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                state.calendarView === 'week' 
                  ? 'bg-white text-sky-700' 
                  : 'bg-white/20 text-white'
              }`}
            >
              Woche
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto">
        {state.calendarView === 'month' ? renderMonthView() : renderWeekView()}
      </div>
    </div>
  );
}

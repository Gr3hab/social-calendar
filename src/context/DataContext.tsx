/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CreateEventInput, CreateGroupInput, Event, Friend, Group } from '../types';
import {
  addMembersToGroup as addMembersToGroupApi,
  createEvent as createEventApi,
  createGroup as createGroupApi,
  getEventById as getEventByIdApi,
  getMockData,
  respondToInvitation,
  sendRsvpNudge as sendRsvpNudgeMockApi,
  toggleEventReminder as toggleEventReminderApi,
} from '../services/mockApi';
import {
  addMembersToGroupApi as addMembersToGroupRemoteApi,
  createEventApi as createEventRemoteApi,
  createGroupApi as createGroupRemoteApi,
  fetchDataStateApi,
  getEventByIdApi as getEventByIdRemoteApi,
  isApiDataEnabled,
  respondToInvitationApi,
  sendRsvpNudgeApi as sendRsvpNudgeRemoteApi,
  type SendRsvpNudgeResult,
  toggleEventReminderApi as toggleEventReminderRemoteApi,
} from '../services/dataApi';
import { useAuth } from './AuthContext';

interface InvitationResponseInput {
  eventId: string;
  name: string;
  phoneNumber: string;
  status: 'accepted' | 'declined';
}

interface DataContextValue {
  events: Event[];
  groups: Group[];
  friends: Friend[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  getEventById: (eventId: string) => Promise<Event | null>;
  createEvent: (input: CreateEventInput) => Promise<Event>;
  createGroup: (input: CreateGroupInput) => Promise<Group>;
  addMembersToGroup: (groupId: string, members: Friend[]) => Promise<Group | null>;
  respondToEvent: (input: InvitationResponseInput) => Promise<Event | null>;
  toggleEventReminder: (eventId: string, enabled: boolean) => Promise<Event | null>;
  sendRsvpNudge: (eventId: string) => Promise<SendRsvpNudgeResult>;
  addFriend: (friend: Omit<Friend, 'id'>) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { state: authState } = useAuth();
  const dataApiEnabled = isApiDataEnabled();
  const canLoadData = !dataApiEnabled || authState.isAuthenticated;
  const [events, setEvents] = useState<Event[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!canLoadData) {
      setEvents([]);
      setGroups([]);
      setFriends([]);
      return;
    }
    const data = dataApiEnabled ? await fetchDataStateApi() : await getMockData();
    setEvents(data.events);
    setGroups(data.groups);
    setFriends(data.friends);
  }, [canLoadData, dataApiEnabled]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      try {
        if (!canLoadData) {
          setEvents([]);
          setGroups([]);
          setFriends([]);
          return;
        }
        const data = dataApiEnabled ? await fetchDataStateApi() : await getMockData();
        if (!isMounted) {
          return;
        }
        setEvents(data.events);
        setGroups(data.groups);
        setFriends(data.friends);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [canLoadData, dataApiEnabled]);

  const getEventById = useCallback(async (eventId: string) => {
    return dataApiEnabled ? getEventByIdRemoteApi(eventId) : getEventByIdApi(eventId);
  }, [dataApiEnabled]);

  const createEvent = useCallback(async (input: CreateEventInput) => {
    const event = dataApiEnabled ? await createEventRemoteApi(input) : await createEventApi(input);
    setEvents((prev) => [event, ...prev]);
    return event;
  }, [dataApiEnabled]);

  const createGroup = useCallback(async (input: CreateGroupInput) => {
    const group = dataApiEnabled ? await createGroupRemoteApi(input) : await createGroupApi(input);
    setGroups((prev) => [group, ...prev]);
    return group;
  }, [dataApiEnabled]);

  const addMembersToGroup = useCallback(async (groupId: string, members: Friend[]) => {
    const updated = dataApiEnabled
      ? await addMembersToGroupRemoteApi(groupId, members)
      : await addMembersToGroupApi(groupId, members);
    if (!updated) {
      return null;
    }

    setGroups((prev) =>
      prev.map((group) => (group.id === groupId ? updated : group)),
    );
    return updated;
  }, [dataApiEnabled]);

  const respondToEvent = useCallback(async (input: InvitationResponseInput) => {
    const updated = dataApiEnabled ? await respondToInvitationApi(input) : await respondToInvitation(input);
    if (!updated) {
      return null;
    }

    setEvents((prev) =>
      prev.map((event) => (event.id === input.eventId ? updated : event)),
    );
    return updated;
  }, [dataApiEnabled]);

  const toggleEventReminder = useCallback(async (eventId: string, enabled: boolean) => {
    const updated = dataApiEnabled
      ? await toggleEventReminderRemoteApi(eventId, enabled)
      : await toggleEventReminderApi(eventId, enabled);
    if (!updated) {
      return null;
    }

    setEvents((prev) =>
      prev.map((event) => (event.id === eventId ? updated : event)),
    );
    return updated;
  }, [dataApiEnabled]);

  const sendRsvpNudge = useCallback(async (eventId: string) => {
    const result = dataApiEnabled
      ? await sendRsvpNudgeRemoteApi(eventId)
      : await sendRsvpNudgeMockApi(eventId);
    if (!result.event) {
      return result;
    }

    const updatedEvent = result.event;
    setEvents((prev) =>
      prev.map((event) => (event.id === eventId ? updatedEvent : event)),
    );
    return result;
  }, [dataApiEnabled]);

  const addFriend = useCallback((friend: Omit<Friend, 'id'>) => {
    const newFriend: Friend = {
      ...friend,
      id: `friend-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setFriends((prev) => [...prev, newFriend]);
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      events,
      groups,
      friends,
      isLoading,
      refresh,
      getEventById,
      createEvent,
      createGroup,
      addMembersToGroup,
      respondToEvent,
      toggleEventReminder,
      sendRsvpNudge,
      addFriend,
    }),
    [
      events,
      groups,
      friends,
      isLoading,
      refresh,
      getEventById,
      createEvent,
      createGroup,
      addMembersToGroup,
      respondToEvent,
      toggleEventReminder,
      sendRsvpNudge,
      addFriend,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used inside DataProvider');
  }
  return context;
}

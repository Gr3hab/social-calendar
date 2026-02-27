// ========================================
// Supabase Client Configuration
// ========================================

import { createClient } from '@supabase/supabase-js'

const rawSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const rawSupabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim()

const SUPABASE_PLACEHOLDER_URL = 'https://your-project-ref.supabase.co'
const SUPABASE_PLACEHOLDER_KEY = 'your-anon-key'

const SUPABASE_CONFIGURED =
  rawSupabaseUrl.length > 0 &&
  rawSupabaseAnonKey.length > 0 &&
  rawSupabaseUrl !== SUPABASE_PLACEHOLDER_URL &&
  rawSupabaseAnonKey !== SUPABASE_PLACEHOLDER_KEY &&
  rawSupabaseUrl.startsWith('https://') &&
  rawSupabaseUrl.includes('.supabase.co')

const supabaseUrl = SUPABASE_CONFIGURED ? rawSupabaseUrl : SUPABASE_PLACEHOLDER_URL
const supabaseAnonKey = SUPABASE_CONFIGURED ? rawSupabaseAnonKey : SUPABASE_PLACEHOLDER_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function isSupabaseConfigured(): boolean {
  return SUPABASE_CONFIGURED
}

function assertSupabaseConfigured() {
  if (!SUPABASE_CONFIGURED) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
}

// ========================================
// Type Definitions
// ========================================

export interface Profile {
  id: string
  display_name?: string
  phone_number?: string
  avatar_url?: string
  instagram_handle?: string
  snapchat_handle?: string
  tiktok_handle?: string
  created_at: string
  updated_at: string
}

export interface Group {
  id: string
  name: string
  description?: string
  created_by: string
  created_at: string
  // Optional: joined members count
  members?: GroupMember[]
}

export interface GroupMember {
  group_id: string
  user_id: string
  role: 'member' | 'admin'
  joined_at: string
  profile?: Profile
}

export interface Event {
  id: string
  title: string
  description?: string
  starts_at: string
  ends_at?: string
  location?: string
  created_by: string
  group_id?: string
  visibility: 'private' | 'group' | 'link'
  invitation_code?: string
  rsvp_deadline?: string
  reminder_enabled: boolean
  created_at: string
  // Optional: creator profile and attendees
  creator?: Profile
  attendees?: EventAttendee[]
}

export interface EventAttendee {
  event_id: string
  user_id: string
  status: 'yes' | 'no' | 'maybe'
  responded_at: string
  is_late_response: boolean
  profile?: Profile
}

// ========================================
// Helper Functions
// ========================================

// Email Magic Login (statt Phone OTP!)
export async function signInWithEmail(email: string, redirectTo?: string) {
  assertSupabaseConfigured()
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
    }
  })

  if (error) throw error
  return data
}

// Phone OTP (nur wenn wirklich nötig - kostet SMS!)
export async function signInWithPhone(phone: string) {
  assertSupabaseConfigured()
  const { data, error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      shouldCreateUser: true,
    }
  })

  if (error) throw error
  return data
}

// Get current user profile
export async function getCurrentProfile() {
  assertSupabaseConfigured()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error && error.code === 'PGRST116') {
    // Profile doesn't exist, create it
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        display_name: user.user_metadata?.display_name || user.email?.split('@')[0]
      })
      .select()
      .single()

    if (createError) throw createError
    return newProfile
  }

  if (error) throw error
  return data
}

// Update user profile
export async function updateProfile(updates: Partial<Profile>) {
  assertSupabaseConfigured()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single()

  if (error) throw error
  return data
}

// Get user's events
export async function getUserEvents() {
  assertSupabaseConfigured()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      creator:profiles!events_created_by_fkey (
        display_name,
        avatar_url
      ),
      attendees:event_attendees (
        status,
        responded_at,
        is_late_response,
        profile:profiles!event_attendees_user_id_fkey (
          display_name,
          avatar_url
        )
      )
    `)
    .or(`created_by.eq.${user.id},visibility.eq.group`)
    .order('starts_at', { ascending: true })

  if (error) throw error
  return data || []
}

// Create event
export async function createEvent(event: Omit<Event, 'id' | 'created_at' | 'created_by'>) {
  assertSupabaseConfigured()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Generate invitation code for link events
  let invitationCode = event.invitation_code
  if (event.visibility === 'link' && !invitationCode) {
    invitationCode = generateInvitationCode()
  }

  const { data, error } = await supabase
    .from('events')
    .insert({
      ...event,
      created_by: user.id,
      invitation_code: invitationCode
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Generate random invitation code
function generateInvitationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// RSVP to event
export async function rsvpToEvent(eventId: string, status: 'yes' | 'no' | 'maybe') {
  assertSupabaseConfigured()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('event_attendees')
    .upsert({
      event_id: eventId,
      user_id: user.id,
      status,
      responded_at: new Date().toISOString(),
      is_late_response: false // Will be updated by edge function if late
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// Get user's groups
export async function getUserGroups() {
  assertSupabaseConfigured()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('groups')
    .select(`
      *,
      members:group_members (
        user_id,
        role,
        joined_at,
        profile:profiles (
          display_name,
          avatar_url
        )
      )
    `)
    .or(`created_by.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

// Create group
export async function createGroup(group: Omit<Group, 'id' | 'created_at' | 'created_by'>) {
  assertSupabaseConfigured()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('groups')
    .insert({
      ...group,
      created_by: user.id
    })
    .select()
    .single()

  if (error) throw error

  // Add creator as admin member
  await supabase
    .from('group_members')
    .insert({
      group_id: data.id,
      user_id: user.id,
      role: 'admin'
    })

  return data
}

// Public event access via edge function
export async function getPublicEvent(invitationCode: string) {
  assertSupabaseConfigured()
  const { data, error } = await supabase.functions.invoke('public-event', {
    body: { code: invitationCode }
  })

  if (error) throw error
  return data
}

// Public RSVP via edge function
export async function publicRsvp(invitationCode: string, name: string, phoneNumber: string, status: 'yes' | 'no' | 'maybe') {
  assertSupabaseConfigured()
  const { data, error } = await supabase.functions.invoke('rsvp-public', {
    body: { 
      code: invitationCode, 
      name, 
      phoneNumber, 
      status 
    }
  })

  if (error) throw error
  return data
}

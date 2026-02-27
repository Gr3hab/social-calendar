// ========================================
// REAL SECURITY TEST - Node.js mit echten User Sessions
// ========================================

import { createClient } from '@supabase/supabase-js'

// Config - ersetze mit deinen echten Werten
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project-ref.supabase.co'
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key'

// Test User Daten
const USER_A = {
  email: 'testuser-a@example.com',
  displayName: 'Test User A'
}

const USER_B = {
  email: 'testuser-b@example.com', 
  displayName: 'Test User B'
}

class SecurityTester {
  constructor() {
    this.clientA = null
    this.clientB = null
    this.testResults = []
  }

  async log(message, type = 'INFO') {
    const timestamp = new Date().toISOString()
    console.log(`[${timestamp}] [${type}] ${message}`)
    this.testResults.push({ timestamp, message, type })
  }

  async setup() {
    this.log('=== SETUP: Creating authenticated clients ===')
    
    // Client A
    this.clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    // Client B  
    this.clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    
    // Sign up User A
    try {
      const { error } = await this.clientA.auth.signUp({
        email: USER_A.email,
        password: 'testpassword123',
        options: {
          data: { display_name: USER_A.displayName }
        }
      })
      
      if (error && !error.message.includes('already registered')) {
        this.log(`User A signup failed: ${error.message}`, 'ERROR')
        return false
      }
      
      // Login User A
      const { error: loginError } = await this.clientA.auth.signInWithPassword({
        email: USER_A.email,
        password: 'testpassword123'
      })
      
      if (loginError) {
        this.log(`User A login failed: ${loginError.message}`, 'ERROR')
        return false
      }
      
      this.log('✅ User A authenticated successfully')
    } catch (error) {
      this.log(`User A setup failed: ${error.message}`, 'ERROR')
      return false
    }

    // Sign up User B
    try {
      const { error } = await this.clientB.auth.signUp({
        email: USER_B.email,
        password: 'testpassword123',
        options: {
          data: { display_name: USER_B.displayName }
        }
      })
      
      if (error && !error.message.includes('already registered')) {
        this.log(`User B signup failed: ${error.message}`, 'ERROR')
        return false
      }
      
      // Login User B
      const { error: loginError } = await this.clientB.auth.signInWithPassword({
        email: USER_B.email,
        password: 'testpassword123'
      })
      
      if (loginError) {
        this.log(`User B login failed: ${loginError.message}`, 'ERROR')
        return false
      }
      
      this.log('✅ User B authenticated successfully')
    } catch (error) {
      this.log(`User B setup failed: ${error.message}`, 'ERROR')
      return false
    }

    return true
  }

  async testProfileIsolation() {
    this.log('\n=== TEST 1: Profile Isolation ===')
    
    // User A sollte eigenes Profil sehen
    try {
      const { data, error } = await this.clientA
        .from('profiles')
        .select('*')
        .single()
      
      if (error) {
        this.log(`❌ User A cannot access own profile: ${error.message}`, 'FAIL')
        return false
      }
      
      this.log('✅ User A can access own profile')
    } catch (error) {
      this.log(`❌ Profile test failed: ${error.message}`, 'FAIL')
      return false
    }

    // User B sollte NICHT User A's Profil sehen
    try {
      const { data, error } = await this.clientB
        .from('profiles')
        .select('*')
        .eq('id', (await this.clientA.auth.getUser()).data.user.id)
        .single()
      
      if (!error) {
        this.log('❌ User B can access User A profile - SECURITY LEAK!', 'FAIL')
        return false
      }
      
      this.log('✅ User B cannot access User A profile')
    } catch (error) {
      this.log('✅ User B cannot access User A profile (expected error)')
    }

    return true
  }

  async testGroupIsolation() {
    this.log('\n=== TEST 2: Group Isolation ===')
    
    // User A erstellt Gruppe
    let groupId = null
    try {
      const { data, error } = await this.clientA
        .from('groups')
        .insert({
          name: 'Test Group A',
          description: 'Created by User A'
        })
        .select()
        .single()
      
      if (error) {
        this.log(`❌ User A cannot create group: ${error.message}`, 'FAIL')
        return false
      }
      
      groupId = data.id
      this.log('✅ User A created group')
    } catch (error) {
      this.log(`❌ Group creation failed: ${error.message}`, 'FAIL')
      return false
    }

    // User A sollte eigene Gruppe sehen
    try {
      const { data, error } = await this.clientA
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single()
      
      if (error) {
        this.log(`❌ User A cannot access own group: ${error.message}`, 'FAIL')
        return false
      }
      
      this.log('✅ User A can access own group')
    } catch (error) {
      this.log(`❌ Group access test failed: ${error.message}`, 'FAIL')
      return false
    }

    // User B sollte NICHT User A's Gruppe sehen
    try {
      const { data, error } = await this.clientB
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single()
      
      if (!error) {
        this.log('❌ User B can access User A group - SECURITY LEAK!', 'FAIL')
        return false
      }
      
      this.log('✅ User B cannot access User A group')
    } catch (error) {
      this.log('✅ User B cannot access User A group (expected error)')
    }

    return true
  }

  async testEventIsolation() {
    this.log('\n=== TEST 3: Event Isolation ===')
    
    // User A erstellt Private Event
    let eventId = null
    try {
      const { data, error } = await this.clientA
        .from('events')
        .insert({
          title: 'Private Event A',
          description: 'Should only be visible to User A',
          starts_at: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          visibility: 'private'
        })
        .select()
        .single()
      
      if (error) {
        this.log(`❌ User A cannot create event: ${error.message}`, 'FAIL')
        return false
      }
      
      eventId = data.id
      this.log('✅ User A created private event')
    } catch (error) {
      this.log(`❌ Event creation failed: ${error.message}`, 'FAIL')
      return false
    }

    // User A sollte eigenes Event sehen
    try {
      const { data, error } = await this.clientA
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()
      
      if (error) {
        this.log(`❌ User A cannot access own event: ${error.message}`, 'FAIL')
        return false
      }
      
      this.log('✅ User A can access own event')
    } catch (error) {
      this.log(`❌ Event access test failed: ${error.message}`, 'FAIL')
      return false
    }

    // User B sollte NICHT User A's Private Event sehen
    try {
      const { data, error } = await this.clientB
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()
      
      if (!error) {
        this.log('❌ User B can access User A private event - SECURITY LEAK!', 'FAIL')
        return false
      }
      
      this.log('✅ User B cannot access User A private event')
    } catch (error) {
      this.log('✅ User B cannot access User A private event (expected error)')
    }

    return true
  }

  async testRSVPIsolation() {
    this.log('\n=== TEST 4: RSVP Isolation ===')
    
    // User A erstellt Event
    let eventId = null
    try {
      const { data, error } = await this.clientA
        .from('events')
        .insert({
          title: 'RSVP Test Event',
          starts_at: new Date(Date.now() + 86400000).toISOString(),
          visibility: 'private'
        })
        .select()
        .single()
      
      if (error) throw error
      eventId = data.id
    } catch (error) {
      this.log(`❌ RSVP test setup failed: ${error.message}`, 'FAIL')
      return false
    }

    // User A RSVP zu eigenem Event
    try {
      const { error } = await this.clientA
        .from('event_attendees')
        .insert({
          event_id: eventId,
          user_id: (await this.clientA.auth.getUser()).data.user.id,
          status: 'yes'
        })
      
      if (error) {
        this.log(`❌ User A cannot RSVP to own event: ${error.message}`, 'FAIL')
        return false
      }
      
      this.log('✅ User A RSVP to own event')
    } catch (error) {
      this.log(`❌ RSVP failed: ${error.message}`, 'FAIL')
      return false
    }

    // User A sollte RSVPs sehen (als Creator)
    try {
      const { data, error } = await this.clientA
        .from('event_attendees')
        .select('*')
        .eq('event_id', eventId)
      
      if (error) {
        this.log(`❌ User A cannot see RSVPs: ${error.message}`, 'FAIL')
        return false
      }
      
      this.log(`✅ User A can see ${data.length} RSVPs`)
    } catch (error) {
      this.log(`❌ RSVP visibility test failed: ${error.message}`, 'FAIL')
      return false
    }

    // User B sollte NICHT RSVPs sehen
    try {
      const { data, error } = await this.clientB
        .from('event_attendees')
        .select('*')
        .eq('event_id', eventId)
      
      if (!error && data.length > 0) {
        this.log('❌ User B can see RSVPs - SECURITY LEAK!', 'FAIL')
        return false
      }
      
      this.log('✅ User B cannot see RSVPs')
    } catch (error) {
      this.log('✅ User B cannot see RSVPs (expected error)')
    }

    return true
  }

  async testPublicEventEdgeFunction() {
    this.log('\n=== TEST 5: Public Event Edge Function ===')
    
    // User A erstellt Public Event mit Invitation Code
    let invitationCode = null
    try {
      const { data, error } = await this.clientA
        .from('events')
        .insert({
          title: 'Public Test Event',
          starts_at: new Date(Date.now() + 86400000).toISOString(),
          visibility: 'link'
        })
        .select()
        .single()
      
      if (error) throw error
      invitationCode = data.invitation_code
      this.log(`✅ Created public event with code: ${invitationCode}`)
    } catch (error) {
      this.log(`❌ Public event setup failed: ${error.message}`, 'FAIL')
      return false
    }

    // Test Edge Function mit gültigem Code
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/public-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ code: invitationCode })
      })
      
      if (!response.ok) {
        const error = await response.text()
        this.log(`❌ Edge function failed: ${error}`, 'FAIL')
        return false
      }
      
      const result = await response.json()
      this.log('✅ Edge function returns event data')
      
      // Prüfen ob sensitive Daten exposed sind
      if (result.event && result.event.attendees) {
        this.log('⚠️  Edge function exposes attendee data - review needed', 'WARN')
      }
    } catch (error) {
      this.log(`❌ Edge function test failed: ${error.message}`, 'FAIL')
      return false
    }

    // Test Edge Function mit ungültigem Code
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/public-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ code: 'INVALID_CODE' })
      })
      
      if (response.ok) {
        this.log('❌ Edge function accepts invalid code - SECURITY LEAK!', 'FAIL')
        return false
      }
      
      this.log('✅ Edge function rejects invalid code')
    } catch (error) {
      this.log(`❌ Invalid code test failed: ${error.message}`, 'FAIL')
      return false
    }

    return true
  }

  async cleanup() {
    this.log('\n=== CLEANUP ===')
    
    try {
      // Cleanup als Service Role (wenn möglich)
      // Hier müsstest du die Test-Daten manuell löschen
      this.log('⚠️  Manual cleanup required - remove test users, groups, events')
    } catch (error) {
      this.log(`Cleanup failed: ${error.message}`, 'ERROR')
    }
  }

  async runAllTests() {
    this.log('🚀 Starting Security Tests for Plan It.')
    
    const setupSuccess = await this.setup()
    if (!setupSuccess) {
      this.log('❌ Setup failed - aborting tests', 'FAIL')
      return false
    }

    const tests = [
      { name: 'Profile Isolation', fn: () => this.testProfileIsolation() },
      { name: 'Group Isolation', fn: () => this.testGroupIsolation() },
      { name: 'Event Isolation', fn: () => this.testEventIsolation() },
      { name: 'RSVP Isolation', fn: () => this.testRSVPIsolation() },
      { name: 'Public Event Edge Function', fn: () => this.testPublicEventEdgeFunction() }
    ]

    let passedTests = 0
    let totalTests = tests.length

    for (const test of tests) {
      try {
        const result = await test.fn()
        if (result) {
          passedTests++
          this.log(`✅ ${test.name} - PASSED`)
        } else {
          this.log(`❌ ${test.name} - FAILED`, 'FAIL')
        }
      } catch (error) {
        this.log(`❌ ${test.name} - ERROR: ${error.message}`, 'FAIL')
      }
    }

    await this.cleanup()

    this.log(`\n=== FINAL RESULTS ===`)
    this.log(`Passed: ${passedTests}/${totalTests}`)
    
    if (passedTests === totalTests) {
      this.log('🎉 ALL TESTS PASSED - Zero Data Leaks Confirmed!', 'SUCCESS')
      return true
    } else {
      this.log('🚨 SOME TESTS FAILED - Security Issues Detected!', 'FAIL')
      return false
    }
  }
}

// Run tests
if (require.main === module) {
  const tester = new SecurityTester()
  tester.runAllTests().then(success => {
    process.exit(success ? 0 : 1)
  }).catch(error => {
    console.error('Test runner failed:', error)
    process.exit(1)
  })
}

export default SecurityTester

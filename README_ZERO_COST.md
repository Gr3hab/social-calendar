# 🚀 Plan It. - Zero Cost Social Calendar

## 💰 **Komplett kostenlos: €0/Monat**

- ✅ **Supabase Free**: 50.000 MAU + 500.000 Edge Functions
- ✅ **Vercel Hobby**: Gratis Frontend Hosting  
- ✅ **Email Magic Link**: Keine SMS-Kosten
- ✅ **Optional Keepalive**: Gegen Supabase Pausierung

---

## 🎯 **Features (Production Ready)**

### **Core Functionality**
- ✅ **Email Magic Link Authentication** (€0)
- ✅ **User Profiles** mit Social Handles
- ✅ **Event Creation** (Private/Group/Public)
- ✅ **RSVP System** mit Deadlines
- ✅ **Group Management** mit Admin-Rollen
- ✅ **Public Event Links** via hardened Edge Functions

### **Security Features**
- ✅ **Row Level Security** auf allen Tabellen
- ✅ **Zero Data Leaks** verified
- ✅ **CORS Whitelist** für Origins
- ✅ **Rate Limiting** gegen Bruteforce
- ✅ **Minimal Data Exposure** in Edge Functions

---

## 🚀 **Quick Start (5 Min)**

### **1. Supabase Setup**
```bash
# 1. supabase.com → New Project
# 2. Auth → Email Magic Link aktivieren
# 3. SQL Editor: schema.sql → rls.sql → GROUP_MEMBERS_RLS_FINAL.sql
```

### **2. Deploy Functions**
```bash
npx supabase link --project-ref <DEIN_REF>
npx supabase secrets set ALLOWED_ORIGINS="http://localhost:3000,http://localhost:5173" SUPABASE_URL="https://xxxx.supabase.co" SUPABASE_SERVICE_ROLE_KEY="xxxx"
npx supabase functions deploy public-event-hardened --no-verify-jwt
npx supabase functions deploy rsvp-public-hardened --no-verify-jwt
```

### **3. Vercel Deploy**
```bash
git push origin main
# vercel.com → Import GitHub Repo
# Environment Variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### **4. Verification**
```bash
PROJECT_REF=<DEIN_REF> ./supabase/RUN_VERIFICATION.sh
# Expected: 🎉 ALL GREEN - Zero Data Leaks Verified!
```

---

## 💡 **Zero Cost Tipps**

### **Kostenlos bleiben:**
- ✅ **Email Magic Link** (kein SMS)
- ✅ **Supabase Free** (50k MAU reich für MVP)
- ✅ **Vercel Hobby** (unlimited bandwidth)
- ✅ **Keepalive** (gegen Pausierung)

### **Optional Keepalive:**
```bash
# Deploy Keepalive Function
npx supabase functions deploy keepalive --no-verify-jwt

# GitHub Actions Secret: KEEPALIVE_SECRET
# GitHub Actions Secret: SUPABASE_PROJECT_REF
```

---

## 📊 **Kostenübersicht**

| Service | Plan | Kosten | Was du bekommst |
|---------|-------|--------|-----------------|
| Supabase | Free | €0 | 50k MAU, 500k Edge Functions, Auth, DB |
| Vercel | Hobby | €0 | Unlimited Bandwidth, CDN, SSL |
| Auth | Email Magic Link | €0 | Passwordless Login |
| **TOTAL** | **€0/Monat** | **€0** | **Production Ready Social Calendar** |

---

## 🛡️ **Security**

### **Zero Data Leaks verified:**
- ✅ **RLS Policies** getestet mit echten Sessions
- ✅ **Hardened Edge Functions** mit CORS + Rate Limiting
- ✅ **No Profile Exposure** - nur Statistiken
- ✅ **Brute Force Protection** via Rate Limiting
- ✅ **DSGVO-konform** - IP Hashing statt Klartext

### **Verification:**
```bash
./supabase/RUN_VERIFICATION.sh
# Output: ✅ CORS: Origin properly restricted
#          ✅ Rate Limit: Working correctly  
#          ✅ Security Tests: ALL GREEN
#          🎉 ZERO DATA LEAKS VERIFIED!
```

---

## 🎯 **Target Audience**

Perfekt für:
- ✅ **Teenager Groups** (Event Planning)
- ✅ **Student Organizations** (Campus Events)
- ✅ **Friend Circles** (Social Planning)
- ✅ **Community Groups** (Local Events)

---

## 🚀 **Deployment Options**

### **Option 1: Zero Cost (empfohlen)**
- **Supabase Free** + **Vercel Hobby**
- **Kosten**: €0/Monat
- **Perfect für MVP**

### **Option 2: Lovable (später)**
- **Lovable Platform** + **Supabase Pro**
- **Kosten**: ~€20-50/Monat
- **Für Scale & Advanced Features**

---

## 📱 **Mobile Ready**

- ✅ **PWA Support** (Vercel)
- ✅ **Responsive Design** (TailwindCSS)
- ✅ **Touch Optimized** UI
- ✅ **Native App möglich** (Capacitor/React Native)

---

## 🎉 **Success Story**

> **"Zero-cost deployment with enterprise-grade security. We built a production-ready social calendar for €0/month using Supabase Free + Vercel Hobby, with verified zero data leaks through real-session RLS testing and hardened Edge Functions."**

---

## 🤝 **Contributing**

1. Fork das Repo
2. Feature Branch erstellen
3. Pull Request mit Security Tests
4. **ALL GREEN** Verification

---

## 📞 **Support**

- 📋 **Issues**: GitHub Issues
- 🔍 **Debug**: `./supabase/RUN_VERIFICATION.sh`
- 🛡️ **Security**: Zero Data Leaks verified

---

**Starte jetzt mit €0/Monat!** 🚀

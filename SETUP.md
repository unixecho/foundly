# Foundly — Infrastructure Setup Runbook

Do these in order. Each step unblocks the next.

---

## 1. GitHub

**Goal:** Get the code into a remote repo so Vercel can deploy from it.

1. Go to [github.com/new](https://github.com/new)
2. Name: `foundly` · Private · No README (we already have one)
3. Click **Create repository**
4. In your terminal, inside the `Foundly` project folder:

```bash
git init
git add .
git commit -m "Initial scaffold"
git remote add origin https://github.com/<your-username>/foundly.git
git branch -M main
git push -u origin main
```

---

## 2. Supabase

**Goal:** Live Postgres database, Auth (OTP email), and a webhook endpoint.

### 2a. Create project
1. [app.supabase.com](https://app.supabase.com) → **New project**
2. Name: `foundly` · Choose a region close to your users (Israel → `eu-central-1` or `eu-west-2`)
3. Set a strong DB password — save it somewhere safe
4. Wait ~2 min for provisioning

### 2b. Get your keys
Go to **Settings → API**. Copy:
- `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ keep server-side only
- Project ID (in the URL: `app.supabase.com/project/<id>`) → `SUPABASE_PROJECT_ID`

### 2c. Run migrations
Install the Supabase CLI if you don't have it:
```bash
npm install -g supabase
```

Link to your project and push migrations:
```bash
supabase login
supabase link --project-ref <SUPABASE_PROJECT_ID>
supabase db push
```

This runs `001_initial_schema.sql` and `002_schema_updates.sql` in order.

### 2d. Configure Auth (OTP email)
In **Authentication → Providers → Email**:
- ✅ Enable email provider
- ✅ OTP (magic link) — keep enabled (Supabase uses this for OTP flow)
- Set **OTP expiry** to `600` seconds (10 min — matches UI copy)
- Set **Rate limit** for OTP sends to a reasonable value (e.g. 5/hour per email)

In **Authentication → URL Configuration**:
- Site URL: `http://localhost:3000` (update to prod URL after Vercel deploy)
- Redirect URLs: add `https://your-domain.com/**` after deploy

### 2e. Set up custom SMTP (Resend) — do after Step 3
In **Settings → Auth → SMTP Settings**:
- Host: `smtp.resend.com`
- Port: `465`
- User: `resend`
- Password: your Resend API key (from Step 3)
- Sender name: `Foundly`
- Sender email: `noreply@yourdomain.com`

This makes Supabase Auth send OTP emails via Resend instead of their default mailer.

### 2f. Set up the case notification webhook
In **Database → Webhooks → Create webhook**:
- Name: `case_opened_notify`
- Table: `recovery_cases`
- Events: ✅ INSERT
- URL: `https://your-vercel-url.vercel.app/api/cases/notify`
- Headers:
  - `Authorization`: `Bearer <SUPABASE_WEBHOOK_SECRET>` (generate a random secret, save it)

### 2g. Regenerate TypeScript types
After migrations are applied:
```bash
supabase gen types typescript --project-id <SUPABASE_PROJECT_ID> > src/types/database.ts
```

---

## 3. Resend

**Goal:** Transactional email for OTP codes and case notifications.

1. [resend.com](https://resend.com) → Sign up
2. **Domains → Add domain** → enter your domain (e.g. `foundly.app`)
3. Add the DNS records Resend gives you (TXT + MX/CNAME) — takes 5–30 min to verify
4. **API Keys → Create API key** → name it `foundly-production`
5. Copy the key → `RESEND_API_KEY`

> **If you don't have a domain yet:** Use Resend's test address (`onboarding@resend.dev`) temporarily for dev — just update `from` in `src/app/api/cases/notify/route.ts`.

---

## 4. Vercel

**Goal:** Deploy the Next.js app with zero config.

1. [vercel.com](https://vercel.com) → **Add New → Project**
2. Import your GitHub repo `foundly`
3. Framework: **Next.js** (auto-detected)
4. **Environment Variables** — add all of these:

```
NEXT_PUBLIC_SUPABASE_URL        = (from Step 2b)
NEXT_PUBLIC_SUPABASE_ANON_KEY   = (from Step 2b)
SUPABASE_SERVICE_ROLE_KEY       = (from Step 2b)
SUPABASE_PROJECT_ID             = (from Step 2b)
SUPABASE_WEBHOOK_SECRET         = (generate: openssl rand -hex 32)
RESEND_API_KEY                  = (from Step 3)
NEXT_PUBLIC_APP_URL             = https://your-project.vercel.app
```

5. Click **Deploy** — first deploy takes ~2 min

6. After deploy, update Supabase:
   - Auth → URL Configuration → Site URL → your Vercel URL
   - Webhook URL → your Vercel URL + `/api/cases/notify`

---

## 5. Local dev `.env.local`

Create this file in the project root (it's gitignored):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_PROJECT_ID=your-project-id
SUPABASE_WEBHOOK_SECRET=your-webhook-secret
RESEND_API_KEY=re_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Then start the dev server:
```bash
npm install
npm run dev
```

---

## Checklist

- [ ] GitHub repo created and code pushed
- [ ] Supabase project created
- [ ] Migrations applied (`supabase db push`)
- [ ] Supabase Auth OTP configured (10 min expiry)
- [ ] Resend account + domain verified
- [ ] Supabase SMTP pointed at Resend
- [ ] Vercel project deployed
- [ ] All env vars set in Vercel
- [ ] Supabase webhook pointing at Vercel URL
- [ ] Supabase Auth Site URL updated to Vercel URL
- [ ] TypeScript types regenerated from live schema

---

## After all this works

Next things to build (in priority order):
1. `/dashboard/items` — CRUD for items
2. `/dashboard/tags` — tag list, deactivate a tag
3. `/dashboard/settings` — name, notification prefs, recovery email, data export, account deletion
4. Admin tool to provision tags (insert serial + activation_token rows)
5. RTL layout pass (Hebrew is the primary locale)

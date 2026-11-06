# Optional cloud sync (Supabase)

The game is fully playable offline. Cloud sync adds:
- the same save on phone and computer (Settings → Cloud → Upload / Download), and
- **private photos** that are never bundled in the APK, only shown after sign-in through short-lived signed URLs.

## Setup (about 10 minutes)
1. Create a Supabase project.
2. **Authentication → Sign In / Providers:**
   - enable **Email** (magic link),
   - **disable “Allow new users to sign up”**,
   - keep **anonymous sign-ins disabled**.
3. **Authentication → Users → Add user:** create exactly two users, her email and yours.
4. **Authentication → URL Configuration:** add your site URL (e.g. `http://localhost:5173`) to the redirect URLs.
   For the Android app, sign in on the web build or add a deep link later.
5. **SQL editor:** run `supabase/migrations/20261105000000_evermore_init.sql`. It creates:
   - `public.saves`, with RLS so each user can only read, insert and update **their own** row (no deletes), and
     anonymous sessions are rejected;
   - the private bucket `memories`, readable only by signed-in non-anonymous users. Uploads are done by you in the
     dashboard, so the app has no write access to storage at all.
6. Copy `.env.example` to `.env` and fill in the project URL and the **publishable** key (or legacy anon key).
   **Never** use the service-role / secret key; the app refuses to start if one is detected.
7. `npm run dev` → Settings → Cloud → sign in with the magic link.

## Private photos
Upload to the `memories` bucket in the dashboard (e.g. `photos/first-date.jpg`), then in `src/content/personal.ts` set:
```ts
image: 'cloud:photos/first-date.jpg'
```

## AI chat replies (Groq)
With this set up, when she's signed in (Settings → Cloud), his replies in the phone's Messages app come from an AI
that knows what's happening in the game (his work day and the lunch she packed, your pets, the garden, the time of
day…). Good mornings, reminders and work messages stay scripted. If she isn't signed in, is offline, or has used
today's **50** replies, the chat quietly falls back to the scripted replies.

The Groq key is **never** put in the app: it lives only on Supabase as a secret, used by the `ai-chat` Edge
Function. Only signed-in users (just the two of you) can call it, and the daily count is kept on the server.

1. Get a key at <https://console.groq.com/keys>.
2. **SQL editor:** run `supabase/migrations/20261107000000_ai_chat.sql` (creates the private `ai_usage` counter).
3. Deploy the function and set the secret, from this folder (replace `<project-ref>`; it's in your project URL):
   ```sh
   npx supabase login
   npx supabase secrets set GROQ_API_KEY=your-groq-key --project-ref <project-ref>
   npx supabase functions deploy ai-chat --project-ref <project-ref>
   ```
   Optional secrets: `GROQ_MODEL` (default `llama-3.3-70b-versatile`), `AI_DAILY_CAP` (default `50`).
   Keep JWT verification **on** (the default) for this function.
4. Sign in on her device (Settings → Cloud) and send a message in the phone.

If he ever gets asked sincerely whether it's really you, the AI answers honestly and gently (it's the game's version
of you); otherwise it stays in character. You can change the voice in `supabase/functions/ai-chat/index.ts`
(`systemPrompt`) and redeploy.

## Security notes
- Row Level Security is enabled on every table. Policies use `(select auth.uid()) = user_id` together with `TO authenticated`.
- Sign-ups are closed, so “authenticated” means just the two of you.
- Text in `personal.ts` is still bundled into the app. If even letters must stay private, ask to move them to a
  `personal_entries` table with the same RLS pattern.

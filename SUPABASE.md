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

## Security notes
- Row Level Security is enabled on every table. Policies use `(select auth.uid()) = user_id` together with `TO authenticated`.
- Sign-ups are closed, so “authenticated” means just the two of you.
- Text in `personal.ts` is still bundled into the app. If even letters must stay private, ask to move them to a
  `personal_entries` table with the same RLS pattern.

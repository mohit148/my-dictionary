# My Dictionary

A personal dictionary: Next.js (App Router) + TypeScript + Tailwind + Supabase (Postgres, Auth, RLS).

## Setup
1. Create a project at supabase.com.
2. SQL editor: run `supabase/migrations/0001_init.sql`, then `supabase/migrations/0002_update_word.sql` (once each).
3. Authentication -> Users -> **Add user -> Create new user**: pick your email and a password, and tick **Auto Confirm User**. That password is what you type to open the app.
4. Authentication -> Sign In / Providers: turn **off** "Allow new users to sign up", so nobody else can create an account on your project.
5. `cp .env.local.example .env.local` and fill in the project URL, the anon key (Project settings -> API) and `APP_EMAIL` (the email from step 3). Never use the service-role key.
6. `npm install && npm run dev`, open http://localhost:3000, enter your password, then go to Import / Export and upload your JSON.

Deploy to Vercel: push to GitHub, import the repo in Vercel, and add the same three environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `APP_EMAIL`). The deployed site asks for the same password.

## Features
Add/edit/delete words, favorites, categories, differences, JSON import with preview (add-only or merge, multi-file, never overwrites), JSON export in the same format.

## Tests
`npx tsx scripts/test-import.ts [path-to-json]` and `npx tsx scripts/test-db.mts [path-to-json]` (runs the migrations in an in-process Postgres).

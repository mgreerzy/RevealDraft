# RevealDraft

Web-based live softball draft app with Commissioners, Coaches, Administrators, and TV view mode.

## Quick start
1. Create a Supabase project.
2. Open Supabase SQL Editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env` and add your Supabase URL and anon key.
4. Run:
   ```bash
   npm install
   npm run dev
   ```
5. Deploy to Vercel. Add the same env vars in Vercel.

## First admin
After creating your user in Supabase Auth, run this in Supabase SQL Editor, replacing the email:
```sql
update public.profiles set role='admin' where email='you@example.com';
```

## Notes
- Realtime requires Supabase Realtime enabled for the included tables.
- Email sending is stubbed in `supabase/functions/send-results`; connect Resend, SendGrid, or SMTP before production.

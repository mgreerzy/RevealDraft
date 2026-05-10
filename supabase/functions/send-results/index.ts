// Supabase Edge Function placeholder. Connect Resend/SendGrid/SMTP before production.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
serve(async (req) => {
  const payload = await req.json()
  console.log('Send RevealDraft results email:', payload)
  return new Response(JSON.stringify({ ok: true, message: 'Email provider not configured yet.' }), { headers: { 'Content-Type': 'application/json' } })
})

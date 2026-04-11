// ─────────────────────────────────────────────
// QUEST — Edge Function: send-push
// Called fire-and-forget from createNotification()
// Sends a Web Push to every device registered for userId
// ─────────────────────────────────────────────
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// VAPID keys set via Supabase Dashboard → Edge Functions → Secrets
webpush.setVapidDetails(
  'mailto:admin@questhobbystore.com',
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

// Service-role client to read push_subscriptions (bypasses RLS)
const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { userId, title, body, data } = await req.json()
    if (!userId || !title) return new Response('ok', { headers: corsHeaders })

    // Fetch all registered devices for this user
    const { data: subs, error } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (error || !subs?.length) return new Response('ok', { headers: corsHeaders })

    const payload = JSON.stringify({
      title,
      body: body ?? '',
      data: data ?? {},
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
    })

    // Send to all devices; silently remove expired subscriptions
    await Promise.allSettled(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          )
        } catch (err: any) {
          // 410 Gone = subscription expired or user revoked permission
          if (err?.statusCode === 410 || err?.statusCode === 404) {
            await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
          }
        }
      })
    )

    return new Response('ok', { headers: corsHeaders })
  } catch (e) {
    console.error('send-push error:', e)
    return new Response(String(e), { status: 500, headers: corsHeaders })
  }
})

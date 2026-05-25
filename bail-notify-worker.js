// Cloudflare Worker — 보석금 신청 디스코드 웹훅 프록시
// 별도 채널/웹훅으로 분리하기 위해 기존 guild-images 워커와 분리
//
// 환경변수 (Cloudflare 대시보드 또는 `wrangler secret put`):
//   DISCORD_BAIL_WEBHOOK_URL — 보석금 알림 받을 디스코드 웹훅 URL (Secret)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }
    if (!env.DISCORD_BAIL_WEBHOOK_URL) {
      return json({ error: 'DISCORD_BAIL_WEBHOOK_URL not configured' }, 500);
    }
    try {
      const payload = await request.json();
      const dcRes = await fetch(env.DISCORD_BAIL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!dcRes.ok) {
        const text = await dcRes.text();
        return json({ error: 'Discord rejected', status: dcRes.status, detail: text }, 502);
      }
      return json({ success: true });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};

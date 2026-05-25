// Cloudflare Worker — 메애기(meaegi.com) CORS 프록시
// 이중길드 감사용 — 캐릭터 정보 + 본캐/부캐 전체 목록을 받아옴
//
// 엔드포인트:
//   GET /{nickname}                — 캐릭 기본 정보 (champion_name 등) → meaegi /character/{nick}
//   GET /{nickname}/alt            — 본캐 + 부캐 전체 목록 (guildName 포함) → meaegi /character/{nick}/alt
//     선택: ?ocid=xxx 를 그대로 전달 (없으면 메애기가 캐싱된 ocid 사용)
//   GET /?nick={nick}              — 쿼리스트링 방식 (구버전 호환)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function passthrough(upstreamUrl) {
  const res = await fetch(upstreamUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json,text/html;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9',
    },
  });
  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      ...corsHeaders,
      'Content-Type': res.headers.get('content-type') || 'application/json; charset=utf-8',
    },
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    const url = new URL(request.url);
    let path = url.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!path) path = (url.searchParams.get('nick') || '').trim();
    if (!path) return json({ error: 'nickname required' }, 400);

    // /{nick}/alt → 본캐+부캐 목록
    const altMatch = path.match(/^(.+)\/alt$/);
    if (altMatch) {
      const nick = altMatch[1];
      const ocid = url.searchParams.get('ocid') || '';
      const date = url.searchParams.get('date') || 'realtime';
      const upstream = `https://meaegi.com/api/maplestory/character/${encodeURIComponent(nick)}/alt?type=alt&ocid=${encodeURIComponent(ocid)}&date=${encodeURIComponent(date)}`;
      return passthrough(upstream);
    }

    // /{nick} → 캐릭 기본 정보 (champion_name 추출용, 구버전 호환)
    const nick = path;
    const upstream = `https://meaegi.com/api/maplestory/character/${encodeURIComponent(nick)}`;
    return passthrough(upstream);
  },
};

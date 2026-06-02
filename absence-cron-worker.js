// =====================================================
// Cloudflare Worker — 장기 부재 면제 자동 관리 (Cron)
// 매주 수요일 23:00 KST → 디스코드 운영진 채널 알림 (기존 면제신청 워커 재사용)
//
// 환경변수 (Cloudflare 대시보드 또는 wrangler secret put):
//   SUPABASE_URL          — https://luglshrfkkeacmefnvlm.supabase.co (Plain)
//   SUPABASE_SERVICE_KEY  — RLS 우회용 service_role 키 (Secret)
//   MANUAL_TRIGGER_KEY    — 수동 실행 비밀 키 (Secret)
//
// 디스코드 알림: 기존 면제 신청 워커(guild-images)의 /discord-notify 재사용
// → 별도 Webhook URL Secret 등록 불필요
// =====================================================

const R2_PROXY_URL = 'https://guild-images.hongsb9912.workers.dev/discord-notify';
const R2_PROXY_KEY = 'guild-manager-r2-key-2026';

const ROLE_MACARON = '692099309172162570';
const ROLE_DAKWAJU = '692091131646705716';

function kstNow() {
  // 현재 UTC를 KST로 변환
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}
function kstDateStr(d) { return d.toISOString().slice(0, 10); }  // YYYY-MM-DD (KST 기준)

// 이번 주차 라벨 (수~화 또는 목~수, 가이드 형식 맞춤: "YY-MM-DD(목) ~ YY-MM-DD(수)")
function weekLabel(now) {
  // 이번 주 수요일(또는 어제) ~ 다음 수요일 형태
  const day = now.getUTCDay();  // 0=일 1=월 ... 6=토
  // 가장 가까운 과거 목요일 찾기 (KST 기준)
  const daysSinceThu = (day - 4 + 7) % 7;  // 4=목
  const thu = new Date(now); thu.setUTCDate(now.getUTCDate() - daysSinceThu);
  const wed = new Date(thu); wed.setUTCDate(thu.getUTCDate() + 6);
  const fmt = d => `${String(d.getUTCFullYear()).slice(2)}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  const dayKor = ['일','월','화','수','목','금','토'];
  return `${fmt(thu)}(${dayKor[thu.getUTCDay()]}) ~ ${fmt(wed)}(${dayKor[wed.getUTCDay()]})`;
}

async function supa(env, path, options = {}) {
  const headers = {
    'apikey': env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...(options.headers || {})
  };
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, { ...options, headers });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text()}`);
  return res.json();
}

const REASON_EMOJI = {
  '결혼·신행': '💒', '본인 입원·수술': '🏥', '가족 입원·간병': '👨‍👩‍👧',
  '본인·가족 상사': '🕯️', '임신·출산·산후': '🤰', '군 입대·휴가': '🪖',
  '시험 준비': '📚', '장기 출장·해외': '✈️', '이사·정착': '📦',
  '정신건강·번아웃': '🧠', '이직·적응': '💼', '기타': '✏️'
};
function reasonEmoji(rt) {
  for (const [k, v] of Object.entries(REASON_EMOJI)) if (rt?.includes(k.split('·')[0])) return v;
  return '✏️';
}

async function sendDiscord(env, items, label) {
  const lines = items.map(it => {
    const e = reasonEmoji(it.reason_type);
    return `**${it.member_name}**\n사유: ${e} ${it.reason_type}${it.reason_detail ? ' — ' + it.reason_detail : ''}\n기간: ${it.start_date} ~ ${it.end_date}${it.memo ? '\n메모: ' + it.memo : ''}`;
  }).join('\n\n');

  const payload = {
    content: `<@&${ROLE_MACARON}> <@&${ROLE_DAKWAJU}> 🔔 이번 주(${label}) 직위 조정 시 강등 보호 멤버 (${items.length}명)`,
    allowed_mentions: { roles: [ROLE_MACARON, ROLE_DAKWAJU] },
    embeds: [{
      title: `🔒 강등 보호 ${items.length}명`,
      description: lines,
      color: 0xfbbf24,
      footer: { text: '직위 자동 부여 시 점수 0이어도 직위 유지해주세요' },
      timestamp: new Date().toISOString()
    }]
  };
  const res = await fetch(R2_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': R2_PROXY_KEY },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`discord proxy ${res.status}: ${await res.text()}`);
}

async function runWeeklyNotification(env) {
  const now = kstNow();
  const today = kstDateStr(now);
  const label = weekLabel(now);

  // 1. 종료된 면제 자동 ended 처리
  await supa(env, `/absence_exemptions?status=eq.approved&end_date=lt.${today}`, {
    method: 'PATCH', body: JSON.stringify({ status: 'ended' })
  });

  // 2. 이번 주 active 면제 (승인 + 시작<=오늘 + 종료>=오늘 + 이 주차 아직 알림 안 보냄)
  const list = await supa(env,
    `/absence_exemptions?status=eq.approved&start_date=lte.${today}&end_date=gte.${today}&select=*`
  );
  const toNotify = list.filter(it => !(it.notified_weeks || []).includes(label));

  if (toNotify.length === 0) {
    return { sent: 0, label, message: '이번 주 신규 알림 대상 없음' };
  }

  // 3. 디스코드 알림
  await sendDiscord(env, toNotify, label);

  // 4. notified_weeks 업데이트
  for (const it of toNotify) {
    const next = [...(it.notified_weeks || []), label];
    await supa(env, `/absence_exemptions?id=eq.${it.id}`, {
      method: 'PATCH', body: JSON.stringify({ notified_weeks: next })
    });
  }

  return { sent: toNotify.length, label, members: toNotify.map(it => it.member_name) };
}

export default {
  // 매주 수 23:00 KST = UTC 14:00 수 (cron: 0 14 * * 3)
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runWeeklyNotification(env).catch(e => console.error('cron error:', e)));
  },

  // 수동 트리거용 GET 엔드포인트 (?key=비밀키 로 보호)
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.searchParams.get('key') !== (env.MANUAL_TRIGGER_KEY || 'change-me')) {
      return new Response('forbidden', { status: 403 });
    }
    try {
      const result = await runWeeklyNotification(env);
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response('error: ' + e.message, { status: 500 });
    }
  }
};

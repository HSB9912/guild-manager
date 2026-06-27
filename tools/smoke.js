#!/usr/bin/env node
/* 배포 전 데이터계층 스모크 테스트 — 사용: node tools/smoke.js
   잡아내는 사고:
   ① app.js FACTIONS key ↔ DB members.guild 불일치 (길드명 마이그레이션 후 멤버가 안 뜨던 사고)
   ② 핵심 데이터(멤버/수로)가 비어있음
   ③ 한 길드 멤버가 1000행 넘음 → 페이지네이션 안 한 단일 쿼리가 잘릴 위험(전환 필요 신호) */
const fs = require('fs'), path = require('path');
const SUPA = 'https://luglshrfkkeacmefnvlm.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z2xzaHJma2tlYWNtZWZudmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNjE0NTIsImV4cCI6MjA4NzYzNzQ1Mn0.LrJ-ejXJGqVGzrJyL5nFW45J92-MxrcKuEpE2EGNsIo';
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const cnt = async (table, filter) => {
  const r = await fetch(`${SUPA}/rest/v1/${table}?select=id${filter ? '&' + filter : ''}`, { headers: { ...H, Prefer: 'count=exact', Range: '0-0' } });
  return Number((r.headers.get('content-range') || '0/0').split('/')[1]) || 0;
};
(async () => {
  let fail = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fail++; };
  console.log('— 데이터계층 스모크 —');

  // ① FACTIONS key 파싱 + DB 일치
  const src = fs.readFileSync(path.join(__dirname, '..', 'assets', 'app.js'), 'utf8');
  const i = src.indexOf('const FACTIONS');
  const block = src.slice(i, i + 700);
  const keys = [...block.matchAll(/key:'([^']+)'/g)].map(m => m[1]);
  ok(keys.length === 3, `FACTIONS 키 3개 파싱 → ${keys.join(', ')}`);
  for (const k of keys) {
    const c = await cnt('members', 'guild=eq.' + encodeURIComponent(k));
    ok(c > 0, `members guild='${k}' = ${c}행 (>0 — 코드키가 DB값과 일치)`);
    ok(c < 1000, `members guild='${k}' = ${c} < 1000 (단일 쿼리 안전 · 넘으면 dbAll 전환)`);
  }

  // ② 수로 데이터 존재 (메인 길드)
  const main = keys[0] || '버니';
  ok((await cnt('suro_scores', 'guild=eq.' + encodeURIComponent(main))) > 0, `suro_scores '${main}' 점수 존재`);
  ok((await cnt('suro_periods')) > 0, `suro_periods 회차 존재`);

  console.log(fail ? `\n❌ 스모크 ${fail}개 실패 — 배포 보류` : '\n✅ 스모크 전부 통과');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('스모크 실행 오류:', e.message); process.exit(2); });

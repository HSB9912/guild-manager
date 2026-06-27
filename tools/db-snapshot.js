#!/usr/bin/env node
/* DB 스냅샷 백업 — 파괴적 작업(DELETE/대량 UPDATE) 전에 반드시 실행.
   사용: node tools/db-snapshot.js  → backups/snapshot-<ts>.json (members·suro_scores·suro_periods·site_config 전체)
   복구는 이 JSON을 보고 수동 UPSERT/DELETE. (backups/ 는 .gitignore — 멤버 데이터라 커밋 안 함) */
const fs = require('fs'), path = require('path');
const SUPA = 'https://luglshrfkkeacmefnvlm.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z2xzaHJma2tlYWNtZWZudmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNjE0NTIsImV4cCI6MjA4NzYzNzQ1Mn0.LrJ-ejXJGqVGzrJyL5nFW45J92-MxrcKuEpE2EGNsIo';
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
async function all(table) {
  let out = [], from = 0;
  for (;;) {
    const r = await fetch(`${SUPA}/rest/v1/${table}?select=*&order=id.asc`, { headers: { ...H, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`${table} ${r.status} ${(await r.text()).slice(0, 120)}`);
    const d = await r.json(); out = out.concat(d);
    if (d.length < 1000) break; from += 1000;
  }
  return out;
}
(async () => {
  const snap = { at: new Date().toISOString(), tables: {} };
  for (const t of ['members', 'suro_scores', 'suro_periods', 'site_config']) {
    snap.tables[t] = await all(t);
    console.log(`  ${t}: ${snap.tables[t].length}행`);
  }
  const dir = path.join(__dirname, '..', 'backups'); fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, 'snapshot-' + snap.at.replace(/[:.]/g, '-') + '.json');
  fs.writeFileSync(fp, JSON.stringify(snap));
  console.log(`✅ 백업 저장: backups/${path.basename(fp)} (${(fs.statSync(fp).size / 1048576).toFixed(1)}MB)`);
})().catch(e => { console.error('❌ 백업 실패:', e.message); process.exit(1); });

/* ===== 버니 길드 공통 셸 (사이드바·헤더·다크토글) ===== */
/* 각 페이지는 <div id="app" data-page="KEY"></div> 하나만 두고 이 파일을 로드한다. */

/* ============================================================
 *  백엔드 연결 지점 — 백엔드 작업은 여기서부터
 *  (기존 길드매니저와 동일한 Supabase 프로젝트 재사용 예정)
 * ============================================================ */
const BACKEND = {
  SUPABASE_URL: 'https://luglshrfkkeacmefnvlm.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1Z2xzaHJma2tlYWNtZWZudmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNjE0NTIsImV4cCI6MjA4NzYzNzQ1Mn0.LrJ-ejXJGqVGzrJyL5nFW45J92-MxrcKuEpE2EGNsIo',
  db: null, // TODO: supabase-js 로드 후 createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
};

/* 권한: 'guest'(미로그인) | 'member'(로그인) | 'admin'(운영진)
 * 기존 길드매니저와 동일 — getSession → admin_whitelist/admin_auth 조회.
 * 개발용 강제 전환: localStorage('bunny_role')='admin'|'member'|'guest' */
const CURRENT = { role:'guest', email:null, name:null };
function isAdmin(){ return CURRENT.role === 'admin'; }
function isLoggedIn(){ return CURRENT.role !== 'guest'; }
window.isAdmin = isAdmin;

/* supabase-js UMD 동적 로드 (페이지마다 21개 HTML 안 고치려고 여기서 주입) */
function loadSupabase(){
  return new Promise((res,rej)=>{
    if(window.supabase) return res();
    const s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.onload=res; s.onerror=()=>rej(new Error('supabase 로드 실패'));
    document.head.appendChild(s);
  });
}

/* 세션·역할 해석 (admin_whitelist 조회는 세션당 1번만, sessionStorage 캐시) */
async function resolveAuth(){
  const dev = localStorage.getItem('bunny_role'); // 개발 강제 전환
  let session=null;
  try { session=(await BACKEND.db.auth.getSession()).data.session; } catch(e){}
  if(!session){ CURRENT.role = dev||'guest'; return; }
  CURRENT.email = session.user.email;
  CURRENT.name  = session.user.user_metadata?.full_name || session.user.user_metadata?.name || CURRENT.email;
  const cache = JSON.parse(sessionStorage.getItem('bunny_auth')||'null');
  if(cache && cache.email===CURRENT.email){ CURRENT.role = dev||cache.role; return; }
  let role='member';
  try{ const {data:wl}=await BACKEND.db.from('admin_whitelist').select('status').eq('email',CURRENT.email).maybeSingle(); if(wl&&wl.status==='approved') role='admin'; }catch(e){}
  if(role!=='admin'){ try{ const {data:aa}=await BACKEND.db.from('admin_auth').select('email').eq('email',CURRENT.email).maybeSingle(); if(aa) role='admin'; }catch(e){} }
  sessionStorage.setItem('bunny_auth', JSON.stringify({email:CURRENT.email, role}));
  CURRENT.role = dev||role;
}

window.bunnyLogin  = ()=> BACKEND.db.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: location.href.split('#')[0] } });
window.bunnyLogout = async ()=>{ try{await BACKEND.db.auth.signOut();}catch(e){} sessionStorage.removeItem('bunny_auth'); localStorage.removeItem('bunny_role'); location.reload(); };

/* 대시보드 데이터 — 지금은 목(mock). 백엔드는 이 객체만 실데이터로 교체.
 * TODO(백엔드): async function loadDashboard(){ ... supaDb 조회 ... return {...} } */
const MOCK = {
  totalMembers: 48, totalDelta: '+2',
  weeklyAvg: '86.4', attendRate: '94%', attendDelta: '+3%', attendCount: '45/48명 참석',
  joinPending: 3, attendWarn: 5, bailPending: 2,
  weeklyBars: [45,70,55,90,65,100,80],
  members: [
    ['달','달토끼','부길드장','98','7/7','활동중','var(--bunny-deep)','deep'],
    ['초','초코롱','멤버','91','6/7','활동중','var(--bunny-main)','m'],
    ['밤','밤하늘','멤버','74','4/7','주의','var(--amber)','m'],
    ['민','민트우유','신입','88','7/7','활동중','var(--ice)','new'],
    ['구','구름빵','멤버','52','2/7','결석多','#C75050','m'],
    ['별','별사탕','멤버','79','5/7','활동중','var(--bunny-deep)','m'],
  ],
  joinQueue: [
    ['솜','솜사탕','2시간 전 신청','var(--bunny-main)','tone-light'],
    ['감','감자전','5시간 전 신청','var(--ice)','tone-cream'],
    ['노','노른자','어제 신청','var(--bunny-deep)','tone-light'],
  ],
};

/* ============================================================
 *  메뉴 정의 (4그룹 / 21개)  ·  admin:true 그룹은 관리자 전용
 * ============================================================ */
const GROUPS = [
  { label: null, items: [
    { k:'home',        t:'홈',            i:'fa-house' },
    { k:'members',     t:'길드원',        i:'fa-users' },
    { k:'analysis',    t:'수로 분석',     i:'fa-chart-line', star:true },
    { k:'promotion',   t:'승강제·현황',   i:'fa-ranking-star' },
    { k:'suro_reward', t:'수로 보상',     i:'fa-gift' },
    { k:'buddy',       t:'버니버디',      i:'fa-heart' },
    { k:'consulting',  t:'아이템 컨설팅', i:'fa-wand-magic-sparkles' },
    { k:'manual',      t:'사용 안내',     i:'fa-circle-question' },
  ]},
  { label:'멤버 신청', items: [
    { k:'join_form',   t:'가입 신청',          i:'fa-user-plus' },
    { k:'absence_reg', t:'장기부재 캐릭 등록', i:'fa-bed' },
    { k:'bail_form',   t:'보석금 신청',        i:'fa-gem' },
  ]},
  { label:'관리자 운영', lock:true, admin:true, items: [
    { k:'requests',    t:'신청 처리',     i:'fa-inbox', badge:3 },
    { k:'bail',        t:'보석금 관리',   i:'fa-vault' },
    { k:'penalty',     t:'벌점',          i:'fa-flag' },
    { k:'admin_todos', t:'운영진 할 일',  i:'fa-list-check' },
    { k:'absence',     t:'장기부재 면제', i:'fa-plane-departure' },
  ]},
  { label:'관리자 도구', lock:true, admin:true, items: [
    { k:'suro_input',  t:'수로 입력',   i:'fa-keyboard', star:true },
    { k:'role_assign', t:'직위 반영',   i:'fa-arrows-turn-to-dots', star:true },
    { k:'guide_edit',  t:'가이드 편집', i:'fa-pen-to-square' },
    { k:'sync',        t:'동기화',      i:'fa-rotate' },
    { k:'settings',    t:'설정',        i:'fa-gear' },
  ]},
];
const META = {}; GROUPS.forEach(g=>g.items.forEach(it=>META[it.k]={...it, admin:!!g.admin}));
const href = (k)=> k==='home' ? 'index.html' : k + '.html';

/* ============================================================
 *  업데이트 내역 (CHANGELOG)  ·  최신이 맨 위
 *  ★ 사용자 체감 변경을 추가할 때마다 맨 위 블록에 항목 한 줄 추가
 *  type: feat(새기능) · fix(수정) · tweak(개선) · chore(정리)
 * ============================================================ */
const CHANGELOG = [
  { id:'2026-06-26', date:'2026-06-26', items:[
    { t:'fix',  x:'수로 보상 — 점수가 1000건에서 잘려(DB 한 번에 1000행 제한) 상위권 분기평균이 반토막 나고 순위가 뒤집히던 치명 버그 수정. 전체 회차 점수를 나눠 받도록 변경(리케아 5/12→12/12주, 평균이 분석탭과 일치)' },
    { t:'fix',  x:'수로 보상 — 부캐(수로 0점)가 보상 랭킹에 섞여 등급 분포(롤케이크/팬케이크)를 오염시키던 문제 수정. 본캐만 산정(557 → 181명)' },
    { t:'feat', x:'수로 분석 전면 개편(기존 뚠카롱 분석 복원) — 평균순 안정 랭킹 · 최근 4주 비교표 · 주차 변동 · MVP(고득점/떡상/상승률/평균↑) · 길드 총점 추이 · 직업/직위/검색 필터 · 헤더 클릭 정렬' },
    { t:'fix',  x:'수로 분석 상위권 순위가 격변하던 문제 해결 — 기본 정렬을 최근주차 → 평균순으로(이번주 미참자가 평소 등수에서 추락하지 않게)' },
    { t:'feat', x:'수로 입력 — 📷 화면 캡처 OCR 부활. 메이플 길드 컨텐츠 창을 캡처하면 닉네임·지하수로 점수를 자동 인식 → 멤버 이름 매칭 → 현재 회차에 일괄 반영 (스크린샷 이미지 파일 인식도 지원)' },
    { t:'fix',  x:'OCR 인식 엔진·템플릿을 최신 버전으로 갱신(메이플 길드창 UI 변경 대응) — 기존에 안 먹던 화면 인식 정상화' },
  ]},
  { id:'2026-06-25', date:'2026-06-25', items:[
    { t:'feat', x:'버니버디 — 과거 완료 버디팀 19팀 한 번에 가져오기(운영진 "과거 이력 가져오기" 버튼)' },
    { t:'feat', x:'신청 처리 3탭 복원 — 가입 신청 · 아인슈페너(수로 면제) 신청 · 수로 보석금 신청을 한 곳에서 승인/거절' },
    { t:'tweak', x:'주소창·탭 아이콘(파비콘)을 현재 길드 마크로 (🐰버니 / 🐺늑대 / 🐆쿠거), 옛 뚠카롱 아이콘 제거' },
    { t:'feat', x:'수로 입력 — 새 회차(주차) 추가 버튼. 이번 주차 회차가 없으면 안내 배너로 바로 생성' },
  ]},
  { id:'2026-06-23', date:'2026-06-23', items:[
    { t:'feat', x:'길드원 — 헤더 클릭 정렬(활성 기준 강조·오름/내림 토글) + 전체 펼치기. 전체/본캐/부캐 버튼 정리, 이름 정렬은 유니코드순' },
    { t:'feat', x:'수로 입력 — 실시간 동시 입력(여러 운영진 같이 작업·자동 저장·Enter로 다음 칸·검색/미입력만·진행률·누가 입력 중 표시)' },
    { t:'feat', x:'전체 모바일 최적화 — 아이폰·안드로이드 대응(사이드바 드로어 메뉴·카드 1열 정렬)' },
    { t:'feat', x:'운영진 할 일 — 글마다 작성자 이름·작성일 표시' },
    { t:'tweak', x:'사이드바 하단 정모 안내 박스 제거' },
    { t:'feat', x:'운영진 할 일 — 사진을 Ctrl+V로 바로 붙여넣기' },
    { t:'fix',  x:'수로 보상 조각 계산이 0으로 나오던 버그 수정' },
  ]},
  { id:'2026-06-22', date:'2026-06-22', items:[
    { t:'feat',  x:'설정을 폼 편집기로 — 간부도 쉽게 직위·승강 기준 수정' },
    { t:'feat',  x:'3길드 일괄 동기화 + 길드 이동 자동 감지' },
    { t:'tweak', x:'길드원 계정그룹 — 유니온 본캐 자동 묶기' },
    { t:'feat',  x:'길드원 최근주차 수로 그래프 + 점수순 정렬' },
  ]},
  { id:'2026-06-21', date:'2026-06-21', items:[
    { t:'feat',  x:'아이템 컨설팅 게시판 이식' },
    { t:'chore', x:'루트 페이지를 버니로 승격 (옛 화면은 ddun.html 보존)' },
  ]},
  { id:'2026-06-20', date:'2026-06-20', items:[
    { t:'feat',  x:'가입 신청 폼 수로 게이지 — 동적 컷 + 예상 직위·기수' },
  ]},
];
const _CLOG_TYPE = { feat:['새기능','#FFE3ED','#C03364'], fix:['수정','#FDE0E0','#C53636'], tweak:['개선','#FBEFD3','#A9762A'], chore:['정리','#ECE7EA','#857580'] };
function _clogChip(t){ const m=_CLOG_TYPE[t]||_CLOG_TYPE.feat; return `<span style="flex-shrink:0;font-size:10px;font-weight:900;border-radius:7px;padding:2px 7px;margin-top:1px;background:${m[1]};color:${m[2]}">${m[0]}</span>`; }
function _clogLatestId(){ return CHANGELOG.length?CHANGELOG[0].id:''; }
function _clogShortDate(){ const d=_clogLatestId(); return d?d.slice(5).replace('-','.'):''; }
function _clogSeen(){ try{ return localStorage.getItem('bunny_clog_seen')||''; }catch(e){ return ''; } }
function _clogHasNew(){ return _clogLatestId() && _clogSeen()!==_clogLatestId(); }
function _clogMarkSeen(){ try{ localStorage.setItem('bunny_clog_seen', _clogLatestId()); }catch(e){} const d=document.getElementById('clogDot'); if(d)d.remove(); }
function _clogEntryHTML(e, isNew){
  const rows = e.items.map(it=>`<div style="display:flex;gap:8px;align-items:flex-start;padding:5px 0;font-size:13.5px;font-weight:600;line-height:1.5;color:var(--text)">${_clogChip(it.t)}<span>${it.x}</span></div>`).join('');
  return `<div style="position:relative;padding:16px 0 6px">
    <div style="position:absolute;left:-23px;top:20px;width:14px;height:14px;border-radius:99px;background:${isNew?'#E8456B':'var(--bunny-main)'};border:3px solid var(--panel);box-shadow:0 0 0 1px var(--line)"></div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="font-weight:900;font-size:15px">${e.date}</span>${isNew?'<span style="font-size:10px;font-weight:900;color:#fff;background:#E8456B;border-radius:99px;padding:2px 8px">NEW</span>':''}
    </div>${rows}</div>`;
}
window._clogOpen = ()=>{
  let m=document.getElementById('_clogModal');
  if(!m){ m=document.createElement('div'); m.id='_clogModal'; m.style.cssText='position:fixed;inset:0;z-index:2600;background:rgba(60,30,42,.42);display:flex;align-items:center;justify-content:center;padding:24px'; m.onclick=(ev)=>{ if(ev.target===m)_clogClose(); }; document.body.appendChild(m); }
  const tl = CHANGELOG.map((e,i)=>_clogEntryHTML(e, i===0 && _clogHasNew())).join('');
  m.innerHTML = `<div class="panel" style="border-radius:24px;width:520px;max-width:100%;max-height:86vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 60px rgba(120,40,70,.25)">
    <div style="padding:20px 24px 15px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between">
      <h3 style="margin:0;font-weight:900;font-size:18px;display:flex;align-items:center;gap:9px"><i class="fa-solid fa-bullhorn" style="color:var(--bunny-main)"></i> 업데이트 내역</h3>
      <button onclick="_clogClose()" style="border:0;background:var(--panel-2);width:34px;height:34px;border-radius:99px;cursor:pointer;color:var(--dim);font-size:15px"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="scroll" style="padding:8px 26px 22px;overflow:auto"><div style="position:relative;padding-left:26px">
      <div style="position:absolute;left:7px;top:10px;bottom:6px;width:2px;background:var(--line)"></div>${tl}
    </div></div></div>`;
  _clogMarkSeen();
};
window._clogClose = ()=>{ const m=document.getElementById('_clogModal'); if(m)m.remove(); };
window._clogPopupClose = ()=>{ const p=document.getElementById('_clogPopup'); if(p)p.remove(); _clogMarkSeen(); };
window._clogPopupMore = ()=>{ _clogPopupClose(); _clogOpen(); };
function _clogMaybePopup(){
  if(!_clogHasNew() || document.getElementById('_clogPopup')) return;
  const e=CHANGELOG[0];
  const rows=e.items.slice(0,3).map(it=>`<div style="display:flex;gap:9px;align-items:flex-start;font-size:13px;font-weight:600;line-height:1.5;padding:5px 0;color:var(--text)">${_clogChip(it.t)}<span>${it.x}</span></div>`).join('');
  const p=document.createElement('div'); p.id='_clogPopup';
  p.style.cssText='position:fixed;right:26px;bottom:26px;width:340px;z-index:2400;animation:clogIn .35s cubic-bezier(.2,.9,.3,1.2)';
  p.innerHTML=`<div class="panel" style="border-radius:22px;overflow:hidden;box-shadow:0 24px 55px rgba(120,40,70,.3)">
    <div style="background:linear-gradient(135deg,var(--bunny-main),var(--bunny-deep));padding:17px 20px;color:#fff;position:relative">
      <button onclick="_clogPopupClose()" style="position:absolute;top:13px;right:13px;border:0;background:rgba(255,255,255,.25);color:#fff;width:28px;height:28px;border-radius:99px;cursor:pointer;font-size:13px"><i class="fa-solid fa-xmark"></i></button>
      <div style="font-size:25px">🎉</div>
      <h3 style="margin:5px 0 2px;font-weight:900;font-size:18px">업데이트 됐어요!</h3>
      <p style="margin:0;font-size:12px;font-weight:700;opacity:.92">${e.date}</p>
    </div>
    <div style="padding:15px 20px 6px">${rows}</div>
    <div style="padding:12px 20px 18px;display:flex;gap:8px">
      <button onclick="_clogPopupMore()" style="flex:1;border:0;border-radius:12px;padding:11px;font-weight:800;font-size:13px;cursor:pointer;background:var(--panel-2);color:var(--bunny-deep)">자세히</button>
      <button onclick="_clogPopupClose()" style="flex:1;border:0;border-radius:12px;padding:11px;font-weight:800;font-size:13px;cursor:pointer;background:var(--bunny-main);color:#fff">확인했어요</button>
    </div></div>`;
  document.body.appendChild(p);
}
if(!document.getElementById('_clogKeyframes')){ const st=document.createElement('style'); st.id='_clogKeyframes'; st.textContent='@keyframes clogIn{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}'; document.head.appendChild(st); }

/* ---------- 사이드바 (관리자 그룹은 비관리자에게 숨김) ---------- */
function sidebarHTML(active){
  const nav = GROUPS.filter(g=>!g.admin || isAdmin()).map(g=>{
    const head = g.label
      ? `<div class="grp-label" style="margin:16px 0 6px;display:flex;align-items:center;gap:6px;">${g.lock?'<i class="fa-solid fa-lock" style="font-size:8px"></i>':''}${g.label}</div>`
      : '<div style="height:4px"></div>';
    const items = g.items.map(it=>`
      <a href="${href(it.k)}" class="nav-item ${it.k===active?'nav-active':''}" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:12px;">
        <span style="display:flex;align-items:center;gap:12px;"><i class="fa-solid ${it.i}" style="width:20px;text-align:center"></i>${it.t}${it.star?' <i class="fa-solid fa-star" style="font-size:8px;color:var(--amber)"></i>':''}</span>
        ${it.badge?`<span class="chip" style="background:var(--bunny-deep);color:#fff">${it.badge}</span>`:''}
      </a>`).join('');
    return head + items;
  }).join('');
  return `<aside class="sidebar panel" style="border-top:0;border-bottom:0;border-left:0;">
    <div style="display:flex;align-items:center;gap:12px;padding:20px 20px 16px;">
      <div class="tone-rose" style="width:48px;height:48px;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 4px 14px rgba(255,143,171,.4)">🐰</div>
      <div><h1 style="font-weight:900;font-size:18px;margin:0;line-height:1.1">버니 길드</h1><p class="dim" style="font-size:12px;margin:2px 0 0">부길드 늑대 · 쿠거</p></div>
    </div>
    <nav class="scroll" style="display:flex;flex-direction:column;gap:2px;font-size:14px;font-weight:700;padding:0 12px 16px;overflow-y:auto;flex:1;">${nav}</nav>
    <div style="padding:12px;display:flex;flex-direction:column;gap:10px;">
      ${ isLoggedIn()
        ? `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
             <span style="display:flex;align-items:center;gap:8px;overflow:hidden;font-size:12px;font-weight:700;"><span class="tone-rose" style="width:28px;height:28px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;flex-shrink:0">${(CURRENT.name||'?').slice(0,1)}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${CURRENT.name||''}${isAdmin()?' · 운영진':''}</span></span>
             <button onclick="bunnyLogout()" title="로그아웃" style="border:0;background:transparent;cursor:pointer;color:var(--dim)"><i class="fa-solid fa-right-from-bracket"></i></button>
           </div>`
        : `<button onclick="bunnyLogin()" class="panel" style="border-radius:12px;padding:10px;font-weight:800;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;color:var(--text)"><i class="fa-brands fa-google" style="color:var(--bunny-deep)"></i> 운영진 로그인</button>`
      }
      <button onclick="_clogOpen()" class="panel" style="border-radius:13px;padding:11px 13px;cursor:pointer;display:flex;align-items:center;justify-content:space-between;color:var(--text);font-weight:800;font-size:13px">
        <span style="display:flex;align-items:center;gap:9px"><i class="fa-solid fa-bullhorn" style="color:var(--bunny-deep)"></i>업데이트 내역</span>
        <span style="display:flex;align-items:center;gap:7px"><span class="dim" style="font-size:11px;font-weight:700">${_clogShortDate()}</span>${_clogHasNew()?'<span id="clogDot" style="width:8px;height:8px;border-radius:99px;background:#E8456B;box-shadow:0 0 0 3px rgba(232,69,107,.18)"></span>':''}</span>
      </button>
    </div>
  </aside>`;
}

/* ---------- 헤더 ---------- */
function headerHTML(title, sub){
  return `<header style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:28px;padding-right:64px;">
    <div>
      <p class="dim" style="font-size:14px;font-weight:700;margin:0 0 4px">${fac().label} 길드 관리</p>
      <h2 style="font-size:30px;font-weight:900;margin:0">${title} <span class="dim" style="font-size:16px;font-weight:700;margin-left:4px">${sub||''}</span></h2>
    </div>
    <div style="display:flex;align-items:center;gap:8px;">
      <div class="panel" style="border-radius:12px;padding:10px 16px;display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;"><i class="fa-solid fa-magnifying-glass dim"></i><span class="dim">멤버 검색</span></div>
      <div class="tone-rose" style="width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;">길</div>
    </div>
  </header>`;
}

/* ---------- 관리자 전용 접근 차단 ---------- */
function denyHTML(k){
  const m = META[k] || { t:'페이지' };
  return headerHTML(m.t,'') + `<div class="bento">
    <div class="panel" style="border-radius:24px;padding:40px;grid-column:span 2;grid-row:span 2;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
      <div class="tone-cream" style="width:80px;height:80px;border-radius:24px;display:flex;align-items:center;justify-content:center;font-size:30px;color:var(--bunny-deep);margin-bottom:20px"><i class="fa-solid fa-lock"></i></div>
      <h3 style="font-size:24px;font-weight:900;margin:0 0 8px">관리자 전용</h3>
      <p class="dim" style="font-size:14px;font-weight:700;margin:0">운영진 로그인 후 이용할 수 있어요</p>
    </div>
  </div>`;
}

/* ---------- 준비 중(와꾸) 페이지 ---------- */
function placeholderHTML(k){
  const m = META[k];
  return headerHTML(m.t,'') + `<div class="bento">
    <div class="panel" style="border-radius:24px;padding:32px;grid-column:span 2;grid-row:span 2;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
      <div class="tone-rose" style="width:80px;height:80px;border-radius:24px;display:flex;align-items:center;justify-content:center;font-size:30px;color:#fff;box-shadow:0 4px 14px rgba(255,143,171,.4);margin-bottom:20px"><i class="fa-solid ${m.i}"></i></div>
      <h3 style="font-size:24px;font-weight:900;margin:0 0 8px">${m.t}</h3>
      <p class="dim" style="font-size:14px;font-weight:700;margin:0 0 24px">이 페이지는 와꾸만 잡혀있어요 · 곧 작업합니다</p>
      <span class="chip" style="background:var(--bunny-light);color:var(--bunny-deep)">준비 중</span>
    </div>
    <div class="panel tone-light" style="border-radius:24px;padding:24px;display:flex;flex-direction:column;justify-content:space-between;"><span class="dim" style="font-size:14px;font-weight:700">섹션</span><p style="font-size:24px;font-weight:900;margin:0">${m.t}</p></div>
    <div class="panel tone-cream" style="border-radius:24px;padding:24px;display:flex;flex-direction:column;justify-content:space-between;"><span class="dim" style="font-size:14px;font-weight:700">상태</span><p style="font-size:24px;font-weight:900;margin:0">설계 중</p></div>
    <div class="panel" style="border-radius:24px;padding:24px;grid-column:span 2;display:flex;align-items:center;gap:16px;">
      <i class="fa-solid fa-screwdriver-wrench" style="font-size:24px;color:var(--bunny-main)"></i>
      <div><p style="font-weight:900;margin:0">다음 단계</p><p class="dim" style="font-size:14px;font-weight:700;margin:2px 0 0">디자인 와꾸 확정 후 이 화면 내용물 채우기</p></div>
    </div>
  </div>`;
}

/* ---------- 홈 대시보드 (G 벤토) — 실데이터 ---------- */
async function buildHome(){
  const [memCnt, joinPend, bailPend, periodsR, membersR, joinsR] = await Promise.all([
    db().from('members').select('id',{count:'exact',head:true}).eq('guild',GUILD).eq('is_main',true),
    db().from('join_requests').select('id',{count:'exact',head:true}).or('status.is.null,status.eq.pending'),
    db().from('bail_requests').select('id',{count:'exact',head:true}).in('status',['pending','hold']),
    db().from('suro_periods').select('id,period_label').order('start_date',{ascending:false}).limit(1),
    db().from('members').select('id,name,role').eq('guild',GUILD).eq('is_main',true).limit(3000),
    db().from('join_requests').select('id,nickname,job,suro_score,created_at').or('status.is.null,status.eq.pending').order('created_at',{ascending:false}).limit(5),
  ]);
  const totalMem=memCnt.count||0, joinPending=joinPend.count||0, bailPending=bailPend.count||0;
  const memMap={}; (membersR.data||[]).forEach(m=>memMap[m.id]={name:m.name,role:m.role});
  const pid=periodsR.data?.[0]?.id; const periodLabel=periodsR.data?.[0]?.period_label||'';
  let avg=0, partRate=0, partCnt=0, warn=0, top=[], buckets=[0,0,0,0,0];
  if(pid){
    const {data:scores}=await db().from('suro_scores').select('member_id,score').eq('guild',GUILD).eq('period_id',pid).limit(4000);
    const list=(scores||[]).map(s=>({name:memMap[s.member_id]?.name||('#'+s.member_id),role:memMap[s.member_id]?.role||'',score:Number(s.score)||0})).sort((a,b)=>b.score-a.score);
    const sum=list.reduce((a,b)=>a+b.score,0); avg=list.length?Math.round(sum/list.length):0;
    warn=list.filter(x=>x.score===0).length; partCnt=list.filter(x=>x.score>0).length; partRate=list.length?Math.round(partCnt/list.length*100):0;
    top=list.slice(0,6);
    list.forEach(x=>{ const s=x.score; buckets[s>=90000?4:s>=70000?3:s>=50000?2:s>=30000?1:0]++; });
  }
  const fmt=(n)=>(Number(n)||0).toLocaleString();
  const stChip=(sc)=> sc===0?'<span class="chip" style="background:var(--bad-bg);color:var(--bad-tx)">미참</span>':sc<30000?'<span class="chip" style="background:var(--warn-bg);color:var(--warn-tx)">주의</span>':'<span class="chip" style="background:var(--ok-bg);color:var(--ok-tx)">활동중</span>';
  const tbody=top.length?top.map(r=>`<tr style="border-bottom:1px solid var(--line)">
    <td style="padding:12px 8px;font-weight:700;display:flex;align-items:center;gap:8px;"><span style="width:28px;height:28px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:900;background:${avatarColor(r.name)}">${(r.name||'?').slice(0,1)}</span>${escHtml(r.name)}</td>
    <td>${memRoleChip(r.role||'-')}</td><td style="text-align:center;font-weight:900">${fmt(r.score)}</td><td style="text-align:center;padding-right:8px">${stChip(r.score)}</td></tr>`).join('')
    :'<tr><td colspan="4" class="dim" style="padding:24px;text-align:center;font-weight:700">점수 데이터 없음</td></tr>';
  const maxB=Math.max(1,...buckets);
  const bars=buckets.map((b,i)=>`<div style="flex:1;border-radius:8px 8px 0 0;height:${Math.max(6,b/maxB*100)}%;background:${i>=3?'var(--bunny-main)':i===2?'var(--bunny-light)':'var(--bunny-deep)'}" title="${b}명"></div>`).join('');
  const joins=joinsR.data||[];
  const queue=joins.length?joins.map(r=>`<div class="tone-light" style="display:flex;align-items:center;justify-content:space-between;border-radius:12px;padding:10px 16px;">
      <div style="display:flex;align-items:center;gap:12px;"><span style="width:32px;height:32px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:900;background:${avatarColor(r.nickname)}">${(r.nickname||'?').slice(0,1)}</span><div><p style="font-size:14px;font-weight:700;margin:0">${escHtml(r.nickname||'-')}</p><p class="dim" style="font-size:11px;margin:0">${escHtml(r.job||'')} · 수로 ${escHtml(r.suro_score||'-')}</p></div></div>
      <a href="requests.html" class="chip" style="background:var(--bunny-light);color:var(--bunny-deep);text-decoration:none">심사 →</a>
    </div>`).join('')
    :'<div class="dim" style="padding:24px;text-align:center;font-weight:700">대기 중인 가입 신청이 없어요</div>';

  return headerHTML('대시보드','길드 현황 한눈에 보기') + `<div class="bento">
    <div class="panel tone-rose" style="border-radius:24px;padding:24px;color:#fff;display:flex;flex-direction:column;justify-content:space-between;">
      <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:14px;font-weight:700;opacity:.9">총 멤버 (본캐)</span><i class="fa-solid fa-users" style="opacity:.8"></i></div>
      <div><p style="font-size:48px;font-weight:900;line-height:1;margin:0">${totalMem}</p><p style="font-size:12px;font-weight:700;margin:8px 0 0;opacity:.9">버니 길드</p></div>
    </div>
    <div class="panel tone-light" style="border-radius:24px;padding:24px;display:flex;flex-direction:column;justify-content:space-between;">
      <div style="display:flex;align-items:center;justify-content:space-between"><span class="dim" style="font-size:14px;font-weight:700">주간 평균점수</span><i class="fa-solid fa-star" style="color:var(--bunny-main)"></i></div>
      <div><p style="font-size:36px;font-weight:900;line-height:1;margin:0">${fmt(avg)}</p><p class="dim" style="font-size:11px;font-weight:700;margin:6px 0 0">${escHtml(periodLabel.slice(0,17))}</p></div>
    </div>
    <div class="panel tone-cream" style="border-radius:24px;padding:24px;display:flex;align-items:center;gap:20px;">
      <div class="donut" style="width:80px;height:80px;border-radius:999px;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:conic-gradient(var(--bunny-main) 0 ${partRate}%, var(--line) ${partRate}% 100%)"><div style="width:56px;height:56px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:var(--panel)"><span style="font-weight:900;font-size:18px">${partRate}%</span></div></div>
      <div><p class="dim" style="font-size:14px;font-weight:700;margin:0">수로 참여율</p><p class="dim" style="font-size:12px;margin:4px 0 0">참여 <span style="font-weight:700;color:var(--bunny-deep)">${partCnt}</span>명</p><p class="dim" style="font-size:12px;margin:2px 0 0">미참 ${warn}명</p></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:18px;">
      <div class="panel tone-light" style="border-radius:24px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex:1"><div><p class="dim" style="font-size:12px;font-weight:700;margin:0">가입 대기</p><p style="font-size:24px;font-weight:900;margin:0">${joinPending}</p></div><i class="fa-solid fa-user-clock" style="font-size:20px;color:var(--ice)"></i></div>
      <div class="panel tone-cream" style="border-radius:24px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex:1"><div><p class="dim" style="font-size:12px;font-weight:700;margin:0">수로 미참</p><p style="font-size:24px;font-weight:900;margin:0">${warn}</p></div><i class="fa-solid fa-triangle-exclamation" style="font-size:20px;color:var(--amber)"></i></div>
    </div>

    <div class="panel" style="border-radius:24px;padding:24px;grid-column:span 2;grid-row:span 2;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;"><h3 style="font-weight:900;font-size:18px;margin:0"><i class="fa-solid fa-ranking-star" style="margin-right:8px;color:var(--bunny-main)"></i>수로 TOP</h3><a href="analysis.html" class="dim" style="font-size:12px;font-weight:700;text-decoration:none">전체 분석 <i class="fa-solid fa-chevron-right" style="font-size:10px"></i></a></div>
      <div class="scroll" style="overflow-x:auto;"><table style="width:100%;font-size:14px;border-collapse:collapse;">
        <thead><tr class="dim" style="font-size:12px;font-weight:700;border-bottom:1px solid var(--line)"><th style="text-align:left;padding:10px 8px">닉네임</th><th style="text-align:left;padding:10px 0">직위</th><th style="text-align:center;padding:10px 0">주간점수</th><th style="text-align:center;padding:10px 8px">상태</th></tr></thead>
        <tbody style="font-weight:500">${tbody}</tbody>
      </table></div>
    </div>

    <div class="panel tone-cream" style="border-radius:24px;padding:24px;display:flex;flex-direction:column;justify-content:space-between;">
      <div style="display:flex;align-items:center;justify-content:space-between"><span class="dim" style="font-size:14px;font-weight:700">보석금 대기</span><i class="fa-solid fa-gem" style="color:var(--bunny-deep)"></i></div>
      <div><p style="font-size:36px;font-weight:900;line-height:1;margin:0">${bailPending}</p><p class="dim" style="font-size:12px;font-weight:700;margin:8px 0 0">건 처리 대기중</p></div>
    </div>

    <div class="panel tone-light" style="border-radius:24px;padding:24px;display:flex;flex-direction:column;">
      <span class="dim" style="font-size:14px;font-weight:700;margin-bottom:12px">점수 분포</span>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:8px;flex:1;min-height:70px;">${bars}</div>
      <div class="dim" style="display:flex;justify-content:space-between;font-size:10px;font-weight:700;margin-top:8px"><span>~3만</span><span>3만</span><span>5만</span><span>7만</span><span>9만+</span></div>
    </div>

    <div class="panel" style="border-radius:24px;padding:24px;grid-column:span 2;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;"><h3 style="font-weight:900;font-size:16px;margin:0"><i class="fa-solid fa-user-plus" style="margin-right:8px;color:var(--ice)"></i>가입 신청 대기 <span class="chip" style="margin-left:4px;background:var(--bunny-deep);color:#fff">${joinPending}</span></h3><a href="requests.html" class="dim" style="font-size:12px;font-weight:700;text-decoration:none">심사하기</a></div>
      <div style="display:flex;flex-direction:column;gap:10px;">${queue}</div>
    </div>
  </div>`;
}

/* ============================================================
 *  페이지별 실데이터 빌더 — PAGES[key] = async () => html
 *  키가 없으면 placeholderHTML(와꾸) 표시.
 *  관리 범위: 메인길드 = 버니(뚠카롱), 부길드 = 늑대(뚱카롱)·쿠거(밤카롱). (연합 아님)
 * ============================================================ */
/* ===== 길드 구분 (메인 버니 / 부길드 늑대·쿠거) — DB키·넥슨명·색 ===== */
const FACTIONS = {
  bunny:  { key:'뚠카롱', nexon:'버니', label:'버니', emoji:'🐰', main:'#FF8FAB', light:'#FFC9DE', cream:'#FFE8D6', deep:'#B5446E', bg:'#FFF5F8', p2:'#FFF0F5', p3:'#FFF7EF' },
  wolf:   { key:'뚱카롱', nexon:'늑대', label:'늑대', emoji:'🐺', main:'#6C8EBF', light:'#8B9DC3', cream:'#DCE7F3', deep:'#2C3E57', bg:'#F2F6FB', p2:'#EAF1F9', p3:'#EEF3F8' },
  cougar: { key:'밤카롱', nexon:'쿠거', label:'쿠거', emoji:'🐆', main:'#C98A42', light:'#F0D6A8', cream:'#F5E6CC', deep:'#6E3D1C', bg:'#FBF7F0', p2:'#FBF3E6', p3:'#FAF6EE' },
};
function facKey(){ return 'bunny'; }  // 전역 앱은 버니 고정 (메인/부길드 전환은 길드원 탭에서만)
function fac(){ return FACTIONS[facKey()]||FACTIONS.bunny; }
/* DB 길드키(뚠/뚱/밤카롱) → 표시명(버니/늑대/쿠거). 그 외 외부 길드명은 그대로 노출. */
function guildLabel(g){ const f=Object.values(FACTIONS).find(x=>x.key===g); return f?f.label:(g||''); }
/* 문자열 속 길드키도 표시명으로 (예: "뚠카롱 길드창고" → "버니 길드창고") — 필터/DB값엔 영향 없음, 화면 표시 전용 */
function dispGuildStr(s){ return String(s==null?'':s).replace(/뚠카롱/g,'버니').replace(/뚱카롱/g,'늑대').replace(/밤카롱/g,'쿠거'); }
window.guildLabel = guildLabel; window.dispGuildStr = dispGuildStr;
let GUILD = fac().key;          // DB 내부키 (뚠/뚱/밤카롱)
let NEXON_GUILD = fac().nexon;  // 인게임 길드명 (버니/늑대/쿠거)
function applyTheme(){
  const f=fac(), r=document.documentElement.style, dark=document.body.classList.contains('dark');
  r.setProperty('--bunny-main',f.main); r.setProperty('--bunny-light',f.light); r.setProperty('--bunny-cream',f.cream); r.setProperty('--bunny-deep',f.deep);
  if(dark){ r.removeProperty('--bg'); r.removeProperty('--panel-2'); r.removeProperty('--panel-3'); }
  else { r.setProperty('--bg',f.bg); r.setProperty('--panel-2',f.p2); r.setProperty('--panel-3',f.p3); }
}
window.switchFaction=(k)=>{ if(!FACTIONS[k]) return; localStorage.setItem('bunny_faction',k); location.reload(); };
const db = ()=> BACKEND.db;

function loadingHTML(k){
  return headerHTML(META[k]?META[k].t:'', '') + `<div class="panel" style="border-radius:24px;padding:60px;text-align:center;">
    <span class="dim" style="font-size:15px;font-weight:700"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px"></i>불러오는 중…</span></div>`;
}
function errorHTML(k,e){
  return headerHTML(META[k]?META[k].t:'', '') + `<div class="panel" style="border-radius:24px;padding:44px;text-align:center;">
    <p style="font-weight:900;font-size:18px;margin:0 0 6px">데이터를 불러오지 못했어요</p>
    <p class="dim" style="font-size:13px;font-weight:700;margin:0">${(e&&e.message)||e||''}</p>
    <p class="dim" style="font-size:12px;margin:10px 0 0">로그인이 필요하거나 네트워크 문제일 수 있어요.</p></div>`;
}

function avatarColor(name){ const c=['var(--bunny-main)','var(--bunny-deep)','var(--ice)','var(--amber)','#C75050','#7C6BA8']; let h=0; for(const ch of (name||'?')) h=(h+ch.charCodeAt(0))%c.length; return c[h]; }
function memRoleChip(role){ const r=role||'멤버'; if(/길드장|운영|총무|부길드|마스터/.test(r)) return `<span class="chip" style="background:var(--bunny-deep);color:#fff">${r}</span>`; if(/신입|수습/.test(r)) return `<span class="chip" style="background:var(--bunny-light);color:var(--bunny-deep)">${r}</span>`; return `<span class="chip" style="background:var(--line);color:var(--text)">${r}</span>`; }

/* ----- 길드원 (팩션 탭으로 버니/늑대/쿠거 전환) ----- */
let _mem = [];
let _memFac = 'bunny';
let _memSuro = {};        // {member_id: 최신회차 점수} — 대표 수로 여부용
let _memSuroLabel = '';
let _memRanks = [];       // 직위 위계순 (설정 cfg.ranks) — 직위별 정렬용
function _memRoleRank(role){ if(!role) return 998; const i=_memRanks.indexOf(role); return i>=0?i:998; }
const _suroFmt=n=> n>=10000?(n/10000).toFixed(n%10000?1:0)+'만': (n? n.toLocaleString():'0');
function _suroTier(s){ return s<=0?'#C03A3A': s<50000?'#E0A52E': s<120000?'#3D7DD6':'#1A8A4A'; }  // 미참/저조/양호/우수
const _memState = { mode:'group', sort:'suro', dir:'desc', expandAll:false };   // 계정그룹 아코디언 · 헤더 클릭 정렬
async function buildMembers(){
  const FK = FACTIONS[_memFac] || FACTIONS.bunny;
  const { data, error } = await db().from('members')
    .select('id,name,role,class,level,is_main,main_char_name,join_date')
    .eq('guild', FK.key).order('level',{ascending:false}).limit(2000);
  if(error) throw error;
  _mem = data||[];
  _memSuro = {}; _memSuroLabel = '';
  try{
    const { data:per } = await db().from('suro_periods').select('id,period_label').order('start_date',{ascending:false}).limit(1);
    if(per && per[0]){ _memSuroLabel = per[0].period_label;
      const { data:sc } = await db().from('suro_scores').select('member_id,score').eq('guild',FK.key).eq('period_id',per[0].id).limit(4000);
      (sc||[]).forEach(s=>{ _memSuro[s.member_id] = Number(s.score)||0; });
    }
  }catch(e){}
  try{ const cfg=await getConfig(); _memRanks=(cfg.ranks&&(cfg.ranks[FK.key]||cfg.ranks[GUILD]))||[]; }catch(e){ _memRanks=[]; }
  const mains = _mem.filter(m=>m.is_main!==false).length;
  const controls = `<div class="panel" style="border-radius:20px;padding:14px;margin-bottom:18px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;position:sticky;top:0;z-index:6;box-shadow:0 6px 16px -10px rgba(0,0,0,.25)">
    <div style="flex:1;min-width:170px;display:flex;align-items:center;gap:8px;background:var(--panel-2);border-radius:12px;padding:10px 14px;">
      <i class="fa-solid fa-magnifying-glass dim"></i>
      <input id="memSearch" oninput="_memApply()" placeholder="닉네임 검색" autocomplete="off" style="border:0;background:transparent;outline:0;color:var(--text);font-size:14px;font-weight:700;width:100%;">
    </div>
    <button id="memExpand" onclick="_memExpandAll()" style="padding:10px 15px;border:1px solid var(--line);border-radius:11px;font-weight:800;font-size:13px;cursor:pointer;background:var(--panel-2);color:var(--text);white-space:nowrap"><i class="fa-solid fa-chevron-${_memState.expandAll?'up':'down'}" style="margin-right:6px"></i>${_memState.expandAll?'전체 접기':'전체 펼치기'}</button>
    <span class="dim" style="font-size:13px;font-weight:800;margin-left:auto"><b id="memCount" style="color:var(--bunny-deep)">${mains}</b> 그룹</span>
  </div>`;
  const facBtn = (k)=>{ const f=FACTIONS[k]||FACTIONS.bunny, on=k===_memFac, tag=k==='bunny'?' <span style="font-size:10px;opacity:.85;font-weight:700">메인</span>':''; return `<button onclick="_memTab('${k}')" style="border:0;border-radius:12px;padding:9px 18px;font-weight:800;font-size:14px;cursor:pointer;transition:.15s;${on?`background:${f.main};color:#fff;box-shadow:0 4px 12px -3px ${f.deep}`:'background:var(--panel-2);color:var(--text)'}">${f.emoji} ${f.label}${tag}</button>`; };
  const facTabs = `<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">${facBtn('bunny')}<span class="dim" style="font-size:11px;font-weight:800;margin:0 2px">· 부길드</span>${facBtn('wolf')}${facBtn('cougar')}</div>`;
  const initBody = memberGroups('').body;
  return headerHTML('길드원', `${FK.label} · 총 ${_mem.length}명`) + facTabs + controls +
    `<div class="panel" style="border-radius:24px;padding:18px;"><div id="memTbl">${initBody}</div></div>`;
}
window._memTab = async (k)=>{
  if(!FACTIONS[k]) return;
  _memFac = k;
  const el = document.getElementById('pageBody'); if(!el) return;
  el.innerHTML = loadingHTML('members');
  try{ el.innerHTML = await buildMembers(); }catch(e){ el.innerHTML = errorHTML('members', e); }
};
function memberRows(list){
  if(!list.length) return `<div class="dim" style="padding:50px;text-align:center;font-weight:700">해당하는 멤버가 없어요</div>`;
  const body = list.map(m=>`<tr style="border-bottom:1px solid var(--line)">
    <td style="padding:11px 8px;font-weight:700"><span style="display:inline-flex;align-items:center;gap:9px"><span style="width:30px;height:30px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:900;flex-shrink:0;background:${avatarColor(m.name)}">${(m.name||'?').slice(0,1)}</span>${m.name||'-'}</span></td>
    <td>${memRoleChip(m.role)}</td>
    <td class="dim" style="font-weight:700">${m.class||'-'}</td>
    <td style="font-weight:900">Lv.${m.level||0}</td>
    <td>${m.is_main?'<span class="chip" style="background:var(--bunny-light);color:var(--bunny-deep)">본캐</span>':`<span class="chip" style="background:var(--line);color:var(--dim)">부캐${m.main_char_name?' · '+m.main_char_name:''}</span>`}</td>
    <td class="dim" style="font-weight:700">${m.join_date||'-'}</td>
  </tr>`).join('');
  return `<div class="scroll" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px;min-width:560px">
    <thead><tr class="dim" style="font-size:12px;font-weight:700;border-bottom:2px solid var(--line)">
      <th style="text-align:left;padding:10px 8px">닉네임</th><th style="text-align:left;padding:10px 0">역할</th><th style="text-align:left;padding:10px 0">직업</th><th style="text-align:left;padding:10px 0">레벨</th><th style="text-align:left;padding:10px 0">구분</th><th style="text-align:left;padding:10px 0">가입일</th>
    </tr></thead><tbody style="font-weight:500">${body}</tbody></table></div>`;
}
const _MEM_SORT_DEF = { suro:'desc', level:'desc', join:'desc', name:'asc', role:'asc', class:'asc' };
window._memSort = (k)=>{
  if(_memState.sort===k) _memState.dir = _memState.dir==='asc'?'desc':'asc';
  else { _memState.sort=k; _memState.dir=_MEM_SORT_DEF[k]||'asc'; }
  _memApply();
};
window._memExpandAll = ()=>{ _memState.expandAll=!_memState.expandAll; _memApply(); };
window._memApply = ()=>{
  const q=(document.getElementById('memSearch')?.value||'').trim();
  const html=memberGroups(q);
  const tbl=document.getElementById('memTbl'); if(tbl) tbl.innerHTML=html.body;
  const c=document.getElementById('memCount'); if(c) c.textContent=html.count;
  const b=document.getElementById('memExpand'); if(b) b.innerHTML=`<i class="fa-solid fa-chevron-${_memState.expandAll?'up':'down'}" style="margin-right:6px"></i>${_memState.expandAll?'전체 접기':'전체 펼치기'}`;
};
/* 계정그룹 아코디언 — 대표(본캐)+부캐 · 대표 수로 여부 · 편집(👑 대표변경/드래그 이동/저장) */
let _grpEdit=false; let _grpDirty=new Set();
window._grpToggle = (el)=>{ const g=el.closest('.acc-grp'); if(g) g.classList.toggle('open'); };
window._grpToggleEdit = ()=>{ if(!isAdmin()) return alert('운영진만 편집할 수 있어요.'); _grpEdit=!_grpEdit; _memApply(); };
function _grpMemById(id){ return _mem.find(m=>m.id===id); }
function _grpRepNameOf(m){ return m.is_main!==false ? m.name : (m.main_char_name||''); }
function _grpReopen(repName){ setTimeout(()=>{ document.querySelectorAll('.acc-grp').forEach(g=>{ if(g.dataset.rep===repName) g.classList.add('open'); }); },0); }
window._grpSetRep = (id)=>{ if(!_grpEdit) return; const m=_grpMemById(id); if(!m) return;
  if(m.is_main!==false) return;                              // 이미 대표
  const oldRep=_grpRepNameOf(m);
  _mem.forEach(x=>{ if(x.id===m.id) return;
    if(x.name===oldRep && x.is_main!==false){ x.is_main=false; x.main_char_name=m.name; _grpDirty.add(x.id); }
    else if(x.main_char_name===oldRep && x.is_main===false){ x.main_char_name=m.name; _grpDirty.add(x.id); } });
  m.is_main=true; m.main_char_name=null; _grpDirty.add(m.id);
  _memApply(); _grpReopen(m.name);
};
window._grpPromote = (id)=>{ if(!_grpEdit) return; const m=_grpMemById(id); if(!m) return; m.is_main=true; m.main_char_name=null; _grpDirty.add(m.id); _memApply(); _grpReopen(m.name); };
window._grpDragStart = (e,id)=>{ if(!_grpEdit){ e.preventDefault(); return; } e.dataTransfer.setData('mid',String(id)); e.dataTransfer.effectAllowed='move'; };
window._grpDropOn = (e,repName)=>{ e.preventDefault(); e.currentTarget.classList.remove('gover'); const id=Number(e.dataTransfer.getData('mid')); const m=_grpMemById(id); if(!m||!repName||m.name===repName) return;
  if(m.is_main!==false){ alert('대표는 드래그로 옮길 수 없어요. 다른 캐릭에 👑를 눌러 대표를 바꾼 뒤 옮겨주세요.'); return; }
  m.is_main=false; m.main_char_name=repName; _grpDirty.add(m.id); _memApply(); _grpReopen(repName);
};
/* 대표 이름 타이핑(datalist)으로 묶기 — 부캐는 그 대표 밑으로, 부캐없는 본캐는 데모트 */
window._grpMoveByName = (id, repName)=>{ if(!_grpEdit) return; repName=(repName||'').trim(); if(!repName) return;
  const m=_grpMemById(id); if(!m) return; if(m.name===repName){ _memApply(); return; }
  const target=_mem.find(x=>x.name===repName && x.is_main!==false);
  if(!target){ alert('"'+repName+'" — 대표(본캐)를 찾을 수 없어요. 목록에서 골라주세요.'); return; }
  if(m.is_main!==false){ const hasAlts=_mem.some(x=>x.is_main===false && x.main_char_name===m.name); if(hasAlts){ alert(m.name+'은(는) 부캐가 있는 대표예요. 부캐를 먼저 옮기거나 다른 캐릭에 👑를 주세요.'); _memApply(); return; } }
  m.is_main=false; m.main_char_name=repName; _grpDirty.add(m.id); _memApply(); _grpReopen(repName);
};
/* 유니온으로 기존 멤버 전체 자동 묶기 — 같은 계정(유니온 슬롯1=대표) 끼리 한 대표 밑으로 병합 */
window._grpAutoUnion = async ()=>{
  if(!isAdmin()) return alert('운영진만 사용할 수 있어요.');
  if(!_mem.length) return;
  if(!confirm(`${fac().label} 길드원 ${_mem.length}명을 유니온으로 같은 계정끼리 자동 묶을까요?\n각 캐릭의 유니온 대표(슬롯1)를 조회해 한 대표 밑으로 모읍니다.\n시간이 좀 걸려요 — 끝나면 검토 후 [저장] 누르세요.`)) return;
  const tbl=document.getElementById('memTbl'); const names=_mem.map(m=>m.name); const repOf={};
  let done=0; const prog=()=>{ if(tbl) tbl.innerHTML=`<div style="padding:44px;text-align:center"><div class="dim" style="font-weight:800"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px"></i>유니온 조회 ${done}/${names.length}…</div><div class="dim" style="font-size:11px;margin-top:6px;font-weight:700">같은 계정은 캐시돼서 점점 빨라져요</div></div>`; };
  prog();
  const CONC=10; let next=0;
  const worker=async ()=>{ while(next<names.length){ const i=next++; const n=names[i]; try{ const r=await guessMainChar(n); repOf[n]=r.name||n; }catch(e){ repOf[n]=n; } done++; if(done%4===0||done===names.length) prog(); } };
  await Promise.all(Array.from({length:Math.min(CONC,names.length)},worker));
  const clusters={}; _mem.forEach(m=>{ const rep=repOf[m.name]||m.name; (clusters[rep]||(clusters[rep]=[])).push(m); });
  let changed=0;
  Object.keys(clusters).forEach(repName=>{ const members=clusters[repName];
    // 대표 = 클러스터 내 최고 레벨(보통 실제 메인캐). 유니온 슬롯1이 저레벨 알트인 경우 대비
    const rep=members.slice().sort((a,b)=>(b.level||0)-(a.level||0))[0];
    members.forEach(m=>{ const wantMain=(m===rep), wantMC=wantMain?null:rep.name;
      if((m.is_main!==false)!==wantMain || (m.main_char_name||null)!==(wantMC||null)){ m.is_main=wantMain; m.main_char_name=wantMC; _grpDirty.add(m.id); changed++; } });
  });
  _grpEdit=true; _memApply();
  alert(`유니온 자동 묶기 완료! 변경 ${changed}건 — 검토 후 [저장] 눌러주세요.\n잘못 묶인 건 '대표 변경'/👑/드래그로 수정.`);
};
window._grpSave = async ()=>{
  if(!isAdmin()) return alert('운영진만 저장할 수 있어요.');
  if(!_grpDirty.size) return alert('변경된 내용이 없어요.');
  const ids=[..._grpDirty]; if(!confirm(`${ids.length}명의 대표/그룹 변경을 저장할까요?\n※ 라이브 공유 DB(members.is_main·main_char_name)에 반영됩니다.`)) return;
  let ok=0, fail=0;
  for(const id of ids){ const m=_grpMemById(id); if(!m) continue;
    const isMain=m.is_main!==false;
    const { error } = await db().from('members').update({ is_main:isMain, main_char_name:(isMain?null:(m.main_char_name||null)) }).eq('id',id);
    if(error) fail++; else ok++; }
  alert(`저장 완료 ✓ (${ok}명${fail?` · 실패 ${fail}`:''})`); _grpDirty=new Set(); _grpEdit=false;
  const el=document.getElementById('pageBody'); if(el){ el.innerHTML=loadingHTML('members'); try{ el.innerHTML=await buildMembers(); }catch(e){ el.innerHTML=errorHTML('members',e); } }
};
function memberGroups(q){
  const sort=_memState.sort||'suro', dir=_memState.dir||'desc';
  const hasSuro = Object.keys(_memSuro).length>0;
  const reps = _mem.filter(m=>m.is_main!==false);
  const byMain = {}; _mem.filter(m=>m.is_main===false).forEach(m=>{ const k=m.main_char_name||''; (byMain[k]||(byMain[k]=[])).push(m); });
  const repNames = new Set(reps.map(r=>r.name));
  let groups = reps.map(r=>({ rep:r, alts:(byMain[r.name]||[]).slice().sort((a,b)=>(b.level||0)-(a.level||0)) }));
  const orphans=[]; Object.keys(byMain).forEach(k=>{ if(!repNames.has(k)) orphans.push(...byMain[k]); });
  if(q) groups = groups.filter(g=> g.rep.name.includes(q) || g.alts.some(a=>(a.name||'').includes(q)));
  const sv=(m)=>_memSuro[m.id]||0;
  const maxS=Math.max(1,...reps.map(r=>sv(r)));   // 1등 점수 = 게이지 만땅(100%), 나머지는 그 비율
  // 오름차순 기준 비교기(이름·직업은 유니코드 코드포인트순) → dir로 방향 적용
  const repAsc={
    suro:(a,b)=>(sv(a.rep)-sv(b.rep))||((a.rep.level||0)-(b.rep.level||0)),
    name:(a,b)=>{ const x=a.rep.name||'',y=b.rep.name||''; return x<y?-1:x>y?1:0; },
    level:(a,b)=>(a.rep.level||0)-(b.rep.level||0),
    role:(a,b)=>(_memRoleRank(a.rep.role)-_memRoleRank(b.rep.role))||((a.rep.level||0)-(b.rep.level||0)),
    class:(a,b)=>{ const ca=a.rep.class||'',cb=b.rep.class||''; if(!ca&&!cb)return 0; if(!ca)return 1; if(!cb)return -1; return ca<cb?-1:ca>cb?1:0; },
    join:(a,b)=>{ const x=a.rep.join_date||'',y=b.rep.join_date||''; return x<y?-1:x>y?1:0; },
  };
  const _baseCmp=repAsc[sort]||repAsc.suro;
  groups.sort((a,b)=>{ const r=_baseCmp(a,b); return dir==='desc'?-r:r; });
  const miss = hasSuro ? groups.filter(g=>sv(g.rep)<=0).length : 0;
  const played = hasSuro ? groups.filter(g=>sv(g.rep)>0) : [];
  const avg = played.length ? Math.round(played.reduce((s,g)=>s+sv(g.rep),0)/played.length) : 0;
  const ed=_grpEdit;
  const suroGraph=(m)=>{ if(!hasSuro) return ''; const v=sv(m); const col=_suroTier(v); const pct=v>0?Math.max(6,Math.round(v/maxS*100)):0;
    return `<span style="display:inline-flex;align-items:center;gap:8px">
      <span title="이번 주차 수로 점수" style="width:62px;height:7px;border-radius:99px;background:var(--panel-3);overflow:hidden;display:inline-block"><span style="display:block;height:100%;width:${pct}%;background:${col}"></span></span>
      <span style="font-weight:900;font-variant-numeric:tabular-nums;font-size:14px;color:${col};min-width:48px;text-align:right">${v>0?_suroFmt(v):'미참'}</span></span>`; };
  const av=(n,sz)=>`<span style="width:${sz}px;height:${sz}px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:${sz<26?10:12}px;font-weight:900;flex-shrink:0;background:${avatarColor(n)}">${(n||'?').slice(0,1)}</span>`;
  const crown=(m,isRep)=>ed?`<button onclick="event.stopPropagation();_grpSetRep(${m.id})" title="${isRep?'대표':'이 캐릭을 대표로'}" style="width:26px;height:26px;border-radius:8px;border:1px solid var(--line);background:${isRep?'linear-gradient(135deg,var(--bunny-main),var(--bunny-deep))':'var(--panel)'};color:${isRep?'#fff':'var(--dim)'};cursor:pointer;flex-shrink:0;font-size:11px"><i class="fa-solid fa-crown"></i></button>`:'';
  const memRow=(m,isRep,reassign)=>`<div ${ed&&!isRep?`draggable="true" ondragstart="_grpDragStart(event,${m.id})"`:''} style="display:flex;align-items:center;gap:9px;padding:6px 4px;border-top:1px dashed var(--line);flex-wrap:wrap">
      ${crown(m,isRep)}${av(m.name,22)}<span style="font-weight:${isRep?900:700};font-size:13px">${escHtml(m.name)}</span>
      <span class="dim" style="font-size:11px;font-weight:700">${escHtml(m.class||'')}${m.level?' · Lv.'+m.level:''}</span>
      <span class="${isRep?'chip':'dim'}" style="${isRep?'background:var(--bunny-deep);color:#fff;':'color:var(--dim);'}font-size:10px;font-weight:800;margin-left:auto">${isRep?'대표':'부캐'}</span>
      ${ed&&reassign?`<input list="grpRepList" placeholder="${isRep?'다른 대표 밑으로':'대표 변경'}…" onchange="_grpMoveByName(${m.id},this.value)" style="border:1px solid var(--line);background:var(--panel);border-radius:7px;padding:4px 8px;font-size:11px;font-weight:700;color:var(--text);outline:0;width:128px">${!isRep?`<button onclick="_grpPromote(${m.id})" title="독립(본캐로)" style="border:0;border-radius:7px;background:var(--bunny-light);color:var(--bunny-deep);font-weight:800;font-size:11px;padding:5px 9px;cursor:pointer">독립</button><i class="fa-solid fa-grip-vertical dim" title="끌어서 이동" style="font-size:11px;cursor:grab"></i>`:''}`:''}</div>`;
  const grpHtml = (g)=>{
    const miss=hasSuro&&(sv(g.rep)||0)<=0;
    const bodyRows = ed
      ? memRow(g.rep,true,g.alts.length===0) + g.alts.map(a=>memRow(a,false,true)).join('')
      : (g.alts.length ? g.alts.map(a=>memRow(a,false,false)).join('') : `<div class="dim" style="font-size:11px;font-weight:700;padding:5px 4px">부캐 없음 · 단일 캐릭</div>`);
    const drop = ed?`ondragover="event.preventDefault();this.classList.add('gover')" ondragleave="this.classList.remove('gover')" ondrop="_grpDropOn(event,'${escAttr(g.rep.name).replace(/'/g,"\\'")}')"`:'';
    return `<div class="acc-grp${_memState.expandAll?' open':''}" data-rep="${escAttr(g.rep.name)}" style="border-bottom:1px solid var(--line)">
      <div class="acc-head" onclick="_grpToggle(this)" ${drop} style="display:flex;align-items:center;gap:9px;padding:8px 12px;cursor:pointer;${miss?'box-shadow:inset 3px 0 0 var(--bad-tx)':''}">
        <i class="fa-solid fa-chevron-right acc-chev dim" style="font-size:10px;width:10px;transition:.15s"></i>
        ${av(g.rep.name,26)}
        <span style="font-weight:900;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(g.rep.name)}</span>
        ${memRoleChip(g.rep.role)}
        ${g.alts.length?`<span class="chip" style="background:var(--panel-3);color:var(--dim);font-weight:800">부캐 ${g.alts.length}</span>`:''}
        <span style="flex:1"></span>
        ${suroGraph(g.rep)}
      </div>
      <div class="acc-body" style="display:none;background:var(--panel-2);padding:4px 12px 9px 34px">${bodyRows}</div>
    </div>`;
  };
  const orphanBlock = orphans.length ? `<div class="acc-grp${_memState.expandAll?' open':''}" style="border-top:2px solid var(--line)">
      <div onclick="_grpToggle(this)" style="display:flex;align-items:center;gap:9px;padding:8px 12px;cursor:pointer">
        <i class="fa-solid fa-chevron-right acc-chev dim" style="font-size:10px;width:10px;transition:.15s"></i>
        <i class="fa-solid fa-link-slash dim"></i><span style="font-weight:900;font-size:14px;color:var(--warn-tx)">대표 미상 (부캐인데 본캐 못 찾음)</span>
        <span class="chip" style="background:var(--warn-bg);color:var(--warn-tx);font-weight:800;margin-left:auto">${orphans.length}</span></div>
      <div class="acc-body" style="display:none;background:var(--panel-2);padding:4px 12px 9px 34px">${orphans.map(a=>`<div ${ed?`draggable="true" ondragstart="_grpDragStart(event,${a.id})"`:''} style="display:flex;align-items:center;gap:9px;padding:6px 4px;border-top:1px dashed var(--line)">${av(a.name,22)}<span style="font-weight:700;font-size:13px">${escHtml(a.name)}</span><span class="dim" style="font-size:11px;font-weight:700">${escHtml(a.class||'')}${a.level?' · Lv.'+a.level:''}${a.main_char_name?' · 지정(없음): '+escHtml(a.main_char_name):''}</span>${ed?`<button onclick="_grpPromote(${a.id})" style="margin-left:auto;border:0;border-radius:7px;background:var(--bunny-light);color:var(--bunny-deep);font-weight:800;font-size:11px;padding:4px 9px;cursor:pointer">본캐로</button><i class="fa-solid fa-grip-vertical dim" style="font-size:11px;cursor:grab;margin-left:6px"></i>`:''}</div>`).join('')}</div></div>` : '';
  const summary = hasSuro
    ? `<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;align-items:center">
        <span class="chip" style="background:var(--bunny-light);color:var(--bunny-deep);font-weight:900;font-size:12px;padding:7px 13px"><i class="fa-solid fa-calendar-week" style="margin-right:5px"></i>${escHtml(_memSuroLabel||'이번 주차')}</span>
        <div class="panel" style="border-radius:14px;padding:10px 14px;font-size:12px;font-weight:800;color:var(--dim)">대표 그룹<b style="display:block;font-size:18px;color:var(--text)">${groups.length}</b></div>
        <div class="panel" style="border-radius:14px;padding:10px 14px;font-size:12px;font-weight:800;color:var(--dim)">수로 완료<b style="display:block;font-size:18px;color:var(--ok-tx)">${groups.length-miss}</b></div>
        <div class="panel" style="border-radius:14px;padding:10px 14px;font-size:12px;font-weight:800;color:var(--dim)">미참<b style="display:block;font-size:18px;color:var(--bad-tx)">${miss}</b></div>
        <div class="panel" style="border-radius:14px;padding:10px 14px;font-size:12px;font-weight:800;color:var(--dim)">참여 평균<b style="display:block;font-size:18px;color:var(--bunny-deep)">${_suroFmt(avg)}</b></div>
      </div>` : '';
  const warnBar = (hasSuro&&miss) ? `<div style="background:var(--bad-bg);color:var(--bad-tx);border-radius:12px;padding:9px 13px;font-weight:800;font-size:13px;margin-bottom:12px"><i class="fa-solid fa-triangle-exclamation" style="margin-right:6px"></i>${escHtml(_memSuroLabel||'이번 주차')} 수로 <b>미참 대표 ${miss}명</b> — 확인 필요${sort==='suro'?' (목록 맨 아래)':''}</div>` : '';
  const editBar = isAdmin() ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px">
      <button onclick="_grpAutoUnion()" style="border:0;border-radius:10px;padding:8px 14px;font-weight:800;font-size:13px;cursor:pointer;background:linear-gradient(135deg,var(--bunny-main),var(--bunny-deep));color:#fff"><i class="fa-solid fa-wand-magic-sparkles" style="margin-right:5px"></i>유니온 자동 묶기</button>
      <button onclick="_grpToggleEdit()" style="border:0;border-radius:10px;padding:8px 14px;font-weight:800;font-size:13px;cursor:pointer;background:${ed?'var(--bunny-deep)':'var(--panel-2)'};color:${ed?'#fff':'var(--text)'}"><i class="fa-solid fa-pen-to-square" style="margin-right:5px"></i>${ed?'편집 종료':'그룹 편집'}</button>
      ${ed?`<button onclick="_grpSave()" style="border:0;border-radius:10px;padding:8px 14px;font-weight:800;font-size:13px;cursor:pointer;background:#1A8A4A;color:#fff"><i class="fa-solid fa-floppy-disk" style="margin-right:5px"></i>저장 (${_grpDirty.size})</button>
      <span class="dim" style="font-size:11px;font-weight:700">펼쳐서 — <b>👑</b> 대표 지정 · <b>"대표 변경"</b> 칸에 대표 이름 타이핑(자동완성) · 부캐 <b>끌어</b> 그룹 헤더에 떨구기 · <b>독립</b>=본캐 분리</span>`:''}
    </div>` : '';
  const css = `<style>.acc-grp.open .acc-chev{transform:rotate(90deg)}.acc-grp.open .acc-body{display:block!important}.acc-head.gover{background:var(--bunny-cream)!important;box-shadow:inset 0 0 0 2px var(--bunny-main)}</style>`;
  const repDatalist = ed ? `<datalist id="grpRepList">${reps.map(r=>`<option value="${escAttr(r.name)}"></option>`).join('')}</datalist>` : '';
  // 헤더 클릭 정렬 바 (C안: 활성 기준 핑크 강조 + 방향 화살표) — 닉네임은 유니코드순
  const arr = dir==='asc' ? '<i class="fa-solid fa-arrow-up-short-wide" style="margin-left:5px;font-size:10px"></i>' : '<i class="fa-solid fa-arrow-down-wide-short" style="margin-left:5px;font-size:10px"></i>';
  const sk=(k,l,right)=>`<span onclick="_memSort('${k}')" title="${l} 정렬" style="cursor:pointer;padding:5px 10px;border-radius:8px;transition:.12s;${k===sort?'background:linear-gradient(135deg,var(--bunny-main),var(--bunny-deep));color:#fff':'color:var(--dim)'}${right?';margin-left:auto':''}">${l}${k===sort?arr:''}</span>`;
  const sortBar = `<div style="display:flex;align-items:center;gap:4px;padding:9px 11px;background:var(--panel-2);border-bottom:1px solid var(--line);font-size:12px;font-weight:800;flex-wrap:wrap">
    ${sk('name','닉네임')}${sk('role','직위')}${sk('level','레벨')}${sk('class','직업')}${sk('join','가입일')}${sk('suro','이번주 수로',true)}
  </div>`;
  const body = css + repDatalist + editBar + summary + warnBar + `<div style="border:1px solid var(--line);border-radius:14px;overflow:hidden">${sortBar}${groups.map(grpHtml).join('')||'<div class="dim" style="padding:40px;text-align:center;font-weight:700">그룹 없음</div>'}${orphanBlock}</div>`;
  return { body, count: groups.length };
}

/* ----- 승강제·현황 (직위 위계순 분포 + 점수 기준) ----- */
async function buildPromotion(){
  const [memRes, cfg] = await Promise.all([
    db().from('members').select('role,level,is_main').eq('guild',GUILD).eq('is_main',true).limit(2000),
    getConfig().catch(()=>({})),
  ]);
  if(memRes.error) throw memRes.error;
  const data=memRes.data||[];
  const order=(cfg.ranks&&cfg.ranks[GUILD])||[];
  const cutoff={}; ((cfg.cutoffs&&cfg.cutoffs[GUILD])||[]).forEach(c=>cutoff[c.rank]=c.label);
  const exempt=new Set(cfg.suroExempt||[]);
  const byRole={}; data.forEach(m=>{ const r=(m.role||'').trim()||'(직위 없음)'; (byRole[r]=byRole[r]||[]).push(m); });
  let rows=Object.entries(byRole).map(([role,arr])=>({role,n:arr.length,avg:Math.round(arr.reduce((s,m)=>s+(m.level||0),0)/arr.length)}));
  rows.sort((a,b)=>{ const ia=order.indexOf(a.role), ib=order.indexOf(b.role); return (ia<0?999:ia)-(ib<0?999:ib) || b.n-a.n; });
  const max=Math.max(1,...rows.map(r=>r.n)), total=data.length;
  const list=rows.map(r=>`<div style="margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;gap:8px">
      <span style="font-weight:800;display:flex;align-items:center;gap:8px;flex-wrap:wrap">${memRoleChip(r.role)}
        ${cutoff[r.role]?`<span class="dim" style="font-size:11px;font-weight:700">${cutoff[r.role]}</span>`:''}
        ${exempt.has(r.role)?'<span class="chip" style="background:var(--ok-bg);color:var(--ok-tx);font-size:10px">수로면제</span>':''}
        <span class="dim" style="font-size:12px;font-weight:700">평균 Lv.${r.avg}</span></span>
      <span style="font-weight:900;white-space:nowrap">${r.n}<span class="dim" style="font-size:12px;font-weight:700">명 · ${Math.round(r.n/total*100)}%</span></span>
    </div>
    <div style="height:10px;border-radius:99px;background:var(--panel-2);overflow:hidden"><i style="display:block;height:100%;width:${r.n/max*100}%;border-radius:99px;background:linear-gradient(90deg,var(--bunny-main),var(--bunny-deep))"></i></div>
  </div>`).join('');
  return headerHTML('승강제·현황', `${fac().label} · 본캐 ${total}명 · 직위 ${rows.length}종`) +
    `<div class="panel" style="border-radius:24px;padding:24px;">
      <h3 style="font-weight:900;font-size:16px;margin:0 0 18px"><i class="fa-solid fa-ranking-star" style="color:var(--bunny-main);margin-right:8px"></i>직위별 인원 분포 <span class="dim" style="font-size:12px;font-weight:700">(위계 높은 순)</span></h3>${list}
      ${cfg.suroExemptNote?`<p class="dim" style="font-size:12px;font-weight:700;margin:18px 0 0"><i class="fa-solid fa-circle-info" style="margin-right:5px"></i>${cfg.suroExemptNote}</p>`:''}
    </div>`;
}

/* ----- 신청 처리 (3탭 허브: 가입 / 아인슈페너(면제) / 수로 보석금) ----- */
let _reqMainTab='join'; let _reqTab='pending'; let _reqBg={};
async function buildRequests(){
  let cj=0,ce=0,cb=0;
  try{ const r=await db().from('join_requests').select('id',{count:'exact',head:true}).or('status.is.null,status.eq.pending'); cj=r.count||0; }catch(e){}
  try{ const r=await db().from('exempt_requests').select('id',{count:'exact',head:true}).eq('status','pending'); ce=r.count||0; }catch(e){}
  try{ const r=await db().from('bail_requests').select('id',{count:'exact',head:true}).eq('status','pending').eq('payer_guild',GUILD); cb=r.count||0; }catch(e){}
  const mtab=(k,l,ic,c)=>{ const on=_reqMainTab===k; return `<button onclick="_reqMain('${k}')" style="border:0;border-radius:13px;padding:11px 17px;font-weight:800;font-size:14px;cursor:pointer;${on?'background:var(--bunny-main);color:#fff':'background:var(--panel-2);color:var(--text)'}"><i class="fa-solid ${ic}" style="margin-right:6px"></i>${l}${c?` <span class="chip" style="background:${on?'rgba(255,255,255,.28)':'var(--bad-tx)'};color:#fff;margin-left:2px">${c}</span>`:''}</button>`; };
  let body='';
  try{ body = _reqMainTab==='exempt' ? await _reqExemptBody() : _reqMainTab==='bail' ? await _reqBailBody() : await _reqJoinBody(); }
  catch(e){ body=`<div class="panel" style="border-radius:18px;padding:30px;text-align:center"><span class="dim" style="font-weight:700">${escHtml(e.message||String(e))}</span></div>`; }
  return headerHTML('신청 처리', `가입 ${cj} · 아인슈페너 ${ce} · 보석금 ${cb}`) +
    `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">${mtab('join','가입 신청','fa-user-plus',cj)}${mtab('exempt','아인슈페너 신청','fa-mug-hot',ce)}${mtab('bail','수로 보석금','fa-gem',cb)}</div>
     <div id="reqMainBody">${body}</div>`;
}
window._reqMain=async (k)=>{ _reqMainTab=k; const el=document.getElementById('pageBody'); if(!el) return; el.innerHTML=loadingHTML('requests'); try{ el.innerHTML=await buildRequests(); }catch(e){ el.innerHTML=errorHTML('requests',e); } };
async function _reqJoinBody(){
  const { data, error } = await db().from('join_requests')
    .select('id,nickname,suro_score,job,prev_guild,answers,hands_image_url,status,admin_note,processed_by,processed_at,created_at,join_source,join_category')
    .order('created_at',{ascending:false}).limit(300);
  if(error) throw error;
  const all=data||[];
  const counts={pending:0,approved:0,rejected:0}; all.forEach(r=>{ const s=r.status||'pending'; counts[s]=(counts[s]||0)+1; });
  const filtered=all.filter(r=>(r.status||'pending')===_reqTab);
  const tabBtn=(k,l,col)=>{ const on=_reqTab===k; return `<button onclick="_reqSetTab('${k}')" style="border:0;border-radius:11px;padding:8px 15px;font-weight:800;font-size:13px;cursor:pointer;${on?`background:${col};color:#fff`:'background:var(--panel-2);color:var(--text)'}">${l} <span class="chip" style="background:${on?'rgba(255,255,255,.25)':'var(--panel-3)'};color:${on?'#fff':'var(--dim)'}">${counts[k]||0}</span></button>`; };
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
       ${tabBtn('pending','처리 대기','var(--warn-tx)')}${tabBtn('approved','승인됨','var(--ok-tx)')}${tabBtn('rejected','거절됨','var(--bad-tx)')}
     </div>
     <div>${filtered.length?filtered.map(reqCard).join(''):'<div class="panel" style="border-radius:18px;padding:40px;text-align:center"><span class="dim" style="font-weight:800"><i class="fa-solid fa-inbox" style="margin-right:6px"></i>해당 상태의 신청이 없어요</span></div>'}</div>`;
}
function reqCard(r){
  const fmtScore=s=>{ if(s==null||s==='')return '-'; const n=String(s).replace(/[^\d]/g,''); return n?Number(n).toLocaleString():String(s); };
  const suroFmt=fmtScore(r.suro_score), suroNum=Number(String(r.suro_score||'').replace(/[^\d]/g,''))||0, below=suroNum>0&&suroNum<10000;
  const st=r.status||'pending'; const created=new Date(r.created_at); const elapsedH=(Date.now()-created.getTime())/3600000; const waitDone=elapsedH>=12;
  const dateStr=created.toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  const wait= st!=='pending'?'': waitDone?'<span style="font-size:10px;color:var(--ok-tx);font-weight:800"><i class="fa-solid fa-circle-check" style="margin-right:3px"></i>12시간 경과</span>':`<span style="font-size:10px;color:var(--warn-tx);font-weight:800"><i class="fa-solid fa-clock" style="margin-right:3px"></i>대기중 (${Math.floor(elapsedH)}h)</span>`;
  const answers=(Array.isArray(r.answers)?r.answers:[]).filter(x=>x&&x.a).map(x=>`<div style="font-size:12px;margin-bottom:5px"><b style="font-weight:800">${escHtml(x.q||'')}</b><div class="dim" style="font-weight:600">${escHtml(x.a||'')}</div></div>`).join('');
  const hands=r.hands_image_url?`<a href="${escAttr(r.hands_image_url)}" target="_blank"><img src="${escAttr(r.hands_image_url)}" style="width:100%;max-height:200px;object-fit:contain;border-radius:12px;background:var(--panel-2);border:1px solid var(--line)" loading="lazy"><div class="dim" style="font-size:9px;text-align:center;margin-top:3px">핸즈 캡처 크게 보기 ↗</div></a>`:'<div style="font-size:10px;color:var(--warn-tx);background:var(--warn-bg);border-radius:10px;padding:12px;text-align:center;font-weight:700">핸즈 캡처 없음</div>';
  const notice=`[모집제]\n${NEXON_GUILD} 가입 희망자 공지\n\n닉네임 : ${r.nickname}\n수로점수 : ${suroFmt}점\n직업 : ${r.job||'-'}\n전길드 : ${r.prev_guild||'-'}\n\n이견·문의는 간부진에게 1:1 오픈채팅 주세요.`;
  const bg=_reqBg[r.id]||{}, bgN=['meaegi','google','inven'].filter(s=>bg[s]).length;
  const sbtn=(site,l)=>{ const ok=!!bg[site]; return `<button onclick="_reqSearch('${site}',${r.id},'${encodeURIComponent(r.nickname)}')" style="border:${ok?'0':'1px solid var(--line)'};border-radius:8px;padding:6px 11px;font-weight:800;font-size:12px;cursor:pointer;background:${ok?'var(--ok-tx)':'var(--panel)'};color:${ok?'#fff':'var(--text)'}"><i class="fa-solid fa-${ok?'check':'magnifying-glass'}" style="margin-right:4px"></i>${l}</button>`; };
  const del=`<button onclick="_reqDelete(${r.id})" title="삭제" style="border:1px solid var(--line);background:var(--panel);color:var(--dim);border-radius:10px;padding:9px 12px;font-weight:800;cursor:pointer"><i class="fa-solid fa-trash"></i></button>`;
  const actions= st==='pending'
    ? `<button onclick="_joinAct(${r.id},'approved')" style="flex:1;min-width:120px;border:0;border-radius:10px;padding:9px;font-weight:900;color:#fff;background:#1A8A4A;cursor:pointer"><i class="fa-solid fa-check" style="margin-right:5px"></i>가입 승인</button><button onclick="_joinAct(${r.id},'rejected')" style="border:1px solid var(--bad-tx);background:var(--panel);color:var(--bad-tx);border-radius:10px;padding:9px 16px;font-weight:800;cursor:pointer">거절</button>${del}`
    : `<button onclick="_reqRevert(${r.id})" style="border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:10px;padding:9px 16px;font-weight:800;cursor:pointer"><i class="fa-solid fa-rotate-left" style="margin-right:5px"></i>대기로 되돌리기</button>${del}`;
  const proc=r.processed_at?`<div class="dim" style="font-size:10px;font-weight:700;margin-top:7px"><i class="fa-solid fa-user-shield" style="margin-right:4px"></i>${escHtml(r.processed_by||'?')} · ${new Date(r.processed_at).toLocaleString('ko-KR')}${r.admin_note?' · 사유: '+escHtml(r.admin_note):''}</div>`:'';
  return `<div class="panel ${st==='pending'?'tone-light':''}" style="border-radius:18px;padding:16px;margin-bottom:12px;${st==='pending'?'border:2px solid var(--bunny-light)':''}">
    <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:11px">
      <span style="font-weight:900;font-size:16px">${escHtml(r.nickname||'-')}</span>
      <span class="chip" style="background:var(--panel-3);color:var(--text);font-weight:800">${escHtml(r.job||'직업?')}</span>
      <span class="chip" style="background:${below?'var(--bad-tx)':'var(--warn-bg)'};color:${below?'#fff':'var(--warn-tx)'};font-weight:800">${below?'⚠ ':''}수로 ${escHtml(suroFmt)}${below?' (1만↓)':''}</span>
      ${r.join_source?`<span class="chip" style="background:rgba(155,89,182,.15);color:#9B59B6;font-weight:800">경로 ${escHtml(r.join_source)}</span>`:''}
      ${r.join_category?`<span class="chip" style="background:var(--bunny-light);color:var(--bunny-deep);font-weight:800">${escHtml(r.join_category)}</span>`:''}
      <span class="dim" style="font-size:11px;font-weight:700">전길드 ${escHtml(r.prev_guild||'-')} · ${dateStr}</span>
      ${wait?`<span style="margin-left:auto">${wait}</span>`:''}
    </div>
    <div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center;background:var(--bad-bg);border-radius:12px;padding:9px 11px;margin-bottom:12px">
      <span style="font-size:11px;font-weight:900;color:var(--bad-tx)"><i class="fa-solid fa-user-shield" style="margin-right:4px"></i>비매너 확인 ${bgN}/3</span>${sbtn('meaegi','메애기')}${sbtn('google','구글')}${sbtn('inven','인벤')}
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:220px">
        ${answers?`<div class="panel" style="border-radius:12px;padding:11px;margin-bottom:8px">${answers}</div>`:'<div class="dim" style="font-size:11px;font-weight:700;margin-bottom:8px">답변 없음</div>'}
        <div style="background:#1e1e28;color:#e8e8ef;border-radius:12px;padding:12px;font-size:11px;line-height:1.6;white-space:pre-wrap;font-family:ui-monospace,monospace">${escHtml(notice)}</div>
        <button onclick="_reqCopyNotice('${encodeURIComponent(notice)}')" style="width:100%;border:0;border-radius:10px;padding:8px;margin-top:6px;font-weight:800;color:#fff;background:#475569;cursor:pointer"><i class="fa-solid fa-copy" style="margin-right:5px"></i>모집공고 복사</button>
        ${proc}
      </div>
      <div style="width:180px;flex-shrink:0">${hands}</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">${actions}</div>
  </div>`;
}
window._reqSetTab=(k)=>{ _reqTab=k; render(); };
window._reqSearch=(site,id,nickEnc)=>{ const nick=decodeURIComponent(nickEnc), n=encodeURIComponent(nick);
  const urls={ meaegi:'https://meaegi.com/s/'+n, google:'https://www.google.com/search?q='+encodeURIComponent('메이플 '+nick), inven:'https://www.inven.co.kr/search/maple/top/'+n+'/1' };
  if(urls[site]) window.open(urls[site],'_blank'); (_reqBg[id]||(_reqBg[id]={}))[site]=true; render(); };
window._reqCopyNotice=(enc)=>{ try{ navigator.clipboard.writeText(decodeURIComponent(enc)); alert('모집공고 복사됨 — 공지방에 붙여넣기'); }catch(e){ alert('복사 실패 — 길게 눌러 복사해주세요'); } };
window._reqRevert=async (id)=>{ if(!isAdmin()) return alert('운영진만 가능해요.'); if(!confirm('이 신청을 대기 상태로 되돌릴까요?')) return; const { error }=await db().from('join_requests').update({ status:'pending', processed_by:null, processed_at:null, admin_note:null }).eq('id',id); if(error) return alert('실패: '+error.message); render(); };
window._reqDelete=async (id)=>{ if(!isAdmin()) return alert('운영진만 가능해요.'); if(!confirm('이 신청을 삭제할까요? (되돌릴 수 없음)')) return; const { error }=await db().from('join_requests').delete().eq('id',id); if(error) return alert('삭제 실패: '+error.message); render(); };

/* ===== 아인슈페너(면제) 신청 처리 — exempt_requests ===== */
async function _reqExemptBody(){
  const { data, error } = await db().from('exempt_requests').select('*').order('created_at',{ascending:false}).limit(300);
  if(error) throw error;
  const all=data||[]; const pending=all.filter(r=>(r.status||'pending')==='pending'); const done=all.filter(r=>r.status&&r.status!=='pending');
  const gl=(g)=>{ const f=Object.values(FACTIONS).find(x=>x.key===g); return f?f.label:(g||'-'); };
  const rtype=(t)=> t==='full'?'전체 면제': t==='partial'?'부분 면제': (t||'면제');
  const card=(r)=>{
    const subs=(Array.isArray(r.sub_chars)?r.sub_chars:[]).map(s=>`<span class="chip" style="background:var(--panel-3);color:var(--text);font-weight:700">${escHtml(s.name||'?')}${s.guild?` <span class="dim" style="font-size:9px">${escHtml(gl(s.guild))}</span>`:''}</span>`).join(' ');
    const st=r.status||'pending';
    const proc=r.processed_at?`<div class="dim" style="font-size:10px;font-weight:700;margin-top:7px"><i class="fa-solid fa-user-shield" style="margin-right:4px"></i>${escHtml(r.processed_by||'?')} · ${new Date(r.processed_at).toLocaleString('ko-KR')}${r.admin_note?' · '+escHtml(r.admin_note):''}</div>`:'';
    const actions = st==='pending'
      ? `<button onclick="_reqExemptAct(${r.id},'approved')" style="flex:1;min-width:120px;border:0;border-radius:10px;padding:9px;font-weight:900;color:#fff;background:#1A8A4A;cursor:pointer"><i class="fa-solid fa-check" style="margin-right:5px"></i>면제 승인</button><button onclick="_reqExemptAct(${r.id},'rejected')" style="border:1px solid var(--bad-tx);background:var(--panel);color:var(--bad-tx);border-radius:10px;padding:9px 16px;font-weight:800;cursor:pointer">거절</button>`
      : `<span class="chip" style="background:${st==='approved'?'var(--ok-bg)':'var(--bad-bg)'};color:${st==='approved'?'var(--ok-tx)':'var(--bad-tx)'};font-weight:800">${st==='approved'?'승인됨':'거절됨'}</span><button onclick="_reqExemptAct(${r.id},'pending')" style="border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:10px;padding:7px 13px;font-weight:800;font-size:12px;cursor:pointer;margin-left:6px">되돌리기</button>`;
    return `<div class="panel ${st==='pending'?'tone-light':''}" style="border-radius:18px;padding:16px;margin-bottom:12px;${st==='pending'?'border:2px solid var(--bunny-light)':''}">
      <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:9px">
        <span style="font-weight:900;font-size:16px">${escHtml(r.main_char||'-')}</span>
        <span class="chip" style="background:var(--panel-3);color:var(--text);font-weight:800">${escHtml(r.main_class||'직업?')}</span>
        <span class="chip" style="background:var(--bunny-light);color:var(--bunny-deep);font-weight:800">${escHtml(gl(r.main_guild))}</span>
        <span class="chip" style="background:var(--warn-bg);color:var(--warn-tx);font-weight:800">수로 ${(Number(r.main_score)||0).toLocaleString()}</span>
        <span class="chip" style="background:rgba(155,89,182,.15);color:#9B59B6;font-weight:800">${rtype(r.request_type)}</span>
        ${r.is_new_member?'<span class="chip" style="background:var(--ok-bg);color:var(--ok-tx);font-weight:800">신규</span>':''}
        ${r.kakao_nick?`<span class="dim" style="font-size:11px;font-weight:700"><i class="fa-solid fa-comment" style="margin-right:3px"></i>${escHtml(r.kakao_nick)}</span>`:''}
        <span class="dim" style="font-size:11px;font-weight:700;margin-left:auto">${new Date(r.created_at).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
      </div>
      ${subs?`<div style="margin-bottom:9px"><span class="dim" style="font-size:11px;font-weight:800;margin-right:6px">면제 부캐</span>${subs}</div>`:''}
      ${r.reason?`<div class="panel" style="border-radius:12px;padding:11px;font-size:12.5px;font-weight:600;white-space:pre-wrap;margin-bottom:10px">${escHtml(r.reason)}</div>`:''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">${actions}</div>${proc}
    </div>`;
  };
  const doneRow=(r)=>`<tr style="border-bottom:1px solid var(--line)"><td style="padding:9px 8px;font-weight:800">${escHtml(r.main_char||'-')}</td><td class="dim" style="font-weight:700">${rtype(r.request_type)}</td><td>${r.status==='approved'?'<span class="chip" style="background:var(--ok-bg);color:var(--ok-tx)">승인</span>':'<span class="chip" style="background:var(--bad-bg);color:var(--bad-tx)">거절</span>'}</td><td class="dim" style="font-weight:700">${(r.processed_at||r.created_at||'').slice(0,10)}</td></tr>`;
  return `<div>${pending.length?pending.map(card).join(''):'<div class="panel" style="border-radius:18px;padding:40px;text-align:center"><span class="dim" style="font-weight:800"><i class="fa-solid fa-mug-hot" style="margin-right:6px"></i>대기 중인 아인슈페너(면제) 신청이 없어요</span></div>'}</div>
    ${done.length?`<h3 style="font-weight:900;font-size:15px;margin:22px 0 12px"><i class="fa-solid fa-clock-rotate-left" style="color:var(--bunny-main);margin-right:8px"></i>처리 완료 (${done.length})</h3>
    <div class="panel" style="border-radius:20px;padding:16px"><div class="scroll" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px;min-width:420px"><thead><tr class="dim" style="font-size:12px;font-weight:700;border-bottom:2px solid var(--line)"><th style="text-align:left;padding:9px 8px">대표</th><th style="text-align:left;padding:9px 0">유형</th><th style="text-align:left;padding:9px 0">결과</th><th style="text-align:left;padding:9px 0">처리일</th></tr></thead><tbody style="font-weight:500">${done.map(doneRow).join('')}</tbody></table></div></div>`:''}`;
}
window._reqExemptAct=async (id,status)=>{
  if(!isAdmin()) return alert('운영진만 처리할 수 있어요.');
  const me=CURRENT.name||CURRENT.email||'운영진';
  if(status==='pending'){ if(!confirm('대기 상태로 되돌릴까요?')) return; const { error }=await db().from('exempt_requests').update({ status:'pending', processed_by:null, processed_at:null, admin_note:null }).eq('id',id); if(error) return alert('실패: '+error.message); return render(); }
  let note=null; if(status==='rejected'){ note=prompt('거절 사유 (선택)','')||null; }
  if(!confirm(status==='approved'?'이 면제 신청을 승인할까요? (해당 부캐 수로 면제)':'이 면제 신청을 거절할까요?')) return;
  const { error }=await db().from('exempt_requests').update({ status, processed_by:me, processed_at:new Date().toISOString(), admin_note:note }).eq('id',id);
  if(error) return alert('처리 실패: '+error.message); render();
};

/* ===== 수로 보석금 신청 처리 — bail_requests ===== */
async function _reqBailBody(){
  const { data, error } = await db().from('bail_requests').select('*').eq('payer_guild',GUILD).order('created_at',{ascending:false}).limit(300);
  if(error) throw error;
  const all=data||[]; const pending=all.filter(r=>(r.status||'pending')==='pending'); const done=all.filter(r=>r.status&&r.status!=='pending');
  const stLabel=(s)=> s==='noble_unlocked'?['노블 해제됨','var(--ok-bg)','var(--ok-tx)']: s==='rejected'?['거절됨','var(--bad-bg)','var(--bad-tx)']: s==='paid'?['입금확인','var(--ok-bg)','var(--ok-tx)']:['대기','var(--warn-bg)','var(--warn-tx)'];
  const card=(r)=>{
    const st=r.status||'pending'; const proc=r.processed_at?`<div class="dim" style="font-size:10px;font-weight:700;margin-top:7px"><i class="fa-solid fa-user-shield" style="margin-right:4px"></i>${escHtml(r.unlocked_by||r.processed_by||'?')} · ${new Date(r.processed_at).toLocaleString('ko-KR')}${r.admin_note?' · '+escHtml(r.admin_note):''}</div>`:'';
    const img=r.proof_image_url?`<a href="${escAttr(r.proof_image_url)}" target="_blank"><img src="${escAttr(r.proof_image_url)}" style="width:130px;max-height:150px;object-fit:contain;border-radius:12px;background:var(--panel-2);border:1px solid var(--line)" loading="lazy"></a>`:'<div style="font-size:10px;color:var(--warn-tx);background:var(--warn-bg);border-radius:10px;padding:10px;text-align:center;font-weight:700;width:130px">인증샷 없음</div>';
    const sl=stLabel(st);
    const actions = st==='pending'
      ? `<button onclick="_reqBailAct(${r.id},'unlock')" style="flex:1;min-width:140px;border:0;border-radius:10px;padding:9px;font-weight:900;color:#fff;background:#1A8A4A;cursor:pointer"><i class="fa-solid fa-unlock" style="margin-right:5px"></i>입금확인 · 노블 해제</button><button onclick="_reqBailAct(${r.id},'reject')" style="border:1px solid var(--bad-tx);background:var(--panel);color:var(--bad-tx);border-radius:10px;padding:9px 16px;font-weight:800;cursor:pointer">거절</button>`
      : `<span class="chip" style="background:${sl[1]};color:${sl[2]};font-weight:800">${sl[0]}</span><button onclick="_reqBailAct(${r.id},'revert')" style="border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:10px;padding:7px 13px;font-weight:800;font-size:12px;cursor:pointer;margin-left:6px">되돌리기</button>`;
    return `<div class="panel ${st==='pending'?'tone-light':''}" style="border-radius:18px;padding:16px;margin-bottom:12px;${st==='pending'?'border:2px solid var(--bunny-light)':''}">
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:220px">
          <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:8px">
            <span style="font-weight:900;font-size:16px">${escHtml(r.payer_char||r.main_char||'-')}</span>
            ${r.payer_role?memRoleChip(r.payer_role):''}
            <span class="chip" style="background:var(--bunny-deep);color:#fff;font-weight:900"><i class="fa-solid fa-gem" style="font-size:9px;margin-right:3px"></i>${Number(r.total_amount)||0}개</span>
            ${r.offense_count>1?`<span class="chip" style="background:var(--bad-bg);color:var(--bad-tx);font-weight:800">${r.offense_count}회차 누적 ×${r.multiplier||1}</span>`:''}
            <span class="dim" style="font-size:11px;font-weight:700;margin-left:auto">${new Date(r.created_at).toLocaleString('ko-KR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
          </div>
          <div class="dim" style="font-size:12px;font-weight:700;margin-bottom:4px"><i class="fa-solid fa-calendar-xmark" style="margin-right:5px"></i>미참 회차: ${escHtml((r.miss_period_label||'-').replace(' 수로 점수',''))}</div>
          ${r.half_year?`<div class="dim" style="font-size:11px;font-weight:700">반기 ${escHtml(r.half_year)}${r.kakao_nick?' · 카톡 '+escHtml(r.kakao_nick):''}</div>`:''}
          ${r.reason?`<div class="panel" style="border-radius:12px;padding:10px;font-size:12px;font-weight:600;margin-top:8px">${escHtml(r.reason)}</div>`:''}
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px">${actions}</div>${proc}
        </div>
        <div style="flex-shrink:0">${img}</div>
      </div>
    </div>`;
  };
  return `<div>${pending.length?pending.map(card).join(''):'<div class="panel" style="border-radius:18px;padding:40px;text-align:center"><span class="dim" style="font-weight:800"><i class="fa-solid fa-gem" style="margin-right:6px"></i>대기 중인 보석금 신청이 없어요</span></div>'}</div>
    ${done.length?`<h3 style="font-weight:900;font-size:15px;margin:22px 0 12px"><i class="fa-solid fa-clock-rotate-left" style="color:var(--bunny-main);margin-right:8px"></i>처리 완료 (${done.length})</h3>
    <div class="panel" style="border-radius:20px;padding:16px"><div class="scroll" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px;min-width:420px"><thead><tr class="dim" style="font-size:12px;font-weight:700;border-bottom:2px solid var(--line)"><th style="text-align:left;padding:9px 8px">납부자</th><th style="text-align:left;padding:9px 0">조각</th><th style="text-align:left;padding:9px 0">상태</th><th style="text-align:left;padding:9px 0">처리일</th></tr></thead><tbody style="font-weight:500">${done.map(r=>{ const sl=stLabel(r.status); return `<tr style="border-bottom:1px solid var(--line)"><td style="padding:9px 8px;font-weight:800">${escHtml(r.payer_char||r.main_char||'-')}</td><td class="dim" style="font-weight:800">${Number(r.total_amount)||0}개</td><td><span class="chip" style="background:${sl[1]};color:${sl[2]}">${sl[0]}</span></td><td class="dim" style="font-weight:700">${(r.processed_at||r.created_at||'').slice(0,10)}</td></tr>`; }).join('')}</tbody></table></div></div>`:''}`;
}
window._reqBailAct=async (id,action)=>{
  if(!isAdmin()) return alert('운영진만 처리할 수 있어요.');
  const me=CURRENT.name||CURRENT.email||'운영진'; const now=new Date().toISOString();
  if(action==='unlock'){ if(!confirm('입금 확인 완료 → 노블 해제 처리할까요?')) return; const { error }=await db().from('bail_requests').update({ status:'noble_unlocked', processed_by:me, processed_at:now, unlocked_by:me, unlocked_at:now }).eq('id',id); if(error) return alert('처리 실패: '+error.message); }
  else if(action==='reject'){ const note=prompt('거절 사유 (선택)','')||null; if(!confirm('이 보석금 신청을 거절할까요?')) return; const { error }=await db().from('bail_requests').update({ status:'rejected', processed_by:me, processed_at:now, admin_note:note }).eq('id',id); if(error) return alert('처리 실패: '+error.message); }
  else if(action==='revert'){ if(!confirm('대기 상태로 되돌릴까요?')) return; const { error }=await db().from('bail_requests').update({ status:'pending', processed_by:null, processed_at:null, unlocked_by:null, unlocked_at:null, admin_note:null }).eq('id',id); if(error) return alert('실패: '+error.message); }
  render();
};
window._joinAct = async (id, status)=>{
  if(!isAdmin()) return alert('운영진만 처리할 수 있어요. 로그인 후 이용해주세요.');
  const me = CURRENT.name || CURRENT.email || '운영진';
  let r=null; try{ const {data}=await db().from('join_requests').select('*').eq('id',id).single(); r=data; }catch(e){}
  if(status==='approved'){
    const suroNum=Number(String(r?.suro_score||'').replace(/[^\d]/g,''))||0;
    let msg='이 가입 신청을 승인할까요?\n· 상태 → 승인\n· 영구기록(member_records)에 자동 등록';
    if(suroNum>0&&suroNum<10000) msg='⚠ 수로 점수 '+suroNum.toLocaleString()+'점 (가입 기준 10,000 미만)\n그래도 승인할까요?\n\n'+msg;
    if(!confirm(msg)) return;
    const { error } = await db().from('join_requests').update({ status:'approved', processed_by:me, processed_at:new Date().toISOString() }).eq('id',id);
    if(error) return alert('처리 실패: '+error.message);
    let reasonAns=''; if(Array.isArray(r?.answers)){ const f=r.answers.find(x=>x&&x.q&&String(x.q).includes('이유')); reasonAns=f?.a||''; }
    const rec={ join_date:new Date().toISOString().slice(0,10), nickname:r?.nickname, job_class:r?.job||'', suro_score:r?.suro_score||'', prev_guild:r?.prev_guild||'', join_source:r?.join_source||'', join_category:r?.join_category||'', join_reason:reasonAns, status:'active' };
    const { error:re } = await db().from('member_records').insert(rec);
    alert(re ? ('승인됨 — 단 영구기록 등록 실패: '+re.message) : '가입 승인 + 영구기록 자동 등록 완료 ✓');
  } else {
    const reason=prompt('거절 사유 (선택)','')||null;
    if(!confirm('이 가입 신청을 거절할까요?')) return;
    const { error } = await db().from('join_requests').update({ status:'rejected', processed_by:me, processed_at:new Date().toISOString(), admin_note:reason }).eq('id',id);
    if(error) return alert('처리 실패: '+error.message);
    alert('거절 처리됨');
  }
  render();
};

/* ----- 보석금 관리 (창고 잔액 + 입출금 내역) ----- */
async function buildBail(){
  const WH = GUILD + ' 길드창고';
  const num = (n)=> (Number(n)||0).toLocaleString('ko-KR');
  const [{data:hist,error:e1},{data:reqs,error:e2}] = await Promise.all([
    db().from('bail_history').select('date,payer,receiver,amount,memo').order('date',{ascending:false}).limit(800),
    db().from('bail_requests').select('payer_char,total_amount,status,payer_guild,created_at').eq('payer_guild',GUILD).order('created_at',{ascending:false}).limit(500),
  ]);
  if(e1) throw e1;
  const mine=(hist||[]).filter(h=>h.receiver===WH||h.payer===WH);
  const inAmt=mine.filter(h=>h.receiver===WH).reduce((s,h)=>s+(+h.amount||0),0);
  const outAmt=mine.filter(h=>h.payer===WH).reduce((s,h)=>s+(+h.amount||0),0);
  const reqTotal=(reqs||[]).reduce((s,r)=>s+(+r.total_amount||0),0);
  const kpi=(label,val,tone,ic,col)=>`<div class="panel ${tone}" style="border-radius:22px;padding:20px;display:flex;flex-direction:column;justify-content:space-between;min-height:120px">
    <div style="display:flex;justify-content:space-between"><span class="dim" style="font-size:13px;font-weight:700">${label}</span><i class="fa-solid ${ic}" style="color:${col}"></i></div>
    <p style="font-size:30px;font-weight:900;margin:6px 0 0">${val}</p></div>`;
  const rows=mine.slice(0,60).map(h=>`<tr style="border-bottom:1px solid var(--line)">
    <td class="dim" style="padding:10px 8px;font-weight:700">${(h.date||'').slice(0,10)}</td>
    <td style="font-weight:700">${dispGuildStr(h.payer)||'-'} <i class="fa-solid fa-arrow-right dim" style="font-size:10px;margin:0 4px"></i> ${dispGuildStr(h.receiver)||'-'}</td>
    <td style="font-weight:900;color:${h.receiver===WH?'var(--ok-tx)':'var(--bad-tx)'}">${h.receiver===WH?'+':'-'}${num(h.amount)}</td>
    <td class="dim" style="font-weight:600;font-size:13px">${h.memo||''}</td></tr>`).join('');
  return headerHTML('보석금 관리', `${fac().label} 창고 잔액 ${num(inAmt-outAmt)}`) +
    `<div class="bento" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px">
      ${kpi('창고 잔액', num(inAmt-outAmt),'tone-rose','fa-vault','#fff')}
      ${kpi('총 입금','+'+num(inAmt),'tone-light','fa-arrow-down','var(--ok-tx)')}
      ${kpi('총 출금','-'+num(outAmt),'tone-light','fa-arrow-up','var(--bad-tx)')}
      ${kpi('보석금 처리',(reqs||[]).length+'건','tone-cream','fa-gem','var(--bunny-deep)')}
    </div>
    <div class="panel" style="border-radius:24px;padding:20px">
      <h3 style="font-weight:900;font-size:16px;margin:0 0 14px"><i class="fa-solid fa-right-left" style="color:var(--bunny-main);margin-right:8px"></i>창고 입출금 내역 <span class="dim" style="font-size:13px;font-weight:700">(${mine.length}건)</span></h3>
      <div class="scroll" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px;min-width:560px">
        <thead><tr class="dim" style="font-size:12px;font-weight:700;border-bottom:2px solid var(--line)"><th style="text-align:left;padding:10px 8px">날짜</th><th style="text-align:left;padding:10px 0">이동</th><th style="text-align:left;padding:10px 0">금액</th><th style="text-align:left;padding:10px 0">메모</th></tr></thead>
        <tbody style="font-weight:500">${rows||'<tr><td colspan="4" class="dim" style="padding:30px;text-align:center;font-weight:700">내역 없음</td></tr>'}</tbody></table></div>
    </div>`;
}

/* ----- 벌점 ----- */
async function buildPenalty(){
  const { data, error } = await db().from('penalty_history').select('date,name,points,reason').order('date',{ascending:false}).limit(500);
  if(error) throw error;
  const all=data||[];
  const byName={}; all.forEach(p=>{ byName[p.name]=(byName[p.name]||0)+(+p.points||0); });
  const tops=Object.entries(byName).sort((a,b)=>b[1]-a[1]);
  const chips=tops.map(([n,pt])=>`<span class="chip" style="background:var(--panel-2);color:var(--text);font-size:13px;padding:6px 12px"><b style="color:var(--bad-tx)">${pt}점</b> · ${n}</span>`).join(' ');
  const rows=all.map(p=>`<tr style="border-bottom:1px solid var(--line)">
    <td class="dim" style="padding:10px 8px;font-weight:700">${(p.date||'').slice(0,10)}</td>
    <td style="font-weight:800">${p.name||'-'}</td>
    <td style="font-weight:900;color:var(--bad-tx)">+${p.points||0}</td>
    <td class="dim" style="font-weight:600">${p.reason||'-'}</td></tr>`).join('');
  return headerHTML('벌점', `총 ${all.length}건`) +
    `<div class="panel" style="border-radius:20px;padding:18px;margin-bottom:18px">
      <h3 style="font-weight:900;font-size:15px;margin:0 0 12px">멤버별 누적 벌점</h3>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${chips||'<span class="dim" style="font-weight:700">없음</span>'}</div>
    </div>
    <div class="panel" style="border-radius:24px;padding:20px">
      <h3 style="font-weight:900;font-size:16px;margin:0 0 14px"><i class="fa-solid fa-flag" style="color:var(--bad-tx);margin-right:8px"></i>벌점 이력</h3>
      <div class="scroll" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px;min-width:480px">
        <thead><tr class="dim" style="font-size:12px;font-weight:700;border-bottom:2px solid var(--line)"><th style="text-align:left;padding:10px 8px">날짜</th><th style="text-align:left;padding:10px 0">닉네임</th><th style="text-align:left;padding:10px 0">벌점</th><th style="text-align:left;padding:10px 0">사유</th></tr></thead>
        <tbody style="font-weight:500">${rows||'<tr><td colspan="4" class="dim" style="padding:30px;text-align:center;font-weight:700">벌점 내역 없음</td></tr>'}</tbody></table></div>
    </div>`;
}

/* ----- 가입 신청 (멤버 제출 폼) ----- */
let _joinCuts=null;
function _fmtMan(n){ return n>=100000?(n/10000).toFixed(0)+'만':(n/10000).toFixed(1).replace(/\.0$/,'')+'만'; }
function _joinSliderBg(c){ const p=s=>Math.min(s/300000*100,100); return `linear-gradient(to right,#f3f4f6 0%,#f3f4f6 ${p(10000)}%,#dbeafe ${p(10000)}%,#dbeafe ${p(c.cut_last+5000)}%,#fed7aa ${p(c.cut_last+5000)}%,#fed7aa ${p(c.cut180)}%,#fef08a ${p(c.cut180)}%,#fef08a ${p(c.cut90)}%,#d1fae5 ${p(c.cut90)}%,#d1fae5 ${p(c.top51)}%,#fce7f3 ${p(c.top51)}%,#fce7f3 100%)`; }
function _joinRankFor(v,c){
  if(!c) return {rank:'로딩 중',msg:'최근 점수 가져오는 중',color:'var(--dim)'};
  const joinCut=c.cut_last+5000;
  if(v<10000) return {rank:'❌ 가입 불가',msg:'1만점 미만은 신청 거절',color:'#C03A3A'};
  if(v<joinCut) return {rank:'🥖 늑대 (2기)',msg:`1기 컷 ${_fmtMan(joinCut)} 미달 — 꼴등 ${_fmtMan(c.cut_last)}+5천 필요`,color:'#2a87a6'};
  if(v<c.cut180) return {rank:'🥞 팬케이크 (1기 강등권)',msg:'하위 20명 범위 — 매주 강등 위협',color:'#B07A10'};
  if(v<c.cut90)  return {rank:'⚡ 변동성 위험',msg:'90~180등 — 작은 변동에도 강등 가능',color:'#9a8200'};
  if(v<c.top51)  return {rank:'🍰 롤케이크 (안정권)',msg:'TOP 90 이내 — 강등 거의 없음',color:'#1A8A4A'};
  if(v<c.top21)  return {rank:'🎂 티라미슈',msg:'TOP 21~51 (부캐 All 면제 + 숫돌 24개)',color:'#B5446E'};
  if(v<c.top5)   return {rank:'🍨 파르페',msg:'TOP 6~20 (별도 풀 분배)',color:'#B5446E'};
  if(v<c.top1)   return {rank:'👑 크라운',msg:'TOP 1~5 (100억 분배)',color:'#9D174D'};
  return {rank:'👑 TOP 1',msg:'1위 (28% 분배)',color:'#9D174D'};
}
window._joinScoreUpdate=()=>{ const sl=document.getElementById('jf_score'); if(!sl)return; const v=Number(sl.value); const r=_joinRankFor(v,_joinCuts); const vEl=document.getElementById('jf_scoreVal'),rEl=document.getElementById('jf_scoreRank'),mEl=document.getElementById('jf_scoreMsg'); if(vEl)vEl.textContent=v.toLocaleString(); if(rEl){rEl.textContent=r.rank;rEl.style.color=r.color;} if(mEl){mEl.textContent=r.msg;mEl.style.color=r.color;} };
async function buildJoinForm(){
  _joinCuts=null;
  try{
    const {data:periods}=await db().from('suro_periods').select('id,period_label').order('period_label',{ascending:false}).limit(1);
    if(periods&&periods[0]){
      const {data:scores}=await db().from('suro_scores').select('score').eq('period_id',periods[0].id).eq('guild',GUILD).gt('score',0).order('score',{ascending:false}).limit(4000);
      if(scores&&scores.length){ const total=scores.length, at=(i)=>scores[Math.min(Math.max(i,0),total-1)]?.score||0;
        _joinCuts={ cut_last:at(total-1),cut180:at(179),cut90:at(89),top51:at(50),top21:at(20),top5:at(4),top1:at(0),avg:Math.round(scores.reduce((s,x)=>s+x.score,0)/total),total,label:periods[0].period_label }; }
    }
  }catch(e){}
  const c=_joinCuts; const initV=c?Math.round(c.cut90/5000)*5000:50000; const init=_joinRankFor(initV,c); const gaugeBg=c?_joinSliderBg(c):'var(--panel-2)';
  const cats=['지인 추천','길드 혜택/성장','홍보물/길드 이미지','재가입/복귀','기타'];
  const fld=(label,inner)=>`<div style="margin-bottom:16px"><label style="display:block;font-weight:800;font-size:13px;margin-bottom:6px">${label}</label>${inner}</div>`;
  const inp='width:100%;border:1px solid var(--line);background:var(--panel-2);border-radius:12px;padding:11px 14px;font-size:14px;font-weight:600;color:var(--text);outline:0;';
  return headerHTML('가입 신청',`${fac().label} 길드에 들어오기`) +
    `<div class="panel" style="border-radius:24px;padding:26px;max-width:620px">
      ${fld('닉네임 *', `<input id="jf_nick" style="${inp}" placeholder="메이플 캐릭터 닉네임">`)}
      <div style="margin-bottom:16px">
        <label style="display:block;font-weight:800;font-size:13px;margin-bottom:6px">수로 점수 * <span class="dim" style="font-weight:600">— 슬라이더로 예상 직위 확인</span></label>
        <div class="panel tone-light" style="border-radius:16px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px;gap:10px">
            <div style="min-width:0"><div class="dim" style="font-size:10px;font-weight:700">예상 직위 / 기수</div><div id="jf_scoreRank" style="font-size:16px;font-weight:900;color:${init.color}">${init.rank}</div><div id="jf_scoreMsg" style="font-size:10px;font-weight:700;color:${init.color}">${init.msg}</div></div>
            <div style="text-align:right;flex-shrink:0"><div class="dim" style="font-size:10px;font-weight:700">수로 점수</div><div style="font-size:24px;font-weight:900;color:var(--bunny-deep)"><span id="jf_scoreVal">${initV.toLocaleString()}</span></div></div>
          </div>
          <input id="jf_score" type="range" min="0" max="300000" step="1000" value="${initV}" oninput="_joinScoreUpdate()" style="width:100%;height:16px;border-radius:8px;-webkit-appearance:none;appearance:none;cursor:pointer;background:${gaugeBg}">
          <div class="dim" style="font-size:10px;font-weight:700;margin-top:8px;text-align:center">${c?'기준: '+escHtml(c.label.slice(0,17))+' · 버니 '+c.total+'명 · 매주 변동':'최근 점수 로딩 실패 — 점수만 참고'}</div>
        </div>
      </div>
      ${fld('직업 *', `<input id="jf_job" style="${inp}" placeholder="예: 나이트로드">`)}
      ${fld('이전 길드', `<input id="jf_prev" style="${inp}" placeholder="없으면 비워두세요">`)}
      ${fld('가입 경로', `<select id="jf_cat" style="${inp}">${cats.map(c=>`<option>${c}</option>`).join('')}</select>`)}
      ${fld('하고 싶은 말', `<textarea id="jf_ans" rows="3" style="${inp};resize:vertical" placeholder="간단한 자기소개나 각오 한마디"></textarea>`)}
      <button onclick="_joinSubmit()" style="width:100%;border:0;border-radius:14px;padding:14px;font-weight:900;font-size:15px;color:#fff;background:linear-gradient(135deg,var(--bunny-main),var(--bunny-deep));cursor:pointer;margin-top:6px">가입 신청하기 🐰</button>
      <p class="dim" style="font-size:12px;font-weight:700;margin:14px 0 0;text-align:center">신청은 운영진 검토 후 처리돼요</p>
    </div>`;
}
window._joinSubmit = async ()=>{
  const v=id=>document.getElementById(id).value.trim();
  const nick=v('jf_nick'), job=v('jf_job'); const scoreNum=Number(document.getElementById('jf_score')?.value||0);
  if(!nick||!job) return alert('닉네임·직업은 필수예요.');
  if(scoreNum<10000 && !confirm('수로 점수 1만점 미만은 가입 거절될 수 있어요. 그래도 신청할까요?')) return;
  const ansText=v('jf_ans'); const answers=ansText?[{ q:'하고 싶은 말', a:ansText }]:[];
  const row={ nickname:nick, suro_score:scoreNum.toLocaleString(), job, prev_guild:v('jf_prev')||null, join_category:v('jf_cat')||null, answers, status:'pending', join_source:'가입신청폼' };
  const { error } = await db().from('join_requests').insert(row);
  if(error) return alert('신청 실패: '+error.message);
  document.getElementById('pageBody').innerHTML = headerHTML('가입 신청','신청 완료') +
    `<div class="panel" style="border-radius:24px;padding:50px;text-align:center;max-width:620px">
      <div style="font-size:46px;margin-bottom:12px">🐰💌</div>
      <h3 style="font-weight:900;font-size:20px;margin:0 0 8px">가입 신청이 접수됐어요!</h3>
      <p class="dim" style="font-weight:700;margin:0">운영진이 검토 후 처리할게요. 조금만 기다려주세요.</p></div>`;
};

/* ----- 수로 분석 (ddun 원본 포팅: 평균·최근주차 비교·변동·MVP·총점 추이·참여) ----- */
let _anRaw=null, _anSortField='last', _anSortOrder='desc', _anSearch='', _anClass='', _anRole='';
const _anFmt=(n)=>(Number(n)||0).toLocaleString('ko-KR');
function _anShort(label){ const s=String(label||'').split('~'); let r=(s.length>1?s[1]:s[0]).replace('수로 점수','').trim(); const p=r.split('-'); return p.length>=3?(p[1]+'-'+p[2].slice(0,2)):r; }
function _anSpark(vals){
  if(!vals.length) return '';
  const w=Math.max(140,vals.length*34), h=46, mx=Math.max(...vals,1), n=vals.length;
  const X=i=> n>1?(i/(n-1))*(w-8)+4:w/2, Y=v=> h-4-(v/mx)*(h-13);
  const pts=vals.map((v,i)=>`${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ');
  const area=`4,${h-4} ${pts} ${X(n-1).toFixed(1)},${h-4}`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:46px;display:block"><polygon points="${area}" fill="rgba(255,143,171,.13)"/><polyline points="${pts}" fill="none" stroke="var(--bunny-deep)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${vals.map((v,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="2.4" fill="var(--bunny-main)"/>`).join('')}</svg>`;
}
async function buildAnalysis(){
  const { data:periods, error:ep } = await db().from('suro_periods').select('id,period_label,start_date').order('start_date',{ascending:false}).limit(80);
  if(ep) throw ep;
  const win=(periods||[]).slice(0,16).reverse();   // 최근 16주차, 과거→최신
  const ids=win.map(p=>p.id);
  const memP=db().from('members').select('id,name,role,class,is_main').eq('guild',GUILD).eq('is_main',true).limit(3000);
  // 회차당 병렬 쿼리 → Supabase 행 제한(1000) 우회
  const [{data:mem,error:em}, ...scoreRes] = await Promise.all([ memP, ...ids.map(id=>db().from('suro_scores').select('member_id,score').eq('guild',GUILD).eq('period_id',id).limit(4000)) ]);
  if(em) throw em;
  const byMem={};
  scoreRes.forEach((res,idx)=>{ const pid=ids[idx]; (res.data||[]).forEach(s=>{ (byMem[s.member_id]||(byMem[s.member_id]={}))[pid]=Number(s.score)||0; }); });
  _anRaw={ periods:win, members:(mem||[]), byMem };
  _anSortField='avg'; _anSortOrder='desc'; _anSearch=''; _anClass=''; _anRole='';   // ddun 원본대로 평균 내림차순 기본(최근주차 미참자가 추락하지 않게)
  return headerHTML('수로 분석',`${fac().label} · 최근 ${win.length}주차 분석`) + _anControls() + `<div id="anBody">${_anRender()}</div>`;
}
function _anControls(){
  if(!_anRaw) return '';
  const cls=[...new Set(_anRaw.members.map(m=>(m.class||'').trim()).filter(Boolean))].sort();
  const rol=[...new Set(_anRaw.members.map(m=>(m.role||'').trim()).filter(Boolean))].sort();
  const ss='border:1px solid var(--line);background:var(--panel-2);border-radius:10px;padding:8px 11px;font-weight:800;font-size:13px;color:var(--text);outline:0';
  return `<div class="panel" style="border-radius:16px;padding:11px 13px;margin-bottom:14px;display:flex;gap:9px;align-items:center;flex-wrap:wrap">
    <div style="display:flex;align-items:center;gap:7px;background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:0 11px;flex:1;min-width:160px"><i class="fa-solid fa-magnifying-glass dim"></i><input id="an_q" value="${escAttr(_anSearch)}" oninput="_anSetSearch(this.value)" placeholder="닉네임·직업 검색…" style="border:0;background:transparent;flex:1;padding:8px 0;font-weight:800;font-size:13px;color:var(--text);outline:0"></div>
    <select onchange="_anSetClass(this.value)" style="${ss}"><option value="">직업 전체</option>${cls.map(c=>`<option value="${escAttr(c)}"${c===_anClass?' selected':''}>${escHtml(c)}</option>`).join('')}</select>
    <select onchange="_anSetRole(this.value)" style="${ss}"><option value="">직위 전체</option>${rol.map(r=>`<option value="${escAttr(r)}"${r===_anRole?' selected':''}>${escHtml(r)}</option>`).join('')}</select>
  </div>`;
}
function _anRender(){
  if(!_anRaw || !_anRaw.periods.length) return `<div class="panel" style="border-radius:24px;padding:40px;text-align:center"><span class="dim" style="font-weight:700">회차 데이터가 없어요</span></div>`;
  const { periods, members, byMem } = _anRaw;
  const recent=periods.slice(-4), cur=recent[recent.length-1];
  const sc=(id,p)=> (byMem[id]&&byMem[id][p.id])||0;
  // 요약·MVP: 전체 대상(필터 무관)
  const A=members.map(m=>{ const c=cur?sc(m.id,cur):0; const pv=recent.length>1?sc(m.id,recent[recent.length-2]):0; const ps=recent.slice(0,-1).map(p=>sc(m.id,p)).filter(v=>v>0); const pa=ps.length?Math.round(ps.reduce((a,b)=>a+b,0)/ps.length):0; return {name:m.name||'',c,pv,pa}; });
  const total=A.reduce((s,x)=>s+x.c,0), part=A.filter(x=>x.c>0).length, missN=A.length-part, avgCur=part?Math.round(total/part):0;
  const high=A.filter(x=>x.c>0).map(x=>({name:x.name,v:x.c})).sort((a,b)=>b.v-a.v).slice(0,5);
  const up=A.filter(x=>x.pv>0&&x.c>x.pv).map(x=>({name:x.name,v:x.c-x.pv})).sort((a,b)=>b.v-a.v).slice(0,5);
  const pctl=A.filter(x=>x.pv>0&&x.c>x.pv).map(x=>({name:x.name,v:(x.c-x.pv)/x.pv*100})).sort((a,b)=>b.v-a.v).slice(0,5);
  const abv=A.filter(x=>x.pa>0&&x.c>x.pa).map(x=>({name:x.name,v:x.c-x.pa})).sort((a,b)=>b.v-a.v).slice(0,5);
  const trend=periods.map(p=>members.reduce((s,m)=>s+sc(m.id,p),0));
  // 표 rows (필터+정렬)
  const tokens=_anSearch.trim().toLowerCase().split(/[\s,]+/).filter(Boolean);
  let rows=members.map(m=>{ const rs=recent.map(p=>sc(m.id,p)); const ao=periods.map(p=>sc(m.id,p)).filter(v=>v>0); return {name:m.name||'',role:(m.role||'').trim(),cls:(m.class||'').trim(),rs,avg:ao.length?Math.round(ao.reduce((a,b)=>a+b,0)/ao.length):0}; })
    .filter(r=>{ if(_anClass&&r.cls!==_anClass)return false; if(_anRole&&r.role!==_anRole)return false; if(!tokens.length)return true; return tokens.some(t=>r.name.toLowerCase().includes(t)||r.cls.toLowerCase().includes(t)); });
  const last=r=>r.rs[r.rs.length-1]||0, o=_anSortOrder==='asc'?1:-1;
  rows.sort((a,b)=>{ if(_anSortField==='name')return (a.name<b.name?-1:a.name>b.name?1:0)*o; if(_anSortField==='avg')return (a.avg-b.avg)*o; if(_anSortField.indexOf('date_')===0){const i=recent.findIndex(p=>'date_'+p.id===_anSortField);return ((a.rs[i]||0)-(b.rs[i]||0))*o;} return (last(a)-last(b))*o; });
  const ic=f=> _anSortField===f?(_anSortOrder==='asc'?' <i class="fa-solid fa-caret-up"></i>':' <i class="fa-solid fa-caret-down"></i>'):'';
  const kpi=(l,v,tone,c)=>`<div class="panel ${tone}" style="border-radius:18px;padding:15px;display:flex;flex-direction:column;gap:4px;min-height:88px;justify-content:center"><span class="dim" style="font-size:12px;font-weight:700">${l}</span><p style="font-size:24px;font-weight:900;margin:0;color:${c||'inherit'}">${v}</p></div>`;
  const mvp=(t,emo,col,list,f)=>`<div style="flex:1;min-width:135px"><div style="font-weight:900;font-size:12.5px;color:${col};margin-bottom:7px">${emo} ${t}</div>${list.length?list.map((x,i)=>`<div style="display:flex;justify-content:space-between;gap:6px;font-size:12px;padding:2.5px 0"><span style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:96px"><b style="color:${col}">${i+1}</b> ${escHtml(x.name)}</span><b style="color:${col};white-space:nowrap">${f(x.v)}</b></div>`).join(''):'<div class="dim" style="font-size:11px;font-weight:700">데이터 부족</div>'}</div>`;
  const head=`<tr class="dim" style="font-size:11px;font-weight:800;border-bottom:2px solid var(--line);position:sticky;top:0;background:var(--panel)">
    <th style="text-align:center;padding:9px 4px;width:34px">#</th>
    <th style="text-align:left;padding:9px 6px;cursor:pointer" onclick="_anSort('name')">캐릭터${ic('name')}</th>
    <th style="text-align:center;padding:9px 4px;cursor:pointer;color:var(--bunny-deep)" onclick="_anSort('avg')">평균${ic('avg')}</th>
    ${recent.map((p,i)=>`<th style="text-align:right;padding:9px 4px;cursor:pointer;${i===recent.length-1?'color:var(--bunny-deep);font-weight:900':''}" onclick="_anSort('date_${p.id}')">${_anShort(p.period_label)}${ic('date_'+p.id)}</th>`).join('')}
    <th style="text-align:center;padding:9px 4px;width:54px">변동</th></tr>`;
  const tbody=rows.map((r,i)=>{
    const ls=r.rs[r.rs.length-1]||0, pl=r.rs.length>1?r.rs[r.rs.length-2]:0, df=ls-pl, miss=ls===0;
    return `<tr style="border-bottom:1px solid var(--line);${miss?'background:var(--bad-bg)':''}">
      <td style="text-align:center;padding:7px 4px;font-weight:900;color:${i<3?'var(--bunny-deep)':'var(--dim)'};font-size:12px">${i+1}</td>
      <td style="padding:7px 6px"><span style="font-weight:800;font-size:13px;${miss?'color:var(--bad-tx)':''}">${escHtml(r.name)}</span> <span class="dim" style="font-size:11px">${escHtml(r.cls)}</span></td>
      <td style="text-align:center;padding:7px 4px;color:var(--bunny-deep);font-weight:900;font-size:13px">${_anFmt(r.avg)}</td>
      ${r.rs.map((s,si)=>{const isL=si===r.rs.length-1;return `<td style="text-align:right;padding:7px 4px;font-size:${isL?'13':'12'}px;${s===0?'color:var(--bad-tx)':isL?'font-weight:900':'color:var(--dim)'}">${s>0?_anFmt(s):'0'}</td>`;}).join('')}
      <td style="text-align:center;padding:7px 4px;font-size:12px;font-weight:800">${miss?'<span style="color:var(--bad-tx)">미참</span>':pl===0&&ls>0?'<span style="color:var(--ok-tx)">NEW</span>':df===0?'<span class="dim">-</span>':`<span style="color:${df>0?'var(--ok-tx)':'var(--bad-tx)'}">${df>0?'+':''}${_anFmt(df)}</span>`}</td></tr>`;
  }).join('');
  return `<div class="bento" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
      ${kpi('현재 주차 총점',_anFmt(total),'tone-rose','#fff')}
      ${kpi('참여 인원',part+'명','tone-light')}
      ${kpi('참여자 평균',_anFmt(avgCur),'tone-cream')}
      ${kpi('미참(0점)',missN+'명','tone-light','var(--bad-tx)')}
    </div>
    <div class="an-grid" style="display:grid;grid-template-columns:1.05fr 1.25fr;gap:14px;margin-bottom:16px">
      <div class="panel" style="border-radius:20px;padding:16px"><h3 style="font-weight:900;font-size:14px;margin:0 0 10px"><i class="fa-solid fa-chart-line" style="color:var(--bunny-main);margin-right:7px"></i>길드 총점 추이 <span class="dim" style="font-size:11px;font-weight:700">최근 ${trend.length}주차</span></h3>${_anSpark(trend)}<div class="dim" style="font-size:11px;font-weight:700;display:flex;justify-content:space-between;margin-top:4px"><span>${periods[0]?_anShort(periods[0].period_label):''}</span><span>현재 ${_anFmt(trend[trend.length-1]||0)}</span></div></div>
      <div class="panel" style="border-radius:20px;padding:16px"><h3 style="font-weight:900;font-size:14px;margin:0 0 12px"><i class="fa-solid fa-trophy" style="color:var(--bunny-main);margin-right:7px"></i>이번 주차 MVP</h3><div style="display:flex;gap:14px;flex-wrap:wrap">${mvp('고득점','⭐','#2563eb',high,v=>_anFmt(Math.round(v)))}${mvp('떡상','📈','#d97706',up,v=>'+'+_anFmt(Math.round(v)))}${mvp('상승률','📊','#059669',pctl,v=>'▲'+v.toFixed(1)+'%')}${mvp('평균↑','⚡','#7c3aed',abv,v=>'+'+_anFmt(Math.round(v)))}</div></div>
    </div>
    <div class="panel" style="border-radius:20px;padding:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h3 style="font-weight:900;font-size:14px;margin:0"><i class="fa-solid fa-table-list" style="color:var(--bunny-main);margin-right:7px"></i>회차별 점수 <span class="dim" style="font-size:11px;font-weight:700">(헤더 클릭 정렬)</span></h3><span class="dim" style="font-size:11px;font-weight:700">${rows.length}명</span></div>
      <div class="scroll" style="overflow:auto;max-height:62vh"><table style="width:100%;border-collapse:collapse;min-width:560px"><thead>${head}</thead><tbody style="font-weight:600">${tbody||`<tr><td colspan="${4+recent.length}" class="dim" style="padding:30px;text-align:center;font-weight:700">표시할 데이터가 없어요</td></tr>`}</tbody></table></div>
    </div>`;
}
window._anSort=(f)=>{ if(_anSortField===f) _anSortOrder=_anSortOrder==='asc'?'desc':'asc'; else { _anSortField=f; _anSortOrder=(f==='name')?'asc':'desc'; } const el=document.getElementById('anBody'); if(el) el.innerHTML=_anRender(); };
window._anSetSearch=(v)=>{ _anSearch=v; const el=document.getElementById('anBody'); if(el) el.innerHTML=_anRender(); };
window._anSetClass=(v)=>{ _anClass=v; const el=document.getElementById('anBody'); if(el) el.innerHTML=_anRender(); };
window._anSetRole=(v)=>{ _anRole=v; const el=document.getElementById('anBody'); if(el) el.innerHTML=_anRender(); };


/* ----- 장기부재 면제 (관리자: 승인/거절) ----- */
function absStatusChip(s){ return s==='approved'?'<span class="chip" style="background:var(--ok-bg);color:var(--ok-tx)">승인</span>':s==='rejected'?'<span class="chip" style="background:var(--bad-bg);color:var(--bad-tx)">거절</span>':'<span class="chip" style="background:var(--warn-bg);color:var(--warn-tx)">대기</span>'; }
async function buildAbsence(){
  const { data, error } = await db().from('absence_exemptions').select('id,member_name,reason_type,reason_detail,start_date,end_date,status,memo,created_at').order('created_at',{ascending:false}).limit(300);
  if(error) throw error;
  const all=data||[], pending=all.filter(r=>!r.status||r.status==='pending'), done=all.filter(r=>r.status&&r.status!=='pending');
  const period=(r)=>`${(r.start_date||'?').slice(0,10)} ~ ${(r.end_date||'?').slice(0,10)}`;
  const card=(r)=>`<div class="panel tone-light" style="border-radius:18px;padding:16px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start">
      <div><div style="font-weight:900;font-size:16px">${r.member_name||'-'} <span class="dim" style="font-size:12px;font-weight:700">· ${r.reason_type||'-'}</span></div>
        <div class="dim" style="font-size:13px;font-weight:700;margin-top:4px"><i class="fa-solid fa-calendar-day" style="margin-right:5px"></i>${period(r)}</div>
        ${r.memo?`<div class="dim" style="font-size:12px;margin-top:3px">${r.memo}</div>`:''}</div>
      <div style="display:flex;gap:6px"><button onclick="_absAct(${r.id},'approved')" style="border:0;border-radius:10px;padding:8px 14px;font-weight:800;color:#fff;background:#1A8A4A;cursor:pointer"><i class="fa-solid fa-check"></i> 승인</button>
        <button onclick="_absAct(${r.id},'rejected')" style="border:0;border-radius:10px;padding:8px 14px;font-weight:800;color:#fff;background:#C03A3A;cursor:pointer"><i class="fa-solid fa-xmark"></i> 거절</button></div>
    </div></div>`;
  const row=(r)=>`<tr style="border-bottom:1px solid var(--line)">
    <td style="padding:10px 8px;font-weight:800">${r.member_name||'-'}</td><td class="dim" style="font-weight:700">${r.reason_type||'-'}</td>
    <td class="dim" style="font-weight:700">${period(r)}</td><td>${absStatusChip(r.status)}</td><td class="dim" style="font-weight:600">${r.memo||''}</td></tr>`;
  return headerHTML('장기부재 면제', `대기 ${pending.length}건`) +
    `<h3 style="font-weight:900;font-size:16px;margin:0 0 12px"><i class="fa-solid fa-user-clock" style="color:var(--ice);margin-right:8px"></i>승인 대기 <span class="chip" style="background:var(--bunny-deep);color:#fff;margin-left:4px">${pending.length}</span></h3>
     ${pending.length?pending.map(card).join(''):`<div class="panel" style="border-radius:18px;padding:30px;text-align:center"><span class="dim" style="font-weight:800"><i class="fa-solid fa-check-circle" style="color:#1A8A4A;margin-right:6px"></i>대기 중인 면제 신청이 없어요</span></div>`}
     <h3 style="font-weight:900;font-size:16px;margin:26px 0 12px"><i class="fa-solid fa-plane-departure" style="color:var(--bunny-main);margin-right:8px"></i>면제 내역 (${done.length})</h3>
     <div class="panel" style="border-radius:24px;padding:18px"><div class="scroll" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px;min-width:560px">
       <thead><tr class="dim" style="font-size:12px;font-weight:700;border-bottom:2px solid var(--line)"><th style="text-align:left;padding:10px 8px">닉네임</th><th style="text-align:left;padding:10px 0">사유</th><th style="text-align:left;padding:10px 0">기간</th><th style="text-align:left;padding:10px 0">상태</th><th style="text-align:left;padding:10px 0">메모</th></tr></thead>
       <tbody style="font-weight:500">${done.map(row).join('')||'<tr><td colspan="5" class="dim" style="padding:24px;text-align:center;font-weight:700">내역 없음</td></tr>'}</tbody></table></div></div>`;
}
window._absAct = async (id,status)=>{
  if(!isAdmin()) return alert('운영진만 처리할 수 있어요.');
  if(!confirm(status==='approved'?'면제를 승인할까요?':'면제를 거절할까요?')) return;
  const { error } = await db().from('absence_exemptions').update({ status, decision_at:new Date().toISOString(), decision_by:CURRENT.email }).eq('id',id);
  if(error) return alert('처리 실패: '+error.message); render();
};

/* ----- 장기부재 캐릭 등록 (멤버 폼) ----- */
async function buildAbsenceReg(){
  const reasons=['결혼·신행','여행','군 입대','입원·건강','학업·시험','계정 정지','기타'];
  const inp='width:100%;border:1px solid var(--line);background:var(--panel-2);border-radius:12px;padding:11px 14px;font-size:14px;font-weight:600;color:var(--text);outline:0;';
  const fld=(l,i)=>`<div style="margin-bottom:16px"><label style="display:block;font-weight:800;font-size:13px;margin-bottom:6px">${l}</label>${i}</div>`;
  return headerHTML('장기부재 캐릭 등록','수로 면제용 장기부재 신고') +
    `<div class="panel" style="border-radius:24px;padding:26px;max-width:620px">
      ${fld('닉네임 *', `<input id="ab_name" style="${inp}" placeholder="본캐 닉네임">`)}
      ${fld('부재 사유 *', `<select id="ab_reason" style="${inp}">${reasons.map(r=>`<option>${r}</option>`).join('')}</select>`)}
      ${fld('시작일 *', `<input id="ab_start" type="date" style="${inp}">`)}
      ${fld('복귀 예정일 *', `<input id="ab_end" type="date" style="${inp}">`)}
      ${fld('상세 메모', `<textarea id="ab_memo" rows="3" style="${inp};resize:vertical" placeholder="예: 결혼식 6/7, 신행 6/17 복귀"></textarea>`)}
      <button onclick="_absSubmit()" style="width:100%;border:0;border-radius:14px;padding:14px;font-weight:900;font-size:15px;color:#fff;background:linear-gradient(135deg,var(--bunny-main),var(--bunny-deep));cursor:pointer;margin-top:6px">장기부재 등록하기 🛏️</button>
      <p class="dim" style="font-size:12px;font-weight:700;margin:14px 0 0;text-align:center">운영진 승인 후 해당 기간 수로 점수가 면제돼요</p>
    </div>`;
}
window._absSubmit = async ()=>{
  const v=id=>document.getElementById(id).value.trim();
  const name=v('ab_name'), start=v('ab_start'), end=v('ab_end');
  if(!name||!start||!end) return alert('닉네임·시작일·복귀일은 필수예요.');
  const { error } = await db().from('absence_exemptions').insert({ member_name:name, reason_type:v('ab_reason'), start_date:start, end_date:end, memo:v('ab_memo')||null, status:'pending', requested_by:'bunny-site' });
  if(error) return alert('등록 실패: '+error.message);
  document.getElementById('pageBody').innerHTML = headerHTML('장기부재 캐릭 등록','등록 완료') +
    `<div class="panel" style="border-radius:24px;padding:50px;text-align:center;max-width:620px"><div style="font-size:46px;margin-bottom:12px">🛏️✅</div><h3 style="font-weight:900;font-size:20px;margin:0 0 8px">장기부재가 등록됐어요!</h3><p class="dim" style="font-weight:700;margin:0">운영진 승인 후 적용돼요.</p></div>`;
};

/* ----- 운영진 할 일 (admin_todos · QA 상세+이미지, 완료 접기) ----- */
function todoPrio(p){ const m={urgent:['긴급','var(--bad-tx)','var(--bad-bg)'],high:['높음','var(--warn-tx)','var(--warn-bg)'],normal:['보통','var(--ice)','var(--panel-2)'],low:['낮음','var(--dim)','var(--panel-2)']}; const x=m[p]||m.normal; return `<span class="chip" style="background:${x[2]};color:${x[1]}">${x[0]}</span>`; }
/* note = 평문(레거시) 또는 JSON {text, images:[url]} */
function _todoParseNote(note){ if(!note) return {text:'',images:[]}; try{ const o=JSON.parse(note); if(o&&typeof o==='object'&&!Array.isArray(o)&&('text'in o||'images'in o)) return {text:o.text||'', images:Array.isArray(o.images)?o.images:[]}; }catch(e){} return {text:String(note), images:[]}; }
let _todoData=[]; let _todoFold=true; let _todoEdit=null; let _todoComposeImgs=[];
async function buildTodos(){
  let data=[];
  try{ const r=await db().from('admin_todos').select('id,title,note,priority,category,status,due_date,done_by,created_by,created_at').order('created_at',{ascending:false}).limit(300); if(r.error) throw r.error; data=r.data||[]; }catch(e){ data=[]; }
  _todoData=data; _todoComposeImgs=[];
  const rank={urgent:0,high:1,normal:2,low:3};
  const todo=data.filter(t=>t.status!=='done').sort((a,b)=>(rank[a.priority]??2)-(rank[b.priority]??2));
  const done=data.filter(t=>t.status==='done');
  const post=(t,isDone)=>{ const {text,images}=_todoParseNote(t.note);
    const author=(t.created_by||'운영진').split('@')[0];
    const when=t.created_at?String(t.created_at).slice(0,10):'';
    return `<div class="panel" style="border-radius:16px;padding:0;margin-bottom:12px;overflow:hidden;${isDone?'opacity:.62':''}">
      <div style="display:flex;align-items:center;gap:10px;padding:13px 15px 0">
        <div style="width:34px;height:34px;border-radius:999px;background:linear-gradient(135deg,var(--bunny-light),var(--bunny-main));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;flex-shrink:0">${escHtml(author.slice(0,1))}</div>
        <div style="min-width:0"><div style="font-weight:800;font-size:13px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">${escHtml(author)}${t.category?` <span class="chip" style="background:var(--panel-3);color:var(--bunny-deep)">${escHtml(t.category)}</span>`:''} ${todoPrio(t.priority)}</div><div class="dim" style="font-size:11px;font-weight:700">${when}${t.due_date?` · ~${t.due_date} 마감`:''}${isDone&&t.done_by?` · ${escHtml(String(t.done_by).split('@')[0])} 완료`:''}</div></div>
        <button onclick="_todoToggle(${t.id},${isDone?'false':'true'})" style="margin-left:auto;border:1px solid var(--line);border-radius:9px;padding:7px 13px;font-weight:800;font-size:12.5px;cursor:pointer;${isDone?'background:var(--ok-bg);color:var(--ok-tx)':'background:var(--panel-2);color:var(--text)'};flex-shrink:0">${isDone?'<i class="fa-solid fa-rotate-left"></i> 완료됨':'<i class="fa-solid fa-check"></i> 완료'}</button>
      </div>
      <div style="padding:9px 15px 13px">
        <div style="font-weight:900;font-size:15px;${isDone?'text-decoration:line-through':''}">${escHtml(t.title||'')}</div>
        ${text?`<div style="font-size:13.5px;font-weight:600;line-height:1.62;margin-top:6px;white-space:pre-wrap">${escHtml(text)}</div>`:''}
        ${images.length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">${images.map(u=>`<img src="${escAttr(u)}" data-full="${escAttr(u)}" onclick="_todoZoom(this)" style="width:calc(50% - 3px);max-width:260px;height:150px;object-fit:cover;border-radius:10px;border:1px solid var(--line);cursor:zoom-in" loading="lazy">`).join('')}</div>`:''}
        <div style="display:flex;gap:6px;margin-top:11px">
          <button onclick="_todoEditOpen(${t.id})" style="border:0;border-radius:8px;background:var(--panel-2);color:var(--text);font-weight:800;font-size:12px;padding:6px 11px;cursor:pointer"><i class="fa-solid fa-pen" style="margin-right:4px"></i>편집</button>
          <button onclick="_todoDel(${t.id})" style="border:0;border-radius:8px;background:var(--panel-2);color:var(--dim);font-weight:800;font-size:12px;padding:6px 11px;cursor:pointer"><i class="fa-solid fa-trash" style="margin-right:4px"></i>삭제</button>
        </div>
      </div></div>`; };
  const composer=`<div class="panel" style="border-radius:18px;padding:14px 16px;margin-bottom:18px;display:flex;gap:11px">
      <div style="width:38px;height:38px;border-radius:999px;background:linear-gradient(135deg,var(--bunny-light),var(--bunny-main));flex-shrink:0;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900">운</div>
      <div style="flex:1;min-width:0">
        <input id="tdc_t" placeholder="무엇을 QA할까요? (제목)" onpaste="_todoComposePaste(event)" style="width:100%;border:0;background:transparent;outline:0;font-weight:800;font-size:15px;color:var(--text);padding:8px 4px">
        <textarea id="tdc_c" placeholder="내용 · QA 할 부분, 재현 절차 등  (사진은 Ctrl+V로 바로 붙여넣기)" onpaste="_todoComposePaste(event)" style="width:100%;border:0;background:transparent;outline:0;font-size:14px;font-weight:600;color:var(--text);padding:4px;height:74px;resize:vertical;line-height:1.55"></textarea>
        <div id="tdc_imgs" style="display:flex;gap:7px;flex-wrap:wrap;margin:4px 0"></div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">
          <label style="border:1px solid var(--line);border-radius:9px;padding:8px 12px;font-weight:800;font-size:12.5px;cursor:pointer;background:var(--panel-2)"><i class="fa-solid fa-image" style="margin-right:5px"></i>사진<input type="file" accept="image/*" multiple onchange="_todoComposeAttach(event)" style="display:none"></label>
          <span class="dim" style="font-size:11px;font-weight:700"><i class="fa-solid fa-paste" style="margin-right:4px"></i>Ctrl+V 붙여넣기</span>
          <input id="tdc_cat" value="QA" placeholder="분류" style="border:1px solid var(--line);border-radius:9px;padding:8px 11px;font-weight:700;font-size:13px;color:var(--text);background:var(--panel-2);outline:0;width:84px">
          <select id="tdc_prio" style="border:1px solid var(--line);border-radius:9px;padding:8px 11px;font-weight:700;font-size:13px;color:var(--text);background:var(--panel-2);outline:0"><option value="normal">보통</option><option value="high">높음</option><option value="urgent">긴급</option></select>
          <button onclick="_todoComposePost()" style="margin-left:auto;border:0;border-radius:10px;padding:9px 20px;font-weight:800;color:#fff;background:var(--bunny-main);cursor:pointer"><i class="fa-solid fa-paper-plane" style="margin-right:6px"></i>게시</button>
        </div>
      </div></div>`;
  return headerHTML('운영진 할 일', `할 일 ${todo.length} · 완료 ${done.length}`) +
    composer +
    `${data.length?'':'<p class="dim" style="font-size:12px;font-weight:700;margin:0 0 12px"><i class="fa-solid fa-circle-info" style="margin-right:5px"></i>운영진 로그인 시 저장됩니다 (RLS)</p>'}
    <div id="todoList">${todo.map(t=>post(t,false)).join('')||'<div class="panel" style="border-radius:14px;padding:24px;text-align:center"><span class="dim" style="font-weight:700">아직 할 일이 없어요 — 위에 적어서 게시</span></div>'}</div>
    ${done.length?`<div style="margin-top:18px">
      <div onclick="_todoFoldToggle()" style="cursor:pointer;display:flex;align-items:center;gap:8px;font-weight:900;font-size:14px;color:var(--dim);user-select:none">
        <i class="fa-solid fa-chevron-${_todoFold?'right':'down'}" id="todoFoldChev" style="font-size:11px;transition:.15s"></i><i class="fa-solid fa-box-archive" style="color:var(--ok-tx)"></i> 완료 보관 (${done.length}) <span style="font-size:11px;font-weight:700">${_todoFold?'· 열기':'· 접기'}</span>
      </div>
      <div id="todoDoneBox" style="display:${_todoFold?'none':'block'};margin-top:12px">${done.map(t=>post(t,true)).join('')}</div>
    </div>`:''}`;
}
/* 공통: File 목록을 R2 업로드 → arr에 url 추가 → box 갱신 (첨부·붙여넣기 공용) */
async function _todoUploadImgs(files, arr, boxId, htmlFn){
  const box=document.getElementById(boxId); let any=false;
  for(const f of files){ if(!f || !f.type.startsWith('image/')) continue; any=true;
    if(box) box.insertAdjacentHTML('beforeend','<div class="tdc_uploading" style="width:74px;height:56px;border-radius:8px;border:1px dashed var(--line);display:flex;align-items:center;justify-content:center"><i class="fa-solid fa-spinner fa-spin dim"></i></div>');
    try{ const ext=((f.name||'').split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'')||'png'; const fn=`todo-${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`; const url=await window._r2Upload('guide-images', fn, f); arr.push(url); }catch(e){ alert('업로드 실패: '+(e.message||e)); }
    if(box) box.innerHTML=htmlFn();
  }
  return any;
}
/* clipboard 이벤트에서 이미지 File만 추출 */
function _todoClipImgs(ev){ const items=(ev.clipboardData&&ev.clipboardData.items)||[]; const out=[]; for(const it of items){ if(it.kind==='file'&&it.type.startsWith('image/')){ const f=it.getAsFile(); if(f) out.push(f); } } return out; }
function _todoComposeImgsHtml(){ return _todoComposeImgs.map((u,i)=>`<div style="position:relative;width:74px;height:56px;border-radius:8px;overflow:hidden;border:1px solid var(--line)"><img src="${escAttr(u)}" style="width:100%;height:100%;object-fit:cover"><button onclick="_todoComposeRmImg(${i})" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:999px;border:0;background:var(--bad-tx);color:#fff;cursor:pointer;font-size:10px"><i class="fa-solid fa-xmark"></i></button></div>`).join(''); }
window._todoComposeRmImg = (i)=>{ _todoComposeImgs.splice(i,1); const el=document.getElementById('tdc_imgs'); if(el)el.innerHTML=_todoComposeImgsHtml(); };
window._todoComposeAttach = async (ev)=>{
  const files=Array.from(ev.target.files||[]); ev.target.value='';
  await _todoUploadImgs(files, _todoComposeImgs, 'tdc_imgs', _todoComposeImgsHtml);
};
window._todoComposePaste = async (ev)=>{
  const imgs=_todoClipImgs(ev); if(!imgs.length) return; ev.preventDefault();
  await _todoUploadImgs(imgs, _todoComposeImgs, 'tdc_imgs', _todoComposeImgsHtml);
};
window._todoComposePost = async ()=>{
  if(!isAdmin()) return alert('운영진만 작성할 수 있어요.');
  const title=(document.getElementById('tdc_t').value||'').trim(); if(!title) return alert('제목을 입력해주세요.');
  const text=(document.getElementById('tdc_c').value||'').trim();
  const cat=(document.getElementById('tdc_cat').value||'').trim()||null;
  const prio=document.getElementById('tdc_prio').value;
  const note=(text||_todoComposeImgs.length)?JSON.stringify({ text, images:_todoComposeImgs }):null;
  const { error } = await db().from('admin_todos').insert({ title, note, category:cat, priority:prio, created_by:CURRENT.name||CURRENT.email });
  if(error) return alert('등록 실패: '+error.message);
  _todoComposeImgs=[]; render();
};
window._todoAdd = async ()=>{
  if(!isAdmin()) return alert('운영진만 추가할 수 있어요.');
  const t=document.getElementById('td_title').value.trim(); if(!t) return alert('할 일을 입력해주세요.');
  const { error } = await db().from('admin_todos').insert({ title:t, category:document.getElementById('td_cat').value.trim()||null, priority:document.getElementById('td_prio').value, due_date:document.getElementById('td_due').value||null, created_by:CURRENT.name||CURRENT.email });
  if(error) return alert('추가 실패: '+error.message); render();
};
window._todoToggle = async (id,done)=>{ const { error } = await db().from('admin_todos').update({ status:done?'done':'todo', done_at:done?new Date().toISOString():null, done_by:done?(CURRENT.name||CURRENT.email):null }).eq('id',id); if(error){ alert('변경 실패: '+error.message); } render(); };
window._todoDel = async (id)=>{ if(!confirm('삭제할까요?')) return; const { error } = await db().from('admin_todos').delete().eq('id',id); if(error) return alert('삭제 실패: '+error.message); render(); };
window._todoExpand = (id)=>{ const d=document.getElementById('tddet_'+id), ch=document.getElementById('tdchev_'+id); if(!d) return; const open=d.style.display==='none'; d.style.display=open?'block':'none'; if(ch)ch.style.transform=open?'rotate(180deg)':''; };
window._todoFoldToggle = ()=>{ _todoFold=!_todoFold; const box=document.getElementById('todoDoneBox'), ch=document.getElementById('todoFoldChev'); if(box)box.style.display=_todoFold?'none':'block'; if(ch)ch.className='fa-solid fa-chevron-'+(_todoFold?'right':'down'); };
window._todoZoom = (el)=>{ const u=el.dataset.full; const old=document.getElementById('_todoImgModal'); if(old)old.remove(); const div=document.createElement('div'); div.id='_todoImgModal'; div.style.cssText='position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out'; div.innerHTML=`<img src="${escAttr(u)}" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px">`; div.onclick=()=>div.remove(); document.body.appendChild(div); };
/* ----- 상세 편집 모달 (제목·상세 텍스트·이미지 첨부) ----- */
window._todoEditOpen = (id)=>{ if(!isAdmin()) return alert('운영진만 편집할 수 있어요.'); const t=_todoData.find(x=>x.id===id); if(!t) return; const {text,images}=_todoParseNote(t.note); _todoEdit={ id, title:t.title||'', text, images:images.slice() }; _todoEditRender(); };
window._todoEditClose = ()=>{ _todoEdit=null; const m=document.getElementById('_todoEditModal'); if(m)m.remove(); };
function _todoEditRender(){
  let m=document.getElementById('_todoEditModal'); if(!m){ m=document.createElement('div'); m.id='_todoEditModal'; m.style.cssText='position:fixed;inset:0;z-index:2500;background:rgba(0,0,0,.45);display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow-y:auto'; m.onclick=(e)=>{ if(e.target===m)_todoEditClose(); }; document.body.appendChild(m); }
  const e=_todoEdit; const inp='width:100%;border:1px solid var(--line);background:var(--panel-2);border-radius:10px;padding:11px 13px;font-size:14px;font-weight:600;color:var(--text);outline:0;';
  m.innerHTML=`<div class="panel" style="border-radius:20px;padding:20px;max-width:680px;width:100%;background:var(--panel)" onclick="event.stopPropagation()">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><h3 style="font-weight:900;font-size:17px;margin:0"><i class="fa-solid fa-clipboard-check" style="color:var(--bunny-main);margin-right:8px"></i>상세 / QA 내용</h3><button onclick="_todoEditClose()" style="border:0;background:transparent;color:var(--dim);cursor:pointer;font-size:18px"><i class="fa-solid fa-xmark"></i></button></div>
    <label style="display:block;font-weight:800;font-size:12px;margin:0 0 5px">제목</label>
    <input id="te_title" value="${escAttr(e.title)}" oninput="_todoEdit.title=this.value" style="${inp};margin-bottom:14px">
    <label style="display:block;font-weight:800;font-size:12px;margin:0 0 5px">상세 설명 (QA 할 부분·재현 절차 등)</label>
    <textarea id="te_text" oninput="_todoEdit.text=this.value" onpaste="_todoEditPaste(event)" placeholder="예) 동기화 페이지에서 본캐 추론 누르면 ... / 재현: 1) ... 2) ...  (사진은 Ctrl+V로 바로 붙여넣기)" style="${inp};height:170px;resize:vertical;line-height:1.6;margin-bottom:14px">${escHtml(e.text)}</textarea>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><label style="font-weight:800;font-size:12px">스크린샷 (${e.images.length}) <span class="dim" style="font-weight:700"><i class="fa-solid fa-paste" style="margin:0 3px 0 4px"></i>Ctrl+V 가능</span></label>
      <label style="background:var(--panel-2);border:1px solid var(--line);border-radius:9px;padding:7px 13px;font-weight:800;font-size:12.5px;cursor:pointer"><i class="fa-solid fa-image" style="margin-right:5px"></i>이미지 첨부<input type="file" accept="image/*" multiple onchange="_todoEditAddImg(event)" style="display:none"></label></div>
    <div id="te_imgs" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">${_todoEditImgsHtml()}</div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button onclick="_todoEditClose()" style="border:0;border-radius:10px;padding:10px 18px;font-weight:800;background:var(--panel-2);color:var(--text);cursor:pointer">취소</button><button onclick="_todoEditSave()" style="border:0;border-radius:10px;padding:10px 20px;font-weight:800;color:#fff;background:#1A8A4A;cursor:pointer"><i class="fa-solid fa-floppy-disk" style="margin-right:6px"></i>저장</button></div>
  </div>`;
}
function _todoEditImgsHtml(){ const e=_todoEdit; if(!e.images.length) return '<span class="dim" style="font-size:12px;font-weight:700">첨부된 이미지 없음</span>'; return e.images.map((u,i)=>`<div style="position:relative"><img src="${escAttr(u)}" style="width:110px;height:84px;object-fit:cover;border-radius:9px;border:1px solid var(--line)"><button onclick="_todoEditRemoveImg(${i})" style="position:absolute;top:-7px;right:-7px;width:22px;height:22px;border-radius:999px;border:0;background:var(--bad-tx);color:#fff;cursor:pointer;font-size:11px"><i class="fa-solid fa-xmark"></i></button></div>`).join(''); }
window._todoEditRemoveImg = (i)=>{ _todoEdit.images.splice(i,1); document.getElementById('te_imgs').innerHTML=_todoEditImgsHtml(); };
window._todoEditAddImg = async (ev)=>{
  const files=Array.from(ev.target.files||[]); ev.target.value=''; if(!files.length||!_todoEdit) return;
  await _todoUploadImgs(files, _todoEdit.images, 'te_imgs', _todoEditImgsHtml);
};
window._todoEditPaste = async (ev)=>{
  if(!_todoEdit) return; const imgs=_todoClipImgs(ev); if(!imgs.length) return; ev.preventDefault();
  await _todoUploadImgs(imgs, _todoEdit.images, 'te_imgs', _todoEditImgsHtml);
};
window._todoEditSave = async ()=>{
  if(!isAdmin()) return alert('운영진만 저장할 수 있어요.'); const e=_todoEdit; if(!e) return;
  const title=(e.title||'').trim()||'(제목 없음)';
  const note=(e.text||e.images.length)?JSON.stringify({ text:e.text||'', images:e.images }):null;
  const { error } = await db().from('admin_todos').update({ title, note }).eq('id', e.id);
  if(error) return alert('저장 실패: '+error.message);
  _todoEditClose(); render();
};

/* ----- 공통: 설정(site_config) 캐시 + Tailwind 온디맨드 ----- */
let _cfg=null, _cfgId=null;
async function getConfig(){ if(_cfg) return _cfg; const { data, error } = await db().from('site_config').select('id,config').limit(1).maybeSingle(); if(error) throw error; _cfg=data?.config||{}; _cfgId=data?.id; return _cfg; }
function loadTailwind(){ return new Promise((res)=>{ if(window.tailwind||document.getElementById('twcdn')) return res(); const s=document.createElement('script'); s.id='twcdn'; s.src='https://cdn.tailwindcss.com'; s.onload=res; s.onerror=res; document.head.appendChild(s); }); }
function escHtml(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s){ return escHtml(s).replace(/"/g,'&quot;'); }

/* ----- 수로 보상 (분기별 등급·보상 산정 — 원본 뚠카롱 renderSuroReward 충실 이식) ----- */
const REWARD_TIERS = [
  { grade:'크라운', rank:'1등', ratio:0.28, pool:100, benefit:'부캐길드 전체면제' },
  { grade:'크라운', rank:'2등', ratio:0.24, pool:100, benefit:'' },
  { grade:'크라운', rank:'3등', ratio:0.20, pool:100, benefit:'' },
  { grade:'크라운', rank:'4등', ratio:0.16, pool:100, benefit:'' },
  { grade:'크라운', rank:'5등', ratio:0.12, pool:100, benefit:'' },
  { grade:'파르페', rank:'6등', ratio:0.11, pool:100, benefit:'부캐길드 전체면제' },
  { grade:'파르페', rank:'7등', ratio:0.10, pool:100, benefit:'' },
  { grade:'파르페', rank:'8등', ratio:0.09, pool:100, benefit:'' },
  { grade:'파르페', rank:'9등', ratio:0.08, pool:100, benefit:'' },
  { grade:'파르페', rank:'10등', ratio:0.08, pool:100, benefit:'' },
  { grade:'파르페', rank:'11등', ratio:0.07, pool:100, benefit:'' },
  { grade:'파르페', rank:'12등', ratio:0.07, pool:100, benefit:'' },
  { grade:'파르페', rank:'13등', ratio:0.07, pool:100, benefit:'' },
  { grade:'파르페', rank:'14등', ratio:0.06, pool:100, benefit:'' },
  { grade:'파르페', rank:'15등', ratio:0.06, pool:100, benefit:'' },
  { grade:'파르페', rank:'16등', ratio:0.05, pool:100, benefit:'' },
  { grade:'파르페', rank:'17등', ratio:0.04, pool:100, benefit:'' },
  { grade:'파르페', rank:'18등', ratio:0.04, pool:100, benefit:'' },
  { grade:'파르페', rank:'19등', ratio:0.04, pool:100, benefit:'' },
  { grade:'파르페', rank:'20등', ratio:0.04, pool:100, benefit:'' },
];
let _srData = null;
async function buildSuroReward(){
  await loadTailwind();
  const cfg = await getConfig();
  const rawPiece = (cfg.suroReward||{}).piecePrice || cfg.piecePrice || 0;
  const piecePrice = rawPiece > 100000 ? rawPiece : rawPiece*10000;   // 원 단위로 정규화(예전 만원 데이터(예:730) 호환)
  const [{data:periods,error:ep},{data:mem,error:em}] = await Promise.all([
    db().from('suro_periods').select('id,period_label,start_date').order('start_date',{ascending:true}).limit(400),
    db().from('members').select('id,name,role,is_main,main_char_name').eq('guild',GUILD).eq('is_main',true).limit(5000),   // 본캐만 — 부캐(수로 0점)가 랭킹·등급분포를 오염시키던 문제 수정
  ]);
  if(ep) throw ep; if(em) throw em;
  const scoreMap={};
  try{
    // Supabase는 한 요청당 최대 1000행만 반환 → range로 페이지네이션해 전체 점수 로드(단일 .limit이면 잘려서 상위권 평균이 망가짐)
    for(let from=0; from<200000; from+=1000){
      const { data:chunk } = await db().from('suro_scores').select('member_id,period_id,score').eq('guild',GUILD).order('id',{ascending:true}).range(from,from+999);
      (chunk||[]).forEach(s=>{ (scoreMap[s.member_id]||(scoreMap[s.member_id]={}))[s.period_id]=Math.round(Number(s.score))||0; });
      if(!chunk || chunk.length<1000) break;
    }
  }catch(e){}
  _srData = { periods:periods||[], members:mem||[], scoreMap, piecePrice, cfg };
  setTimeout(()=>{ try{ _srRender(); }catch(e){ const el=document.getElementById('contentArea'); if(el) el.innerHTML='<div style="padding:40px;text-align:center;color:var(--bad-tx);font-weight:700">'+(e.message||e)+'</div>'; } },0);
  return headerHTML('수로 보상','분기별 등급·보상 산정') +
    '<div id="contentArea"><div style="text-align:center;padding:48px;color:var(--dim);font-weight:700"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px"></i>불러오는 중…</div></div>';
}
function _srQuarters(){
  const qm={};
  _srData.periods.forEach(p=>{ const m=String(p.start_date||'').match(/(\d{4})-(\d{2})-(\d{2})/); if(!m) return; const q=Math.ceil((+m[2])/3); const key=m[1]+'년 '+q+'분기'; (qm[key]||(qm[key]=[])).push(p); });
  return qm;
}
window._rewardChangeQ = ()=>{ const q=document.getElementById('rewardQuarter')?.value; if(!_srData.cfg.suroReward)_srData.cfg.suroReward={}; _srData.cfg.suroReward._selectedQ=q; _srRender(); };
function _srRender(){
  const container=document.getElementById('contentArea'); if(!container) return;
  const qm=_srQuarters(); const quarters=Object.keys(qm).sort().reverse();
  const sel0=_srData.cfg.suroReward&&_srData.cfg.suroReward._selectedQ;
  const selQ=(sel0&&quarters.includes(sel0))?sel0:(quarters[0]||'');
  const pp=_srData.piecePrice;
  container.innerHTML=
    '<div style="display:flex;flex-direction:column;gap:12px">'+
      '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-3" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">'+
        '<h3 class="text-sm font-bold text-gray-800"><i class="fas fa-gift mr-2 text-amber-400"></i>수로 보상체계</h3>'+
        '<select id="rewardQuarter" onchange="window._rewardChangeQ()" class="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-[11px] font-bold outline-none">'+
          (quarters.map(q=>'<option value="'+q+'" '+(q===selQ?'selected':'')+'>'+q+'</option>').join('')||'<option>분기 없음</option>')+
        '</select>'+
        (pp>0?'<span class="text-[10px] text-gray-400 font-bold ml-auto">솔 에르다 조각 시세: '+Math.round(pp/10000).toLocaleString()+'만원 (개당)</span>':'<span class="text-[10px] text-red-400 font-bold ml-auto">⚠ 솔 에르다 조각 시세 미설정 (설정 → 관리자)</span>')+
      '</div>'+
      '<div id="rewardContent"></div>'+
    '</div>';
  _rewardRenderBody(selQ, qm, pp);
}
function _rewardRenderBody(selQ, qm, piecePrice){
  const wrap=document.getElementById('rewardContent'); if(!wrap) return;
  const qHeaders=qm[selQ]||[];
  if(!qHeaders.length){ wrap.innerHTML='<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-400 text-xs font-bold">해당 분기 데이터가 없습니다.</div>'; return; }
  const ranked=_srData.members.map(m=>{
    const scores=qHeaders.map(p=> (_srData.scoreMap[m.id]&&_srData.scoreMap[m.id][p.id])||0 );
    let startIdx=0; while(startIdx<scores.length&&scores[startIdx]===0) startIdx++;
    const activeWeeks=scores.length-startIdx; const activeScores=scores.slice(startIdx);
    const total=activeScores.reduce((a,b)=>a+b,0); const participated=activeScores.filter(s=>s>0).length;
    const avg=activeWeeks>0?Math.round(total/activeWeeks):0; const isNewbie=startIdx>0&&startIdx<scores.length;
    return { name:m.name, avg, total, weeks:scores.length, activeWeeks, participated, role:m.role, isNewbie, isMain:m.is_main!==false, mainCharName:m.main_char_name||'' };
  }).sort((a,b)=>b.avg-a.avg);
  const gradeColors={
    '크라운':{bg:'bg-amber-50',border:'border-amber-200',text:'text-amber-700',badge:'bg-amber-400'},
    '파르페':{bg:'bg-blue-50',border:'border-blue-200',text:'text-blue-700',badge:'bg-blue-400'},
    '티라미슈':{bg:'bg-purple-50',border:'border-purple-200',text:'text-purple-700',badge:'bg-purple-400'},
    '크로칸슈':{bg:'bg-green-50',border:'border-green-200',text:'text-green-700',badge:'bg-green-400'},
    '롤케이크':{bg:'bg-rose-50',border:'border-rose-200',text:'text-rose-700',badge:'bg-rose-400'},
    '팬케이크':{bg:'bg-gray-50',border:'border-gray-200',text:'text-gray-600',badge:'bg-gray-400'},
  };
  const bottom20=ranked.slice(-20).map(m=>m.name);
  const results=ranked.map((m,i)=>{
    const rank=i+1; let grade='',reward='',benefit='',rewardNote=''; const ratio=m.isNewbie?m.activeWeeks/m.weeks:1;
    if(rank<=20){ const tier=REWARD_TIERS[i]; grade=tier.grade;
      if(piecePrice>0){ const poolWon=tier.pool*100000000; let pieces=Math.round((poolWon*tier.ratio)/piecePrice); if(m.isNewbie){ const original=pieces; pieces=Math.round(pieces*ratio); rewardNote='('+original+'→'+pieces+', '+Math.round(ratio*100)+'%)'; } reward='솔 에르다 조각 '+pieces.toLocaleString()+'개'; }
      else { reward='비율 '+(tier.ratio*100).toFixed(0)+'%'; }
      benefit=tier.benefit||(REWARD_TIERS.find(t=>t.grade===grade&&t.benefit)||{}).benefit||'';
    } else if(rank<=51){ grade='티라미슈'; if(m.isNewbie){ const adj=Math.round(24*ratio); reward='숫돌 '+adj+'개'; rewardNote='(24→'+adj+', '+Math.round(ratio*100)+'%)'; } else { reward='숫돌 24개'; } benefit='전체면제 + 숫돌24개 + 부캐길드면제'; }
    else if(bottom20.includes(m.name)){ grade='팬케이크'; reward='-'; benefit='부캐면제 X (하위 20)'; }
    else if(m.avg>=90000){ grade='크로칸슈'; reward='-'; benefit='전체면제 + 부캐길드면제'; }
    else if(m.avg>=55000){ grade='롤케이크'; reward='-'; benefit='절반면제'; }
    else { grade='롤케이크'; reward='-'; benefit='절반면제'; }
    return Object.assign({}, m, { rank, grade, reward, benefit, rewardNote });
  });
  const gc=(grade)=>gradeColors[grade]||gradeColors['팬케이크'];
  let html='';
  html+='<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 lg:p-5 mb-3">'+
    '<h4 class="text-xs font-bold text-gray-700 mb-3"><i class="fas fa-info-circle mr-1 text-blue-400"></i>보상 체계 요약</h4>'+
    '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">'+
      ['크라운','파르페','티라미슈','크로칸슈','롤케이크','팬케이크'].map(g=>{ const c=gc(g); const cnt=results.filter(r=>r.grade===g).length; const info=g==='크라운'?'TOP 5':g==='파르페'?'6~20등':g==='티라미슈'?'21~51등':g==='크로칸슈'?'90,000+':g==='롤케이크'?'55,000+':'하위 20명';
        return '<div class="'+c.bg+' '+c.border+' border rounded-xl p-2 text-center"><div class="text-[10px] font-black '+c.text+'">'+g+'</div><div class="text-lg font-black '+c.text+'">'+cnt+'</div><div class="text-[8px] text-gray-400">'+info+'</div></div>'; }).join('')+
    '</div></div>';
  html+='<div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"><div class="overflow-auto" style="max-height:65vh">'+
    '<table class="w-full text-left text-[10px] lg:text-xs whitespace-nowrap">'+
      '<thead class="bg-gray-50 text-[9px] lg:text-[10px] font-bold text-gray-500 border-b border-gray-100" style="position:sticky;top:0">'+
        '<tr><th class="py-2 px-2 text-center w-10">#</th><th class="py-2 px-2">등급</th><th class="py-2 px-2">닉네임</th><th class="py-2 px-2 text-right">분기평균</th><th class="py-2 px-2 text-right hidden sm:table-cell">참여</th><th class="py-2 px-2 text-right">보상</th><th class="py-2 px-2 hidden lg:table-cell">혜택</th></tr>'+
      '</thead><tbody class="divide-y divide-gray-50 text-gray-600 font-bold">';
  let prevGrade='';
  results.forEach(r=>{ const c=gc(r.grade); const isNew=r.grade!==prevGrade; prevGrade=r.grade; const medal=r.rank===1?'🥇':r.rank===2?'🥈':r.rank===3?'🥉':r.rank;
    html+='<tr class="hover:bg-gray-50/50 '+(isNew?'border-t-2 border-gray-200':'')+'">'+
      '<td class="py-2 px-2 text-center font-black">'+medal+'</td>'+
      '<td class="py-2 px-2"><span class="inline-block px-2 py-0.5 rounded text-[9px] font-bold text-white '+c.badge+'">'+r.grade+'</span></td>'+
      '<td class="py-2 px-2 font-bold text-gray-800">'+escHtml(r.name)+(!r.isMain?'<span class="text-[8px] text-gray-400 ml-1">(부캐: '+escHtml(r.mainCharName||'?')+')</span>':'')+'</td>'+
      '<td class="py-2 px-2 text-right font-mono">'+r.avg.toLocaleString()+'</td>'+
      '<td class="py-2 px-2 text-right text-gray-400 hidden sm:table-cell">'+r.participated+'/'+r.activeWeeks+'주'+(r.isNewbie?' <span class="text-[8px] text-blue-500 bg-blue-50 px-1 rounded">신규</span>':'')+'</td>'+
      '<td class="py-2 px-2 text-right font-bold '+(r.reward!=='-'?'text-amber-600':'text-gray-400')+'">'+r.reward+(r.rewardNote?'<br><span class="text-[8px] text-gray-400 font-normal">'+r.rewardNote+'</span>':'')+'</td>'+
      '<td class="py-2 px-2 text-[9px] text-gray-400 hidden lg:table-cell">'+r.benefit+'</td></tr>'; });
  html+='</tbody></table></div></div>';
  html+='<div class="bg-gray-50 rounded-2xl border border-gray-100 p-4 mt-3"><p class="text-[10px] text-gray-500 font-bold"><span class="block">⚠ 점수 기준은 분기 평균 점수로 산정합니다.</span><span class="block">⚠ 신규 가입자는 첫 참여 이후 주차 기준 평균</span><span class="block">⚠ 수로 미참여 시 해당 주차 0점 반영 → 등급 하락 가능</span></p></div>';
  wrap.innerHTML=html;
}

/* ----- 사용 안내 (guide_pages 표시) ----- */
let _guides=[];
async function buildManual(){
  await loadTailwind();
  const { data, error } = await db().from('guide_pages').select('slug,title,content').limit(50);
  if(error) throw error;
  _guides=data||[];
  const order=['intro','ranks','notice1','notice2','notice3','links'];
  _guides.sort((a,b)=>{ const ia=order.indexOf(a.slug),ib=order.indexOf(b.slug); return (ia<0?99:ia)-(ib<0?99:ib); });
  const tabs=_guides.map((g,i)=>`<button class="gtab" data-i="${i}" onclick="_guideShow(${i})" style="border:0;border-radius:10px;padding:9px 16px;font-weight:800;font-size:13px;cursor:pointer;${i===0?'background:var(--bunny-main);color:#fff':'background:var(--panel-2);color:var(--text)'}">${g.title}</button>`).join('');
  return headerHTML('사용 안내',`${fac().label} 길드 가이드`) +
    `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">${tabs||'<span class="dim">가이드 없음</span>'}</div>
     <div id="guideContent" class="panel" style="border-radius:24px;padding:24px;overflow-x:auto;line-height:1.6">${_guides[0]?.content||''}</div>`;
}
window._guideShow=(i)=>{ document.querySelectorAll('.gtab').forEach(b=>{ const on=+b.dataset.i===i; b.style.background=on?'var(--bunny-main)':'var(--panel-2)'; b.style.color=on?'#fff':'var(--text)'; }); document.getElementById('guideContent').innerHTML=_guides[i].content; };

/* ----- 가이드 편집 (guide_pages 수정) ----- */
let _ge=[];
async function buildGuideEdit(){
  const { data, error } = await db().from('guide_pages').select('id,slug,title,content').limit(50);
  if(error) throw error;
  _ge=data||[];
  const first=_ge[0]||{title:'',content:''};
  const inp='border:1px solid var(--line);background:var(--panel-2);border-radius:10px;padding:10px 12px;font-size:14px;font-weight:600;color:var(--text);outline:0;';
  return headerHTML('가이드 편집','사용 안내 페이지 편집') +
    `<div class="panel" style="border-radius:24px;padding:22px">
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap">
        <select id="ge_sel" onchange="_geLoad(this.value)" style="${inp};flex:1;min-width:200px">${_ge.map((g,i)=>`<option value="${i}">${escHtml(g.title)} (${g.slug})</option>`).join('')}</select>
        <button onclick="_geSave()" style="border:0;border-radius:10px;padding:10px 20px;font-weight:800;color:#fff;background:var(--bunny-main);cursor:pointer"><i class="fa-solid fa-floppy-disk"></i> 저장</button>
      </div>
      <label style="display:block;font-weight:800;font-size:13px;margin-bottom:6px">제목</label>
      <input id="ge_title" value="${escAttr(first.title)}" style="${inp};width:100%;margin-bottom:14px">
      <label style="display:block;font-weight:800;font-size:13px;margin-bottom:6px">내용 (HTML)</label>
      <textarea id="ge_content" rows="20" style="${inp};width:100%;font-family:ui-monospace,monospace;font-size:12.5px;line-height:1.5;resize:vertical">${escHtml(first.content)}</textarea>
      <p class="dim" style="font-size:12px;font-weight:700;margin:12px 0 0"><i class="fa-solid fa-triangle-exclamation" style="margin-right:5px"></i>HTML 직접 편집 — 결과는 '사용 안내'에서 확인. 저장은 운영진만 가능.</p>
    </div>`;
}
window._geLoad=(i)=>{ const g=_ge[i]; if(!g) return; document.getElementById('ge_title').value=g.title||''; document.getElementById('ge_content').value=g.content||''; };
window._geSave=async ()=>{
  if(!isAdmin()) return alert('운영진만 저장할 수 있어요.');
  const i=+document.getElementById('ge_sel').value, g=_ge[i]; if(!g) return;
  const title=document.getElementById('ge_title').value, content=document.getElementById('ge_content').value;
  const { error } = await db().from('guide_pages').update({ title, content, updated_at:new Date().toISOString() }).eq('id',g.id);
  if(error) return alert('저장 실패: '+error.message);
  g.title=title; g.content=content; alert('저장됐어요 ✓');
};

/* ----- 설정 (site_config) ----- */
let _setRanks=[];   // [{name, exempt}] — 직위 구조화 편집 상태
let _setRules=[];   // [{rank,type,value}] — 승강 기준(autoRankRules) 편집 상태
let _setFac='bunny';   // 설정 편집 대상 길드(버니/늑대/쿠거)
function _ruleType(r){ if(r.topN!=null) return 'topN'; if(r.bottomN!=null) return 'bottomN'; if(r.exactScore!=null) return 'exact'; return 'min'; }
function _ruleVal(r){ const t=_ruleType(r); return t==='topN'?(r.topN||0): t==='bottomN'?(r.bottomN||0): t==='exact'?0:(r.min||0); }
async function buildSettings(){
  const cfg=await getConfig();
  const FK=FACTIONS[_setFac]||FACTIONS.bunny;
  const facKey=FK.key;
  const g=(cfg.guilds||[]).find(x=>x.name===facKey)||{};
  const ranks=(cfg.ranks&&cfg.ranks[facKey])||[];
  const exempt=cfg.suroExempt||[];
  _setRanks = ranks.map(n=>({ name:n, exempt:exempt.includes(n) }));
  const rules=(cfg.autoRankRules&&cfg.autoRankRules[facKey])||[];
  _setRules = rules.map(r=>({ rank:r.rank, type:_ruleType(r), value:_ruleVal(r) }));
  const F='width:100%;border:1px solid var(--line);background:var(--panel-2);border-radius:10px;padding:10px 12px;font-weight:700;font-size:14px;color:var(--text);outline:0;box-sizing:border-box';
  const field=(label,inner,hint)=>`<div style="margin-bottom:13px">
    <label style="display:block;font-size:12.5px;font-weight:800;color:var(--dim);margin-bottom:5px">${label}</label>${inner}
    ${hint?`<div class="dim" style="font-size:11px;font-weight:700;margin-top:4px">${hint}</div>`:''}</div>`;
  const piece=Number(cfg.piecePrice||(cfg.suroReward&&cfg.suroReward.piecePrice)||0);
  const facBtn=(k)=>{ const f=FACTIONS[k]||FACTIONS.bunny, on=k===_setFac, tag=k==='bunny'?' <span style="font-size:10px;opacity:.85;font-weight:700">메인</span>':''; return `<button onclick="_setFacTab('${k}')" style="border:0;border-radius:12px;padding:9px 18px;font-weight:800;font-size:14px;cursor:pointer;${on?`background:${f.main};color:#fff;box-shadow:0 4px 12px -3px ${f.deep}`:'background:var(--panel-2);color:var(--text)'}">${f.emoji} ${f.label}${tag}</button>`; };
  const facTabs=`<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center">${facBtn('bunny')}<span class="dim" style="font-size:11px;font-weight:800;margin:0 2px">· 부길드</span>${facBtn('wolf')}${facBtn('cougar')}</div>`;
  return headerHTML('설정',`${FK.label} 길드 설정`) + facTabs +
    `<div class="panel" style="border-radius:20px;padding:22px;margin-bottom:16px">
      <h3 style="font-weight:900;font-size:15px;margin:0 0 16px"><i class="fa-solid fa-shield-cat" style="margin-right:6px;color:var(--bunny-main)"></i>${FK.label} 기본 정보</h3>
      <div style="display:flex;align-items:center;gap:12px;background:var(--panel-2);border-radius:14px;padding:12px 14px;margin-bottom:16px">
        <span style="font-size:26px">${FK.emoji}</span>
        <div><div style="font-weight:900;font-size:17px">${FK.label}</div><div class="dim" style="font-size:11px;font-weight:700">내부 식별키 <code style="background:var(--panel-3);padding:1px 5px;border-radius:4px">${facKey}</code> — 데이터 연결용이라 바꾸지 않아요</div></div>
      </div>
      <div class="bento" style="grid-template-columns:repeat(3,1fr);gap:0 16px">
        ${field('아이콘 (이모지)',`<input id="set_icon" value="${escAttr(g.icon||FK.emoji)}" style="${F}">`)}
        ${field('분류',`<input id="set_type" value="${escAttr(g.type||'')}" placeholder="예: 메인 1기" style="${F}">`)}
        ${field('정원 (명)',`<input id="set_max" type="number" value="${escAttr(g.max||'')}" style="${F}">`)}
      </div>
      <div style="border-top:1px dashed var(--line);margin:6px 0 12px"></div>
      <div style="font-size:11.5px;font-weight:800;color:var(--dim);margin-bottom:10px"><i class="fa-solid fa-globe" style="margin-right:5px"></i>공통 설정 — 전체 길드 공용 (어느 탭에서 바꿔도 같이 적용돼요)</div>
      <div class="bento" style="grid-template-columns:repeat(2,1fr);gap:0 16px">
        ${field('창립일',`<input id="set_start" type="date" value="${escAttr(cfg.guildStartDate||'')}" style="${F}">`)}
        ${field('조각 1개 가격 (메소)',`<input id="set_piece" type="number" value="${piece||''}" style="${F}">`, piece?`보석금·보상 환산 · 약 ${(piece/100000000).toFixed(2)}억`:'')}
      </div>
      ${field('길드 로고 URL',`<input id="set_logo" value="${escAttr(cfg.guildLogo||'')}" style="${F}">`, cfg.guildLogo?`<img src="${escAttr(cfg.guildLogo)}" style="height:40px;border-radius:8px;margin-top:7px;background:var(--panel-2);padding:3px">`:'비워두면 기본 토끼 아이콘')}
      ${field('수로 면제 안내문',`<input id="set_exnote" value="${escAttr(cfg.suroExemptNote||'')}" placeholder="예: 크로칸슈 이상 — 부캐 전부 수로 면제" style="${F}">`)}
      <div style="display:flex;justify-content:flex-end;margin-top:4px">
        <button onclick="_setSaveBasic()" style="border:0;border-radius:10px;padding:10px 22px;font-weight:800;font-size:13px;color:#fff;background:#1A8A4A;cursor:pointer"><i class="fa-solid fa-floppy-disk" style="margin-right:5px"></i>${FK.label} 기본 + 공통 저장</button>
      </div>
    </div>
    <div class="panel" style="border-radius:20px;padding:20px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
        <h3 style="font-weight:900;font-size:15px;margin:0"><i class="fa-solid fa-ranking-star" style="margin-right:6px;color:var(--bunny-main)"></i>${FK.label} 직위 (높은 순)</h3>
        <div style="display:flex;gap:7px">
          <button onclick="_setRankAdd()" style="border:1px solid var(--line);background:var(--panel-2);color:var(--text);border-radius:9px;padding:8px 13px;font-weight:800;font-size:13px;cursor:pointer"><i class="fa-solid fa-plus" style="margin-right:4px"></i>직위 추가</button>
          <button onclick="_settingsSaveRanks()" style="border:0;border-radius:9px;padding:8px 16px;font-weight:800;font-size:13px;color:#fff;background:#1A8A4A;cursor:pointer"><i class="fa-solid fa-floppy-disk" style="margin-right:5px"></i>저장</button>
        </div>
      </div>
      <p class="dim" style="font-size:11.5px;font-weight:700;margin:0 0 12px">↑↓ 순서 · 이름 칸에 직접 수정 · <b style="color:var(--bunny-deep)">수로면제</b> 토글 · 휴지통 삭제. 저장하면 즉시 반영(승강제·직위반영·길드원 정렬에 사용).</p>
      <div id="setRankEditor">${_setRankRowsHtml()}</div>
    </div>
    <div class="panel" style="border-radius:20px;padding:20px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:6px">
        <h3 style="font-weight:900;font-size:15px;margin:0"><i class="fa-solid fa-arrow-trend-up" style="margin-right:6px;color:var(--bunny-main)"></i>${FK.label} 승강 기준 (수로 자동 직위)</h3>
        <div style="display:flex;gap:7px">
          <button onclick="_setRuleAdd()" style="border:1px solid var(--line);background:var(--panel-2);color:var(--text);border-radius:9px;padding:8px 13px;font-weight:800;font-size:13px;cursor:pointer"><i class="fa-solid fa-plus" style="margin-right:4px"></i>기준 추가</button>
          <button onclick="_setSaveRules()" style="border:0;border-radius:9px;padding:8px 16px;font-weight:800;font-size:13px;color:#fff;background:#1A8A4A;cursor:pointer"><i class="fa-solid fa-floppy-disk" style="margin-right:5px"></i>저장</button>
        </div>
      </div>
      <p class="dim" style="font-size:11.5px;font-weight:700;margin:0 0 12px">위에서부터 순서대로 적용 · <b>누적 상위 N등</b>(예: 로얄버니 TOP5 → 문버니 TOP25면 6~25등) · <b>점수 이상</b>(메소) · <b>하위 N명</b> · <b>미참(0점)</b>. 직위명은 위 직위 목록과 같게.</p>
      <div id="setRuleEditor">${_setRuleRowsHtml()}</div>
    </div>
    <div class="panel" style="border-radius:20px;padding:20px;margin-bottom:16px;border:2px solid var(--bunny-light)">
      <h3 style="font-weight:900;font-size:15px;margin:0 0 8px"><i class="fa-solid fa-bullhorn" style="margin-right:6px;color:var(--bunny-deep)"></i>📢 길드 개편 적용 (직위명 일괄 변경)</h3>
      <p class="dim" style="font-size:12px;font-weight:700;margin:0 0 6px;line-height:1.6">공지대로 <b>버니·늑대 직위명</b>을 한 번에 바꿔요(설정의 직위·승강기준·색상·면제 + <b>멤버들의 직위(DB)</b>까지 일괄).<br>
        버니: 마카롱→버니버니 · 다쿠아즈→당근당근 · 크라운→로얄버니 · 파르페→문버니 · 티라미슈→스타버니 · 크로칸슈→코튼버니 · 롤케이크→토끼풀 · 팬케이크→새싹 · 스콘→돌멩이<br>
        늑대: 마카롱→늑대 · 다쿠아즈→울프 · 뚠케이크→딩고 · 뚠바게트→허스키 · 뚠브레드→강아지 · 뚠스콘→발자국<br>
        승강기준: 문버니 TOP25 · 스타버니 TOP60 · 코튼버니 13만 이상</p>
      <p class="dim" style="font-size:11px;font-weight:700;margin:0 0 12px;color:var(--warn-tx)"><i class="fa-solid fa-triangle-exclamation" style="margin-right:4px"></i>라이브 공유 DB에 반영 · 1회만 누르면 됨(이미 바뀐 이름은 건너뜀) · 운영진 로그인 필요</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="_setReformPreview()" style="border:1px solid var(--line);background:var(--panel-2);color:var(--text);border-radius:10px;padding:9px 16px;font-weight:800;font-size:13px;cursor:pointer"><i class="fa-solid fa-eye" style="margin-right:5px"></i>변경 미리보기</button>
        <button onclick="_setReformApply()" style="border:0;border-radius:10px;padding:9px 18px;font-weight:800;font-size:13px;color:#fff;background:var(--bunny-deep);cursor:pointer"><i class="fa-solid fa-wand-magic-sparkles" style="margin-right:5px"></i>개편 적용</button>
      </div>
    </div>
    <details class="panel" style="border-radius:20px;padding:20px">
      <summary style="cursor:pointer;font-weight:900;font-size:15px;display:flex;align-items:center;gap:8px"><i class="fa-solid fa-code" style="color:var(--dim)"></i>고급 — 전체 설정 JSON (승강기준·보상 등)</summary>
      <div style="display:flex;justify-content:flex-end;margin:12px 0">
        <button onclick="_settingsSave()" style="border:0;border-radius:10px;padding:9px 18px;font-weight:800;color:#fff;background:var(--bunny-main);cursor:pointer"><i class="fa-solid fa-floppy-disk" style="margin-right:5px"></i>JSON 저장</button>
      </div>
      <textarea id="set_json" rows="16" style="width:100%;border:1px solid var(--line);background:var(--panel-2);border-radius:12px;padding:12px;font-family:ui-monospace,monospace;font-size:12px;line-height:1.5;color:var(--text);outline:0;resize:vertical">${escHtml(JSON.stringify(cfg,null,2))}</textarea>
      <p class="dim" style="font-size:12px;font-weight:700;margin:10px 0 0"><i class="fa-solid fa-triangle-exclamation" style="margin-right:5px"></i>직위는 위 편집기로. 여긴 그 외 설정(보상·승강기준 등) — JSON 깨지면 저장 안 됨.</p>
    </details>`;
}
function _setRankRowsHtml(){
  if(!_setRanks.length) return '<div class="dim" style="font-size:13px;font-weight:700;padding:8px 2px">직위가 없어요 — "직위 추가"로 시작</div>';
  return _setRanks.map((r,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line)">
    <span class="dim" style="font-size:12px;font-weight:900;width:22px;text-align:right">${i+1}</span>
    <div style="display:flex;flex-direction:column;gap:1px">
      <button onclick="_setRankMove(${i},-1)" ${i===0?'disabled':''} style="border:0;background:transparent;color:${i===0?'var(--line)':'var(--dim)'};cursor:${i===0?'default':'pointer'};font-size:10px;line-height:1"><i class="fa-solid fa-caret-up"></i></button>
      <button onclick="_setRankMove(${i},1)" ${i===_setRanks.length-1?'disabled':''} style="border:0;background:transparent;color:${i===_setRanks.length-1?'var(--line)':'var(--dim)'};cursor:${i===_setRanks.length-1?'default':'pointer'};font-size:10px;line-height:1"><i class="fa-solid fa-caret-down"></i></button>
    </div>
    <input value="${escAttr(r.name)}" oninput="_setRankRename(${i},this.value)" style="flex:1;min-width:0;border:1px solid var(--line);background:var(--panel-2);border-radius:9px;padding:8px 11px;font-weight:800;font-size:14px;color:var(--text);outline:0">
    <button onclick="_setRankExempt(${i})" style="border:0;border-radius:8px;padding:7px 12px;font-weight:800;font-size:12px;cursor:pointer;background:${r.exempt?'var(--bunny-deep)':'var(--panel-2)'};color:${r.exempt?'#fff':'var(--dim)'}"><i class="fa-solid fa-shield-halved" style="margin-right:4px"></i>수로면제 ${r.exempt?'ON':'OFF'}</button>
    <button onclick="_setRankDel(${i})" title="삭제" style="border:0;background:transparent;color:var(--dim);cursor:pointer;padding:7px"><i class="fa-solid fa-trash"></i></button>
  </div>`).join('');
}
function _setRankRender(){ const el=document.getElementById('setRankEditor'); if(el) el.innerHTML=_setRankRowsHtml(); }
window._setRankMove=(i,d)=>{ const j=i+d; if(j<0||j>=_setRanks.length) return; const t=_setRanks[i]; _setRanks[i]=_setRanks[j]; _setRanks[j]=t; _setRankRender(); };
window._setRankRename=(i,v)=>{ if(_setRanks[i]) _setRanks[i].name=v; };
window._setRankExempt=(i)=>{ if(_setRanks[i]) _setRanks[i].exempt=!_setRanks[i].exempt; _setRankRender(); };
window._setRankDel=(i)=>{ _setRanks.splice(i,1); _setRankRender(); };
window._setRankAdd=()=>{ _setRanks.push({ name:'새 직위', exempt:false }); _setRankRender(); setTimeout(()=>{ const inps=document.querySelectorAll('#setRankEditor input'); const last=inps[inps.length-1]; if(last){ last.focus(); last.select(); } },0); };
/* 승강 기준(autoRankRules) 편집 */
const _RULE_TYPES=[['topN','누적 상위 N등'],['min','점수 이상'],['bottomN','하위 N명'],['exact','미참(0점)']];
function _setRuleRowsHtml(){
  if(!_setRules.length) return '<div class="dim" style="font-size:13px;font-weight:700;padding:8px 2px">승강 기준이 없어요 — "기준 추가"로 시작</div>';
  const RF='border:1px solid var(--line);background:var(--panel-2);border-radius:8px;padding:7px 9px;font-weight:700;font-size:13px;color:var(--text);outline:0';
  return _setRules.map((r,i)=>`<div style="display:flex;align-items:center;gap:7px;padding:6px 0;border-bottom:1px solid var(--line);flex-wrap:wrap">
    <span class="dim" style="width:20px;text-align:right;font-weight:900;font-size:12px">${i+1}</span>
    <div style="display:flex;flex-direction:column;gap:1px">
      <button onclick="_setRuleMove(${i},-1)" ${i===0?'disabled':''} style="border:0;background:transparent;color:${i===0?'var(--line)':'var(--dim)'};cursor:${i===0?'default':'pointer'};font-size:10px;line-height:1"><i class="fa-solid fa-caret-up"></i></button>
      <button onclick="_setRuleMove(${i},1)" ${i===_setRules.length-1?'disabled':''} style="border:0;background:transparent;color:${i===_setRules.length-1?'var(--line)':'var(--dim)'};cursor:${i===_setRules.length-1?'default':'pointer'};font-size:10px;line-height:1"><i class="fa-solid fa-caret-down"></i></button>
    </div>
    <input value="${escAttr(r.rank)}" oninput="_setRuleField(${i},'rank',this.value)" placeholder="직위명" style="flex:1;min-width:90px;${RF}">
    <select onchange="_setRuleType(${i},this.value)" style="${RF}">${_RULE_TYPES.map(([v,l])=>`<option value="${v}" ${r.type===v?'selected':''}>${l}</option>`).join('')}</select>
    ${r.type==='exact'?'<span class="dim" style="width:104px;font-size:11px;font-weight:700;text-align:center">0점 고정</span>':`<input type="number" value="${r.value}" oninput="_setRuleField(${i},'value',this.value)" style="width:104px;${RF}">`}
    <button onclick="_setRuleDel(${i})" title="삭제" style="border:0;background:transparent;color:var(--dim);cursor:pointer;padding:6px"><i class="fa-solid fa-trash"></i></button>
  </div>`).join('');
}
function _setRuleRender(){ const el=document.getElementById('setRuleEditor'); if(el) el.innerHTML=_setRuleRowsHtml(); }
window._setRuleMove=(i,d)=>{ const j=i+d; if(j<0||j>=_setRules.length) return; const t=_setRules[i]; _setRules[i]=_setRules[j]; _setRules[j]=t; _setRuleRender(); };
window._setRuleField=(i,f,v)=>{ if(_setRules[i]) _setRules[i][f]=v; };
window._setRuleType=(i,v)=>{ if(_setRules[i]){ _setRules[i].type=v; } _setRuleRender(); };
window._setRuleDel=(i)=>{ _setRules.splice(i,1); _setRuleRender(); };
window._setRuleAdd=()=>{ _setRules.push({ rank:'', type:'topN', value:5 }); _setRuleRender(); };
window._setSaveRules=async ()=>{
  if(!isAdmin()) return alert('운영진만 저장할 수 있어요.');
  const FK=FACTIONS[_setFac]||FACTIONS.bunny, facKey=FK.key;
  const out=_setRules.filter(r=>(r.rank||'').trim()).map(r=>{ const o={ rank:r.rank.trim() }; const n=Number(r.value)||0;
    if(r.type==='topN') o.topN=n; else if(r.type==='bottomN') o.bottomN=n; else if(r.type==='exact') o.exactScore=0; else o.min=n; return o; });
  const cfg=_cfg||await getConfig();
  if(!cfg.autoRankRules) cfg.autoRankRules={}; cfg.autoRankRules[facKey]=out;
  const { error } = await db().from('site_config').update({ config:cfg, updated_at:new Date().toISOString() }).eq('id',_cfgId);
  if(error) return alert('저장 실패: '+error.message);
  _cfg=cfg; alert(`${FK.label} 승강 기준 ${out.length}개 저장됐어요 ✓`);
};
window._setFacTab=async (k)=>{
  if(!FACTIONS[k]) return; _setFac=k;
  const el=document.getElementById('pageBody'); if(!el) return;
  el.innerHTML=loadingHTML('settings');
  try{ el.innerHTML=await buildSettings(); }catch(e){ el.innerHTML=errorHTML('settings',e); }
};
window._settingsSaveRanks=async ()=>{
  if(!isAdmin()) return alert('운영진만 저장할 수 있어요.');
  const FK=FACTIONS[_setFac]||FACTIONS.bunny, facKey=FK.key;
  const names=_setRanks.map(r=>(r.name||'').trim()).filter(Boolean);
  if(new Set(names).size!==names.length) return alert('같은 이름의 직위가 있어요. 중복을 없애주세요.');
  const exemptList=_setRanks.filter(r=>r.exempt&&(r.name||'').trim()).map(r=>r.name.trim());
  const cfg=_cfg||await getConfig();
  if(!cfg.ranks) cfg.ranks={}; cfg.ranks[facKey]=names;
  const curNames=new Set(names);
  cfg.suroExempt=[...((cfg.suroExempt||[]).filter(n=>!curNames.has(n))), ...exemptList];   // 다른 길드 면제는 보존
  const { error } = await db().from('site_config').update({ config:cfg, updated_at:new Date().toISOString() }).eq('id',_cfgId);
  if(error) return alert('저장 실패: '+error.message);
  _cfg=cfg; alert(`${FK.label} 직위 ${names.length}개 저장됐어요 ✓ (수로면제 ${exemptList.length}개)`);
};
window._setSaveBasic=async ()=>{
  if(!isAdmin()) return alert('운영진만 저장할 수 있어요.');
  const v=id=>{ const el=document.getElementById(id); return el?el.value.trim():''; };
  const cfg=_cfg||await getConfig();
  const facKey=(FACTIONS[_setFac]||FACTIONS.bunny).key;
  const guilds=cfg.guilds||(cfg.guilds=[]);
  let gg=guilds.find(x=>x.name===facKey); if(!gg){ gg={ name:facKey }; guilds.push(gg); }
  gg.icon=v('set_icon'); gg.type=v('set_type');
  const mx=Number(v('set_max')); if(mx) gg.max=mx;
  if(v('set_start')) cfg.guildStartDate=v('set_start');
  cfg.guildLogo=v('set_logo');
  const pc=Number(String(v('set_piece')).replace(/[^\d]/g,'')); if(pc){ cfg.piecePrice=pc; if(cfg.suroReward) cfg.suroReward.piecePrice=pc; }
  cfg.suroExemptNote=v('set_exnote');
  const { error } = await db().from('site_config').update({ config:cfg, updated_at:new Date().toISOString() }).eq('id',_cfgId);
  if(error) return alert('저장 실패: '+error.message);
  _cfg=cfg; alert('기본 정보가 저장됐어요 ✓');
};
/* ===== 길드 대규모 개편(직위명 변경 + 승강기준) — 공지 기반 1회성 마이그레이션 ===== */
const _REFORM = {
  '뚠카롱': { label:'버니',
    renames:{ '마카롱':'버니버니','다쿠아즈':'당근당근','크라운':'로얄버니','파르페':'문버니','티라미슈':'스타버니','크로칸슈':'코튼버니','롤케이크':'토끼풀','팬케이크':'새싹','스콘':'돌멩이' },
    rules:{ '문버니':{topN:25}, '스타버니':{topN:60}, '코튼버니':{min:130000} } },  // 로얄버니 TOP5·새싹 하위20·돌멩이 미참은 기존과 동일
  '뚱카롱': { label:'늑대',
    renames:{ '마카롱':'늑대','다쿠아즈':'울프','뚠케이크':'딩고','뚠바게트':'허스키','뚠브레드':'강아지','뚠스콘':'발자국' },
    rules:{} }
};
function _reformConfig(orig){
  const cfg=JSON.parse(JSON.stringify(orig||{}));
  const guildKeys=Object.keys(_REFORM);
  for(const gk of guildKeys){
    const ren=_REFORM[gk].renames, m=n=>ren[n]||n;
    if(cfg.ranks&&cfg.ranks[gk]) cfg.ranks[gk]=cfg.ranks[gk].map(m);
    if(cfg.autoRankRules&&cfg.autoRankRules[gk]) cfg.autoRankRules[gk]=cfg.autoRankRules[gk].map(r=>{ const nr={...r, rank:m(r.rank)}; const u=_REFORM[gk].rules[nr.rank]; if(u) Object.assign(nr,u); return nr; });
    if(cfg.cutoffs&&cfg.cutoffs[gk]) cfg.cutoffs[gk]=cfg.cutoffs[gk].map(r=>({...r, rank:m(r.rank)}));
    if(cfg.autoRankExemptRoles&&cfg.autoRankExemptRoles[gk]) cfg.autoRankExemptRoles[gk]=cfg.autoRankExemptRoles[gk].map(m);
  }
  // 전역 맵: 새 이름 키를 옛 값 복제로 추가(옛 키는 보존 — 충돌/누락 방지)
  const clone=(obj,old,nw)=>{ if(obj&&obj[old]!==undefined&&obj[nw]===undefined) obj[nw]=JSON.parse(JSON.stringify(obj[old])); };
  for(const gk of guildKeys) for(const [old,nw] of Object.entries(_REFORM[gk].renames)){ clone(cfg.rolePriority,old,nw); clone(cfg.roleDisplay,old,nw); clone(cfg.rowHighlightRoles,old,nw); }
  if(Array.isArray(cfg.suroExempt)){ const all={}; for(const gk of guildKeys) Object.assign(all,_REFORM[gk].renames); cfg.suroExempt=cfg.suroExempt.map(n=>all[n]||n); }
  return cfg;
}
async function _reformMigrateRoles(){
  const res=[];
  for(const gk of Object.keys(_REFORM)) for(const [old,nw] of Object.entries(_REFORM[gk].renames)){
    const { data, error } = await db().from('members').update({ role:nw }).eq('guild',gk).eq('role',old).select('id');
    res.push(`${_REFORM[gk].label} ${old}→${nw}: ${error?('실패 '+error.message):((data?data.length:0)+'명')}`);
  }
  return res;
}
window._setReformPreview=async ()=>{
  const cfg=_cfg||await getConfig();
  const ranksAfter={};
  for(const gk of Object.keys(_REFORM)) ranksAfter[_REFORM[gk].label]=_reformConfig(cfg).ranks[gk];
  alert('변경 후 직위 (미리보기):\n\n'+Object.entries(ranksAfter).map(([g,r])=>`[${g}] `+r.join(', ')).join('\n\n'));
};
window._setReformApply=async ()=>{
  if(!isAdmin()) return alert('운영진만 적용할 수 있어요.');
  if(!confirm('📢 길드 개편 적용\n\n· 버니·늑대 직위명을 새 이름으로 일괄 변경 (설정 + 멤버 직위 DB)\n· 승강 기준 갱신: 문버니 TOP25, 스타버니 TOP60, 코튼버니 13만 이상\n\n※ 라이브 공유 DB에 반영됩니다(되돌리기 어려움). 진행할까요?')) return;
  const cfg=_cfg||await getConfig();
  const nc=_reformConfig(cfg);
  const { error } = await db().from('site_config').update({ config:nc, updated_at:new Date().toISOString() }).eq('id',_cfgId);
  if(error) return alert('설정 저장 실패: '+error.message+'\n(운영진 구글 로그인 상태인지 확인해주세요)');
  _cfg=nc;
  const roleRes=await _reformMigrateRoles();
  alert('개편 적용 완료 ✓\n\n[멤버 직위 변경]\n'+roleRes.join('\n')+'\n\n승강 기준은 위 "승강 기준 편집"에서 세부 조정 가능(토끼풀 등).');
  const el=document.getElementById('pageBody'); if(el){ el.innerHTML=loadingHTML('settings'); try{ el.innerHTML=await buildSettings(); }catch(e){ el.innerHTML=errorHTML('settings',e); } }
};
window._settingsSave=async ()=>{
  if(!isAdmin()) return alert('운영진만 저장할 수 있어요.');
  let obj; try{ obj=JSON.parse(document.getElementById('set_json').value); }catch(e){ return alert('JSON 형식 오류: '+e.message); }
  const { error } = await db().from('site_config').update({ config:obj, updated_at:new Date().toISOString() }).eq('id',_cfgId);
  if(error) return alert('저장 실패: '+error.message);
  _cfg=obj; alert('설정이 저장됐어요 ✓');
};

/* ----- 직위 반영 (autoRankRules 자동 계산 · 기존 알고리즘 포팅) ----- */
async function buildRoleAssign(){
  const cfg=await getConfig();
  const rules=(cfg.autoRankRules&&cfg.autoRankRules[GUILD])||[];
  const {data:periods}=await db().from('suro_periods').select('id,period_label').order('start_date',{ascending:false}).limit(1);
  const pid=periods?.[0]?.id;
  const [{data:members,error:em},{data:scores},{data:abs}] = await Promise.all([
    db().from('members').select('id,name,role,is_main').eq('guild',GUILD).limit(3000),
    pid?db().from('suro_scores').select('member_id,score').eq('guild',GUILD).eq('period_id',pid).limit(4000):Promise.resolve({data:[]}),
    db().from('absence_exemptions').select('member_name,reason_type,end_date,status').eq('status','approved').limit(500),
  ]);
  if(em) throw em;
  const sm={}; (scores||[]).forEach(s=>sm[s.member_id]=Number(s.score)||0);
  const today=new Date().toISOString().slice(0,10), absMap={};
  (abs||[]).forEach(a=>{ if(!a.end_date||a.end_date>=today) absMap[a.member_name]=a; });
  let mains=(members||[]).filter(m=>m.is_main!==false).map(m=>({name:m.name,role:(m.role||'').trim(),score:sm[m.id]||0}));
  mains.sort((a,b)=>b.score-a.score);
  const rankMap={}; mains.forEach((m,i)=>rankMap[m.name]=i); const totalMain=mains.length;
  const exactR=rules.filter(r=>r.exactScore!=null);
  const topNR=rules.filter(r=>r.topN>0&&r.exactScore==null).sort((a,b)=>a.topN-b.topN);
  const bottomNR=rules.filter(r=>r.bottomN>0&&r.exactScore==null);
  const scoreR=rules.filter(r=>!r.topN&&!r.bottomN&&r.exactScore==null).sort((a,b)=>(b.min||0)-(a.min||0));
  const roleFor=(m)=>{
    const score=m.score;
    for(const r of exactR){ if(score===r.exactScore&&r.rank) return r.rank; }
    const idx=rankMap[m.name];
    if(idx!==undefined){
      for(const r of bottomNR){ if(idx>=totalMain-(r.bottomN||0)) return r.rank; }
      let cum=0; for(const r of topNR){ cum+=(r.topN||0); if(idx<cum&&score>0) return r.rank; }
    }
    for(const r of scoreR){ if(score>=(r.min||0)) return r.rank; }
    return scoreR.length?scoreR[scoreR.length-1].rank:'스콘';
  };
  const all=mains.map(m=>({...m,to:roleFor(m),protected:!!absMap[m.name],absReason:absMap[m.name]?.reason_type})).filter(m=>m.role!==m.to);
  const fmt=(n)=>(Number(n)||0).toLocaleString();
  const defChecked=all.filter(c=>!c.protected).length;
  const row=(c)=>`<tr style="border-bottom:1px solid var(--line);${c.protected?'background:var(--warn-bg)':''}">
    <td style="text-align:center;width:36px"><input type="checkbox" class="rc" data-name="${escAttr(c.name)}" data-to="${escAttr(c.to)}" ${c.protected?'':'checked'} onchange="_roleCount()" style="width:18px;height:18px;accent-color:var(--bunny-main);cursor:pointer"></td>
    <td style="padding:9px 8px;font-weight:800">${c.name}${c.protected?`<div class="dim" style="font-size:10px;font-weight:700">🔒 보호 · ${c.absReason||'장기부재'}</div>`:''}</td>
    <td class="dim" style="font-weight:800;text-align:right;width:90px">${fmt(c.score)}</td>
    <td style="text-align:center;white-space:nowrap">${memRoleChip(c.role||'(없음)')} <i class="fa-solid fa-arrow-right" style="color:var(--bunny-main);margin:0 6px"></i> ${c.protected?`${memRoleChip(c.role||'-')} <span class="dim" style="font-size:10px">(유지)</span>`:memRoleChip(c.to)}</td></tr>`;
  return headerHTML('직위 반영', `변경 제안 ${all.length}건`) +
    `<div class="panel" style="border-radius:20px;padding:16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <span style="font-weight:800"><i class="fa-solid fa-wand-magic-sparkles" style="color:var(--bunny-main);margin-right:6px"></i>최신 회차 기준 자동 계산 · 선택 <b id="roleSel" style="color:var(--bunny-deep)">${defChecked}</b>건 적용 <span class="dim" style="font-size:12px">(특수직위·장기부재는 직접 확인)</span></span>
      <button onclick="_roleApply()" style="border:0;border-radius:10px;padding:10px 20px;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--bunny-main),var(--bunny-deep));cursor:pointer"><i class="fa-solid fa-check"></i> 선택 적용</button>
    </div>
    <div class="panel" style="border-radius:24px;padding:20px">
      <div class="scroll" style="overflow-x:auto;max-height:620px;overflow-y:auto"><table style="width:100%;border-collapse:collapse;font-size:14px;min-width:520px">
        <thead><tr class="dim" style="font-size:12px;font-weight:700;border-bottom:2px solid var(--line);position:sticky;top:0;background:var(--panel)"><th style="text-align:center;padding:10px 0"><input type="checkbox" checked onclick="document.querySelectorAll('.rc').forEach(c=>c.checked=this.checked);_roleCount()" style="width:18px;height:18px;cursor:pointer"></th><th style="text-align:left;padding:10px 8px">닉네임</th><th style="text-align:right;padding:10px 0">점수</th><th style="text-align:center;padding:10px 0">현재 → 제안</th></tr></thead>
        <tbody style="font-weight:500">${all.map(row).join('')||'<tr><td colspan="4" class="dim" style="padding:30px;text-align:center;font-weight:700">변경할 직위가 없어요 (모두 최신)</td></tr>'}</tbody></table></div>
      <p class="dim" style="font-size:12px;font-weight:700;margin:14px 0 0"><i class="fa-solid fa-shield-halved" style="margin-right:5px"></i>마카롱·다쿠아즈 같은 특수직위, 장기부재 면제 멤버는 기본 해제 — 체크된 것만 적용돼요</p>
    </div>`;
}
window._roleCount = ()=>{ const n=document.querySelectorAll('.rc:checked').length; const el=document.getElementById('roleSel'); if(el) el.textContent=n; };
window._roleApply = async ()=>{
  if(!isAdmin()) return alert('운영진만 적용할 수 있어요.');
  const sel=[...document.querySelectorAll('.rc:checked')].map(c=>({name:c.dataset.name,to:c.dataset.to}));
  if(!sel.length) return alert('선택된 변경이 없어요.');
  if(!confirm(`${sel.length}명의 직위를 변경할까요?`)) return;
  let ok=0,fail=0;
  for(const c of sel){ const { error } = await db().from('members').update({ role:c.to }).eq('guild',GUILD).eq('name',c.name); if(error) fail++; else ok++; }
  alert(`적용 완료 — 성공 ${ok}${fail?` · 실패 ${fail}`:''}`); render();
};

/* ----- 수로 입력 (실시간 동시 입력 · 셀 단위 자동저장) ----- */
let _siMembers=[], _siPid=null, _siPeriods=[], _siScores={}, _siPrev={}, _siEditing={}, _siPresence=[], _siCh=null, _siOnlyEmpty=false, _siTimers={}, _siPoll=null, _siVisBound=false;
async function buildSuroInput(){
  const { data:periods, error } = await db().from('suro_periods').select('id,period_label,start_date').order('start_date',{ascending:false}).limit(80);
  if(error) throw error;
  _siPeriods=periods||[]; _siPid=_siPeriods[0]?.id;
  const curLabel=_suroPeriodLabel(); const hasCur=_siPeriods.some(p=>p.period_label===curLabel); const curRange=curLabel.replace(' 수로 점수','');
  const inp='border:1px solid var(--line);background:var(--panel-2);border-radius:11px;padding:10px 12px;font-weight:800;font-size:14px;color:var(--text);outline:0;';
  const rowsHtml = _siPid ? await _siFetch(_siPid) : `<div class="dim" style="padding:30px;text-align:center;font-weight:700">아직 회차가 없어요 — 위 <b>+ 회차</b>로 이번 주차(${escHtml(curRange)})를 만들어주세요</div>`;
  setTimeout(()=>{ try{ _siSubscribe(); }catch(e){} _siUpdateProgress(); }, 60);
  if(!_siVisBound){ _siVisBound=true; document.addEventListener('visibilitychange',()=>{ if(!document.hidden && document.getElementById('si_list')) _siRefresh(); }); }
  return headerHTML('수로 입력','실시간 동시 입력 · 자동 저장') +
    `<div class="panel" style="border-radius:18px;padding:13px 15px;margin-bottom:13px;position:sticky;top:8px;z-index:8">
      <div style="display:flex;gap:9px;align-items:center;flex-wrap:wrap">
        <select id="si_period" onchange="_siLoad(this.value)" style="${inp};flex:1;min-width:180px">${_siPeriods.map(p=>`<option value="${p.id}">${escHtml(p.period_label)}</option>`).join('')}</select>
        <div style="flex:1;min-width:150px;display:flex;align-items:center;gap:7px;background:var(--panel-2);border:1px solid var(--line);border-radius:11px;padding:0 12px"><i class="fa-solid fa-magnifying-glass dim"></i><input id="si_q" oninput="_siSearch()" placeholder="닉네임 검색…" style="border:0;background:transparent;flex:1;padding:10px 0;font-weight:800;font-size:14px;color:var(--text);outline:0"></div>
        <button id="si_only" onclick="_siToggleEmpty()" style="border:1px solid var(--line);background:var(--panel-2);color:var(--text);border-radius:11px;padding:10px 13px;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap">미입력만</button>
        <button onclick="_siAddPeriod()" title="새 회차(주차) 추가" style="border:1px solid var(--bunny-main);background:var(--bunny-light);color:var(--bunny-deep);border-radius:11px;padding:10px 13px;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap"><i class="fa-solid fa-plus" style="margin-right:4px"></i>회차</button>
        <button onclick="_siOcrOpen()" title="화면 캡처로 수로 점수 자동 인식" style="border:1px solid var(--bunny-deep);background:var(--bunny-deep);color:#fff;border-radius:11px;padding:10px 13px;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap"><i class="fa-solid fa-camera" style="margin-right:4px"></i>OCR</button>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:11px;font-size:12px;font-weight:800;flex-wrap:wrap;gap:4px">
        <span id="si_presence" class="dim"><i class="fa-solid fa-spinner fa-spin" style="margin-right:6px"></i>연결 중…</span>
        <span id="si_pcount" style="color:var(--bunny-deep)">입력 0 / 0</span>
      </div>
      <div style="height:8px;background:var(--panel-2);border-radius:99px;overflow:hidden;margin-top:7px"><div id="si_fill" style="height:100%;width:0%;background:linear-gradient(90deg,var(--bunny-main),var(--bunny-deep));border-radius:99px;transition:width .25s"></div></div>
    </div>
    ${!hasCur?`<div class="panel" style="border-radius:14px;padding:12px 15px;margin-bottom:13px;border:2px solid var(--bunny-light);display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-weight:800;font-size:13px"><i class="fa-solid fa-calendar-plus" style="color:var(--bunny-deep);margin-right:6px"></i>이번 주차 <b style="color:var(--bunny-deep)">${escHtml(curRange)}</b> 회차가 아직 없어요</span>
      <button onclick="_siAddPeriod('${curLabel}')" style="border:0;background:var(--bunny-deep);color:#fff;border-radius:9px;padding:8px 14px;font-weight:800;font-size:13px;cursor:pointer;margin-left:auto"><i class="fa-solid fa-plus" style="margin-right:4px"></i>이번 주차 만들기</button>
    </div>`:''}
    <div class="panel" style="border-radius:18px;padding:4px 2px"><div id="si_list" class="scroll" style="max-height:66vh;overflow-y:auto">${rowsHtml}</div></div>
    <p class="dim" style="font-size:12px;font-weight:700;text-align:center;margin-top:12px"><i class="fa-solid fa-bolt" style="color:var(--bunny-main);margin-right:5px"></i>점수 입력 후 Enter → 자동 저장 + 다음 칸. 다른 운영진 입력도 실시간으로 반영돼요.</p>`;
}
function _suroPeriodLabel(dateObj){ const now=dateObj||new Date(); let d=now.getDay()-3; if(d<0)d+=7; const end=new Date(now); end.setDate(now.getDate()-d); const start=new Date(end); start.setDate(end.getDate()-6); const f=x=>`${String(x.getFullYear()).slice(-2)}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; return `${f(start)}(목) ~ ${f(end)}(수) 수로 점수`; }
window._siAddPeriod=async (preset)=>{
  if(!isAdmin()) return alert('운영진만 회차를 추가할 수 있어요. 운영진 로그인 후 이용해주세요.');
  const label=(prompt('새 회차(주차) 라벨\n형식: YY-MM-DD(목) ~ YY-MM-DD(수) 수로 점수', preset||_suroPeriodLabel())||'').trim();
  if(!label) return;
  let newId=null;
  const { data:exist }=await db().from('suro_periods').select('id').eq('period_label',label).maybeSingle();
  if(exist){ alert('이미 있는 회차예요 — 선택해서 입력하면 돼요.'); newId=exist.id; }
  else{
    const m=label.match(/(\d{2})-(\d{2})-(\d{2})\(.\)\s*~\s*(\d{2})-(\d{2})-(\d{2})/);
    const start=m?`20${m[1]}-${m[2]}-${m[3]}`:new Date().toISOString().slice(0,10);
    const end=m?`20${m[4]}-${m[5]}-${m[6]}`:new Date().toISOString().slice(0,10);
    const { data:np, error }=await db().from('suro_periods').insert({ period_label:label, start_date:start, end_date:end }).select().single();
    if(error) return alert('회차 생성 실패: '+error.message+'\n(운영진 로그인 상태인지 확인해주세요)');
    newId=np.id;
  }
  const el=document.getElementById('pageBody'); if(!el) return;
  el.innerHTML=loadingHTML('suro_input');
  try{ el.innerHTML=await buildSuroInput(); const sel=document.getElementById('si_period'); if(sel&&newId){ sel.value=String(newId); await _siLoad(newId); } }
  catch(e){ el.innerHTML=errorHTML('suro_input',e); }
};
/* ===== 수로 OCR 가져오기 (maplelens 자체호스팅 워커: ocr/worker.js) =====
   화면 캡처 → OpenCV 템플릿매칭으로 {name,culv(지하수로)} 인식 → 현재 회차 멤버 이름매칭 → 일괄 반영 */
let _siOcrWorker=null,_siOcrReady=false,_siOcrStream=null,_siOcrVideo=null,_siOcrLoop=null,_siOcrBusy=false,_siOcrRecs=new Map();
const _siOcrNorm=s=>String(s||'').replace(/\s+/g,'').trim();
function _siOcrStatus(t){ const el=document.getElementById('siocr_status'); if(el) el.textContent=t; }
function _siOcrSetDot(c){ const dot=document.getElementById('siocr_dot'); if(dot) dot.style.background=c; }
function _siOcrInit(){
  if(_siOcrWorker) return;
  try{ _siOcrWorker=new Worker(new URL('ocr/worker.js',location.href)); }
  catch(e){ _siOcrStatus('OCR 워커 생성 실패: '+e.message); return; }
  _siOcrWorker.onmessage=(ev)=>{ const d=ev.data||{};
    if(d.type==='READY'){ _siOcrReady=true; _siOcrStatus('OCR 엔진 준비 완료 — 캡처 시작'); _siOcrSetDot('var(--ok-tx)'); const b=document.getElementById('siocr_start'); if(b) b.disabled=false; }
    else if(d.type==='RESULT'){ (d.payload||[]).forEach(r=>{ if(r&&r.name) _siOcrRecs.set(r.name,{name:r.name,culv:Number(r.culv)||0}); }); _siOcrBusy=false; _siOcrRenderList(); }
  };
  _siOcrWorker.onerror=(e)=>{ _siOcrStatus('OCR 오류: '+(e.message||'worker error')); _siOcrBusy=false; };
}
window._siOcrOpen=()=>{
  _siOcrRecs=new Map(); _siOcrInit();
  document.getElementById('siocr_modal')?.remove();
  const m=document.createElement('div'); m.id='siocr_modal';
  m.style.cssText='position:fixed;inset:0;z-index:3000;display:flex;align-items:center;justify-content:center;background:rgba(40,12,24,.34);backdrop-filter:blur(3px);padding:14px';
  m.innerHTML=`<div class="panel" style="width:100%;max-width:560px;max-height:90vh;display:flex;flex-direction:column;border-radius:20px;overflow:hidden">
    <div style="padding:15px 18px;background:linear-gradient(135deg,var(--bunny-light),var(--bunny-main));color:#fff;display:flex;justify-content:space-between;align-items:flex-start">
      <div><div style="font-weight:900;font-size:16px"><i class="fa-solid fa-camera" style="margin-right:7px"></i>화면 캡처 OCR</div>
      <div style="font-size:11px;opacity:.95;margin-top:3px">메이플 <b>길드 → 길드 컨텐츠</b> 창을 띄운 채로 캡처</div></div>
      <button onclick="_siOcrClose()" style="background:transparent;border:0;color:#fff;font-size:22px;cursor:pointer;line-height:1">&times;</button>
    </div>
    <div style="padding:16px 18px;overflow-y:auto;display:flex;flex-direction:column;gap:13px">
      <div class="panel" style="background:var(--panel-2);border-radius:13px;padding:12px 14px;display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:800"><span id="siocr_dot" style="width:9px;height:9px;border-radius:99px;background:var(--warn-tx);display:inline-block"></span><span id="siocr_status">OCR 엔진 로딩 중… (최초 1회 약 10초)</span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="siocr_start" onclick="_siOcrStart()" disabled style="flex:1;min-width:130px;border:0;background:var(--bunny-deep);color:#fff;border-radius:11px;padding:11px;font-weight:800;font-size:13px;cursor:pointer"><i class="fa-solid fa-play" style="margin-right:5px"></i>화면 캡처 시작</button>
          <button id="siocr_stop" onclick="_siOcrStop()" style="display:none;flex:1;min-width:130px;border:0;background:var(--bad-tx);color:#fff;border-radius:11px;padding:11px;font-weight:800;font-size:13px;cursor:pointer"><i class="fa-solid fa-stop" style="margin-right:5px"></i>캡처 중지</button>
          <button onclick="_siOcrFile()" title="스크린샷 파일로 인식" style="border:1px solid var(--line);background:var(--panel);color:var(--text);border-radius:11px;padding:11px 13px;font-weight:800;font-size:13px;cursor:pointer"><i class="fa-solid fa-image" style="margin-right:5px"></i>이미지</button>
        </div>
      </div>
      <div style="font-size:11.5px;color:var(--dim);font-weight:700;line-height:1.75">
        1. <b>화면 캡처 시작</b> → 메이플 창(또는 화면) 선택<br>
        2. 길드 컨텐츠 창을 <b>천천히 위→아래로 스크롤</b> (커서가 닉네임·점수 가리지 않게)<br>
        3. 인식되면 아래에 쌓임 → <b>현재 회차에 반영</b>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:800;color:var(--dim);margin-bottom:5px"><span>인식 결과</span><span id="siocr_sum">0명</span></div>
        <div class="panel" style="border-radius:12px;max-height:230px;overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:12.5px" id="siocr_tbl"><tbody><tr><td style="padding:18px;text-align:center;color:var(--dim);font-weight:700">아직 인식된 데이터가 없어요</td></tr></tbody></table></div>
      </div>
      <button onclick="_siOcrApply()" style="border:0;background:linear-gradient(135deg,var(--bunny-main),var(--bunny-deep));color:#fff;border-radius:12px;padding:13px;font-weight:900;font-size:14px;cursor:pointer"><i class="fa-solid fa-arrow-right-to-bracket" style="margin-right:6px"></i>매칭된 사람 현재 회차에 반영</button>
    </div></div>`;
  document.body.appendChild(m);
  m.addEventListener('click',e=>{ if(e.target===m) _siOcrClose(); });
  if(_siOcrReady){ _siOcrStatus('OCR 엔진 준비 완료 — 캡처 시작'); _siOcrSetDot('var(--ok-tx)'); const b=document.getElementById('siocr_start'); if(b) b.disabled=false; }
};
window._siOcrClose=()=>{ _siOcrStop(); document.getElementById('siocr_modal')?.remove(); };
window._siOcrStart=async ()=>{
  if(!_siOcrReady) return _siOcrStatus('OCR 엔진 로딩 중… 잠시만요');
  try{
    const stream=await navigator.mediaDevices.getDisplayMedia({video:{cursor:'never'},audio:false});
    _siOcrStream=stream;
    const v=document.createElement('video'); v.srcObject=stream; v.autoplay=true; v.muted=true; _siOcrVideo=v;
    stream.getVideoTracks()[0].onended=()=>_siOcrStop();
    const a=document.getElementById('siocr_start'), b=document.getElementById('siocr_stop'); if(a) a.style.display='none'; if(b) b.style.display='';
    _siOcrStatus('캡처 중… 길드 컨텐츠 창을 스크롤하세요'); _siOcrSetDot('var(--bunny-deep)');
    const loop=async()=>{
      if(!_siOcrStream) return;
      if(_siOcrBusy || !_siOcrVideo || _siOcrVideo.readyState<2){ _siOcrLoop=setTimeout(loop,200); return; }
      try{ _siOcrBusy=true; const bmp=await createImageBitmap(_siOcrVideo); _siOcrWorker.postMessage({type:'PROCESS_IMAGE',payload:bmp,source:'STREAM'},[bmp]); }
      catch(e){ _siOcrBusy=false; }
      _siOcrLoop=setTimeout(loop,200);
    };
    v.onloadedmetadata=()=>{ v.play(); loop(); };
  }catch(e){ _siOcrStatus('화면 캡처가 취소되었거나 권한이 없어요'); }
};
window._siOcrStop=()=>{
  if(_siOcrLoop){ clearTimeout(_siOcrLoop); _siOcrLoop=null; }
  if(_siOcrStream){ try{ _siOcrStream.getTracks().forEach(t=>t.stop()); }catch(e){} _siOcrStream=null; }
  _siOcrVideo=null; _siOcrBusy=false;
  const a=document.getElementById('siocr_start'), b=document.getElementById('siocr_stop'); if(a) a.style.display=''; if(b) b.style.display='none';
  _siOcrSetDot(_siOcrReady?'var(--ok-tx)':'var(--warn-tx)');
  if(document.getElementById('siocr_modal')) _siOcrStatus('캡처 중지됨 — 결과 확인 후 반영');
};
window._siOcrFile=()=>{
  if(!_siOcrReady) return _siOcrStatus('OCR 엔진 로딩 중… 잠시만요');
  const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.onchange=async e=>{ const f=e.target.files[0]; if(!f) return;
    try{ const bmp=await createImageBitmap(f); _siOcrBusy=true; _siOcrStatus('이미지 인식 중…'); _siOcrWorker.postMessage({type:'PROCESS_IMAGE',payload:bmp,source:'FILE'},[bmp]); }
    catch(err){ _siOcrStatus('이미지 처리 실패: '+err.message); } };
  inp.click();
};
function _siOcrRenderList(){
  const tbl=document.getElementById('siocr_tbl'); if(!tbl) return;
  const recs=[..._siOcrRecs.values()];
  const byName={}; _siMembers.forEach(mm=>byName[_siOcrNorm(mm.name)]=mm);
  let nMatch=0;
  const body=recs.map(r=>{
    const mm=byName[_siOcrNorm(r.name)]; const cur=mm?(_siScores[mm.id]??''):''; if(mm) nMatch++;
    const badge=mm?`<span style="font-size:10px;font-weight:800;padding:2px 7px;border-radius:99px;background:var(--ok-bg);color:var(--ok-tx)">매칭</span>`
                  :`<span style="font-size:10px;font-weight:800;padding:2px 7px;border-radius:99px;background:var(--bad-bg);color:var(--bad-tx)">멤버없음</span>`;
    return `<tr style="border-top:1px solid var(--line)">
      <td style="padding:6px 9px;font-weight:800">${escHtml(r.name)}</td>
      <td style="padding:6px 9px;text-align:right;color:var(--dim)">${cur!==''?Number(cur).toLocaleString():'-'}</td>
      <td style="padding:6px 9px;text-align:right;font-weight:800;color:var(--bunny-deep)">${(r.culv||0).toLocaleString()}</td>
      <td style="padding:6px 9px;text-align:right">${badge}</td></tr>`;
  }).join('');
  tbl.innerHTML=`<thead><tr style="font-size:10px;color:var(--dim);text-transform:uppercase"><th style="padding:6px 9px;text-align:left">닉네임</th><th style="padding:6px 9px;text-align:right">기존</th><th style="padding:6px 9px;text-align:right">인식</th><th style="padding:6px 9px;text-align:right">상태</th></tr></thead><tbody>${body||'<tr><td colspan="4" style="padding:18px;text-align:center;color:var(--dim);font-weight:700">아직 없음</td></tr>'}</tbody>`;
  const sum=document.getElementById('siocr_sum'); if(sum) sum.textContent=`인식 ${recs.length} · 매칭 ${nMatch}`;
}
window._siOcrApply=async ()=>{
  const recs=[..._siOcrRecs.values()]; if(!recs.length) return alert('인식된 데이터가 없어요. 먼저 캡처해주세요.');
  if(!isAdmin()) return alert('운영진만 반영할 수 있어요. 운영진 로그인 후 이용해주세요.');
  if(!_siPid) return alert('회차를 먼저 선택/생성해주세요.');
  const byName={}; _siMembers.forEach(mm=>byName[_siOcrNorm(mm.name)]=mm);
  const matched=recs.map(r=>({m:byName[_siOcrNorm(r.name)],r})).filter(x=>x.m);
  if(!matched.length) return alert('이름이 매칭되는 멤버가 없어요. 닉네임을 확인해주세요.');
  const rows=matched.map(({m,r})=>({member_id:m.id,period_id:_siPid,score:Number(r.culv)||0,guild:GUILD}));
  const { error }=await db().from('suro_scores').upsert(rows,{onConflict:'member_id,period_id'});
  if(error) return alert('반영 실패: '+error.message+'\n(운영진 로그인 상태인지 확인해주세요)');
  matched.forEach(({m,r})=>{ const v=Number(r.culv)||0; _siScores[m.id]=String(v); _siBroadcast('score',{mid:m.id,score:v,by:CURRENT.name||'운영진'}); });
  const n=matched.length, tot=recs.length; _siOcrClose(); _siRenderList();
  alert(`${n}명 수로 점수를 현재 회차에 반영했어요. (인식 ${tot}명 중 매칭 ${n}명)`);
};
async function _siFetch(pid){
  _siScores={}; _siPrev={}; _siEditing={};
  const idx=_siPeriods.findIndex(p=>String(p.id)===String(pid)); const prevPid=_siPeriods[idx+1]?.id;
  const qs=[
    db().from('members').select('id,name,role').eq('guild',GUILD).eq('is_main',true).limit(3000),
    db().from('suro_scores').select('member_id,score').eq('guild',GUILD).eq('period_id',pid).limit(4000),
  ];
  if(prevPid) qs.push(db().from('suro_scores').select('member_id,score').eq('guild',GUILD).eq('period_id',prevPid).limit(4000));
  const res=await Promise.all(qs);
  const members=res[0].data||[], scores=res[1].data||[], prev=prevPid?(res[2].data||[]):[];
  scores.forEach(s=>{ _siScores[s.member_id]=String(Number(s.score)||0); });
  prev.forEach(s=>{ _siPrev[s.member_id]=Number(s.score)||0; });
  _siMembers=members.slice().sort((a,b)=>{ const d=(_siPrev[b.id]||0)-(_siPrev[a.id]||0); if(d) return d; const x=String(a.name||''),y=String(b.name||''); return x<y?-1:x>y?1:0; });   // 동점은 닉네임 유니코드순
  return _siMembers.length ? _siMembers.map(_siRowHTML).join('') : '<div class="dim" style="padding:26px;text-align:center;font-weight:700">멤버 없음</div>';
}
function _siRowHTML(m){
  const v=_siScores[m.id]??''; const prev=_siPrev[m.id]; const who=_siEditing[m.id]; const has=v!=='';
  return `<div class="si_row" data-mid="${m.id}" style="display:flex;align-items:center;gap:11px;padding:9px 12px;border-bottom:1px solid var(--line)">
    <div style="width:32px;height:32px;border-radius:99px;background:linear-gradient(135deg,var(--bunny-light),var(--bunny-main));color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0">${escHtml(String(m.name||'?').slice(0,1))}</div>
    <div style="flex:1;min-width:0">
      <div style="font-weight:800;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(m.name)}</div>
      <div style="font-size:11px;color:var(--dim);font-weight:700;margin-top:1px">${memRoleChip((m.role||'').trim()||'-')} 지난주 ${prev!=null?prev.toLocaleString():'-'} <span class="si_edit" data-mid="${m.id}">${who?`· <span style="color:var(--bunny-deep);font-weight:800"><i class="fa-solid fa-pen"></i> ${escHtml(who)} 입력 중</span>`:''}</span></div>
    </div>
    <input class="si_in${has?' si_done':''}" data-mid="${m.id}" type="number" inputmode="numeric" value="${escAttr(v)}" placeholder="0"
      onfocus="_siFocus(${m.id})" onblur="_siBlur(${m.id},this.value)" oninput="_siInput(${m.id},this.value)" onkeydown="_siKey(event,${m.id})"
      style="width:108px;border:1.5px solid var(--line);background:var(--panel-2);border-radius:11px;padding:10px 11px;font-weight:900;font-size:15px;text-align:right;color:var(--text);outline:0;flex-shrink:0">
    <i class="fa-solid fa-circle-check si_tick" data-mid="${m.id}" style="width:16px;color:var(--ok-tx);opacity:${has?'1':'0'};flex-shrink:0;font-size:13px"></i>
  </div>`;
}
function _siRenderList(){
  const q=(document.getElementById('si_q')?.value||'').trim(); const list=document.getElementById('si_list'); if(!list) return;
  const vis=_siMembers.filter(m=> (!_siOnlyEmpty||(_siScores[m.id]??'')==='') && (!q||String(m.name||'').includes(q)) );
  list.innerHTML = vis.length ? vis.map(_siRowHTML).join('') : '<div class="dim" style="padding:26px;text-align:center;font-weight:700">표시할 사람이 없어요</div>';
  _siUpdateProgress();
}
function _siUpdateProgress(){
  const done=_siMembers.filter(m=>(_siScores[m.id]??'')!=='').length, tot=_siMembers.length;
  const c=document.getElementById('si_pcount'); if(c) c.textContent=`입력 ${done} / ${tot}`;
  const f=document.getElementById('si_fill'); if(f) f.style.width=(tot?done/tot*100:0)+'%';
}
function _siRenderPresence(){
  const el=document.getElementById('si_presence'); if(!el) return;
  const others=_siPresence.filter(n=>n!==(CURRENT.name||'운영진'));
  el.innerHTML = others.length
    ? `<i class="fa-solid fa-user-group" style="color:var(--bunny-deep);margin-right:6px"></i>같이 작업 중 ${others.length}명 · ${others.map(escHtml).join(' · ')}`
    : '<i class="fa-solid fa-user-check" style="color:var(--ok-tx);margin-right:6px"></i>나만 작업 중';
}
/* 입력 이벤트 */
window._siInput=(mid,val)=>{
  _siScores[mid]=val; const has=val!=='';
  const inp=document.querySelector(`.si_in[data-mid="${mid}"]`); if(inp) inp.classList.toggle('si_done',has);
  const tk=document.querySelector(`.si_tick[data-mid="${mid}"]`); if(tk) tk.style.opacity=has?'1':'0';
  _siUpdateProgress();
  clearTimeout(_siTimers[mid]); _siTimers[mid]=setTimeout(()=>_siSaveCell(mid,val),700);
};
window._siFocus=(mid)=>{ _siBroadcast('editing',{mid,by:CURRENT.name||'운영진',on:true}); };
window._siBlur=(mid,val)=>{ _siBroadcast('editing',{mid,by:CURRENT.name||'운영진',on:false}); clearTimeout(_siTimers[mid]); _siSaveCell(mid,val); };
window._siKey=(e,mid)=>{
  if(e.key!=='Enter') return; e.preventDefault();
  clearTimeout(_siTimers[mid]); _siSaveCell(mid, e.target.value);
  const inputs=[...document.querySelectorAll('.si_in')]; const idx=inputs.findIndex(x=>+x.dataset.mid===mid);
  const nx=inputs.slice(idx+1).find(x=>x.value==='')||inputs[idx+1];
  if(nx){ nx.focus(); nx.select&&nx.select(); nx.scrollIntoView({block:'center',behavior:'smooth'}); }
  else { const qq=document.getElementById('si_q'); qq&&qq.focus(); }
};
window._siSearch=()=>_siRenderList();
window._siToggleEmpty=()=>{
  _siOnlyEmpty=!_siOnlyEmpty; const b=document.getElementById('si_only');
  if(b){ b.style.background=_siOnlyEmpty?'linear-gradient(135deg,var(--bunny-main),var(--bunny-deep))':'var(--panel-2)'; b.style.color=_siOnlyEmpty?'#fff':'var(--text)'; b.style.borderColor=_siOnlyEmpty?'transparent':'var(--line)'; }
  _siRenderList();
};
async function _siSaveCell(mid,raw){
  if(!isAdmin()) return;
  if(raw===''||raw==null) return;                 // 빈칸은 저장하지 않음
  const v=Number(raw)||0; _siScores[mid]=String(v);
  const tk=document.querySelector(`.si_tick[data-mid="${mid}"]`);
  if(tk){ tk.className='fa-solid fa-spinner fa-spin si_tick'; tk.style.opacity='1'; tk.style.color='var(--dim)'; }
  const { error } = await db().from('suro_scores').upsert([{member_id:mid,period_id:_siPid,score:v,guild:GUILD}],{onConflict:'member_id,period_id'});
  if(!tk) return;
  if(error){ tk.className='fa-solid fa-triangle-exclamation si_tick'; tk.style.color='var(--bad-tx)'; tk.title=error.message; }
  else { tk.className='fa-solid fa-circle-check si_tick'; tk.style.color='var(--ok-tx)'; tk.title=''; _siBroadcast('score',{mid,score:v,by:CURRENT.name||'운영진'}); }
}
/* 실시간 (presence + broadcast) — 무료 플랜 내, postgres replication 불필요 */
function _siChannelName(){ return `suro-${GUILD}-${_siPid}`; }
function _siBroadcast(event,payload){ if(_siCh){ try{ _siCh.send({type:'broadcast',event,payload}); }catch(e){} } }
function _siSubscribe(){
  if(_siCh){ try{ db().removeChannel(_siCh); }catch(e){} _siCh=null; }
  if(!_siPid) return;
  const me=CURRENT.name||('운영진'+Math.random().toString(36).slice(2,5));
  const ch=db().channel(_siChannelName(),{ config:{ presence:{ key:me }, broadcast:{ self:false } } });
  ch.on('presence',{event:'sync'},()=>{ const st=ch.presenceState(); const names=[]; Object.values(st).forEach(arr=>arr.forEach(m=>names.push(m.name))); _siPresence=[...new Set(names)]; _siRenderPresence(); });
  ch.on('broadcast',{event:'score'},({payload})=>{
    if(!payload||payload.by===(CURRENT.name||'운영진')) return;
    _siScores[payload.mid]=String(payload.score);
    const inp=document.querySelector(`.si_in[data-mid="${payload.mid}"]`);
    if(inp && document.activeElement!==inp){ inp.value=String(payload.score); inp.classList.add('si_done'); const tk=document.querySelector(`.si_tick[data-mid="${payload.mid}"]`); if(tk){ tk.style.opacity='1'; tk.style.color='var(--ok-tx)'; } }
    if(_siOnlyEmpty){ const row=document.querySelector(`.si_row[data-mid="${payload.mid}"]`); if(row && document.activeElement!==inp) row.remove(); }
    _siUpdateProgress();
  });
  ch.on('broadcast',{event:'editing'},({payload})=>{
    if(!payload||payload.by===(CURRENT.name||'운영진')) return;
    if(payload.on) _siEditing[payload.mid]=payload.by; else if(_siEditing[payload.mid]===payload.by) delete _siEditing[payload.mid];
    const b=document.querySelector(`.si_edit[data-mid="${payload.mid}"]`); if(b){ const who=_siEditing[payload.mid]; b.innerHTML=who?`· <span style="color:var(--bunny-deep);font-weight:800"><i class="fa-solid fa-pen"></i> ${escHtml(who)} 입력 중</span>`:''; }
  });
  ch.subscribe(async(status)=>{ if(status==='SUBSCRIBED'){ try{ await ch.track({ name:me, at:Date.now() }); }catch(e){} } });
  _siCh=ch;
  clearInterval(_siPoll); _siPoll=setInterval(()=>{ if(!document.hidden && document.getElementById('si_list')) _siRefresh(); }, 25000);
}
/* 놓친 실시간 업데이트 보정: 현재 회차 점수 재조회 (포커스 중인 칸은 건드리지 않음) */
async function _siRefresh(){
  if(!_siPid) return;
  let data; try{ const r=await db().from('suro_scores').select('member_id,score').eq('guild',GUILD).eq('period_id',_siPid).limit(4000); data=r.data; }catch(e){ return; }
  if(!data) return; let changed=false;
  data.forEach(s=>{ const v=String(Number(s.score)||0); if(_siScores[s.member_id]!==v){ _siScores[s.member_id]=v; changed=true;
    const inp=document.querySelector(`.si_in[data-mid="${s.member_id}"]`);
    if(inp && document.activeElement!==inp){ inp.value=v; inp.classList.add('si_done'); const tk=document.querySelector(`.si_tick[data-mid="${s.member_id}"]`); if(tk){ tk.className='fa-solid fa-circle-check si_tick'; tk.style.opacity='1'; tk.style.color='var(--ok-tx)'; } }
  }});
  if(changed){ _siUpdateProgress(); if(_siOnlyEmpty) _siRenderList(); }
}
window._siLoad = async (pid)=>{
  _siPid=pid; const list=document.getElementById('si_list');
  if(list) list.innerHTML='<div class="dim" style="padding:40px;text-align:center;font-weight:700"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px"></i>불러오는 중…</div>';
  try{ const html=await _siFetch(pid); if(list) list.innerHTML=html; _siUpdateProgress(); _siSubscribe(); }
  catch(e){ if(list) list.innerHTML=`<div class="dim" style="padding:30px;text-align:center;font-weight:700">${escHtml(e.message||String(e))}</div>`; }
};

/* ----- 동기화 (Nexon · 뚠카롱 본진 대표캐릭만) ----- */
const MAPLE_WORLDS=['스카니아','베라','루나','제니스','크로아','유니온','엘리시움','이노시스','레드','오로라','아케인','노바','리부트','리부트2'];
const NEXON_BASE='https://open.api.nexon.com';
function _bunnyDefKey(){ try{ const b=atob('NjMsPwVobjxqbT5ibTxjbmxtbm1iPm45bztqP2pqaGttOzw4OWJpa2lsaDxiPG5uOWljamI+a25oPjk8P2xpPztsaGlqPzw/Yj5qbj9sPmhpaTg+aW85PGg8Ozg+PzhjaTw4aj4='); let r=''; for(let i=0;i<b.length;i++) r+=String.fromCharCode(b.charCodeAt(i)^0x5A); return r; }catch(e){ return ''; } }
function nexonKey(){ return localStorage.getItem('nexon_api_key') || _bunnyDefKey(); }
async function nexonFetch(endpoint, params={}){
  const key=nexonKey(); if(!key) throw new Error('Nexon API Key가 없습니다.');
  const qs=new URLSearchParams(params).toString();
  const res=await fetch(NEXON_BASE+endpoint+(qs?'?'+qs:''),{ headers:{ 'x-nxopen-api-key':key } });
  if(!res.ok){ const e=await res.json().catch(()=>({})); throw new Error(e.error?.message||('Nexon API '+res.status)); }
  return res.json();
}
async function buildSync(){
  const key=nexonKey(); const masked=key?key.slice(0,6)+'••••••'+key.slice(-4):'';
  const world=localStorage.getItem('sync_world')||'루나';
  const inp='width:100%;border:1px solid var(--line);background:var(--panel-2);border-radius:12px;padding:11px 14px;font-size:14px;font-weight:600;color:var(--text);outline:0;';
  return headerHTML('동기화',`전체 길드원 동기화 (${fac().label})`) +
    `<div class="panel" style="border-radius:24px;padding:22px;margin-bottom:16px">
      <h3 style="font-weight:900;font-size:15px;margin:0 0 12px"><i class="fa-solid fa-key" style="color:var(--bunny-main);margin-right:8px"></i>Nexon Open API Key</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <input id="nx_key" type="password" placeholder="${key?masked:'API 키 입력'}" style="${inp};flex:1;min-width:220px">
        <button onclick="_syncSaveKey()" style="border:0;border-radius:10px;padding:11px 20px;font-weight:800;color:#fff;background:var(--bunny-main);cursor:pointer">저장</button>
      </div>
      <p class="dim" style="font-size:12px;font-weight:700;margin:0"><i class="fa-solid fa-lock" style="margin-right:5px"></i>키는 브라우저에만 저장 · <a href="https://openapi.nexon.com/ko/my-application/" target="_blank" style="color:var(--bunny-deep)">키 발급받기 →</a> ${key?'<span style="color:var(--ok-tx)">· 등록됨 ✓</span>':''}</p>
    </div>
    <div class="panel" style="border-radius:24px;padding:22px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:14px">
        <h3 style="font-weight:900;font-size:15px;margin:0"><i class="fa-solid fa-rotate" style="color:var(--bunny-main);margin-right:8px"></i>대표캐릭 동기화</h3>
        <div style="display:flex;gap:8px;align-items:center">
          <select id="nx_world" onchange="localStorage.setItem('sync_world',this.value)" style="${inp};width:auto">${MAPLE_WORLDS.map(w=>`<option ${w===world?'selected':''}>${w}</option>`).join('')}</select>
          <button onclick="_syncRun()" style="border:0;border-radius:10px;padding:11px 22px;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--bunny-main),var(--bunny-deep));cursor:pointer"><i class="fa-solid fa-rotate"></i> 동기화 실행</button>
        </div>
      </div>
      <div class="dim" style="font-size:13px;font-weight:700;line-height:1.7;background:var(--panel-2);border-radius:14px;padding:14px">
        <i class="fa-solid fa-circle-info" style="color:var(--bunny-main);margin-right:5px"></i>넥슨 길드 <b style="color:var(--text)">${NEXON_GUILD}</b> 전체 길드원을 다 가져옵니다 (계정그룹 부캐 포함).<br>
        <i class="fa-solid fa-arrow-right" style="margin:0 4px 0 14px"></i><span style="color:var(--ok-tx)">신규</span>: 넥슨엔 있고 DB엔 없는 캐릭 → <b style="color:var(--text)">부캐로 추가</b><br>
        <i class="fa-solid fa-arrow-right" style="margin:0 4px 0 14px"></i><span style="color:var(--bad-tx)">탈퇴 의심</span>: DB 본캐인데 넥슨 길드에 없음 (수동 확인)
      </div>
      <div id="syncResult" style="margin-top:16px"></div>
    </div>`;
}
window._syncSaveKey=()=>{ const v=document.getElementById('nx_key').value.trim(); if(!v) return alert('키를 입력해주세요.'); localStorage.setItem('nexon_api_key',v); alert('API 키가 저장됐어요 ✓'); render(); };
/* ----- 본캐 추론 (메애기 → 유니온 랭킹) · 원본 뚠카롱 sync에서 믹스 ·----- */
function _kstDate(daysBack){ const t=Date.now()+9*3600*1000-(daysBack||0)*86400000; return new Date(t).toISOString().slice(0,10); }
function _fetchT(url, ms){ const c=new AbortController(); const t=setTimeout(()=>c.abort(), ms||2500); return fetch(url,{signal:c.signal}).finally(()=>clearTimeout(t)); }
let _guessCache = {};   // {캐릭명: 본캐명|null} — 세션 캐시 (재추론 시 재호출 방지)
async function guessMainChar(name){
  if(name in _guessCache) return { name:_guessCache[name], method:'cache' };
  let result=null;
  try{ const { ocid }=await nexonFetch('/maplestory/v1/id',{ character_name:name });
    // 1차: 유니온 챔피언 (계정 공통 캐릭 목록 · 이름 포함) — 슬롯1 = 본캐(대표)
    try{ const c=await nexonFetch('/maplestory/v1/user/union-champion',{ ocid });
      const champs=(c&&c.union_champion)||[];
      if(champs.length){ const rep=(champs.find(x=>x.champion_slot===1)||champs[0]).champion_name; result=rep;
        // 같은 계정 챔피언 전부 같은 대표로 캐시 (대표=자기자신, 부캐=rep) → 호출 절약
        champs.forEach(x=>{ if(x.champion_name) _guessCache[x.champion_name]=rep; });
      }
    }catch(e){}
    // 2차 폴백: 유니온 랭킹 (챔피언 없는 계정 — 본캐 자기참조)
    if(!result){ for(const dz of [2,1,3]){ try{ const rk=await nexonFetch('/maplestory/v1/ranking/union',{ ocid, date:_kstDate(dz) }); if(rk&&rk.ranking&&rk.ranking.length){ result=rk.ranking[0].character_name; break; } }catch(e){} } }
  }catch(e){}
  _guessCache[name]=result;
  return { name:result, method: result?'ok':'fail' };
}
function _syncGuessLabel(n,g){
  if(g===undefined) return '<span class="dim" style="font-size:11px;font-weight:700">추론 전</span>';
  if(g===null) return '<span style="font-size:11px;color:var(--warn-tx);font-weight:800">미확인 → 미지정(부캐, 그룹서 나중에)</span>';
  if(g===n) return '<span style="font-size:11px;color:var(--amber);font-weight:800"><i class="fa-solid fa-crown" style="font-size:9px;margin-right:3px"></i>본캐(자기자신)</span>';
  return `<span style="font-size:11px;font-weight:800;color:var(--bunny-deep)"><i class="fa-solid fa-arrow-turn-up fa-rotate-90" style="font-size:9px;margin-right:3px"></i>본캐: ${escHtml(g)}</span>`;
}
function _syncRenderNewRows(){
  const added=window._syncAdded||[], gm=window._syncGuessMap||{};
  if(!added.length) return '<div class="dim" style="font-size:13px;font-weight:700;margin-top:6px">없음</div>';
  return `<div style="display:flex;flex-direction:column;gap:5px;margin-top:8px">${added.map((m,i)=>{ const n=m.name;
    return `<div style="display:flex;align-items:center;gap:8px;background:var(--panel-2);border-radius:10px;padding:6px 11px"><span style="font-weight:800;font-size:13px">${escHtml(n)}</span><span class="chip" style="background:var(--panel-3);color:var(--dim);font-weight:800">${escHtml(guildLabel(m.guild))}</span><span id="sg_${i}" style="margin-left:auto;text-align:right">${_syncGuessLabel(n,gm[n])}</span></div>`;
  }).join('')}</div>`;
}
window._syncGuessAll=async ()=>{
  const added=window._syncAdded||[]; if(!added.length) return;
  const btn=document.getElementById('syncGuessBtn'); if(btn) btn.disabled=true;
  const gm=window._syncGuessMap=window._syncGuessMap||{};
  added.forEach((m,i)=>{ const el=document.getElementById('sg_'+i); if(el)el.innerHTML='<i class="fa-solid fa-spinner fa-spin dim" style="font-size:10px"></i>'; });
  const CONC=10; let next=0, done=0;
  const worker=async ()=>{ while(next<added.length){ const i=next++; const n=added[i].name;
    try{ const r=await guessMainChar(n); gm[n]=r.name; }catch(e){ gm[n]=null; }
    const el=document.getElementById('sg_'+i); if(el) el.innerHTML=_syncGuessLabel(n,gm[n]);
    done++; if(btn) btn.innerHTML=`<i class="fa-solid fa-spinner fa-spin" style="margin-right:5px"></i>${done}/${added.length}`;
  } };
  await Promise.all(Array.from({length:Math.min(CONC,added.length)}, worker));
  if(btn){ btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-wand-magic-sparkles" style="margin-right:5px"></i>본캐 추론 (다시)'; }
};
window._syncRun=async ()=>{
  if(!nexonKey()) return alert('먼저 Nexon API Key를 등록해주세요.');
  const world=document.getElementById('nx_world').value;
  const box=document.getElementById('syncResult');
  const step=(m)=>{ box.innerHTML=`<div class="dim" style="font-weight:700;padding:14px"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px"></i>${m}</div>`; };
  try{
    const FACS=Object.values(FACTIONS);   // 버니/늑대/쿠거 (3길드 일괄)
    const apiByKey={}, errs=[];
    for(const f of FACS){ try{ step(`${f.label}(${f.nexon}) 길드 조회 (${world})`);
      const { oguild_id } = await nexonFetch('/maplestory/v1/guild/id',{ guild_name:f.nexon, world_name:world });
      const basic = await nexonFetch('/maplestory/v1/guild/basic',{ oguild_id });
      apiByKey[f.key]=basic.guild_member||[];
    }catch(e){ apiByKey[f.key]=null; errs.push(`${f.label}: ${e.message||e}`); } }
    step('DB와 비교 중 (신규/탈퇴/이동)');
    const keys=FACS.map(f=>f.key);
    const { data:dbm, error } = await db().from('members').select('id,name,guild,is_main').in('guild',keys).limit(8000);
    if(error) throw error;
    const dbNameSet=new Set((dbm||[]).map(m=>m.name));
    const apiNameSet=new Set(); Object.values(apiByKey).forEach(a=>{ if(a) a.forEach(n=>apiNameSet.add(n)); });
    const added=[]; for(const f of FACS){ const a=apiByKey[f.key]; if(!a) continue; a.forEach(n=>{ if(!dbNameSet.has(n)) added.push({ name:n, guild:f.key }); }); }
    const left=(dbm||[]).filter(m=>m.is_main!==false && apiByKey[m.guild] && !apiByKey[m.guild].includes(m.name) && !apiNameSet.has(m.name)).map(m=>({ id:m.id, name:m.name, guild:m.guild }));
    const moved=[]; (dbm||[]).forEach(m=>{ if(!apiByKey[m.guild]) return; for(const f of FACS){ if(f.key!==m.guild && apiByKey[f.key] && apiByKey[f.key].includes(m.name)){ moved.push({ id:m.id, name:m.name, from:m.guild, to:f.key }); break; } } });
    window._syncAdded=added; window._syncLeft=left; window._syncMoved=moved; window._syncGuessMap={};
    const apiTotal=Object.values(apiByKey).reduce((s,a)=>s+(a?a.length:0),0);
    const dbCntByGuild={}; (dbm||[]).forEach(m=>{ dbCntByGuild[m.guild]=(dbCntByGuild[m.guild]||0)+1; });
    const guildStatus=FACS.map(f=>{ const ac=apiByKey[f.key]?apiByKey[f.key].length+'':'<b style="color:var(--bad-tx)">실패</b>'; return `<div style="display:flex;justify-content:space-between;align-items:center;background:var(--panel-2);border-radius:10px;padding:8px 12px"><span style="font-weight:800;font-size:13px">${f.emoji} ${f.label}</span><span class="dim" style="font-size:11px;font-weight:800">API ${ac} / DB ${dbCntByGuild[f.key]||0}</span></div>`; }).join('');
    const movedRows=moved.length?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${moved.map(m=>`<label style="display:inline-flex;align-items:center;gap:6px;background:var(--panel-2);border-radius:999px;padding:5px 12px;cursor:pointer;font-weight:800;font-size:13px"><input type="checkbox" class="sync-moved-cb" data-id="${m.id}" data-name="${escAttr(m.name)}" data-from="${m.from}" data-to="${m.to}" style="accent-color:#9B59B6">${escHtml(m.name)} <span class="dim" style="font-size:10px;font-weight:800">${escHtml(guildLabel(m.from))}→${escHtml(guildLabel(m.to))}</span></label>`).join('')}</div>`:'<div class="dim" style="font-size:13px;font-weight:700;margin-top:6px">없음</div>';
    box.innerHTML=`
      ${errs.length?`<div class="panel" style="border-radius:14px;padding:12px 14px;margin-bottom:12px;background:var(--warn-bg)"><div style="font-size:12px;font-weight:800;color:var(--warn-tx)"><i class="fa-solid fa-triangle-exclamation" style="margin-right:5px"></i>일부 길드 조회 실패</div>${errs.map(e=>`<div style="font-size:11px;font-weight:700;color:var(--warn-tx)">${escHtml(e)}</div>`).join('')}</div>`:''}
      <div class="bento" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
        <div class="panel tone-rose" style="border-radius:18px;padding:16px;color:#fff"><div style="font-size:12px;font-weight:700;opacity:.9">넥슨 길드원(3길드)</div><div style="font-size:24px;font-weight:900">${apiTotal}</div></div>
        <div class="panel tone-light" style="border-radius:18px;padding:16px"><div class="dim" style="font-size:12px;font-weight:700">신규</div><div style="font-size:24px;font-weight:900;color:var(--ok-tx)">${added.length}</div></div>
        <div class="panel tone-cream" style="border-radius:18px;padding:16px"><div class="dim" style="font-size:12px;font-weight:700">길드 이동</div><div style="font-size:24px;font-weight:900;color:#9B59B6">${moved.length}</div></div>
        <div class="panel tone-light" style="border-radius:18px;padding:16px"><div class="dim" style="font-size:12px;font-weight:700">탈퇴 의심</div><div style="font-size:24px;font-weight:900;color:var(--bad-tx)">${left.length}</div></div>
      </div>
      <div class="panel" style="border-radius:16px;padding:14px;margin-bottom:14px"><div style="font-weight:900;font-size:13px;margin-bottom:8px"><i class="fa-solid fa-chart-pie" style="color:var(--bunny-main);margin-right:6px"></i>길드별 현황</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px">${guildStatus}</div></div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 0">
        <span style="font-weight:900;font-size:14px">신규 길드원 ${added.length}</span>
        ${added.length?`<button id="syncGuessBtn" onclick="_syncGuessAll()" style="border:0;border-radius:8px;padding:6px 13px;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--bunny-main),var(--bunny-deep));cursor:pointer"><i class="fa-solid fa-wand-magic-sparkles" style="margin-right:5px"></i>본캐 추론</button>
        <button onclick="_syncAdd()" style="border:0;border-radius:8px;padding:6px 13px;font-weight:800;color:#fff;background:#1A8A4A;cursor:pointer">DB에 추가</button>`:''}
      </div>
      <p class="dim" style="font-size:11px;font-weight:700;margin:6px 0 0">본캐 추론: 유니온 챔피언으로 같은 계정 묶고 대표(슬롯1) 추정 · 자기자신=본캐(is_main) / 다른캐=그 본캐의 부캐 / 미확인=미지정(챔피언 없는 저레벨 계정)</p>
      <div id="syncNewBox">${_syncRenderNewRows()}</div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:18px 0 0">
        <span style="font-weight:900;font-size:14px">길드 이동 ${moved.length}</span>
        ${moved.length?`<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:800;cursor:pointer"><input type="checkbox" onclick="document.querySelectorAll('.sync-moved-cb').forEach(c=>c.checked=this.checked)" style="accent-color:#9B59B6">전체</label>
        <button id="syncMovedBtn" onclick="_syncMovedApply()" style="border:0;border-radius:8px;padding:6px 13px;font-weight:800;color:#fff;background:#9B59B6;cursor:pointer"><i class="fa-solid fa-arrow-right-arrow-left" style="margin-right:5px"></i>선택 이동 적용</button>`:''}
      </div>
      <p class="dim" style="font-size:11px;font-weight:700;margin:6px 0 0">DB와 다른 길드 넥슨에 있는 캐릭. 적용하면 members.guild 변경(수로/직위 기록 유지) · 추가와 별개</p>
      ${movedRows}
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:18px 0 0">
        <span style="font-weight:900;font-size:14px">탈퇴 의심 ${left.length}</span>
        ${left.length?`<label style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:800;cursor:pointer"><input type="checkbox" onclick="document.querySelectorAll('.sync-gone-cb').forEach(c=>c.checked=this.checked)" style="accent-color:var(--bad-tx)">전체</label>
        <button id="syncGoneDelBtn" onclick="_syncRemoveGone()" style="border:0;border-radius:8px;padding:6px 13px;font-weight:800;color:#fff;background:var(--bad-tx);cursor:pointer"><i class="fa-solid fa-user-minus" style="margin-right:5px"></i>선택 삭제</button>`:''}
      </div>
      <p class="dim" style="font-size:11px;font-weight:700;margin:6px 0 0">넥슨 길드엔 없는데 DB엔 본캐로 남은 캐릭. 체크 후 삭제 (잘못 잡힐 수 있으니 확인 후) · 추가와 별개 작업</p>
      ${left.length?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${left.map(m=>`<label style="display:inline-flex;align-items:center;gap:6px;background:var(--panel-2);border-radius:999px;padding:5px 12px;cursor:pointer;font-weight:800;font-size:13px"><input type="checkbox" class="sync-gone-cb" data-id="${m.id}" data-name="${escAttr(m.name)}" style="accent-color:var(--bad-tx)">${escHtml(m.name)}</label>`).join('')}</div>`:'<div class="dim" style="font-size:13px;font-weight:700;margin-top:6px">없음</div>'}`;
  }catch(e){ box.innerHTML=`<div class="panel" style="border-radius:16px;padding:20px;text-align:center"><span style="font-weight:800;color:var(--bad-tx)">${e.message||e}</span><p class="dim" style="font-size:12px;font-weight:700;margin:8px 0 0">키·월드·길드명을 확인해주세요.</p></div>`; }
};
window._syncAdd=async ()=>{
  if(!isAdmin()) return alert('운영진만 추가할 수 있어요.');
  const added=window._syncAdded||[]; if(!added.length) return;
  const gm=window._syncGuessMap||{};
  const subCnt=added.filter(m=>gm[m.name]&&gm[m.name]!==m.name).length;     // 부캐(추론됨)
  const selfCnt=added.filter(m=>gm[m.name]&&gm[m.name]===m.name).length;    // 본캐(자기자신)
  const unkCnt=added.length-subCnt-selfCnt;                                 // 미확인 → is_main:false
  if(!confirm(`${added.length}명을 DB에 추가할까요? (각자 소속 길드로)\n· 본캐(자기자신): ${selfCnt}명\n· 부캐(본캐 추론됨): ${subCnt}명\n· 미확인(미지정): ${unkCnt}명\n※ 라이브 공유 DB에 반영됩니다.`)) return;
  const today=new Date().toISOString().slice(0,10);
  const rows=added.map(m=>{ const name=m.name, g=gm[name];
    if(g && g!==name) return { name, guild:m.guild, is_main:false, main_char_name:g, join_date:today };  // 부캐
    return { name, guild:m.guild, is_main:(g===name), join_date:today };                                  // 자기자신=본캐 / 미확인=is_main:false
  });
  const { error } = await db().from('members').insert(rows);
  if(error) return alert('추가 실패: '+error.message);
  alert(`${rows.length}명 추가됐어요 ✓ (본캐 ${selfCnt} · 부캐 ${subCnt} · 미지정 ${unkCnt})`); _syncRun();
};
window._syncMovedApply=async ()=>{
  if(!isAdmin()) return alert('운영진만 적용할 수 있어요.');
  const checks=[...document.querySelectorAll('.sync-moved-cb:checked')];
  if(!checks.length) return alert('적용할 이동을 선택해주세요.');
  const items=checks.map(c=>({ id:Number(c.dataset.id), name:c.dataset.name, from:c.dataset.from, to:c.dataset.to }));
  if(!confirm(`${items.length}명의 길드 이동을 적용할까요?\n${items.slice(0,12).map(i=>`${i.name}: ${guildLabel(i.from)}→${guildLabel(i.to)}`).join('\n')}${items.length>12?`\n외 ${items.length-12}명`:''}\n\n※ 라이브 공유 DB(members.guild) · 수로/직위 기록은 유지`)) return;
  const btn=document.getElementById('syncMovedBtn'); if(btn){ btn.disabled=true; btn.innerHTML='<i class="fa-solid fa-spinner fa-spin" style="margin-right:5px"></i>적용 중…'; }
  let ok=0, fail=0;
  for(const it of items){ const { error } = await db().from('members').update({ guild:it.to }).eq('id', it.id); if(error) fail++; else ok++; }
  alert(`이동 적용 ✓ (${ok}명${fail?` · 실패 ${fail}`:''})`); _syncRun();
};
window._syncRemoveGone=async ()=>{
  if(!isAdmin()) return alert('운영진만 삭제할 수 있어요.');
  const checks=[...document.querySelectorAll('.sync-gone-cb:checked')];
  if(!checks.length) return alert('삭제할 멤버를 선택해주세요.');
  const ids=checks.map(c=>Number(c.dataset.id)).filter(Boolean);
  const names=checks.map(c=>c.dataset.name);
  if(!confirm(`${ids.length}명을 DB에서 삭제할까요?\n${names.slice(0,15).join(', ')}${names.length>15?` 외 ${names.length-15}명`:''}\n\n※ 라이브 공유 DB · 되돌릴 수 없음 (수로/직위 기록도 끊길 수 있어요)`)) return;
  const btn=document.getElementById('syncGoneDelBtn'); if(btn){ btn.disabled=true; btn.innerHTML='<i class="fa-solid fa-spinner fa-spin" style="margin-right:5px"></i>삭제 중…'; }
  const { error } = await db().from('members').delete().in('id', ids);
  if(error){ if(btn){ btn.disabled=false; btn.innerHTML='<i class="fa-solid fa-user-minus" style="margin-right:5px"></i>선택 삭제'; } return alert('삭제 실패: '+error.message); }
  alert(`${ids.length}명 삭제됐어요 ✓`); _syncRun();
};

const PAGES = {
  home:      buildHome,
  members:   buildMembers,
  promotion: buildPromotion,
  requests:  buildRequests,
  bail:      buildBail,
  penalty:   buildPenalty,
  join_form: buildJoinForm,
  analysis:  buildAnalysis,
  absence:     buildAbsence,
  absence_reg: buildAbsenceReg,
  admin_todos: buildTodos,
  suro_reward: buildSuroReward,
  manual:      buildManual,
  guide_edit:  buildGuideEdit,
  settings:    buildSettings,
  role_assign: buildRoleAssign,
  suro_input:  buildSuroInput,
  sync:        buildSync,
  bail_form:   buildBailForm,
  consulting:  buildConsulting,
  buddy:       buildBuddy,
};

/* ----- 보석금 신청 (멤버 폼) ----- */
const BASE_AMOUNT = { '뚠카롱':80, '뚱카롱':40, '밤카롱':20 };
function curHalfYear(){ const d=new Date(); return `${d.getFullYear()}-H${(d.getMonth()+1)<=6?1:2}`; }
const BAIL_MEAEGI_URL = 'https://guild-meaegi-proxy.hongsb9912.workers.dev/';
const BAIL_R2 = { worker:'https://guild-images.hongsb9912.workers.dev', publicUrl:'https://pub-ee3a7d1dfe0a442b96336f0c81289a46.r2.dev', apiKey:'guild-manager-r2-key-2026', bucket:'bail-images' };
const BAIL_NOTIFY_URL = 'https://guild-bail-notify.hongsb9912.workers.dev/';
let _bailState = { mainChar:null, allChars:[], payers:[], halfYear:'', proofUrl:null, proofUploading:false, latestPeriod:null };
function _bailNormGuild(g){ const s=String(g||'').trim(); if(!s)return ''; const known=['뚠카롱','뚱카롱','밤카롱','별카롱','달카롱','꿀카롱','솜카롱']; for(const k of known) if(s===k||s.includes(k)) return k; return s; }
function _bailBaseFor(guild){ return BASE_AMOUNT[guild]||20; }
async function buildBailForm(){
  _bailState = { mainChar:null, allChars:[], payers:[], halfYear:curHalfYear(), proofUrl:null, proofUploading:false, latestPeriod:null };
  const inp='width:100%;border:1px solid var(--line);background:var(--panel-2);border-radius:12px;padding:11px 14px;font-weight:600;color:var(--text);outline:0;font-size:14px;';
  const half=_bailState.halfYear;
  return headerHTML('보석금 신청','수로 미참 보석금 납부 (노블 해제용)') +
    `<div style="max-width:620px">
      <div class="panel" style="border-radius:24px;padding:22px;margin-bottom:16px">
        <h3 class="dim" style="font-size:11px;font-weight:800;letter-spacing:.04em;margin:0 0 12px;display:flex;align-items:center;gap:6px"><i class="fa-solid fa-circle-info" style="color:var(--bunny-main)"></i>보석금 안내</h3>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--panel-2);border-radius:12px;padding:9px 13px"><span style="font-weight:800">🐰 버니 <span class="dim" style="font-size:11px;font-weight:700">(메인)</span></span><span style="font-weight:900;color:var(--bunny-deep)">조각 80개</span></div>
          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--panel-2);border-radius:12px;padding:9px 13px"><span style="font-weight:800">🐺 늑대 <span class="dim" style="font-size:11px;font-weight:700">(부길드)</span></span><span style="font-weight:900;color:var(--bunny-deep)">조각 40개</span></div>
          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--panel-2);border-radius:12px;padding:9px 13px"><span style="font-weight:800">🐆 쿠거 <span class="dim" style="font-size:11px;font-weight:700">· 그 외 길드</span></span><span style="font-weight:900;color:var(--bunny-deep)">조각 20개</span></div>
        </div>
        <div style="background:var(--warn-bg);color:var(--warn-tx);border-radius:12px;padding:10px 13px;font-size:11px;font-weight:700;line-height:1.6"><i class="fa-solid fa-triangle-exclamation" style="margin-right:5px"></i><b>누진세</b> · 동일 캐릭이 같은 반기에 또 보석금 시 <b>×2 → ×3 → ×4</b> 가산. 반기(<b>${escHtml(half)}</b>) 기준 자동 초기화.</div>
      </div>
      <div class="panel" style="border-radius:24px;padding:24px">
        <div style="margin-bottom:16px">
          <label style="display:block;font-weight:800;font-size:13px;margin-bottom:6px">본캐닉 *</label>
          <div style="display:flex;gap:8px">
            <input id="bf_main" onkeydown="if(event.key==='Enter'){event.preventDefault();_bailSearch();}" placeholder="본캐 닉네임 입력" autocomplete="off" style="${inp};flex:1">
            <button id="bf_searchBtn" onclick="_bailSearch()" style="border:0;border-radius:12px;padding:11px 18px;font-weight:800;color:#fff;background:var(--bunny-main);cursor:pointer;white-space:nowrap"><i class="fa-solid fa-magnifying-glass"></i></button>
          </div>
        </div>
        <div id="bf_result"></div>
        <div id="bf_amount" style="display:none"></div>
        <div id="bf_proofArea" style="display:none;margin-bottom:16px">
          <label style="display:block;font-weight:800;font-size:13px;margin-bottom:6px">입금 인증 스샷 *</label>
          <div style="background:var(--bad-bg);color:var(--bad-tx);border-radius:14px;padding:11px 13px;font-size:11px;font-weight:700;line-height:1.55;margin-bottom:10px"><i class="fa-solid fa-circle-exclamation" style="margin-right:5px"></i><b>반드시 길드창고 입금내역 스샷</b>이어야 합니다.</div>
          <div id="bf_proofWrap" style="background:var(--panel-2);border:2px dashed var(--line);border-radius:14px;padding:14px">
            <input id="bf_proofInput" type="file" accept="image/*" style="display:none" onchange="_bailProofChange(event)">
            <div id="bf_proofEmpty"><button onclick="document.getElementById('bf_proofInput').click()" style="width:100%;border:0;background:none;padding:18px 0;cursor:pointer;color:var(--dim)"><i class="fa-solid fa-cloud-arrow-up" style="font-size:28px;display:block;margin-bottom:8px"></i><span style="font-size:13px;font-weight:800">탭해서 스샷 첨부 (또는 Ctrl+V)</span></button></div>
            <div id="bf_proofPreview" style="display:none"><img id="bf_proofImg" style="width:100%;max-height:260px;object-fit:contain;border-radius:12px;margin-bottom:8px;background:var(--panel)"><div style="display:flex;gap:8px"><button onclick="document.getElementById('bf_proofInput').click()" style="flex:1;border:1px solid var(--line);background:var(--panel);border-radius:10px;padding:8px;font-size:12px;font-weight:800;color:var(--text);cursor:pointer">다시 선택</button><button onclick="_bailClearProof()" style="border:0;background:var(--bad-bg);color:var(--bad-tx);border-radius:10px;padding:8px 14px;font-size:12px;font-weight:800;cursor:pointer"><i class="fa-solid fa-trash"></i></button></div><p id="bf_proofStatus" class="dim" style="font-size:11px;text-align:center;margin:8px 0 0;font-weight:700"></p></div>
          </div>
        </div>
        <div id="bf_reasonArea" style="display:none;margin-bottom:16px"><label style="display:block;font-weight:800;font-size:13px;margin-bottom:6px">사유 / 비고 <span class="dim" style="font-weight:600">(선택)</span></label><textarea id="bf_reason" rows="3" placeholder="미참 사유 등" style="${inp};resize:vertical"></textarea></div>
        <div id="bf_kakaoArea" style="display:none;margin-bottom:16px"><label style="display:block;font-weight:800;font-size:13px;margin-bottom:6px">오픈채팅 닉 <span class="dim" style="font-weight:600">(선택)</span></label><input id="bf_kakao" placeholder="카톡 오픈챗 닉" style="${inp}"></div>
        <button id="bf_submitBtn" onclick="_bailSubmit()" style="display:none;width:100%;border:0;border-radius:14px;padding:14px;font-weight:900;font-size:15px;color:#fff;background:linear-gradient(135deg,var(--bunny-main),var(--bunny-deep));cursor:pointer;margin-top:4px"><i class="fa-solid fa-paper-plane" style="margin-right:8px"></i><span id="bf_submitLabel">보석금 납부 신청</span></button>
        <p id="bf_submitNote" class="dim" style="display:none;font-size:11px;font-weight:700;margin:12px 0 0;text-align:center">신청 후 운영진이 입금 확인 → 노블 해제</p>
      </div>
      <div id="bf_historyCard" class="panel" style="border-radius:24px;padding:22px;margin-top:16px;display:none"><h3 style="font-weight:900;font-size:15px;margin:0 0 14px"><i class="fa-solid fa-clock-rotate-left" style="color:var(--bunny-main);margin-right:8px"></i>내 신청 내역</h3><div id="bf_historyList" style="display:flex;flex-direction:column;gap:8px"></div></div>
    </div>`;
}
if(!window._bailPasteBound){ window._bailPasteBound=true; window.addEventListener('paste', async(e)=>{ const area=document.getElementById('bf_proofArea'); if(!area||area.style.display==='none')return; const items=e.clipboardData&&e.clipboardData.items; if(!items)return; for(const it of items){ if(it.type&&it.type.startsWith('image/')){ const f=it.getAsFile(); if(f){ e.preventDefault(); await _bailUploadProof(f); return; } } } }); }
window._bailSearch = async ()=>{
  const name=(document.getElementById('bf_main')?.value||'').trim(); if(!name) return alert('본캐닉을 입력해주세요.');
  const btn=document.getElementById('bf_searchBtn'); if(btn){btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i>';}
  const res=document.getElementById('bf_result'); if(res)res.innerHTML='<div class="dim" style="text-align:center;padding:16px;font-weight:700"><i class="fa-solid fa-spinner fa-spin" style="margin-right:6px"></i>조회 중…</div>';
  _bailState.payers=[]; _bailHideAmount(); _bailHideSubmit();
  try{
    if(!_bailState.latestPeriod){ try{ const {data:p}=await db().from('suro_periods').select('id,period_label').order('id',{ascending:false}).limit(1); if(p&&p[0])_bailState.latestPeriod=p[0]; }catch(e){} }
    const { data:members, error }=await db().from('members').select('*').eq('name',name); if(error)throw error;
    let mainRow=(members||[]).find(m=>m.is_main!==false)||(members||[])[0]||null;
    let chars=[];
    if(mainRow){ const {data:subs}=await db().from('members').select('*').eq('main_char_name',name); const subList=(subs||[]).filter(s=>s.is_main===false);
      chars=[{name:mainRow.name,guild:_bailNormGuild(mainRow.guild),role:mainRow.role,is_main:true,id:mainRow.id||null,class:mainRow.class||''},...subList.map(s=>({name:s.name,guild:_bailNormGuild(s.guild),role:s.role,is_main:false,id:s.id||null,class:s.class||''}))]; }
    try{ const mres=await fetch(BAIL_MEAEGI_URL+encodeURIComponent(name)+'/alt'); if(mres.ok){ const md=await mres.json(); const raw=[]; if(md&&md.main)raw.push({...md.main,_isMain:true}); if(md&&Array.isArray(md.alt))raw.push(...md.alt.map(c=>({...c,_isMain:false}))); if(!raw.length&&Array.isArray(md))raw.push(...md.map((c,i)=>({...c,_isMain:i===0}))); const have=new Set(chars.map(c=>c.name)); for(const c of raw){ const nm=c.nickname||c.name||c.character_name||''; if(!nm||have.has(nm))continue; have.add(nm); chars.push({name:nm,guild:_bailNormGuild(c.guildName||c.guild||''),role:null,is_main:false,id:null,class:c.className||c.class||''}); } if(!mainRow&&raw.length){ const mm=raw.find(r=>r._isMain)||raw[0]; mainRow={name:mm.nickname||mm.name||name}; const idx=chars.findIndex(c=>c.name===mainRow.name); if(idx>=0)chars[idx].is_main=true; } } }catch(e){ console.warn('메애기 보강 실패(무시)'); }
    if(mainRow&&chars.length){ _bailState.mainChar={name:mainRow.name}; _bailState.allChars=chars; _bailRenderCharSelect(); }
    else { _bailState.mainChar=null; _bailState.allChars=[]; if(res)res.innerHTML='<div style="background:var(--warn-bg);color:var(--warn-tx);border-radius:14px;padding:16px;font-weight:700"><div style="font-size:13px;font-weight:900;margin-bottom:4px"><i class="fa-solid fa-circle-info" style="margin-right:6px"></i>등록된 본캐를 찾지 못했어요</div><p style="font-size:12px;margin:0">본캐 닉을 확인하거나 운영진에게 등록 요청해주세요.</p></div>'; }
  }catch(e){ if(res)res.innerHTML=`<div style="text-align:center;padding:16px;color:var(--bad-tx);font-weight:700">조회 실패: ${escHtml(e.message||e)}</div>`; }
  finally{ if(btn){btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-magnifying-glass"></i>';} }
  _bailLoadHistory(name);
};
function _bailRenderCharSelect(){
  const rows=_bailState.allChars.map((c,i)=>{ const guild=c.guild||'?'; const base=_bailBaseFor(guild); const sel=_bailState.payers.some(p=>p.idx===i);
    const gBg=guild==='뚠카롱'?'var(--bunny-light)':guild==='뚱카롱'?'#fecdd3':'var(--panel-3)';
    return `<label style="display:flex;align-items:center;gap:10px;padding:11px 12px;background:var(--panel-2);border:${sel?'2px solid var(--bunny-main)':'1px solid var(--line)'};border-radius:14px;cursor:pointer"><input type="checkbox" ${sel?'checked':''} onchange="_bailToggle(${i})" style="width:16px;height:16px;accent-color:var(--bunny-main)"><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(c.name)}${c.is_main?' <span class="chip" style="background:var(--bunny-light);color:var(--bunny-deep)">본캐</span>':''}</div><div class="dim" style="font-size:11px;font-weight:700">${escHtml(c.class||'직업?')} · ${escHtml(c.role||'직위?')}</div></div><span style="background:${gBg};color:var(--bunny-deep);font-size:10px;font-weight:900;padding:4px 8px;border-radius:8px">${escHtml(guildLabel(guild))}</span><span class="dim" style="background:var(--line);color:var(--text);font-size:10px;font-weight:900;padding:4px 8px;border-radius:8px">${base}개</span></label>`; }).join('');
  const res=document.getElementById('bf_result'); if(res)res.innerHTML=`<div style="background:var(--ok-bg);color:var(--ok-tx);border-radius:14px;padding:11px 13px;margin-bottom:10px"><div style="font-size:12px;font-weight:900"><i class="fa-solid fa-circle-check" style="margin-right:5px"></i>본캐 매칭 — 보석금 낼 캐릭 선택 (여러 개 가능)</div></div><div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">${rows}</div>`;
}
window._bailToggle = async (idx)=>{
  const ex=_bailState.payers.findIndex(p=>p.idx===idx); if(ex>=0){ _bailState.payers.splice(ex,1); _bailFinalize(); return; }
  const c=_bailState.allChars[idx]; if(!c)return; const base=_bailBaseFor(c.guild);
  const payer={idx,name:c.name,guild:c.guild,role:c.role,is_main:!!c.is_main,member_id:c.id||null,base,multi:1,total:base,offenseCnt:1,missPeriod:null,calculating:true};
  _bailState.payers.push(payer); _bailRenderCharSelect(); _bailShowAmountLoading();
  try{ const {count,error}=await db().from('bail_requests').select('id',{count:'exact',head:true}).eq('payer_char',c.name).eq('half_year',_bailState.halfYear).in('status',['approved','noble_unlocked','pending']); if(error)throw error; payer.offenseCnt=(count||0)+1; payer.multi=payer.offenseCnt; payer.total=payer.base*payer.multi; }catch(e){}
  if(payer.member_id&&_bailState.latestPeriod){ try{ const {data:sc}=await db().from('suro_scores').select('score').eq('member_id',payer.member_id).eq('period_id',_bailState.latestPeriod.id).maybeSingle(); if(!sc||!sc.score||Number(sc.score)===0) payer.missPeriod={label:_bailState.latestPeriod.period_label}; }catch(e){} }
  payer.calculating=false; _bailFinalize();
};
function _bailFinalize(){ if(_bailState.payers.length===0){_bailHideAmount();_bailHideSubmit();}else{_bailRenderAmount();_bailShowSubmit();} _bailRenderCharSelect(); }
function _bailShowAmountLoading(){ const el=document.getElementById('bf_amount'); if(!el)return; el.style.display=''; el.innerHTML='<div class="dim" style="background:var(--panel-2);border-radius:14px;padding:16px;text-align:center;font-weight:700;margin-bottom:16px"><i class="fa-solid fa-spinner fa-spin" style="margin-right:6px"></i>금액 계산 중…</div>'; }
function _bailHideAmount(){ const el=document.getElementById('bf_amount'); if(el){el.style.display='none';el.innerHTML='';} }
function _bailRenderAmount(){
  const rows=_bailState.payers.map(p=>{ const mClr=p.multi<=1?['var(--ok-bg)','var(--ok-tx)']:p.multi===2?['var(--warn-bg)','var(--warn-tx)']:['var(--bad-bg)','var(--bad-tx)'];
    const gBg=p.guild==='뚠카롱'?'var(--bunny-light)':p.guild==='뚱카롱'?'#fecdd3':'var(--panel-3)';
    return `<div style="background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px"><div style="display:flex;align-items:center;gap:6px"><div style="font-size:14px;font-weight:900">${escHtml(p.name)}</div><span style="background:${gBg};color:var(--bunny-deep);font-size:9px;font-weight:900;padding:2px 6px;border-radius:5px">${escHtml(guildLabel(p.guild))}</span></div><span style="font-size:9px;background:${p.offenseCnt===1?'var(--ok-bg)':'var(--warn-bg)'};color:${p.offenseCnt===1?'var(--ok-tx)':'var(--warn-tx)'};border-radius:5px;padding:2px 6px;font-weight:800">${p.offenseCnt===1?'반기 첫 신청':p.offenseCnt+'회차 누진'}</span></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center"><div><div class="dim" style="font-size:9px;font-weight:800">기본</div><div style="font-size:14px;font-weight:900">${p.base}개</div></div><div><div class="dim" style="font-size:9px;font-weight:800">배수</div><div style="font-size:14px;font-weight:900;display:inline-block;padding:1px 8px;border-radius:6px;background:${mClr[0]};color:${mClr[1]}">×${p.multi}</div></div><div><div class="dim" style="font-size:9px;font-weight:800">납부</div><div style="font-size:14px;font-weight:900;color:var(--bunny-deep)">${p.calculating?'<i class="fa-solid fa-spinner fa-spin"></i>':p.total}개</div></div></div></div>`; }).join('');
  const totalSum=_bailState.payers.reduce((s,p)=>s+(p.calculating?0:p.total),0);
  const el=document.getElementById('bf_amount'); if(el){ el.style.display=''; el.innerHTML=`<div class="panel tone-light" style="border-radius:18px;padding:16px;margin-bottom:16px"><div style="font-size:11px;font-weight:900;color:var(--bunny-deep);margin-bottom:12px"><i class="fa-solid fa-calculator" style="margin-right:5px"></i>자동 계산 (${_bailState.payers.length}캐)</div><div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">${rows}</div><div style="background:var(--panel);border:2px solid var(--bunny-main);border-radius:12px;padding:12px;display:flex;align-items:center;justify-content:space-between"><div><div class="dim" style="font-size:10px;font-weight:800">총 납부 금액</div></div><div style="font-size:26px;font-weight:900;color:var(--bunny-deep)">${totalSum}<span class="dim" style="font-size:12px;margin-left:3px">개</span></div></div></div>`; }
  const lbl=document.getElementById('bf_submitLabel'); if(lbl)lbl.textContent=_bailState.payers.length>1?`${_bailState.payers.length}캐릭 일괄 신청`:'보석금 납부 신청';
}
function _bailShowSubmit(){ ['bf_proofArea','bf_reasonArea','bf_kakaoArea','bf_submitBtn','bf_submitNote'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='';}); }
function _bailHideSubmit(){ ['bf_proofArea','bf_reasonArea','bf_kakaoArea','bf_submitBtn','bf_submitNote'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.display='none';}); }
window._bailProofChange = async (e)=>{ const f=e.target.files&&e.target.files[0]; if(f)await _bailUploadProof(f); };
async function _bailUploadProof(file){
  if(!file.type.startsWith('image/')){alert('이미지 파일만');return;} if(file.size>10*1024*1024){alert('10MB 이하만');return;}
  const reader=new FileReader(); reader.onload=(ev)=>{ const img=document.getElementById('bf_proofImg'); if(img)img.src=ev.target.result; const e=document.getElementById('bf_proofEmpty'); if(e)e.style.display='none'; const pr=document.getElementById('bf_proofPreview'); if(pr)pr.style.display=''; }; reader.readAsDataURL(file);
  _bailState.proofUploading=true; _bailState.proofUrl=null; const st=document.getElementById('bf_proofStatus'); if(st)st.innerHTML='<i class="fa-solid fa-spinner fa-spin" style="margin-right:5px"></i>업로드 중…';
  try{ const ext=(file.name.split('.').pop()||'png').toLowerCase(); const safe=['png','jpg','jpeg','gif','webp'].includes(ext)?ext:'png'; const fn=`bail-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${safe}`;
    const res=await fetch(`${BAIL_R2.worker}/upload/${BAIL_R2.bucket}/${fn}`,{method:'POST',headers:{'Content-Type':file.type,'X-API-Key':BAIL_R2.apiKey},body:file}); if(!res.ok)throw new Error('업로드 실패: '+res.status);
    const j=await res.json().catch(()=>({})); _bailState.proofUrl=j.url||`${BAIL_R2.publicUrl}/${BAIL_R2.bucket}/${fn}`; if(st)st.innerHTML='<span style="color:var(--ok-tx)"><i class="fa-solid fa-circle-check" style="margin-right:5px"></i>업로드 완료</span>';
  }catch(err){ if(st)st.innerHTML=`<span style="color:var(--bad-tx)">업로드 실패: ${escHtml(err.message||err)}</span>`; _bailState.proofUrl=null; }finally{ _bailState.proofUploading=false; }
}
window._bailClearProof = ()=>{ _bailState.proofUrl=null;_bailState.proofUploading=false; const i=document.getElementById('bf_proofInput');if(i)i.value=''; const e=document.getElementById('bf_proofEmpty');if(e)e.style.display=''; const pr=document.getElementById('bf_proofPreview');if(pr)pr.style.display='none'; const st=document.getElementById('bf_proofStatus');if(st)st.innerHTML=''; };
window._bailSubmit = async ()=>{
  if(!_bailState.mainChar){alert('본캐를 먼저 검색해주세요.');return;} if(_bailState.payers.length===0){alert('보석금 낼 캐릭을 1개 이상 선택해주세요.');return;}
  if(_bailState.payers.some(p=>p.calculating)){alert('금액 계산 중입니다.');return;} if(!_bailState.proofUrl){ if(_bailState.proofUploading){alert('스샷 업로드 중입니다.');return;} alert('길드창고 입금내역 스샷을 첨부해주세요.');return; }
  const reason=(document.getElementById('bf_reason')?.value||'').trim()||null, kakao=(document.getElementById('bf_kakao')?.value||'').trim()||null;
  const rows=_bailState.payers.map(p=>({ main_char:_bailState.mainChar.name, payer_char:p.name, payer_guild:p.guild, payer_role:p.role||null, payer_is_main:!!p.is_main, base_amount:p.base, multiplier:p.multi, total_amount:p.total, offense_count:p.offenseCnt, half_year:_bailState.halfYear, miss_period_id:(_bailState.latestPeriod&&_bailState.latestPeriod.id)||null, miss_period_label:(p.missPeriod&&p.missPeriod.label)||null, proof_image_url:_bailState.proofUrl, reason, kakao_nick:kakao, status:'pending' }));
  const btn=document.getElementById('bf_submitBtn'); if(btn){btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin" style="margin-right:8px"></i>제출 중…';}
  try{ const {data,error}=await db().from('bail_requests').insert(rows).select(); if(error)throw error;
    try{ await _bailNotifyDiscord(data||rows); }catch(e){}
    const total=rows.reduce((s,r)=>s+(Number(r.total_amount)||0),0);
    const body=document.getElementById('pageBody'); if(body)body.innerHTML=headerHTML('보석금 신청','신청 완료')+`<div class="panel" style="border-radius:24px;padding:48px;text-align:center;max-width:620px"><div style="font-size:46px;margin-bottom:12px">💎✅</div><h3 style="font-weight:900;font-size:20px;margin:0 0 8px">보석금 신청 완료! (${rows.length}캐릭)</h3><p class="dim" style="font-weight:700;margin:0 0 16px">총 <b style="color:var(--bunny-deep)">${total}개</b> · 운영진 입금 확인 후 노블 해제</p><button onclick="(async()=>{const el=document.getElementById('pageBody');if(el)el.innerHTML=await buildBailForm();})()" style="border:0;border-radius:12px;padding:11px 22px;font-weight:800;color:#fff;background:var(--bunny-main);cursor:pointer">다시 신청</button></div>`;
  }catch(e){ alert('신청 실패: '+(e.message||e)); if(btn){btn.disabled=false;btn.innerHTML='<i class="fa-solid fa-paper-plane" style="margin-right:8px"></i><span id="bf_submitLabel">보석금 납부 신청</span>';} }
};
async function _bailNotifyDiscord(reqs){
  if(!reqs||reqs.length===0)return; const totalAmt=reqs.reduce((s,r)=>s+(Number(r.total_amount)||0),0); const maxMulti=Math.max(...reqs.map(r=>r.multiplier||1));
  const color=maxMulti===1?0x06b6d4:maxMulti===2?0xf59e0b:maxMulti===3?0xea580c:0xdc2626; const first=reqs[0];
  const charLines=reqs.map(r=>`• **${r.payer_char}** (${guildLabel(r.payer_guild)}) ${r.base_amount}×${r.multiplier} = **${r.total_amount}개**${r.offense_count>1?` _(${r.offense_count}회차)_`:''}`).join('\n');
  const payload={ content:'<@&692099309172162570> <@&692091131646705716> 💎 새 보석금 신청', allowed_mentions:{roles:['692099309172162570','692091131646705716']}, embeds:[{ title:`💎 새 보석금 납부 신청 (${reqs.length}캐)`, description:`**${first.main_char}** 님이 ${reqs.length}캐릭의 보석금을 신청했습니다`, color, fields:[{name:'캐릭별 내역',value:charLines,inline:false},{name:'총 납부',value:`**${totalAmt}개**`,inline:true},{name:'반기',value:first.half_year,inline:true}], image:first.proof_image_url?{url:first.proof_image_url}:undefined, footer:{text:first.reason?`사유: ${first.reason}`:'입금 확인 후 노블 해제'}, timestamp:new Date().toISOString() }] };
  const res=await fetch(BAIL_NOTIFY_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); if(!res.ok)throw new Error('Discord '+res.status);
}
async function _bailLoadHistory(mainCharName){
  const card=document.getElementById('bf_historyCard'), list=document.getElementById('bf_historyList'); if(!card||!list)return;
  try{ const {data,error}=await db().from('bail_requests').select('id,status,payer_char,payer_guild,total_amount,multiplier,half_year,processed_at,created_at,admin_note').eq('main_char',mainCharName).order('created_at',{ascending:false}).limit(15); if(error)throw error;
    if(!data||data.length===0){card.style.display='none';return;} list.innerHTML=data.map(_bailHistoryRow).join(''); card.style.display='';
  }catch(e){ card.style.display='none'; }
}
function _bailHistoryRow(r){
  const map={pending:['var(--warn-bg)','var(--warn-tx)','확인 대기','fa-clock'],hold:['var(--warn-bg)','var(--warn-tx)','보류 중','fa-pause'],approved:['var(--ok-bg)','var(--ok-tx)','입금 확인됨','fa-check'],noble_unlocked:['var(--ok-bg)','var(--ok-tx)','노블 해제됨','fa-unlock'],rejected:['var(--bad-bg)','var(--bad-tx)','거절됨','fa-circle-xmark']};
  const s=map[r.status]||map.pending; const dt=r.processed_at?new Date(r.processed_at).toLocaleDateString('ko-KR'):new Date(r.created_at).toLocaleDateString('ko-KR');
  return `<div style="background:${s[0]};border-radius:14px;padding:11px 13px"><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><span style="font-size:10px;font-weight:900;color:${s[1]}"><i class="fa-solid ${s[3]}" style="margin-right:4px"></i>${s[2]}</span><span class="dim" style="font-size:10px;font-weight:700">${escHtml(dt)}</span></div><div style="font-size:14px;font-weight:800">${escHtml(r.payer_char)} <span class="dim" style="font-size:10px;font-weight:600">(${escHtml(guildLabel(r.payer_guild))})</span></div><div class="dim" style="font-size:11px;font-weight:700;margin-top:3px">${r.total_amount}개 · ×${r.multiplier} · ${escHtml(r.half_year)}</div>${r.admin_note?`<div style="font-size:11px;color:${s[1]};margin-top:4px;font-weight:700">메모: ${escHtml(r.admin_note)}</div>`:''}</div>`;
}

/* ===== 아이템 컨설팅 — 원본 뚠카롱 게시판 그대로 이식 =====
 * 원본 index.html(6660-8723) 충실 포팅. Tailwind 온디맨드 + 얇은 호환 셸.
 * 컨테이너 id=contentArea · DB=item_consultings(라이브 공유) · 잠재옵션=site_config.potentialOptions */
let supaDb = null;          // boot 후 db()로 채움 (BACKEND.db)
let SITE_CONFIG = {};       // getConfig() 결과(_cfg 동일 참조) — 잠재옵션 메뉴 편집용

/* esc: 텍스트/속성 양쪽 안전 (원본과 동일하게 따옴표까지 이스케이프) */
function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
window.esc = esc;

/* showMsg: 토스트 (원본 전역 알림 대체) */
window.showMsg = function(msg, type){
  let host = document.getElementById('_bunnyToast');
  if(!host){ host=document.createElement('div'); host.id='_bunnyToast'; host.style.cssText='position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:3000;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none'; document.body.appendChild(host); }
  const c = type==='error'?['#fee2e2','#b91c1c']:type==='success'?['#dcfce7','#15803d']:['#e0f2fe','#0369a1'];
  const t = document.createElement('div'); t.textContent=String(msg);
  t.style.cssText='background:'+c[0]+';color:'+c[1]+';font-weight:800;font-size:13px;padding:11px 18px;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.18);max-width:80vw;text-align:center';
  host.appendChild(t);
  setTimeout(function(){ t.style.transition='opacity .4s'; t.style.opacity='0'; setTimeout(function(){ t.remove(); },420); }, 2600);
};

/* R2 이미지 업로드 — 보석금과 동일 워커 · guide-images 버킷 */
const R2_WORKER_URL = BAIL_R2.worker, R2_API_KEY = BAIL_R2.apiKey;
window._r2Upload = async (bucket, filename, file)=>{
  const res = await fetch(R2_WORKER_URL+'/upload/'+bucket+'/'+filename, { method:'POST', headers:{ 'Content-Type':file.type||'image/webp', 'X-API-Key':R2_API_KEY }, body:file });
  if(!res.ok) throw new Error('R2 업로드 실패: '+res.status);
  return (await res.json()).url;
};
window._r2Delete = async (bucket, filename)=>{
  const res = await fetch(R2_WORKER_URL+'/delete/'+bucket+'/'+filename, { method:'DELETE', headers:{ 'X-API-Key':R2_API_KEY } });
  if(!res.ok) throw new Error('R2 삭제 실패: '+res.status);
};

/* 넥슨 API 별칭 — 버니 nexonFetch/nexonKey 로 위임 */
window._nexonFetch = (endpoint, params)=> nexonFetch(endpoint, params||{});
window._getNexonApiKey = ()=> nexonKey();
window._getCharOcid = async (name)=> (await nexonFetch('/maplestory/v1/id',{ character_name:name })).ocid;
window._getCharBasic = (ocid)=> nexonFetch('/maplestory/v1/character/basic',{ ocid });

/* 페이지 빌더 — Tailwind/설정 준비 후 컨테이너만 깔고 renderConsulting 킥오프 */
async function buildConsulting(){
  await loadTailwind();
  try{ SITE_CONFIG = await getConfig(); }catch(e){ SITE_CONFIG = SITE_CONFIG || {}; }
  supaDb = db();
  if(window._consultingState){ window._consultingState.view='list'; window._consultingState.currentId=null; window._consultingState.draft=null; }
  setTimeout(function(){ const el=document.getElementById('contentArea'); if(el && window.renderConsulting) window.renderConsulting(el); }, 0);
  return headerHTML('아이템 컨설팅','길드원 아이템 컨설팅 게시판') +
    '<div id="contentArea"><div style="text-align:center;padding:48px;color:var(--dim);font-weight:700"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px"></i>로딩 중…</div></div>';
}

  // ============ 아이템 컨설팅 (게시판 + 작성/뷰어) ============
  // Supabase 테이블 'item_consultings' 필요. 아래 SQL을 한 번 실행:
  /*
    CREATE TABLE IF NOT EXISTS item_consultings (
      id BIGSERIAL PRIMARY KEY,
      member_name TEXT NOT NULL,
      member_class TEXT,
      member_server TEXT,
      consultant_name TEXT,
      diagnosis_date DATE DEFAULT CURRENT_DATE,
      combat_power TEXT,
      main_stat TEXT,
      hexa_stat TEXT,
      goal JSONB DEFAULT '{}'::jsonb,
      diagnosis JSONB DEFAULT '[]'::jsonb,
      tips JSONB DEFAULT '[]'::jsonb,
      target_items JSONB DEFAULT '[]'::jsonb,
      summary TEXT,
      character_image TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  */
  window._consultingState = { view: 'list', currentId: null, draft: null, list: null, loading: false, linkingSetIdx: null };

  window.renderConsulting = async (container) => {
    const cs = window._consultingState;
    container.innerHTML = '<div class="text-center py-12 text-gray-400 text-xs"><i class="fas fa-spinner fa-spin mr-2"></i>로딩 중...</div>';

    if (cs.view === 'list') return window._consultingRenderList(container);
    if (cs.view === 'detail') return window._consultingRenderDetail(container);
    if (cs.view === 'edit' || cs.view === 'new') return window._consultingRenderEdit(container);
  };

  // 컨설팅 합산 헥사 상승치 (효율 분석과 동일 로직 — 카드 뱃지/요약 공통)
  window._consultingComputeTotalHexa = (c) => {
    if (!c) return 0;
    const items = Array.isArray(c.target_items) ? c.target_items : [];
    const goal = c.goal || {};
    const setListRaw = Array.isArray(goal.sets) ? goal.sets : [];
    const targetSlots = new Set(items.map(t => t.slot));
    const itemHexa = items.reduce((s, t) => s + (Number(t.hexa_contrib) || 0), 0);
    const setHexa = setListRaw.reduce((sum, s) => {
      const slots = Array.isArray(s.items) ? s.items
        : (typeof s.items === 'string' ? s.items.split(/[,/·]/).map(x => x.trim()).filter(Boolean) : []);
      const active = slots.length > 0 && slots.some(slot => targetSlots.has(slot));
      return active ? sum + (Number(s.hexa_contrib) || 0) : sum;
    }, 0);
    const huHexa = Number(goal.hexaUpgrade?.hexa_gain) || 0;
    return itemHexa + setHexa + huHexa;
  };

  window._consultingFetchList = async () => {
    try {
      const { data, error } = await supaDb.from('item_consultings')
        .select('id, member_name, member_class, member_server, consultant_name, diagnosis_date, combat_power, main_stat, hexa_stat, goal, target_items, summary, character_image, updated_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (e) {
      window.showMsg('컨설팅 목록 로드 실패: ' + e.message, 'error');
      return null;
    }
  };

  window._consultingRenderList = async (container) => {
    const list = await window._consultingFetchList();
    if (list === null) {
      container.innerHTML = `<div class="bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center">
        <i class="fas fa-exclamation-circle text-3xl text-red-400 mb-3"></i>
        <h3 class="text-base font-bold text-gray-800 mb-2">테이블이 없거나 권한이 부족합니다</h3>
        <p class="text-xs text-gray-500 mb-4">Supabase에서 <code class="bg-gray-100 px-1 py-0.5 rounded text-pink-500">item_consultings</code> 테이블을 만들어주세요.</p>
        <pre class="text-[10px] text-left bg-gray-50 p-3 rounded overflow-x-auto text-gray-600">CREATE TABLE item_consultings (
  id BIGSERIAL PRIMARY KEY,
  member_name TEXT NOT NULL,
  member_class TEXT, member_server TEXT, consultant_name TEXT,
  diagnosis_date DATE DEFAULT CURRENT_DATE,
  combat_power TEXT, main_stat TEXT, hexa_stat TEXT,
  goal JSONB DEFAULT '{}'::jsonb,
  diagnosis JSONB DEFAULT '[]'::jsonb,
  tips JSONB DEFAULT '[]'::jsonb,
  target_items JSONB DEFAULT '[]'::jsonb,
  summary TEXT, character_image TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);</pre></div>`;
      return;
    }

    container.innerHTML = `
    <div class="flex flex-col gap-3 fade-in pb-20 lg:pb-0">
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <h3 class="text-sm font-bold text-gray-700"><i class="fas fa-stethoscope mr-1 text-pink-500"></i>아이템 컨설팅 게시판</h3>
        <span class="text-[10px] text-gray-400">총 ${list.length}건 · 길드원 컨설팅 결과를 모아봅니다</span>
        ${isAdmin() ? `
          <label class="ml-auto px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-bold shadow-sm hover:bg-blue-100 transition-all cursor-pointer" title="다른 진단 도구의 JSON 파일 불러오기">
            <i class="fas fa-file-import mr-1"></i>JSON 가져오기
            <input type="file" accept="application/json,.json" class="hidden" onchange="window._consultingImportJsonFile(event)">
          </label>
          <button onclick="window._consultingNew()" class="px-3 py-1.5 bg-pink-500 text-white rounded-lg text-[11px] font-bold shadow hover:bg-pink-600 transition-all"><i class="fas fa-plus mr-1"></i>새 컨설팅 작성</button>
        ` : ''}
      </div>

      ${list.length === 0 ? `
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <i class="fas fa-stethoscope text-5xl text-gray-200 mb-4"></i>
          <p class="text-sm text-gray-400 font-bold">아직 등록된 컨설팅이 없습니다</p>
          ${isAdmin() ? '<p class="text-[10px] text-gray-300 mt-2">상단 "새 컨설팅 작성" 버튼으로 시작하세요</p>' : ''}
        </div>
      ` : `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          ${list.map(c => {
            const date = c.diagnosis_date || (c.updated_at || '').slice(0, 10);
            const goal = c.goal || {};
            // 캐릭 이미지 URL — width 파라미터 없으면 큰 사이즈로 강제 (메이플 API 호환)
            const charImgUrl = (() => {
              if (!c.character_image) return '';
              if (/[?&]width=/.test(c.character_image)) return c.character_image;
              const sep = c.character_image.includes('?') ? '&' : '?';
              return c.character_image + `${sep}width=400&height=500`;
            })();
            // 헥사 환산 숫자 파싱 (교체 후 예상값 계산용)
            const parseHexaNum = (s) => {
              if (s == null) return null;
              const cleaned = String(s).replace(/[,\s]/g, '');
              const manMatch = cleaned.match(/^([\d.]+)만/);
              if (manMatch) return Math.round(parseFloat(manMatch[1]) * 10000);
              const num = parseFloat(cleaned);
              return isNaN(num) ? null : num;
            };
            const curHexaNum = parseHexaNum(c.hexa_stat);
            // 합산 상승치 = 효율 분석의 총 헥사 상승 (단품 + 세트 발동 + 헥사 강화)
            const totalGain = window._consultingComputeTotalHexa(c);
            const projectedHexa = (curHexaNum != null && totalGain > 0) ? curHexaNum + totalGain : null;
            const hasGoalText = goal.targetHexa && String(goal.targetHexa).trim();
            return `
              <div onclick="window._consultingOpen(${c.id})" class="bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-pink-300 hover:shadow-md transition-all cursor-pointer overflow-hidden group">
                <div class="p-4">
                  <div class="flex items-center gap-3 mb-3">
                    <div class="w-20 h-24 rounded-xl bg-gradient-to-br from-pink-50 to-rose-50 flex items-center justify-center shrink-0 overflow-hidden border border-pink-100">
                      ${c.character_image ? `<img src="${esc(charImgUrl)}" class="w-full h-full object-cover" style="transform:scale(1.6);transform-origin:center 60%;" onerror="this.style.display='none';this.parentElement.innerHTML='<i class=\\'fas fa-user text-pink-300 text-3xl\\'></i>'">` : '<i class="fas fa-user text-pink-300 text-3xl"></i>'}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-black text-gray-800 text-sm truncate">${esc(c.member_name)}<span class="text-gray-400 font-normal text-[10px] ml-1">님의 컨설팅</span></div>
                      <div class="text-[10px] text-gray-500 truncate">${esc(c.member_class || '')}${c.member_server ? ' · ' + esc(c.member_server) : ''}</div>
                    </div>
                  </div>

                  <!-- 헥사 환산 (메인 지표) -->
                  <div class="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-3 mb-2 border border-orange-100">
                    <div class="flex items-center justify-between mb-1.5">
                      <span class="text-[9px] font-black text-orange-500 uppercase tracking-wider"><i class="fas fa-cube mr-0.5"></i>헥사 환산</span>
                      ${totalGain > 0 ? `<span class="text-[9px] font-black text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded">+${totalGain.toLocaleString()}</span>` : ''}
                    </div>
                    <div class="flex items-baseline gap-2 flex-wrap">
                      <span class="text-base font-black text-gray-700">${esc(c.hexa_stat || '-')}</span>
                      ${projectedHexa != null ? `
                        <i class="fas fa-arrow-right text-[10px] text-gray-300"></i>
                        <span class="text-xl font-black text-orange-600">${projectedHexa.toLocaleString()}</span>
                      ` : ''}
                    </div>
                    ${hasGoalText ? `<div class="text-[9px] text-gray-500 mt-1.5"><i class="fas fa-bullseye text-orange-400 mr-0.5"></i>목표 ${esc(goal.targetHexa)}</div>` : ''}
                  </div>

                  ${(goal.budget || goal.period) ? `
                    <div class="flex items-center justify-center gap-3 text-[9px] text-gray-500 bg-amber-50/50 border border-amber-100/60 rounded-md py-1.5 mb-3">
                      ${goal.budget ? `<span><i class="fas fa-coins text-amber-500 mr-1"></i>예산 ${esc(goal.budget)}</span>` : ''}
                      ${goal.budget && goal.period ? `<span class="text-gray-300">·</span>` : ''}
                      ${goal.period ? `<span><i class="fas fa-clock text-gray-400 mr-1"></i>${esc(goal.period)}</span>` : ''}
                    </div>
                  ` : ''}

                  ${c.summary ? `<p class="text-[10px] text-gray-500" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc((c.summary || '').substring(0, 120))}</p>` : ''}
                  <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <span class="text-[9px] text-gray-400"><i class="fas fa-calendar mr-1"></i>${esc(date)}</span>
                    <span class="text-[9px] text-pink-400 font-bold group-hover:text-pink-600">자세히 →</span>
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>
      `}
    </div>`;
  };

  window._consultingOpen = (id) => {
    window._consultingState.view = 'detail';
    window._consultingState.currentId = id;
    window.renderConsulting(document.getElementById('contentArea'));
  };

  window._consultingBack = () => {
    window._consultingState.view = 'list';
    window._consultingState.currentId = null;
    window._consultingState.draft = null;
    window.renderConsulting(document.getElementById('contentArea'));
  };

  window._consultingNew = () => {
    if (!isAdmin()) return window.showMsg('관리자만 작성 가능합니다.', 'error');
    window._consultingState.view = 'new';
    window._consultingState.draft = {
      member_name: '', member_class: '', member_server: '루나', consultant_name: '',
      diagnosis_date: new Date().toISOString().slice(0, 10),
      combat_power: '', main_stat: '', hexa_stat: '',
      goal: { targetHexa: '', budget: '', period: '', sets: [], hexaUpgrade: { hexa_gain: 0, sol_erda: 0, sol_erda_price: 0 } },
      diagnosis: [], tips: [], target_items: [], summary: '', character_image: '', attachments: []
    };
    window.renderConsulting(document.getElementById('contentArea'));
  };

  // 첨부 이미지 편집 영역 렌더 (URL 기반 — Cloudflare 등에 업로드 후 URL 붙여넣기)
  window._consultingRenderAttachmentsEditor = (attachments) => {
    const list = Array.isArray(attachments) ? attachments : [];
    const kinds = [
      { v: 'kakao', l: '카톡 대화' },
      { v: 'final', l: '마침 사진' },
      { v: 'other', l: '기타' }
    ];
    const empty = !list.length;
    return `
      <div class="mb-3 flex gap-1">
        <input id="_consultingAttachUrlInput" type="text" placeholder="이미지 URL 붙여넣기 (Cloudflare Images / R2 / 외부 호스팅 OK)" class="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs" onkeydown="if(event.key==='Enter'){event.preventDefault();window._consultingAddAttachmentUrl();}">
        <button onclick="window._consultingAddAttachmentUrl()" class="px-3 py-1.5 bg-blue-500 text-white rounded text-xs font-bold hover:bg-blue-600">추가</button>
      </div>
      ${empty ? '<p class="text-[11px] text-gray-300 italic text-center py-4">아직 첨부된 이미지가 없습니다</p>' : `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">${list.map((a, i) => `
        <div class="bg-gray-50 rounded-lg border border-gray-200 p-2.5 space-y-2">
          <div class="relative aspect-video bg-white rounded overflow-hidden border border-gray-200">
            ${a.url ? `<img src="${esc(a.url)}" class="w-full h-full object-contain" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="w-full h-full hidden items-center justify-center text-red-400 text-[10px] p-2 text-center">이미지 로드 실패<br>${esc(a.url.slice(0,40))}...</div>` : '<div class="w-full h-full flex items-center justify-center text-gray-300"><i class="fas fa-image text-2xl"></i></div>'}
            <button type="button" onclick="window._consultingRemoveAttachment(${i})" class="absolute top-1 right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs shadow"><i class="fas fa-times"></i></button>
          </div>
          <select onchange="window._consultingUpdateAttachment(${i},'kind',this.value)" class="w-full text-[11px] font-bold border border-gray-200 rounded px-2 py-1">
            ${kinds.map(k => `<option value="${k.v}" ${(a.kind||'kakao')===k.v?'selected':''}>${k.l}</option>`).join('')}
          </select>
          <input type="text" value="${esc(a.caption||'')}" oninput="window._consultingUpdateAttachment(${i},'caption',this.value)" placeholder="캡션 (선택)" class="w-full text-[11px] border border-gray-200 rounded px-2 py-1">
        </div>`).join('')}</div>`}`;
  };

  window._consultingAddAttachmentUrl = () => {
    const inp = document.getElementById('_consultingAttachUrlInput');
    const url = inp?.value.trim();
    if (!url) { window.showMsg('URL을 입력해주세요', 'error'); return; }
    if (!/^https?:\/\//.test(url)) { window.showMsg('http(s):// 로 시작하는 URL이어야 합니다', 'error'); return; }
    const d = window._consultingState.draft;
    if (!Array.isArray(d.attachments)) d.attachments = [];
    d.attachments.push({ kind: 'kakao', caption: '', url });
    if (inp) inp.value = '';
    window.showMsg('이미지 추가됨', 'success');
    window.renderConsulting(document.getElementById('contentArea'));
  };

  // 파일 → Cloudflare R2 자동 업로드 → URL을 attachments에 추가
  window._consultingAddAttachments = async (ev) => {
    const files = Array.from(ev.target?.files || []);
    if (!files.length) return;
    const d = window._consultingState.draft;
    if (!Array.isArray(d.attachments)) d.attachments = [];
    let added = 0, failed = 0;
    for (const file of files) {
      if (!file.type.startsWith('image/')) { failed++; continue; }
      try {
        const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
        const safeName = `consulting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        window.showMsg(`업로드 중... (${added + failed + 1}/${files.length})`, 'info');
        const publicUrl = await window._r2Upload('guide-images', safeName, file);
        d.attachments.push({ kind: 'kakao', caption: '', url: publicUrl, _r2name: safeName });
        added++;
      } catch (e) {
        console.warn('R2 업로드 실패:', e);
        failed++;
      }
    }
    if (ev?.target) ev.target.value = '';
    if (added) window.showMsg(`${added}장 업로드 완료${failed ? ` (${failed}장 실패)` : ''}`, 'success');
    else window.showMsg('업로드 실패', 'error');
    window.renderConsulting(document.getElementById('contentArea'));
  };

  window._consultingUpdateAttachment = (idx, field, value) => {
    const d = window._consultingState.draft;
    if (!Array.isArray(d.attachments) || !d.attachments[idx]) return;
    d.attachments[idx][field] = value;
  };

  window._consultingRemoveAttachment = async (idx) => {
    const d = window._consultingState.draft;
    if (!Array.isArray(d.attachments)) return;
    const removed = d.attachments[idx];
    d.attachments.splice(idx, 1);
    // R2에 올린 파일이면 같이 삭제 (best-effort, 실패해도 무시)
    if (removed?._r2name) {
      try { await window._r2Delete('guide-images', removed._r2name); } catch (e) {}
    }
    window.renderConsulting(document.getElementById('contentArea'));
  };

  // 상세뷰: 첨부 이미지 갤러리
  window._consultingRenderAttachmentsView = (attachments) => {
    const list = Array.isArray(attachments) ? attachments.filter(a => a.url || a.data) : [];
    if (!list.length) return '';
    const kindMeta = {
      kakao: { l: '카톡 대화', cls: 'text-amber-600 bg-amber-50 border-amber-100' },
      final: { l: '마침 사진', cls: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
      other: { l: '기타', cls: 'text-gray-600 bg-gray-100 border-gray-200' }
    };
    const groups = list.reduce((acc, a) => { (acc[a.kind || 'other'] ||= []).push(a); return acc; }, {});
    const order = ['kakao', 'final', 'other'];
    return `<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <h3 class="text-base font-black text-pink-500 flex items-center gap-2"><i class="fas fa-images"></i>참고 이미지 (${list.length}장)</h3>
      ${order.filter(k => groups[k]?.length).map(k => `
        <div>
          <div class="text-[10px] font-bold uppercase mb-2 ${kindMeta[k].cls.split(' ').slice(0,1)} px-2 py-1 inline-block rounded">${kindMeta[k].l} · ${groups[k].length}장</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            ${groups[k].map(a => { const src = a.url || a.data || ''; return `
              <div class="bg-gray-50 rounded-lg border ${kindMeta[k].cls.split(' ').filter(c=>c.startsWith('border')).join(' ')} overflow-hidden cursor-pointer hover:scale-[1.02] transition" onclick="window._consultingShowImageModal(${JSON.stringify(src).replace(/"/g, '&quot;')})">
                <img src="${esc(src)}" class="w-full max-h-80 object-contain bg-white" onerror="this.style.display='none'">
                ${a.caption ? `<div class="text-[11px] text-gray-600 px-2 py-1.5 bg-white border-t border-gray-100">${esc(a.caption)}</div>` : ''}
              </div>`; }).join('')}
          </div>
        </div>`).join('')}
    </div>`;
  };

  window._consultingShowImageModal = (dataUrl) => {
    const old = document.getElementById('_consultingImageModal');
    if (old) old.remove();
    const div = document.createElement('div');
    div.id = '_consultingImageModal';
    div.className = 'fixed inset-0 z-[1500] flex items-center justify-center p-4';
    div.style.background = 'rgba(0,0,0,0.85)';
    div.innerHTML = `<img src="${esc(dataUrl)}" class="max-w-full max-h-full object-contain" onclick="event.stopPropagation()"><button onclick="document.getElementById('_consultingImageModal').remove()" class="absolute top-4 right-4 w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full text-lg"><i class="fas fa-times"></i></button>`;
    div.onclick = () => div.remove();
    document.body.appendChild(div);
  };

  // 외부 진단 도구의 JSON 파일을 우리 컨설팅 draft로 변환
  window._consultingImportJsonFile = (ev) => {
    if (!isAdmin()) return window.showMsg('관리자만 가능합니다.', 'error');
    const file = ev.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(reader.result);
        const draft = window._consultingMapJsonToDraft(json);
        window._consultingState.view = 'new';
        window._consultingState.draft = draft;
        window._consultingState.currentId = null;
        window.showMsg(`${draft.member_name || '캐릭터'} 컨설팅 가져옴 (장비 ${draft.equipment_data.length}개, 목표 ${draft.target_items.length}개)`, 'success');
        window.renderConsulting(document.getElementById('contentArea'));
      } catch (e) {
        window.showMsg('JSON 파싱 실패: ' + e.message, 'error');
      } finally {
        ev.target.value = ''; // 같은 파일 재선택 가능하게
      }
    };
    reader.onerror = () => window.showMsg('파일 읽기 실패', 'error');
    reader.readAsText(file, 'utf-8');
  };

  // JSON → draft 매핑 (외부 도구 포맷 호환)
  window._consultingMapJsonToDraft = (json) => {
    const u = json.user || {};
    // 항상 가장 점수 높은 프리셋 사용 (재획 프리셋 회피, 보스 프리셋 우선)
    const presets = json.presets || {};
    const scored = Object.keys(presets).map(k => ({
      no: k,
      items: presets[k] || [],
      score: window._consultingPresetScore((presets[k] || []).map(p => ({
        starforce: p.stars, scroll_upgrade: p.scrollUpgrade,
        potential_option_grade: p.potentialGrade,
        additional_potential_option_grade: p.additionalGrade
      })))
    })).filter(x => x.items.length > 0);
    scored.sort((a, b) => b.score - a.score);
    const usedNo = scored[0]?.no || Object.keys(presets)[0] || '1';
    const presetItems = presets[usedNo] || [];
    const equipment_data = presetItems.map(p => ({
      item_equipment_slot: p.slot,
      item_equipment_part: p.slot,
      item_name: p.name || '',
      item_icon: p.icon || '',
      starforce: String(p.stars || 0),
      scroll_upgrade: String(p.scrollUpgrade || 0),
      potential_option_grade: p.potentialGrade || '',
      potential_option_1: p.potential1 || '',
      potential_option_2: p.potential2 || '',
      potential_option_3: p.potential3 || '',
      additional_potential_option_grade: p.additionalGrade || '',
      additional_potential_option_1: p.additional1 || '',
      additional_potential_option_2: p.additional2 || '',
      additional_potential_option_3: p.additional3 || '',
      addStr: p.addStr, addDex: p.addDex, addInt: p.addInt, addLuk: p.addLuk,
      addAllStat: p.addAllStat, addAtk: p.addAtk, addMatk: p.addMatk,
      addBossDmg: p.addBossDmg, addDmg: p.addDmg, addHp: p.addHp, addDef: p.addDef
    }));
    // 타깃 아이템 — 슬롯으로 before 매칭
    const target_items = (json.targetItems || []).map(t => {
      const beforeEq = equipment_data.find(e => e.item_equipment_slot === t.slot) || {};
      return {
        slot: t.slot,
        before_name: beforeEq.item_name || '',
        before_icon: beforeEq.item_icon || '',
        before_stars: parseInt(beforeEq.starforce) || 0,
        after_name: t.name || '',
        after_icon: t.icon || '',
        after_stars: parseInt(t.stars) || 0,
        after_pot_grade: t.potentialGrade || '',
        after_pot_1: t.potential1 || '',
        after_pot_2: t.potential2 || '',
        after_pot_3: t.potential3 || '',
        after_add_grade: t.additionalGrade || '',
        after_add_1: t.additional1 || '',
        after_add_2: t.additional2 || '',
        after_add_3: t.additional3 || '',
        after_add_tier: t.addTier || t.addOptionRank || '',
        hexa_contrib: parseInt(t.hexaContrib) || 0,
        cost: t.estimatedCost || '',
        ref_from: t.refFrom || ''
      };
    });
    return {
      member_name: u.name || '',
      member_class: u.class || '',
      member_server: u.server || '루나',
      consultant_name: json.consultant || '',
      diagnosis_date: new Date().toISOString().slice(0, 10),
      combat_power: u.combatPower || '',
      main_stat: u.stat || '',
      hexa_stat: u.hexaStat || '',
      character_image: u.characterImage || '',
      goal: json.goal || { targetHexa: '', budget: '', period: '' },
      diagnosis: (json.diagnosis || []).map(d => ({
        title: d.title || '',
        content: d.content || '',
        priority: d.priority || '중간'
      })),
      tips: Array.isArray(json.tips) ? json.tips : [],
      target_items,
      summary: json.summary || '',
      equipment_data,
      attachments: []
    };
  };

  window._consultingEdit = async (id) => {
    if (!isAdmin()) return window.showMsg('관리자만 수정 가능합니다.', 'error');
    const { data, error } = await supaDb.from('item_consultings').select('*').eq('id', id).maybeSingle();
    if (error || !data) return window.showMsg('데이터 로드 실패', 'error');
    window._consultingState.view = 'edit';
    window._consultingState.currentId = id;
    window._consultingState.draft = data;
    window.renderConsulting(document.getElementById('contentArea'));
  };

  window._consultingDelete = async (id) => {
    if (!isAdmin()) return;
    if (!confirm('이 컨설팅을 삭제하시겠습니까?')) return;
    const { error } = await supaDb.from('item_consultings').delete().eq('id', id);
    if (error) return window.showMsg('삭제 실패: ' + error.message, 'error');
    window.showMsg('삭제 완료', 'success');
    window._consultingBack();
  };

  window._consultingRenderDetail = async (container) => {
    const id = window._consultingState.currentId;
    const { data, error } = await supaDb.from('item_consultings').select('*').eq('id', id).maybeSingle();
    if (error || !data) {
      container.innerHTML = '<div class="text-center py-12 text-red-400">컨설팅을 불러올 수 없습니다.</div>';
      return;
    }

    const c = data;
    const tips = Array.isArray(c.tips) ? c.tips : [];
    const diagnosis = Array.isArray(c.diagnosis) ? c.diagnosis : [];
    const goal = c.goal || {};

    container.innerHTML = `
    <div class="flex flex-col gap-4 fade-in pb-20 lg:pb-0">
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-2 flex-wrap">
        <button onclick="window._consultingBack()" class="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[11px] font-bold hover:bg-gray-200"><i class="fas fa-arrow-left mr-1"></i>목록</button>
        <h3 class="text-sm font-bold text-gray-800 ml-1"><i class="fas fa-stethoscope mr-1 text-pink-500"></i>${esc(c.member_name)}님의 아이템 컨설팅</h3>
        ${isAdmin() ? `
          <button onclick="window._consultingEdit(${c.id})" class="ml-auto px-3 py-1.5 bg-blue-500 text-white rounded-lg text-[11px] font-bold hover:bg-blue-600"><i class="fas fa-edit mr-1"></i>수정</button>
          <button onclick="window._consultingDelete(${c.id})" class="px-3 py-1.5 bg-red-500 text-white rounded-lg text-[11px] font-bold hover:bg-red-600"><i class="fas fa-trash mr-1"></i>삭제</button>
        ` : ''}
      </div>

      <div class="bg-gradient-to-br from-pink-50 via-white to-blue-50 rounded-2xl border border-gray-100 shadow-sm p-6">
        <div class="flex items-start gap-5 flex-wrap">
          <div class="w-60 h-60 rounded-2xl bg-white shadow-sm flex items-center justify-center overflow-hidden flex-shrink-0">
            ${c.character_image ? `<img src="${esc(c.character_image)}" class="w-full h-full object-contain p-2" onerror="this.style.display='none'">` : '<i class="fas fa-user text-pink-300 text-7xl"></i>'}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-[10px] text-pink-500 font-bold uppercase tracking-widest mb-1">CHARACTER</div>
            <h2 class="text-2xl font-black text-gray-800">${esc(c.member_name)}</h2>
            <div class="flex gap-3 mt-1 text-xs flex-wrap">
              <span class="text-gray-600">${esc(c.member_class || '-')}</span>
              <span class="text-gray-300">·</span>
              <span class="text-blue-500 font-bold">${esc(c.member_server || '-')}</span>
              ${c.diagnosis_date ? `<span class="text-gray-300">·</span><span class="text-gray-500"><i class="fas fa-calendar mr-1"></i>${esc(c.diagnosis_date)}</span>` : ''}
              ${c.consultant_name ? `<span class="text-gray-300">·</span><span class="text-purple-500"><i class="fas fa-user-tie mr-1"></i>${esc(c.consultant_name)}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5">
          <div class="bg-white rounded-xl p-3 border border-gray-100 text-center">
            <div class="text-[9px] text-gray-400 font-bold uppercase tracking-wider">전투력</div>
            <div class="text-base font-black text-blue-600 mt-1">${esc(c.combat_power || '-')}</div>
          </div>
          <div class="bg-white rounded-xl p-3 border border-gray-100 text-center">
            <div class="text-[9px] text-gray-400 font-bold uppercase tracking-wider">환산 주스탯</div>
            <div class="text-base font-black text-gray-800 mt-1">${esc(c.main_stat || '-')}</div>
          </div>
          <div class="bg-white rounded-xl p-3 border border-gray-100 text-center">
            <div class="text-[9px] text-gray-400 font-bold uppercase tracking-wider">헥사 환산</div>
            <div class="text-base font-black text-orange-500 mt-1">${esc(c.hexa_stat || '-')}</div>
          </div>
        </div>

        ${(goal.targetHexa || goal.budget || goal.period) ? `
        <div class="mt-4 bg-white/60 rounded-xl p-3 border border-pink-100">
          <div class="text-[10px] text-pink-500 font-bold uppercase tracking-wider mb-2"><i class="fas fa-target mr-1"></i>목표</div>
          <div class="grid grid-cols-3 gap-2 text-xs">
            ${goal.targetHexa ? `<div><div class="text-[9px] text-gray-400 font-bold mb-0.5">목표 헥사</div><div class="font-bold text-gray-800">${esc(goal.targetHexa)}</div></div>` : ''}
            ${goal.budget ? `<div><div class="text-[9px] text-gray-400 font-bold mb-0.5">예산</div><div class="font-bold text-gray-800">${esc(goal.budget)}</div></div>` : ''}
            ${goal.period ? `<div><div class="text-[9px] text-gray-400 font-bold mb-0.5">기간</div><div class="font-bold text-gray-800">${esc(goal.period)}</div></div>` : ''}
          </div>
        </div>` : ''}

        ${(Array.isArray(goal.sets) && goal.sets.length) ? `
        <div class="mt-4 bg-violet-50/40 rounded-xl p-3 border border-violet-100">
          <div class="flex items-center justify-between mb-2">
            <div class="text-[10px] text-violet-600 font-bold uppercase tracking-wider"><i class="fas fa-layer-group mr-1"></i>세트 효과 (${goal.sets.length}개 발동)</div>
            <div class="text-[11px] font-black text-violet-700">+${goal.sets.reduce((s, x) => s + (Number(x.hexa_contrib)||0), 0).toLocaleString()}</div>
          </div>
          <div class="space-y-1.5">
            ${goal.sets.map(s => {
              const slots = Array.isArray(s.items) ? s.items.join(' / ') : (typeof s.items === 'string' ? s.items : '');
              return `
                <div class="flex items-center justify-between bg-white rounded-lg px-3 py-2">
                  <div class="min-w-0 flex-1">
                    <div class="text-xs font-black text-gray-800 truncate">${esc(s.name || '(이름 없음)')}</div>
                    ${slots ? `<div class="text-[10px] text-gray-400 truncate">${esc(slots)}</div>` : ''}
                  </div>
                  <div class="text-right shrink-0 ml-2">
                    <div class="text-sm font-black text-violet-600">+${(Number(s.hexa_contrib)||0).toLocaleString()}</div>
                    <div class="text-[9px] text-gray-400">헥사 환산</div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>` : ''}

        ${tips.length ? `
        <div class="mt-4 bg-amber-50/60 rounded-xl p-3 border border-amber-100">
          <div class="text-[10px] text-amber-600 font-bold uppercase tracking-wider mb-2"><i class="fas fa-info-circle mr-1"></i>주의사항</div>
          <ul class="space-y-1">
            ${tips.map(t => `<li class="text-xs text-amber-800 flex gap-1.5"><span class="text-amber-400">•</span><span>${esc(t)}</span></li>`).join('')}
          </ul>
        </div>` : ''}
      </div>

      ${(Array.isArray(c.equipment_data) && c.equipment_data.length) ? `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 class="text-base font-black mb-4 flex items-center gap-2 text-blue-500"><i class="fas fa-shield-alt"></i>현재 장비 (${c.equipment_data.length}개)</h3>
        ${window._consultingRenderEquipPreview(c.equipment_data, false, c.target_items)}
      </div>` : ''}

      ${(Array.isArray(c.target_items) && c.target_items.length) ? `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 class="text-base font-black mb-4 flex items-center gap-2 text-indigo-500"><i class="fas fa-exchange-alt"></i>장비 교체 목표 (${c.target_items.length}개)</h3>
        ${window._consultingRenderCompareCards(c.target_items, c.equipment_data)}
      </div>

      <div class="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-100 shadow-sm p-6">
        <h3 class="text-base font-black mb-4 flex items-center gap-2 text-amber-600"><i class="fas fa-calculator"></i>교체 효율 분석</h3>
        ${window._consultingRenderEfficiency(c.target_items, c.goal?.sets, c.goal?.hexaUpgrade)}
      </div>` : ''}

      ${diagnosis.length ? `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h3 class="text-base font-black mb-4 flex items-center gap-2 text-emerald-500"><i class="fas fa-route"></i>스펙업 로드맵</h3>
        <div class="space-y-3">
          ${diagnosis.map((d, i) => {
            const pColor = d.priority === '매우 높음' ? 'bg-red-50 text-red-500 border-red-200' :
                          d.priority === '높음' ? 'bg-orange-50 text-orange-500 border-orange-200' :
                          'bg-blue-50 text-blue-500 border-blue-200';
            return `
              <div class="flex gap-3 p-3 rounded-xl bg-gray-50/50 hover:bg-pink-50/30 transition-colors">
                <div class="w-8 h-8 rounded-full bg-white border-2 border-pink-200 flex items-center justify-center font-black text-pink-500 text-sm flex-shrink-0">${i + 1}</div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap mb-1">
                    <h4 class="font-bold text-gray-800">${esc(d.title || '')}</h4>
                    ${d.priority ? `<span class="text-[9px] font-bold px-2 py-0.5 rounded border ${pColor}">${esc(d.priority)}</span>` : ''}
                  </div>
                  <p class="text-xs text-gray-600 leading-relaxed whitespace-pre-line">${esc(d.content || '')}</p>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>` : ''}

      ${c.summary ? `
      <div class="bg-gradient-to-r from-blue-50 to-pink-50 border border-blue-100 rounded-2xl p-6">
        <div class="text-[10px] text-blue-500 font-bold uppercase tracking-widest mb-3"><i class="fas fa-comment-dots mr-1"></i>종합 코멘트</div>
        <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-line">${esc(c.summary)}</p>
      </div>` : ''}

      ${window._consultingRenderAttachmentsView(c.attachments)}
    </div>`;
  };

  window._consultingRenderEdit = (container) => {
    const d = window._consultingState.draft || {};
    const tips = Array.isArray(d.tips) ? d.tips : [];
    const diagnosis = Array.isArray(d.diagnosis) ? d.diagnosis : [];
    if (!d.goal) d.goal = {};
    if (!Array.isArray(d.goal.sets)) d.goal.sets = [];
    // sets[*].items 마이그레이션: 문자열("모자, 상의") → 배열
    d.goal.sets.forEach(s => {
      if (typeof s.items === 'string') s.items = s.items.split(/[,/·]/).map(x => x.trim()).filter(Boolean);
      else if (!Array.isArray(s.items)) s.items = [];
    });
    if (!d.goal.hexaUpgrade) d.goal.hexaUpgrade = { hexa_gain: 0, sol_erda: 0, sol_erda_price: 0 };
    const goal = d.goal;
    const isNew = window._consultingState.view === 'new';
    // 세트 슬롯 풀: target_items에 있는 슬롯들만 (없으면 빈 풀 안내)
    const availableSlots = [...new Set((d.target_items || []).map(t => t.slot).filter(Boolean))];

    const equipCount = Array.isArray(d.equipment_data) ? d.equipment_data.length : 0;
    container.innerHTML = `
    <div class="flex flex-col gap-4 fade-in pb-20 lg:pb-0">
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center gap-2 flex-wrap sticky top-0 z-10">
        <button onclick="if(confirm('변경사항이 사라집니다. 계속하시겠습니까?')) window._consultingBack()" class="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-[11px] font-bold hover:bg-gray-200"><i class="fas fa-times mr-1"></i>취소</button>
        <h3 class="text-sm font-bold text-gray-800 ml-1"><i class="fas fa-edit mr-1 text-pink-500"></i>${isNew ? '새 컨설팅 작성' : '컨설팅 수정'}</h3>
        <button onclick="window._consultingSave()" class="ml-auto px-4 py-1.5 bg-pink-500 text-white rounded-lg text-[11px] font-bold shadow hover:bg-pink-600"><i class="fas fa-save mr-1"></i>저장</button>
      </div>

      <div class="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl border border-blue-100 shadow-sm p-5">
        <h4 class="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3"><i class="fas fa-bolt mr-1"></i>넥슨 API 자동 가져오기</h4>
        <div class="flex gap-2 items-end flex-wrap">
          <div class="flex-1 min-w-[200px]">
            <label class="text-[10px] text-gray-500 font-bold uppercase">캐릭명</label>
            <input id="_consultingApiCharName" type="text" value="${esc(d.member_name || '')}" placeholder="캐릭터 닉네임" class="w-full mt-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-blue-300">
          </div>
          <button onclick="window._consultingFetchFromNexon()" id="_consultingFetchBtn" class="px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-bold shadow hover:bg-blue-600 transition-all whitespace-nowrap"><i class="fas fa-cloud-download-alt mr-1"></i>API로 불러오기</button>
        </div>
        <p class="text-[10px] text-gray-500 mt-2"><i class="fas fa-info-circle mr-1"></i>캐릭 기본정보·이미지·장비를 자동으로 채웁니다. 동기화 탭에서 API Key 먼저 등록 필요. ${equipCount > 0 ? `<span class="text-emerald-500 font-bold ml-2"><i class="fas fa-check-circle mr-1"></i>장비 ${equipCount}개 로드됨</span>` : ''}</p>
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider"><i class="fas fa-id-card mr-1 text-pink-400"></i>기본 정보</h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div><label class="text-[10px] text-gray-400 font-bold uppercase">캐릭명 *</label><input type="text" value="${esc(d.member_name || '')}" oninput="window._consultingState.draft.member_name=this.value" class="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:border-pink-300"></div>
          <div><label class="text-[10px] text-gray-400 font-bold uppercase">직업</label><input type="text" value="${esc(d.member_class || '')}" oninput="window._consultingState.draft.member_class=this.value" class="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-300"></div>
          <div><label class="text-[10px] text-gray-400 font-bold uppercase">서버</label><input type="text" value="${esc(d.member_server || '')}" oninput="window._consultingState.draft.member_server=this.value" class="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-300"></div>
          <div><label class="text-[10px] text-gray-400 font-bold uppercase">컨설턴트</label><input type="text" value="${esc(d.consultant_name || '')}" oninput="window._consultingState.draft.consultant_name=this.value" class="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-300"></div>
          <div><label class="text-[10px] text-gray-400 font-bold uppercase">진단일</label><input type="date" value="${esc(d.diagnosis_date || '')}" oninput="window._consultingState.draft.diagnosis_date=this.value" class="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-300"></div>
          <div><label class="text-[10px] text-gray-400 font-bold uppercase">캐릭 이미지 URL (선택)</label><input type="text" value="${esc(d.character_image || '')}" oninput="window._consultingState.draft.character_image=this.value" placeholder="https://..." class="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-pink-300"></div>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider"><i class="fas fa-chart-bar mr-1 text-pink-400"></i>스펙</h4>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label class="text-[10px] text-gray-400 font-bold uppercase">전투력</label><input type="text" value="${esc(d.combat_power || '')}" oninput="window._consultingState.draft.combat_power=this.value" placeholder="예: 8억 2955만" class="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-300"></div>
          <div><label class="text-[10px] text-gray-400 font-bold uppercase">환산 주스탯</label><input type="text" value="${esc(d.main_stat || '')}" oninput="window._consultingState.draft.main_stat=this.value" placeholder="예: 116,141" class="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-300"></div>
          <div><label class="text-[10px] text-gray-400 font-bold uppercase">헥사 환산</label><input type="text" value="${esc(d.hexa_stat || '')}" oninput="window._consultingState.draft.hexa_stat=this.value" placeholder="예: 116,141" class="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-300"></div>
        </div>
        <p class="text-[10px] text-gray-400"><i class="fas fa-info-circle mr-1"></i>환산값은 <a href="https://maplescouter.com/ko/info?name=${encodeURIComponent(d.member_name || '')}" target="_blank" class="text-blue-500 hover:underline">환산주스탯 사이트</a>에서 확인 후 입력</p>
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider"><i class="fas fa-target mr-1 text-pink-400"></i>목표</h4>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><label class="text-[10px] text-gray-400 font-bold uppercase">목표 헥사</label><input type="text" value="${esc(goal.targetHexa || '')}" oninput="window._consultingState.draft.goal.targetHexa=this.value" placeholder="예: 12만+" class="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-300"></div>
          <div><label class="text-[10px] text-gray-400 font-bold uppercase">예산</label><input type="text" value="${esc(goal.budget || '')}" oninput="window._consultingState.draft.goal.budget=this.value" placeholder="예: 주식 100억" class="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-300"></div>
          <div><label class="text-[10px] text-gray-400 font-bold uppercase">기간</label><input type="text" value="${esc(goal.period || '')}" oninput="window._consultingState.draft.goal.period=this.value" placeholder="예: 2개월" class="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-300"></div>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider"><i class="fas fa-layer-group mr-1 text-violet-500"></i>세트 효과 <span class="text-gray-400 normal-case font-normal text-[10px] ml-1">(아이템 여러 개로 발동되는 큰 환산 상승)</span></h4>
          <button onclick="window._consultingAddSet()" class="text-[10px] bg-violet-50 text-violet-600 px-2 py-1 rounded-lg font-bold hover:bg-violet-100"><i class="fas fa-plus mr-1"></i>세트 추가</button>
        </div>
        <p class="text-[10px] text-gray-400">단품 옵션 효과는 "장비 교체 목표"에서 입력. 여기는 <strong>세트 발동 보너스</strong>만. <strong class="text-violet-600">교체 안 하는 아이템도 세트에 포함 가능</strong> — "📌 장비에서 클릭해서 묶기"로 현재 장비/교체 카드 모두 골라요.</p>
        <div class="space-y-2">
          ${(goal.sets || []).length === 0 ? `<div class="text-[10px] text-gray-300 text-center py-3">아직 등록된 세트가 없습니다 — 우측 "세트 추가" 클릭</div>` : (goal.sets || []).map((s, i) => {
            const setItems = Array.isArray(s.items) ? s.items : [];
            const targetSlotSet = new Set((d.target_items || []).map(t => t.slot));
            const itemsInTarget = setItems.filter(slot => targetSlotSet.has(slot));
            const itemsKeep = setItems.filter(slot => !targetSlotSet.has(slot));
            const sharePerSlot = itemsInTarget.length > 0 ? Math.round((Number(s.hexa_contrib)||0) / itemsInTarget.length) : 0;
            const isLinking = window._consultingState?.linkingSetIdx === i;
            return `
              <div class="bg-violet-50/40 border ${isLinking ? 'border-2 border-violet-400' : 'border-violet-100'} rounded-xl p-3 space-y-2">
                <div class="grid grid-cols-1 sm:grid-cols-[1fr_130px_28px] gap-2 items-center">
                  <input type="text" value="${esc(s.name || '')}" oninput="window._consultingState.draft.goal.sets[${i}].name=this.value" placeholder="세트 이름 (예: 아케인셰이드 5세트)" class="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                  <input type="number" value="${s.hexa_contrib != null ? s.hexa_contrib : ''}" oninput="window._consultingState.draft.goal.sets[${i}].hexa_contrib=Number(this.value)||0" placeholder="헥사 보너스" class="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-right font-bold text-violet-600">
                  <button onclick="window._consultingRemoveSet(${i})" class="text-red-400 hover:text-red-600 text-sm" title="삭제"><i class="fas fa-times"></i></button>
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap mb-1.5">
                    <span class="text-[9px] font-bold text-gray-500 uppercase">묶인 슬롯 (${setItems.length}개)</span>
                    ${isLinking
                      ? `<button onclick="window._consultingEndLinkSet()" class="text-[10px] bg-emerald-500 text-white px-2 py-1 rounded-lg font-bold hover:bg-emerald-600 ml-auto"><i class="fas fa-check mr-1"></i>묶기 완료</button>`
                      : `<button onclick="window._consultingStartLinkSet(${i})" class="text-[10px] bg-violet-500 text-white px-2 py-1 rounded-lg font-bold hover:bg-violet-600 ml-auto"><i class="fas fa-thumbtack mr-1"></i>장비에서 클릭해서 묶기</button>`}
                  </div>
                  ${setItems.length === 0
                    ? `<div class="text-[10px] text-gray-400 bg-white rounded px-2 py-1.5 border border-dashed border-gray-200">묶기 버튼을 누르고 아래 장비 카드들을 클릭하세요</div>`
                    : `<div class="flex flex-wrap gap-1">
                        ${setItems.map(slot => `<span class="text-[10px] ${targetSlotSet.has(slot) ? 'bg-violet-100 text-violet-700' : 'bg-amber-100 text-amber-700'} border ${targetSlotSet.has(slot) ? 'border-violet-200' : 'border-amber-200'} rounded px-2 py-0.5 font-bold inline-flex items-center gap-1">${esc(slot)}${targetSlotSet.has(slot) ? '' : ' <span class="text-[9px] font-normal opacity-70">유지</span>'}<button onclick="window._consultingToggleSetSlot(${i}, '${esc(slot)}', false)" class="text-red-400 hover:text-red-600 ml-0.5" title="제거">×</button></span>`).join('')}
                      </div>`}
                  ${setItems.length > 0
                    ? `<p class="text-[10px] text-gray-500 mt-1.5">분배 대상: <strong>${itemsInTarget.length}개</strong> (교체) ${itemsKeep.length > 0 ? `<span class="text-amber-600">+ ${itemsKeep.length}개 (유지·분배 X)</span>` : ''} · 슬롯당 약 +${sharePerSlot.toLocaleString()} (${(Number(s.hexa_contrib)||0).toLocaleString()} ÷ ${itemsInTarget.length || '0'})</p>`
                    : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        ${(goal.sets || []).length > 0 ? `<div class="text-right text-[11px] text-gray-500 pt-1">세트 합계: <strong class="text-violet-600">+${(goal.sets || []).reduce((s, x) => s + (Number(x.hexa_contrib)||0), 0).toLocaleString()}</strong></div>` : ''}
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider"><i class="fas fa-cubes-stacked mr-1 text-amber-500"></i>헥사 강화 (솔에르다 조각) <span class="text-gray-400 normal-case font-normal text-[10px] ml-1">(선택)</span></h4>
        <p class="text-[10px] text-gray-400">솔에르다 강화로 얻을 헥사 환산 상승치 + 필요 조각 수 + 1조각 시세를 입력하면 효율 분석에 자동 포함됩니다.</p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="text-[10px] text-gray-400 font-bold uppercase">예상 헥사 상승</label>
            <input type="number" value="${goal.hexaUpgrade.hexa_gain || ''}" oninput="window._consultingState.draft.goal.hexaUpgrade.hexa_gain=Number(this.value)||0" placeholder="예: 5000" class="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-amber-700 outline-none focus:border-amber-300">
          </div>
          <div>
            <label class="text-[10px] text-gray-400 font-bold uppercase">필요 솔에르다 조각</label>
            <input type="number" value="${goal.hexaUpgrade.sol_erda || ''}" oninput="window._consultingState.draft.goal.hexaUpgrade.sol_erda=Number(this.value)||0" placeholder="예: 50" class="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-amber-700 outline-none focus:border-amber-300">
          </div>
          <div>
            <label class="text-[10px] text-gray-400 font-bold uppercase">조각 시세 (1개 / 억)</label>
            <input type="number" step="0.1" value="${goal.hexaUpgrade.sol_erda_price || ''}" oninput="window._consultingState.draft.goal.hexaUpgrade.sol_erda_price=Number(this.value)||0" placeholder="예: 0.6" class="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-amber-700 outline-none focus:border-amber-300">
          </div>
        </div>
        ${(() => {
          const hu = goal.hexaUpgrade;
          const cost = (Number(hu.sol_erda) || 0) * (Number(hu.sol_erda_price) || 0);
          const eff = cost > 0 ? (Number(hu.hexa_gain) || 0) / cost : 0;
          if (Number(hu.hexa_gain) <= 0 && Number(hu.sol_erda) <= 0) return '';
          return `<div class="bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2 text-[11px] text-amber-800 flex items-center justify-between flex-wrap gap-2">
            <span>총 비용: <strong>${cost.toFixed(1)}억</strong> (${hu.sol_erda || 0} × ${hu.sol_erda_price || 0}억)</span>
            ${eff > 0 ? `<span>효율: <strong class="text-emerald-600">${eff.toFixed(1)}</strong> (${(hu.hexa_gain||0).toLocaleString()} ÷ ${cost.toFixed(1)})</span>` : ''}
          </div>`;
        })()}
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider"><i class="fas fa-route mr-1 text-pink-400"></i>스펙업 로드맵</h4>
          <button onclick="window._consultingAddDiagnosis()" class="text-[10px] bg-pink-50 text-pink-500 px-2 py-1 rounded-lg font-bold hover:bg-pink-100"><i class="fas fa-plus mr-1"></i>단계 추가</button>
        </div>
        <div id="consultingDiagnosisList" class="space-y-2">
          ${diagnosis.map((step, i) => `
            <div class="bg-gray-50/50 rounded-xl p-3 space-y-2">
              <div class="flex items-center gap-2">
                <span class="text-pink-400 font-black text-sm">${i + 1}.</span>
                <input type="text" value="${esc(step.title || '')}" oninput="window._consultingState.draft.diagnosis[${i}].title=this.value" placeholder="단계 제목" class="flex-1 bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold outline-none focus:border-pink-300">
                <select onchange="window._consultingState.draft.diagnosis[${i}].priority=this.value" class="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] font-bold w-24">
                  <option value="매우 높음" ${step.priority==='매우 높음'?'selected':''}>매우 높음</option>
                  <option value="높음" ${step.priority==='높음'?'selected':''}>높음</option>
                  <option value="중간" ${step.priority==='중간'?'selected':''}>중간</option>
                </select>
                <button onclick="window._consultingRemoveDiagnosis(${i})" class="text-red-400 hover:text-red-600 text-xs"><i class="fas fa-times"></i></button>
              </div>
              <textarea oninput="window._consultingState.draft.diagnosis[${i}].content=this.value" placeholder="설명" class="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-pink-300 h-20 resize-none">${esc(step.content || '')}</textarea>
            </div>
          `).join('')}
          ${!diagnosis.length ? '<p class="text-xs text-gray-400 italic text-center py-3">단계를 추가해주세요.</p>' : ''}
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider"><i class="fas fa-info-circle mr-1 text-pink-400"></i>주의사항</h4>
          <button onclick="window._consultingAddTip()" class="text-[10px] bg-pink-50 text-pink-500 px-2 py-1 rounded-lg font-bold hover:bg-pink-100"><i class="fas fa-plus mr-1"></i>항목 추가</button>
        </div>
        <div class="space-y-2">
          ${tips.map((t, i) => `
            <div class="flex items-center gap-2">
              <i class="fas fa-circle text-amber-300 text-[6px]"></i>
              <input type="text" value="${esc(t)}" oninput="window._consultingState.draft.tips[${i}]=this.value" class="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-pink-300">
              <button onclick="window._consultingRemoveTip(${i})" class="text-red-400 hover:text-red-600"><i class="fas fa-times"></i></button>
            </div>
          `).join('')}
          ${!tips.length ? '<p class="text-xs text-gray-400 italic text-center py-2">항목을 추가해주세요.</p>' : ''}
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3"><i class="fas fa-comment-dots mr-1 text-pink-400"></i>종합 코멘트</h4>
        <textarea oninput="window._consultingState.draft.summary=this.value" placeholder="컨설팅 종합 의견을 자유롭게 작성하세요..." class="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-pink-300 h-40 resize-none">${esc(d.summary || '')}</textarea>
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider"><i class="fas fa-images mr-1 text-pink-400"></i>참고 이미지 (오픈카톡 캡쳐 / 진행 사진)</h4>
          <label class="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-bold cursor-pointer hover:bg-blue-100">
            <i class="fas fa-plus mr-1"></i>이미지 추가
            <input type="file" accept="image/*" multiple class="hidden" onchange="window._consultingAddAttachments(event)">
          </label>
        </div>
        <p class="text-[10px] text-gray-400 mb-3"><i class="fas fa-info-circle mr-1"></i>파일 선택 시 Cloudflare R2에 자동 업로드 · URL 붙여넣기도 가능 · 종류(카톡/마침/기타) + 캡션 입력</p>
        ${window._consultingRenderAttachmentsEditor(d.attachments)}
      </div>

      ${equipCount > 0 ? (() => {
        const linkingIdx = window._consultingState?.linkingSetIdx;
        const linkingSet = (linkingIdx != null) ? d.goal.sets[linkingIdx] : null;
        return `
      <div id="consultingEquipArea" class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        ${linkingSet ? `
          <div class="sticky top-0 z-20 -m-5 mb-4 px-5 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white flex items-center gap-3 flex-wrap shadow-lg">
            <i class="fas fa-link text-lg"></i>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-black"><strong>"${esc(linkingSet.name || '(이름 없음)')}"</strong> 슬롯 묶는 중</div>
              <div class="text-[10px] opacity-90">아래 장비 카드를 클릭하여 추가/제거 · 현재 ${(linkingSet.items || []).length}개 묶임</div>
            </div>
            <button onclick="window._consultingEndLinkSet()" class="px-3 py-1.5 bg-white text-violet-700 rounded-lg text-xs font-black hover:bg-violet-50 shadow"><i class="fas fa-check mr-1"></i>완료</button>
          </div>
        ` : ''}
        <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2"><i class="fas fa-shield-alt mr-1 text-pink-400"></i>현재 장비 (${equipCount}개)</h4>
        <p class="text-[10px] text-gray-400 mb-3">${linkingSet
          ? `<span class="text-violet-600 font-bold"><i class="fas fa-link mr-1"></i>묶기 모드 — 카드 클릭으로 슬롯 토글</span>`
          : `<i class="fas fa-mouse-pointer mr-1"></i>장비를 클릭하면 교체 목표를 설정할 수 있습니다 ${(d.target_items || []).length > 0 ? `<span class="text-emerald-500 font-bold ml-2">· 현재 ${d.target_items.length}개 교체 목표 설정됨</span>` : ''}`}</p>
        ${window._consultingRenderEquipPreview(d.equipment_data, true, d.target_items)}
      </div>`;
      })() : ''}
    </div>`;
  };

  // 장비 그리드 (메이플 인게임 스타일 간소화 버전)
  // editable=true면 클릭 시 교체 목표 설정 모달
  // 잠재 등급별 색상/축약/테두리 (maplescouter 스타일)
  window._consultingGradeStyle = (g) => {
    if (!g) return { short: '', color: 'text-slate-500', border: 'border-slate-700/50', glow: '' };
    const k = String(g).toLowerCase();
    if (k.includes('레전') || k.includes('legend')) return { short: '레전', color: 'text-lime-400', border: 'border-lime-400/40', glow: 'shadow-[0_0_12px_rgba(163,230,53,0.18)]' };
    if (k.includes('유니') || k.includes('unique')) return { short: '유닠', color: 'text-amber-300', border: 'border-amber-300/40', glow: 'shadow-[0_0_12px_rgba(252,211,77,0.18)]' };
    if (k.includes('에픽') || k.includes('epic')) return { short: '에픽', color: 'text-violet-400', border: 'border-violet-400/40', glow: 'shadow-[0_0_12px_rgba(167,139,250,0.18)]' };
    if (k.includes('레어') || k.includes('rare')) return { short: '레어', color: 'text-sky-400', border: 'border-sky-400/40', glow: '' };
    return { short: g.substring(0, 2), color: 'text-slate-400', border: 'border-slate-700/50', glow: '' };
  };

  // 단일 장비 카드 HTML (재사용)
  window._consultingItemCardHtml = (data, opts = {}) => {
    const isSpecialRing = (data.special_ring_level || 0) > 0;
    const potG = isSpecialRing
      ? { short: '특수', color: 'text-cyan-300', border: 'border-cyan-400/40', glow: 'shadow-[0_0_12px_rgba(103,232,249,0.18)]' }
      : window._consultingGradeStyle(data.pot_grade);
    const addG = window._consultingGradeStyle(data.add_grade);
    const pots = [data.pot_1, data.pot_2, data.pot_3].filter(Boolean);
    const adds = [data.add_1, data.add_2, data.add_3].filter(Boolean);
    const stars = parseInt(data.stars) || 0;
    const upgrade = parseInt(data.upgrade) || 0;
    const slotBadge = opts.slot ? `<span class="text-slate-400 text-[10px] font-bold bg-slate-800/70 px-1.5 py-0.5 rounded">${esc(opts.slot)}</span>` : '';
    const stateBadge = opts.stateBadge || '';
    const onClick = opts.onClick || '';
    const extraCls = opts.extraCls || '';
    const interactive = opts.interactive ? `cursor-pointer hover:bg-slate-900 hover:scale-[1.005] active:scale-100` : '';
    return `<div class="bg-slate-950/60 rounded-lg border ${potG.border} ${potG.glow} p-2 flex gap-2 transition ${interactive} ${extraCls}" ${onClick} title="${esc(opts.title || data.name || '')}">
      <div class="flex-shrink-0 w-11 h-11 bg-slate-900/80 rounded-md border border-slate-700/40 flex items-center justify-center relative">
        ${data.icon ? `<img src="${esc(data.icon)}" class="w-9 h-9" style="image-rendering:pixelated;image-rendering:-moz-crisp-edges;image-rendering:crisp-edges" onerror="this.style.display='none'">` : `<i class="fas fa-image text-slate-600 text-base"></i>`}
        ${stateBadge}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1 text-[10px] mb-0.5 flex-wrap leading-none">
          ${isSpecialRing
            ? `<span class="text-cyan-300 font-black whitespace-nowrap bg-cyan-500/15 px-1 py-0.5 rounded">Lv.${data.special_ring_level}<span class="text-cyan-500/60 text-[9px] ml-0.5">/6</span></span>`
            : `${stars > 0 ? `<span class="text-amber-400 font-black whitespace-nowrap"><i class="fas fa-star text-[8px] mr-0.5"></i>${stars}</span>` : ''}${upgrade > 0 ? `<span class="text-emerald-400 font-black whitespace-nowrap">+${upgrade}</span>` : ''}`}
          ${slotBadge}
        </div>
        <div class="text-white font-bold text-xs truncate leading-tight">${esc(data.name || '-')}</div>
        ${isSpecialRing
          ? `<div class="text-[9px] text-cyan-200/70 leading-tight mt-0.5">특수 반지 · 게임 내 레벨업</div>`
          : `${pots.length ? `<div class="text-[9px] leading-tight mt-0.5"><span class="${potG.color} font-black mr-0.5">${potG.short}</span><span class="text-slate-300">${esc(pots.join(', '))}</span></div>` : ''}
             ${adds.length ? `<div class="text-[9px] leading-tight"><span class="${addG.color} font-black mr-0.5">${addG.short}</span><span class="text-slate-300">${esc(adds.join(', '))}</span></div>` : ''}
             ${(data.add_opts || []).length ? `<div class="text-[9px] leading-tight"><span class="text-cyan-400 font-black mr-0.5">추옵</span><span class="text-slate-400">${esc(data.add_opts.join(' · '))}</span></div>` : ''}
             ${data.soul_name ? `<div class="text-[9px] text-slate-400 mt-0.5 truncate"><span class="text-pink-400 font-black mr-0.5">소울</span>${esc(data.soul_name)}${data.soul_option ? ', ' + esc(data.soul_option) : ''}</div>` : ''}`}
      </div>
    </div>`;
  };

  // 아이템명으로 특수반지 검출 (Nexon API 필드가 없는 외부 데이터에서도 작동)
  window._consultingDetectSpecialRing = (name) => /(컨티뉴어스|리스트레인트|웨폰\s*퍼프|웨퍼)/i.test(name || '');

  // Nexon API 응답 → 카드 데이터 정규화
  window._consultingNormalizeEq = (eq) => {
    const slot = eq.item_equipment_slot || eq.item_equipment_part || '';
    const isSlotSpecial = slot.includes('특수');
    const isNameSpecial = window._consultingDetectSpecialRing(eq.item_name);
    let srLv = parseInt(eq.special_ring_level) || 0;
    // 외부 데이터 (special_ring_level 없음) 보정: 슬롯/이름으로 특수반지 인식되면 최소 1
    if (srLv === 0 && (isSlotSpecial || isNameSpecial)) srLv = 1;
    // 추옵(추가옵션) 수치 정리: JSON의 addStr/addInt 등 또는 Nexon API의 item_add_option 구조
    const ao = eq.item_add_option || {};
    const addOpts = [];
    const aoMap = [
      ['STR', eq.addStr ?? ao.str],
      ['DEX', eq.addDex ?? ao.dex],
      ['INT', eq.addInt ?? ao.int],
      ['LUK', eq.addLuk ?? ao.luk],
      ['올스탯', eq.addAllStat ?? ao.all_stat],
      ['공격력', eq.addAtk ?? ao.attack_power],
      ['마력', eq.addMatk ?? ao.magic_power],
      ['보스', eq.addBossDmg ?? ao.boss_damage, '%'],
      ['데미지', eq.addDmg ?? ao.damage, '%'],
      ['HP', eq.addHp ?? ao.max_hp],
      ['방어', eq.addDef ?? ao.max_hp_rate]
    ];
    for (const [label, val, suffix] of aoMap) {
      const n = parseInt(val) || 0;
      if (n > 0) addOpts.push(`${label}+${n}${suffix || ''}`);
    }
    return {
      name: eq.item_name || '',
      icon: eq.item_icon || '',
      stars: parseInt(eq.starforce) || 0,
      upgrade: parseInt(eq.scroll_upgrade) || 0,
      pot_grade: eq.potential_option_grade || '',
      pot_1: eq.potential_option_1, pot_2: eq.potential_option_2, pot_3: eq.potential_option_3,
      add_grade: eq.additional_potential_option_grade || '',
      add_1: eq.additional_potential_option_1, add_2: eq.additional_potential_option_2, add_3: eq.additional_potential_option_3,
      soul_name: eq.soul_name, soul_option: eq.soul_option,
      special_ring_level: srLv,
      add_opts: addOpts
    };
  };

  window._consultingRenderEquipPreview = (equips, editable, targets) => {
    if (!equips || !equips.length) return '<p class="text-xs text-gray-400 italic">장비 정보 없음</p>';
    const tgtMap = {};
    if (Array.isArray(targets)) targets.forEach(t => { if (t.slot) tgtMap[t.slot] = t; });
    const targetCount = Object.keys(tgtMap).length;
    // 세트 묶기 모드
    const linkingIdx = editable ? window._consultingState?.linkingSetIdx : null;
    const linkingSet = (linkingIdx != null) ? window._consultingState.draft?.goal?.sets?.[linkingIdx] : null;
    const linkedSlots = linkingSet ? new Set(linkingSet.items || []) : new Set();
    const isLinkMode = !!linkingSet;
    return `<div class="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-3 border border-slate-700/50">
      ${editable && targetCount > 0 && !isLinkMode ? `<div class="flex items-center gap-2 mb-3 px-3 py-2 bg-emerald-500/15 border border-emerald-400/30 rounded-lg"><i class="fas fa-bullseye text-emerald-300"></i><span class="text-xs font-bold text-emerald-200">${targetCount}개 교체 목표 설정됨</span><span class="text-[10px] text-emerald-300/70 ml-auto">목표 설정 카드는 초록 테두리 + 🎯 라벨</span></div>` : ''}
      <div class="grid gap-1.5" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
      ${equips.map((eq, idx) => {
        const slot = eq.item_equipment_slot || eq.item_equipment_part || '';
        const hasTarget = !!tgtMap[slot];
        const isLinked = isLinkMode && linkedSlots.has(slot);
        const data = window._consultingNormalizeEq(eq);
        let stateBadge = '';
        let onClick = '';
        let extraCls = '';
        let title = data.name || slot;
        if (isLinkMode) {
          stateBadge = isLinked
            ? '<span class="absolute -top-2 -right-2 px-1.5 py-0.5 bg-violet-500 text-white rounded-md text-[9px] flex items-center gap-0.5 font-black shadow-lg whitespace-nowrap"><i class="fas fa-link text-[8px]"></i>묶임</span>'
            : '<span class="absolute -top-2 -right-2 w-5 h-5 bg-slate-600/80 text-white rounded-full text-[10px] flex items-center justify-center font-black shadow-lg">+</span>';
          onClick = `onclick="window._consultingLinkToggle('${esc(slot).replace(/'/g, "\\'")}')"`;
          extraCls = isLinked ? 'ring-2 ring-violet-400 bg-violet-500/15' : 'hover:ring-2 hover:ring-violet-300/60';
          title = `${slot}${isLinked ? ' · 세트에 묶임 (클릭하여 제거)' : ' (클릭하여 세트에 묶기)'}`;
        } else {
          stateBadge = hasTarget
            ? '<span class="absolute -top-2 -right-2 px-1.5 py-0.5 bg-emerald-500 text-white rounded-md text-[9px] flex items-center gap-0.5 font-black shadow-lg whitespace-nowrap"><i class="fas fa-bullseye text-[8px]"></i>교체</span>'
            : '';
          onClick = editable ? `onclick="window._consultingOpenTarget(${idx})"` : '';
          extraCls = hasTarget && editable ? 'ring-2 ring-emerald-400 bg-emerald-500/10' : '';
          title = `${data.name || slot}${hasTarget ? ' · 교체 목표 설정됨 (다시 클릭하여 수정)' : (editable ? ' (클릭하여 교체 목표 설정)' : '')}`;
        }
        return window._consultingItemCardHtml(data, {
          slot, stateBadge,
          interactive: editable,
          onClick, title, extraCls
        });
      }).join('')}
      </div>
    </div>`;
  };

  // ===== 잠재옵션 드롭다운 시스템 =====
  // 부위 → 등급 → 일반/에디 별 추천 옵션 목록
  // SITE_CONFIG.potentialOptions에 저장. 관리자가 편집 가능.
  window._consultingDefaultPotentials = {
    weapon: {
      legendary: { regular: ['보스 데미지 +40%','보스 데미지 +35%','보스 데미지 +30%','데미지 +12%','공격력 +12%','마력 +12%','크리티컬 데미지 +8%','몬스터 방어율 무시 +40%','STR +13%','DEX +13%','INT +13%','LUK +13%','올스탯 +9%'],
                  additional: ['보스 데미지 +20%','데미지 +12%','공격력 +12%','마력 +12%','STR +9%','DEX +9%','INT +9%','LUK +9%','올스탯 +6%','크리티컬 확률 +1%'] },
      unique: { regular: ['보스 데미지 +30%','보스 데미지 +25%','데미지 +9%','공격력 +9%','마력 +9%','몬스터 방어율 무시 +30%','STR +10%','DEX +10%','INT +10%','LUK +10%','올스탯 +6%'],
                additional: ['보스 데미지 +12%','데미지 +9%','공격력 +9%','마력 +9%','STR +7%','DEX +7%','INT +7%','LUK +7%','올스탯 +4%'] },
      epic: { regular: ['보스 데미지 +20%','데미지 +6%','공격력 +6%','마력 +6%','STR +7%','DEX +7%','INT +7%','LUK +7%','올스탯 +3%'],
              additional: ['공격력 +6%','마력 +6%','STR +4%','DEX +4%','INT +4%','LUK +4%'] }
    },
    glove: {
      legendary: { regular: ['크리티컬 데미지 +8%','크리티컬 데미지 +6%','크리티컬 데미지 +5%','STR +13%','DEX +13%','INT +13%','LUK +13%','올스탯 +9%'],
                  additional: ['크리티컬 데미지 +1%','STR +9%','DEX +9%','INT +9%','LUK +9%','올스탯 +6%'] },
      unique: { regular: ['크리티컬 데미지 +5%','크리티컬 데미지 +4%','STR +10%','DEX +10%','INT +10%','LUK +10%','올스탯 +6%'],
                additional: ['STR +7%','DEX +7%','INT +7%','LUK +7%','올스탯 +4%'] },
      epic: { regular: ['STR +7%','DEX +7%','INT +7%','LUK +7%','올스탯 +3%'],
              additional: ['STR +4%','DEX +4%','INT +4%','LUK +4%'] }
    },
    armor: {
      legendary: { regular: ['STR +13%','DEX +13%','INT +13%','LUK +13%','올스탯 +9%','최대 HP +13%','모든 스킬의 재사용 대기시간 -2초','모든 스킬의 재사용 대기시간 -1초'],
                  additional: ['STR +9%','DEX +9%','INT +9%','LUK +9%','올스탯 +6%','최대 HP +9%','모든 스킬의 재사용 대기시간 -1초','크리티컬 데미지 +1%'] },
      unique: { regular: ['STR +10%','DEX +10%','INT +10%','LUK +10%','올스탯 +6%','최대 HP +10%'],
                additional: ['STR +7%','DEX +7%','INT +7%','LUK +7%','올스탯 +4%','최대 HP +7%'] },
      epic: { regular: ['STR +7%','DEX +7%','INT +7%','LUK +7%','올스탯 +3%','최대 HP +7%'],
              additional: ['STR +4%','DEX +4%','INT +4%','LUK +4%'] }
    },
    accessory: {
      legendary: { regular: ['STR +13%','DEX +13%','INT +13%','LUK +13%','올스탯 +9%','공격력 +12%','마력 +12%'],
                  additional: ['STR +9%','DEX +9%','INT +9%','LUK +9%','올스탯 +6%','크리티컬 데미지 +1%'] },
      unique: { regular: ['STR +10%','DEX +10%','INT +10%','LUK +10%','올스탯 +6%','공격력 +9%','마력 +9%'],
                additional: ['STR +7%','DEX +7%','INT +7%','LUK +7%','올스탯 +4%'] },
      epic: { regular: ['STR +7%','DEX +7%','INT +7%','LUK +7%','올스탯 +3%'],
              additional: ['STR +4%','DEX +4%','INT +4%','LUK +4%'] }
    },
    etc: {
      legendary: { regular: ['STR +13%','DEX +13%','INT +13%','LUK +13%','올스탯 +9%'], additional: ['STR +9%','DEX +9%','INT +9%','LUK +9%','올스탯 +6%'] },
      unique: { regular: ['STR +10%','DEX +10%','INT +10%','LUK +10%','올스탯 +6%'], additional: ['STR +7%','DEX +7%','INT +7%','LUK +7%','올스탯 +4%'] },
      epic: { regular: ['STR +7%','DEX +7%','INT +7%','LUK +7%','올스탯 +3%'], additional: ['STR +4%','DEX +4%','INT +4%','LUK +4%'] }
    }
  };

  window._consultingGetSlotCategory = (slot) => {
    if (!slot) return 'armor';
    const s = String(slot).replace(/\s/g, '');
    if (['무기','보조무기','엠블렘'].some(k => s.includes(k))) return 'weapon';
    if (s.includes('장갑')) return 'glove';
    if (['모자','상의','하의','신발','망토','어깨장식','어깨'].some(k => s.includes(k))) return 'armor';
    if (['반지','펜던트','벨트','귀고리','눈장식','얼굴장식'].some(k => s.includes(k))) return 'accessory';
    return 'etc';
  };

  window._consultingGradeKey = (grade) => {
    if (!grade) return 'legendary';
    const g = String(grade).toLowerCase();
    if (g.includes('레전') || g.includes('legend')) return 'legendary';
    if (g.includes('유니크') || g.includes('unique')) return 'unique';
    if (g.includes('에픽') || g.includes('epic')) return 'epic';
    return 'rare';
  };

  // 옵션 목록 가져오기 (SITE_CONFIG 우선, 없으면 default)
  window._consultingGetPotOptions = (slot, grade, isAdditional) => {
    const cfg = SITE_CONFIG?.potentialOptions || window._consultingDefaultPotentials;
    const cat = window._consultingGetSlotCategory(slot);
    const gKey = window._consultingGradeKey(grade);
    const type = isAdditional ? 'additional' : 'regular';
    const opts = cfg?.[cat]?.[gKey]?.[type];
    if (Array.isArray(opts) && opts.length) return opts;
    // 폴백
    return window._consultingDefaultPotentials[cat]?.[gKey]?.[type] || [];
  };

  // 잠재 드롭다운 렌더 (직접 입력 토글 포함)
  window._consultingPotDropdown = (field, val, slot, grade, isAdditional) => {
    const opts = window._consultingGetPotOptions(slot, grade, isAdditional);
    const isCustom = val === '__custom' || (val && !opts.includes(val) && val !== '');
    const inputVal = val === '__custom' ? '' : (val || '');
    return `<div class="flex gap-1">
      <select onchange="window._consultingUpdateTarget('${field}',this.value);window._consultingShowTargetModal();window._consultingFocusCustom('${field}')" class="text-xs bg-white border border-gray-200 rounded px-1.5 py-1 ${isCustom ? 'w-24 shrink-0' : 'flex-1 min-w-0'}">
        <option value="">선택...</option>
        ${opts.map(o => `<option value="${esc(o)}" ${val===o?'selected':''}>${esc(o)}</option>`).join('')}
        <option value="__custom" ${isCustom?'selected':''}>✏ 직접 입력</option>
      </select>
      ${isCustom ? `<input type="text" value="${esc(inputVal)}" oninput="window._consultingUpdateTarget('${field}',this.value)" placeholder="직접 입력" class="text-xs flex-1 min-w-0 bg-white border border-gray-200 rounded px-2 py-1" data-pot-custom="${field}">` : ''}
    </div>`;
  };

  window._consultingFocusCustom = (field) => {
    requestAnimationFrame(() => {
      const inp = document.querySelector(`#_consultingTargetModal [data-pot-custom="${field}"]`);
      if (inp) inp.focus();
    });
  };

  // ===== 잠재 옵션 관리 모달 (관리자 전용) =====
  window._consultingOpenPotEditor = () => {
    if (!isAdmin()) return;
    if (!window._consultingPotEditState) window._consultingPotEditState = { cat: 'weapon', grade: 'legendary' };
    window._consultingShowPotEditor();
  };

  window._consultingShowPotEditor = () => {
    const cfg = SITE_CONFIG || {};
    if (!cfg.potentialOptions) cfg.potentialOptions = JSON.parse(JSON.stringify(window._consultingDefaultPotentials));

    const st = window._consultingPotEditState;
    const cats = [
      { key: 'weapon', label: '무기/보조/엠블' },
      { key: 'glove', label: '장갑' },
      { key: 'armor', label: '방어구' },
      { key: 'accessory', label: '악세서리' },
      { key: 'etc', label: '기타' }
    ];
    const grades = [
      { key: 'legendary', label: '레전드리', color: '#7ec850' },
      { key: 'unique', label: '유니크', color: '#f0c040' },
      { key: 'epic', label: '에픽', color: '#b070e0' }
    ];

    const curList = cfg.potentialOptions[st.cat]?.[st.grade] || { regular: [], additional: [] };

    const old = document.getElementById('_consultingPotEditorModal');
    if (old) old.remove();

    const div = document.createElement('div');
    div.id = '_consultingPotEditorModal';
    div.className = 'fixed inset-0 z-50 flex items-start justify-center p-4 pt-8';
    div.style.background = 'rgba(0,0,0,0.5)';
    div.style.backdropFilter = 'blur(4px)';
    div.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
        <div class="p-5 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 class="text-base font-black text-purple-500"><i class="fas fa-cog mr-2"></i>잠재 옵션 메뉴 편집</h3>
          <button onclick="window._consultingClosePotEditor()" class="text-gray-400 hover:text-gray-700"><i class="fas fa-times"></i></button>
        </div>
        <div class="p-5 space-y-4">
          <p class="text-[11px] text-gray-500"><i class="fas fa-info-circle mr-1"></i>각 부위/등급별 잠재 옵션 드롭다운에 표시될 항목을 관리합니다. 저장 후 즉시 반영됩니다.</p>

          <div>
            <div class="text-[10px] font-bold text-gray-500 uppercase mb-2">부위 카테고리</div>
            <div class="flex gap-1.5 flex-wrap">
              ${cats.map(c => `<button onclick="window._consultingPotEditState.cat='${c.key}';window._consultingShowPotEditor()" class="px-3 py-1.5 rounded-lg text-[11px] font-bold ${st.cat===c.key?'bg-purple-500 text-white shadow':'bg-gray-100 text-gray-500 hover:bg-gray-200'}">${c.label}</button>`).join('')}
            </div>
          </div>

          <div>
            <div class="text-[10px] font-bold text-gray-500 uppercase mb-2">등급</div>
            <div class="flex gap-1.5 flex-wrap">
              ${grades.map(g => `<button onclick="window._consultingPotEditState.grade='${g.key}';window._consultingShowPotEditor()" class="px-3 py-1.5 rounded-lg text-[11px] font-bold ${st.grade===g.key?'text-white shadow':'bg-gray-100 text-gray-500 hover:bg-gray-200'}" ${st.grade===g.key?'style="background:'+g.color+'"':''}>${g.label}</button>`).join('')}
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-gray-100">
            ${[{key:'regular',label:'일반 잠재',color:'pink'},{key:'additional',label:'에디셔널 잠재',color:'cyan'}].map(typ => {
              const list = curList[typ.key] || [];
              return `
                <div class="bg-${typ.color}-50 rounded-xl p-3 border border-${typ.color}-100">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-black text-${typ.color}-500 uppercase">${typ.label}</span>
                    <span class="text-[10px] text-gray-400">${list.length}개</span>
                  </div>
                  <div class="space-y-1.5 max-h-80 overflow-y-auto">
                    ${list.map((opt, i) => `
                      <div class="flex items-center gap-1.5 bg-white rounded px-2 py-1 border border-gray-100">
                        <input type="text" value="${esc(opt)}" oninput="window._consultingPotEditUpdate('${typ.key}',${i},this.value)" class="flex-1 text-[11px] outline-none">
                        <button onclick="window._consultingPotEditRemove('${typ.key}',${i})" class="text-red-400 hover:text-red-600 text-[11px]"><i class="fas fa-times"></i></button>
                      </div>
                    `).join('')}
                    <button onclick="window._consultingPotEditAdd('${typ.key}')" class="w-full mt-2 px-2 py-1.5 bg-white border border-dashed border-gray-300 rounded text-[10px] font-bold text-gray-400 hover:border-${typ.color}-300 hover:text-${typ.color}-500"><i class="fas fa-plus mr-1"></i>옵션 추가</button>
                  </div>
                </div>`;
            }).join('')}
          </div>

          <div class="bg-amber-50 border border-amber-100 rounded-lg p-3">
            <p class="text-[10px] text-amber-700 font-bold"><i class="fas fa-exclamation-triangle mr-1"></i>⚠ 변경사항은 "저장" 버튼을 눌러야 적용됩니다.</p>
          </div>
        </div>
        <div class="p-5 border-t border-gray-100 flex gap-2 sticky bottom-0 bg-white">
          <button onclick="window._consultingPotEditReset()" class="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-200"><i class="fas fa-undo mr-1"></i>기본값 복원</button>
          <button onclick="window._consultingClosePotEditor()" class="ml-auto px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-300">취소</button>
          <button onclick="window._consultingSavePotEditor()" class="px-6 py-2 bg-pink-500 text-white rounded-lg text-xs font-bold shadow hover:bg-pink-600"><i class="fas fa-save mr-1"></i>저장</button>
        </div>
      </div>`;
    div.onclick = () => window._consultingClosePotEditor();
    document.body.appendChild(div);
  };

  window._consultingPotEditUpdate = (type, idx, val) => {
    const cfg = SITE_CONFIG;
    const st = window._consultingPotEditState;
    if (!cfg?.potentialOptions?.[st.cat]?.[st.grade]?.[type]) return;
    cfg.potentialOptions[st.cat][st.grade][type][idx] = val;
  };
  window._consultingPotEditAdd = (type) => {
    const cfg = SITE_CONFIG;
    const st = window._consultingPotEditState;
    if (!cfg.potentialOptions[st.cat]) cfg.potentialOptions[st.cat] = {};
    if (!cfg.potentialOptions[st.cat][st.grade]) cfg.potentialOptions[st.cat][st.grade] = {};
    if (!Array.isArray(cfg.potentialOptions[st.cat][st.grade][type])) cfg.potentialOptions[st.cat][st.grade][type] = [];
    cfg.potentialOptions[st.cat][st.grade][type].push('');
    window._consultingShowPotEditor();
  };
  window._consultingPotEditRemove = (type, idx) => {
    const cfg = SITE_CONFIG;
    const st = window._consultingPotEditState;
    cfg.potentialOptions[st.cat][st.grade][type].splice(idx, 1);
    window._consultingShowPotEditor();
  };
  window._consultingPotEditReset = () => {
    if (!confirm('이 부위/등급의 옵션을 기본값으로 되돌리시겠습니까?')) return;
    const cfg = SITE_CONFIG;
    const st = window._consultingPotEditState;
    cfg.potentialOptions[st.cat][st.grade] = JSON.parse(JSON.stringify(window._consultingDefaultPotentials[st.cat][st.grade]));
    window._consultingShowPotEditor();
  };
  window._consultingSavePotEditor = async () => {
    try {
      // 빈 옵션 제거
      const cfg = SITE_CONFIG;
      Object.keys(cfg.potentialOptions || {}).forEach(cat => {
        Object.keys(cfg.potentialOptions[cat] || {}).forEach(grade => {
          ['regular','additional'].forEach(type => {
            if (Array.isArray(cfg.potentialOptions[cat][grade]?.[type])) {
              cfg.potentialOptions[cat][grade][type] = cfg.potentialOptions[cat][grade][type].filter(o => o && o.trim());
            }
          });
        });
      });
      await supaDb.from('site_config').update({ config: cfg, updated_at: new Date().toISOString() }).eq('id', _cfgId);
      window.showMsg('저장 완료!', 'success');
      window._consultingClosePotEditor();
      // 작성 모달이 열려있으면 다시 렌더 (옵션 반영)
      if (document.getElementById('_consultingTargetModal')) window._consultingShowTargetModal();
    } catch (e) {
      window.showMsg('저장 실패: ' + e.message, 'error');
    }
  };
  window._consultingClosePotEditor = () => {
    const m = document.getElementById('_consultingPotEditorModal');
    if (m) m.remove();
  };

  // 교체 목표 설정 모달 (관리자가 작성 폼에서 장비 클릭 시)
  window._consultingOpenTarget = (equipIdx) => {
    const d = window._consultingState.draft;
    if (!d || !Array.isArray(d.equipment_data)) return;
    const eq = d.equipment_data[equipIdx];
    if (!eq) return;
    const slot = eq.item_equipment_slot || eq.item_equipment_part || '';

    // 기존 target 찾기
    if (!Array.isArray(d.target_items)) d.target_items = [];
    let existing = d.target_items.find(t => t.slot === slot);
    if (!existing) {
      const srLv = parseInt(eq.special_ring_level) || 0;
      existing = {
        slot,
        before_name: eq.item_name || '',
        before_icon: eq.item_icon || '',
        before_stars: parseInt(eq.starforce) || 0,
        before_special_ring_level: srLv,
        after_name: eq.item_name || '',
        after_icon: eq.item_icon || '',
        after_stars: parseInt(eq.starforce) || 0,
        after_special_ring_level: srLv > 0 ? Math.min(6, srLv + 1) : 0,
        after_pot_grade: '',
        after_pot_1: '', after_pot_2: '', after_pot_3: '',
        after_add_grade: '',
        after_add_1: '', after_add_2: '', after_add_3: '',
        hexa_contrib: 0,
        cost: ''
      };
      d.target_items.push(existing);
    }
    window._consultingTargetEditingSlot = slot;
    window._consultingShowTargetModal();
  };

  window._consultingShowTargetModal = () => {
    const d = window._consultingState.draft;
    const slot = window._consultingTargetEditingSlot;
    const t = d.target_items.find(x => x.slot === slot);
    if (!t) return;

    const old = document.getElementById('_consultingTargetModal');
    if (old) old.remove();

    const grades = ['','레전드리','유니크','에픽','레어'];
    const gradeOpts = (cur) => grades.map(g => `<option value="${g}" ${(cur||'')===g?'selected':''}>${g||'없음'}</option>`).join('');

    // 특수 반지 여부 판정: special_ring_level 필드 + 슬롯명("예비 특수 반지") + 아이템명(컨티뉴어스/리스트레인트/웨폰퍼프)
    const eqLookup = (d.equipment_data || []).find(e => (e.item_equipment_slot || e.item_equipment_part) === slot);
    const eqLv = parseInt(eqLookup?.special_ring_level) || 0;
    const tLv = parseInt(t.before_special_ring_level) || 0;
    const isSlotSpecial = (slot || '').includes('특수');
    const isNameSpecial = window._consultingDetectSpecialRing(eqLookup?.item_name) || window._consultingDetectSpecialRing(t.before_name) || window._consultingDetectSpecialRing(t.after_name);
    const isSpecialRing = eqLv > 0 || tLv > 0 || isSlotSpecial || isNameSpecial;
    const beforeSrLv = eqLv || tLv || (isSpecialRing ? 1 : 0);
    const lvOpts = (cur) => Array.from({length: 7}, (_, i) => `<option value="${i}" ${Number(cur||0)===i?'selected':''}>${i === 0 ? '미장착' : 'Lv.' + i}</option>`).join('');

    const div = document.createElement('div');
    div.id = '_consultingTargetModal';
    div.className = 'fixed inset-0 z-50 flex items-start justify-center p-4 pt-8';
    div.style.background = 'rgba(0,0,0,0.5)';
    div.style.backdropFilter = 'blur(4px)';
    div.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
        <div class="p-5 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
          <h3 class="text-base font-black text-pink-500"><i class="fas fa-bullseye mr-2"></i>${esc(slot)} 교체 목표</h3>
          <div class="flex gap-2">
            <button onclick="window._consultingOpenPotEditor()" class="text-[10px] bg-purple-50 text-purple-600 px-2 py-1 rounded-lg font-bold hover:bg-purple-100" title="옵션 메뉴판 편집"><i class="fas fa-cog mr-1"></i>옵션 메뉴 편집</button>
            <button onclick="window._consultingCloseTargetModal()" class="text-gray-400 hover:text-gray-700"><i class="fas fa-times"></i></button>
          </div>
        </div>
        <div class="p-5 space-y-4">
          <div class="bg-red-50 p-3 rounded-xl">
            <div class="text-[10px] text-red-500 font-black uppercase mb-2">BEFORE (현재)${isSpecialRing ? ' · 특수 반지' : ''}</div>
            <div class="flex gap-3">
              <div class="flex-shrink-0 w-14 h-14 bg-white rounded border-2 border-red-200 flex items-center justify-center">
                ${t.before_icon ? `<img src="${esc(t.before_icon)}" class="w-12 h-12" style="image-rendering:pixelated">` : '<i class="fas fa-image text-gray-300 text-lg"></i>'}
              </div>
              <div class="flex-1 grid grid-cols-2 gap-2">
                <div><label class="text-[10px] text-gray-500 font-bold">아이템</label><input type="text" value="${esc(t.before_name)}" oninput="window._consultingUpdateTarget('before_name',this.value)" class="w-full mt-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs"></div>
                ${isSpecialRing
                  ? `<div><label class="text-[10px] text-cyan-500 font-bold">현재 레벨</label><select onchange="window._consultingUpdateTarget('before_special_ring_level',Number(this.value))" class="w-full mt-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs">${lvOpts(beforeSrLv)}</select></div>`
                  : `<div><label class="text-[10px] text-gray-500 font-bold">스타포스</label><input type="number" value="${t.before_stars||0}" oninput="window._consultingUpdateTarget('before_stars',Number(this.value))" class="w-full mt-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs"></div>`}
              </div>
            </div>
          </div>

          <div class="bg-emerald-50 p-3 rounded-xl space-y-3">
            <div class="flex items-center justify-between">
              <div class="text-[10px] text-emerald-500 font-black uppercase">AFTER (목표)${isSpecialRing ? ' · 특수 반지' : ''}</div>
              <button type="button" onclick="window._consultingOpenImportFromUser()" class="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-bold hover:bg-blue-100 transition" title="다른 유저의 같은 슬롯 장비를 통째로 복사"><i class="fas fa-user-plus mr-1"></i>다른 캐릭터에서 가져오기</button>
            </div>
            <div class="flex gap-3">
              <div class="flex-shrink-0">
                <button type="button" onclick="window._consultingChangeAfterIcon()" class="w-14 h-14 bg-white rounded border-2 border-emerald-300 hover:border-emerald-500 flex items-center justify-center cursor-pointer transition group" title="클릭하여 아이콘 변경">
                  ${t.after_icon ? `<img src="${esc(t.after_icon)}" class="w-12 h-12 group-hover:opacity-70" style="image-rendering:pixelated">` : '<i class="fas fa-image text-emerald-300 text-lg group-hover:text-emerald-500"></i>'}
                </button>
                <div class="text-[8px] text-center text-emerald-600 font-bold mt-1">아이콘 변경</div>
              </div>
              <div class="flex-1 grid grid-cols-2 gap-2">
                <div><label class="text-[10px] text-gray-500 font-bold">아이템명</label><input type="text" value="${esc(t.after_name)}" oninput="window._consultingUpdateTarget('after_name',this.value)" class="w-full mt-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs"></div>
                ${isSpecialRing
                  ? `<div><label class="text-[10px] text-cyan-500 font-bold">목표 레벨</label><select onchange="window._consultingUpdateTarget('after_special_ring_level',Number(this.value))" class="w-full mt-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs">${lvOpts(t.after_special_ring_level||0)}</select></div>`
                  : `<div><label class="text-[10px] text-gray-500 font-bold">스타포스</label><input type="number" value="${t.after_stars||0}" oninput="window._consultingUpdateTarget('after_stars',Number(this.value))" class="w-full mt-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs"></div>`}
              </div>
            </div>

            ${isSpecialRing ? `
            <div class="bg-cyan-50 border border-cyan-100 rounded p-2.5 text-[10px] text-cyan-700 leading-relaxed">
              <i class="fas fa-info-circle mr-1 text-cyan-500"></i>특수 반지(컨티뉴어스/리스트레인트/웨폰퍼프)는 레벨 1~6 게임 내 강화입니다. 잠재 옵션 없음.
            </div>
            ` : `
            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] text-purple-500 font-black uppercase">잠재능력</span>
                <select onchange="window._consultingUpdateTarget('after_pot_grade',this.value);window._consultingShowTargetModal()" class="bg-white border border-gray-200 rounded px-2 py-0.5 text-[10px]">${gradeOpts(t.after_pot_grade)}</select>
              </div>
              <div class="space-y-1">
                ${window._consultingPotDropdown('after_pot_1', t.after_pot_1, slot, t.after_pot_grade, false)}
                ${window._consultingPotDropdown('after_pot_2', t.after_pot_2, slot, t.after_pot_grade, false)}
                ${window._consultingPotDropdown('after_pot_3', t.after_pot_3, slot, t.after_pot_grade, false)}
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <span class="text-[10px] text-cyan-500 font-black uppercase">에디셔널</span>
                <select onchange="window._consultingUpdateTarget('after_add_grade',this.value);window._consultingShowTargetModal()" class="bg-white border border-gray-200 rounded px-2 py-0.5 text-[10px]">${gradeOpts(t.after_add_grade)}</select>
              </div>
              <div class="space-y-1">
                ${window._consultingPotDropdown('after_add_1', t.after_add_1, slot, t.after_add_grade, true)}
                ${window._consultingPotDropdown('after_add_2', t.after_add_2, slot, t.after_add_grade, true)}
                ${window._consultingPotDropdown('after_add_3', t.after_add_3, slot, t.after_add_grade, true)}
              </div>
            </div>`}

            <div class="pt-2 border-t border-emerald-200">
              <label class="text-[10px] text-cyan-600 font-bold">추옵 (추가옵션) 목표</label>
              <input type="text" value="${esc(t.after_add_tier || '')}" oninput="window._consultingUpdateTarget('after_add_tier',this.value)" placeholder="예: 85급, 100급, INT 80~100, 풀추옵 등" class="w-full mt-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs">
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div><label class="text-[10px] text-amber-500 font-bold">헥사 환산 기여</label><input type="number" value="${t.hexa_contrib||0}" oninput="window._consultingUpdateTarget('hexa_contrib',Number(this.value))" placeholder="예: 1500" class="w-full mt-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs"></div>
              <div><label class="text-[10px] text-amber-500 font-bold">예상 비용</label><input type="text" value="${esc(t.cost)}" oninput="window._consultingUpdateTarget('cost',this.value)" placeholder="예: 30억" class="w-full mt-1 bg-white border border-gray-200 rounded px-2 py-1 text-xs"></div>
            </div>
          </div>
        </div>
        <div class="p-5 border-t border-gray-100 flex gap-2 sticky bottom-0 bg-white">
          <button onclick="window._consultingRemoveTarget()" class="px-4 py-2 bg-red-100 text-red-500 rounded-lg text-xs font-bold hover:bg-red-200"><i class="fas fa-trash mr-1"></i>이 목표 제거</button>
          <button onclick="window._consultingCloseTargetModal()" class="ml-auto px-6 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600"><i class="fas fa-check mr-1"></i>완료</button>
        </div>
      </div>`;
    div.onclick = () => window._consultingCloseTargetModal();
    document.body.appendChild(div);
  };

  window._consultingUpdateTarget = (field, value) => {
    const d = window._consultingState.draft;
    const slot = window._consultingTargetEditingSlot;
    const t = d.target_items.find(x => x.slot === slot);
    if (t) t[field] = value;
  };

  window._consultingRemoveTarget = () => {
    const d = window._consultingState.draft;
    const slot = window._consultingTargetEditingSlot;
    d.target_items = d.target_items.filter(x => x.slot !== slot);
    window._consultingCloseTargetModal();
    window.renderConsulting(document.getElementById('contentArea'));
  };

  window._consultingCloseTargetModal = () => {
    const m = document.getElementById('_consultingTargetModal');
    if (m) m.remove();
    window._consultingTargetEditingSlot = null;
    window.renderConsulting(document.getElementById('contentArea'));
  };

  // After 아이콘 변경 (URL / 파일 / 현재 장비 / 메이플 아이템 검색)
  window._consultingChangeAfterIcon = () => {
    const old = document.getElementById('_consultingIconModal');
    if (old) old.remove();
    const div = document.createElement('div');
    div.id = '_consultingIconModal';
    div.className = 'fixed inset-0 z-[60] flex items-center justify-center p-4';
    div.style.background = 'rgba(0,0,0,0.6)';
    div.style.backdropFilter = 'blur(4px)';
    div.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5" onclick="event.stopPropagation()">
        <h3 class="text-sm font-black text-emerald-600 mb-4"><i class="fas fa-image mr-2"></i>AFTER 아이콘 변경</h3>
        <div class="space-y-3">
          <div>
            <label class="text-[10px] text-gray-500 font-bold">이미지 URL 직접 입력</label>
            <div class="flex gap-1 mt-1">
              <input id="_consultingIconUrl" type="text" placeholder="https://open.api.nexon.com/static/..." class="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs">
              <button onclick="window._consultingApplyIconUrl()" class="px-3 py-1.5 bg-emerald-500 text-white rounded text-xs font-bold hover:bg-emerald-600">적용</button>
            </div>
            <p class="text-[9px] text-gray-400 mt-1">메이플 아이템 위키/공홈에서 이미지 우클릭 → 주소 복사</p>
          </div>
          <div class="border-t border-gray-100"></div>
          <label class="block">
            <span class="block w-full px-3 py-2 bg-blue-50 text-blue-600 rounded text-xs font-bold text-center cursor-pointer hover:bg-blue-100"><i class="fas fa-upload mr-1"></i>파일 업로드 (PNG, 200KB 이하)</span>
            <input type="file" accept="image/*" class="hidden" onchange="window._consultingUploadIcon(event)">
          </label>
          <div class="border-t border-gray-100"></div>
          <button onclick="window._consultingResetIconToBefore()" class="w-full px-3 py-1.5 bg-slate-100 text-slate-600 rounded text-xs font-bold hover:bg-slate-200"><i class="fas fa-undo mr-1"></i>현재 장비 아이콘으로 되돌리기</button>
        </div>
        <button onclick="document.getElementById('_consultingIconModal').remove()" class="w-full mt-4 px-3 py-1.5 bg-gray-100 text-gray-500 rounded text-xs font-bold hover:bg-gray-200">취소</button>
      </div>`;
    div.onclick = () => div.remove();
    document.body.appendChild(div);
    setTimeout(() => document.getElementById('_consultingIconUrl')?.focus(), 50);
  };

  window._consultingApplyIconUrl = () => {
    const url = document.getElementById('_consultingIconUrl')?.value.trim();
    if (!url) { window.showMsg('URL을 입력해주세요', 'error'); return; }
    window._consultingUpdateTarget('after_icon', url);
    document.getElementById('_consultingIconModal')?.remove();
    window._consultingShowTargetModal();
  };

  window._consultingUploadIcon = (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) { window.showMsg('200KB 이하 이미지만 가능', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      window._consultingUpdateTarget('after_icon', reader.result);
      document.getElementById('_consultingIconModal')?.remove();
      window._consultingShowTargetModal();
    };
    reader.readAsDataURL(file);
  };

  window._consultingResetIconToBefore = () => {
    const d = window._consultingState.draft;
    const slot = window._consultingTargetEditingSlot;
    const eq = (d.equipment_data || []).find(e => (e.item_equipment_slot || e.item_equipment_part) === slot);
    const icon = eq?.item_icon || '';
    if (!icon) { window.showMsg('현재 장비 아이콘이 없습니다', 'error'); return; }
    window._consultingUpdateTarget('after_icon', icon);
    document.getElementById('_consultingIconModal')?.remove();
    window._consultingShowTargetModal();
  };

  // ===== 다른 캐릭터의 같은 슬롯 장비를 AFTER로 통째 복사 =====
  window._consultingOpenImportFromUser = () => {
    const slot = window._consultingTargetEditingSlot;
    const old = document.getElementById('_consultingImportModal');
    if (old) old.remove();
    const div = document.createElement('div');
    div.id = '_consultingImportModal';
    div.className = 'fixed inset-0 z-[60] flex items-center justify-center p-4';
    div.style.background = 'rgba(0,0,0,0.6)';
    div.style.backdropFilter = 'blur(4px)';
    div.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5" onclick="event.stopPropagation()">
        <h3 class="text-sm font-black text-blue-600 mb-1"><i class="fas fa-user-plus mr-2"></i>다른 캐릭터에서 ${esc(slot)} 가져오기</h3>
        <p class="text-[10px] text-gray-400 mb-4">목표로 삼을 풀템 유저의 캐릭명을 입력하면 같은 슬롯 장비를 통째로 복사합니다. 옵션은 가져온 후 손보세요.</p>
        <div class="space-y-3">
          <div class="flex gap-1">
            <input id="_consultingImportName" type="text" placeholder="캐릭터명 입력" class="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs" onkeydown="if(event.key==='Enter')window._consultingImportSearch()">
            <button onclick="window._consultingImportSearch()" id="_consultingImportSearchBtn" class="px-3 py-1.5 bg-blue-500 text-white rounded text-xs font-bold hover:bg-blue-600 disabled:opacity-50">검색</button>
          </div>
          <div id="_consultingImportResult" class="min-h-[40px]"></div>
        </div>
        <button onclick="document.getElementById('_consultingImportModal').remove()" class="w-full mt-4 px-3 py-1.5 bg-gray-100 text-gray-500 rounded text-xs font-bold hover:bg-gray-200">취소</button>
      </div>`;
    div.onclick = () => div.remove();
    document.body.appendChild(div);
    setTimeout(() => document.getElementById('_consultingImportName')?.focus(), 50);
  };

  // 슬롯 매칭 후보 (반지/펜던트는 카테고리 전체)
  window._consultingSlotCandidates = (slot) => {
    if (!slot) return [slot];
    if (/^반지\d?$/.test(slot)) return ['반지1','반지2','반지3','반지4'];
    if (/^펜던트\d?$/.test(slot)) return ['펜던트','펜던트2'];
    return [slot];
  };

  // 프리셋 점수 계산 (별 + 강화 + 잠재 등급 가중치) — 보스 프리셋이 보통 점수 높음
  window._consultingPresetScore = (items) => {
    if (!Array.isArray(items)) return 0;
    let score = 0;
    for (const eq of items) {
      score += parseInt(eq.starforce) || 0;
      score += parseInt(eq.scroll_upgrade) || 0;
      const g = (eq.potential_option_grade || '').toLowerCase();
      if (g.includes('레전') || g.includes('legend')) score += 12;
      else if (g.includes('유니') || g.includes('unique')) score += 6;
      else if (g.includes('에픽') || g.includes('epic')) score += 2;
      const ag = (eq.additional_potential_option_grade || '').toLowerCase();
      if (ag.includes('레전') || ag.includes('legend')) score += 10;
      else if (ag.includes('유니') || ag.includes('unique')) score += 5;
      else if (ag.includes('에픽') || ag.includes('epic')) score += 1;
    }
    return score;
  };

  // preset_no~3 + legacy 합쳐서 슬롯 합치기 (preset 단위)
  window._consultingMergePresetWithLegacy = (equipData, presetNo) => {
    const preset = equipData[`item_equipment_preset_${presetNo}`] || [];
    const legacy = equipData.item_equipment || [];
    const presetSlots = new Set(preset.map(e => e.item_equipment_slot || e.item_equipment_part));
    const extras = legacy.filter(e => !presetSlots.has(e.item_equipment_slot || e.item_equipment_part));
    return preset.length ? [...preset, ...extras] : legacy;
  };

  // 가장 강한 프리셋 자동 선택 + 점수 같이 반환
  window._consultingPickBestPreset = (equipData) => {
    const presets = [1,2,3].map(n => {
      const items = equipData[`item_equipment_preset_${n}`] || [];
      return { no: n, items, score: window._consultingPresetScore(items) };
    });
    const valid = presets.filter(p => p.items.length > 0);
    const fallbackNo = Number(equipData.preset_no) || 1;
    if (!valid.length) return { bestNo: fallbackNo, scores: presets };
    valid.sort((a,b) => b.score - a.score);
    return { bestNo: valid[0].no, scores: presets };
  };

  window._consultingImportSearch = async () => {
    const slot = window._consultingTargetEditingSlot;
    const name = document.getElementById('_consultingImportName')?.value.trim();
    if (!name) { window.showMsg('캐릭터명을 입력해주세요', 'error'); return; }
    const btn = document.getElementById('_consultingImportSearchBtn');
    const result = document.getElementById('_consultingImportResult');
    if (btn) { btn.disabled = true; btn.textContent = '검색 중...'; }
    if (result) result.innerHTML = '<div class="text-center py-3 text-gray-400 text-xs"><i class="fas fa-spinner fa-spin mr-1"></i>장비 정보 가져오는 중...</div>';
    try {
      const idRes = await window._nexonFetch('/maplestory/v1/id', { character_name: name });
      const equipData = await window._nexonFetch('/maplestory/v1/character/item-equipment', { ocid: idRes.ocid });
      const { bestNo, scores } = window._consultingPickBestPreset(equipData);
      window._consultingImportEquipData = equipData;
      window._consultingImportScores = scores;
      window._consultingImportCurrentPreset = bestNo;
      window._consultingImportRender(slot);
    } catch (e) {
      result.innerHTML = `<div class="text-center py-3 text-red-500 text-xs"><i class="fas fa-times-circle mr-1"></i>${esc(e.message || '검색 실패')}</div>`;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '검색'; }
    }
  };

  // 선택된 프리셋의 후보 렌더 (프리셋 토글 시 재호출)
  window._consultingImportRender = (slot) => {
    const result = document.getElementById('_consultingImportResult');
    if (!result) return;
    const equipData = window._consultingImportEquipData;
    const scores = window._consultingImportScores || [];
    const presetNo = window._consultingImportCurrentPreset || 1;
    const equips = window._consultingMergePresetWithLegacy(equipData, presetNo);
    const candidates = window._consultingSlotCandidates(slot);
    const matches = equips.filter(e => candidates.includes(e.item_equipment_slot || e.item_equipment_part));
    window._consultingImportPool = matches;

    // 프리셋 토글 (활성 프리셋만, 점수 표시)
    const validPresets = scores.filter(p => p.items.length > 0);
    const maxScore = Math.max(...validPresets.map(p => p.score), 0);
    const presetTabs = validPresets.length > 1 ? `
      <div class="flex gap-1 mb-3 bg-gray-100 p-1 rounded-lg">
        ${validPresets.map(p => {
          const isActive = p.no === presetNo;
          const isBest = p.score === maxScore;
          return `<button onclick="window._consultingImportSwitchPreset(${p.no})" class="flex-1 px-2 py-1.5 rounded text-[10px] font-bold transition ${isActive ? 'bg-white text-blue-600 shadow' : 'text-gray-500 hover:text-gray-700'}">프리셋 ${p.no}${isBest ? ' <i class=\"fas fa-crown text-amber-400 text-[8px]\"></i>' : ''}<div class="text-[8px] font-normal opacity-60">${p.score}점</div></button>`;
        }).join('')}
      </div>
      <p class="text-[9px] text-gray-400 -mt-2 mb-2 text-center"><i class="fas fa-crown text-amber-400 mr-1"></i>가장 점수 높은 프리셋 자동 선택. 다른 프리셋을 보려면 탭 클릭</p>` : '';

    if (!matches.length) {
      result.innerHTML = `${presetTabs}<div class="text-center py-3 text-amber-600 text-xs"><i class="fas fa-exclamation-circle mr-1"></i>프리셋 ${presetNo}에 ${esc(candidates.join('/'))} 슬롯 장비가 없습니다</div>`;
      return;
    }
    const isMulti = matches.length > 1;
    result.innerHTML = `
      ${presetTabs}
      <div class="text-[10px] text-gray-500 font-bold mb-2">${isMulti ? `↓ ${matches.length}개 중 어느 장비를 복사할까요? 클릭하여 선택` : '↓ 이 장비를 AFTER로 복사할까요?'}</div>
      <div class="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
      ${matches.map((eq, i) => {
        const data = window._consultingNormalizeEq(eq);
        const realSlot = eq.item_equipment_slot || eq.item_equipment_part;
        return `<div class="cursor-pointer hover:scale-[1.01] transition" onclick="window._consultingImportPick(${i})">${window._consultingItemCardHtml(data, { slot: realSlot, extraCls: 'hover:ring-2 hover:ring-emerald-400' })}</div>`;
      }).join('')}
      </div>
      ${isMulti ? '' : `<button onclick="window._consultingImportPick(0)" class="w-full mt-3 px-3 py-2 bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-600"><i class="fas fa-check mr-1"></i>이 장비로 AFTER 채우기</button>`}`;
  };

  window._consultingImportSwitchPreset = (presetNo) => {
    window._consultingImportCurrentPreset = presetNo;
    window._consultingImportRender(window._consultingTargetEditingSlot);
  };

  window._consultingImportPick = (idx) => {
    const pool = window._consultingImportPool || [];
    const eq = pool[idx];
    if (!eq) return;
    window._consultingImportFound = eq;
    window._consultingImportApply();
  };

  window._consultingImportApply = () => {
    const eq = window._consultingImportFound;
    if (!eq) return;
    const slot = window._consultingTargetEditingSlot;
    const d = window._consultingState.draft;
    const t = d.target_items.find(x => x.slot === slot);
    if (!t) return;
    // 핵심 필드 통째 복사
    t.after_name = eq.item_name || '';
    t.after_icon = eq.item_icon || '';
    t.after_stars = parseInt(eq.starforce) || 0;
    t.after_special_ring_level = parseInt(eq.special_ring_level) || 0;
    t.after_pot_grade = eq.potential_option_grade || '';
    t.after_pot_1 = eq.potential_option_1 || '';
    t.after_pot_2 = eq.potential_option_2 || '';
    t.after_pot_3 = eq.potential_option_3 || '';
    t.after_add_grade = eq.additional_potential_option_grade || '';
    t.after_add_1 = eq.additional_potential_option_1 || '';
    t.after_add_2 = eq.additional_potential_option_2 || '';
    t.after_add_3 = eq.additional_potential_option_3 || '';
    window._consultingImportFound = null;
    document.getElementById('_consultingImportModal')?.remove();
    window.showMsg('AFTER에 장비 복사 완료. 옵션을 손봐주세요.', 'success');
    window._consultingShowTargetModal();
  };

  // Before/After 비교 카드 (상세 뷰)
  window._consultingRenderCompareCards = (targets, equipsBefore) => {
    if (!Array.isArray(targets) || !targets.length) return '';
    const eqMap = {};
    if (Array.isArray(equipsBefore)) {
      equipsBefore.forEach(e => {
        const slot = e.item_equipment_slot || e.item_equipment_part || '';
        if (slot) eqMap[slot] = e;
      });
    }
    return `<div class="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-3 border border-slate-700/50 space-y-3">
      ${targets.map(t => {
        const eq = eqMap[t.slot] || {};
        const beforeData = {
          name: t.before_name || eq.item_name || '',
          icon: eq.item_icon || t.before_icon || '',
          stars: t.before_stars || parseInt(eq.starforce) || 0,
          upgrade: parseInt(eq.scroll_upgrade) || 0,
          pot_grade: eq.potential_option_grade || '',
          pot_1: eq.potential_option_1, pot_2: eq.potential_option_2, pot_3: eq.potential_option_3,
          add_grade: eq.additional_potential_option_grade || '',
          add_1: eq.additional_potential_option_1, add_2: eq.additional_potential_option_2, add_3: eq.additional_potential_option_3,
          soul_name: eq.soul_name, soul_option: eq.soul_option,
          special_ring_level: parseInt(eq.special_ring_level) || parseInt(t.before_special_ring_level) || 0
        };
        const afterData = {
          name: t.after_name || '',
          icon: t.after_icon || '',
          stars: t.after_stars || 0,
          upgrade: 0,
          pot_grade: t.after_pot_grade || '',
          pot_1: t.after_pot_1, pot_2: t.after_pot_2, pot_3: t.after_pot_3,
          add_grade: t.after_add_grade || '',
          add_1: t.after_add_1, add_2: t.after_add_2, add_3: t.after_add_3,
          special_ring_level: parseInt(t.after_special_ring_level) || 0
        };
        return `
          <div class="bg-slate-800/40 rounded-lg border border-slate-700/40 p-2.5">
            <div class="grid grid-cols-1 md:grid-cols-[1fr_24px_1fr] gap-2 mb-2 items-center">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-[10px] font-black text-pink-300 bg-pink-500/15 px-2 py-0.5 rounded">${esc(t.slot)}</span>
              </div>
              <div></div>
              <div class="flex items-center gap-1.5 flex-wrap">
                ${t.hexa_contrib > 0 ? `<span class="text-[10px] font-bold text-emerald-300 bg-emerald-500/15 px-1.5 py-0.5 rounded">+${Number(t.hexa_contrib).toLocaleString()} 헥사</span>` : ''}
                ${t.cost ? `<span class="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded"><i class="fas fa-coins mr-0.5"></i>${esc(t.cost)}</span>` : ''}
                ${t.after_add_tier ? `<span class="text-[10px] font-bold text-cyan-300 bg-cyan-500/15 px-1.5 py-0.5 rounded">추옵 ${esc(t.after_add_tier)}</span>` : ''}
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-[1fr_24px_1fr] gap-2 items-stretch">
              <div class="relative">
                <div class="absolute -top-1.5 left-2 z-10 text-[9px] font-black text-red-300 bg-slate-900 px-1.5 py-0.5 rounded uppercase tracking-wider">현재</div>
                ${window._consultingItemCardHtml(beforeData, { extraCls: 'pt-3' })}
              </div>
              <div class="hidden md:flex items-center justify-center text-pink-400"><i class="fas fa-arrow-right"></i></div>
              <div class="relative">
                <div class="absolute -top-1.5 left-2 z-10 text-[9px] font-black text-emerald-300 bg-slate-900 px-1.5 py-0.5 rounded uppercase tracking-wider">목표</div>
                ${window._consultingItemCardHtml(afterData, { extraCls: 'pt-3 ring-1 ring-emerald-400/30' })}
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
  };

  // 효율 분석 표 (상세 뷰)
  window._consultingRenderEfficiency = (targets, sets, hexaUpgrade) => {
    const items = Array.isArray(targets) ? targets : [];
    const setListRaw = Array.isArray(sets) ? sets : [];
    // sets[*].items 호환: string → array
    const setList = setListRaw.map(s => ({
      ...s,
      items: Array.isArray(s.items) ? s.items
        : (typeof s.items === 'string' ? s.items.split(/[,/·]/).map(x => x.trim()).filter(Boolean) : [])
    }));
    const hu = hexaUpgrade || {};
    const huHexa = Number(hu.hexa_gain) || 0;
    const huSol = Number(hu.sol_erda) || 0;
    const huPrice = Number(hu.sol_erda_price) || 0;
    const huCost = huSol * huPrice;
    const huEff = huCost > 0 ? huHexa / huCost : 0;
    if (items.length === 0 && setList.length === 0 && huHexa === 0) return '';

    const parseCost = (s) => {
      if (!s) return 0;
      const m = String(s).replace(/,/g,'').match(/([\d.]+)\s*억?/);
      return m ? parseFloat(m[1]) : 0;
    };

    const targetSlots = new Set(items.map(t => t.slot));
    // 세트 발동 판정 — 묶은 슬롯이 (target_items + 현재 장비) 합집합에 모두 있어야 발동.
    // 단, 분배는 target_items에 있는 슬롯 수로만 나눔 (교체 안 하는 '유지' 슬롯엔 분배 X — 효율 표에 행이 없으니까)
    const setStatus = setList.map(s => {
      const slots = s.items || [];
      const slotsInTarget = slots.filter(slot => targetSlots.has(slot));
      // 발동: 묶은 슬롯 중 하나라도 target_items에 있어야 (= 유효한 교체로 발동) — 모두 유지면 효율 분석에 의미 없음
      const active = slots.length > 0 && slotsInTarget.length > 0;
      return { ...s, active, slotCount: slots.length, distSlots: slotsInTarget, distCount: slotsInTarget.length };
    });

    // slot → 첫 매칭 active set 인덱스 (분배 대상 슬롯만)
    const slotToSetIdx = new Map();
    setStatus.forEach((s, idx) => {
      if (!s.active) return;
      (s.distSlots || []).forEach(slot => {
        if (!slotToSetIdx.has(slot)) slotToSetIdx.set(slot, idx);
      });
    });

    // 각 단품 행 계산
    const itemRows = items.map(t => {
      const sIdx = slotToSetIdx.get(t.slot);
      const setShare = (sIdx != null && setStatus[sIdx].distCount > 0)
        ? Math.round(Number(setStatus[sIdx].hexa_contrib || 0) / setStatus[sIdx].distCount)
        : 0;
      const itemHexa = Number(t.hexa_contrib) || 0;
      const total = itemHexa + setShare;
      const cost = parseCost(t.cost);
      const eff = cost > 0 ? total / cost : 0;
      return { slot: t.slot, name: t.after_name, itemHexa, setShare, total, cost, eff, setIdx: sIdx ?? null };
    });

    const standalone = itemRows.filter(r => r.setIdx == null).sort((a, b) => b.eff - a.eff);
    const groups = setStatus.map((s, idx) => ({
      set: s, setIdx: idx,
      members: itemRows.filter(r => r.setIdx === idx).sort((a, b) => b.eff - a.eff)
    })).filter(g => g.members.length > 0 || g.set.slotCount > 0 || Number(g.set.hexa_contrib) > 0);

    // 합계
    const itemHexaSum = itemRows.reduce((s, r) => s + r.itemHexa, 0);
    const setHexaSum = setStatus.filter(s => s.active).reduce((acc, s) => acc + (Number(s.hexa_contrib) || 0), 0);
    const totalHexa = itemHexaSum + setHexaSum + huHexa;
    const itemCostSum = itemRows.reduce((s, r) => s + r.cost, 0);
    const totalCost = itemCostSum + huCost;
    const activeSetCount = setStatus.filter(s => s.active).length;

    const effColorClass = (e) => e >= 100 ? 'text-emerald-500' : e >= 30 ? 'text-blue-500' : e > 0 ? 'text-amber-500' : 'text-gray-300';
    let rowSeq = 0;
    const renderItemRow = (r, opts = {}) => {
      const num = ++rowSeq;
      const medal = !opts.inGroup && num === 1 ? '🥇' : !opts.inGroup && num === 2 ? '🥈' : !opts.inGroup && num === 3 ? '🥉' : num;
      const bg = opts.inGroup ? 'bg-violet-50/30' : (num === 1 ? 'bg-amber-50/40' : '');
      const stripe = opts.inGroup ? ' border-l-4 border-l-violet-300' : '';
      return `
        <div class="px-2 py-2.5 border-t border-gray-100 text-center font-bold ${bg}${stripe}">${medal}</div>
        <div class="px-3 py-2.5 border-t border-gray-100 ${bg}">
          <span class="text-gray-700 font-bold">${esc(r.slot)}</span>${r.name ? `<span class="text-gray-400 ml-1">${esc(r.name)}</span>` : ''}
        </div>
        <div class="px-2 py-2.5 border-t border-gray-100 text-right font-bold text-gray-700 ${bg}">+${r.itemHexa.toLocaleString()}</div>
        <div class="px-2 py-2.5 border-t border-gray-100 text-right font-bold ${r.setShare > 0 ? 'text-violet-600' : 'text-gray-300'} ${bg}">${r.setShare > 0 ? '+' + r.setShare.toLocaleString() : '-'}</div>
        <div class="px-2 py-2.5 border-t border-gray-100 text-right font-bold text-emerald-500 ${bg}">+${r.total.toLocaleString()}</div>
        <div class="px-2 py-2.5 border-t border-gray-100 text-right text-gray-700 ${bg}">${r.cost > 0 ? r.cost + '억' : '-'}</div>
        <div class="px-2 py-2.5 border-t border-gray-100 text-right font-black ${effColorClass(r.eff)} ${bg}">${r.eff > 0 ? r.eff.toFixed(1) : '-'}</div>`;
    };

    return `<div class="space-y-3">
      <div class="grid grid-cols-3 gap-2">
        <div class="bg-emerald-50 rounded-lg p-3 text-center border border-emerald-100">
          <div class="text-[10px] text-emerald-500 font-bold uppercase">총 헥사 상승</div>
          <div class="text-base font-black text-emerald-600 mt-1">+${totalHexa.toLocaleString()}</div>
          ${(setHexaSum > 0 || huHexa > 0) ? `<div class="text-[9px] text-gray-500 mt-1 font-bold">
            단품 +${itemHexaSum.toLocaleString()}
            ${setHexaSum > 0 ? `<span class="text-gray-300"> · </span><span class="text-violet-600">세트 +${setHexaSum.toLocaleString()}</span>` : ''}
            ${huHexa > 0 ? `<span class="text-gray-300"> · </span><span class="text-amber-600">강화 +${huHexa.toLocaleString()}</span>` : ''}
          </div>` : ''}
        </div>
        <div class="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
          <div class="text-[10px] text-amber-500 font-bold uppercase">총 비용</div>
          <div class="text-base font-black text-amber-600 mt-1">${totalCost.toFixed(1)}억</div>
          ${huCost > 0 ? `<div class="text-[9px] text-gray-500 mt-1 font-bold">장비 ${itemCostSum.toFixed(0)}억 <span class="text-gray-300">·</span> <span class="text-amber-600">솔에르다 ${huCost.toFixed(1)}억</span></div>` : ''}
        </div>
        <div class="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
          <div class="text-[10px] text-blue-500 font-bold uppercase">교체 부위</div>
          <div class="text-base font-black text-blue-600 mt-1">${itemRows.length}개${activeSetCount > 0 ? ` <span class="text-[10px] text-violet-500 font-bold">+ 세트 ${activeSetCount}</span>` : ''}</div>
        </div>
      </div>
      <div class="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div class="grid grid-cols-[40px_1fr_70px_80px_70px_80px_70px] gap-0 text-[11px]">
          <div class="bg-gray-50 px-2 py-2 font-bold text-gray-500 text-center">#</div>
          <div class="bg-gray-50 px-3 py-2 font-bold text-gray-500">부위</div>
          <div class="bg-gray-50 px-2 py-2 font-bold text-gray-500 text-right">단품</div>
          <div class="bg-gray-50 px-2 py-2 font-bold text-violet-500 text-right">세트분배</div>
          <div class="bg-gray-50 px-2 py-2 font-bold text-emerald-500 text-right">합계</div>
          <div class="bg-gray-50 px-2 py-2 font-bold text-gray-500 text-right">비용</div>
          <div class="bg-gray-50 px-2 py-2 font-bold text-amber-500 text-right">효율 ↓</div>
          ${standalone.map(r => renderItemRow(r)).join('')}
          ${groups.map(g => {
            const memberHexaSum = g.members.reduce((s, r) => s + r.itemHexa, 0);
            const setBonus = Number(g.set.hexa_contrib) || 0;
            const groupTotal = memberHexaSum + (g.set.active ? setBonus : 0);
            const slotsLabel = (g.set.items || []).map(slot =>
              targetSlots.has(slot)
                ? `<span>${esc(slot)}</span>`
                : `<span class="text-amber-600">${esc(slot)}<span class="text-[9px] opacity-70 ml-0.5">(유지)</span></span>`
            ).join('<span class="text-gray-300 mx-0.5">/</span>');
            const keepCount = (g.set.items || []).length - g.set.distCount;
            return `
              <div class="col-span-7 px-3 py-2 border-t-2 border-violet-300 bg-violet-50/60 flex items-center justify-between text-[11px] flex-wrap gap-2">
                <div class="flex items-center gap-2 min-w-0 flex-wrap">
                  <i class="fas fa-layer-group text-violet-500"></i>
                  <span class="font-black text-violet-700">${esc(g.set.name || '(이름 없음)')}</span>
                  ${slotsLabel ? `<span class="text-gray-500 text-[10px]">${slotsLabel}</span>` : ''}
                  ${g.set.active
                    ? `<span class="bg-emerald-100 text-emerald-700 text-[9px] font-black px-1.5 py-0.5 rounded">발동</span>`
                    : `<span class="bg-gray-100 text-gray-500 text-[9px] font-black px-1.5 py-0.5 rounded" title="묶은 슬롯 중 교체할 게 1개 이상이어야 효율 분석에 반영">미발동</span>`}
                  ${keepCount > 0 ? `<span class="text-[9px] text-amber-600 font-bold">유지 ${keepCount}개</span>` : ''}
                </div>
                <div class="text-[10px] text-gray-600">단품 +${memberHexaSum.toLocaleString()}${g.set.active ? ` + 세트 +${setBonus.toLocaleString()} = <strong class="text-violet-700">+${groupTotal.toLocaleString()}</strong>` : ` <span class="text-gray-400">(세트 +${setBonus.toLocaleString()} 미발동)</span>`}</div>
              </div>
              ${g.members.map(r => renderItemRow(r, { inGroup: true })).join('')}
            `;
          }).join('')}
          ${huHexa > 0 ? `
              <div class="px-2 py-2.5 border-t-2 border-amber-200 text-center font-bold bg-amber-50/60 text-amber-500"><i class="fas fa-cubes-stacked"></i></div>
              <div class="px-3 py-2.5 border-t-2 border-amber-200 bg-amber-50/60">
                <span class="text-amber-700 font-bold">헥사 강화</span>
                <span class="text-gray-700 ml-1">솔에르다 ${huSol}개${huPrice > 0 ? ` × ${huPrice}억` : ''}</span>
              </div>
              <div class="px-2 py-2.5 border-t-2 border-amber-200 text-right text-gray-300 bg-amber-50/60">-</div>
              <div class="px-2 py-2.5 border-t-2 border-amber-200 text-right text-gray-300 bg-amber-50/60">-</div>
              <div class="px-2 py-2.5 border-t-2 border-amber-200 text-right font-bold text-amber-600 bg-amber-50/60">+${huHexa.toLocaleString()}</div>
              <div class="px-2 py-2.5 border-t-2 border-amber-200 text-right text-gray-700 bg-amber-50/60">${huCost > 0 ? huCost.toFixed(1) + '억' : huSol + '조각'}</div>
              <div class="px-2 py-2.5 border-t-2 border-amber-200 text-right font-black ${effColorClass(huEff)} bg-amber-50/60">${huEff > 0 ? huEff.toFixed(1) : '-'}</div>
          ` : ''}
        </div>
      </div>
      <p class="text-[10px] text-gray-400 text-right">💡 효율 = 합계 헥사 상승 ÷ 비용(억) · 세트 분배 = 보너스 ÷ 묶인 슬롯 수 · 헥사 강화 비용 = 조각수 × 시세</p>
    </div>`;
  };

  // 넥슨 API에서 캐릭 정보 + 장비 가져오기
  window._consultingFetchFromNexon = async () => {
    const apiKey = window._getNexonApiKey();
    if (!apiKey) return window.showMsg('동기화 탭에서 Nexon API Key 먼저 등록해주세요.', 'error');

    const charName = document.getElementById('_consultingApiCharName')?.value?.trim();
    if (!charName) return window.showMsg('캐릭명을 입력해주세요.', 'error');

    const btn = document.getElementById('_consultingFetchBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>불러오는 중...'; }

    try {
      const ocid = await window._getCharOcid(charName);
      const basic = await window._getCharBasic(ocid);

      // 캐릭 이미지 - 큰 사이즈
      let charImg = basic.character_image || '';
      if (charImg && !charImg.includes('width=')) {
        const sep = charImg.includes('?') ? '&' : '?';
        charImg += `${sep}width=400&height=500`;
      }

      // 전투력 (stat에서 가져옴)
      let combatPower = '';
      try {
        const stat = await window._nexonFetch('/maplestory/v1/character/stat', { ocid });
        if (stat?.final_stat) {
          const cp = stat.final_stat.find(s => s.stat_name === '전투력');
          if (cp) {
            const n = Number(cp.stat_value);
            // 한국식 표기
            if (n >= 1e8) combatPower = (n / 1e8).toFixed(2).replace(/\.?0+$/, '') + '억';
            else if (n >= 1e4) combatPower = (n / 1e4).toFixed(0) + '만';
            else combatPower = n.toLocaleString();
          }
        }
      } catch(e) {}

      // 장비 (가장 점수 높은 프리셋 + legacy 전용 슬롯 합치기)
      let equips = [];
      try {
        const equipData = await window._nexonFetch('/maplestory/v1/character/item-equipment', { ocid });
        const { bestNo } = window._consultingPickBestPreset(equipData);
        equips = window._consultingMergePresetWithLegacy(equipData, bestNo);
      } catch(e) { console.warn('장비 로드 실패:', e); }

      const d = window._consultingState.draft;
      d.member_name = basic.character_name || charName;
      d.member_class = basic.character_class || d.member_class;
      d.member_server = basic.world_name || d.member_server;
      d.character_image = charImg;
      if (combatPower) d.combat_power = combatPower;
      d.equipment_data = equips;

      window.showMsg(`${d.member_name} 정보 로드 완료! 장비 ${equips.length}개`, 'success');
      window.renderConsulting(document.getElementById('contentArea'));
    } catch (e) {
      window.showMsg('가져오기 실패: ' + e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-cloud-download-alt mr-1"></i>API로 불러오기'; }
    }
  };

  window._consultingAddDiagnosis = () => {
    const d = window._consultingState.draft;
    if (!Array.isArray(d.diagnosis)) d.diagnosis = [];
    d.diagnosis.push({ title: '새 단계', content: '', priority: '중간' });
    window.renderConsulting(document.getElementById('contentArea'));
  };
  window._consultingRemoveDiagnosis = (i) => {
    window._consultingState.draft.diagnosis.splice(i, 1);
    window.renderConsulting(document.getElementById('contentArea'));
  };
  window._consultingAddTip = () => {
    const d = window._consultingState.draft;
    if (!Array.isArray(d.tips)) d.tips = [];
    d.tips.push('');
    window.renderConsulting(document.getElementById('contentArea'));
  };
  window._consultingRemoveTip = (i) => {
    window._consultingState.draft.tips.splice(i, 1);
    window.renderConsulting(document.getElementById('contentArea'));
  };
  window._consultingAddSet = () => {
    const d = window._consultingState.draft;
    if (!d.goal) d.goal = {};
    if (!Array.isArray(d.goal.sets)) d.goal.sets = [];
    d.goal.sets.push({ name: '', items: '', hexa_contrib: 0 });
    window.renderConsulting(document.getElementById('contentArea'));
  };
  window._consultingRemoveSet = (i) => {
    const d = window._consultingState.draft;
    if (!d?.goal?.sets) return;
    d.goal.sets.splice(i, 1);
    window.renderConsulting(document.getElementById('contentArea'));
  };
  window._consultingToggleSetSlot = (setIdx, slot, checked) => {
    const d = window._consultingState.draft;
    const set = d?.goal?.sets?.[setIdx];
    if (!set) return;
    if (!Array.isArray(set.items)) set.items = [];
    if (checked) {
      if (!set.items.includes(slot)) set.items.push(slot);
    } else {
      set.items = set.items.filter(x => x !== slot);
    }
    window.renderConsulting(document.getElementById('contentArea'));
  };
  // 세트 묶기 모드 (장비 카드 클릭으로 슬롯 추가/제거)
  window._consultingStartLinkSet = (i) => {
    window._consultingState.linkingSetIdx = i;
    window.renderConsulting(document.getElementById('contentArea'));
    setTimeout(() => {
      const el = document.getElementById('consultingEquipArea');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };
  window._consultingEndLinkSet = () => {
    window._consultingState.linkingSetIdx = null;
    window.renderConsulting(document.getElementById('contentArea'));
  };
  window._consultingLinkToggle = (slot) => {
    const i = window._consultingState.linkingSetIdx;
    if (i == null) return;
    const set = window._consultingState.draft?.goal?.sets?.[i];
    if (!set) return;
    if (!Array.isArray(set.items)) set.items = [];
    if (set.items.includes(slot)) set.items = set.items.filter(x => x !== slot);
    else set.items.push(slot);
    window.renderConsulting(document.getElementById('contentArea'));
  };

  window._consultingSave = async () => {
    const d = window._consultingState.draft;
    if (!d.member_name?.trim()) return window.showMsg('캐릭명을 입력해주세요.', 'error');

    const payload = {
      member_name: d.member_name.trim(),
      member_class: d.member_class || null,
      member_server: d.member_server || null,
      consultant_name: d.consultant_name || null,
      diagnosis_date: d.diagnosis_date || null,
      combat_power: d.combat_power || null,
      main_stat: d.main_stat || null,
      hexa_stat: d.hexa_stat || null,
      goal: d.goal || {},
      diagnosis: d.diagnosis || [],
      tips: d.tips || [],
      target_items: d.target_items || [],
      equipment_data: d.equipment_data || [],
      attachments: Array.isArray(d.attachments) ? d.attachments : [],
      summary: d.summary || null,
      character_image: d.character_image || null,
      updated_at: new Date().toISOString()
    };

    try {
      let res;
      if (window._consultingState.view === 'new') {
        res = await supaDb.from('item_consultings').insert(payload).select().single();
      } else {
        res = await supaDb.from('item_consultings').update(payload).eq('id', window._consultingState.currentId).select().single();
      }
      if (res.error) throw res.error;
      window.showMsg('저장 완료!', 'success');
      window._consultingState.view = 'detail';
      window._consultingState.currentId = res.data.id;
      window._consultingState.draft = null;
      window.renderConsulting(document.getElementById('contentArea'));
    } catch (e) {
      window.showMsg('저장 실패: ' + e.message, 'error');
    }
  };

/* ----- 버니버디 (멘토-멘티 버디팀 · 옛 뚠뚠버디 포팅) ----- */
const BUDDY_ST={active:['var(--ok-bg)','var(--ok-tx)','진행 중'],completed:['rgba(59,169,199,.15)','#3BA9C7','완료'],failed:['var(--bad-bg)','var(--bad-tx)','실패'],cancelled:['var(--panel-2)','var(--dim)','취소']};
async function buildBuddy(){
  const { data:teams, error } = await db().from('buddy_teams').select('*').order('created_at',{ascending:false}).limit(200);
  if(error) throw error;
  const active=(teams||[]).filter(t=>t.status==='active'), done=(teams||[]).filter(t=>t.status!=='active');
  const card=(t)=>{ const s=BUDDY_ST[t.status]||BUDDY_ST.cancelled; return `<div class="panel" style="border-radius:18px;overflow:hidden;display:flex;cursor:pointer;margin-bottom:10px" onclick="_buddyDetail(${t.id})">
    ${t.team_image?`<div style="width:120px;flex-shrink:0;background:var(--panel-2)"><img src="${t.team_image}" style="width:100%;height:100%;object-fit:cover;min-height:90px"></div>`:''}
    <div style="padding:16px;flex:1;display:flex;align-items:center;gap:12px;min-width:0">
      ${t.team_image?'':'<div style="font-size:24px">🤝</div>'}
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-weight:900">${t.team_name||(t.mentor_name+' × '+t.mentee_name)}</span>
          <span class="chip" style="background:${s[0]};color:${s[1]}">${s[2]}</span>
          ${t.reward_choice?`<span class="chip" style="background:${t.reward_choice==='A'?'var(--ok-bg)':'rgba(155,89,182,.15)'};color:${t.reward_choice==='A'?'var(--ok-tx)':'#9B59B6'}">${t.reward_choice}보상</span>`:''}
        </div>
        <div class="dim" style="font-size:12px;font-weight:700;margin-top:4px"><span style="color:var(--amber)">멘토</span> ${t.mentor_name} · <span style="color:var(--ice)">멘티</span> ${t.mentee_name}${t.start_date?' · '+t.start_date:''}</div>
      </div>
      <i class="fa-solid fa-chevron-right dim"></i>
    </div></div>`; };
  return headerHTML('버니버디','멘토-멘티 버디팀') +
    `<div class="panel" style="border-radius:20px;padding:16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span style="font-weight:800"><i class="fa-solid fa-handshake" style="color:var(--amber);margin-right:6px"></i>진행 ${active.length}팀 · 완료 ${done.length}팀</span>
      ${isAdmin()?`<div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="_buddyImportPast()" style="border:1px solid var(--line);background:var(--panel-2);color:var(--text);border-radius:10px;padding:9px 14px;font-weight:800;cursor:pointer"><i class="fa-solid fa-clock-rotate-left" style="margin-right:5px"></i>과거 이력 가져오기</button>
        <button onclick="_buddyCreate()" style="border:0;border-radius:10px;padding:9px 16px;font-weight:800;color:#fff;background:var(--bunny-main);cursor:pointer"><i class="fa-solid fa-plus"></i> 팀 생성</button>
      </div>`:''}
    </div>
    ${active.length?active.map(card).join(''):'<div class="panel" style="border-radius:18px;padding:30px;text-align:center"><span class="dim" style="font-weight:700">진행 중인 버디팀이 없어요</span></div>'}
    ${done.length?`<h3 class="dim" style="font-weight:900;font-size:13px;margin:18px 0 10px">완료된 버디팀 (${done.length})</h3>${done.map(card).join('')}`:''}`;
}
window._buddyBack=async ()=>{ const el=document.getElementById('pageBody'); if(!el)return; el.innerHTML=loadingHTML('buddy'); try{ el.innerHTML=await buildBuddy(); }catch(e){ el.innerHTML=errorHTML('buddy',e); } };
window._buddyDetail=async (id)=>{
  const el=document.getElementById('pageBody'); if(!el)return; el.innerHTML=loadingHTML('buddy');
  try{
    const [{data:team},{data:missions}]=await Promise.all([
      db().from('buddy_teams').select('*').eq('id',id).single(),
      db().from('buddy_missions').select('*').eq('team_id',id).order('week_number'),
    ]);
    const s=BUDDY_ST[team.status]||BUDDY_ST.cancelled;
    const ck=(v)=> v?'<i class="fa-solid fa-circle-check" style="color:var(--ok-tx)"></i>':'<span class="dim">–</span>';
    const rows=(missions||[]).map(m=>`<tr style="border-bottom:1px solid var(--line)">
      <td style="padding:10px 8px;font-weight:900">${m.week_number}주차</td>
      <td style="text-align:center">${(m.mentor_score!=null?Number(m.mentor_score).toLocaleString():'-')} ${ck(m.mentor_clear)}</td>
      <td style="text-align:center">${(m.mentee_score!=null?Number(m.mentee_score).toLocaleString():'-')} ${ck(m.mentee_clear)}</td>
      <td style="text-align:center">${m.admin_verified?'<span class="chip" style="background:var(--ok-bg);color:var(--ok-tx)">인증</span>':'<span class="chip" style="background:var(--warn-bg);color:var(--warn-tx)">대기</span>'}</td>
    </tr>`).join('');
    el.innerHTML = headerHTML('버니버디', team.team_name||(team.mentor_name+' × '+team.mentee_name)) +
      `<button onclick="_buddyBack()" style="border:0;background:var(--panel-2);color:var(--text);border-radius:10px;padding:8px 16px;font-weight:800;cursor:pointer;margin-bottom:14px"><i class="fa-solid fa-arrow-left"></i> 목록</button>
       <div class="panel" style="border-radius:24px;padding:0;overflow:hidden;margin-bottom:16px">
         ${team.team_image?`<img src="${team.team_image}" style="width:100%;max-height:220px;object-fit:cover">`:''}
         <div style="padding:20px">
           <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px"><span class="chip" style="background:${s[0]};color:${s[1]}">${s[2]}</span>${team.reward_choice?`<span class="chip" style="background:${team.reward_choice==='A'?'var(--ok-bg)':'rgba(155,89,182,.15)'};color:${team.reward_choice==='A'?'var(--ok-tx)':'#9B59B6'}">${team.reward_choice} 보상</span>`:''}${team.start_date?`<span class="dim" style="font-size:12px;font-weight:700">${team.start_date} 시작</span>`:''}</div>
           <p style="font-weight:800;margin:0"><span style="color:var(--amber)">멘토</span> ${team.mentor_name} · <span style="color:var(--ice)">멘티</span> ${team.mentee_name}</p>
         </div>
       </div>
       <div class="panel" style="border-radius:24px;padding:20px">
         <h3 style="font-weight:900;font-size:16px;margin:0 0 14px"><i class="fa-solid fa-list-check" style="color:var(--bunny-main);margin-right:8px"></i>주차별 미션</h3>
         <div class="scroll" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px;min-width:440px">
           <thead><tr class="dim" style="font-size:12px;font-weight:700;border-bottom:2px solid var(--line)"><th style="text-align:left;padding:10px 8px">주차</th><th style="text-align:center;padding:10px 0">멘토 점수</th><th style="text-align:center;padding:10px 0">멘티 점수</th><th style="text-align:center;padding:10px 0">인증</th></tr></thead>
           <tbody style="font-weight:600">${rows||'<tr><td colspan="4" class="dim" style="padding:24px;text-align:center;font-weight:700">미션 기록 없음</td></tr>'}</tbody></table></div>
       </div>`;
  }catch(e){ el.innerHTML=errorHTML('buddy',e); }
};
/* 과거 버니버디 완료 이력(디스코드 #버니-버디 export 기준) — 운영진이 1회 가져오기 */
const _BP='https://pub-ee3a7d1dfe0a442b96336f0c81289a46.r2.dev/guide-images/buddy-fix-';
const BUDDY_PAST=[
  {m:'헌이밍',e:'심탱',t:'금태양',d:'2025-08-13',img:_BP+'0.png'},
  {m:'SumireUesaka',e:'스딜',t:'재획 재미 없어요',d:'2025-08-13',img:_BP+'1.png'},
  {m:'쫑쫑종옹',e:'머리터진짐승',t:'화양연화',d:'2025-08-20',img:_BP+'2.png'},
  {m:'학급붕괴',e:'손만두',t:'오늘 급식 만두',d:'2025-08-20',img:_BP+'3.png'},
  {m:'정전위험',e:'뿅가',t:'위험해! 뿅가기전에~',d:'2025-08-27',img:_BP+'4.png'},
  {m:'엔바쓰',e:'덕춘이',t:'0.9% 헌터쓰',d:'2025-09-24',img:_BP+'5.png'},
  {m:'칸코',e:'조망렌',t:'레드',d:'2025-09-24',img:_BP+'6.png'},
  {m:'새론이',e:'삼구',t:'닭둘기',d:'2025-10-01',img:_BP+'7.png'},
  {m:'반경',e:'딕밤',t:'반딕',d:'2025-10-15',img:_BP+'8.png'},
  {m:'떡공',e:'조디아가',t:'다크 아크',d:'2025-10-22',img:_BP+'9.png'},
  {m:'멘토스자두맛',e:'경민앗',t:'경-멘',d:'2025-10-29',img:_BP+'10.png'},
  {m:'불통',e:'타임아스트랄',t:'소마',d:'2025-11-05',img:_BP+'11.png'},
  {m:'신제',e:'딩굴댕굴',t:'딩굴신제',d:'2025-11-05',img:_BP+'12.png'},
  {m:'형두',e:'한가위',t:'두가위',d:'2025-11-19',img:_BP+'13.png'},
  {m:'SumireUesaka',e:'꽃화관',t:'신규지역내놔!',d:'2025-12-03',img:_BP+'14.png'},
  {m:'스딜',e:'두근해',t:'초식동물',d:'2025-12-03',img:_BP+'15.png'},
  {m:'커플장소',e:'검토요소',t:'챌섭에서 루나까지',d:'2026-01-21',img:_BP+'16.png'},
  {m:'두근해',e:'므농',t:'김부부',d:'2026-01-21',img:_BP+'17.png'},
  {m:'경록남',e:'도규',t:'경도(경찰과도둑)',d:'2026-02-11',img:_BP+'18.png'},
];
window._buddyImportPast=async ()=>{
  if(!isAdmin()) return alert('운영진만 가능해요.');
  if(!confirm(`과거 버니버디 ${BUDDY_PAST.length}팀을 가져올까요?\n· 없는 팀은 추가(이미지 포함)\n· 이미 있는데 이미지 빠진 팀은 이미지만 채움`)) return;
  let existing=[];
  try{ const { data }=await db().from('buddy_teams').select('id,mentor_name,mentee_name,team_name,team_image'); existing=data||[]; }catch(e){}
  const map={}; existing.forEach(x=>{ map[`${x.mentor_name}|${x.mentee_name}|${x.team_name}`]=x; });
  const rows=[], updates=[];
  BUDDY_PAST.forEach(b=>{ const ex=map[`${b.m}|${b.e}|${b.t}`];
    if(!ex) rows.push({ mentor_name:b.m, mentee_name:b.e, team_name:b.t, status:'completed', start_date:b.d, team_image:b.img||null });
    else if(b.img && ex.team_image!==b.img) updates.push({ id:ex.id, team_image:b.img });
  });
  if(!rows.length && !updates.length){ alert('이미 다 등록됐고 이미지도 채워져 있어요.'); return; }
  let ins=0, upd=0, fail=0;
  if(rows.length){ const { error }=await db().from('buddy_teams').insert(rows); if(error){ alert('추가 실패: '+error.message+'\n(운영진 로그인 상태인지 확인해주세요)'); return; } ins=rows.length; }
  for(const u of updates){ const { error }=await db().from('buddy_teams').update({ team_image:u.team_image }).eq('id',u.id); if(error) fail++; else upd++; }
  alert(`완료 ✓ 추가 ${ins}팀 · 이미지 채움 ${upd}팀${fail?` · 실패 ${fail}`:''}`);
  _buddyBack();
};
window._buddyCreate=async ()=>{
  if(!isAdmin()) return alert('운영진만 생성할 수 있어요.');
  const mentor=prompt('멘토 닉네임'); if(!mentor) return;
  const mentee=prompt('멘티 닉네임'); if(!mentee) return;
  const reward=(prompt('보상 선택 — A(조각) / B(룰렛)','A')||'A').toUpperCase();
  const { error } = await db().from('buddy_teams').insert({ mentor_name:mentor.trim(), mentee_name:mentee.trim(), reward_choice:(reward==='B'?'B':'A'), status:'active', start_date:new Date().toISOString().slice(0,10) });
  if(error) return alert('생성 실패: '+error.message);
  _buddyBack();
};

/* ---------- 다크모드 ---------- */
function toggleDark(){
  document.body.classList.toggle('dark');
  const on = document.body.classList.contains('dark');
  document.getElementById('darkBtn').textContent = on ? '☀️' : '🌙';
  localStorage.setItem('bunny_dark', on ? '1' : '0');
  applyTheme();
}

/* ---------- 렌더 ---------- */
function _setFavicon(){
  try{ const emoji=(typeof fac==='function'&&fac().emoji)||'🐰';
    const href='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><text y="52" font-size="54">${emoji}</text></svg>`);
    let link=document.querySelector('link[rel="icon"]'); if(!link){ link=document.createElement('link'); link.rel='icon'; document.head.appendChild(link); }
    link.setAttribute('type','image/svg+xml'); link.href=href;
  }catch(e){}
}
function render(){
  const app = document.getElementById('app');
  let page = app.dataset.page || 'home';
  if(!META[page] && page!=='home') page = 'home';   // 모르는 키 → 홈으로 폴백
  document.title = (META[page] ? META[page].t + ' · ' : '') + fac().label + ' 길드 관리';
  _setFavicon();   // 주소창/탭 아이콘 = 현재 길드 마크(🐰버니/🐺늑대/🐆쿠거) — 옛 뚠카롱 favicon 대체

  const blocked = META[page] && META[page].admin && !isAdmin();
  const hasBuilder = !!PAGES[page] && !blocked;

  let content;
  if(blocked)                content = denyHTML(page);          // 관리자 전용 차단
  else if(hasBuilder)        content = `<div id="pageBody">${loadingHTML(page)}</div>`;  // 실데이터 페이지
  else                       content = placeholderHTML(page);   // 아직 와꾸

  const mtitle = (page==='home') ? '버니 길드' : (META[page] ? META[page].t : '버니 길드');
  app.innerHTML = `
    <button id="darkBtn" class="dark-btn panel" onclick="toggleDark()">${localStorage.getItem('bunny_dark')==='1'?'☀️':'🌙'}</button>
    <div class="sidebar-ovl" onclick="closeNav()"></div>
    <div class="app-shell">
      ${sidebarHTML(page)}
      <main class="main scroll">
        <div class="mobile-bar">
          <button class="mb-btn" onclick="openNav()" aria-label="메뉴"><i class="fa-solid fa-bars"></i></button>
          <h1>🐰 ${mtitle}</h1>
        </div>
        <div class="fade" style="padding:28px;">${content}</div>
      </main>
    </div>`;
  document.body.classList.remove('nav-open');

  // 실데이터 페이지는 DB 준비된 뒤 비동기로 채움
  if(hasBuilder && BACKEND.db){
    PAGES[page]()
      .then(html=>{ const el=document.getElementById('pageBody'); if(el) el.innerHTML = html; })
      .catch(e=>{ const el=document.getElementById('pageBody'); if(el) el.innerHTML = errorHTML(page,e); });
  }
}

/* ---------- 모바일 드로어 ---------- */
window.openNav  = ()=> document.body.classList.add('nav-open');
window.closeNav = ()=> document.body.classList.remove('nav-open');

/* ---------- 부트 ---------- */
(async function(){
  if(localStorage.getItem('bunny_dark')==='1') document.body.classList.add('dark');
  applyTheme();                   // 팩션 색 적용
  render();                       // 즉시 1차 렌더 (게스트, 빠른 페인트)
  _clogMaybePopup();              // 새 버전이면 What's New 팝업 (1회)
  try{
    await loadSupabase();
    BACKEND.db = window.supabase.createClient(BACKEND.SUPABASE_URL, BACKEND.SUPABASE_ANON_KEY);
    await resolveAuth();
    render();                     // 인증 반영 2차 렌더
  }catch(e){ console.warn('[버니] 백엔드 연결 실패 — 게스트로 진행:', e); }
})();

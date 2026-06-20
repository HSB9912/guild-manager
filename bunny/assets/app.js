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
      <div><h1 style="font-weight:900;font-size:18px;margin:0;line-height:1.1">버니 길드</h1><p class="dim" style="font-size:12px;margin:2px 0 0">뚠뚱카롱 연합</p></div>
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
      <div class="tone-cream" style="border-radius:16px;padding:12px;text-align:center;">
        <p class="dim" style="font-size:11px;font-weight:700;margin:0 0 2px">이번 주 정모</p>
        <p style="font-weight:900;font-size:14px;margin:0">토 · 21:00</p>
      </div>
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

/* ---------- 홈 대시보드 (G 벤토) — MOCK에서 데이터 읽음 ---------- */
function homeHTML(){
  const d = MOCK;
  const roleChip = (r)=> r[7]==='deep'?`<span class="chip" style="background:var(--bunny-deep);color:#fff">${r[2]}</span>`
    : r[7]==='new'?`<span class="chip" style="background:var(--bunny-light);color:var(--bunny-deep)">${r[2]}</span>`
    : `<span class="chip" style="background:var(--line);color:var(--text)">${r[2]}</span>`;
  const stChip = (s)=> s==='활동중'?'<span class="chip" style="background:var(--ok-bg);color:var(--ok-tx)">활동중</span>'
    : s==='주의'?'<span class="chip" style="background:var(--warn-bg);color:var(--warn-tx)">주의</span>'
    : '<span class="chip" style="background:var(--bad-bg);color:var(--bad-tx)">결석多</span>';
  const tbody = d.members.map(r=>`<tr style="border-bottom:1px solid var(--line)">
    <td style="padding:12px 8px;font-weight:700;display:flex;align-items:center;gap:8px;"><span style="width:28px;height:28px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:900;background:${r[6]}">${r[0]}</span>${r[1]}</td>
    <td>${roleChip(r)}</td><td style="text-align:center;font-weight:900">${r[3]}</td><td style="text-align:center">${r[4]}</td><td style="text-align:center;padding-right:8px">${stChip(r[5])}</td></tr>`).join('');
  const bars = d.weeklyBars.map((h,idx)=>`<div style="flex:1;border-radius:8px 8px 0 0;height:${h}%;background:${idx===5?'var(--bunny-deep)':h>=70?'var(--bunny-main)':'var(--bunny-light)'}"></div>`).join('');
  const queue = d.joinQueue.map(r=>`
    <div class="${r[4]}" style="display:flex;align-items:center;justify-content:space-between;border-radius:12px;padding:10px 16px;">
      <div style="display:flex;align-items:center;gap:12px;"><span style="width:32px;height:32px;border-radius:999px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:900;background:${r[3]}">${r[0]}</span><div><p style="font-size:14px;font-weight:700;margin:0">${r[1]}</p><p class="dim" style="font-size:11px;margin:0">${r[2]}</p></div></div>
      <div style="display:flex;gap:6px;"><button style="width:32px;height:32px;border:0;border-radius:8px;color:#fff;background:#1A8A4A;cursor:pointer"><i class="fa-solid fa-check"></i></button><button style="width:32px;height:32px;border:0;border-radius:8px;color:#fff;background:#C03A3A;cursor:pointer"><i class="fa-solid fa-xmark"></i></button></div>
    </div>`).join('');

  return headerHTML('대시보드','길드 현황 한눈에 보기') + `<div class="bento">
    <div class="panel tone-rose" style="border-radius:24px;padding:24px;color:#fff;display:flex;flex-direction:column;justify-content:space-between;">
      <div style="display:flex;align-items:center;justify-content:space-between"><span style="font-size:14px;font-weight:700;opacity:.9">총 멤버</span><i class="fa-solid fa-users" style="opacity:.8"></i></div>
      <div><p style="font-size:48px;font-weight:900;line-height:1;margin:0">${d.totalMembers}</p><p style="font-size:12px;font-weight:700;margin:8px 0 0;opacity:.9"><i class="fa-solid fa-arrow-up"></i> 이번 주 ${d.totalDelta}명</p></div>
    </div>
    <div class="panel tone-light" style="border-radius:24px;padding:24px;display:flex;flex-direction:column;justify-content:space-between;">
      <div style="display:flex;align-items:center;justify-content:space-between"><span class="dim" style="font-size:14px;font-weight:700">주간 평균점수</span><i class="fa-solid fa-star" style="color:var(--bunny-main)"></i></div>
      <div><p style="font-size:36px;font-weight:900;line-height:1;margin:0">${d.weeklyAvg}</p>
        <svg class="spark" style="margin-top:8px;width:100%" height="26" viewBox="0 0 120 26" preserveAspectRatio="none"><path d="M0 20 L20 14 L40 17 L60 8 L80 12 L100 5 L120 9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
      </div>
    </div>
    <div class="panel tone-cream" style="border-radius:24px;padding:24px;display:flex;align-items:center;gap:20px;">
      <div class="donut" style="width:80px;height:80px;border-radius:999px;display:flex;align-items:center;justify-content:center;flex-shrink:0"><div style="width:56px;height:56px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:var(--panel)"><span style="font-weight:900;font-size:18px">${d.attendRate}</span></div></div>
      <div><p class="dim" style="font-size:14px;font-weight:700;margin:0">정모 출석률</p><p class="dim" style="font-size:12px;margin:4px 0 0">지난주 대비 <span style="font-weight:700;color:var(--bunny-deep)">${d.attendDelta}</span></p><p class="dim" style="font-size:12px;margin:2px 0 0">${d.attendCount}</p></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:18px;">
      <div class="panel tone-light" style="border-radius:24px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex:1"><div><p class="dim" style="font-size:12px;font-weight:700;margin:0">가입 대기</p><p style="font-size:24px;font-weight:900;margin:0">${d.joinPending}</p></div><i class="fa-solid fa-user-clock" style="font-size:20px;color:var(--ice)"></i></div>
      <div class="panel tone-cream" style="border-radius:24px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex:1"><div><p class="dim" style="font-size:12px;font-weight:700;margin:0">출석 주의</p><p style="font-size:24px;font-weight:900;margin:0">${d.attendWarn}</p></div><i class="fa-solid fa-triangle-exclamation" style="font-size:20px;color:var(--amber)"></i></div>
    </div>

    <div class="panel" style="border-radius:24px;padding:24px;grid-column:span 2;grid-row:span 2;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;"><h3 style="font-weight:900;font-size:18px;margin:0"><i class="fa-solid fa-list-check" style="margin-right:8px;color:var(--bunny-main)"></i>멤버 현황</h3><a href="members.html" class="dim" style="font-size:12px;font-weight:700;text-decoration:none">전체 보기 <i class="fa-solid fa-chevron-right" style="font-size:10px"></i></a></div>
      <div class="scroll" style="overflow-x:auto;"><table style="width:100%;font-size:14px;border-collapse:collapse;">
        <thead><tr class="dim" style="font-size:12px;font-weight:700;border-bottom:1px solid var(--line)"><th style="text-align:left;padding:10px 8px">닉네임</th><th style="text-align:left;padding:10px 0">역할</th><th style="text-align:center;padding:10px 0">주간점수</th><th style="text-align:center;padding:10px 0">출석</th><th style="text-align:center;padding:10px 8px">상태</th></tr></thead>
        <tbody style="font-weight:500">${tbody}</tbody>
      </table></div>
    </div>

    <div class="panel tone-cream" style="border-radius:24px;padding:24px;display:flex;flex-direction:column;justify-content:space-between;">
      <div style="display:flex;align-items:center;justify-content:space-between"><span class="dim" style="font-size:14px;font-weight:700">보석금 대기</span><i class="fa-solid fa-gem" style="color:var(--bunny-deep)"></i></div>
      <div><p style="font-size:36px;font-weight:900;line-height:1;margin:0">${d.bailPending}</p><p class="dim" style="font-size:12px;font-weight:700;margin:8px 0 0">건 처리 대기중</p></div>
    </div>

    <div class="panel tone-light" style="border-radius:24px;padding:24px;display:flex;flex-direction:column;">
      <span class="dim" style="font-size:14px;font-weight:700;margin-bottom:12px">주간 활동량</span>
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:8px;flex:1;min-height:70px;">${bars}</div>
      <div class="dim" style="display:flex;justify-content:space-between;font-size:10px;font-weight:700;margin-top:8px"><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span><span>일</span></div>
    </div>

    <div class="panel" style="border-radius:24px;padding:24px;grid-column:span 2;display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;"><h3 style="font-weight:900;font-size:16px;margin:0"><i class="fa-solid fa-user-plus" style="margin-right:8px;color:var(--ice)"></i>가입 신청 대기 <span class="chip" style="margin-left:4px;background:var(--bunny-deep);color:#fff">${d.joinPending}</span></h3><a href="requests.html" class="dim" style="font-size:12px;font-weight:700;text-decoration:none">심사하기</a></div>
      <div style="display:flex;flex-direction:column;gap:10px;">${queue}</div>
    </div>
  </div>`;
}

/* ============================================================
 *  페이지별 실데이터 빌더 — PAGES[key] = async () => html
 *  키가 없으면 placeholderHTML(와꾸) 표시.
 *  관리 범위: GUILD = 버니(뚠카롱). 연합 전체로 바꾸려면 필터만 수정.
 * ============================================================ */
/* ===== 팩션 (버니/늑대/쿠거) — DB키·넥슨명·색 ===== */
const FACTIONS = {
  bunny:  { key:'뚠카롱', nexon:'버니', label:'버니', emoji:'🐰', main:'#FF8FAB', light:'#FFC9DE', cream:'#FFE8D6', deep:'#B5446E', bg:'#FFF5F8', p2:'#FFF0F5', p3:'#FFF7EF' },
  wolf:   { key:'뚱카롱', nexon:'늑대', label:'늑대', emoji:'🐺', main:'#6C8EBF', light:'#8B9DC3', cream:'#DCE7F3', deep:'#2C3E57', bg:'#F2F6FB', p2:'#EAF1F9', p3:'#EEF3F8' },
  cougar: { key:'밤카롱', nexon:'쿠거', label:'쿠거', emoji:'🐆', main:'#C98A42', light:'#F0D6A8', cream:'#F5E6CC', deep:'#6E3D1C', bg:'#FBF7F0', p2:'#FBF3E6', p3:'#FAF6EE' },
};
function facKey(){ return 'bunny'; }  // 전역 앱은 버니 고정 (팩션 전환은 길드원 탭에서만)
function fac(){ return FACTIONS[facKey()]||FACTIONS.bunny; }
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
const _memState = { mode:'all' };
async function buildMembers(){
  const FK = FACTIONS[_memFac] || FACTIONS.bunny;
  const { data, error } = await db().from('members')
    .select('name,role,class,level,is_main,main_char_name,join_date')
    .eq('guild', FK.key).order('level',{ascending:false}).limit(2000);
  if(error) throw error;
  _mem = data||[];
  const mains = _mem.filter(m=>m.is_main).length;
  const BTN='padding:8px 14px;border:0;border-radius:10px;font-weight:800;font-size:13px;cursor:pointer;';
  const modeBtns = [['all','전체'],['main','본캐'],['sub','부캐']].map(([v,l])=>
    `<button class="memMode" data-mode="${v}" onclick="_memMode('${v}')" style="${BTN}${v==='all'?'background:var(--bunny-main);color:#fff;':'background:var(--panel-2);color:var(--text);'}">${l}</button>`).join('');
  const controls = `<div class="panel" style="border-radius:20px;padding:14px;margin-bottom:18px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
    <div style="flex:1;min-width:200px;display:flex;align-items:center;gap:8px;background:var(--panel-2);border-radius:12px;padding:10px 14px;">
      <i class="fa-solid fa-magnifying-glass dim"></i>
      <input id="memSearch" oninput="_memApply()" placeholder="닉네임 검색" autocomplete="off" style="border:0;background:transparent;outline:0;color:var(--text);font-size:14px;font-weight:700;width:100%;">
    </div>
    <div style="display:flex;gap:6px;">${modeBtns}</div>
    <select id="memSort" onchange="_memApply()" style="${BTN}background:var(--panel-2);color:var(--text)">
      <option value="level">레벨순</option><option value="name">이름순</option><option value="join">가입일순</option>
    </select>
    <span class="dim" style="font-size:13px;font-weight:800;margin-left:auto"><b id="memCount" style="color:var(--bunny-deep)">${_mem.length}</b>명 · 본캐 ${mains}</span>
  </div>`;
  const facTabs = `<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">${Object.entries(FACTIONS).map(([k,f])=>`<button onclick="_memTab('${k}')" style="border:0;border-radius:12px;padding:9px 18px;font-weight:800;font-size:14px;cursor:pointer;transition:.15s;${k===_memFac?`background:${f.main};color:#fff;box-shadow:0 4px 12px -3px ${f.deep}`:'background:var(--panel-2);color:var(--text)'}">${f.emoji} ${f.label}</button>`).join('')}</div>`;
  return headerHTML('길드원', `${FK.label} · 총 ${_mem.length}명`) + facTabs + controls +
    `<div class="panel" style="border-radius:24px;padding:18px;"><div id="memTbl">${memberRows(_mem)}</div></div>`;
}
window._memTab = async (k)=>{
  if(!FACTIONS[k]) return;
  _memFac = k; _memState.mode = 'all';
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
window._memMode = (v)=>{ _memState.mode=v; document.querySelectorAll('.memMode').forEach(b=>{ const on=b.dataset.mode===v; b.style.background=on?'var(--bunny-main)':'var(--panel-2)'; b.style.color=on?'#fff':'var(--text)'; }); _memApply(); };
window._memApply = ()=>{
  const q=(document.getElementById('memSearch').value||'').trim();
  const sort=document.getElementById('memSort').value;
  let list=_mem.slice();
  if(_memState.mode==='main') list=list.filter(m=>m.is_main);
  else if(_memState.mode==='sub') list=list.filter(m=>!m.is_main);
  if(q) list=list.filter(m=>(m.name||'').includes(q));
  if(sort==='name') list.sort((a,b)=>(a.name||'').localeCompare(b.name||'','ko'));
  else if(sort==='join') list.sort((a,b)=>(b.join_date||'').localeCompare(a.join_date||''));
  else list.sort((a,b)=>(b.level||0)-(a.level||0));
  document.getElementById('memTbl').innerHTML = memberRows(list);
  document.getElementById('memCount').textContent = list.length;
};

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

/* ----- 신청 처리 (가입 큐) ----- */
async function buildRequests(){
  const { data, error } = await db().from('join_requests')
    .select('id,nickname,suro_score,job,prev_guild,status,join_category,admin_note,created_at,processed_at')
    .order('created_at',{ascending:false}).limit(200);
  if(error) throw error;
  const all=data||[];
  const pending=all.filter(r=>!r.status||r.status==='pending');
  const done=all.filter(r=>r.status==='approved'||r.status==='rejected');
  const dt=(s)=> s? s.slice(0,10):'-';
  const card=(r)=>`<div class="panel tone-light" style="border-radius:18px;padding:16px;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div>
        <div style="font-weight:900;font-size:16px">${r.nickname||'-'} <span class="dim" style="font-size:12px;font-weight:700">· ${r.job||'직업?'}</span></div>
        <div class="dim" style="font-size:13px;font-weight:700;margin-top:4px">수로 ${r.suro_score||'-'} · 이전길드 ${r.prev_guild||'-'} · ${r.join_category||'-'}</div>
        <div class="dim" style="font-size:12px;margin-top:3px">${dt(r.created_at)} 신청</div>
      </div>
      <div style="display:flex;gap:6px">
        <button onclick="_joinAct(${r.id},'approved')" style="border:0;border-radius:10px;padding:8px 14px;font-weight:800;color:#fff;background:#1A8A4A;cursor:pointer"><i class="fa-solid fa-check"></i> 승인</button>
        <button onclick="_joinAct(${r.id},'rejected')" style="border:0;border-radius:10px;padding:8px 14px;font-weight:800;color:#fff;background:#C03A3A;cursor:pointer"><i class="fa-solid fa-xmark"></i> 거절</button>
      </div>
    </div></div>`;
  const doneRow=(r)=>`<tr style="border-bottom:1px solid var(--line)">
    <td style="padding:10px 8px;font-weight:800">${r.nickname||'-'}</td>
    <td class="dim" style="font-weight:700">${r.job||'-'}</td>
    <td class="dim" style="font-weight:700">${r.suro_score||'-'}</td>
    <td>${r.status==='approved'?'<span class="chip" style="background:var(--ok-bg);color:var(--ok-tx)">승인</span>':'<span class="chip" style="background:var(--bad-bg);color:var(--bad-tx)">거절</span>'}</td>
    <td class="dim" style="font-weight:700">${dt(r.processed_at||r.created_at)}</td></tr>`;
  const pendingSec = pending.length
    ? pending.map(card).join('')
    : `<div class="panel" style="border-radius:18px;padding:30px;text-align:center"><span class="dim" style="font-weight:800"><i class="fa-solid fa-check-circle" style="color:#1A8A4A;margin-right:6px"></i>대기 중인 가입 신청이 없어요</span></div>`;
  return headerHTML('신청 처리', `가입 대기 ${pending.length}건`) +
    `<h3 style="font-weight:900;font-size:16px;margin:0 0 12px"><i class="fa-solid fa-user-clock" style="color:var(--ice);margin-right:8px"></i>가입 대기 <span class="chip" style="background:var(--bunny-deep);color:#fff;margin-left:4px">${pending.length}</span></h3>
     ${pendingSec}
     <h3 style="font-weight:900;font-size:16px;margin:26px 0 12px"><i class="fa-solid fa-clock-rotate-left" style="color:var(--bunny-main);margin-right:8px"></i>처리 완료 (${done.length})</h3>
     <div class="panel" style="border-radius:24px;padding:18px"><div class="scroll" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px;min-width:480px">
       <thead><tr class="dim" style="font-size:12px;font-weight:700;border-bottom:2px solid var(--line)"><th style="text-align:left;padding:10px 8px">닉네임</th><th style="text-align:left;padding:10px 0">직업</th><th style="text-align:left;padding:10px 0">수로</th><th style="text-align:left;padding:10px 0">결과</th><th style="text-align:left;padding:10px 0">처리일</th></tr></thead>
       <tbody style="font-weight:500">${done.map(doneRow).join('')}</tbody></table></div></div>
     <p class="dim" style="font-size:12px;font-weight:700;margin:14px 0 0"><i class="fa-solid fa-circle-info" style="margin-right:5px"></i>면제·보석금 신청 통합은 추가 예정</p>`;
}
window._joinAct = async (id, status)=>{
  if(!isAdmin()) return alert('운영진만 처리할 수 있어요. 로그인 후 이용해주세요.');
  if(!confirm(status==='approved'?'이 신청을 승인할까요?':'이 신청을 거절할까요?')) return;
  const { error } = await db().from('join_requests').update({ status, processed_at:new Date().toISOString(), processed_by:CURRENT.email }).eq('id',id);
  if(error) return alert('처리 실패: '+error.message);
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
    <td style="font-weight:700">${h.payer||'-'} <i class="fa-solid fa-arrow-right dim" style="font-size:10px;margin:0 4px"></i> ${h.receiver||'-'}</td>
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
async function buildJoinForm(){
  const cats=['지인 추천','길드 혜택/성장','홍보물/길드 이미지','재가입/복귀','기타'];
  const fld=(label,inner)=>`<div style="margin-bottom:16px"><label style="display:block;font-weight:800;font-size:13px;margin-bottom:6px">${label}</label>${inner}</div>`;
  const inp='width:100%;border:1px solid var(--line);background:var(--panel-2);border-radius:12px;padding:11px 14px;font-size:14px;font-weight:600;color:var(--text);outline:0;';
  return headerHTML('가입 신청',`${fac().label} 길드에 들어오기`) +
    `<div class="panel" style="border-radius:24px;padding:26px;max-width:620px">
      ${fld('닉네임 *', `<input id="jf_nick" style="${inp}" placeholder="메이플 캐릭터 닉네임">`)}
      ${fld('수로 점수 *', `<input id="jf_score" style="${inp}" placeholder="예: 50,000">`)}
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
  const nick=v('jf_nick'), score=v('jf_score'), job=v('jf_job');
  if(!nick||!score||!job) return alert('닉네임·수로 점수·직업은 필수예요.');
  const row={ nickname:nick, suro_score:score, job, prev_guild:v('jf_prev')||null, join_category:v('jf_cat'), answers:v('jf_ans')||null, status:'pending', join_source:'bunny-site' };
  const { error } = await db().from('join_requests').insert(row);
  if(error) return alert('신청 실패: '+error.message);
  document.getElementById('pageBody').innerHTML = headerHTML('가입 신청','신청 완료') +
    `<div class="panel" style="border-radius:24px;padding:50px;text-align:center;max-width:620px">
      <div style="font-size:46px;margin-bottom:12px">🐰💌</div>
      <h3 style="font-weight:900;font-size:20px;margin:0 0 8px">가입 신청이 접수됐어요!</h3>
      <p class="dim" style="font-weight:700;margin:0">운영진이 검토 후 처리할게요. 조금만 기다려주세요.</p></div>`;
};

/* ----- 수로 분석 (회차별 점수 랭킹) ----- */
let _anPeriods=[], _anMembers={};
async function buildAnalysis(){
  const [{data:periods,error:ep},{data:mem,error:em}] = await Promise.all([
    db().from('suro_periods').select('id,period_label,start_date').order('start_date',{ascending:false}).limit(80),
    db().from('members').select('id,name,role').eq('guild',GUILD).limit(3000),
  ]);
  if(ep) throw ep; if(em) throw em;
  _anPeriods=periods||[]; _anMembers={}; (mem||[]).forEach(m=>_anMembers[m.id]={name:m.name,role:m.role});
  const first=_anPeriods[0];
  const sel=`<div class="panel" style="border-radius:20px;padding:14px;margin-bottom:18px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
    <span style="font-weight:800"><i class="fa-solid fa-calendar-week" style="color:var(--bunny-main);margin-right:6px"></i>회차</span>
    <select id="anPeriod" onchange="_anLoad(this.value)" style="border:1px solid var(--line);background:var(--panel-2);border-radius:10px;padding:9px 14px;font-weight:800;font-size:14px;color:var(--text);outline:0;flex:1;min-width:220px">
      ${_anPeriods.map(p=>`<option value="${p.id}">${p.period_label}</option>`).join('')}
    </select></div>`;
  return headerHTML('수로 분석',`${fac().label} · 회차별 점수`) + sel +
    `<div id="anBody">${first?await analysisBody(first.id):'<div class="panel" style="border-radius:24px;padding:40px;text-align:center"><span class="dim" style="font-weight:700">회차 데이터가 없어요</span></div>'}</div>`;
}
async function analysisBody(pid){
  const { data:scores, error } = await db().from('suro_scores').select('member_id,score').eq('guild',GUILD).eq('period_id',pid).limit(4000);
  if(error) throw error;
  const fmt=(n)=>(Number(n)||0).toLocaleString('ko-KR');
  const list=(scores||[]).map(s=>({ name:_anMembers[s.member_id]?.name||('#'+s.member_id), role:_anMembers[s.member_id]?.role||'', score:Number(s.score)||0 })).sort((a,b)=>b.score-a.score);
  const total=list.length, sum=list.reduce((s,x)=>s+x.score,0), avg=total?Math.round(sum/total):0, zero=list.filter(x=>x.score===0).length, max=list[0]?.score||1;
  const kpi=(l,v,tone,c)=>`<div class="panel ${tone}" style="border-radius:22px;padding:18px;display:flex;flex-direction:column;justify-content:space-between;min-height:104px"><span class="dim" style="font-size:13px;font-weight:700">${l}</span><p style="font-size:28px;font-weight:900;margin:6px 0 0;color:${c||'inherit'}">${v}</p></div>`;
  const rows=list.map((x,i)=>`<tr style="border-bottom:1px solid var(--line)">
    <td style="padding:9px 8px;font-weight:900;color:${i<3?'var(--bunny-deep)':'var(--dim)'};width:44px">${i+1}</td>
    <td style="font-weight:800"><span style="display:inline-flex;align-items:center;gap:8px"><span style="width:26px;height:26px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:900;background:${avatarColor(x.name)}">${(x.name||'?').slice(0,1)}</span>${x.name}</span></td>
    <td>${memRoleChip(x.role)}</td>
    <td style="font-weight:900;width:90px;text-align:right">${fmt(x.score)}</td>
    <td style="width:34%"><div style="height:8px;border-radius:99px;background:var(--panel-2);overflow:hidden"><i style="display:block;height:100%;width:${max?x.score/max*100:0}%;border-radius:99px;background:${x.score===0?'var(--line)':'linear-gradient(90deg,var(--bunny-main),var(--bunny-deep))'}"></i></div></td>
  </tr>`).join('');
  return `<div class="bento" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px">
      ${kpi('참여 인원',total+'명','tone-rose','#fff')}
      ${kpi('평균 점수',fmt(avg),'tone-light')}
      ${kpi('합계',fmt(sum),'tone-cream')}
      ${kpi('미참(0점)',zero+'명','tone-light','var(--bad-tx)')}
    </div>
    <div class="panel" style="border-radius:24px;padding:20px">
      <h3 style="font-weight:900;font-size:16px;margin:0 0 14px"><i class="fa-solid fa-ranking-star" style="color:var(--bunny-main);margin-right:8px"></i>점수 랭킹</h3>
      <div class="scroll" style="overflow-x:auto;max-height:620px;overflow-y:auto"><table style="width:100%;border-collapse:collapse;font-size:14px;min-width:520px">
        <thead><tr class="dim" style="font-size:12px;font-weight:700;border-bottom:2px solid var(--line);position:sticky;top:0;background:var(--panel)"><th style="text-align:left;padding:10px 8px">#</th><th style="text-align:left;padding:10px 0">닉네임</th><th style="text-align:left;padding:10px 0">직위</th><th style="text-align:right;padding:10px 0">점수</th><th style="padding:10px 0 10px 12px">분포</th></tr></thead>
        <tbody style="font-weight:500">${rows||'<tr><td colspan="5" class="dim" style="padding:30px;text-align:center;font-weight:700">이 회차 점수 없음</td></tr>'}</tbody></table></div>
    </div>`;
}
window._anLoad = async (pid)=>{
  const el=document.getElementById('anBody'); if(!el) return;
  el.innerHTML=`<div class="panel" style="border-radius:24px;padding:50px;text-align:center"><span class="dim" style="font-weight:700"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px"></i>불러오는 중…</span></div>`;
  try{ el.innerHTML=await analysisBody(pid); }catch(e){ el.innerHTML=`<div class="panel" style="border-radius:24px;padding:30px;text-align:center"><span class="dim" style="font-weight:700">${e.message||e}</span></div>`; }
};

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

/* ----- 운영진 할 일 (admin_todos · RLS 운영진 전용) ----- */
function todoPrio(p){ const m={urgent:['긴급','var(--bad-tx)','var(--bad-bg)'],high:['높음','var(--warn-tx)','var(--warn-bg)'],normal:['보통','var(--ice)','var(--panel-2)'],low:['낮음','var(--dim)','var(--panel-2)']}; const x=m[p]||m.normal; return `<span class="chip" style="background:${x[2]};color:${x[1]}">${x[0]}</span>`; }
async function buildTodos(){
  let data=[];
  try{ const r=await db().from('admin_todos').select('id,title,note,priority,category,status,due_date').order('created_at',{ascending:false}).limit(300); if(r.error) throw r.error; data=r.data||[]; }catch(e){ data=[]; }
  const rank={urgent:0,high:1,normal:2,low:3};
  const todo=data.filter(t=>t.status!=='done').sort((a,b)=>(rank[a.priority]??2)-(rank[b.priority]??2));
  const done=data.filter(t=>t.status==='done');
  const inp='border:1px solid var(--line);background:var(--panel-2);border-radius:10px;padding:10px 12px;font-size:14px;font-weight:600;color:var(--text);outline:0;';
  const item=(t)=>`<div class="panel tone-light" style="border-radius:14px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px">
    <input type="checkbox" ${t.status==='done'?'checked':''} onchange="_todoToggle(${t.id},this.checked)" style="width:20px;height:20px;cursor:pointer;accent-color:var(--bunny-main)">
    <div style="flex:1"><div style="font-weight:800;${t.status==='done'?'text-decoration:line-through;opacity:.5':''}">${t.title||''}</div>${t.note?`<div class="dim" style="font-size:12px;font-weight:600">${t.note}</div>`:''}</div>
    ${t.category?`<span class="chip" style="background:var(--panel-3);color:var(--bunny-deep)">${t.category}</span>`:''}
    ${todoPrio(t.priority)}
    ${t.due_date?`<span class="dim" style="font-size:12px;font-weight:700">~${t.due_date}</span>`:''}
    <button onclick="_todoDel(${t.id})" style="border:0;background:transparent;color:var(--dim);cursor:pointer"><i class="fa-solid fa-trash"></i></button>
  </div>`;
  return headerHTML('운영진 할 일', `할 일 ${todo.length} · 완료 ${done.length}`) +
    `<div class="panel" style="border-radius:20px;padding:16px;margin-bottom:18px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input id="td_title" placeholder="할 일 입력" style="${inp};flex:1;min-width:200px">
      <input id="td_cat" placeholder="분류(선택)" style="${inp};width:120px">
      <select id="td_prio" style="${inp}"><option value="normal">보통</option><option value="high">높음</option><option value="urgent">긴급</option><option value="low">낮음</option></select>
      <input id="td_due" type="date" style="${inp}">
      <button onclick="_todoAdd()" style="border:0;border-radius:10px;padding:10px 18px;font-weight:800;color:#fff;background:var(--bunny-main);cursor:pointer">추가</button>
    </div>
    ${data.length?'':'<p class="dim" style="font-size:13px;font-weight:700;margin:0 0 14px"><i class="fa-solid fa-circle-info" style="margin-right:5px"></i>운영진 로그인 시 목록이 표시·저장됩니다 (RLS 보호)</p>'}
    <div>${todo.map(item).join('')||'<div class="panel" style="border-radius:14px;padding:24px;text-align:center"><span class="dim" style="font-weight:700">할 일이 없어요</span></div>'}</div>
    ${done.length?`<h3 style="font-weight:900;font-size:14px;margin:20px 0 10px" class="dim">완료 (${done.length})</h3>${done.map(item).join('')}`:''}`;
}
window._todoAdd = async ()=>{
  if(!isAdmin()) return alert('운영진만 추가할 수 있어요.');
  const t=document.getElementById('td_title').value.trim(); if(!t) return alert('할 일을 입력해주세요.');
  const { error } = await db().from('admin_todos').insert({ title:t, category:document.getElementById('td_cat').value.trim()||null, priority:document.getElementById('td_prio').value, due_date:document.getElementById('td_due').value||null, created_by:CURRENT.name||CURRENT.email });
  if(error) return alert('추가 실패: '+error.message); render();
};
window._todoToggle = async (id,done)=>{ const { error } = await db().from('admin_todos').update({ status:done?'done':'todo', done_at:done?new Date().toISOString():null, done_by:done?(CURRENT.name||CURRENT.email):null }).eq('id',id); if(error){ alert('변경 실패: '+error.message); render(); } };
window._todoDel = async (id)=>{ if(!confirm('삭제할까요?')) return; const { error } = await db().from('admin_todos').delete().eq('id',id); if(error) return alert('삭제 실패: '+error.message); render(); };

/* ----- 공통: 설정(site_config) 캐시 + Tailwind 온디맨드 ----- */
let _cfg=null, _cfgId=null;
async function getConfig(){ if(_cfg) return _cfg; const { data, error } = await db().from('site_config').select('id,config').limit(1).maybeSingle(); if(error) throw error; _cfg=data?.config||{}; _cfgId=data?.id; return _cfg; }
function loadTailwind(){ return new Promise((res)=>{ if(window.tailwind||document.getElementById('twcdn')) return res(); const s=document.createElement('script'); s.id='twcdn'; s.src='https://cdn.tailwindcss.com'; s.onload=res; s.onerror=res; document.head.appendChild(s); }); }
function escHtml(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escAttr(s){ return escHtml(s).replace(/"/g,'&quot;'); }

/* ----- 수로 보상 (룰렛 경품 · config) ----- */
async function buildSuroReward(){
  const cfg=await getConfig();
  const items=(cfg.rouletteItems||[]).slice().sort((a,b)=>(b.prob||0)-(a.prob||0));
  const maxP=Math.max(1,...items.map(i=>i.prob||0));
  const pp=cfg.piecePrice, srp=(cfg.suroReward||{}).piecePrice;
  const rows=items.map(it=>`<tr style="border-bottom:1px solid var(--line)">
    <td style="padding:10px 8px;font-weight:800"><span style="display:inline-flex;align-items:center;gap:8px"><span style="width:12px;height:12px;border-radius:3px;background:${it.color||'var(--bunny-main)'};display:inline-block"></span>${it.name||'-'}</span></td>
    <td style="font-weight:900;width:80px">${it.prob!=null?it.prob+'%':'-'}</td>
    <td style="width:38%"><div style="height:8px;border-radius:99px;background:var(--panel-2);overflow:hidden"><i style="display:block;height:100%;width:${(it.prob||0)/maxP*100}%;background:${it.color||'var(--bunny-main)'};border-radius:99px"></i></div></td>
    <td class="dim" style="font-weight:800;text-align:right">${it.value||''}</td></tr>`).join('');
  const kpi=(l,v,tone)=>`<div class="panel ${tone}" style="border-radius:22px;padding:18px"><span class="dim" style="font-size:13px;font-weight:700">${l}</span><p style="font-size:24px;font-weight:900;margin:6px 0 0">${v}</p></div>`;
  return headerHTML('수로 보상','수로 점수 보상 안내') +
    `<div class="bento" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px">
      ${kpi('조각 시세', pp?(Number(pp).toLocaleString()+' 메소'):'-','tone-rose')}
      ${kpi('수로 1점당', srp!=null?(srp+' 메소'):'-','tone-light')}
      ${kpi('룰렛 경품', items.length+'종','tone-cream')}
    </div>
    <div class="panel" style="border-radius:24px;padding:20px">
      <h3 style="font-weight:900;font-size:16px;margin:0 0 14px"><i class="fa-solid fa-dice" style="color:var(--bunny-main);margin-right:8px"></i>룰렛 경품 & 확률</h3>
      <div class="scroll" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px;min-width:480px">
        <thead><tr class="dim" style="font-size:12px;font-weight:700;border-bottom:2px solid var(--line)"><th style="text-align:left;padding:10px 8px">경품</th><th style="text-align:left;padding:10px 0">확률</th><th style="padding:10px 0">분포</th><th style="text-align:right;padding:10px 0">가치</th></tr></thead>
        <tbody style="font-weight:500">${rows||'<tr><td colspan="4" class="dim" style="padding:24px;text-align:center;font-weight:700">보상 데이터 없음</td></tr>'}</tbody></table></div>
      <p class="dim" style="font-size:12px;font-weight:700;margin:14px 0 0"><i class="fa-solid fa-circle-info" style="margin-right:5px"></i>설정(site_config)을 따름 — 보상 조정 시 자동 반영</p>
    </div>`;
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
async function buildSettings(){
  const cfg=await getConfig();
  const g=(cfg.guilds||[]).find(x=>x.name===GUILD)||{};
  const ranks=(cfg.ranks&&cfg.ranks[GUILD])||[];
  const exempt=cfg.suroExempt||[];
  const card=(l,v)=>`<div class="panel" style="border-radius:18px;padding:16px"><div class="dim" style="font-size:12px;font-weight:700">${l}</div><div style="font-size:18px;font-weight:900;margin-top:4px">${v}</div></div>`;
  const chips=(arr,active)=>arr.map((r,i)=>`<span class="chip" style="background:${active&&active.includes(r)?'var(--bunny-deep)':'var(--panel-2)'};color:${active&&active.includes(r)?'#fff':'var(--text)'}">${i+1}. ${r}</span>`).join(' ');
  return headerHTML('설정',`${fac().label} 길드 설정 (site_config)`) +
    `<div class="bento" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
      ${card('길드', (g.icon||'')+' '+(g.name||GUILD))}
      ${card('분류 · 정원', (g.type||'-')+' · '+(g.max||'-')+'명')}
      ${card('창립일', cfg.guildStartDate||'-')}
    </div>
    <div class="panel" style="border-radius:20px;padding:20px;margin-bottom:16px">
      <h3 style="font-weight:900;font-size:15px;margin:0 0 12px">직위 위계 (높은 순)</h3>
      <div style="display:flex;flex-wrap:wrap;gap:7px">${chips(ranks,exempt)||'<span class="dim">없음</span>'}</div>
      <p class="dim" style="font-size:12px;font-weight:700;margin:12px 0 0">진한 칩 = 수로 면제 직위 · ${cfg.suroExemptNote||''}</p>
    </div>
    <div class="panel" style="border-radius:20px;padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px;flex-wrap:wrap">
        <h3 style="font-weight:900;font-size:15px;margin:0"><i class="fa-solid fa-code" style="margin-right:6px;color:var(--bunny-main)"></i>고급 — 전체 설정 JSON</h3>
        <button onclick="_settingsSave()" style="border:0;border-radius:10px;padding:10px 20px;font-weight:800;color:#fff;background:var(--bunny-main);cursor:pointer"><i class="fa-solid fa-floppy-disk"></i> 저장</button>
      </div>
      <textarea id="set_json" rows="18" style="width:100%;border:1px solid var(--line);background:var(--panel-2);border-radius:12px;padding:12px;font-family:ui-monospace,monospace;font-size:12px;line-height:1.5;color:var(--text);outline:0;resize:vertical">${escHtml(JSON.stringify(cfg,null,2))}</textarea>
      <p class="dim" style="font-size:12px;font-weight:700;margin:12px 0 0"><i class="fa-solid fa-triangle-exclamation" style="margin-right:5px"></i>직위·승강기준·보상 전부 여기서 관리 — JSON 형식 깨지면 저장 안 됨. 운영진만 가능.</p>
    </div>`;
}
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

/* ----- 수로 입력 (회차별 점수 일괄 입력) ----- */
let _siMembers=[], _siPid=null;
async function buildSuroInput(){
  const { data:periods, error } = await db().from('suro_periods').select('id,period_label').order('start_date',{ascending:false}).limit(80);
  if(error) throw error;
  _siPid=periods?.[0]?.id;
  const inp='border:1px solid var(--line);background:var(--panel-2);border-radius:10px;padding:9px 12px;font-weight:800;font-size:14px;color:var(--text);outline:0;';
  return headerHTML('수로 입력','회차별 점수 일괄 입력') +
    `<div class="panel" style="border-radius:20px;padding:14px;margin-bottom:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <span style="font-weight:800"><i class="fa-solid fa-calendar-week" style="color:var(--bunny-main);margin-right:6px"></i>회차</span>
      <select id="si_period" onchange="_siLoad(this.value)" style="${inp};flex:1;min-width:220px">${(periods||[]).map(p=>`<option value="${p.id}">${p.period_label}</option>`).join('')}</select>
      <button onclick="_siSave()" style="border:0;border-radius:10px;padding:10px 22px;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--bunny-main),var(--bunny-deep));cursor:pointer"><i class="fa-solid fa-floppy-disk"></i> 저장</button>
    </div>
    <div id="siBody">${_siPid?await siBody(_siPid):'<div class="panel" style="border-radius:24px;padding:40px;text-align:center"><span class="dim" style="font-weight:700">회차가 없어요</span></div>'}</div>`;
}
async function siBody(pid){
  const [{data:members},{data:scores}] = await Promise.all([
    db().from('members').select('id,name,role').eq('guild',GUILD).eq('is_main',true).limit(3000),
    db().from('suro_scores').select('member_id,score').eq('guild',GUILD).eq('period_id',pid).limit(4000),
  ]);
  const sm={}; (scores||[]).forEach(s=>sm[s.member_id]=Number(s.score)||0);
  _siMembers=(members||[]).slice().sort((a,b)=>(sm[b.id]||0)-(sm[a.id]||0));
  const rows=_siMembers.map(m=>`<tr style="border-bottom:1px solid var(--line)">
    <td style="padding:7px 8px;font-weight:800">${m.name}</td><td>${memRoleChip((m.role||'').trim()||'-')}</td>
    <td style="width:160px"><input class="si_in" data-mid="${m.id}" type="number" inputmode="numeric" value="${sm[m.id]!=null?sm[m.id]:''}" placeholder="0" style="width:100%;border:1px solid var(--line);background:var(--panel-2);border-radius:8px;padding:7px 10px;font-weight:800;text-align:right;color:var(--text);outline:0"></td></tr>`).join('');
  return `<div class="panel" style="border-radius:24px;padding:18px">
    <p class="dim" style="font-size:13px;font-weight:700;margin:0 0 12px">본캐 ${_siMembers.length}명 · 점수 입력 후 저장 (빈칸은 미반영)</p>
    <div class="scroll" style="overflow-y:auto;max-height:640px"><table style="width:100%;border-collapse:collapse;font-size:14px">
      <thead><tr class="dim" style="font-size:12px;font-weight:700;border-bottom:2px solid var(--line);position:sticky;top:0;background:var(--panel)"><th style="text-align:left;padding:10px 8px">닉네임</th><th style="text-align:left;padding:10px 0">직위</th><th style="text-align:right;padding:10px 0">점수</th></tr></thead>
      <tbody style="font-weight:500">${rows||'<tr><td colspan="3" class="dim" style="padding:24px;text-align:center;font-weight:700">멤버 없음</td></tr>'}</tbody></table></div>
  </div>`;
}
window._siLoad = async (pid)=>{ _siPid=pid; const el=document.getElementById('siBody'); el.innerHTML=`<div class="panel" style="border-radius:24px;padding:50px;text-align:center"><span class="dim" style="font-weight:700"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px"></i>불러오는 중…</span></div>`; try{ el.innerHTML=await siBody(pid); }catch(e){ el.innerHTML=`<div class="panel" style="border-radius:24px;padding:30px;text-align:center"><span class="dim" style="font-weight:700">${e.message||e}</span></div>`; } };
window._siSave = async ()=>{
  if(!isAdmin()) return alert('운영진만 저장할 수 있어요.');
  const payload=[...document.querySelectorAll('.si_in')].filter(i=>i.value!=='').map(i=>({ member_id:+i.dataset.mid, period_id:_siPid, score:Number(i.value)||0, guild:GUILD }));
  if(!payload.length) return alert('입력된 점수가 없어요.');
  if(!confirm(`${payload.length}명의 점수를 저장할까요?`)) return;
  const { error } = await db().from('suro_scores').upsert(payload,{onConflict:'member_id,period_id'});
  if(error) return alert('저장 실패: '+error.message+'\n(고유 제약이 다르면 알려줘요)');
  alert(`${payload.length}명 점수 저장됐어요 ✓`);
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
window._syncRun=async ()=>{
  if(!nexonKey()) return alert('먼저 Nexon API Key를 등록해주세요.');
  const world=document.getElementById('nx_world').value;
  const box=document.getElementById('syncResult');
  const step=(m)=>{ box.innerHTML=`<div class="dim" style="font-weight:700;padding:14px"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px"></i>${m}</div>`; };
  try{
    step(`${NEXON_GUILD} 길드 ID 조회 (${world})`);
    const { oguild_id } = await nexonFetch('/maplestory/v1/guild/id',{ guild_name:NEXON_GUILD, world_name:world });
    step(`${NEXON_GUILD} 길드원 목록 조회`);
    const basic = await nexonFetch('/maplestory/v1/guild/basic',{ oguild_id });
    const roster = basic.guild_member || [];
    const rosterSet = new Set(roster);
    step('DB와 비교 중');
    const { data:dbm, error } = await db().from('members').select('name,is_main').eq('guild',GUILD).limit(3000);
    if(error) throw error;
    const dbNames = new Set((dbm||[]).map(m=>m.name));
    const added = roster.filter(n=>!dbNames.has(n));
    const left = (dbm||[]).filter(m=>m.is_main!==false && !rosterSet.has(m.name)).map(m=>m.name);
    window._syncAdded=added; window._syncLeft=left;
    const list=(arr,color)=>arr.length?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">${arr.map(n=>`<span class="chip" style="background:var(--panel-2);color:${color}">${n}</span>`).join('')}</div>`:'<div class="dim" style="font-size:13px;font-weight:700;margin-top:6px">없음</div>';
    box.innerHTML=`
      <div class="bento" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
        <div class="panel tone-rose" style="border-radius:18px;padding:16px;color:#fff"><div style="font-size:13px;font-weight:700;opacity:.9">넥슨 길드원</div><div style="font-size:26px;font-weight:900">${roster.length}</div></div>
        <div class="panel tone-light" style="border-radius:18px;padding:16px"><div class="dim" style="font-size:13px;font-weight:700">신규</div><div style="font-size:26px;font-weight:900;color:var(--ok-tx)">${added.length}</div></div>
        <div class="panel tone-cream" style="border-radius:18px;padding:16px"><div class="dim" style="font-size:13px;font-weight:700">탈퇴 의심</div><div style="font-size:26px;font-weight:900;color:var(--bad-tx)">${left.length}</div></div>
      </div>
      <div style="font-weight:900;font-size:14px;margin:10px 0 0">신규 길드원 ${added.length} ${added.length?`<button onclick="_syncAdd()" style="border:0;border-radius:8px;padding:6px 14px;font-weight:800;color:#fff;background:#1A8A4A;cursor:pointer;margin-left:8px">부캐로 추가</button>`:''}</div>${list(added,'var(--ok-tx)')}
      <div style="font-weight:900;font-size:14px;margin:16px 0 0">탈퇴 의심 ${left.length}</div>${list(left,'var(--bad-tx)')}`;
  }catch(e){ box.innerHTML=`<div class="panel" style="border-radius:16px;padding:20px;text-align:center"><span style="font-weight:800;color:var(--bad-tx)">${e.message||e}</span><p class="dim" style="font-size:12px;font-weight:700;margin:8px 0 0">키·월드·길드명을 확인해주세요.</p></div>`; }
};
window._syncAdd=async ()=>{
  if(!isAdmin()) return alert('운영진만 추가할 수 있어요.');
  const added=window._syncAdded||[]; if(!added.length) return;
  if(!confirm(`${added.length}명을 길드원(부캐)으로 추가할까요?\n※ 라이브 공유 DB에 반영됩니다.`)) return;
  const rows=added.map(name=>({ name, guild:GUILD, is_main:false, join_date:new Date().toISOString().slice(0,10) }));
  const { error } = await db().from('members').insert(rows);
  if(error) return alert('추가 실패: '+error.message);
  alert(`${rows.length}명 추가됐어요 ✓`); _syncRun();
};

const PAGES = {
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
async function buildBailForm(){
  const inp='width:100%;border:1px solid var(--line);background:var(--panel-2);border-radius:12px;padding:11px 14px;font-size:14px;font-weight:600;color:var(--text);outline:0;';
  const fld=(l,i)=>`<div style="margin-bottom:16px"><label style="display:block;font-weight:800;font-size:13px;margin-bottom:6px">${l}</label>${i}</div>`;
  const facOpts=Object.values(FACTIONS).map(f=>`<option value="${f.key}">${f.label} (${f.key})</option>`).join('');
  return headerHTML('보석금 신청','수로 미참 보석금 납부 (노블 해제용)') +
    `<div class="panel" style="border-radius:24px;padding:26px;max-width:620px">
      <div class="dim" style="font-size:12px;font-weight:700;background:var(--panel-2);border-radius:12px;padding:12px;margin-bottom:18px;line-height:1.6">
        <i class="fa-solid fa-circle-info" style="color:var(--bunny-main);margin-right:5px"></i>보석금 = <b style="color:var(--text)">길드 기준액 × 누진세 × 미참 회차</b><br>
        기준액: 버니 80 · 늑대 40 · 쿠거 20 / 누진세: 같은 반기(${curHalfYear()}) 재신청 시 ×2 → ×3 가산
      </div>
      ${fld('납부 캐릭명 *', `<input id="bf_char" style="${inp}" placeholder="보석금 낼 캐릭 닉네임">`)}
      ${fld('소속 길드 *', `<select id="bf_guild" style="${inp}">${facOpts}</select>`)}
      ${fld('미참 회차 수 *', `<input id="bf_offense" type="number" min="1" value="1" style="${inp}">`)}
      ${fld('카톡 닉네임', `<input id="bf_kakao" style="${inp}" placeholder="운영진 확인용">`)}
      ${fld('사유', `<input id="bf_reason" style="${inp}" placeholder="예: 단순 미참">`)}
      ${fld('증빙 이미지 URL', `<input id="bf_proof" style="${inp}" placeholder="선택 (스샷 링크)">`)}
      <button onclick="_bailSubmit()" style="width:100%;border:0;border-radius:14px;padding:14px;font-weight:900;font-size:15px;color:#fff;background:linear-gradient(135deg,var(--bunny-main),var(--bunny-deep));cursor:pointer;margin-top:6px">보석금 납부 신청 💎</button>
      <p class="dim" style="font-size:12px;font-weight:700;margin:14px 0 0;text-align:center">신청 후 운영진이 확인하면 노블 해제돼요</p>
    </div>`;
}
window._bailSubmit = async ()=>{
  const v=id=>document.getElementById(id).value.trim();
  const char=v('bf_char'), guild=v('bf_guild'), offense=Math.max(1,parseInt(v('bf_offense'))||1);
  if(!char) return alert('납부 캐릭명을 입력해주세요.');
  const base=BASE_AMOUNT[guild]||20, half=curHalfYear();
  let prior=0;
  try{ const { count } = await db().from('bail_requests').select('id',{count:'exact',head:true}).eq('payer_char',char).eq('half_year',half); prior=count||0; }catch(e){}
  const multi=prior+1, total=base*multi*offense;
  if(!confirm(`${char} · 기준 ${base} × ${multi}배 × ${offense}회 = ${total}개\n신청할까요?`)) return;
  const { error } = await db().from('bail_requests').insert({
    payer_char:char, payer_guild:guild, base_amount:base, multiplier:multi, total_amount:total,
    offense_count:offense, half_year:half, reason:v('bf_reason')||null, kakao_nick:v('bf_kakao')||null,
    proof_image_url:v('bf_proof')||null, status:'pending'
  });
  if(error) return alert('신청 실패: '+error.message);
  document.getElementById('pageBody').innerHTML = headerHTML('보석금 신청','신청 완료') +
    `<div class="panel" style="border-radius:24px;padding:48px;text-align:center;max-width:620px"><div style="font-size:46px;margin-bottom:12px">💎✅</div><h3 style="font-weight:900;font-size:20px;margin:0 0 8px">보석금 신청 완료!</h3><p class="dim" style="font-weight:700;margin:0">${char} · 총 <b style="color:var(--bunny-deep)">${total}개</b> · 운영진 확인 후 노블 해제</p></div>`;
};

/* ----- 아이템 컨설팅 (넥슨 장비 조회) ----- */
async function buildConsulting(){
  const inp='border:1px solid var(--line);background:var(--panel-2);border-radius:12px;padding:11px 14px;font-size:14px;font-weight:600;color:var(--text);outline:0;';
  return headerHTML('아이템 컨설팅','캐릭터 장비 조회') +
    `<div class="panel" style="border-radius:24px;padding:22px;margin-bottom:16px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input id="ct_char" onkeydown="if(event.key==='Enter')_consultFetch()" placeholder="캐릭터 닉네임" style="${inp};flex:1;min-width:200px">
        <button onclick="_consultFetch()" style="border:0;border-radius:12px;padding:11px 22px;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--bunny-main),var(--bunny-deep));cursor:pointer"><i class="fa-solid fa-magnifying-glass"></i> 불러오기</button>
      </div>
      <p class="dim" style="font-size:12px;font-weight:700;margin:10px 0 0">넥슨 Open API로 장비·잠재등급을 조회합니다</p>
    </div>
    <div id="consultResult"></div>`;
}
window._consultFetch = async ()=>{
  const name=document.getElementById('ct_char').value.trim(); if(!name) return alert('캐릭터 닉네임을 입력해주세요.');
  const box=document.getElementById('consultResult');
  box.innerHTML=`<div class="panel" style="border-radius:24px;padding:40px;text-align:center"><span class="dim" style="font-weight:700"><i class="fa-solid fa-spinner fa-spin" style="margin-right:8px"></i>${name} 조회 중…</span></div>`;
  try{
    const id=await nexonFetch('/maplestory/v1/id',{character_name:name});
    const [basic,equip]=await Promise.all([
      nexonFetch('/maplestory/v1/character/basic',{ocid:id.ocid}),
      nexonFetch('/maplestory/v1/character/item-equipment',{ocid:id.ocid}),
    ]);
    const items=equip.item_equipment||[];
    const gc=(g)=> g==='레전드리'?'#1A8A4A':g==='유니크'?'#E0A020':g==='에픽'?'#9B59B6':g==='레어'?'#3BA9C7':'var(--dim)';
    const cards=items.map(it=>`<div class="panel tone-light" style="border-radius:16px;padding:12px;display:flex;gap:10px;align-items:center">
      ${it.item_icon?`<img src="${it.item_icon}" style="width:36px;height:36px;image-rendering:pixelated">`:''}
      <div style="flex:1;min-width:0"><div style="font-weight:800;font-size:13px">${it.item_equipment_slot||it.item_equipment_part||''}</div><div class="dim" style="font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.item_name||'-'}</div></div>
      ${it.starforce&&+it.starforce>0?`<span class="chip" style="background:rgba(224,160,32,.15);color:#E0A020">★${it.starforce}</span>`:''}
      ${it.potential_option_grade?`<span class="chip" style="background:${gc(it.potential_option_grade)}22;color:${gc(it.potential_option_grade)}">${it.potential_option_grade}</span>`:''}
    </div>`).join('');
    box.innerHTML=`<div class="panel" style="border-radius:24px;padding:22px;margin-bottom:16px;display:flex;align-items:center;gap:18px">
        ${basic.character_image?`<img src="${basic.character_image}" style="width:96px;height:96px;background:var(--panel-2);border-radius:16px">`:''}
        <div><h3 style="font-weight:900;font-size:20px;margin:0">${basic.character_name||name}</h3>
          <p class="dim" style="font-weight:700;margin:4px 0 0">Lv.${basic.character_level||0} · ${basic.character_class||''}${basic.character_guild_name?' · '+basic.character_guild_name:''}</p></div>
      </div>
      <div class="bento" style="grid-template-columns:repeat(2,1fr)">${cards||'<div class="dim" style="padding:30px;text-align:center;font-weight:700">장비 정보 없음</div>'}</div>`;
  }catch(e){ box.innerHTML=`<div class="panel" style="border-radius:24px;padding:30px;text-align:center"><span style="font-weight:800;color:var(--bad-tx)">${e.message||e}</span><p class="dim" style="font-size:12px;font-weight:700;margin:8px 0 0">닉네임을 확인해주세요.</p></div>`; }
};

/* ----- 버니버디 (랜덤 짝꿍 매칭) ----- */
let _buddyM=[];
async function buildBuddy(){
  const { data, error } = await db().from('members').select('name,role').eq('guild',GUILD).eq('is_main',true).limit(2000);
  if(error) throw error;
  _buddyM=(data||[]).map(m=>m.name);
  return headerHTML('버니버디','멤버 랜덤 짝꿍 매칭') +
    `<div class="panel" style="border-radius:24px;padding:28px;text-align:center">
      <div style="font-size:40px;margin-bottom:10px">🐰💞🐰</div>
      <p style="font-weight:800;margin:0 0 4px">버니 본캐 ${_buddyM.length}명 중에서 랜덤 짝꿍을 뽑아요</p>
      <p class="dim" style="font-size:13px;font-weight:700;margin:0 0 18px">정모 파티·멘토링·이벤트용</p>
      <button onclick="_buddyShuffle()" style="border:0;border-radius:14px;padding:13px 28px;font-weight:900;font-size:15px;color:#fff;background:linear-gradient(135deg,var(--bunny-main),var(--bunny-deep));cursor:pointer">🎲 짝꿍 뽑기</button>
      <div id="buddyResult" style="margin-top:20px"></div>
    </div>`;
}
window._buddyShuffle = ()=>{
  const a=_buddyM.slice();
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  let html='<div style="display:flex;flex-direction:column;gap:10px;max-width:480px;margin:0 auto">';
  for(let i=0;i<a.length;i+=2){
    const p1=a[i], p2=a[i+1];
    html+=`<div class="panel tone-cream" style="border-radius:16px;padding:14px;display:flex;align-items:center;justify-content:center;gap:14px;font-weight:800">
      <span style="display:inline-flex;align-items:center;gap:8px"><span style="width:30px;height:30px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:900;background:${avatarColor(p1)}">${(p1||'?').slice(0,1)}</span>${p1}</span>
      <i class="fa-solid fa-heart" style="color:var(--bunny-main)"></i>
      ${p2?`<span style="display:inline-flex;align-items:center;gap:8px"><span style="width:30px;height:30px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:900;background:${avatarColor(p2)}">${(p2||'?').slice(0,1)}</span>${p2}</span>`:'<span class="dim">혼자 (홀수)</span>'}
    </div>`;
  }
  html+='</div>';
  document.getElementById('buddyResult').innerHTML=html;
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
function render(){
  const app = document.getElementById('app');
  let page = app.dataset.page || 'home';
  if(!META[page] && page!=='home') page = 'home';   // 모르는 키 → 홈으로 폴백
  document.title = (META[page] ? META[page].t + ' · ' : '') + fac().label + ' 길드 관리';

  const blocked = META[page] && META[page].admin && !isAdmin();
  const hasBuilder = !!PAGES[page] && !blocked;

  let content;
  if(page === 'home')        content = homeHTML();
  else if(blocked)           content = denyHTML(page);          // 관리자 전용 차단
  else if(hasBuilder)        content = `<div id="pageBody">${loadingHTML(page)}</div>`;  // 실데이터 페이지
  else                       content = placeholderHTML(page);   // 아직 와꾸

  app.innerHTML = `
    <button id="darkBtn" class="dark-btn panel" onclick="toggleDark()">${localStorage.getItem('bunny_dark')==='1'?'☀️':'🌙'}</button>
    <div class="app-shell">
      ${sidebarHTML(page)}
      <main class="main scroll"><div class="fade" style="padding:28px;">${content}</div></main>
    </div>`;

  // 실데이터 페이지는 DB 준비된 뒤 비동기로 채움
  if(hasBuilder && BACKEND.db){
    PAGES[page]()
      .then(html=>{ const el=document.getElementById('pageBody'); if(el) el.innerHTML = html; })
      .catch(e=>{ const el=document.getElementById('pageBody'); if(el) el.innerHTML = errorHTML(page,e); });
  }
}

/* ---------- 부트 ---------- */
(async function(){
  if(localStorage.getItem('bunny_dark')==='1') document.body.classList.add('dark');
  applyTheme();                   // 팩션 색 적용
  render();                       // 즉시 1차 렌더 (게스트, 빠른 페인트)
  try{
    await loadSupabase();
    BACKEND.db = window.supabase.createClient(BACKEND.SUPABASE_URL, BACKEND.SUPABASE_ANON_KEY);
    await resolveAuth();
    render();                     // 인증 반영 2차 렌더
  }catch(e){ console.warn('[버니] 백엔드 연결 실패 — 게스트로 진행:', e); }
})();

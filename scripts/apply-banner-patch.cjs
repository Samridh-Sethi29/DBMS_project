const fs = require('fs');
const path = require('path');

const targetPaths = [
  path.join(__dirname, '..', 'admin', 'assets', 'index-CVp9-AF-.js'),
  path.resolve(__dirname, '..', '..', 'DBMS_project', 'admin', 'assets', 'index-CVp9-AF-.js')
];

const bannerComponentCode = `function ClubBannerHeader({role:e,currentUser:t,clubs:n}){
  let[r,i]=G.useState(()=>{
    try{
      return localStorage.getItem('campus_club_banner_active')||'/assets/default-club-banner.svg';
    }catch(_e){
      return'/assets/default-club-banner.svg';
    }
  });
  let[a,o]=G.useState(!1);
  let s=G.useRef(null);
  let c=(n||[]).find(e=>e.id===(t?.clubId||'c1'))||(n||[])[0]||{name:'ACM Student Chapter',category:'Technical',memberCount:120};
  let l=e==='super_admin'?'Campus Club Operations':c.name;
  let u=t?.name||'Arjun Mehta';
  let d=e==='chairperson'?'Club Chairperson':e==='super_admin'?'Super Admin':e==='core_member'?'Core Member':'Executive Member';
  let isCustom=r!=='/assets/default-club-banner.svg';

  let m=()=>{if(s.current){s.current.click()}};
  let f=e=>{
    let file=e.target?.files?.[0];
    if(file){
      let reader=new FileReader();
      reader.onload=loadEvt=>{
        let result=loadEvt.target?.result;
        if(result){
          try{
            localStorage.setItem('campus_club_banner_active',result);
          }catch(err){
            console.warn('localStorage error',err);
          }
          i(result);
          o(!0);
          setTimeout(()=>o(!1),4000);
        }
      };
      reader.readAsDataURL(file);
    }
  };
  let h=()=>{
    try{
      localStorage.removeItem('campus_club_banner_active');
    }catch(err){}
    i('/assets/default-club-banner.svg');
  };

  return(0,K.jsxs)('div',{className:'space-y-2',children:[
    (0,K.jsxs)('div',{className:'relative overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-900 text-white shadow-md transition-all',children:[
      (0,K.jsx)('div',{className:'absolute inset-0 bg-cover bg-center transition-all duration-500',style:{backgroundImage:'url('+r+')',filter:'brightness(0.92)'}}),
      (0,K.jsx)('div',{className:'absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/65 to-slate-900/40'}),
      (0,K.jsxs)('div',{className:'relative z-10 flex min-h-[220px] flex-col justify-between p-5 sm:p-7',children:[
        (0,K.jsxs)('div',{className:'flex flex-wrap items-center justify-between gap-3',children:[
          (0,K.jsxs)('div',{className:'inline-flex items-center gap-2 rounded-full border border-white/20 bg-slate-950/75 px-3 py-1 text-xs font-semibold text-emerald-400 backdrop-blur-md',children:[
            (0,K.jsx)('span',{className:'h-2 w-2 rounded-full bg-emerald-400 animate-pulse'}),
            l+' · '+(c.category||'Technical')+' Society'
          ]}),
          (0,K.jsxs)('div',{className:'flex items-center gap-2',children:[
            (0,K.jsx)('input',{ref:s,type:'file',accept:'image/*',style:{display:'none'},onChange:f}),
            (0,K.jsxs)('button',{type:'button',onClick:m,title:'Select any image from your computer to set as club banner',className:'inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/20 hover:bg-white/35 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur-md shadow-sm transition-all cursor-pointer active:scale-95',children:[
              (0,K.jsx)('svg',{className:'h-4 w-4',fill:'none',stroke:'currentColor',viewBox:'0 0 24 24',children:(0,K.jsx)('path',{strokeLinecap:'round',strokeLinejoin:'round',strokeWidth:'2',d:'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'})}),
              'Upload Banner from PC'
            ]}),
            isCustom?(0,K.jsxs)('button',{type:'button',onClick:h,title:'Revert to default demo banner',className:'inline-flex items-center gap-1 rounded-xl border border-white/15 bg-black/50 hover:bg-black/70 px-2.5 py-1.5 text-xs font-medium text-slate-200 backdrop-blur-md transition-all cursor-pointer',children:[
              (0,K.jsx)('svg',{className:'h-3.5 w-3.5',fill:'none',stroke:'currentColor',viewBox:'0 0 24 24',children:(0,K.jsx)('path',{strokeLinecap:'round',strokeLinejoin:'round',strokeWidth:'2',d:'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'})}),
              'Reset Demo'
            ]}):null
          ]})
        ]}),
        a?(0,K.jsx)('div',{className:'my-2 inline-flex items-center gap-2 rounded-lg bg-emerald-500/90 px-3 py-1.5 text-xs font-medium text-white shadow backdrop-blur-md',children:'✓ Banner updated successfully from your PC and saved!'}):null,
        (0,K.jsxs)('div',{className:'mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',children:[
          (0,K.jsxs)('div',{className:'space-y-1.5',children:[
            (0,K.jsxs)('div',{className:'flex items-center gap-3',children:[
              (0,K.jsx)('div',{className:'flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 text-xl font-black text-white shadow-lg border border-white/20',children:(l||'ACM').substring(0,3).toUpperCase()}),
              (0,K.jsxs)('div',{children:[
                (0,K.jsx)('h1',{className:'text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm',children:l}),
                (0,K.jsxs)('p',{className:'text-sm font-medium text-slate-300',children:['Welcome back, ',(0,K.jsx)('span',{className:'font-semibold text-white',children:u}),' · '+d]})
              ]})
            ]}),
            (0,K.jsxs)('div',{className:'flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-300',children:[
              (0,K.jsx)('span',{className:'rounded-md bg-white/10 px-2.5 py-1 font-medium backdrop-blur-sm',children:'👥 '+(c.memberCount||120)+' Members'}),
              (0,K.jsx)('span',{className:'rounded-md bg-white/10 px-2.5 py-1 font-medium backdrop-blur-sm',children:'🏷️ '+(c.category||'Technical')}),
              (0,K.jsx)('span',{className:'rounded-md bg-white/10 px-2.5 py-1 font-medium backdrop-blur-sm',children:'📍 Main Campus'}),
              (0,K.jsx)('span',{className:'rounded-md bg-white/10 px-2.5 py-1 font-medium backdrop-blur-sm text-cyan-300',children:'⚡ HackNova & Sprints'})
            ]})
          ]}),
          (0,K.jsx)('div',{className:'hidden sm:block text-right text-xs text-slate-400',children:'Campus Club Ops Dashboard'})
        ]})
      ]})
    ]}),
    (0,K.jsx)('p',{className:'text-xs sm:text-sm text-slate-500 pt-1',children:"Here's what needs your attention today. Manage club proposals, event schedules, and room allocations."})
  ]});
}`;

const TARGET_WELCOME = '(0,K.jsx)(Av,{title:`Welcome back, ${c?.name.split(` `)[0]??`there`}`,description:`Here\'s what needs your attention today. All figures come from simulated demo data.`})';
const REPLACEMENT_WELCOME = '(0,K.jsx)(ClubBannerHeader,{role:e,currentUser:c,clubs:t})';

let patchedCount = 0;
for (const p of targetPaths) {
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    if (content.includes('function ClubBannerHeader(')) {
      console.log('Already contains ClubBannerHeader:', p);
      // update the component definition
      const startIdx = content.indexOf('function ClubBannerHeader(');
      const endMarker = 'function Rv(){';
      const endIdx = content.indexOf(endMarker);
      if (startIdx !== -1 && endIdx !== -1) {
        content = content.substring(0, startIdx) + bannerComponentCode + content.substring(endIdx);
        fs.writeFileSync(p, content, 'utf8');
        console.log('Updated existing ClubBannerHeader in:', p);
        patchedCount++;
      }
      continue;
    }

    if (!content.includes('function Rv(){')) {
      console.error('Cannot find function Rv() in:', p);
      continue;
    }

    if (!content.includes(TARGET_WELCOME)) {
      console.error('Cannot find TARGET_WELCOME in:', p);
      continue;
    }

    // Insert bannerComponentCode right before function Rv()
    content = content.replace('function Rv(){', bannerComponentCode + 'function Rv(){');
    // Replace Welcome back with ClubBannerHeader
    content = content.replace(TARGET_WELCOME, REPLACEMENT_WELCOME);

    fs.writeFileSync(p, content, 'utf8');
    console.log('Successfully patched banner into:', p);
    patchedCount++;
  } else {
    console.log('File does not exist:', p);
  }
}

console.log(`Done. Patched ${patchedCount} files.`);

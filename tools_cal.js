const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1000,height:700}});const er=[];p.on('pageerror',e=>er.push(e.message.slice(0,200)));
await p.addInitScript(()=>{try{localStorage.setItem('victoria-tut','no')}catch(e){}});
await p.goto('file:///home/user/Victoria-3/index.html');await p.waitForSelector('#start .st-card',{timeout:250000});
await p.click('.st-card[data-tag=PRU]');await p.click('button[data-act=start]');await p.waitForTimeout(2000);
const out=await p.evaluate(()=>{G.paused=true;G.headless=true;
 const ERAS={'1840 ánima lisa':[],'1860 rayado':['percussion_cap','drill_regs','rifled_muskets'],'1870 retrocarga':['percussion_cap','drill_regs','rifled_muskets','breech_loaders','steel_artillery','general_staff'],'1910 ametralladora':['percussion_cap','drill_regs','rifled_muskets','breech_loaders','steel_artillery','general_staff','machine_guns','quick_firing'],'1918 trincheras':['percussion_cap','drill_regs','rifled_muskets','breech_loaders','steel_artillery','general_staff','machine_guns','quick_firing','trench_warfare']};
 let pid=0;for(let i=0;i<MAP.provs.length;i++){const t=MAP.provs[i].terr;if(t&&Math.abs(t.def-1)<0.02&&!(t.mnt>0.1)&&G.S[provState(i)]){pid=i;break}}
 const res={};const A_='FRA',B_='AUS';
 const comps={'6i1c1a':['inf','inf','inf','inf','inf','inf','cav','art'],'8inf':Array(8).fill('inf')};
 for(const [en,techs] of Object.entries(ERAS)){
  for(const [cn,comp] of Object.entries(comps)){
   for(const mode of ['att-front','def-hold']){
   let days=0,lA=0,lB=0,n=24,winA=0,fullA=0,fullB=0;
   for(let k=0;k<n;k++){
    [A_,B_].forEach(t=>{G.C[t].techs=new Set(techs)});
    const mk=(tag)=>mkArmy(tag,provState(pid),comp.map(t=>mkDivision(t,0.5)),'x');
    const a1=mk(A_),a2=mk(B_);a1.gen.lvl=2;a2.gen.lvl=2;
    const b={id:G.nextBattleId++,prov:pid,state:provState(pid),A:[a1.id],B:[a2.id],A0:A_,B0:B_,day:0,att:'A',hist:[]};G.battles.push(b);a1.battle=b.id;a2.battle=b.id;a1.arrived=G.date.t+1;a2.arrived=G.date.t;
    const men0=comp.length*MEN_PER_DIV;let g=0;
    while(!b.ended&&g++<60){battleDay(b)}
    days+=b.day;lA+=(b.lostA||0)/men0;lB+=(b.lostB||0)/men0;if(b.ended&&G.lastEnded===b){}
    G.armies=G.armies.filter(a=>a.id!==a1.id&&a.id!==a2.id);G.battles=G.battles.filter(x=>x!==b);
   }
   res[en+' | '+cn]={dias:+(days/n).toFixed(1),bajasAtac:+(100*lA/n).toFixed(1),bajasDef:+(100*lB/n).toFixed(1),ratio:+(lA/Math.max(1e-6,lB)).toFixed(2)};break}
  }
 }
 return res});
for(const [k,v] of Object.entries(out))console.log(k.padEnd(34),JSON.stringify(v));console.log(er);await b.close()})();

// Evaluator pass: actual inputs only. No writes to model, health, money, equipment or clocks.
const {createHarness,out}=require('./harness.cjs'),fs=require('fs'),assert=require('assert');
function saveRun(name,result){const {trace,...summary}=result;fs.writeFileSync(out+name,JSON.stringify(summary,null,2).slice(0,-2)+',\n  "trace": [\n'+trace.map(x=>'    '+JSON.stringify(x)).join(',\n')+'\n  ]\n}\n');}
async function run(style,seconds){const h=await createHarness({width:393,height:852},true),trace=[],actions=[];try{
 const click=async id=>{const p=await h.run('return c.root.getComponent(cc.UITransform).convertToNodeSpaceAR(c.ui.get(arg).node.worldPosition);',id);await h.tap(p.x,p.y);actions.push(id);};
 await click('start');await h.page.waitForTimeout(400);let key='',shopWave=0,shotAt=0,started=Date.now(),s;
 while(Date.now()-started<seconds*1000){
  s=await h.run('return {phase:c.model.phase,wave:c.model.wave,remaining:c.model.remaining,elapsed:c.model.elapsed,hp:c.model.hp,kills:c.model.kills,gold:c.model.gold,energy:c.model.energy,uses:c.model.overloadUses,ready:c.model.overloadReady,boss:!!c.model.boss,levels:{...c.model.levels},offers:c.model.shopOffers.map(o=>o?{...o}:null)};');
  trace.push(s);
  if(s.phase==='downed'){await click('revive:end');await h.shot('review-'+style+'-defeat');break;}
  if(s.phase==='dead'||s.phase==='victory'){await h.shot('review-'+style+'-result');break;}
  if(s.phase==='shop'){
   if(key){await h.page.keyboard.up(key);key='';}
   if(shopWave!==s.wave){await h.shot('review-'+style+'-shop-'+s.wave);shopWave=s.wave;}
   const order=['twin','watch','blast','crystal','pierce','ring','flame','core'];
   const choices=s.offers.map((o,i)=>({o,i})).filter(v=>v.o&&!v.o.sold&&v.o.price<=s.gold).sort((a,b)=>order.indexOf(a.o.id)-order.indexOf(b.o.id));
   if(choices.length)await click('offer:'+choices[0].i);else await click('continue');
  }else if(s.phase==='battle'){
   if(style.startsWith('moving')){
    const next=['d','w','a','s'][Math.floor(s.elapsed/2)%4];
    if(next!==key){if(key)await h.page.keyboard.up(key);key=next;await h.page.keyboard.down(key);}
    if(s.ready)await click('overload');
   }
   if(s.elapsed>=shotAt||s.boss){await h.shot('review-'+style+'-wave-'+s.wave+(s.boss?'-boss':''));shotAt=s.elapsed+20;}
  }
  await h.page.waitForTimeout(500);
 }
 if(key)await h.page.keyboard.up(key);
 assert.deepEqual(h.errors,[]);
 return {style,wallSeconds:(Date.now()-started)/1000,last:s,trace,actions,errors:h.errors};
 }finally{await h.browser.close();}}
(async()=>{if(!process.env.RUNE_REVIEW_LONG){const stationary=await run('stationary',75);saveRun('review-stationary.json',stationary);console.log('stationary',stationary.last);}const style=process.env.RUNE_REVIEW_LONG?'moving-long':'moving',moving=await run(style,process.env.RUNE_REVIEW_LONG?560:190);saveRun('review-'+style+'.json',moving);console.log(style,moving.last);})().catch(e=>{console.error(e);process.exit(1)});

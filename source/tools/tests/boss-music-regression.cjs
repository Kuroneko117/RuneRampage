const ts=require('D:/WeChatGameDev/Tools/CocosCreator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
const fs=require('fs'),path=require('path'),assert=require('assert'),cache={};
function load(name){if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;const code=ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../../assets/scripts/'+name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;new Function('require','module','exports',code)(n=>load(n.slice(2)),module,module.exports);return module.exports;}
const {ArenaModel,RULES}=load('ArenaModel'),{RecordsService}=load('RecordsService'),{MusicDirector}=load('MusicDirector');
const checks=[];function check(name,fn){fn();checks.push(name);}
function model(wave=5,mode='campaign'){const m=new ArenaModel();m.endlessUnlocked=mode==='endless';assert(m.reset(mode));m.wave=wave;m.invulnerable=1000;m.attackClock=1e6;return m;}
check('5/10/15/20 和无限每五波在剩余15秒进入，普通怪持续存在，存活 Boss 不延时',()=>{
 for(const mode of ['campaign','endless'])for(const wave of (mode==='campaign'?[5,10,15,20]:[5,10,15,20,25,50])){
  const m=model(wave,mode);m.spawnClock=0;m.waveTime=9.98;m.step(.01,0,0);assert(!m.boss);m.step(.01,0,0);assert(m.boss);assert(m.enemies.some(e=>e.kind!=='boss'));assert.equal(m.phase,'battle');
  m.boss.mode='waveTell';m.hostiles.push({id:999,x:0,y:200,vx:0,vy:0,life:10,radius:5});m.queueBlast(0,0,40,5,2);
  m.waveTime=24.99;const before=m.gold;m.step(.1,0,0);assert.equal(m.waveTime,25);assert.equal(m.boss,null);assert.equal(m.bossClears,0);assert.equal(m.gold,before);assert(!m.blessingAvailable);assert(!m.finalBossDefeated);
  assert.equal(m.phase,mode==='campaign'&&wave===20?'victory':'shop');
  for(const key of ['enemies','bolts','coins','explosions','hostiles'])assert.equal(m[key].length,0,key);
  const elapsed=m.elapsed;m.step(.1,1,1);assert.equal(m.elapsed,elapsed);
  if(m.phase==='shop'){assert(m.nextWave());assert.equal(m.wave,wave+1);assert.equal(m.waveTime,0);assert(!m.boss);}
 }
});
check('提前击杀只奖励一次，不提前结束；奖励商店只对真实击杀开放',()=>{
 for(const wave of [5,20]){const m=model(wave);m.waveTime=10;m.enterBoss();const e=m.boss.enemy;const reward=e.reward;
  m.damage(e,1e9,e.x,e.y,false,false);m.damage(e,1e9,e.x,e.y,false,false);assert.equal(m.kills,1);assert.equal(m.coins.reduce((a,c)=>a+c.value,0),reward);
  m.step(.01,0,0);assert.equal(m.phase,'battle');assert.equal(m.bossClears,1);assert(!m.boss);assert.equal(m.finalBossDefeated,wave===20);
  const earned=m.earned;m.waveTime=24.99;m.step(.1,0,0);assert.equal(m.bossClears,1);assert.equal(m.earned,reward);assert(m.earned>=earned);
  if(wave===5){assert(m.blessingAvailable);assert(m.shopOffers.some(o=>o?.quality==='rare'));const gold=m.gold;m.step(.1,0,0);assert.equal(m.gold,gold);}
  else assert.equal(m.phase,'victory');
 }
});
check('截止帧死亡优先；复活不跳过未结束波次；计时已结束复活正确通关',()=>{
 const m=model(20);m.waveTime=24.99;m.hp=1;m.invulnerable=0;m.spawnClock=1000;m.spawn();const e=m.enemies[0];e.x=m.x;e.y=m.y;e.speed=0;e.hp=1e6;
 m.step(.1,0,0);assert.equal(m.phase,'dead');assert.equal(m.waveTime,25);assert(!m.endlessUnlocked);assert(m.holdForRevive());assert(m.revive());assert.equal(m.phase,'victory');assert.equal(m.hp,3);assert.equal(m.invulnerable,2);assert(!m.finalBossDefeated);
 const early=model(20);early.waveTime=15;early.bossRewardThisWave=true;early.hp=0;early.phase='dead';early.holdForRevive();early.revive();assert.equal(early.phase,'battle');
});
check('最终 Boss 额外击破成就迁移/持久化/幂等；生存胜利不伪造击破',()=>{
 const data={},storage={getItem:k=>data[k]||null,setItem:(k,v)=>data[k]=v};let records=new RecordsService(storage);
 const win=model(20);win.waveTime=25;win.step(.1,0,0);records.finish('survival',win);assert.equal(records.data.campaign.clears,1);assert.equal(records.data.campaign.finalBossKills,0);
 win.finalBossDefeated=true;win.bossClears=4;records.finish('slayer',win);records.finish('slayer',win);records=new RecordsService(storage);assert.equal(records.data.campaign.finalBossKills,1);assert.equal(records.data.campaign.bossKills,4);assert.equal(records.data.campaign.clears,2);win.reset();assert(!win.finalBossDefeated);
 const old=new RecordsService({getItem:()=>JSON.stringify({version:1,campaign:{wave:20,clears:2},endless:{wave:35}}),setItem:()=>{}});assert.equal(old.data.campaign.finalBossKills,0);assert.equal(old.data.campaign.clears,2);
});
check('完整20波生存通关500秒、四次Boss进入、无限21-30波均按25秒结束',()=>{
 for(const mode of ['campaign','endless']){const m=model(mode==='campaign'?1:21,mode);let entries=0,previousBoss=false;
  for(let frame=0;frame<40000;frame++){
   if(m.phase==='shop'){assert.equal(m.waveTime,25);if(mode==='endless'&&m.wave===30)break;assert(m.nextWave());}
   if(m.phase==='victory')break;
   m.invulnerable=1000;m.attackClock=1e6;m.step(1/60,Math.sin(frame*.003),Math.cos(frame*.003));
   if(m.boss&&!previousBoss)entries++;previousBoss=!!m.boss;
  }
  if(mode==='campaign'){assert.equal(m.phase,'victory');assert.equal(m.wave,20);assert(Math.abs(m.elapsed-500)<1e-6);assert.equal(entries,4);}
  else {assert.equal(m.phase,'shop');assert.equal(m.wave,30);assert(Math.abs(m.elapsed-250)<1e-6);assert.equal(entries,2);}
 }
});
check('单音乐声道淡出切换淡入；重复路由不重播；快速切换服从最终场景',()=>{
 let active=0,scene=null,vol=0,starts=0,stops=0,resumes=0,pauses=0;
 const d=new MusicDirector({available:s=>s!=='missing',start:s=>{assert.equal(active,0);active++;scene=s;starts++;},pause:()=>{assert.equal(active,1);active=0;pauses++;},resume:()=>{assert.equal(active,0);active=1;resumes++;},stop:()=>{active=0;stops++;},volume:v=>{assert(v>=0&&v<=.65);vol=v;}});
 const tick=(n=10)=>{for(let i=0;i<n;i++)d.update(.05);};tick();assert.equal(starts,0);d.unlock();tick();assert.equal(scene,'menu');assert(vol>0);for(let i=0;i<100;i++){d.setScene('menu');d.update(.016);}assert.equal(starts,1);
 d.setScene('boss');d.update(.05);assert.equal(scene,'menu');assert(d.gain<1);tick();assert.equal(scene,'boss');assert.equal(active,1);assert.equal(starts,2);
 d.setScene('shop');d.update(.05);d.setScene('boss');tick();assert.equal(starts,2);
 for(let i=0;i<100;i++){d.setSuspended(true);const count=starts;tick();assert.equal(active,0);d.setSuspended(true);d.setSuspended(false);tick();assert.equal(active,1);assert.equal(starts,count);}assert.equal(pauses,100);assert.equal(resumes,100);
 d.setVolume(0);assert.equal(active,0);tick();d.setVolume(.5);tick();assert.equal(active,1);assert.equal(starts,2);
 d.setSuspended(true);d.setScene('victory');tick();d.setSuspended(false);tick();assert.equal(scene,'victory');assert.equal(starts,3);
 d.setScene('missing');tick();assert.equal(active,0);assert.equal(d.current,null);d.setScene('battle');tick();assert.equal(scene,'battle');d.dispose();assert.equal(active,0);tick();assert.equal(active,0);
 assert(stops>=3);
});
const output=path.resolve(__dirname,'../../docs/boss-aura-bgm');fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'logic-results.json'),JSON.stringify({checks,passed:checks.length,note:'纯逻辑测试含无伤定位，不等于手机性能或自然通关体验测试。'},null,2));console.log({passed:checks.length,checks});

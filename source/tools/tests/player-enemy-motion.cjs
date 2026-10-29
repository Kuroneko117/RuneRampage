const {createHarness,out}=require('./harness.cjs'),fs=require('fs'),path=require('path'),assert=require('assert');
const sharp=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const {execFileSync}=require('child_process'),prefix=process.argv[2]||'after',combat=process.argv.includes('--combat');
(async()=>{const h=await createHarness({width:393,height:852},true),rows=[];try{
 await h.run('c.restart();if(!c.model.inCombat)return {__reload:true};c.model.invulnerable=1000;c.model.spawnClock=1000;c.model.attackClock=1000;c.model.spawn(false,"slime");c.model.spawn(false,"bat");const s=c.model.enemies[0],b=c.model.enemies[1];s.x=-180;s.y=90;b.x=180;b.y=230;s.hp=b.hp=100000;');
 if(combat)await h.run('c.model.attackClock=0;c.model.levels.watch=3;c.model.refreshStats();');
 await h.page.locator('#GameCanvas').focus();const start=Date.now();let held='';
 const folder=path.join(out,prefix+'-frames');fs.mkdirSync(folder,{recursive:true});
 for(let i=0;i<36;i++){
  const key=i<8?'d':i<24?'a':i<32?'d':'';
  if(key!==held){if(held)await h.page.keyboard.up(held);if(key)await h.page.keyboard.down(key);held=key;}
  const state=await h.run(`const names=['player','slime','bat'];const actors=[c.player,...['slime','bat'].map(k=>c.enemyViews.get(c.model.enemies.find(e=>e.kind===k).id))];return {time:c.visualClock,world:[c.model.x,c.model.y],actors:actors.map((n,i)=>{const p=c.worldCamera.worldToScreen(n.worldPosition),v=i===0?c.playerBody:n;return {name:names[i],x:p.x,y:p.y,sx:v.scale.x,sy:v.scale.y};}),w:cc.screen.windowSize.width,h:cc.screen.windowSize.height};`);
  const bytes=await h.page.locator('#GameCanvas').screenshot(),box=await h.page.locator('#GameCanvas').boundingBox();
  const crops=[];for(const a of state.actors){const cx=a.x/state.w*box.width,cy=(1-a.y/state.h)*box.height;const rect={left:Math.max(0,Math.min(Math.round(cx-48),Math.floor(box.width)-96)),top:Math.max(0,Math.min(Math.round(cy-90),Math.floor(box.height)-110)),width:96,height:110};crops.push(await sharp(bytes).extract(rect).png().toBuffer());}
  await sharp({create:{width:288,height:110,channels:4,background:'#111423'}}).composite(crops.map((input,j)=>({input,left:j*96,top:0}))).png().toFile(path.join(folder,String(i).padStart(3,'0')+'.png'));
  rows.push({...state,ms:Date.now()-start});if(i===5||i===12||i===22)fs.writeFileSync(path.join(out,prefix+'-game-'+i+'.png'),bytes);
  await h.page.waitForTimeout(40);
 }
 if(held)await h.page.keyboard.up(held);assert.deepEqual(h.errors,[]);
 fs.writeFileSync(path.join(out,prefix+'-comparison.json'),JSON.stringify({rows,errors:h.errors,combat,attackSounds:await h.run('return c.audio.getDiagnostics().played.attack;'),note:'Actual Cocos 393x852 native crops: player/slime/bat. External invulnerability and spawn timer; clean comparison suppresses attacks, --combat restores actual automatic attacks. Enemy chase stays active. Not device FPS.'},null,2));
 execFileSync('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',[path.join(__dirname,'../create-squash-preview.py'),out,prefix]);
 console.log({prefix,samples:rows.length,errors:h.errors});
}finally{await h.browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

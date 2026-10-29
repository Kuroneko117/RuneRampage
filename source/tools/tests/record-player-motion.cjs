const {createHarness,out}=require('./harness.cjs'),fs=require('fs'),assert=require('assert'),path=require('path'),{execFileSync}=require('child_process');
// Actual desktop Cocos compositor frames, encoded afterwards. Direct WebGL
// captureStream can silently produce a 110-byte empty WebM on headless Edge.
(async()=>{const h=await createHarness({width:393,height:852},true);try{
 await h.run('c.restart();if(!c.model.inCombat)return {__reload:true};c.model.invulnerable=1000;c.model.levels.watch=3;c.model.refreshStats();c.model.spawn(false,"slime");const e=c.model.enemies[0];e.x=220;e.y=0;e.hp=e.maxHp=100000;e.speed=0;');
 await h.page.locator('#GameCanvas').focus();
 const images=[],times=[];const start=Date.now();let state='';
 for(let i=0;i<120;i++){
   const desired=i<24?'idle':i<66?'d':i<102?'a':'idle';
   if(desired!==state){if(state==='d'||state==='a')await h.page.keyboard.up(state);if(desired==='d'||desired==='a')await h.page.keyboard.down(desired);state=desired;}
   images.push((await h.page.screenshot({type:'jpeg',quality:90})).toString('base64'));times.push(Date.now()-start);
   const wait=(i+1)*1000/24-(Date.now()-start);if(wait>0)await h.page.waitForTimeout(wait);
 }
 if(state==='d'||state==='a')await h.page.keyboard.up(state);await h.run('c.paused=true;');
 fs.writeFileSync(out+'captured-compositor-frames.json',JSON.stringify({images,times}));
 execFileSync(process.env.RUNE_PYTHON||'C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',[path.join(__dirname,'../encode-walk-capture.py'),out]);
 assert.deepEqual(h.errors,[]);const result={...JSON.parse(fs.readFileSync(out+'capture-gif-info.json','utf8')),errors:h.errors,sequence:'待机→右移施法→左移施法→停步',webm:'本机headless MediaRecorder无有效帧，改用实际合成器采样GIF；正式渲染配置不变。'};
 if(fs.existsSync(out+'player-motion-after.webm'))fs.unlinkSync(out+'player-motion-after.webm');
 fs.writeFileSync(out+'recording-info.json',JSON.stringify(result,null,2));console.log(result);await h.shot('player-motion-after');
 }finally{await h.browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

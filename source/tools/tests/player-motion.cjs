const {createHarness,out}=require('./harness.cjs'),fs=require('fs'),assert=require('assert');
(async()=>{const h=await createHarness({width:393,height:852},true);try{
 await h.run('c.restart();if(!c.model.inCombat)return {__reload:true};c.model.invulnerable=1000;');
 await h.page.locator('#GameCanvas').focus();await h.page.keyboard.down('d');
 assert(await h.run('return c.keys.has(cc.KeyCode.KEY_D);'),'Keyboard fixture must focus the actual game canvas');
 const samples=await h.run(`const rows=[];for(const fps of [30,60,120,240]){
   c.model.x=0;c.model.y=0;c.accumulator=0;c.playerStride=0;c.playerMoveBlend=0;c.model.invulnerable=1000;
   let noStep=0,falseIdle=0,flips=0,bodyFrames=new Set(),maxDelta=0,lastY=0,opaque=true,minX=1,maxX=1,minY=1,maxY=1,footError=0,rootStable=true;
   for(let i=0;i<fps;i++){const x=c.model.x;c.update(1/fps);if(c.model.x===x){noStep++;if(!c.moving)falseIdle++;}if(c.facing!==1)flips++;const sprite=c.playerBody.getComponent(cc.Sprite);bodyFrames.add(sprite.spriteFrame===c.art.named('player_idle_02'));const y=c.playerBody.position.y;maxDelta=Math.max(maxDelta,Math.abs(y-lastY));lastY=y;opaque=opaque&&c.player.getComponent(cc.UIOpacity).opacity===255;
    const s=c.playerBody.scale;minX=Math.min(minX,s.x);maxX=Math.max(maxX,s.x);minY=Math.min(minY,s.y);maxY=Math.max(maxY,s.y);
    const f=c.playerBody.getComponent(cc.UITransform).convertToWorldSpaceAR(new cc.Vec3(0,112/88,0));footError=Math.max(footError,Math.abs(f.y-c.player.worldPosition.y-112/88));rootStable=rootStable&&c.player.scale.x===1&&c.player.scale.y===1;
   }
   rows.push({fps,noStep,falseIdle,flips,poseStable:bodyFrames.size===1&&bodyFrames.has(true),minX,maxX,minY,maxY,footError,rootStable,maxDelta,opaque,distance:c.model.x});
 }return rows;`);
 for(const row of samples){assert(row.maxX-row.minX>.10&&row.maxY-row.minY>.15,'Player must visibly squash/stretch like existing enemies');assert(row.poseStable&&row.rootStable&&row.footError<.001);assert(row.opaque);assert.equal(row.falseIdle,0);assert.equal(row.flips,0);assert(row.maxDelta<.9);assert(Math.abs(row.distance-220)<.01);}assert(samples.find(r=>r.fps===120).noStep>=59);
 const continuity=await h.run(`const before=c.playerStride;c.castClock=.16;c.model.energy=100;c.model.overloadCooldown=0;c.model.activateOverload();c.update(1/60);
 const after=c.playerStride,correctFrame=c.playerBody.getComponent(cc.Sprite).spriteFrame===c.art.named('player_idle_02');
 c.paused=true;const sx=c.playerBody.scale.x,sy=c.playerBody.scale.y;c.update(.1);
 const pauseStable=c.playerStride===after&&sx===c.playerBody.scale.x&&sy===c.playerBody.scale.y;c.paused=false;
 return {clockAdvanced:Math.abs(after-before-1/60)<1e-8,correctFrame,pauseStable};`);
 assert(continuity.clockAdvanced&&continuity.correctFrame&&continuity.pauseStable,'Casting/overload/pause must retain locomotion phase');
 await h.page.keyboard.up('d');await h.page.waitForTimeout(400);await h.shot('player-idle-stable');
 const settled=await h.run('return Math.max(Math.abs(c.playerBody.scale.x-1),Math.abs(c.playerBody.scale.y-1));');assert(settled<.002,'Stopping must ease back to the resting silhouette');
 const idle=await h.run('const x=c.player.position.x,y=c.player.position.y;let bad=0;for(let i=0;i<180;i++){c.update(1/60);if(c.playerBody.getComponent(cc.Sprite).spriteFrame!==c.art.named("player_idle_02")||c.facing!==1||c.player.position.x!==x||c.player.position.y!==y)bad++;}return {bad,attacks:c.audio.getDiagnostics().played.attack};');assert.equal(idle.bad,0);
 const overload=await h.run('c.model.energy=100;c.model.overloadCooldown=0;c.model.activateOverload();c.update(1/60);const frame=c.playerBody.getComponent(cc.Sprite).spriteFrame;c.model.overload=.001;c.update(1/60);return {same:frame===c.playerBody.getComponent(cc.Sprite).spriteFrame,alpha:c.player.getComponent(cc.UIOpacity).opacity};');assert(overload.same&&overload.alpha===255);await h.shot('player-overload-stable');
 assert.deepEqual(h.errors,[]);const result={samples,continuity,settled,idle,overload,errors:h.errors,note:'按用户新要求改为与怪物一致的挤压/拉伸式移动。实际Cocos外部控制30/60/120/240Hz更新，不等于手机帧率；形变只作用人物视觉层，世界根/脚底不漂移，停步平滑复位。'};fs.writeFileSync(out+'player-motion-results.json',JSON.stringify(result,null,2));console.log(result);
 }finally{await h.browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

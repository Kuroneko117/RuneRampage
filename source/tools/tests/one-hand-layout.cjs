const fs=require('fs'),assert=require('assert'),{createHarness,out}=require('./harness.cjs');
(async()=>{const results=[];for(const viewport of [{width:320,height:568},{width:360,height:800},{width:393,height:852},{width:412,height:915},{width:768,height:1024}]){
 const h=await createHarness(viewport,true);try{
  await h.run('c.restart();if(!c.model.inCombat)return {__reload:true};c.model.energy=100;c.model.invulnerable=1000;globalThis.wx={getWindowInfo:()=>({windowWidth:arg.width,windowHeight:arg.height,safeArea:{left:0,right:arg.width,top:44,bottom:arg.height-34}}),getMenuButtonBoundingClientRect:()=>({bottom:84})};c.fit();',viewport);
  const boxes=[];for(const point of [{x:-355,y:-575},{x:355,y:-575},{x:-355,y:460},{x:355,y:460},{x:0,y:-100}]){
   const box=await h.run('c.ui.shortcut.setAvailable(true);c.ui.shortcut.begin(arg.x,arg.y);c.ui.update(.016,c.model,true);const node=c.ui.get("overloadQuick").node,b=node.getComponent(cc.UITransform).getBoundingBoxToWorld(),visible=cc.view.getVisibleSize();return {x:b.x,y:b.y,w:b.width,h:b.height,screenW:visible.width,screenH:visible.height,cx:c.ui.shortcut.x,cy:c.ui.shortcut.y,hitW:node.getComponent(cc.UITransform).width,hitH:node.getComponent(cc.UITransform).height};',point);
   assert(box.x>=-box.screenW/2&&box.y>=-box.screenH/2&&box.x+box.w<=box.screenW/2&&box.y+box.h<=box.screenH/2);
   const top=await h.point(box.cx-box.hitW/2,box.cy+box.hitH/2),bottom=await h.point(box.cx+box.hitW/2,box.cy-box.hitH/2);const pixels={width:Math.abs(bottom.x-top.x),height:Math.abs(bottom.y-top.y)};assert(pixels.width>=44&&pixels.height>=44,JSON.stringify({viewport,pixels}));boxes.push({point,pixels});
  }await h.shot('touch-safe-'+viewport.width+'x'+viewport.height);assert.deepEqual(h.errors,[]);results.push({viewport,boxes,errors:h.errors});
 }finally{await h.browser.close();}
}fs.writeFileSync(out+'one-hand-layout.json',JSON.stringify({results,note:'五种竖屏和外部注入微信胶囊/手势安全区，按钮有效触控区至少44 CSS像素；不等于手机截图。'},null,2));console.log('One-hand safe area passed',results.map(r=>r.viewport));})().catch(e=>{console.error(e);process.exit(1)});

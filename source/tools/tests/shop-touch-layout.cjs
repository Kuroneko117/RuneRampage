const {createHarness,out}=require('./harness.cjs'),fs=require('fs'),assert=require('assert');
(async()=>{const rows=[];for(const viewport of [{width:320,height:568},{width:360,height:800},{width:393,height:852},{width:412,height:915},{width:768,height:1024}]){const h=await createHarness(viewport,true);try{
 await h.run('c.restart();if(!c.model.inCombat)return {__reload:true};c.model.enterShop();c.model.gold=10000;c.model.levels.twin=5;c.model.refreshStats();c.model.blessingAvailable=true;c.applyPhase();globalThis.wx={getWindowInfo:()=>({windowWidth:arg.width,windowHeight:arg.height,safeArea:{left:0,right:arg.width,top:44,bottom:arg.height-34}}),getMenuButtonBoundingClientRect:()=>({bottom:84})};c.fit();',viewport);
 for(const tab of ['gear','boost']){
  await h.run('c.shopPage=arg;c.refreshShop();',tab);
  const buttons=await h.run('return c.ui.buttons.filter(b=>b.node.activeInHierarchy).map(b=>{const t=b.node.getComponent(cc.UITransform),r=c.root.getComponent(cc.UITransform),a=r.convertToNodeSpaceAR(t.convertToWorldSpaceAR(new cc.Vec3(-b.width/2,-b.height/2))),z=r.convertToNodeSpaceAR(t.convertToWorldSpaceAR(new cc.Vec3(b.width/2,b.height/2)));return {id:b.id,x:(a.x+z.x)/2,y:(a.y+z.y)/2,w:z.x-a.x,h:z.y-a.y};});');
  for(const b of buttons){const a=await h.point(b.x-b.w/2,b.y+b.h/2),z=await h.point(b.x+b.w/2,b.y-b.h/2);assert(a.x>=-.01&&z.x<=viewport.width+.01&&a.y>=84-.01&&z.y<=viewport.height-34+.01,JSON.stringify({viewport,b,a,z}));assert(z.x-a.x>=44&&z.y-a.y>=44,JSON.stringify({viewport,b,w:z.x-a.x,h:z.y-a.y}));}
  for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){const a=buttons[i],b=buttons[j];assert(Math.abs(a.x-b.x)>=(a.w+b.w)/2-.01||Math.abs(a.y-b.y)>=(a.h+b.h)/2-.01,'Overlapping buttons '+a.id+' '+b.id);}
  await h.shot('shop-'+tab+'-'+viewport.width);rows.push({viewport,tab,buttons:buttons.length});
 }assert.deepEqual(h.errors,[]);
 }finally{await h.browser.close();}}
 fs.writeFileSync(out+'shop-layout-results.json',JSON.stringify({rows,note:'模拟含胶囊/刘海/手势安全区；可见商店按钮均>=44CSS像素且不交叠。'},null,2));console.log('Shop targets and spacing passed',rows);})().catch(e=>{console.error(e);process.exit(1)});

const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=process.env.RUNE_TEST_OUTPUT||__dirname+'/../../docs/ui-v08-screenshots/';require('fs').mkdirSync(out,{recursive:true});
async function createHarness(viewport={width:900,height:1400},mobile=false){
 const browser=await chromium.launch({headless:true,channel:'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport,hasTouch:mobile,isMobile:mobile}),page=await context.newPage(),errors=[],engineWarnings=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()!=='error')return;const t=m.text();if(t.startsWith('Ignored attempt to cancel a touchcancel event with cancelable=false'))engineWarnings.push(t);else errors.push(t);});
 for(let attempt=0;attempt<60;attempt++){try{await page.goto('http://localhost:'+(process.env.RUNE_PREVIEW_PORT||7457)+'/?scene=b3e46595-303a-4173-afd9-0e726e52eb28');break;}catch(e){if(!e.message.includes('ERR_CONNECTION_REFUSED')||attempt===59)throw e;await page.waitForTimeout(350);}}
 await page.waitForFunction(async()=>{if(typeof System==='undefined')return false;const cc=await System.import('cc');const c=cc.director.getScene()?.getChildByName('GameController')?.getComponent('RuneRampage');return c?.art?.ready&&c?.audio?.ready&&c?.uiFontReady&&c?.ui?.skinReady;},null,{timeout:45000});
 await page.evaluate(()=>document.querySelector('[data-device="WebpageFullScreen"]')?.click());await page.waitForTimeout(350);
 await page.waitForFunction(async()=>{const cc=await System.import('cc');return cc.director.getScene()?.getChildByName('GameController')?.getComponent('RuneRampage')?.ui?.clock>.25;},null,{timeout:15000});
 const run=async(code,arg)=>{for(let i=0;i<200;i++){let result;try{result=await page.evaluate(async({code,arg})=>{if(typeof System==='undefined')return {__reload:true};const cc=await System.import('cc');const c=cc.director.getScene()?.getChildByName('GameController')?.getComponent('RuneRampage');if(!c?.root||!c?.art?.ready||!c.uiFontReady||!c.audio?.ready)return {__reload:true};return new Function('c','cc','arg',code)(c,cc,arg);},{code,arg});}catch(e){if(!e.message.includes('Execution context was destroyed'))throw e;result={__reload:true};}if(!result?.__reload)return result;await page.waitForTimeout(100);}throw new Error('Scene did not settle');};
 const point=async(x,y)=>{const s=await run('const p=c.root.getComponent(cc.UITransform).convertToWorldSpaceAR(new cc.Vec3(arg.x,arg.y,0)),s=c.canvas.cameraComponent.worldToScreen(p);return {x:s.x,y:s.y,w:cc.screen.windowSize.width,h:cc.screen.windowSize.height};',{x,y});const box=await page.locator('#GameCanvas').boundingBox();return {x:box.x+s.x/s.w*box.width,y:box.y+(1-s.y/s.h)*box.height};};
 const tap=async(x,y)=>{const p=await point(x,y);if(mobile)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await page.waitForTimeout(70);};
 const shot=n=>page.locator('#GameCanvas').screenshot({path:out+n+'.png'});
 return {browser,page,context,errors,engineWarnings,run,point,tap,shot};
}
module.exports={createHarness,out};

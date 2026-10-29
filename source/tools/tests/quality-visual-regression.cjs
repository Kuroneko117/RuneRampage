const {createHarness,out}=require('./harness.cjs'),assert=require('assert'),fs=require('fs');
(async()=>{const h=await createHarness({width:393,height:852},true);try{
 await h.run('c.restart();if(!c.model.inCombat)return {__reload:true};c.model.invulnerable=999;');
 const colors=await h.run(`c.model.enemies.length=0;c.model.wave=12;c.model.spawn(true,'slime');const e=c.model.enemies[0];e.x=100;e.y=20;e.hit=0;c.syncActors(true);const n=c.enemyViews.get(e.id);const color=n.getComponent(cc.Sprite).color;return {r:color.r,g:color.g,b:color.b};`);
 assert(colors.r>colors.b&&colors.g>130,'Elite must retain its warm-gold identification after frame selection, not reset to white');
 const goldBounds=await h.run('c.model.gold=12345678;c.refreshHud();const g=c.ui.refs.goldLabel,p=c.ui.get("pause");const a=g.node.getComponent(cc.UITransform).getBoundingBoxToWorld(),b=p.node.getComponent(cc.UITransform).getBoundingBoxToWorld();return {text:g.string,noWrap:!g.enableWrapText,shrink:g.overflow===cc.Label.Overflow.SHRINK,separate:a.x+a.width<b.x};');assert(goldBounds.noWrap&&goldBounds.shrink&&goldBounds.separate,'Large gold balance must stay inside its own HUD column, clear of pause');
 await h.run('c.model.reset();c.model.enterShop();c.model.gold=35;c.applyPhase();');
 const labels=await h.run('return c.shopCards.map(v=>({name:v.name.fontSize,effect:v.effect.fontSize,icon:v.icon.getComponent(cc.UITransform).width}));');
 assert(labels.every(x=>x.name>=30&&x.effect>=26&&x.icon>=60),'Shop must spend its area on legible names, effects and equipment icons');
 const states=await h.run('return c.ui.buttons.filter(b=>b.node.activeInHierarchy).map(b=>({id:b.id,enabled:b.component.interactable}));');
 const press=await h.run('const b=c.ui.get("continue"),s=b.node.scale.clone();b.node.emit(cc.Node.EventType.TOUCH_START);const stable=b.node.scale.equals(s);b.node.emit(cc.Node.EventType.TOUCH_CANCEL);return stable;');assert(press,'Press feedback must not shrink the native touch target');
 const iconSource=await h.run('const t=cc.resources.get("art/ui/overload/texture",cc.Texture2D);return !!t&&c.ui.overloadGem.spriteFrame.texture===t&&c.ui.quickGem.spriteFrame.texture===t;');assert(iconSource,'Both overload views must use one dedicated texture source');
 await h.shot('shop-quality');assert.deepEqual(h.errors,[]);
 fs.writeFileSync(out+'quality-visual-results.json',JSON.stringify({colors,goldBounds,labels,states,pressTargetStable:press,overloadTextureCorrect:iconSource,errors:h.errors,note:'Actual Cocos render with external elite/shop setup, not a natural playthrough.'},null,2));
 console.log('Quality visual regressions passed');
 }finally{await h.browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

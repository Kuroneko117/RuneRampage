const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),build=path.join(root,'build/wechatgame');
const walk=p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(f=>f.isDirectory()?walk(path.join(p,f.name)):[path.join(p,f.name)]);
const files=walk(build),bytes=files.reduce((sum,p)=>sum+fs.statSync(p).size,0),config=JSON.parse(fs.readFileSync(path.join(build,'project.config.json'),'utf8').replace(/^\uFEFF/,'')),game=JSON.parse(fs.readFileSync(path.join(build,'game.json'),'utf8').replace(/^\uFEFF/,''));
assert.equal(config.appid,'wx4f1fd04878261d71');assert.equal(game.deviceOrientation,'portrait');assert.equal(game.openDataContext,'openDataContext');assert(bytes<3*1024*1024);assert(files.every(p=>!p.includes('tools/tests')));
const sourceDomain=fs.readFileSync(path.join(root,'platform/open-data-context/index.js')),domain=fs.readFileSync(path.join(build,'openDataContext/index.js'));assert(sourceDomain.equals(domain));
const allJS=files.filter(p=>p.endsWith('.js')).map(p=>fs.readFileSync(p,'utf8')).join('\n');for(const marker of ['test-only','__resolveAd','__samples','Math.random()*1000'])assert(!allJS.includes(marker),'Unexpected fixture: '+marker);
const keySource=fs.readFileSync(path.join(root,'assets/scripts/ProductConfig.ts'),'utf8');assert(/REWARDED_AD_UNIT_ID:\s*''/.test(keySource));
const byExtension={};for(const p of files){const e=path.extname(p);byExtension[e]=(byExtension[e]||0)+fs.statSync(p).size;}
const report={appId:config.appid,files:files.length,bytes,MiB:bytes/(1024*1024),budgetBytes:3*1024*1024,byExtension,openDataContext:game.openDataContext,adUnitConfigured:false,fixtureMarkersAbsent:true,manifest:files.map(p=>({path:path.relative(build,p).replaceAll('\\','/'),bytes:fs.statSync(p).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}))};
fs.writeFileSync(process.env.RUNE_BUILD_REPORT||path.join(root,'docs/UI_V08_BUILD.json'),JSON.stringify(report,null,2));console.log({...report,manifest:undefined});

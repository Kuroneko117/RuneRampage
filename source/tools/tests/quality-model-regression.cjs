// Pure-model fixtures. Uses the project's pinned Creator TypeScript; no engine or platform SDK.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const ts = require('D:/WeChatGameDev/Tools/CocosCreator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
const root = path.resolve(__dirname, '../..');
const label = process.argv[2] || 'current';
assert.match(label, /^[a-z0-9-]+$/);
const baseline = process.argv[3];
if (baseline) assert.match(baseline, /^[a-f0-9]{7,40}$/);
const output = path.join(root, 'docs/quality-overhaul-20261028/model-test-build', label);
fs.mkdirSync(output, { recursive: true });
const cache = {};
function load(name) {
    if (cache[name]) return cache[name].exports;
    const module = cache[name] = { exports: {} };
    const source = baseline
        ? cp.execFileSync('git', ['show', `${baseline}:assets/scripts/${name}.ts`], { cwd: root, encoding: 'utf8' })
        : fs.readFileSync(path.join(root, 'assets/scripts', name + '.ts'), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    fs.writeFileSync(path.join(output, name + '.js'), code);
    new Function('require', 'module', 'exports', code)(n => load(n.slice(2)), module, module.exports);
    return module.exports;
}
const { ArenaModel, RULES } = load('ArenaModel');
const { EQUIPMENT } = load('Equipment');
const checks = [];
function check(name, run) {
    try { const evidence = run(); checks.push({ name, passed: true, evidence }); }
    catch (error) { checks.push({ name, passed: false, error: error.message }); }
}
function model(wave = 1, mode = 'campaign', random = () => .99) {
    const m = new ArenaModel(random);
    m.endlessUnlocked = true;
    assert(m.reset(mode));
    m.wave = wave;
    m.spawnClock = m.attackClock = 999;
    return m;
}
function enemy(m, x, y, hp = 100) {
    m.spawn(false, 'slime');
    const e = m.enemies[m.enemies.length - 1];
    Object.assign(e, { x, y, hp, maxHp: hp, speed: 0, ranged: false });
    return e;
}
function events(m, type) {
    const found = [];
    m.consumeEvents(e => { if (e.type === type) found.push({ ...e }); });
    return found;
}

// Reintroducing nearest-edge spawning makes every wall fixture lose HP on the entry frame.
for (const [x, y] of [[-702,0],[702,0],[0,-1062],[0,1062],[-702,-1062],[-702,1062],[702,-1062],[702,1062],[0,0]]) {
    check(`G1 safe Boss entry at ${x},${y}`, () => {
        const m = model(5); m.x = x; m.y = y; m.waveTime = 9.99;
        m.step(1 / 60, 0, 0);
        assert.equal(m.hp, 5, 'Boss entry must not inflict immediate contact damage');
        const e = m.boss.enemy;
        const entry = events(m, 'bossStart')[0];
        assert(entry.x === -668 || entry.x === 668 || entry.y === -1028 || entry.y === 1028);
        assert(Math.hypot(entry.x - x, entry.y - y) >= 140, 'entry retains 70-unit spawn margin');
        assert(e.x >= -668 && e.x <= 668 && e.y >= -1028 && e.y <= 1028);
        const distance = Math.hypot(e.x - x, e.y - y);
        assert(distance > 70, 'Boss must start outside combined collision radii');
        m.step(1 / 60, 0, 0);
        assert(Math.hypot(e.x - x, e.y - y) < distance, 'Boss must still approach');
        return { hp: m.hp, distance };
    });
}
check('G1 contact and rune damage remain active', () => {
    const m = model(5); m.enterBoss();
    m.boss.enemy.x = m.x; m.boss.enemy.y = m.y;
    m.step(1 / 60, 0, 0); assert.equal(m.hp, 4);
    m.invulnerable = 0; m.boss.enemy.x = 600; m.boss.enemy.y = 600;
    m.updateHostiles(1.1); assert.equal(m.hp, 3);
    const dash = model(5); dash.enterBoss(); dash.hostiles.length = 0;
    dash.boss.enemy.x = -80; dash.boss.enemy.y = 0;
    Object.assign(dash.boss, { mode: 'dash', clock: .7, vx: 600, vy: 0 });
    dash.step(.1,0,0); assert.equal(dash.hp,4);
});
check('G1 each Boss wave emits entry once', () => {
    for (const wave of [5,10,15,20]) {
        const m = model(wave); m.waveTime = 9.99; m.invulnerable = 999;
        m.step(1 / 60, 0, 0); m.enterBoss(); m.step(1 / 60, 0, 0);
        assert.equal(events(m, 'bossStart').length, 1);
    }
});

// Ignoring gold when selecting the opening card leaves this real shop with zero purchases.
check('G2 fresh shop offers an affordable unowned normal acquisition', () => {
    const m = model(1, 'campaign', () => 0); m.gold = 20;
    for (const id of ['twin','blast','crystal','watch']) m.levels[id] = 1;
    m.enterShop();
    const first = m.shopOffers[0];
    assert(first.price <= 20, `opening card costs ${first.price}, budget is 20`);
    assert.equal(first.quality, 'normal'); assert.equal(m.levels[first.id], 0);
    assert.equal(first.price, EQUIPMENT.find(e => e.id === first.id).prices[0]);
    assert.equal(new Set(m.shopOffers.map(o => o.id)).size, 4);
    const offers = m.shopOffers.map(o => ({ ...o }));
    assert.equal(m.buyOffer(0), 'purchased'); assert.equal(m.gold, 20 - first.price);
    assert.equal(m.buyOffer(0), 'unavailable'); assert(first.sold);
    return offers;
});
check('G2 affordable existing upgrade works without any unowned item', () => {
    const m = model(); for (const id of Object.keys(m.levels)) m.levels[id] = 1;
    m.gold = 50; m.enterShop(); assert.equal(m.shopOffers[0].quality, 'normal');
    assert.equal(m.shopOffers[0].price, 50); assert.equal(m.buyOffer(0), 'purchased');
});
check('G2 insufficient gold never discounts or grants currency', () => {
    const m = model(); m.gold = 0; m.enterShop();
    assert.equal(m.gold, 0); assert(m.shopOffers.every(o => o.price > 0));
    for (let i = 0; i < 4; i++) assert.equal(m.buyOffer(i), 'insufficient');
});
check('G2 Boss shop retains rare guarantee alongside affordable opening', () => {
    const m = model(5, 'campaign', () => .99); m.gold = 20; m.enterShop(true);
    assert.equal(m.shopOffers[0].quality, 'normal'); assert(m.shopOffers[0].price <= 20);
    assert(m.shopOffers.some(o => o?.quality === 'rare'));
    assert.equal(new Set(m.shopOffers.map(o => o.id)).size, 4);
});
check('G2 single remaining item preserves rare price and max-level clamp', () => {
    const m = model(); for (const id of Object.keys(m.levels)) m.levels[id] = 5;
    m.levels.flame = 4; m.gold = 1000; m.enterShop(true);
    const o = m.shopOffers[0]; assert.equal(o.id, 'flame'); assert.equal(o.quality, 'rare');
    assert.equal(o.targetLevel, 5); assert.equal(o.price, 450);
    assert(m.shopOffers.slice(1).every(o => o === null));
    assert.equal(m.buyOffer(0), 'purchased'); assert.equal(m.levels.flame, 5);
    m.enterShop(); assert(m.shopOffers.every(o => o === null));
});
check('G2 paid reroll remains random and costs 20; next wave closes purchasing', () => {
    const m = model(1, 'campaign', () => 0); m.gold = 40;
    for (const id of ['twin','blast','crystal','watch']) m.levels[id] = 1;
    m.enterShop(); assert.equal(m.reroll(), 'purchased'); assert.equal(m.gold, 20);
    assert.equal(m.shopOffers[0].id, 'twin'); assert.equal(m.shopOffers[0].price, 50);
    assert.equal(m.refreshPrice, 40); assert.equal(m.reroll(), 'insufficient');
    assert(m.nextWave()); assert.equal(m.buyOffer(0), 'unavailable');
});

// An offset chain origin misses the left mirror and accepts enemies outside the actual 2r disk.
for (const [x,y] of [[-150,0],[150,0],[0,-150],[0,150]]) {
    check(`G3 one delayed chain at ${x},${y}`, () => {
        const m = model(); m.levels.blast = 5; m.refreshStats(); const e = enemy(m,x,y);
        m.queueBlast(0,0,100,10,0); m.updateExplosions(.01);
        assert.equal(m.pendingExplosions, 1); assert.equal(e.hp, 100);
        const chain = m.explosions[0];
        assert.equal(chain.x,x); assert.equal(chain.y,y); assert.equal(chain.radius,70);
        assert.equal(chain.damage,-5); assert.equal(chain.delay,.16); assert.equal(chain.canChain,false);
        m.updateExplosions(.15); assert.equal(e.hp,100);
        m.updateExplosions(.02); assert.equal(e.hp,95); assert.equal(m.pendingExplosions,0);
    });
}
check('G3 out-of-range targets and capped explosion pool', () => {
    const m = model(); m.levels.blast = 5; m.refreshStats(); enemy(m,250,0);
    m.queueBlast(0,0,100,10,0); m.updateExplosions(.01); assert.equal(m.pendingExplosions,0);
    for (let i=0;i<20;i++) m.queueBlast(0,0,10,1,10);
    assert.equal(m.pendingExplosions,16); assert.equal(m.allocations.explosions,16);
});

function burning(level, burn, hp = 1) {
    const m = model(); m.levels.flame = level; m.refreshStats();
    const e = enemy(m,200,0,hp), neighbor = enemy(m,250,0);
    Object.assign(e,{burn,burnClock:.01,burnDamage:2});
    return {m,e,neighbor};
}
// Losing burn provenance after decrement suppresses death effects only on the final tick.
for (const level of [4,5]) for (const burn of [.01,.2]) {
    check(`G4 flame${level} burn${burn} death keeps burn effects`, () => {
        const {m,e,neighbor} = burning(level,burn); m.step(1/60,0,0);
        assert(e.hp<=0); assert(neighbor.burn>0, 'burn death must spread fire');
        assert.equal(m.pendingExplosions,level===5?1:0);
        assert.equal(m.kills,1);
    });
}
check('G4 expired burn ordinary kill has no advanced effects', () => {
    const {m,e,neighbor} = burning(5,.01,10); m.step(1/60,0,0);
    assert(e.burn<=0); assert.equal(e.hp,8);
    m.damage(e,20,e.x,e.y,false,false); assert.equal(neighbor.burn,0); assert.equal(m.pendingExplosions,0);
});
check('G4 flame levels 0 to 3 never spread or create fire explosions', () => {
    for (const level of [0,1,2,3]) {
        const {m,neighbor} = burning(level,.01); m.step(1/60,0,0);
        assert.equal(neighbor.burn,0); assert.equal(m.pendingExplosions,0);
    }
});
check('G4 four-second burn stays eight ticks at 60Hz', () => {
    const {m,e,neighbor} = burning(5,4,100);
    e.burnClock=.5; e.burnDamage=1.5;
    for(let i=0;i<300;i++) m.step(1/60,0,0);
    const hits=events(m,'hit').filter(h=>h.id===e.id);
    assert.equal(hits.length,8); assert.equal(e.hp,88); assert.equal(neighbor.burn,0);
    assert.equal(m.pendingExplosions,0);
    return {ticks:hits.length,hp:e.hp};
});
check('G4 natural final eighth burn tick propagates fire', () => {
    const {m,e,neighbor} = burning(5,4,12); e.burnClock=.5; e.burnDamage=1.5;
    for(let i=0;i<241;i++) m.step(1/60,0,0);
    assert.equal(e.hp,0); assert(neighbor.burn>0); assert.equal(m.pendingExplosions,1);
});

check('timed waves stop at 25 seconds and early Boss kill rewards once', () => {
    for (const wave of [5,10,15,20]) {
        const m=model(wave); m.waveTime=10; m.enterBoss(); m.invulnerable=999;
        const e=m.boss.enemy, reward=e.reward;
        m.damage(e,1e9,e.x,e.y,false,false); m.damage(e,1e9,e.x,e.y,false,false);
        assert.equal(m.kills,1); assert.equal(m.coins.reduce((n,c)=>n+c.value,0),reward);
        m.step(.01,0,0); assert.equal(m.phase,'battle'); assert.equal(m.bossClears,1);
        m.waveTime=24.99; m.step(.1,0,0);
        assert.equal(m.waveTime,25); assert.equal(m.earned,reward); assert.equal(m.bossClears,1);
        assert.equal(m.phase,wave===20?'victory':'shop');
        const gold=m.gold; m.step(.1,0,0); assert.equal(m.gold,gold);
    }
});
check('20-wave survival wins without final Boss kill; endless continues', () => {
    for(const mode of ['campaign','endless']) {
        const m=model(20,mode); m.invulnerable=999; m.waveTime=24.99; m.enterBoss();
        m.step(.1,0,0); assert.equal(m.finalBossDefeated,false); assert.equal(m.bossClears,0);
        assert.equal(m.phase,mode==='campaign'?'victory':'shop');
        assert.equal(m.enemies.length,0); assert.equal(m.hostiles.length,0);
        if(mode==='endless'){assert(m.nextWave());assert.equal(m.wave,21);}
        else assert(m.endlessUnlocked);
    }
});
const result={label,sourceRevision:baseline||'working-tree',node:process.version,typescript:ts.version,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,checks};
fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(result,null,2)+'\n');
for(const c of checks) console.log(`${c.passed?'PASS':'FAIL'} ${c.name}${c.passed?'':': '+c.error}`);
console.log(`RESULT ${result.passed} passed; ${result.failed} failed; ${checks.length} total`);
process.exitCode=result.failed?1:0;

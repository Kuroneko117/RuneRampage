import { attackStats, emptyLevels, EQUIPMENT, EquipmentId, EquipmentLevels, AttackStats, OverloadContext, reinforcementBonuses } from './Equipment';
import { BALANCE, fillWaveTuning, WaveTuning } from './Balance';
import { BEETLE, BOSS_PHASES } from './CombatProfiles';
import { PRODUCT } from './ProductConfig';
export const RULES = {
    left: -720, right: 720, bottom: -1080, top: 1080,
    playerRadius: 18, playerSpeed: 220, maxHp: 5, waveSeconds: 25,
    attackRange: 560, maxEnemies: BALANCE.pressure.maxEnemies, maxBullets: 80, maxCoins: 64,
    maxExplosions: 16, maxEvents: 64, maxHostiles: 24, maxRunes: 4,
};
export type Phase = 'menu' | 'battle' | 'shop' | 'dead' | 'victory' | 'downed';
export type GameMode = 'campaign' | 'endless';
export type RunBoostId = 'damage' | 'speed' | 'critical' | 'range';
export const RUN_BOOSTS: readonly RunBoostId[] = ['damage','speed','critical','range'];
export interface HostileThreat { id: number; kind: 'shot' | 'rune'; x: number; y: number; vx: number; vy: number; life: number; radius: number; warning: number; warningTotal: number; applied: boolean; }
export interface Enemy {
    beetleMode: 'approach'|'guard'|'tell'|'dash'|'recover'; actionClock:number; actionVX:number; actionVY:number;
    fast: boolean; ranged: boolean; shootClock: number; aimX: number; aimY: number;
    telegraph: boolean; aimOriginX: number; aimOriginY: number; aimVX: number; aimVY: number;
    id: number; kind: 'slime' | 'bat' | 'beetle' | 'boss'; elite: boolean; maxHp: number; reward: number; ringClock: number; x: number; y: number; hp: number;
    radius: number; speed: number; hit: number; kx: number; ky: number;
    burn: number; burnClock: number; burnDamage: number; orbitClock: number;
}
export interface Bolt {
    id: number; x: number; y: number; vx: number; vy: number; life: number;
    baseDamage: number; blastProcs: number; canProc: boolean;
    split: boolean; homing: boolean; targetId: number; originAngle: number; retarget: number; damage: number; hitsLeft: number; hitIds: number[];
}
export interface Coin { id: number; x: number; y: number; vx: number; vy: number; age: number; value: number; }
interface Explosion { canChain: boolean; x: number; y: number; radius: number; damage: number; delay: number; }
export interface CombatEvent {
    type: 'hit' | 'death' | 'coin' | 'explosion' | 'attack' | 'bossStart' | 'bossDefeated' | 'bossSkill'; id: number; x: number; y: number;
    value: number; kind: Enemy['kind']; strong: boolean; critical: boolean; source: string;
}
export interface ShopOffer { id: EquipmentId; quality: 'normal' | 'rare'; targetLevel: number; price: number; sold: boolean; }
export interface BossState {
    phase: number; skillIndex: number; enemy: Enemy; mode: 'approach' | 'dashTell' | 'dash' | 'shockTell' | 'recovery';
    clock: number; nextShock: boolean; enraged: boolean; summonClock: number;
    originX: number; originY: number; targetX: number; targetY: number; radius: number;
    vx: number; vy: number;
}
export type PurchaseResult = 'purchased' | 'insufficient' | 'max' | 'unavailable';

/** Fixed-step combat and economy; no engine, timers, physics or persistent run state. */
export class ArenaModel {
    readonly version = '0.8.1';
    mode: GameMode = 'campaign'; endlessUnlocked = false;
    boosts: Record<RunBoostId,number> = { damage:0,speed:0,critical:0,range:0 };
    private boostBonus(id: RunBoostId,n=this.boosts[id]): number { const g=BALANCE.growth;return (id==='damage'?g.boostDamage:id==='speed'?g.boostSpeed:id==='critical'?g.boostCritical:g.boostRange)*n/(n+g.boostKnee); }
    boostGain(id: RunBoostId): number { return this.boostBonus(id,this.boosts[id]+1)-this.boostBonus(id); }
    boostPrice(id: RunBoostId): number { return Math.min(1e9,Math.ceil(BALANCE.economy.boostBase[id]*Math.pow(BALANCE.economy.boostGrowth,Math.min(36,this.boosts[id])))); }
    buyBoost(id: RunBoostId): PurchaseResult {
        if(this.phase!=='shop'||RUN_BOOSTS.indexOf(id)<0)return 'unavailable';const price=this.boostPrice(id);
        if(this.gold<price)return 'insufficient';this.gold-=price;this.boosts[id]++;this.refreshStats();return 'purchased';
    }
    get moveSpeed(): number { return RULES.playerSpeed*(1+this.boostBonus('speed')); }
    maxCombo = 0; highestDamage = 0; overloadUses = 0; overloadCooldown = 0;
    private unhurtClock = 0; private attackPower = 1;
    private bossSpawned = false; private bossRewardThisWave = false;
    hostiles: HostileThreat[] = []; private hostilePool: HostileThreat[] = [];
    phase: Phase = 'menu'; x = 0; y = 0; hp = RULES.maxHp; revivesUsed=0;reviveOffered=false;
    elapsed = 0; waveTime = 0; wave = 1; kills = 0;
    gold = 0; earned = 0; invulnerable = 0;
    levels: EquipmentLevels = emptyLevels(); stats: AttackStats = attackStats(this.levels);
    enemies: Enemy[] = []; bolts: Bolt[] = []; coins: Coin[] = [];
    readonly orbit = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    readonly allocations = { enemies: 0, bolts: 0, coins: 0, explosions: 0, events: 0, hostiles: 0 };
    private enemyPool: Enemy[] = []; private boltPool: Bolt[] = []; private coinPool: Coin[] = [];
    private explosions: Explosion[] = []; private explosionPool: Explosion[] = [];
    private events: CombatEvent[] = []; private eventPool: CombatEvent[] = [];
    combo = 0; comboClock = 0; energy = 0; overload = 0; reinforcements = 0;
    cameraX = 0; cameraY = 0; viewHalfWidth = 360; viewHalfHeight = 640;
    shopOffers: (ShopOffer | null)[] = [null, null, null, null]; refreshes = 0;
    blessings = 0; blessingAvailable = false; bossClears = 0; rareRefreshPending = false;
    finalBossDefeated = false;
    boss: BossState | null = null;
    readonly sigilOrbit = Array.from({ length: 5 }, () => ({ x: 0, y: 0 }));
    private bossState = {} as BossState;
    private elitePending = false; private ringFireClock = 0;
    private aimReservations: number[] = []; private targetOwners = new Map<number, number>();
    private enemyLookup = new Map<number, Enemy>();
    private volley = 0;private beetleAccumulator=0;
    private tuning = {} as WaveTuning; private tuningWave = 0; private tuningMode: GameMode = 'campaign';
    private spawnSide = 0; private rangedSpawnAccumulator = 0; private eliteClock = 25; private rangedFireClock = 0;
    private syncTuning(): void {
        if(this.tuningWave===this.wave&&this.tuningMode===this.mode)return;
        fillWaveTuning(this.wave,this.mode==='endless',this.tuning);
        this.tuningWave=this.wave;this.tuningMode=this.mode;
    }
    get inCombat(): boolean { return this.phase === 'battle'; }
    get finished(): boolean { return this.dead || this.phase === 'victory'; }
    get overloadReady(): boolean { return this.energy >= BALANCE.overload.energy && this.overload <= 0 && this.overloadCooldown <= 0; }
    get energyYield(): number { return Math.max(.35, 1 / (1 + .018 * Math.max(0, this.attackPower - 8))); }
    get enemyCap(): number { this.syncTuning();return Math.min(RULES.maxEnemies - (this.wave % 5 === 0 && !this.bossSpawned ? 1 : 0), this.tuning.cap); }
    get refreshPrice(): number { return this.rareRefreshPending ? 0 : Math.min(1e9, 20 * Math.pow(2, Math.min(26, this.refreshes))); }
    get blessingPrice(): number { return 40 + Math.max(0, this.bossClears - 1) * 20; }
    get ringOrbitCount(): number { return this.levels.ring >= 5 ? 5 : this.levels.ring >= 4 ? 3 : 0; }
    get rangeMultiplier(): number { const g=BALANCE.growth;return Math.min(g.maxRangeMultiplier,1+this.boostBonus('range')+g.reinforcementRange*this.reinforcements/(this.reinforcements+g.reinforcementKnee)+g.blessingRange*this.blessings/(this.blessings+g.blessingKnee)); }
    get nextReinforcement(): ReturnType<typeof reinforcementBonuses> {
        const a=reinforcementBonuses(this.reinforcements), b=reinforcementBonuses(this.reinforcements+1);
        return { damage:b.damage-a.damage, speed:b.speed-a.speed, critical:b.critical-a.critical, range:b.range-a.range };
    }
    get criticalChance(): number { const g=BALANCE.growth;return Math.min(g.maxCriticalChance,BALANCE.gear.criticalBase+this.boostBonus('critical')+g.reinforcementCritical*this.reinforcements/(this.reinforcements+g.reinforcementKnee)+g.blessingCritical*this.blessings/(this.blessings+g.blessingKnee)+this.levels.core*BALANCE.gear.coreCriticalPerLevel); }
    get criticalMultiplier(): number { return BALANCE.gear.criticalMultiplier+(this.levels.crystal>=5?BALANCE.gear.crystalCriticalBonus:0); }
    get reinforcementPrice(): number { return Math.min(1e9, Math.ceil(BALANCE.economy.reinforcementBase * Math.pow(BALANCE.economy.reinforcementGrowth, Math.min(48, this.reinforcements)))); }
    reinforce(): PurchaseResult {
        if (this.phase !== 'shop' || !EQUIPMENT.some(e => this.levels[e.id] === 5)) return 'unavailable';
        if (this.gold < this.reinforcementPrice) return 'insufficient';
        this.gold -= this.reinforcementPrice; this.reinforcements++; this.refreshStats(); return 'purchased';
    }
    private refreshStats(): void {
        this.stats = attackStats(this.levels);
        const bonus=reinforcementBonuses(this.reinforcements);
        const g=BALANCE.growth;
        const damage=1+this.boostBonus('damage')+bonus.damage+g.blessingDamage*this.blessings/(this.blessings+g.blessingKnee);
        this.stats.damage *= damage; this.stats.orbitDamage *= damage; this.stats.burnDamage *= damage;
        this.stats.interval=Math.max(g.minInterval,this.stats.interval/(1+bonus.speed+g.blessingSpeed*this.blessings/(this.blessings+g.blessingKnee)));
        this.stats.blastRadius=Math.min(g.maxBlastRadius,this.stats.blastRadius*this.rangeMultiplier);
        this.attackPower = this.stats.damage * this.stats.projectileCount * (BALANCE.gear.baseInterval / this.stats.interval);
        if (this.overload > 0) {
            this.stats.damage*=BALANCE.overload.damageMultiplier;this.stats.orbitDamage*=BALANCE.overload.damageMultiplier;this.stats.burnDamage*=BALANCE.overload.damageMultiplier;
            this.stats.interval/=BALANCE.overload.hasteMultiplier;this.stats.projectileCount+=BALANCE.overload.extraProjectiles;
            if (this.levels.core >= 5) this.stats.penetrations++;
        }
    }
    private nextId = 1; private spawnClock = 0.35; private attackClock = 0;
    constructor(private random: () => number = Math.random) {}
    get dead(): boolean { return this.phase === 'dead'; }
    get remaining(): number { return Math.max(0, RULES.waveSeconds - this.waveTime); }
    get pendingExplosions(): number { return this.explosions.length; }
    getOverloadContext(): OverloadContext {
        return { coreLevel: this.levels.core, baseDamage: this.stats.damage, baseInterval: this.stats.interval };
    }
    reset(mode: GameMode = this.mode): boolean {
        if (mode === 'endless' && !this.endlessUnlocked) return false;
        this.mode = mode;
        for(const id of RUN_BOOSTS)this.boosts[id]=0;
        this.clearEntities(); this.consumeEvents(() => {});
        this.x = 0; this.y = 0; this.hp = RULES.maxHp; this.elapsed = 0;this.revivesUsed=0;this.reviveOffered=false;
        this.waveTime = 0; this.wave = 1; this.kills = 0; this.gold = 0; this.earned = 0;
        this.invulnerable = 0; this.levels = emptyLevels(); this.stats = attackStats(this.levels);
        this.combo = 0; this.comboClock = 0; this.energy = 0; this.overload = 0; this.reinforcements = 0; this.volley = 0; this.cameraX = 0; this.cameraY = 0;
        this.boss=null;this.shopOffers.fill(null);this.refreshes=0;this.blessings=0;this.blessingAvailable=false;this.bossClears=0;this.rareRefreshPending=false;
        this.elitePending=false;this.ringFireClock=0;
        this.maxCombo=0;this.highestDamage=0;this.overloadUses=0;this.overloadCooldown=0;this.unhurtClock=0;this.attackPower=1;this.bossSpawned=false;this.bossRewardThisWave=false;this.finalBossDefeated=false;
        this.phase = 'battle'; this.spawnClock = 0.35; this.attackClock = 0;
        this.beetleAccumulator=0;this.tuningWave=0;this.syncTuning();this.spawnSide=0;this.rangedSpawnAccumulator=0;this.eliteClock=this.tuning.eliteInterval;this.rangedFireClock=0;
        // IDs stay unique across runs: delayed death visuals cannot alias new enemies.
        return true;
    }
    returnToMenu(): void { this.clearEntities(); this.boss=null;this.blessingAvailable=false; this.phase = 'menu'; }
    buy(id: EquipmentId): PurchaseResult {
        const slot=this.shopOffers.findIndex(o=>o?.id===id&&!o.sold);
        return slot<0?'unavailable':this.buyOffer(slot);
    }
    buyOffer(slot: number): PurchaseResult {
        const offer=this.shopOffers[slot];
        if(this.phase!=='shop'||!offer||offer.sold)return 'unavailable';
        if(this.levels[offer.id]>=5)return 'max';
        if(this.gold<offer.price)return 'insufficient';
        this.gold-=offer.price;this.levels[offer.id]=offer.targetLevel;
        offer.sold=true;this.refreshStats();return 'purchased';
    }
    reroll(): PurchaseResult {
        if(this.phase!=='shop'||!EQUIPMENT.some(e=>this.levels[e.id]<5))return 'unavailable';
        if(this.gold<this.refreshPrice)return 'insufficient';
        const rare=this.rareRefreshPending;this.gold-=this.refreshPrice;if(!rare)this.refreshes++;
        this.rollOffers(rare);return 'purchased';
    }
    bless(): PurchaseResult {
        if(this.phase!=='shop'||!this.blessingAvailable)return 'unavailable';
        if(this.gold<this.blessingPrice)return 'insufficient';
        this.gold-=this.blessingPrice;this.blessings++;this.blessingAvailable=false;this.refreshStats();return 'purchased';
    }
    private rollOffers(guaranteeRare: boolean, guaranteeAffordable=false): void {
        const used: EquipmentId[]=[];
        let rareNeeded=guaranteeRare;
        for(let i=0;i<4;i++){
            let candidates=EQUIPMENT.filter(e=>this.levels[e.id]<5&&used.indexOf(e.id)<0);
            if(!candidates.length){this.shopOffers[i]=null;continue;}
            // Fresh shops prioritize an affordable normal acquisition, then an upgrade.
            // Keep the sole remaining item rare when it must carry the Boss reward.
            let affordableFirst=false;
            if(i===0&&guaranteeAffordable&&(!guaranteeRare||candidates.length>1)){
                const affordable=candidates.filter(e=>e.prices[this.levels[e.id]]<=this.gold);
                if(affordable.length){
                    const unowned=affordable.filter(e=>this.levels[e.id]===0);
                    candidates=unowned.length?unowned:affordable;affordableFirst=true;
                }
            }
            const item=candidates[Math.min(candidates.length-1,Math.floor(this.random()*candidates.length))];
            const level=this.levels[item.id];
            const rare=(rareNeeded&&!affordableFirst)||(i>0&&this.random()<.18);
            const targetLevel=Math.min(5,level+(rare?2:1));let price=0;
            for(let n=level;n<targetLevel;n++)price+=item.prices[n];
            if(rare){price=Math.ceil(price*.9);rareNeeded=false;}
            this.shopOffers[i]={id:item.id,quality:rare?'rare':'normal',targetLevel,price,sold:false};used.push(item.id);
        }
        if(guaranteeRare&&!rareNeeded)this.rareRefreshPending=false;
    }
    private enterShop(bossReward=false): void {
        for(const coin of this.coins)this.collect(coin);
        this.clearEntities();this.boss=null;this.phase='shop';this.refreshes=0;
        this.blessingAvailable=bossReward;if(bossReward)this.rareRefreshPending=true;this.rollOffers(bossReward,true);
    }
    nextWave(): boolean {
        if (this.phase !== 'shop') return false;
        this.clearEntities(); this.combo = 0; this.comboClock = 0; this.wave++; this.waveTime = 0;
        this.invulnerable = Math.max(this.invulnerable, .5);
        this.bossSpawned=false;this.bossRewardThisWave=false;
        this.spawnClock = 0.4; this.attackClock = 0; this.ringFireClock=0;
        this.blessingAvailable=false;this.elitePending=this.wave>15&&this.wave%2===0||(this.wave%5===3||this.wave%5===0)&&this.random()<.65;
        this.beetleAccumulator=0;this.syncTuning();this.rangedSpawnAccumulator=this.wave>5?.8:0;this.eliteClock=this.tuning.eliteInterval;this.rangedFireClock=0;
        this.phase = 'battle'; return true;
    }
    consumeEvents(consume: (event: CombatEvent) => void): void {
        for (const event of this.events) { consume(event); this.eventPool.push(event); }
        this.events.length = 0;
    }
    private emit(type: CombatEvent['type'], id: number, x: number, y: number,
        value: number, kind: Enemy['kind'] = 'slime', strong = false, critical = false, source = 'normal'): void {
        if (this.events.length >= RULES.maxEvents) return;
        let event = this.eventPool.pop();
        if (!event) { event = {} as CombatEvent; this.allocations.events++; }
        event.type = type; event.id = id; event.x = x; event.y = y;
        event.value = value; event.kind = kind; event.strong = strong; event.critical = critical; event.source = source; this.events.push(event);
    }
    private clearEntities(): void {
        this.enemyPool.push(...this.enemies); this.boltPool.push(...this.bolts);
        this.hostilePool.push(...this.hostiles); this.hostiles.length = 0;
        this.coinPool.push(...this.coins); this.explosionPool.push(...this.explosions);
        this.enemies.length = 0; this.bolts.length = 0; this.coins.length = 0; this.explosions.length = 0;
    }
    activateOverload(): boolean {
        if (!this.inCombat || !this.overloadReady) return false;
        this.energy=0;this.overload=BALANCE.overload.duration;this.overloadUses++;this.refreshStats();
        if (this.levels.core>=4) for (const e of this.enemies) {
            const dx=e.x-this.x,dy=e.y-this.y,d=Math.hypot(dx,dy)||1;
            if (e.kind!=='boss'&&d<150) { e.kx=dx/d*180;e.ky=dy/d*180; }
        }
        return true;
    }
    private gainEnergy(amount: number, kill=false): void {
        if (this.overload>0 || this.energy>=BALANCE.overload.energy) return;
        if (kill) amount*=this.energyYield;
        this.energy=Math.min(BALANCE.overload.energy,this.energy+Math.max(0,amount));
    }
    step(dt: number, moveX: number, moveY: number): void {
        if (!this.inCombat || dt<=0) return;
        if(this.hp<=0){this.phase='dead';return;}
        if(this.waveTime>=RULES.waveSeconds-1e-7){this.finishTimedWave();return;}
        // The simulation never runs attacks beyond the wave deadline.
        dt=Math.min(.1,dt);const remaining=RULES.waveSeconds-this.waveTime;
        if(dt>remaining+1e-7)dt=remaining;
        this.syncTuning();this.rangedFireClock=Math.max(0,this.rangedFireClock-dt);
        this.comboClock=Math.max(0,this.comboClock-dt);if(!this.comboClock)this.combo=0;
        if(this.overload>0) {
            this.overload=Math.max(0,this.overload-dt);
            if(this.overload<1e-7){this.overload=0;this.overloadCooldown=BALANCE.overload.cooldown;this.refreshStats();}
        } else this.overloadCooldown=Math.max(0,this.overloadCooldown-dt);
        this.unhurtClock+=dt;if(this.unhurtClock>=10){this.unhurtClock-=10;this.gainEnergy(5);}
        this.elapsed+=dt;this.waveTime=Math.min(RULES.waveSeconds,this.waveTime+dt);
        this.invulnerable=Math.max(0,this.invulnerable-dt);
        const length=Math.hypot(moveX,moveY);if(length>1){moveX/=length;moveY/=length;}
        this.x=Math.max(RULES.left+18,Math.min(RULES.right-18,this.x+moveX*this.moveSpeed*dt));
        this.y=Math.max(RULES.bottom+18,Math.min(RULES.top-18,this.y+moveY*this.moveSpeed*dt));
        if(this.wave%5===0&&!this.bossSpawned&&this.waveTime>=10-1e-7)this.enterBoss();
        this.spawnClock-=dt;
        if(this.spawnClock<=0) {
            this.spawnClock+=this.tuning.spawnInterval;
            for(let n=0;n<this.tuning.spawnBatch&&this.enemies.length<this.enemyCap;n++)this.spawn();
            if(this.elitePending&&this.waveTime>=4&&this.enemies.length<this.enemyCap){
                this.spawn(true,this.wave>=15?'slime':undefined);
                if(this.wave>=15&&this.enemies.length<this.enemyCap)this.spawn(true,'bat');
                this.elitePending=false;
            }
        }
        if(this.wave>5){
            this.eliteClock-=dt;
            if(this.eliteClock<=0&&this.enemies.length<this.enemyCap){
                this.eliteClock+=this.tuning.eliteInterval;this.spawn(true,'slime');
                if(this.wave>=15&&this.enemies.length<this.enemyCap)this.spawn(true,'bat');
            }
        }
        this.updateBoss(dt);
        for(const enemy of this.enemies) {
            if(enemy.hp<=0)continue;
            enemy.hit=Math.max(0,enemy.hit-dt);enemy.orbitClock=Math.max(0,enemy.orbitClock-dt);enemy.ringClock=Math.max(0,enemy.ringClock-dt);
            const dx=this.x-enemy.x,dy=this.y-enemy.y,distance=Math.hypot(dx,dy);
            const travel=Math.min(distance,enemy.speed*dt);
            if(enemy.kind==='beetle')this.updateBeetle(enemy,dt,dx,dy,distance);
            if(distance>.001&&enemy.kind!=='boss'&&enemy.kind!=='beetle'&&!enemy.telegraph) {
                const direction=enemy.ranged&&distance<BALANCE.ranged.preferredMin?-0.4:enemy.ranged&&distance<BALANCE.ranged.preferredMax?0:1;
                enemy.x+=dx/distance*travel*direction;enemy.y+=dy/distance*travel*direction;
                if(enemy.elite&&enemy.kind==='bat'){const sway=Math.sin(this.elapsed*4+enemy.id)*36*dt;enemy.x-=dy/distance*sway;enemy.y+=dx/distance*sway;}
            }
            if(enemy.ranged)this.updateRanged(enemy,dt,distance);
            if(enemy.telegraph||(enemy.kind==='beetle'&&enemy.beetleMode!=='approach')){enemy.kx=0;enemy.ky=0;}enemy.x+=enemy.kx*dt;enemy.y+=enemy.ky*dt;enemy.kx*=Math.max(0,1-10*dt);enemy.ky*=Math.max(0,1-10*dt);
            enemy.x=Math.max(RULES.left+enemy.radius,Math.min(RULES.right-enemy.radius,enemy.x));enemy.y=Math.max(RULES.bottom+enemy.radius,Math.min(RULES.top-enemy.radius,enemy.y));
            if(enemy.burn>0){
                enemy.burnClock-=dt;
                if(enemy.burnClock<=0){enemy.burnClock+=.5;this.damage(enemy,enemy.burnDamage,enemy.x,enemy.y,false,false);}
                // The final tick still belongs to this burn for death effects.
                enemy.burn-=dt;
            }
        }
        if(this.stats.orbitDamage>0)this.updateOrbit();if(this.ringOrbitCount>0)this.updateSigil(dt);
        this.attackClock=Math.max(0,this.attackClock-dt);if(this.attackClock<=0)this.attack();
        this.updateBolts(dt);this.updateExplosions(dt);this.updateHostiles(dt);
        this.updateCoins(dt);
        if(this.invulnerable<=0)for(const e of this.enemies) {
            if(e.hp>0&&Math.hypot(e.x-this.x,e.y-this.y)<=e.radius+RULES.playerRadius){
                this.hurtPlayer();const dx=e.x-this.x,dy=e.y-this.y,d=Math.hypot(dx,dy)||1;e.x+=(dx===0&&dy===0?1:dx/d)*40;e.y+=dy/d*40;break;
            }
        }
        // Resolve terminal conditions before returning the boss object to its pool.
        if(this.boss&&this.boss.enemy.hp<=0){
            this.bossClears++;this.boss=null;this.bossRewardThisWave=true;
            if(this.mode==='campaign'&&this.wave===20)this.finalBossDefeated=true;
        }
        for(let i=this.enemies.length-1;i>=0;i--)if(this.enemies[i].hp<=0)this.enemyPool.push(this.enemies.splice(i,1)[0]);
        if(this.inCombat&&this.waveTime>=RULES.waveSeconds-1e-7)this.finishTimedWave();
    }
    private finishTimedWave():void {
        if(!this.inCombat||this.hp<=0)return;
        this.waveTime=RULES.waveSeconds;
        if(this.mode==='campaign'&&this.wave>=20){
            for(const c of this.coins)this.collect(c);
            this.clearEntities();this.boss=null;this.phase='victory';this.endlessUnlocked=true;
        }else this.enterShop(this.bossRewardThisWave);
    }
    private nearest(x: number, y: number, range: number): Enemy | undefined {
        let found: Enemy | undefined; let distance = range * range;
        for (const enemy of this.enemies) {
            if (enemy.hp <= 0) continue;
            const d = (enemy.x - x) ** 2 + (enemy.y - y) ** 2;
            if (d < distance) { distance = d; found = enemy; }
        }
        return found;
    }
    private attack(): void {
        const target = this.nearest(this.x, this.y, RULES.attackRange*this.rangeMultiplier);
        if (!target || this.bolts.length >= RULES.maxBullets) return;
        // Keep the opening readable on narrow phones: the first target enters the camera before the first hit.
        if(this.wave===1&&this.waveTime<2&&(Math.abs(target.x-this.cameraX)>this.viewHalfWidth-24||Math.abs(target.y-this.cameraY)>360))return;
        this.volley++; this.emit('attack', 0, this.x, this.y, 1);
        const base = Math.atan2(target.y - this.y, target.x - this.x);
        const count = Math.min(this.stats.projectileCount + (this.levels.watch >= 5 && this.volley % 4 === 0 ? 1 : 0), RULES.maxBullets - this.bolts.length);
        this.aimReservations.length=0;
        for (let i = 0; i < count; i++) {
            let bolt = this.boltPool.pop();
            if (!bolt) { bolt = { hitIds: [] } as unknown as Bolt; this.allocations.bolts++; }
            const angle = base + (i - (count - 1) / 2) * (this.levels.twin>=5 && this.volley%2===0 ? .25 : .16);
            bolt.id = this.nextId++; bolt.x = this.x; bolt.y = this.y;
            bolt.vx = Math.cos(angle) * this.stats.projectileSpeed; bolt.vy = Math.sin(angle) * this.stats.projectileSpeed;
            bolt.originAngle=angle;bolt.retarget=.2;bolt.homing=this.levels.ring>0&&(this.levels.ring<3||(i+this.volley)%3===0);
            const selected=bolt.homing?this.trackingTarget(bolt,this.aimReservations):undefined;
            bolt.targetId=selected?.id||0;if(selected)this.aimReservations.push(selected.id);else bolt.homing=false;
            bolt.split = false; bolt.life = 1.25; bolt.damage = this.stats.damage * (this.levels.crystal >= 4 && this.volley % BALANCE.gear.heavyVolleyPeriod === 0 ? BALANCE.gear.heavyVolleyScale : 1);
            bolt.baseDamage=bolt.damage;bolt.blastProcs=0;bolt.canProc=true;
            bolt.hitsLeft = 1 + this.stats.penetrations; bolt.hitIds.length = 0; this.bolts.push(bolt);
        }
        this.attackClock=Math.max(BALANCE.growth.minBurstInterval,this.stats.interval*(this.levels.watch>=4&&this.volley%4===0?BALANCE.gear.rapidVolleyScale:1));
    }
    private queueBlast(x: number, y: number, radius: number, damage: number, delay: number, canChain=true): void {
        if (this.explosions.length >= RULES.maxExplosions) return;
        let blast = this.explosionPool.pop(); if (!blast) { blast = {} as Explosion; this.allocations.explosions++; }
        blast.canChain=canChain;blast.x=x; blast.y=y; blast.radius=radius; blast.damage=damage; blast.delay=delay; this.explosions.push(blast);
    }
    private splitBolt(parent: Bolt, targetId: number): void {
        for (let index = 0; index < 2; index++) {
            const offset = index === 0 ? -0.65 : 0.65;
            if (this.bolts.length >= RULES.maxBullets) return;
            let b = this.boltPool.pop(); if (!b) { b = { hitIds: [] } as unknown as Bolt; this.allocations.bolts++; }
            const a = Math.atan2(parent.vy,parent.vx)+offset;
            b.id=this.nextId++; b.x=parent.x; b.y=parent.y; b.vx=Math.cos(a)*this.stats.projectileSpeed; b.vy=Math.sin(a)*this.stats.projectileSpeed;
            b.homing=false;b.targetId=0;b.originAngle=a;b.retarget=0;b.life=0.65; b.damage=parent.baseDamage*BALANCE.growth.splitDamageScale;b.baseDamage=b.damage;b.blastProcs=0;b.canProc=false; b.hitsLeft=1; b.hitIds.length=0; b.hitIds.push(targetId); b.split=true; this.bolts.push(b);
        }
    }
    private updateBolts(dt: number): void {
        this.enemyLookup.clear();this.targetOwners.clear();for(const e of this.enemies)this.enemyLookup.set(e.id,e);
        for(const b of this.bolts)if(b.homing&&b.targetId)this.targetOwners.set(b.targetId,(this.targetOwners.get(b.targetId)||0)+1);
        for (let i = this.bolts.length - 1; i >= 0; i--) {
            const bolt = this.bolts[i];
            if (bolt.homing && this.stats.tracking > 0) {
                bolt.retarget-=dt;let target=this.enemyLookup.get(bolt.targetId);
                if(!target||target.hp<=0||bolt.hitIds.indexOf(target.id)>=0||bolt.retarget<=0){
                    this.targetOwners.set(bolt.targetId,Math.max(0,(this.targetOwners.get(bolt.targetId)||0)-1));
                    target=this.trackingTarget(bolt,undefined);bolt.targetId=target?.id||0;bolt.retarget=.2;
                    if(target)this.targetOwners.set(target.id,(this.targetOwners.get(target.id)||0)+1);
                }
                if(target){
                    const angle=Math.atan2(bolt.vy,bolt.vx),desired=Math.atan2(target.y-bolt.y,target.x-bolt.x);
                    const difference=this.angleDelta(desired-angle);
                    const turn=Math.max(-this.stats.tracking*dt,Math.min(this.stats.tracking*dt,difference));
                    const limit=this.trackingCone;
                    const total=Math.max(-limit,Math.min(limit,this.angleDelta(angle+turn-bolt.originAngle)));
                    bolt.vx=Math.cos(bolt.originAngle+total)*this.stats.projectileSpeed;bolt.vy=Math.sin(bolt.originAngle+total)*this.stats.projectileSpeed;
                }
            }
            const oldX = bolt.x, oldY = bolt.y;
            bolt.x += bolt.vx * dt; bolt.y += bolt.vy * dt; bolt.life -= dt;
            const dx = bolt.x - oldX, dy = bolt.y - oldY;
            // Resolve intersected enemies in segment order, independent of array order.
            while (bolt.life > 0 && bolt.hitsLeft > 0) {
                let target: Enemy | undefined; let firstT = 2;
                for (const enemy of this.enemies) {
                    if (enemy.hp <= 0 || bolt.hitIds.indexOf(enemy.id) >= 0) continue;
                    const t = Math.max(0, Math.min(1, ((enemy.x - oldX) * dx + (enemy.y - oldY) * dy) / (dx * dx + dy * dy || 1)));
                    if (t < firstT && (oldX + dx * t - enemy.x) ** 2 + (oldY + dy * t - enemy.y) ** 2 <= (enemy.radius + (this.levels.twin >= 4 ? 12 : 6) + 0) ** 2) { firstT = t; target = enemy; }
                }
                if (!target) break;
                bolt.hitIds.push(target.id); bolt.hitsLeft--;
                if(this.levels.pierce>=4)bolt.damage=bolt.baseDamage*Math.min(BALANCE.growth.maxPierceDamageMultiplier,1+(bolt.hitIds.length-1)*BALANCE.growth.pierceGainPerHit);
                if (this.levels.pierce >= 5) bolt.life = Math.min(2, bolt.life + 0.12);
                if (this.levels.twin >= 5 && !bolt.split) { bolt.split = true; this.splitBolt(bolt, target.id); }
                this.damage(target, bolt.damage, oldX, oldY, true, this.stats.coreLevel >= 2);
                if (target.hp > 0 && this.stats.burnDuration > 0) {
                    target.burn = this.stats.burnDuration; target.burnDamage = this.stats.burnDamage;
                    if (target.burnClock <= 0) target.burnClock = 0.5;
                }
                if(bolt.canProc&&this.stats.blastCount>0&&bolt.blastProcs<BALANCE.growth.maxBlastProcsPerLineage){
                    const first=bolt.blastProcs===0,procScale=first?1:BALANCE.growth.repeatProcScale;
                    bolt.blastProcs++;
                    for(let j=0;j<this.stats.blastCount;j++)this.queueBlast(target.x,target.y,this.stats.blastRadius,
                        bolt.damage*BALANCE.growth.blastScale*procScale*(j===0?1:BALANCE.growth.secondaryBlastScale),j*.12,first&&j===0);
                }
            }
            if (bolt.life <= 0 || bolt.hitsLeft <= 0) this.boltPool.push(this.bolts.splice(i, 1)[0]);
        }
    }
    private updateExplosions(dt: number): void {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const explosion = this.explosions[i]; explosion.delay -= dt;
            if (explosion.delay > 0) continue;
            this.emit('explosion', 0, explosion.x, explosion.y, explosion.radius, 'slime', true);
            for (const enemy of this.enemies) {
                if (enemy.hp > 0 && Math.hypot(enemy.x - explosion.x, enemy.y - explosion.y) <= explosion.radius + enemy.radius) {
                    this.damage(enemy, Math.abs(explosion.damage), explosion.x, explosion.y, true, true, 'explosion');
                    if (this.levels.blast >= 4) { enemy.kx *= 1.5; enemy.ky *= 1.5; }
                }
            }
            if (this.levels.blast >= 5 && explosion.canChain && explosion.damage > 0) {
                const target = this.nearest(explosion.x, explosion.y, explosion.radius * 2);
                if (target) this.queueBlast(target.x, target.y, explosion.radius*BALANCE.growth.chainRadiusScale,-explosion.damage*BALANCE.growth.chainDamageScale,0.16,false);
            }
            this.explosionPool.push(this.explosions.splice(i, 1)[0]);
        }
    }
    private updateOrbit(): void {
        for (let i = 0; i < 3; i++) {
            const angle = this.elapsed * 2.8 + i * Math.PI * 2 / 3;
            const point = this.orbit[i]; point.x = this.x + Math.cos(angle) * 68; point.y = this.y + Math.sin(angle) * 68;
            for (const enemy of this.enemies) {
                if (enemy.hp > 0 && enemy.orbitClock <= 0 && Math.hypot(enemy.x - point.x, enemy.y - point.y) < enemy.radius + 10) {
                    enemy.orbitClock = 0.45; this.damage(enemy, this.stats.orbitDamage, this.x, this.y, true, false);
                }
            }
        }
    }
    private damage(enemy: Enemy, amount: number, sourceX: number, sourceY: number, push: boolean, strong: boolean, source = 'normal'): void {
        if (enemy.hp <= 0) return;
        if(enemy.kind==='beetle'&&enemy.beetleMode==='guard')amount*=BEETLE.damageTaken;
        const critical = push && this.random() < this.criticalChance;
        if (critical) { amount *= this.criticalMultiplier; strong = true; }
        this.highestDamage=Math.max(this.highestDamage,amount);
        if(enemy.kind==='boss')this.gainEnergy(Math.min(enemy.hp,amount)/enemy.maxHp*40);
        enemy.hp -= amount; enemy.hit = 0.1;
        if (push) {
            const dx = enemy.x - sourceX, dy = enemy.y - sourceY, distance = Math.hypot(dx, dy) || 1;
            const weight=enemy.kind==='boss'?.08:enemy.elite?.45:1;
            enemy.kx = weight * (dx === 0 && dy === 0 ? 1 : dx / distance) * (strong ? 260 : 150);
            enemy.ky = weight * dy / distance * (strong ? 260 : 150);
        }
        this.emit('hit', enemy.id, enemy.x, enemy.y, amount, enemy.kind, strong, critical, source);
        if (enemy.hp <= 0) {
            this.combo++;this.comboClock=4;this.maxCombo=Math.max(this.maxCombo,this.combo);
            if(enemy.kind!=='boss')this.gainEnergy(enemy.elite?8:1,true);
            if (enemy.burn > 0 && this.levels.flame >= 4) {
                for (const other of this.enemies) if (other.hp > 0 && other.id !== enemy.id && Math.hypot(other.x-enemy.x,other.y-enemy.y)<100) {
                    other.burn = this.stats.burnDuration; other.burnDamage = this.stats.burnDamage; other.burnClock = 0.5;
                }
                if (this.levels.flame >= 5) this.queueBlast(enemy.x, enemy.y, 65, -this.stats.damage * 0.5, 0.1,false);
            }
            this.kills++; this.emit('death', enemy.id, enemy.x, enemy.y, enemy.elite?1:0, enemy.kind);
            if(enemy.kind==='boss')this.emit('bossDefeated',enemy.id,enemy.x,enemy.y,enemy.reward,'boss',true);
            this.dropCoin(enemy);
        }
    }
    private dropCoin(enemy: Enemy): void {
        const value = enemy.reward || (enemy.kind === 'bat' ? 1 : 2);
        if (this.coins.length >= RULES.maxCoins) {
            // Merge value rather than lose currency when the cosmetic population is full.
            this.coins[this.coins.length - 1].value += value; return;
        }
        let coin = this.coinPool.pop();
        if (!coin) { coin = {} as Coin; this.allocations.coins++; }
        const angle = this.random() * Math.PI * 2;
        coin.id = this.nextId++; coin.x = enemy.x; coin.y = enemy.y;
        coin.vx = Math.cos(angle) * 65; coin.vy = Math.sin(angle) * 65;
        coin.age = 0; coin.value = value; this.coins.push(coin);
    }
    private updateCoins(dt: number): void {
        for (let i = this.coins.length - 1; i >= 0; i--) {
            const coin = this.coins[i]; coin.age += dt;
            if (coin.age < 0.23) { coin.x += coin.vx * dt; coin.y += coin.vy * dt; }
            else {
                const dx = this.x - coin.x, dy = this.y - coin.y, distance = Math.hypot(dx, dy);
                const travel = Math.min(distance, (330 + Math.min(1.5, coin.age) * 180) * dt);
                if (distance > 0.001) { coin.x += dx / distance * travel; coin.y += dy / distance * travel; }
                if (distance <= 24) { this.collect(coin); this.coinPool.push(this.coins.splice(i, 1)[0]); }
            }
        }
    }
    private collect(coin: Coin): void {
        this.gold += coin.value; this.earned += coin.value;
        this.emit('coin', coin.id, this.x, this.y + 30, coin.value);
    }
    private spawn(elite=false, forcedKind?: 'slime' | 'bat' | 'beetle'): void {
        if(this.enemies.length>=RULES.maxEnemies)return;this.syncTuning();
        let enemy = this.enemyPool.pop();
        if (!enemy) { enemy = {} as Enemy; this.allocations.enemies++; }
        let ranged=false;
        if(this.wave>5&&!elite){
            this.rangedSpawnAccumulator+=this.tuning.rangedShare;
            let alive=0;for(const e of this.enemies)if(e.hp>0&&e.ranged)alive++;
            if(this.rangedSpawnAccumulator>=1&&alive<this.tuning.maxRanged){ranged=true;this.rangedSpawnAccumulator-=1;}
            this.rangedSpawnAccumulator=Math.min(1,this.rangedSpawnAccumulator);
        }
        let kind:'slime'|'bat'|'beetle'=ranged?'bat':forcedKind || (this.random() < this.tuning.batShare ? 'bat' : 'slime');
        if(!ranged&&!elite&&!forcedKind&&this.wave>=BEETLE.startWave){
            this.beetleAccumulator+=this.wave>=15?BEETLE.lateShare:BEETLE.share;
            let live=0;for(const e of this.enemies)if(e.hp>0&&e.kind==='beetle')live++;
            if(this.beetleAccumulator>=1&&live<(this.wave>=15?BEETLE.lateCap:BEETLE.earlyCap)){kind='beetle';this.beetleAccumulator-=1;}
            this.beetleAccumulator=Math.min(1,this.beetleAccumulator);
        }
        // Visible rectangle follows the actual camera, with a safety margin for sprites.
        const opening = this.waveTime < 1 && this.enemies.length === 0;
        const hw = this.viewHalfWidth + (opening ? 32 : 70), hh = this.viewHalfHeight + 70;
        let x = 0, y = 0;
        // Open from a side visible below the HUD; subsequent enemies still use all four sides.
        const first = opening ? (this.random() < 0.5 ? 0 : 1) : this.wave>5?this.spawnSide++%4:Math.floor(this.random() * 4);
        for (let n = 0; n < 4; n++) {
            const side = (first + n) % 4;
            x = Math.max(RULES.left + 24, Math.min(RULES.right - 24, this.cameraX + (this.random() * 2 - 1) * hw));
            y = Math.max(RULES.bottom + 24, Math.min(RULES.top - 24, opening ? this.cameraY : this.cameraY + (this.random() * 2 - 1) * hh));
            if (side === 0) x = this.cameraX - hw; if (side === 1) x = this.cameraX + hw;
            if (side === 2) y = this.cameraY - hh; if (side === 3) y = this.cameraY + hh;
            if (x >= RULES.left && x <= RULES.right && y >= RULES.bottom && y <= RULES.top) break;
        }
        x=Math.max(RULES.left+24,Math.min(RULES.right-24,x));
        y=Math.max(RULES.bottom+24,Math.min(RULES.top-24,y));
        enemy.id = this.nextId++; enemy.kind = kind; enemy.x = x; enemy.y = y;
        
        enemy.fast=kind==='bat'&&this.wave>5;
        enemy.ranged=ranged;
        enemy.shootClock=.15+(enemy.id%5)*.11;enemy.aimX=this.x;enemy.aimY=this.y;enemy.telegraph=false;enemy.aimOriginX=x;enemy.aimOriginY=y;enemy.aimVX=0;enemy.aimVY=0;
        enemy.hp=((kind==='bat'?1:2)+Math.min(12,Math.floor((this.wave-1)*.5)))*this.tuning.hpMultiplier;
        if(enemy.ranged)enemy.hp*=1.5;if(kind==='beetle')enemy.hp*=BEETLE.hp;
        if(elite)enemy.hp=enemy.hp*(kind==='slime'?5:3)+(kind==='slime'?6:3);
        enemy.maxHp=enemy.hp;enemy.elite=elite;enemy.reward=elite?(kind==='slime'?14:10):(kind==='bat'?1:2);enemy.ringClock=0;
        enemy.radius = (kind === 'bat' ? 15 : 21)*(elite?(kind==='slime'?1.5:1.25):1);
        enemy.speed = (kind === 'bat' ? 115 : 65) + Math.min(kind==='bat'?90:75, (this.wave - 1) * 9);
        if(elite)enemy.speed*=kind==='bat'?1.16:.88;
        if(enemy.fast)enemy.speed*=this.tuning.fastMultiplier;if(enemy.ranged)enemy.speed*=.65;
        enemy.speed*=this.tuning.speedMultiplier;if(kind==='beetle')enemy.speed*=BEETLE.speed;
        enemy.beetleMode='approach';enemy.actionClock=2.2+(enemy.id%3)*.3;enemy.actionVX=0;enemy.actionVY=0;
        enemy.hit = 0; enemy.kx = 0; enemy.ky = 0; enemy.burn = 0;
        enemy.burnClock = 0; enemy.burnDamage = 0; enemy.orbitClock = 0; this.enemies.push(enemy);
    }
    private updateBeetle(e:Enemy,dt:number,dx:number,dy:number,d:number):void {
        if(e.beetleMode==='approach'){
            if(d>.001){const travel=Math.min(d,e.speed*dt);e.x+=dx/d*travel;e.y+=dy/d*travel;}
            if(d<360)e.actionClock-=dt;
            if(e.actionClock<=0&&d<320){e.beetleMode='guard';e.actionClock=BEETLE.guard;e.kx=0;e.ky=0;}
            return;
        }
        e.actionClock-=dt;
        if(e.beetleMode==='guard'&&e.actionClock<=0){
            e.beetleMode='tell';e.actionClock=BEETLE.warning;e.aimOriginX=e.x;e.aimOriginY=e.y;
            e.actionVX=dx/(d||1)*BEETLE.dashSpeed;e.actionVY=dy/(d||1)*BEETLE.dashSpeed;
        }else if(e.beetleMode==='tell'&&e.actionClock<=0){e.beetleMode='dash';e.actionClock=BEETLE.dashDuration;}
        else if(e.beetleMode==='dash'){
            e.x+=e.actionVX*dt;e.y+=e.actionVY*dt;
            if(e.actionClock<=0){e.beetleMode='recover';e.actionClock=BEETLE.recovery;}
        }else if(e.beetleMode==='recover'&&e.actionClock<=0){e.beetleMode='approach';e.actionClock=BEETLE.approachCooldown;}
    }
    private angleDelta(value: number): number { return Math.atan2(Math.sin(value),Math.cos(value)); }
    private get trackingCone(): number { return (this.levels.ring===1?20:this.levels.ring===2?30:70)*Math.PI/180; }
    private trackingTarget(bolt: Bolt, reserved?: number[]): Enemy | undefined {
        let best: Enemy | undefined;let score=Infinity;
        for(const e of this.enemies){
            if(e.hp<=0||bolt.hitIds.indexOf(e.id)>=0||(reserved&&reserved.indexOf(e.id)>=0))continue;
            if(!reserved&&(this.targetOwners.get(e.id)||0)>0)continue;
            const dx=e.x-bolt.x,dy=e.y-bolt.y,d=Math.hypot(dx,dy);
            const angle=Math.abs(this.angleDelta(Math.atan2(dy,dx)-bolt.originAngle));
            if(d>RULES.attackRange*this.rangeMultiplier||angle>this.trackingCone)continue;
            const value=d*(1+angle*.8);if(value<score){score=value;best=e;}
        }
        return best;
    }
    private updateSigil(dt: number): void {
        const count=this.ringOrbitCount,radius=this.levels.ring>=5?108:94;
        this.ringFireClock=Math.max(0,this.ringFireClock-dt);
        this.aimReservations.length=0;
        for(let i=0;i<count;i++){
            const angle=this.elapsed*2.4+i*Math.PI*2/count,p=this.sigilOrbit[i];
            p.x=this.x+Math.cos(angle)*radius;p.y=this.y+Math.sin(angle)*radius;
            for(const e of this.enemies)if(e.hp>0&&e.ringClock<=0&&Math.hypot(e.x-p.x,e.y-p.y)<e.radius+10){
                e.ringClock=.5;this.damage(e,this.stats.damage*.45,this.x,this.y,true,false,'sigil');
            }
            if(this.levels.ring<5||this.ringFireClock>0||this.bolts.length>=RULES.maxBullets)continue;
            let target: Enemy | undefined;let closest=(RULES.attackRange*.8*this.rangeMultiplier)**2;
            for(const e of this.enemies)if(e.hp>0&&this.aimReservations.indexOf(e.id)<0){const d=(e.x-p.x)**2+(e.y-p.y)**2;if(d<closest){closest=d;target=e;}}
            if(!target)continue;this.aimReservations.push(target.id);
            let b=this.boltPool.pop();if(!b){b={hitIds:[]} as unknown as Bolt;this.allocations.bolts++;}
            const a=Math.atan2(target.y-p.y,target.x-p.x);
            b.id=this.nextId++;b.x=p.x;b.y=p.y;b.vx=Math.cos(a)*this.stats.projectileSpeed;b.vy=Math.sin(a)*this.stats.projectileSpeed;
            b.originAngle=a;b.homing=true;b.targetId=target.id;b.retarget=.2;b.life=1.1;b.damage=this.stats.damage*BALANCE.gear.sigilDamageScale;b.baseDamage=b.damage;b.blastProcs=0;b.canProc=false;b.hitsLeft=1;b.hitIds.length=0;b.split=true;
            this.bolts.push(b);this.emit('attack',0,p.x,p.y,.6);
        }
        if(this.levels.ring>=5&&this.ringFireClock<=0)this.ringFireClock=BALANCE.gear.sigilInterval;
    }
    private enterBoss(): void {
        if(this.bossSpawned)return;this.bossSpawned=true;
        let e=this.enemyPool.pop();if(!e){e={} as Enemy;this.allocations.enemies++;}
        const stage=Math.floor(this.wave/5);
        e.id=this.nextId++;e.kind='boss';e.elite=false;e.radius=52;e.speed=130;
        e.beetleMode='approach';e.actionClock=0;e.actionVX=0;e.actionVY=0;
        e.fast=false;e.ranged=false;e.shootClock=0;e.aimX=this.x;e.aimY=this.y;e.telegraph=false;e.aimOriginX=0;e.aimOriginY=0;e.aimVX=0;e.aimVY=0;
        const px=Math.max(RULES.left+e.radius,Math.min(RULES.right-e.radius,this.x));
        const py=Math.max(RULES.bottom+e.radius,Math.min(RULES.top-e.radius,this.y));
        const safeDistance=e.radius+RULES.playerRadius+70;let nearestSafe=Infinity;
        // Keep edge entry, with the ordinary spawn margin and no temporary candidate array.
        for(let side=0;side<4;side++){
            const x=side===0?RULES.left+e.radius:side===1?RULES.right-e.radius:px;
            const y=side===2?RULES.bottom+e.radius:side===3?RULES.top-e.radius:py;
            const distance=(x-this.x)**2+(y-this.y)**2;
            if(distance>=safeDistance*safeDistance&&distance<nearestSafe){nearestSafe=distance;e.x=x;e.y=y;}
        }
        e.hp=420*(1+(stage-1)*1.2);e.maxHp=e.hp;e.reward=240+(stage-1)*90;
        e.hit=0;e.kx=0;e.ky=0;e.burn=0;e.burnClock=0;e.burnDamage=0;e.orbitClock=0;e.ringClock=0;this.enemies.push(e);
        const b=this.bossState;b.phase=Math.min(4,stage);b.skillIndex=0;b.enemy=e;b.mode='approach';b.clock=1.2;b.nextShock=true;b.enraged=false;b.summonClock=0;
        b.originX=e.x;b.originY=e.y;b.targetX=this.x;b.targetY=this.y;b.radius=160;b.vx=0;b.vy=0;this.boss=b;
        // Locked ground targets stay dodgeable even when a high-damage build kills the caster.
        this.queueRune(this.x,this.y,140,1.1);this.queueRune(this.x,this.y,140,2.3);
        this.emit('bossStart',e.id,e.x,e.y,stage,'boss',true);
    }
    private queueRune(x: number,y: number,radius: number,warning: number): void {
        let count=0;for(const h of this.hostiles)if(h.kind==='rune')count++;
        if(count>=RULES.maxRunes||this.hostiles.length>=RULES.maxHostiles)return;
        const h=this.takeHostile();h.kind='rune';h.x=x;h.y=y;h.vx=0;h.vy=0;h.radius=radius;h.warning=warning;h.warningTotal=warning;h.life=warning+.25;h.applied=false;this.hostiles.push(h);
    }
    private takeHostile(): HostileThreat {
        let h=this.hostilePool.pop();if(!h){h={} as HostileThreat;this.allocations.hostiles++;}h.id=this.nextId++;return h;
    }
    private updateRanged(e: Enemy,dt: number,distance: number): void {
        const r=BALANCE.ranged;this.syncTuning();
        if(!e.telegraph&&distance>r.activateDistance)return;
        e.shootClock=Math.max(0,e.shootClock-dt);
        let shots=0,aiming=0;for(const h of this.hostiles)if(h.kind==='shot')shots++;
        for(const other of this.enemies)if(other.hp>0&&other.ranged&&other.telegraph)aiming++;
        if(!e.telegraph){
            if(e.shootClock>0||aiming>=r.maxAiming||shots>=this.tuning.maxShots)return;
            e.telegraph=true;e.shootClock=r.warning;e.aimOriginX=e.x;e.aimOriginY=e.y;e.aimX=this.x;e.aimY=this.y;
            const dx=e.aimX-e.x,dy=e.aimY-e.y,d=Math.hypot(dx,dy)||1;e.aimVX=dx/d;e.aimVY=dy/d;e.kx=0;e.ky=0;
            return;
        }
        // Keep the same visible aim while waiting for the shared firing slot. No snap-to-player shot.
        if(e.shootClock>0||this.rangedFireClock>0||shots>=this.tuning.maxShots||this.hostiles.length>=RULES.maxHostiles)return;
        const h=this.takeHostile();h.kind='shot';h.x=e.aimOriginX;h.y=e.aimOriginY;h.vx=e.aimVX*r.projectileSpeed;h.vy=e.aimVY*r.projectileSpeed;
        h.radius=r.projectileRadius;h.warning=0;h.warningTotal=0;h.life=r.projectileLifetime;h.applied=false;this.hostiles.push(h);
        this.rangedFireClock=r.shotGap;e.telegraph=false;e.shootClock=Math.max(.1,this.tuning.rangedInterval-r.warning);
    }
    private updateHostiles(dt: number): void {
        for(let i=this.hostiles.length-1;i>=0;i--){
            const h=this.hostiles[i];h.life-=dt;
            if(h.kind==='rune'){
                h.warning=Math.max(0,h.warning-dt);
                if(!h.applied&&h.warning<=0){h.applied=true;if(Math.hypot(this.x-h.x,this.y-h.y)<=h.radius+RULES.playerRadius)this.hurtPlayer();this.emit('explosion',h.id,h.x,h.y,h.radius,'boss',true,false,'bossShock');}
            }else{
                const ox=h.x,oy=h.y;h.x+=h.vx*dt;h.y+=h.vy*dt;const dx=h.x-ox,dy=h.y-oy;
                const t=Math.max(0,Math.min(1,((this.x-ox)*dx+(this.y-oy)*dy)/(dx*dx+dy*dy||1)));
                if((ox+dx*t-this.x)**2+(oy+dy*t-this.y)**2<=(h.radius+RULES.playerRadius)**2){this.hurtPlayer();h.life=0;}
            }
            if(h.life<=0)this.hostilePool.push(this.hostiles.splice(i,1)[0]);
        }
    }
    holdForRevive():boolean {if(this.phase!=='dead'||this.reviveOffered||this.revivesUsed>=PRODUCT.revive.maxPerRun)return false;this.reviveOffered=true;this.phase='downed';return true;}
    endRevive():boolean {if(this.phase!=='downed')return false;this.phase='dead';return true;}
    revive():boolean {
        if(this.phase!=='downed'||this.revivesUsed>=PRODUCT.revive.maxPerRun)return false;
        this.revivesUsed++;this.hp=Math.max(1,Math.ceil(RULES.maxHp*PRODUCT.revive.hpFraction));this.invulnerable=PRODUCT.revive.invulnerableSeconds;this.phase='battle';
        if(this.waveTime>=RULES.waveSeconds-1e-7)this.finishTimedWave();
        return true;
    }
    private hurtPlayer(): void {
        if(this.hp<=0||this.invulnerable>0)return;
        this.hp--;this.unhurtClock=0;this.invulnerable=.95;if(this.hp<=0)this.phase='dead';
    }
    private updateBoss(dt: number): void {
        const b=this.boss;if(!b||b.enemy.hp<=0)return;const e=b.enemy;
        b.enraged=e.hp<=e.maxHp*.3;b.clock-=dt;const profile=BOSS_PHASES[b.phase-1];
        const dx=this.x-e.x,dy=this.y-e.y,d=Math.hypot(dx,dy)||1;
        if(b.mode==='approach'||b.mode==='recovery'){
            const speed=e.speed*(b.enraged?1.5:1);e.x+=dx/d*speed*dt;e.y+=dy/d*speed*dt;
            if(b.clock<=0){
                b.originX=e.x;b.originY=e.y;b.targetX=this.x;b.targetY=this.y;
                b.skillIndex++;
                if(b.nextShock){
                    b.mode='shockTell';b.clock=b.enraged?.8:1.1;b.radius=b.enraged?185:160;b.originX=this.x;b.originY=this.y;
                    if(profile.pairedRunes){
                        const nx=b.skillIndex%4<2?1:0,ny=nx?0:1,r=b.enraged?120:110;
                        this.queueRune(Math.max(RULES.left+r,Math.min(RULES.right-r,this.x-nx*115)),Math.max(RULES.bottom+r,Math.min(RULES.top-r,this.y-ny*115)),r,1.15);
                        this.queueRune(Math.max(RULES.left+r,Math.min(RULES.right-r,this.x+nx*115)),Math.max(RULES.bottom+r,Math.min(RULES.top-r,this.y+ny*115)),r,1.6);b.clock=1.6;
                    }else this.queueRune(b.originX,b.originY,b.radius,b.clock);
                }else{b.mode='dashTell';b.clock=b.enraged?profile.enragedWarning:profile.warning;const speed=b.enraged?profile.enragedSpeed:profile.dashSpeed;b.vx=dx/d*speed;b.vy=dy/d*speed;}
                b.nextShock=!b.nextShock;this.emit('bossSkill',e.id,e.x,e.y,0,'boss',true,false,b.mode);
            }
        }else if(b.mode==='dashTell'&&b.clock<=0){b.mode='dash';b.clock=.7;}
        else if(b.mode==='dash'){
            e.x+=b.vx*dt;e.y+=b.vy*dt;
            if(b.clock<=0){b.mode='recovery';b.clock=b.enraged?profile.enragedRecovery:profile.recovery;}
        }else if(b.mode==='shockTell'&&b.clock<=0){
            b.mode='recovery';b.clock=b.enraged?profile.enragedRecovery:profile.recovery;
        }
        b.summonClock=Math.max(0,b.summonClock-dt);
        if(e.hp<e.maxHp*.65&&b.summonClock<=0){
            b.summonClock=b.enraged?9:14;
            for(let i=0;i<4&&this.enemies.length<this.enemyCap;i++){
                this.spawn();const minion=this.enemies[this.enemies.length-1],a=i*Math.PI/2;
                minion.x=Math.max(RULES.left+minion.radius,Math.min(RULES.right-minion.radius,e.x+Math.cos(a)*115));
                minion.y=Math.max(RULES.bottom+minion.radius,Math.min(RULES.top-minion.radius,e.y+Math.sin(a)*115));
            }
        }
    }

}









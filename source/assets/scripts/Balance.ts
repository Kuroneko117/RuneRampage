/** V0.6 combat tuning. Numbers live here; gameplay and presentation retain their existing pools. */
export const BALANCE = {
    gear: {
        baseDamage: 1, crystalDamagePerLevel: .75, coreDamagePerLevel: .4,
        baseInterval: .42, watchHastePerLevel: .22, coreHastePerLevel: .08,
        projectileSpeed: 620, coreProjectileSpeed: 35,
        tracking: [0, .7, 1.1, 2.1, 2.1, 2.1] as readonly number[],
        blastRadius: [0, 44, 64, 82, 90, 100] as readonly number[], coreBlastRadius: 5,
        burnDuration: [0, 1.5, 2, 3, 3.5, 4] as readonly number[],
        burnDamage: [0, .4, .7, 1, 1.2, 1.5] as readonly number[], coreBurnScale: .1,
        orbitDamageScale: .7, heavyVolleyScale: 1.6, heavyVolleyPeriod: 4, rapidVolleyScale: .5,
        splitDamageScale: .45, sigilDamageScale: .65, sigilInterval: .8,
        criticalBase: .05, criticalMultiplier: 2, crystalCriticalBonus: .5, coreCriticalPerLevel: .01,
    },
    growth: {
        // Apply the interval bound before overload, so its promised 30% haste remains perceptible.
        minInterval: .10, minBurstInterval: .065, maxRangeMultiplier: 1.35, maxBlastRadius: 150,
        maxCriticalChance: .35, pierceGainPerHit: .08, maxPierceDamageMultiplier: 1.24,
        // A projectile lineage may create two bursts. Split/sigil children keep their own damage,
        // burn and critical hits, without multiplying the same equipment proc again.
        blastScale: .65, secondaryBlastScale: .65, repeatProcScale: .4, maxBlastProcsPerLineage: 2,
        chainDamageScale: .5, chainRadiusScale: .7, splitDamageScale: .45,
        reinforcementKnee: 10, reinforcementDamage: .55, reinforcementSpeed: .44,
        reinforcementCritical: .066, reinforcementRange: .22,
        blessingKnee: 5, blessingDamage: .18, blessingSpeed: .12, blessingCritical: .03, blessingRange: .06,
        boostKnee: 8, boostDamage: .32, boostSpeed: .4, boostCritical: .1, boostRange: .25,
    },
    economy: {
        acquisition: { twin: 8, blast: 12, crystal: 8, watch: 10, pierce: 10, ring: 12, flame: 12, core: 20 },
        upgrades: [50, 120, 250, 500] as readonly number[],
        reinforcementBase: 180, reinforcementGrowth: 1.38,
        boostBase: { damage: 120, speed: 90, critical: 140, range: 100 }, boostGrowth: 1.6,
    },
    overload: { energy: 100, duration: 8, cooldown: 15, damageMultiplier: 1.5, hasteMultiplier: 1.3, extraProjectiles: 1 },
    ranged: {
        warning: .8, shotGap: .28, projectileSpeed: 240, projectileLifetime: 3.5,
        projectileRadius: 9, maxShots: 12, maxAiming: 2, attackInterval: 2.6,
        preferredMin: 370, preferredMax: 470, activateDistance: 650,
    },
    pressure: { maxEnemies: 96, minimumSpawnInterval: .14, endlessSpeedPerStage: .035, endlessHpPerStage: .08 },
};

/** Snapshot filled at wave transitions; callers reuse it instead of allocating every simulation step. */
export interface WaveTuning {
    spawnInterval: number; spawnBatch: number; cap: number;
    batShare: number; rangedShare: number; maxRanged: number;
    fastMultiplier: number; speedMultiplier: number; hpMultiplier: number;
    eliteInterval: number; rangedInterval: number; maxShots: number;
}
export interface WaveAnchor extends WaveTuning { wave: number; }

/** Shares refer to the whole spawn population. Ranged pressure stays a small part of the horde. */
export const WAVE_ANCHORS: readonly WaveAnchor[] = [
    { wave: 5, spawnInterval: .61, spawnBatch: 2, cap: 54, batShare: .32, rangedShare: 0, maxRanged: 0, fastMultiplier: 1, speedMultiplier: 1, hpMultiplier: 1, eliteInterval: 25, rangedInterval: 2.8, maxShots: 0 },
    { wave: 6, spawnInterval: .55, spawnBatch: 2, cap: 60, batShare: .38, rangedShare: .045, maxRanged: 2, fastMultiplier: 1.1, speedMultiplier: 1, hpMultiplier: 1, eliteInterval: 24, rangedInterval: 2.8, maxShots: 5 },
    { wave: 10, spawnInterval: .34, spawnBatch: 4, cap: 78, batShare: .44, rangedShare: .07, maxRanged: 3, fastMultiplier: 1.1, speedMultiplier: 1.025, hpMultiplier: 1, eliteInterval: 18, rangedInterval: 2.65, maxShots: 7 },
    { wave: 15, spawnInterval: .25, spawnBatch: 5, cap: 90, batShare: .46, rangedShare: .10, maxRanged: 4, fastMultiplier: 1.11, speedMultiplier: 1.075, hpMultiplier: 1, eliteInterval: 12, rangedInterval: 2.5, maxShots: 9 },
    { wave: 20, spawnInterval: .19, spawnBatch: 6, cap: 96, batShare: .48, rangedShare: .12, maxRanged: 5, fastMultiplier: 1.12, speedMultiplier: 1.13, hpMultiplier: 1, eliteInterval: 9, rangedInterval: 2.35, maxShots: 11 },
    { wave: 25, spawnInterval: .17, spawnBatch: 6, cap: 96, batShare: .49, rangedShare: .13, maxRanged: 6, fastMultiplier: 1.13, speedMultiplier: 1.165, hpMultiplier: 1.08, eliteInterval: 8, rangedInterval: 2.3, maxShots: 12 },
    { wave: 30, spawnInterval: .15, spawnBatch: 7, cap: 96, batShare: .50, rangedShare: .14, maxRanged: 6, fastMultiplier: 1.14, speedMultiplier: 1.2, hpMultiplier: 1.16, eliteInterval: 7, rangedInterval: 2.25, maxShots: 12 },
];

/** Integer populations step by one; clocks and speed interpolate across the anchor waves. */
export function fillWaveTuning(wave: number, endless: boolean, out: WaveTuning): void {
    wave = Math.max(1, Math.floor(wave));
    if (wave <= 5) {
        // V0.5.5 opening unchanged, including first purchase pacing and the first boss wave.
        out.spawnInterval = Math.max(.28, .85 - (wave - 1) * .06);
        out.spawnBatch = Math.min(4, 1 + Math.floor((wave - 1) / 3));
        out.cap = Math.min(BALANCE.pressure.maxEnemies, 24 + wave * 6);
        out.batShare = .32; out.rangedShare = 0; out.maxRanged = 0;
        out.fastMultiplier = 1; out.speedMultiplier = 1; out.hpMultiplier = 1;
        out.eliteInterval = 25; out.rangedInterval = 2.8; out.maxShots = 0;
        return;
    }
    let lower = WAVE_ANCHORS[0], upper = WAVE_ANCHORS[WAVE_ANCHORS.length - 1];
    for (let i = 1; i < WAVE_ANCHORS.length; i++) {
        upper = WAVE_ANCHORS[i];
        if (wave <= upper.wave) break;
        lower = upper;
    }
    const t = lower.wave === upper.wave ? 0 : Math.max(0, Math.min(1, (wave - lower.wave) / (upper.wave - lower.wave)));
    const lerp = (a: number, b: number): number => a + (b - a) * t;
    out.spawnInterval = lerp(lower.spawnInterval, upper.spawnInterval);
    out.spawnBatch = Math.floor(lerp(lower.spawnBatch, upper.spawnBatch) + 1e-7);
    out.cap = Math.floor(lerp(lower.cap, upper.cap));
    out.batShare = lerp(lower.batShare, upper.batShare);
    out.rangedShare = lerp(lower.rangedShare, upper.rangedShare);
    out.maxRanged = Math.floor(lerp(lower.maxRanged, upper.maxRanged) + 1e-7);
    out.fastMultiplier = lerp(lower.fastMultiplier, upper.fastMultiplier);
    out.speedMultiplier = lerp(lower.speedMultiplier, upper.speedMultiplier);
    out.hpMultiplier = endless ? lerp(lower.hpMultiplier, upper.hpMultiplier) : 1;
    out.eliteInterval = lerp(lower.eliteInterval, upper.eliteInterval);
    out.rangedInterval = lerp(lower.rangedInterval, upper.rangedInterval);
    out.maxShots = Math.floor(lerp(lower.maxShots, upper.maxShots) + 1e-7);
    if (endless && wave > 30) {
        const extraStage = (wave - 30) / 5;
        out.spawnInterval = Math.max(BALANCE.pressure.minimumSpawnInterval, out.spawnInterval - .005 * extraStage);
        out.speedMultiplier = Math.min(1.55, out.speedMultiplier + BALANCE.pressure.endlessSpeedPerStage * extraStage);
        out.hpMultiplier += BALANCE.pressure.endlessHpPerStage * extraStage;
    }
}

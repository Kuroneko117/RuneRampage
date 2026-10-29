import { BALANCE } from './Balance';
export type EquipmentId = 'twin' | 'blast' | 'crystal' | 'watch' | 'pierce' | 'ring' | 'flame' | 'core';
export type EquipmentLevels = Record<EquipmentId, number>;
export interface EquipmentDefinition {
    id: EquipmentId; name: string; prices: readonly number[]; effects: readonly string[];
}
const prices = (id: EquipmentId): readonly number[] => [BALANCE.economy.acquisition[id], ...BALANCE.economy.upgrades];
export const EQUIPMENT: readonly EquipmentDefinition[] = [
    { id: 'twin', name: '双生魔典', prices: prices('twin'), effects: ['额外 1 发魔法弹', '额外 2 发魔法弹', '三弹齐发 + 三枚环绕术式', '大型魔法弹', '交替扇形弹道，命中分裂'] },
    { id: 'blast', name: '爆裂核心', prices: prices('blast'), effects: ['命中产生小范围爆炸', '扩大爆炸范围与威力', '命中后追加衰减二次爆炸', '爆炸冲击波击退', '一次扩散连锁爆炸'] },
    { id: 'crystal', name: '魔力水晶', prices: prices('crystal'), effects: ['法术伤害 +0.75', '法术伤害 +1.50', '法术伤害 +2.25', '重击：每第四轮强化', '重击强化并增加暴伤'] },
    { id: 'watch', name: '急速怀表', prices: prices('watch'), effects: ['攻击速度 +22%', '攻击速度 +44%', '攻击速度 +66%', '每第四轮快速连射', '快速连射增加一弹'] },
    { id: 'pierce', name: '穿透晶石', prices: prices('pierce'), effects: ['穿透额外 1 个敌人', '穿透额外 2 个敌人', '穿透额外 3 个敌人', '贯穿伤害递增，最多 +24%', '贯穿回复弹体寿命'] },
    { id: 'ring', name: '追踪法环', prices: prices('ring'), effects: ['20°内轻微修正，保留散射', '分配近处目标，保留弹道', '每三弹一枚追踪标记', '三枚环绕魔法弹', '五枚环绕弹与自动法阵'] },
    { id: 'flame', name: '火焰核心', prices: prices('flame'), effects: ['命中附带 1.5 秒燃烧', '更强燃烧，持续 2 秒', '高强度燃烧，持续 3 秒', '燃烧死亡后传火', '燃烧死亡引发火爆'] },
    { id: 'core', name: '术式核心', prices: prices('core'), effects: ['整体强化 I：伤害 / 急速', '整体强化 II：更强术式', '整体强化 III：终极增幅', '过载释放时震退近处敌人', '过载弹体额外贯穿'] },
];
export function emptyLevels(): EquipmentLevels {
    return { twin: 0, blast: 0, crystal: 0, watch: 0, pierce: 0, ring: 0, flame: 0, core: 0 };
}
export interface AttackStats {
    damage: number; interval: number; projectileCount: number; projectileSpeed: number;
    penetrations: number; tracking: number; blastRadius: number; blastCount: number;
    burnDuration: number; burnDamage: number; orbitDamage: number; coreLevel: number;
}
/** Stable data contract for the overload controller. */
export interface OverloadContext { coreLevel: number; baseDamage: number; baseInterval: number; }
export function attackStats(levels: EquipmentLevels): AttackStats {
    const g = BALANCE.gear;
    const damage = g.baseDamage + levels.crystal * g.crystalDamagePerLevel + levels.core * g.coreDamagePerLevel;
    return {
        damage, interval: g.baseInterval / (1 + levels.watch * g.watchHastePerLevel + levels.core * g.coreHastePerLevel),
        projectileCount: levels.twin === 0 ? 1 : levels.twin === 1 ? 2 : 3,
        projectileSpeed: g.projectileSpeed + levels.core * g.coreProjectileSpeed, penetrations: levels.pierce,
        tracking: g.tracking[levels.ring],
        blastRadius: levels.blast ? g.blastRadius[levels.blast] + levels.core * g.coreBlastRadius : 0,
        blastCount: levels.blast >= 3 ? 2 : levels.blast > 0 ? 1 : 0,
        burnDuration: g.burnDuration[levels.flame],
        burnDamage: g.burnDamage[levels.flame] * (1 + levels.core * g.coreBurnScale),
        orbitDamage: levels.twin >= 3 ? damage * g.orbitDamageScale : 0, coreLevel: levels.core,
    };
}

/** Bounded totals make each further reinforcement smaller, even in long runs. */
export function reinforcementBonuses(count: number): { damage: number; speed: number; critical: number; range: number } {
    const g = BALANCE.growth, progress = Math.max(0, count) / (Math.max(0, count) + g.reinforcementKnee);
    return { damage: g.reinforcementDamage * progress, speed: g.reinforcementSpeed * progress, critical: g.reinforcementCritical * progress, range: g.reinforcementRange * progress };
}


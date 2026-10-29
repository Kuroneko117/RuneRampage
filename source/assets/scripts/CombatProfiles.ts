/** Small substitutions in the existing V0.6 horde, never additional population slots. */
export const BEETLE = {
    startWave:8,share:.055,lateShare:.085,earlyCap:3,lateCap:5,
    speed:.84,hp:1.3,guard:.7,damageTaken:.65,warning:.85,
    dashSpeed:360,dashDuration:.42,recovery:1.05,approachCooldown:2.6,
};
export const BOSS_PHASES = [
    {name:'巨像初现',motif:'初现',recovery:2,enragedRecovery:1.3,warning:.8,enragedWarning:.7,dashSpeed:410,enragedSpeed:490,pairedRunes:false},
    {name:'不稳定巨像',motif:'错拍',recovery:1.85,enragedRecovery:1.25,warning:.85,enragedWarning:.75,dashSpeed:430,enragedSpeed:490,pairedRunes:false},
    {name:'高能巨像',motif:'双印',recovery:1.8,enragedRecovery:1.2,warning:.9,enragedWarning:.8,dashSpeed:430,enragedSpeed:490,pairedRunes:true},
    {name:'完全失控',motif:'终式',recovery:1.85,enragedRecovery:1.1,warning:.9,enragedWarning:.8,dashSpeed:440,enragedSpeed:500,pairedRunes:true},
] as const;

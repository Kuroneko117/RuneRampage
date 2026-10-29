import { GameMode } from './ArenaModel';
export interface RecordEntry { wave:number; kills:number; elapsed:number; combo:number; damage:number; clears:number; runs:number; bossKills:number; finalBossKills:number; }
export interface StoragePort { getItem(key:string):string|null; setItem(key:string,value:string):void; }
const empty=():RecordEntry=>({wave:0,kills:0,elapsed:0,combo:0,damage:0,clears:0,runs:0,bossKills:0,finalBossKills:0});
const safe=(n:any,max=1e9):number=>Number.isFinite(n)?Math.max(0,Math.min(max,n)):0;
/** Old mode-less kills/time remain legacy data; never invent mode-specific history. */
export class RecordsService {
    readonly key='rune-rampage.ui08.records';
    data={version:1,campaign:empty(),endless:empty(),lastRun:''};
    saveError=false;
    constructor(private storage:StoragePort) {
        try {const raw=JSON.parse(storage.getItem(this.key)||'null');if(raw?.version===1){for(const mode of ['campaign','endless'] as GameMode[])for(const k of Object.keys(empty()) as (keyof RecordEntry)[])this.data[mode][k]=safe(raw[mode]?.[k]);this.data.lastRun=typeof raw.lastRun==='string'?raw.lastRun:'';}}catch{}
    }
    migrate(progress:{campaignBest:number;endlessBest:number}):void {this.data.campaign.wave=Math.max(this.data.campaign.wave,Math.min(20,safe(progress.campaignBest)));this.data.endless.wave=Math.max(this.data.endless.wave,safe(progress.endlessBest));this.save();}
    checkpoint(mode:GameMode,wave:number):void {this.data[mode].wave=Math.max(this.data[mode].wave,safe(wave,mode==='campaign'?20:100000));this.save();}
    finish(id:string,run:{mode:GameMode;wave:number;kills:number;elapsed:number;maxCombo:number;highestDamage:number;phase:string;bossClears?:number;finalBossDefeated?:boolean}):boolean {
        if(!id||this.data.lastRun===id)return false;
        const r=this.data[run.mode];r.wave=Math.max(r.wave,safe(run.wave,run.mode==='campaign'?20:100000));
        r.kills=Math.max(r.kills,safe(run.kills));r.elapsed=Math.max(r.elapsed,safe(run.elapsed));r.combo=Math.max(r.combo,safe(run.maxCombo));r.damage=Math.max(r.damage,safe(run.highestDamage));r.runs++;if(run.mode==='campaign'&&run.phase==='victory')r.clears++;
        r.bossKills+=safe(run.bossClears);if(run.mode==='campaign'&&run.finalBossDefeated)r.finalBossKills++;
        this.data.lastRun=id;this.save();return true;
    }
    private save():void {try{this.storage.setItem(this.key,JSON.stringify(this.data));this.saveError=false;}catch{this.saveError=true;}}
}

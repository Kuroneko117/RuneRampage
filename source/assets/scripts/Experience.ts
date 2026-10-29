export interface Preferences { sound:boolean; shake:number; musicVolume:number;sfxVolume:number;effects:number; }
function object(raw:string|null):any {
    try{if(!raw||raw.length>4096)return null;const v=JSON.parse(raw);return v&&typeof v==='object'&&!Array.isArray(v)?v:null;}catch{return null;}
}
export function readPreferences(raw:string|null):Preferences {
    const v=object(raw),volume=(n:any,fallback:number)=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):fallback;
    return {sound:typeof v?.sound==='boolean'?v.sound:true,shake:volume(v?.shake,.5),musicVolume:volume(v?.musicVolume,.25),sfxVolume:volume(v?.sfxVolume,1),effects:v?.effects===.5?.5:1};
}

export type MusicScene = 'menu' | 'battle' | 'boss' | 'shop' | 'victory';
export const MUSIC_SCENES: MusicScene[] = ['menu','battle','boss','shop','victory'];
export const MUSIC_CONFIG = { fadeOut: .22, fadeIn: .38, gain: .65 };
export interface MusicVoice {
    available(scene:MusicScene):boolean;
    start(scene:MusicScene):void;
    pause():void;
    resume():void;
    stop():void;
    volume(value:number):void;
}
/** One voice, fade-through-silence transitions. No overlapping BGM or per-frame allocations. */
export class MusicDirector {
    target:MusicScene='menu';current:MusicScene|null=null;
    gain=0;volume=.25;unlocked=false;suspended=false;paused=false;starts=0;
    private disposed=false;
    constructor(private voice:MusicVoice){}
    setScene(scene:MusicScene):void {this.target=scene;}
    setVolume(value:number):void {this.volume=Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;this.applyGate();}
    unlock():void {this.unlocked=true;}
    setSuspended(value:boolean):void {this.suspended=value;this.applyGate();}
    private get blocked():boolean{return !this.unlocked||this.suspended||this.volume<=0;}
    private applyGate():void {
        if(this.blocked&&this.current&&!this.paused){this.voice.volume(0);this.voice.pause();this.paused=true;this.gain=0;}
    }
    update(dt:number):void {
        if(this.disposed)return;
        this.applyGate();if(this.blocked)return;
        dt=Math.max(0,Math.min(.1,dt));
        if(this.paused){
            // A background scene change must never briefly resume the old theme.
            if(this.current===this.target){this.voice.resume();this.paused=false;}
            else {this.voice.stop();this.current=null;this.paused=false;}
        }
        if(this.current&&this.current!==this.target){
            this.gain=Math.max(0,this.gain-dt/MUSIC_CONFIG.fadeOut);
            this.voice.volume(this.gain*this.volume*MUSIC_CONFIG.gain);
            if(this.gain>0)return;
            this.voice.stop();this.current=null;
        }
        if(!this.current){
            if(!this.voice.available(this.target))return;
            this.voice.volume(0);this.voice.start(this.target);this.current=this.target;this.starts++;this.gain=0;
        }
        this.gain=Math.min(1,this.gain+dt/MUSIC_CONFIG.fadeIn);
        this.voice.volume(this.gain*this.volume*MUSIC_CONFIG.gain);
    }
    dispose():void {this.disposed=true;this.voice.stop();this.current=null;this.gain=0;}
}

import { _decorator, Component, AudioClip, AudioSource, Node, resources } from 'cc';
import { MusicDirector, MusicScene, MUSIC_SCENES } from './MusicDirector';
const { ccclass } = _decorator;
export type SoundKind = 'attack' | 'hit' | 'critical' | 'coin' | 'purchase' | 'overload' | 'explosion';
const SOUNDS: SoundKind[] = ['attack', 'hit', 'critical', 'coin', 'purchase', 'overload', 'explosion'];
const GAP = { attack: 95, hit: 70, critical: 150, coin: 100, purchase: 210, overload: 800, explosion: 220 };
/** Seven reusable channels: a repeated cue restarts its channel instead of adding voices. */
@ccclass('AudioFeedback')
export class AudioFeedback extends Component {
    private soundEnabled=true;private suspended=false;private music:AudioSource|null=null;private musicVolume=.25;private sfxVolume=1;
    private tracks={} as Record<MusicScene,AudioClip>;
    private director=new MusicDirector({
        available:scene=>!!this.music&&!!this.tracks[scene],
        start:scene=>{this.music!.clip=this.tracks[scene];this.music!.play();},
        pause:()=>this.music?.pause(),resume:()=>{if(this.music&&!this.music.playing)this.music.play();},stop:()=>this.music?.stop(),
        volume:value=>{if(this.music)this.music.volume=value;},
    });
    setVolumes(music:number,sfx:number):void {this.musicVolume=music;this.sfxVolume=sfx;this.director.setVolume(music);}
    unlockMusic():void {this.director.unlock();}
    setMusicScene(scene:MusicScene):void {this.director.setScene(scene);}
    update(dt:number):void {this.director.update(dt);}
    setEnabled(value:boolean):void {this.soundEnabled=value;if(!value)this.stopAll();}
    setSuspended(value:boolean):void {this.suspended=value;if(value)this.stopAll();this.director.setSuspended(value);}
    ready = false; error = ''; requests = 0; started = 0;
    private sources = {} as Record<SoundKind, AudioSource>;
    private next = {} as Record<SoundKind, number>;
    private played = { attack: 0, hit: 0, critical: 0, coin: 0, purchase: 0, overload: 0, explosion: 0 };
    onLoad(): void {
        resources.loadDir('audio', AudioClip, (error, clips) => {
            if (!this.isValid) return;
            if (error) { this.error = error.message; return; }
            for (const kind of SOUNDS) {
                const clip = clips.find(c => c.name === kind);
                if (!clip) { this.error = 'Missing audio: ' + kind; continue; }
                const node = new Node('Audio-' + kind); this.node.addChild(node);
                const source = node.addComponent(AudioSource);
                source.playOnAwake = false; source.loop = false; source.clip = clip;
                node.on(AudioSource.EventType.STARTED, () => this.started++);
                this.sources[kind] = source;
            }
            this.ready = SOUNDS.every(k => !!this.sources[k]);
            const n=new Node('Music-BGM');this.node.addChild(n);this.music=n.addComponent(AudioSource);
            this.music.playOnAwake=false;this.music.loop=true;this.music.volume=0;
            for(const scene of MUSIC_SCENES){const clip=clips.find(c=>c.name==='bgm_'+scene);if(clip)this.tracks[scene]=clip;else this.error='Missing BGM: '+scene;}
        });
    }
    play(kind: SoundKind, strength = 1): void {
        if(!this.soundEnabled||this.suspended)return;this.requests++;
        const source = this.sources[kind], now = Date.now();
        if (!source || now < (this.next[kind] || 0)) return;
        this.next[kind] = now + GAP[kind];
        source.volume = this.sfxVolume*Math.min(0.4, 0.24 * Math.max(0.3, strength));
        source.play(); this.played[kind]++;
    }
    stopAll(): void { for (const kind of SOUNDS) this.sources[kind]?.stop(); }
    onDestroy():void {this.stopAll();this.director.dispose();}
    getDiagnostics(): object {
        return { enabled:this.soundEnabled,suspended:this.suspended,musicVolume:this.musicVolume,sfxVolume:this.sfxVolume,musicPlaying:!!this.music?.playing,
            musicScene:this.director.current,musicTarget:this.director.target,musicGain:this.director.gain,musicPaused:this.director.paused,musicStarts:this.director.starts,musicTime:this.music?.currentTime||0,musicTracks:Object.keys(this.tracks).length,musicChannels:this.music?1:0,
            ready: this.ready, error: this.error, channels: Object.keys(this.sources).length, requests: this.requests,
            started: this.started, played: { ...this.played }, playing: SOUNDS.filter(k => this.sources[k]?.playing).length };
    }
}

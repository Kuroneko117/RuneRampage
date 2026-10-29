import { resources, SpriteFrame, Sprite, Texture2D, Rect, Size, Vec2, UITransform } from 'cc';
import { ART_FRAMES, ART_ANIMATIONS } from './ArtCatalog';
export type ArtKey = 'mage'|'staff'|'rune'|'slime'|'bat'|'slimeWhite'|'batWhite'|'burn'|'bolt'|'flameBolt'|'coin'|'spark'|'burst'|'orbit'|'shadow'|'cast'|'golem'|'golemWhite'|'beetle'|'beetleWhite'|'beetleGuard'|'equipTwin'|'equipBlast'|'equipCrystal'|'equipWatch'|'equipPierce'|'equipRing'|'equipFlame'|'equipCore'|'crest';
const ALIASES:Record<ArtKey,string>={mage:'player_idle_01',staff:'star_four',rune:'circle_rune',slime:'slime_idle_01',bat:'bat_idle_01',slimeWhite:'slime_hit_01',batWhite:'bat_idle_01',burn:'explosion_fire',bolt:'bolt_1_1',flameBolt:'bolt_2_1',coin:'coin',spark:'star_four',burst:'bolt_impact',orbit:'star_four',shadow:'circle_broken',cast:'circle_cast',golem:'golem_stage_1_pose_01',golemWhite:'golem_stage_1_pose_01',beetle:'beetle_idle_01',beetleWhite:'beetle_idle_01',beetleGuard:'beetle_idle_02',equipTwin:'icon_rune',equipBlast:'explosion_fire',equipCrystal:'gem_blue',equipWatch:'icon_lightning',equipPierce:'icon_ice',equipRing:'icon_shield',equipFlame:'icon_fire',equipCore:'burst_overload',crest:'circle_rune'};
/** User-approved cropped pixels only. Immutable frames are created once, never during animation. */
export class BattleArt {
    private readonly transforms=new WeakMap<Sprite,UITransform>();
    private disposed=false; ready=false; worldReady=false; error='';worldError='';
    private frames:Record<string,SpriteFrame>={}; private pending:{sprite:Sprite;key:ArtKey}[]=[];
    private worldLoading=false;private worldWaiters:(()=>void)[]=[];
    loadMs=0;worldLoadMs=0;
    load(done:()=>void):void { const start=Date.now();this.loadAtlas('combat',()=>{this.loadMs=Date.now()-start;this.ready=!this.error;for(const p of this.pending)if(p.sprite.isValid)p.sprite.spriteFrame=this.frame(p.key);this.pending.length=0;done();}); }
    private loadAtlas(name:string,done:()=>void):void {
        resources.load('art/v08/'+name+'/texture',Texture2D,(err,texture)=>{
            if(this.disposed)return;if(err){this.error=err.message;done();return;}
            for(const key of Object.keys(ART_FRAMES)){const a=ART_FRAMES[key];if(a[0]!==name)continue;
                const [,x,y,w,h,ow,oh,px,py]=a as [string,number,number,number,number,number,number,number,number];
                const f=new SpriteFrame();f.reset({texture,rect:new Rect(x,y,w,h),originalSize:new Size(ow,oh),offset:new Vec2(px+w/2-ow/2,oh/2-py-h/2)});f.packable=false;this.frames[key]=f;
            }done();
        });
    }
    loadWorld(done:()=>void):void {
        if(this.worldReady){done();return;}this.worldWaiters.push(done);if(this.worldLoading)return;this.worldLoading=true;this.error='';this.worldError='';const start=Date.now();
        this.loadAtlas('world',()=>{if(this.error){this.worldError=this.error;this.finishWorld(false,start);return;}
            resources.load('art/v08/arena_720x1280/texture',Texture2D,(err,texture)=>{if(this.disposed)return;if(err){this.worldError=err.message;this.finishWorld(false,start);return;}
                const f=new SpriteFrame();f.reset({texture,rect:new Rect(0,0,720,1280),originalSize:new Size(720,1280)});f.packable=false;this.frames.arena=f;this.finishWorld(true,start);
            });
        });
    }
    private finishWorld(ok:boolean,start:number):void {this.worldLoading=false;this.worldReady=ok;this.worldLoadMs=Date.now()-start;const list=this.worldWaiters.splice(0);for(const done of list)done();}
    bind(sprite:Sprite,key:ArtKey):void {sprite.trim=false;if(this.ready)sprite.spriteFrame=this.frame(key);else this.pending.push({sprite,key});}
    frame(key:ArtKey):SpriteFrame {return this.frames[ALIASES[key]];}
    named(name:string):SpriteFrame {return this.frames[name];}
    animate(sprite:Sprite,sequence:string,time:number,height:number,loop=true):void {
        const a=ART_ANIMATIONS[sequence];if(!this.ready||!a)return;const index=Math.max(0,Math.floor(time*a.fps));
        const key=a.frames[loop?index%a.frames.length:Math.min(a.frames.length-1,index)];this.pose(sprite,key,height);
    }
    pose(sprite:Sprite,name:string,height:number):void {
        const frame=this.frames[name];if(!frame)return;if(sprite.spriteFrame!==frame)sprite.spriteFrame=frame;sprite.trim=false;
        let t=this.transforms.get(sprite);if(!t){t=sprite.node.getComponent(UITransform)!;this.transforms.set(sprite,t);}
        const s=frame.originalSize;const w=height*s.width/s.height;
        if(Math.abs(t.height-height)>.01||Math.abs(t.width-w)>.01)t.setContentSize(w,height);
    }
    dispose():void {this.disposed=true;for(const key of Object.keys(this.frames))this.frames[key].destroy();this.pending.length=0;this.worldWaiters.length=0;}
    get frameCount():number{return Object.keys(this.frames).length;}
}

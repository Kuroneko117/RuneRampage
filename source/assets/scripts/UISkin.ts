import { Node, Sprite, SpriteFrame, Texture2D, Rect, Size, UITransform, Color, resources } from 'cc';
import { PALETTE as C } from './UITheme';
/** Shared 64x32 pixel sheet, two nine-slices. Replaces per-panel Graphics GPU buffers. */
export class UISkin {
    private static frames:SpriteFrame[]=[];private static waiting:{sprite:Sprite;frame:number}[]=[];private static loading=false;
    static ready=false;static error='';
    static sprite(node:Node,frame:number,color:Color):Sprite {const sp=node.addComponent(Sprite);sp.sizeMode=Sprite.SizeMode.CUSTOM;sp.type=frame===2?Sprite.Type.SIMPLE:Sprite.Type.SLICED;sp.color=color;
        if(this.ready)sp.spriteFrame=this.frames[frame];else {this.waiting.push({sprite:sp,frame});this.load();}return sp;}
    static load():void {if(this.loading)return;this.loading=true;resources.load('art/ui/panels/texture',Texture2D,(error,texture)=>{if(error){this.error=error.message;return;}for(let i=0;i<3;i++){const f=new SpriteFrame();f.reset({texture,rect:i===2?new Rect(16,16,1,1):new Rect(i*32,0,32,32),originalSize:i===2?new Size(1,1):new Size(32,32)});if(i<2){f.insetLeft=12;f.insetRight=12;f.insetTop=12;f.insetBottom=12;}f.packable=false;this.frames.push(f);}this.ready=true;for(const p of this.waiting)if(p.sprite.isValid)p.sprite.spriteFrame=this.frames[p.frame];this.waiting.length=0;});}
}
export class UISurface {
    readonly body:Sprite;readonly border:Sprite;
    constructor(readonly node:Node,w:number,h:number,accent=C.rim){this.body=UISkin.sprite(node,0,C.panel);const edge=new Node('PixelBorder');edge.layer=node.layer;node.addChild(edge);edge.addComponent(UITransform).setContentSize(w,h);this.border=UISkin.sprite(edge,1,accent);}
    paint(accent:Color,primary=false,pressed=false,disabled=false):void {
        this.border.color=disabled?C.grid:accent;
        this.body.color=disabled?C.panel:accent.equals(C.gold)?(pressed?C.buyPressed:C.buy):primary?(pressed?C.primaryPressed:C.primary):C.button;
    }
}

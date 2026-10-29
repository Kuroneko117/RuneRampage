import { Sprite, SpriteFrame, Texture2D, Rect, Size, resources } from 'cc';
/** Selected CC0 7Soul1 crystal only; one 34px texture shared by both overload controls. */
export class OverloadArtwork {
    static ready=false;static error='';private static frame:SpriteFrame|null=null;
    private static loading=false;private static waiting:Sprite[]=[];
    static bind(sprite:Sprite):void {
        if(this.frame){sprite.spriteFrame=this.frame;return;}
        this.waiting.push(sprite);if(this.loading)return;this.loading=true;
        resources.load('art/ui/overload/texture',Texture2D,(error,texture)=>{
            if(error){this.error=error.message;this.ready=true;this.waiting.length=0;return;}
            const frame=new SpriteFrame();frame.reset({texture,rect:new Rect(0,0,texture.width,texture.height),originalSize:new Size(texture.width,texture.height)});frame.packable=false;
            this.frame=frame;this.ready=true;for(const target of this.waiting)if(target.isValid)target.spriteFrame=frame;this.waiting.length=0;
        });
    }
}

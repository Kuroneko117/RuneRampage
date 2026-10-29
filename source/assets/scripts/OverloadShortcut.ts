/** Reference-space touch affordance. Reused for every charge, with no nodes/allocations in move(). */
export class OverloadShortcut {
    visible=false;x=-205;y=-438;inside=false;armed=false;
    private down=false;private px=-106;private py=-470;private ox=0;private oy=0;private held=0;
    setAvailable(available:boolean):void {
        if(available===this.visible)return;
        this.visible=available;this.resetArm();
        if(available){this.place(this.px,this.py);this.ox=this.px;this.oy=this.py;}
    }
    private place(x:number,y:number):void {
        // Keep this gesture target in the bottom control strip, never in the arena.
        this.x=Math.max(-235,Math.min(80,x+(x<=0?100:-100)));
        this.y=-438;
    }
    begin(x:number,y:number):void {this.down=true;this.px=x;this.py=y;this.ox=x;this.oy=y;this.resetArm();if(this.visible)this.place(x,y);}
    move(x:number,y:number):void {
        this.px=x;this.py=y;
        const inside=this.down&&this.visible&&Math.hypot(x-this.ox,y-this.oy)>=16&&this.contains(x,y);
        if(!inside)this.resetArm();else this.inside=true;
    }
    update(dt:number):void {if(this.inside&&this.down&&this.visible){this.held+=Math.min(.1,Math.max(0,dt));this.armed=this.held>=.12;}}
    contains(x:number,y:number):boolean {return this.visible&&Math.abs(x-this.x)<=66&&Math.abs(y-this.y)<=66;}
    end(x:number,y:number):boolean {const release=this.down&&this.visible&&this.armed&&this.contains(x,y);this.cancel();if(release)this.visible=false;return release;}
    cancel():void {this.down=false;this.resetArm();}
    private resetArm():void {this.held=0;this.inside=false;this.armed=false;}
}

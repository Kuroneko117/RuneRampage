import { Node, Graphics, Button, Label, Color, UIOpacity, UITransform, Vec3 } from 'cc';
import { PALETTE as C, paintPanel } from './UITheme';
import { UISurface } from './UISkin';
export type UIButtonState='normal'|'hover'|'pressed'|'disabled'|'selected'|'loading'|'success'|'failure';
export class UIAnimationService {
    private items:{node:Node;age:number;duration:number;amount:number}[]=[];
    pop(node:Node,amount=.035,duration=.18):void {let item=this.items.find(x=>x.node===node);if(item){item.age=0;item.amount=amount;return;}if(this.items.length<16)this.items.push({node,age:0,duration,amount});}
    update(dt:number):void {for(let i=this.items.length-1;i>=0;i--){const v=this.items[i];v.age+=dt;if(!v.node.isValid||v.age>=v.duration){if(v.node.isValid)v.node.setScale(1,1,1);this.items.splice(i,1);continue;}const s=1+Math.sin(v.age/v.duration*Math.PI)*v.amount;v.node.setScale(s,s,1);}}
}
/** Native Cocos Button handles press/cancel/multi-touch; shared paint handles all visible states. */
export class UIButton {
    readonly component:Button;state:UIButtonState='normal';private resting:UIButtonState='normal';private enabled=true;private feedbackTime=0;
    constructor(readonly id:string,readonly node:Node,readonly label:Label,private surface:UISurface|null,readonly width:number,public height:number,private accent:Color,private primary:boolean,action:()=>void){
        this.component=node.addComponent(Button);this.component.transition=Button.Transition.NONE;
        node.on(Button.EventType.CLICK,()=>{if(this.enabled&&this.state!=='loading')action();});
        node.on(Node.EventType.TOUCH_START,()=>{if(this.enabled)this.paint('pressed');});
        node.on(Node.EventType.TOUCH_END,()=>this.paint(this.resting));node.on(Node.EventType.TOUCH_CANCEL,()=>this.paint(this.resting));
        node.on(Node.EventType.MOUSE_ENTER,()=>{if(this.enabled)this.paint('hover');});node.on(Node.EventType.MOUSE_LEAVE,()=>this.paint(this.resting));this.paint('normal');
    }
    configure(text:string,enabled=true,selected=false,accent=this.accent):void {if(this.label.string!==text)this.label.string=text;const colorChanged=!this.accent.equals(accent);this.accent=accent;this.enabled=enabled;this.component.interactable=enabled;const next=enabled?(selected?'selected':'normal'):'disabled';if(this.resting!==next||colorChanged){this.resting=next;this.paint(next);}}
    feedback(success:boolean):void {this.feedbackTime=.4;this.paint(success?'success':'failure');}
    setPrimary(primary:boolean):void {this.primary=primary;this.paint(this.resting);}
    setTouchHeight(height:number):void {this.height=height;this.node.getComponent(UITransform)!.setContentSize(this.width,height);}
    loading(text='加载中…'):void {this.label.string=text;this.component.interactable=false;this.paint('loading');}
    update(dt:number):void {if(this.feedbackTime>0){this.feedbackTime-=dt;if(this.feedbackTime<=0)this.paint(this.resting);}}
    private paint(state:UIButtonState):void {
        this.state=state;const disabled=state==='disabled'||state==='loading',accent=state==='failure'?C.red:state==='success'?C.lime:disabled?C.grid:this.accent;
        this.surface?.paint(accent,this.primary||state==='selected'||state==='hover',state==='pressed',disabled);
        // Keep the native hit rectangle stationary while a finger is held at its edge.
        this.label.color=disabled?C.muted:this.primary?C.cyan:C.ink;this.label.node.setScale(state==='pressed'?.974:1,state==='pressed'?.974:1,1);
    }
}
export class UIIconButton extends UIButton {}
export class UIPanel {readonly surface:UISurface;constructor(readonly node:Node,w:number,h:number,accent=C.rim){this.surface=new UISurface(node,w,h,accent);}}
export class UIModal extends UIPanel {}
export class UIProgressBar {
    private last=-1;
    constructor(readonly fill:Node){}
    set(value:number):void {value=Math.max(0,Math.min(1,value));if(value!==this.last){this.fill.setScale(Math.max(.0001,value),1,1);this.last=value;}}
}
export class UIToast {
    private age=0;private opacity:UIOpacity;
    constructor(readonly node:Node,readonly label:Label){this.opacity=node.addComponent(UIOpacity);node.active=false;}
    show(text:string,error=false):void {this.label.string=text;this.label.color=error?C.red:C.cyan;this.age=2.8;this.opacity.opacity=255;this.node.active=true;this.node.setSiblingIndex(this.node.parent!.children.length-1);}
    hide():void {this.age=0;this.node.active=false;}
    update(dt:number):void {if(!this.node.active)return;this.age-=dt;this.opacity.opacity=Math.min(255,Math.max(0,this.age*850));if(this.age<=0)this.node.active=false;}
}
export class UIRewardCard {constructor(readonly node:Node,readonly title:Label,readonly detail:Label){} }
export class UIShopCard extends UIRewardCard {purchased=false;}
export interface UIHit {id:string;x:number;y:number;w:number;h:number;node:Node;}
export function hitTest(buttons:readonly UIButton[],root:Node,x:number,y:number,filter:(b:UIButton)=>boolean):UIHit|undefined {
    const p=new Vec3(x,y,0),world=root.getComponent(UITransform)!.convertToWorldSpaceAR(p);
    for(let i=buttons.length-1;i>=0;i--){const b=buttons[i];if(!b.node.activeInHierarchy||!filter(b))continue;const local=b.node.getComponent(UITransform)!.convertToNodeSpaceAR(world);if(Math.abs(local.x)<=b.width/2&&Math.abs(local.y)<=b.height/2)return {id:b.id,x,y,w:b.width,h:b.height,node:b.node};}return undefined;
}

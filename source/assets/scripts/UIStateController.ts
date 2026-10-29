export type UIPage='home'|'modes'|'records'|'catalog'|'help';
/** A single top modal owns input; the underlying gameplay phase remains untouched. */
export class UIStateController {
    page:UIPage='home';private stack:string[]=[];
    get modal():string{return this.stack[this.stack.length-1]||'none';}
    push(id:string):void {if(this.modal!==id)this.stack.push(id);}
    replace(id:string):void {if(this.stack.length)this.stack.pop();if(id!=='none')this.stack.push(id);}
    pop():string {this.stack.pop();return this.modal;}
    clear():void {this.stack.length=0;}
}

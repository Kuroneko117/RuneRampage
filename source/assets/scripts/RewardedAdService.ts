export type AdResult='completed'|'skipped'|'failed'|'unavailable'|'busy';
export interface RewardedAdPort {onClose(fn:(r?:{isEnded?:boolean})=>void):void;onError(fn:(e:any)=>void):void;offClose?(fn:Function):void;offError?(fn:Function):void;load():Promise<unknown>;show():Promise<unknown>;destroy?():void;}
/** No test adapter is shipped. Tests inject a port into this same state machine externally. */
export class RewardedAdService {
    state:'unavailable'|'idle'|'loading'|'showing'|'completed'|'skipped'|'failed'='unavailable';
    error='';private ad:RewardedAdPort|null=null;private pending:((r:AdResult)=>void)|null=null;private token=0;
    private close=(r?:{isEnded?:boolean})=>{if(this.state!=='showing'||!this.pending)return;this.settle(r?.isEnded===true?'completed':'skipped');};
    private fail=(e:any)=>{this.error=String(e?.errMsg||e?.message||'广告暂不可用');if(this.pending)this.settle('failed');else this.state='failed';};
    constructor(create:((id:string)=>RewardedAdPort)|null,id:string){
        if(!create||!id.trim())return;
        try{this.ad=create(id);this.ad.onClose(this.close);this.ad.onError(this.fail);this.state='idle';}catch(e){this.error=String(e);}
    }
    get available():boolean{return !!this.ad;}
    get busy():boolean{return !!this.pending;}
    async request():Promise<AdResult>{
        if(!this.ad)return 'unavailable';if(this.pending)return 'busy';
        const token=++this.token;this.state='loading';
        const result=new Promise<AdResult>(resolve=>this.pending=resolve);
        // Do not retry after an SDK error callback has already settled this request.
        try{await this.ad.load();if(!this.pending||token!==this.token)return result;this.state='showing';try{await this.ad.show();}catch{if(!this.pending||token!==this.token)return result;this.state='loading';await this.ad.load();if(!this.pending||token!==this.token)return result;this.state='showing';await this.ad.show();}}
        catch(e){if(token===this.token&&this.pending)this.fail(e);}
        return result;
    }
    private settle(result:'completed'|'skipped'|'failed'):void {const done=this.pending;if(!done)return;this.pending=null;this.state=result;done(result);}
    dispose():void{if(this.pending)this.settle('failed');this.token++;this.ad?.offClose?.(this.close);this.ad?.offError?.(this.fail);this.ad?.destroy?.();this.ad=null;}
}

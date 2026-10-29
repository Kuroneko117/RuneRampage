import { GameMode } from './ArenaModel';
import { PRODUCT } from './ProductConfig';
/** Friend entries are never transferred to the main domain. Only commands go out. */
export class LeaderboardService {
    private sent={campaign:0,endless:0};private request=0;
    error='';
    constructor(private wx:any){}
    get available():boolean{return !!(PRODUCT.friendLeaderboard&&this.wx?.getOpenDataContext);}
    publish(mode:GameMode,wave:number):void {
        if(!this.available)return;wave=Math.max(0,Math.floor(wave));if(!wave||wave<=this.sent[mode])return;
        try{this.wx.getOpenDataContext().postMessage({type:'rune:leaderboard',command:'publish',mode,key:PRODUCT.leaderboardKeys[mode],wave});this.sent[mode]=wave;}catch{this.error='云纪录同步请求失败';}
    }
    show(mode:GameMode):boolean {
        if(!this.available)return false;const request=++this.request;
        const post=(command:string,message='')=>{if(request!==this.request)return;try{this.wx.getOpenDataContext().postMessage({type:'rune:leaderboard',command,mode,key:PRODUCT.leaderboardKeys[mode],message});}catch{this.error='好友排行未能打开，请检查开放数据域构建';}};
        post('status','等待微信好友授权…');
        const authorize=()=>{if(!this.wx.authorize){post('load');return;}this.wx.authorize({scope:'scope.WxFriendInteraction',success:()=>post('load'),fail:()=>post('status','好友授权未开启。个人纪录仍可使用；允许授权后点刷新。')});};
        if(this.wx.requirePrivacyAuthorize)this.wx.requirePrivacyAuthorize({success:authorize,fail:()=>post('status','未同意隐私授权，未读取好友数据。可使用个人纪录。')});else authorize();return true;
    }
    page(direction:number):void{try{this.wx?.getOpenDataContext?.().postMessage({type:'rune:leaderboard',command:'page',direction});}catch{}}
}

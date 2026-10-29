import { sys } from 'cc';
import { PRODUCT } from './ProductConfig';
import { RewardedAdService } from './RewardedAdService';
declare const wx:any;
export class WeChatPlatformService {
    readonly api:any=typeof wx!=='undefined'&&sys.platform===sys.Platform.WECHAT_GAME?wx:null;
    readonly ads:RewardedAdService;
    private shareHandler=()=>({title:'突破极限，释放禁忌术式！一起来挑战《术式过载》'});
    private supportsAds(w:any):boolean {if(typeof w?.createRewardedVideoAd!=='function')return false;try{const info=w.getAppBaseInfo?.()||w.getSystemInfoSync?.(),v=String(info?.SDKVersion||'0').split('.').map(Number);return (v[0]||0)*1000000+(v[1]||0)*1000+(v[2]||0)>=2000004;}catch{return false;}}
    constructor(){const w=this.api;this.ads=new RewardedAdService(this.supportsAds(w)?(id)=>w.createRewardedVideoAd({adUnitId:id}):null,PRODUCT.REWARDED_AD_UNIT_ID);
        if(w){try{w.showShareMenu?.({menus:['shareAppMessage']});w.onShareAppMessage?.(this.shareHandler);}catch{}}
    }
    share(wave?:number):string {
        if(!this.api?.shareAppMessage)return '微信内可分享游戏；当前预览未发送分享';
        try{this.api.shareAppMessage({title:wave?`我在《术式过载》中坚持到了第 ${wave} 波，来挑战我的术式！`:this.shareHandler().title});return '已请求打开微信分享面板';}catch{return '分享面板暂不可用，请稍后重试';}
    }
    privacy():string {if(!this.api?.openPrivacyContract)return '本机保存设置与战绩；好友资料仅在微信开放数据域使用。广告位当前未配置。';try{this.api.openPrivacyContract({fail:()=>{}});return '已请求打开微信隐私指引';}catch{return '隐私指引暂不可用；请检查微信后台配置';}}
    dispose():void{this.ads.dispose();this.api?.offShareAppMessage?.(this.shareHandler);}
}

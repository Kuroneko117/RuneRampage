import { Node, Graphics, Label, Sprite, Color, UIOpacity, UITransform, Widget, SubContextView } from 'cc';
import { OverloadShortcut } from './OverloadShortcut';
import { OverloadArtwork } from './OverloadArtwork';
import { PALETTE as C, paintPanel, paintSigil, cutRect } from './UITheme';
import { ArenaModel, RULES, GameMode } from './ArenaModel';
import { EQUIPMENT } from './Equipment';
import { BattleArt, ArtKey } from './BattleArt';
import { UIButton, UIIconButton, UIPanel, UIToast, UIAnimationService, UIProgressBar, UIRewardCard, UIShopCard, hitTest } from './UIComponents';
import { UIPage, UIStateController } from './UIStateController';
import { RecordEntry } from './RecordsService';
import { PRODUCT } from './ProductConfig';
import { UISurface, UISkin } from './UISkin';
type LabelFactory=(name:string,text:string,x:number,y:number,size:number,color:Color,width:number,height:number,parent:Node)=>Label;
export class UIManager {
    get skinReady():boolean{return UISkin.ready&&OverloadArtwork.ready;}
    get skinError():string{return UISkin.error||OverloadArtwork.error;}
    readonly shortcut=new OverloadShortcut();
    readonly state=new UIStateController();readonly buttons:UIButton[]=[];readonly animation=new UIAnimationService();
    readonly pages={} as Record<UIPage,Node>;readonly refs:Record<string,any>={};readonly toast:UIToast;
    private clock=0;private bars:UIProgressBar[]=[];private overloadState='';private overloadSegment=-1;
    private overloadRing!:Graphics;private overloadCore!:Node;private hero!:Node;private sigil!:Node;
    private overloadGem!:Sprite;private quickGem!:Sprite;private quickRune!:Graphics;private quickHint!:Label;private quickNode!:Node;private quickArmed=false;
    private motes:Node[]=[];private title!:Node;
    private selected:GameMode='campaign';private recordMode:GameMode='campaign';private friend=false;private catalogIndex=0;
    private recordBody!:Label;private recordFooter!:Label;private modeStats:Label[]=[];private catalogDetail!:Label;private friendRoot!:Node;
    private resultWave!:Label;private resultCaption!:Label;private resultValues:Label[]=[];private resultFooter!:Label;
    private menuParent!:Node;private nativeSub:SubContextView|null=null;private friendEnabled=false;private lastPage='';
    constructor(readonly root:Node,private art:BattleArt,private labelFactory:LabelFactory,private action:(id:string)=>void){
        this.createHUD();this.createHome();this.createModes();this.createRecords();this.createCatalog();this.createHelp();this.createShop();this.createResult();this.createSettings();this.createStats();this.createRevive();
        const n=this.panel('Toast',root,632,80,0,-350,C.cyan),l=this.text(n,'ToastText','',0,0,22,C.cyan,584,70);this.toast=new UIToast(n,l);
        this.showPage('home');
    }
    private node(name:string,parent:Node,w=720,h=1280,x=0,y=0):Node {const n=new Node(name);n.layer=parent.layer;parent.addChild(n);n.addComponent(UITransform).setContentSize(w,h);n.setPosition(x,y);return n;}
    private text(parent:Node,name:string,text:string,x:number,y:number,size=24,color=C.ink,w=600,h=50):Label {const l=this.labelFactory(name,text,x,y,size,color,w,h,parent);l.overflow=Label.Overflow.CLAMP;l.enableWrapText=true;return l;}
    private graphic(name:string,parent:Node,draw:(g:Graphics)=>void,x=0,y=0,w=720,h=1280):Node {const n=this.node(name,parent,w,h,x,y);draw(n.addComponent(Graphics));return n;}
    private panel(name:string,parent:Node,w:number,h:number,x=0,y=0,accent=C.rim):Node {const n=this.node(name,parent,w,h,x,y);new UIPanel(n,w,h,accent);return n;}
    private icon(parent:Node,key:ArtKey,x:number,y:number,size=48):Node {const n=this.node('Icon-'+key,parent,size,size,x,y),s=n.addComponent(Sprite);s.sizeMode=Sprite.SizeMode.CUSTOM;this.art.bind(s,key);return n;}
    private solid(name:string,parent:Node,w:number,h:number,x:number,y:number,color:Color,bar=false):Node {const n=this.node(name,parent,w,h,x,y);if(bar)n.getComponent(UITransform)!.setAnchorPoint(0,0);UISkin.sprite(n,2,color);return n;}
    private button(parent:Node,id:string,text:string,x:number,y:number,w=600,h=88,accent=C.rim,primary=false,visualHeight=h):UIButton {const n=this.node(id,parent,w,h,x,y),face=visualHeight===h?n:this.node('Face',n,w,visualHeight),surface=id==='overload'||id==='overloadQuick'?null:new UISurface(face,w,visualHeight,accent),l=this.text(n,id+'Text',text,0,0,primary?30:24,C.ink,w-32,visualHeight-12);const Kind=w<160?UIIconButton:UIButton;const b=new Kind(id,n,l,surface,w,h,accent,primary,()=>this.action(id));this.buttons.push(b);return b;}
    private createPage(id:UIPage,title:string):Node {const n=this.node(id,this.menuParent||this.root);this.pages[id]=n;this.graphic('PageGround',n,g=>{g.fillColor=C.bg;g.rect(-360,-640,720,1280);g.fill();g.strokeColor=C.grid;g.lineWidth=2;g.moveTo(-314,453);g.lineTo(314,453);g.stroke();});this.text(n,'PageTitle',title,0,522,40,C.ink,520,70);if(id!=='home')this.button(n,'nav:home','返回',-250,-560,144,78);return n;}
    private createHome():void {
        this.menuParent=this.node('MainMenu',this.root);this.refs.menu=this.menuParent;const n=this.createPage('home','');
        this.text(n,'Edition','魔法竞技场',-198,557,22,C.muted,260,36);this.button(n,'settings','设置',266,548,104,104,C.rim,false,80);
        this.title=this.text(n,'Logo','术式过载',0,435,76,C.ink,640,112).node;this.text(n,'Subtitle','突破极限，释放禁忌术式',0,351,26,C.cyan,630,48);
        this.sigil=this.graphic('RuneSeal',n,g=>paintSigil(g,151,C.purple),0,155);this.sigil.addComponent(UIOpacity).opacity=85;
        this.hero=this.icon(n,'mage',0,170,232);this.refs.menuHero=this.hero;
        for(let i=0;i<6;i++){const mote=this.solid('RuneMote',n,4,4,0,0,C.cyan);mote.addComponent(UIOpacity).opacity=80;this.motes.push(mote);}
        this.text(n,'RoleName','失控术士',0,-3,24,C.purple,500,38);
        const start=this.button(n,'start','开始游戏',0,-106,600,116,C.cyan,true);start.label.fontSize=36;this.refs.menuStartButton=start.node;
        this.refs.menuBest=this.text(n,'ModeStatus','20 波挑战',0,-195,24,C.muted,630,42);
        this.button(n,'nav:modes','模式选择',-155,-290,290,96,C.purple);this.button(n,'nav:records','个人纪录 / 好友',155,-290,290,96);
        this.button(n,'nav:catalog','装备图鉴',-155,-403,290,96);this.button(n,'share','分享游戏',155,-403,290,96);
        this.button(n,'nav:help','游戏说明',-155,-516,290,104,C.rim,false,80);this.button(n,'quickSound','音效开关',155,-516,290,104,C.rim,false,80);
        this.text(n,'Version','本机纪录自动保存',0,-594,20,C.muted,600,32);
    }
    private createModes():void {
        const n=this.createPage('modes','选择术式试炼');
        ['campaign','endless'].forEach((mode,i)=>{const y=242-i*322,b=this.button(n,'mode:'+mode,'',0,y,616,286,i?C.purple:C.cyan);this.icon(b.node,i?'equipRing':'equipTwin',-234,67,68);this.text(b.node,'ModeName',i?'无限模式':'20 波挑战',40,75,34,i?C.purple:C.cyan,420,64);this.text(b.node,'ModeRule',i?'每五波迎战巨像 · 挑战极限':'应对巨像混战 · 存活二十波试炼',0,4,22,C.muted,568,56);this.modeStats.push(this.text(b.node,'ModeRecord','',0,-72,22,C.gold,560,80));new UIRewardCard(b.node,b.label,this.modeStats[i]);});
        this.button(n,'mode:apply','确认模式',0,-370,600,96,C.cyan,true);this.text(n,'ModeFoot','所有装备与强化只在当前局生效',0,-457,20,C.muted,620,40);
    }
    private createRecords():void {
        const n=this.createPage('records','术式纪录');
        this.button(n,'record:campaign','20 波挑战',-155,392,290,76,C.cyan);this.button(n,'record:endless','无限模式',155,392,290,76,C.purple);
        this.button(n,'record:local','个人纪录',-155,299,290,76);this.button(n,'record:friends','微信好友',155,299,290,76,C.gold);
        const p=this.panel('PersonalRecords',n,616,644,0,-82);this.recordBody=this.text(p,'RecordData','',0,0,28,C.ink,556,590);
        this.friendRoot=this.node('FriendRanking',n,440,660,0,-96);this.friendRoot.active=false;
        this.recordFooter=this.text(n,'RecordFooter','',0,-460,19,C.muted,620,62);
        this.button(n,'record:prev','上页',-73,-558,132,76);this.button(n,'record:next','下页',74,-558,132,76);this.button(n,'record:retry','刷新',247,-558,144,76,C.cyan);
        this.refs.personalRecords=p;
    }
    private createCatalog():void {
        const n=this.createPage('catalog','魔法装备图鉴');
        for(let i=0;i<EQUIPMENT.length;i++){const item=EQUIPMENT[i],x=-234+i%4*156,y=340-Math.floor(i/4)*152;const b=this.button(n,'catalog:'+i,'',x,y,142,138);this.icon(b.node,('equip'+item.id[0].toUpperCase()+item.id.slice(1)) as ArtKey,0,18,60);this.text(b.node,'GearName',item.name,0,-42,18,C.ink,136,36);}
        const p=this.panel('GearDetails',n,616,492,0,-155,C.purple);this.catalogDetail=this.text(p,'GearLevels','',0,0,23,C.ink,568,456);
        this.text(n,'CatalogFoot','战斗中通过商店购买 · 最高 Lv5',0,-449,20,C.muted,620,44);this.selectCatalog(0);
    }
    private createHelp():void {
        const n=this.createPage('help','术士手册');const p=this.panel('HelpPanel',n,616,730,0,34,C.purple);
        this.text(p,'Instructions','移动与施法\n拖动战斗空白处，摇杆随触点出现\n术士自动攻击，PC 使用 WASD\n\n术式过载\n能量满后，底部出现小型释放按钮\n同一手指轻点，或划入停留后松手\n持续 8 秒，结束后冷却 15 秒\n\n竞技场生存\n每波结束购买装备；每五波巨像混战\n完成 20 波挑战后解锁无限模式\n\n数据与隐私\n设置与个人纪录保存在当前设备\n好友资料仅由微信开放数据域处理',0,0,23,C.ink,558,690);
        this.button(n,'privacy','隐私说明',0,-427,600,84);this.text(n,'HelpHint','没有账号系统 · 本机存档请勿随意清理',0,-495,18,C.muted,620,40);
    }
    private createHUD():void {
        const n=this.node('BattleUI',this.root);this.refs.battleUI=n;this.refs.hudPanels=this.graphic('HUDMask',n,()=>{}).getComponent(Graphics);
        const top=this.panel('HUDTop',n,652,144,0,550);const anchor=top.addComponent(Widget);anchor.isAlignTop=true;anchor.top=18;anchor.isAlignHorizontalCenter=true;anchor.horizontalCenter=0;anchor.alignMode=Widget.AlignMode.ON_WINDOW_RESIZE;anchor.updateAlignment();
        this.refs.hpLabel=this.text(top,'Health','',-182,30,28,C.ink,258,42);this.icon(top,'coin',28,31,32);this.refs.goldLabel=this.text(top,'Gold','',130,31,30,C.gold,150,42);this.refs.goldLabel.enableWrapText=false;this.refs.goldLabel.overflow=Label.Overflow.SHRINK;
        const pause=this.button(top,'pause','',268,24,112,112,C.rim,false,72);this.solid('PauseLeft',pause.node,6,24,-8,0,C.ink);this.solid('PauseRight',pause.node,6,24,8,0,C.ink);
        this.refs.waveLabel=this.text(top,'Wave','',-162,-32,26,C.cyan,290,42);this.refs.timeLabel=this.text(top,'WaveTime','',187,-32,30,C.ink,180,42);
        this.solid('HealthTrack',top,244,9,-180,2,C.shade);this.refs.healthFill=this.solid('HealthFill',top,244,9,-302,-2.5,C.red,true);this.bars.push(new UIProgressBar(this.refs.healthFill));
        this.refs.timerFill=this.solid('TimeFill',top,244,4,36,-57,C.cyan,true);this.bars.push(new UIProgressBar(this.refs.timerFill));
        this.refs.bossHud=this.panel('BossHUD',n,616,68,0,424,C.red);this.refs.bossName=this.text(this.refs.bossHud,'BossName','',0,12,20,C.ink,580,34);
        this.refs.bossHealthFill=this.solid('BossFill',this.refs.bossHud,560,6,-280,-23,C.danger,true);
        this.refs.notice=this.text(n,'Notice','',0,355,21,C.cyan,610,40);this.refs.notice.node.active=false;
        this.refs.killsLabel=this.text(n,'Combo','',-208,-376,22,C.gold,254,40);
        this.refs.overloadLabel=this.text(n,'OverloadStatus','',-120,-514,23,C.purple,340,74);
        this.refs.energyFill=this.solid('EnergyFill',n,310,6,-298,-562,C.purple,true);
        const overload=this.button(n,'overload','',223,-531,148,148,C.purple);this.overloadCore=overload.node;
        this.overloadRing=this.graphic('OverloadSocket',overload.node,()=>{},0,0,148,148).getComponent(Graphics)!;
        const gem=this.node('OverloadCrystal',overload.node,58,58,0,9);this.overloadGem=gem.addComponent(Sprite);this.overloadGem.sizeMode=Sprite.SizeMode.CUSTOM;OverloadArtwork.bind(this.overloadGem);
        this.refs.overloadButtonLabel=overload.label;overload.label.node.setSiblingIndex(overload.node.children.length-1);overload.label.node.setPosition(0,-44);overload.label.fontSize=19;overload.label.node.getComponent(UITransform)!.setContentSize(132,32);
        this.text(n,'Controls','',-88,-605,18,C.muted,426,36);
        this.refs.joystick=this.graphic('DynamicJoystick',n,g=>{g.fillColor=new Color(23,29,48,120);g.circle(0,0,66);g.fill();g.strokeColor=C.muted;g.lineWidth=2;g.circle(0,0,66);g.stroke();},0,0,132,132);this.refs.joystick.active=false;
        this.refs.knob=this.graphic('Knob',this.refs.joystick,g=>{g.fillColor=C.cyan;g.rect(-18,-18,36,36);g.fill();},0,0,40,40);
        this.refs.flash=this.text(top,'HPDamage','-1',-20,30,24,C.red,56,40).node;this.refs.flash.active=false;
        // Small translucent visual, with a full touch target inside the bottom controls.
        const quick=this.button(n,'overloadQuick','释放',-205,-438,132,132,C.purple);this.quickNode=quick.node;
        this.quickRune=this.graphic('QuickSocket',quick.node,()=>{},0,0,64,64).getComponent(Graphics)!;this.drawQuickSocket(false);
        const quickCrystal=this.node('QuickCrystal',quick.node,30,30,0,5);this.quickGem=quickCrystal.addComponent(Sprite);this.quickGem.sizeMode=Sprite.SizeMode.CUSTOM;OverloadArtwork.bind(this.quickGem);
        quick.label.node.setSiblingIndex(quick.node.children.length-1);quick.label.node.setPosition(0,-35);quick.label.fontSize=19;quick.label.node.getComponent(UITransform)!.setContentSize(112,30);
        this.quickHint=this.text(quick.node,'QuickHint','',0,-57,16,C.cyan,112,25);this.quickNode.active=false;
    }
    private createShop():void {
        const n=this.node('MagicShop',this.root);this.refs.shop=n;
        this.refs.shopTitle=this.text(n,'ShopTitle','',0,555,40,C.ink,654,62);
        this.refs.shopGold=this.text(n,'ShopGold','',-112,493,32,C.gold,390,48);
        this.refs.shopHealth=this.text(n,'ShopHealth','',-112,449,22,C.muted,390,32);
        this.button(n,'stats','当前属性',220,500,180,132,C.rim,false,76);
        const cards:any[]=[];
        for(let i=0;i<4;i++){
            const p=this.panel('OfferCard-'+i,n,306,320,i%2?161:-161,i<2?265:-77);
            const icon=this.icon(p,'equipTwin',-104,112,64);
            const name=this.text(p,'OfferName','',37,124,30,C.ink,206,46);
            const level=this.text(p,'OfferLevel','',37,79,23,C.purple,206,38);
            const effect=this.text(p,'OfferEffect','',0,12,26,C.ink,270,82);effect.lineHeight=34;
            const line=this.solid('EffectDivider',p,258,2,0,-43,C.grid);
            const buy=this.button(p,'offer:'+i,'',0,-97,266,132,C.gold,false,90);buy.label.fontSize=26;
            const surface=p.getComponent(Sprite)!;
            cards.push({name,level,effect,price:buy.label,node:p,icon,surface});new UIShopCard(p,name,effect);
        }this.refs.shopCards=cards;
        this.refs.refreshLabel=this.button(n,'refresh','',-161,-308,306,132,C.rim,false,88).label;
        this.refs.shopTabLabel=this.button(n,'shopTab','本局强化',161,-308,306,132,C.rim,false,88).label;
        this.refs.reinforceLabel=this.button(n,'reinforce','',-161,-441,306,132,C.gold,false,82).label;this.refs.reinforceLabel.fontSize=22;
        this.refs.blessingLabel=this.button(n,'blessing','',-161,-441,306,132,C.purple,false,82).label;this.refs.blessingLabel.fontSize=22;
        this.refs.shopHint=this.text(n,'ShopHint','',0,-425,24,C.cyan,630,68);
        this.button(n,'continue','继续下一波',0,-573.5,600,132,C.cyan,true,102).label.fontSize=36;
    }
    private createStats():void {
        const n=this.node('CurrentStats',this.root);this.refs.statsUI=n;
        this.graphic('Dim',n,g=>{g.fillColor=new Color(5,8,17,246);g.rect(-800,-1400,1600,2800);g.fill();});
        this.panel('StatsFrame',n,640,1100,0,0,C.purple);
        this.text(n,'StatsTitle','当前属性',0,466,36,C.ink,580,62);
        this.refs.statsBody=this.text(n,'StatsBody','',0,205,25,C.ink,560,398);
        this.text(n,'StatsGearTitle','已装备术式',0,-32,23,C.purple,560,42);
        this.refs.statsGear=this.text(n,'StatsGear','',0,-206,23,C.muted,560,286);
        this.button(n,'stats:back','返回',0,-446,564,88,C.cyan,true);n.active=false;
    }
    /** Short screens use the available width rather than shrinking a 1280-high shop. */
    fitShop(usableWidth:number,usableHeight:number):void {
        const compact=usableHeight/usableWidth<1.65,n=this.refs.shop;
        n.setScale(compact?Math.min(usableWidth/720,usableHeight/1080):1,compact?Math.min(usableWidth/720,usableHeight/1080):1,1);
        this.refs.shopTitle.node.setPosition(0,compact?492:555);
        this.refs.shopGold.node.setPosition(-112,compact?429:493);this.refs.shopHealth.node.setPosition(-112,compact?390:449);
        const stats=this.get('stats')!;stats.node.setPosition(220,compact?422:500);stats.setTouchHeight(compact?110:132);
        for(let i=0;i<4;i++){
            const card=this.refs.shopCards[i],h=compact?270:320;
            card.node.setPosition(i%2?161:-161,compact?(i<2?234:-52):(i<2?265:-77));
            card.node.getComponent(UITransform)!.setContentSize(306,h);card.node.getChildByName('PixelBorder')!.getComponent(UITransform)!.setContentSize(306,h);
            card.icon.setPosition(-104,compact?97:112);card.name.node.setPosition(37,compact?105:124);card.name.fontSize=compact?34:30;
            card.level.node.setPosition(37,compact?60:79);card.effect.node.setPosition(0,compact?0:12);card.effect.fontSize=compact?28:26;
            card.node.getChildByName('EffectDivider')!.setPosition(0,compact?-38:-43);
            const buy=this.get('offer:'+i)!;buy.node.setPosition(0,compact?-87:-97);buy.setTouchHeight(compact?110:132);buy.label.fontSize=compact?30:26;
        }
        for(const id of ['refresh','shopTab']){const b=this.get(id)!;b.node.setPosition(id==='refresh'?-161:161,compact?-250:-308);b.setTouchHeight(compact?110:132);b.label.fontSize=compact?28:24;}
        for(const id of ['reinforce','blessing']){const b=this.get(id)!;b.node.setPosition(-161,compact?-360:-441);b.setTouchHeight(compact?110:132);}
        const next=this.get('continue')!;next.node.setPosition(0,compact?-470:-573.5);next.setTouchHeight(compact?110:132);
        this.refs.shopCompact=compact;
        this.positionShopHint();
    }
    private positionShopHint():void {
        const special=this.get('reinforce')!.node.active||this.get('blessing')!.node.active,compact=!!this.refs.shopCompact;
        this.refs.shopHint.node.setPosition(special?161:0,compact?(special?-360:-360):(special?-441:-425));
        this.refs.shopHint.node.getComponent(UITransform)!.setContentSize(special?300:630,68);
    }
    showStats(m:ArenaModel):void {
        const s=m.stats;
        this.refs.statsBody.string=`生命  ${m.hp} / ${RULES.maxHp}     金币  ${m.gold}\n\n法术伤害  ${s.damage.toFixed(2)}     每秒攻击  ${(1/s.interval).toFixed(2)}\n\n弹体  ${s.projectileCount}     穿透  ${s.penetrations}\n\n暴击率  ${(m.criticalChance*100).toFixed(1)}%     暴伤  ${m.criticalMultiplier.toFixed(2)}倍\n\n移动速度  ${m.moveSpeed.toFixed(0)}     范围  ${m.rangeMultiplier.toFixed(2)}倍`;
        const equipped=EQUIPMENT.filter(e=>m.levels[e.id]>0);
        this.refs.statsGear.string=equipped.length?equipped.map(e=>e.name+'  Lv'+m.levels[e.id]).join('\n'):'尚未购买装备';
        this.refs.statsUI.active=true;
    }
    private createResult():void {
        const n=this.node('ResultOverlay',this.root);this.refs.overlay=n;this.graphic('ResultDim',n,g=>{g.fillColor=new Color(5,8,17,245);g.rect(-800,-1400,1600,2800);g.fill();});this.panel('ResultFrame',n,644,1120,0,0,C.purple);
        this.refs.resultSigil=this.graphic('ResultSeal',n,g=>paintSigil(g,104,C.gold),0,385);this.refs.resultSigil.addComponent(UIOpacity).opacity=65;
        this.refs.resultTitle=this.text(n,'ResultTitle','',0,432,42,C.ink,600,72);this.refs.recordLabel=this.text(n,'RecordStatus','',0,344,23,C.gold,570,86);
        this.resultWave=this.text(n,'WaveHero','',0,251,82,C.cyan,580,112);this.resultCaption=this.text(n,'WaveCaption','',0,173,21,C.muted,570,44);
        const names=['击杀数量','存活时间','最大连杀','获得金币','最高伤害','巨像击破'];
        for(let i=0;i<6;i++){const p=this.panel('ResultMetric-'+i,n,270,90,i%2?143:-143,78-Math.floor(i/2)*110);this.text(p,'MetricName',names[i],0,23,18,C.muted,250,34);this.resultValues.push(this.text(p,'MetricValue','',0,-16,28,i===3?C.gold:C.ink,248,44));}
        this.refs.resultLabel=this.text(n,'LegacyResultStats','',0,0,1,C.ink,1,1);this.refs.resultLabel.node.active=false;
        this.button(n,'restart','再次挑战',0,-270,568,96,C.cyan,true);this.button(n,'menu','返回首页',0,-376,568,82);
        this.button(n,'shareScore','分享战绩',0,-470,568,76,C.gold);this.resultFooter=this.text(n,'ResultFoot','',0,-535,18,C.muted,600,34);
    }
    private createSettings():void {
        const n=this.node('PauseSettings',this.root);this.refs.modalUI=n;this.graphic('Dim',n,g=>{g.fillColor=new Color(5,8,17,242);g.rect(-800,-1400,1600,2800);g.fill();});this.panel('SettingsFrame',n,640,1208,0,0,C.purple);
        this.refs.modalTitle=this.text(n,'ModalTitle','',0,536,40,C.ink,580,70);this.refs.modalHint=this.text(n,'ModalHint','',0,466,24,C.muted,580,64);
        this.refs.musicLabel=this.button(n,'modal:music','',0,346,564,132,C.rim,false,84).label;
        this.refs.soundLabel=this.button(n,'modal:sound','',0,213,564,132,C.rim,false,84).label;
        this.refs.shakeLabel=this.button(n,'modal:shake','',0,80,564,132,C.rim,false,84).label;
        this.refs.effectsLabel=this.button(n,'modal:effects','',0,-53,564,132,C.rim,false,84).label;
        this.button(n,'modal:stats','当前属性',0,-186,564,132,C.rim,false,84);
        this.refs.modalResume=this.button(n,'modal:resume','继续游戏',0,-319,564,132,C.cyan,true,96).label;
        this.button(n,'modal:exit','结束本局并返回首页',0,-452,564,132,C.red,false,84);
        for(const id of ['music','sound','shake','effects','stats'])this.get('modal:'+id)!.label.fontSize=30;
        this.button(n,'modal:confirm','确认结束本局',0,-180,564,132,C.red,true,92);this.button(n,'modal:cancel','取消 · 保留本局',0,-330,564,132,C.rim,false,84);
        this.text(n,'SaveSettings','设置自动保存 · 点击音量切换档位',0,-560,20,C.muted,590,38);n.active=false;
    }
    private createRevive():void {
        const n=this.node('RevivePanel',this.root);this.refs.reviveUI=n;this.graphic('Dim',n,g=>{g.fillColor=new Color(5,8,17,240);g.rect(-800,-1400,1600,2800);g.fill();});this.panel('ReviveFrame',n,640,876,0,0,C.purple);
        this.text(n,'ReviveTitle','术式崩溃',0,300,44,C.ink,590,80);this.text(n,'ReviveLore','禁忌能量尚未完全消散……',0,215,24,C.purple,590,54);
        this.text(n,'ReviveRules','每局最多复活一次\n恢复 50% 生命 · 2 秒无敌保护\n保留当前装备与 Boss 战斗进度',0,81,23,C.ink,580,150);
        this.button(n,'revive:watch','观看广告 · 复活一次',0,-70,564,96,C.cyan,true);this.refs.reviveHint=this.text(n,'ReviveStatus','',0,-172,21,C.muted,570,86);
        this.button(n,'revive:end','结束本局',0,-290,564,88,C.cyan);n.active=false;
    }
    showPage(page:UIPage):void {this.toast?.hide();this.state.page=page;for(const key of Object.keys(this.pages) as UIPage[])this.pages[key].active=key===page;this.lastPage=page;this.animation.pop(this.pages[page],.008,.16);}
    get page():UIPage{return this.state.page;}
    get selectedMode():GameMode{return this.selected;}
    setMode(mode:GameMode,unlocked:boolean):boolean {if(mode==='endless'&&!unlocked){this.toast.show('完成 20 波挑战后解锁无限模式',true);return false;}this.selected=mode;return true;}
    refreshModes(campaign:number,endless:number,unlocked:boolean):void {this.modeStats[0].string=`最高抵达 ${campaign} / 20 波\n${unlocked?'试炼已通关':'挑战尚未完成'}`;this.modeStats[1].string=unlocked?`已解锁 · 最高抵达 ${endless} 波`:'未解锁 · 完成 20 波挑战后开放';for(const mode of ['campaign','endless'] as GameMode[])this.get('mode:'+mode)?.configure('',true,this.selected===mode,mode==='campaign'?C.cyan:C.purple);this.refs.menuBest.string=(this.selected==='campaign'?'20 波挑战':'无限模式')+' · 最高 '+(this.selected==='campaign'?campaign:endless)+' 波';}
    selectCatalog(index:number):void {this.catalogIndex=Math.max(0,Math.min(7,index));const e=EQUIPMENT[this.catalogIndex];this.catalogDetail.string=e.name+'\n\n'+e.effects.map((x,i)=>'Lv'+(i+1)+'  '+x).join('\n\n');for(let i=0;i<8;i++)this.get('catalog:'+i)?.configure('',true,i===this.catalogIndex,C.purple);}
    get rankingMode():GameMode{return this.recordMode;}
    setRanking(mode:GameMode,friend:boolean):void {this.recordMode=mode;this.friend=friend;}
    get isFriend():boolean{return this.friend;}
    records(record:RecordEntry,legacy:{wave:number;kills:number;elapsed:number},available:boolean,error=''):void {
        this.refs.personalRecords.active=!this.friend||!available;this.friendRoot.active=this.friend&&available;this.friendEnabled=available;
        this.recordBody.string=this.friend&&!available?'微信好友排行\n\n当前环境不支持开放数据域\n请在微信小游戏内查看\n\n个人纪录始终保存在本机':`最高波次\n${record.wave} ${this.recordMode==='campaign'?'/ 20 波':'波'}\n\n最佳击杀  ${record.runs?record.kills:'暂无分模式纪录'}\n最长生存  ${record.runs?Math.floor(record.elapsed)+' 秒':'暂无分模式纪录'}\n最高连杀  ${record.runs?record.combo:'—'}\n已记录通关  ${record.clears} 次\n\n${record.runs?'已记录 '+record.runs+' 局':'新局结算后开始统计详细纪录'}`;
        this.recordFooter.string=error|| (this.friend?'好友数据仅在微信开放数据域处理':this.recordMode==='campaign'&&record.finalBossKills?'终式巨像击破 · '+record.finalBossKills+' 次':'旧版综合纪录：'+legacy.wave+' 波 / '+legacy.kills+' 击杀；未推断其模式');
        for(const mode of ['campaign','endless'] as GameMode[])this.get('record:'+mode)?.configure(mode==='campaign'?'20 波挑战':'无限模式',true,mode===this.recordMode);
        this.get('record:local')?.configure('个人纪录',true,!this.friend);this.get('record:friends')?.configure('微信好友',true,this.friend);
        for(const id of ['prev','next','retry']){const b=this.get('record:'+id)!;b.node.active=this.friend&&available;}
    }
    enableSubContext():void {if(this.nativeSub)return;this.nativeSub=this.friendRoot.addComponent(SubContextView);this.nativeSub.fps=PRODUCT.ui.subContextFPS;}
    hit(x:number,y:number){return hitTest(this.buttons,this.root,x,y,b=>this.refs.statsUI.active?b.id.startsWith('stats:'):this.refs.reviveUI.active?b.id.startsWith('revive:'):this.refs.modalUI.active?b.id.startsWith('modal:'):!b.id.startsWith('modal:')&&!b.id.startsWith('revive:'));}
    get(id:string):UIButton|undefined{return this.buttons.find(b=>b.id===id&&b.node.activeInHierarchy)||this.buttons.find(b=>b.id===id);}
    private drawQuickSocket(armed:boolean):void {const g=this.quickRune;g.clear();g.fillColor=new Color(15,22,38,140);g.circle(0,5,28);g.fill();g.strokeColor=armed?C.gold:C.cyan;g.lineWidth=2;g.circle(0,5,28);g.stroke();}
    private drawOverloadSocket(state:string,segments:number):void {
        const g=this.overloadRing,accent=state==='active'?C.gold:state==='ready'?C.cyan:C.rim;g.clear();
        g.fillColor=C.shade;cutRect(g,-65,-70,130,130,24);g.fill();g.fillColor=C.panel;g.strokeColor=accent;g.lineWidth=3;cutRect(g,-65,-65,130,130,24);g.fill();g.stroke();
        g.strokeColor=C.grid;g.lineWidth=2;cutRect(g,-58,-58,116,116,21);g.stroke();
        for(let i=0;i<8;i++){g.fillColor=i<segments||state==='ready'?(state==='active'?C.gold:C.purple):C.grid;const side=i<4?-54:48,y=-25+(i%4)*19;g.rect(side,y,6,12);g.fill();}
        g.fillColor=accent;g.rect(-13,56,26,3);g.rect(-13,51,26,2);g.fill();
    }
    dismissOverloadShortcut():void {this.shortcut.setAvailable(false);this.quickNode.active=false;}
    update(dt:number,model:ArenaModel,interactive=true):void {this.clock+=dt;this.animation.update(dt);this.toast.update(dt);for(const b of this.buttons)b.update(dt);
        this.shortcut.setAvailable(interactive&&model.inCombat&&model.overloadReady);this.shortcut.update(dt);this.quickNode.active=this.shortcut.visible;
        if(this.shortcut.visible){this.quickNode.setPosition(this.shortcut.x,this.shortcut.y);if(this.quickArmed!==this.shortcut.armed){this.quickArmed=this.shortcut.armed;this.drawQuickSocket(this.quickArmed);this.quickHint.string=this.quickArmed?'松手':'';}const pulse=1+Math.sin(this.clock*2.4)*.025;this.quickGem.node.setScale(pulse,pulse,1);}
        if(this.pages.home.activeInHierarchy){this.sigil.angle=this.clock*4;const pulse=1+Math.sin(this.clock*.8)*.003;this.title.setScale(pulse,pulse,1);this.art.pose(this.hero.getComponent(Sprite)!,'player_idle_02',232);this.hero.setPosition(0,170+Math.sin(this.clock*1.6)*3);for(let i=0;i<this.motes.length;i++){const a=i*Math.PI/3+this.clock*.11;this.motes[i].setPosition(Math.cos(a)*154,158+Math.sin(a)*154);}}
        if(this.refs.overlay.active&&model.phase==='victory')this.refs.resultSigil.angle=this.clock*6;
        if(this.refs.battleUI.active){const state=model.overload>0?'active':model.overloadCooldown>0?'cooldown':model.overloadReady?'ready':model.energy>0?'charging':'empty';
            const value=state==='active'?model.overload/8:state==='cooldown'?1-model.overloadCooldown/15:model.energy/100,segment=Math.floor(value*8);
            if(state!==this.overloadState||segment!==this.overloadSegment){this.overloadState=state;this.overloadSegment=segment;this.drawOverloadSocket(state,segment);this.overloadGem.color=state==='empty'||state==='cooldown'?C.muted:C.white;}
            const s=state==='ready'?1+Math.sin(this.clock*2)*.025:1;this.overloadGem.node.setScale(s,s,1);
        }
    }
    settingsVisible(confirm:boolean,kind:string):void {for(const b of this.buttons)if(b.id.startsWith('modal:'))b.node.active=confirm?b.id==='modal:confirm'||b.id==='modal:cancel':b.id!=='modal:confirm'&&b.id!=='modal:cancel'&&(b.id!=='modal:exit'&&b.id!=='modal:stats'||kind==='pause');}
    result(m:ArenaModel,previousWave:number,previousKills:number):void {this.resultWave.string=String(m.wave)+' 波';this.resultWave.color=m.phase==='victory'?C.gold:C.cyan;this.resultCaption.string=(m.mode==='campaign'?'20 波挑战':'无限模式')+' · '+(m.phase==='victory'?'挑战完成':'本次抵达')+(m.finalBossDefeated?' · 巨像击破':'');const values=[String(m.kills),Math.floor(m.elapsed/60)+':'+('0'+Math.floor(m.elapsed)%60).slice(-2),String(m.maxCombo),String(m.earned),m.highestDamage.toFixed(1),String(m.bossClears)];this.resultValues.forEach((l,i)=>l.string=values[i]);this.resultFooter.string='过载释放 '+m.overloadUses+' 次 · 此前最高 '+previousWave+' 波 / '+previousKills+' 击杀';}
    refreshShopStates(m:ArenaModel,page:'gear'|'boost'):void {
        for(let i=0;i<4;i++){const o=m.shopOffers[i],boost=(['damage','speed','critical','range'] as const)[i],price=page==='boost'?m.boostPrice(boost):o?.price||0,sold=page==='gear'&&!!o?.sold,missing=page==='gear'&&!o;
            this.get('offer:'+i)?.configure(missing?'已满级':sold?'已购买':m.gold<price?'金币不足 · '+price:'购买 · '+price,!missing&&!sold&&m.gold>=price,false,C.gold);
            const card=this.refs.shopCards[i];card.surface.color=sold?C.stone:C.panel;
            card.icon.getComponent(Sprite)!.color=sold?C.muted:C.white;
            card.node.getChildByName('PixelBorder')!.getComponent(Sprite)!.color=sold?C.grid:page==='gear'&&o?.quality==='rare'?C.purple:C.rim;
        }
        const refresh=this.get('refresh')!;refresh.node.active=page==='gear';refresh.configure(this.refs.refreshLabel.string,m.gold>=m.refreshPrice&&m.shopOffers.some(o=>!!o));
        this.get('reinforce')!.node.active=page==='boost'&&EQUIPMENT.some(e=>m.levels[e.id]===5);
        this.get('reinforce')!.configure(this.refs.reinforceLabel.string,m.gold>=m.reinforcementPrice);
        this.get('blessing')!.node.active=page==='gear'&&m.blessingAvailable;
        this.get('blessing')!.configure(this.refs.blessingLabel.string,m.gold>=m.blessingPrice);
        // Advanced actions appear only when usable; feedback occupies the free half of that row.
        this.positionShopHint();
    }
}

import { _decorator, Component, Node, Canvas, Camera, RenderRoot2D, Layers, screen, UITransform, Graphics, Sprite, Color, Label, LabelOutline, Vec3, Vec2,
    UIOpacity, Font, resources, input, Input, EventTouch, EventKeyboard, KeyCode, view, game, Game, sys } from 'cc';
import { UIManager } from './UIManager';
import { PRODUCT } from './ProductConfig';
import { RecordsService } from './RecordsService';
import { WeChatPlatformService } from './WeChatPlatformService';
import { LeaderboardService } from './LeaderboardService';
import { UIPage } from './UIStateController';
import { ArenaModel, RULES, CombatEvent, Phase, GameMode, RUN_BOOSTS } from './ArenaModel';
import { readPreferences, Preferences } from './Experience';
declare const wx:any;
import { BOSS_PHASES } from './CombatProfiles';
import { EQUIPMENT, EquipmentId } from './Equipment';
import { BALANCE } from './Balance';
import { BattleArt, ArtKey } from './BattleArt';
import { AudioFeedback } from './AudioFeedback';
const { ccclass } = _decorator;
import { PALETTE as C, UI_THEME, paintPanel, paintSigil, cutRect } from './UITheme';
const LIMITS = { deaths: 12, effects: 11, numbers: UI_THEME.effects.normalNumbers, groundCoins: 18, flyingCoins: 10, dangerFlyingCoins: 4 };
export interface FeedbackHooks { attack?: (strength: number) => void; critical?: (strength: number) => void; coin?: (strength: number) => void; purchase?: (strength: number) => void; hit?: (strength: number) => void; explosion?: (strength: number) => void; overload?: (strength: number) => void; }
interface BestRecord { wave: number; kills: number; elapsed: number; }
interface ButtonArea { id: string; x: number; y: number; w: number; h: number; phase: Phase; node?: Node; }
interface ShopCard { name: Label; level: Label; effect: Label; price: Label; detail: Label; node:Node; icon: Node; }
interface TimedVisual { node: Node; age: number; duration: number; x: number; y: number; size: number; }
interface FloatingNumber extends TimedVisual { opacity: UIOpacity; label: Label; id: number; value: number; coin: boolean; style: string; }
interface CoinCluster { x: number; y: number; count: number; age: number; }

@ccclass('RuneRampage')
export class RuneRampage extends Component {
    private ui!:UIManager;private platform!:WeChatPlatformService;private leaderboard!:LeaderboardService;private records!:RecordsService;private runId='';private runSerial=0;private deferredRevive=false;private musicLabel!:Label;private effectsLabel!:Label;
    private readonly enemyParts=new WeakMap<Node,{mark:Node;burn:Node;transform:UITransform}>();
    private readonly spriteCache=new WeakMap<Node,Sprite>();
    private readonly opacityCache=new WeakMap<Node,UIOpacity>();
    private sprite(node:Node):Sprite {let v=this.spriteCache.get(node);if(!v){v=node.getComponent(Sprite)!;this.spriteCache.set(node,v);}return v;}
    private opacity(node:Node):UIOpacity {let v=this.opacityCache.get(node);if(!v){v=node.getComponent(UIOpacity)!;this.opacityCache.set(node,v);}return v;}
    private uiFont: Font | null = null; private uiFontReady=false; private uiFontError=''; private labels: Label[]=[];
    private menuStartButton:Node|null=null;private menuSigil!: Node; private menuHero!: Node; private menuStaff!: Node; private menuMotes: Node[]=[];
    private bossBarMode=-1;private uiClock=0; private pressNode: Node|null=null; private pressClock=0;
    private shopFlashes=[0,0,0,0]; private resultSigil!: Node; private recordLabel!: Label;
    private preferences:Preferences={sound:true,shake:.5,musicVolume:.25,sfxVolume:1,effects:1};
    private readonly optionsKey='rune-rampage.v07.options';
    private modal:'none'|'pause'|'settings'|'confirm'|'stats'='none';private statsReturn:'none'|'pause'='none';private appHidden=false;
    private modalUI!:Node;private modalTitle!:Label;private modalHint!:Label;
    private soundLabel!:Label;private shakeLabel!:Label;private modalResume!:Label;
    private deathClock=0;
    private model = new ArenaModel();
    private shopPage: 'gear' | 'boost' = 'gear'; private shopTabLabel!: Label;
    private requestedMode: GameMode = 'campaign';
    private progress = { campaignBest: 0, endlessBest: 0, unlocked: false };
    private readonly progressKey = 'rune-rampage.v055.progress';
    private resultTitle!: Label; private endlessLabel!: Label; private overloadButtonLabel!: Label;
    private stickCenterX = 0; private stickCenterY = 0; private touchLocal = new Vec3(); private touchScreen = new Vec2();
    private hostileViews = new Map<number, Node>(); private hostileIds = new Set<number>();
    private beetleTellViews=new Map<number,Node>();private beetleTellIds=new Set<number>();
    private rangedTellViews = new Map<number, Node>(); private rangedTellIds = new Set<number>();
    private coinRepresentatives: Node[] = [];
    private readonly coinClusters: CoinCluster[] = Array.from({ length: LIMITS.groundCoins + LIMITS.flyingCoins }, () => ({ x:0,y:0,count:0,age:0 }));
    private flyingCoinRepresentatives = 0; private activeCoinRepresentatives = 0; private nearbyDanger = false;
    private dangerRoot!: Node; private bossDangerRoot!: Node; private magicRoot!: Node;
    private bossTellX=NaN; private bossTellY=NaN; private bossTellVX=NaN; private bossTellVY=NaN; private bossTellRadius=NaN;
    private startRequested=false; private art = new BattleArt(); private audio!: AudioFeedback;
    private playerBody!: Node; private playerStaff!: Node; private playerSigil!: Node; private castHalo!: Node;
    private energyFill!: Node; private healthFill!: Node; private hudPanels!: Graphics;
    private visualClock = 0; private castClock = 0; private wasOverloaded = false;
    private facing = 1; private moving = false;private playerStride=0;private playerMoveBlend=0;
    private canvas!: Canvas; private worldCamera!: Camera;
    private cameraX = 0; private cameraY = 0; private battleTop=420; private battleBottom=-420;
    private mapRoot!:Node;private decorRoot!:Node;private eliteRoot!:Node;private bossRoot!:Node;private numberRoot!:Node;private mapInstalled=false;
    private enemiesRoot!: Node; private bulletsRoot!: Node; private coinsRoot!: Node;
    private readonly worldLayer = Layers.Enum.DEFAULT;
    private originalUIClearColor:Color|null=null;
    private originalUIClear = Camera.ClearFlag.SOLID_COLOR;
    private originalUIVisibility = Layers.Enum.UI_2D;
    private overloadLabel!: Label; private reinforceLabel!: Label; private refreshLabel!: Label; private blessingLabel!: Label;
    private bossHud!: Node; private bossHealthFill!: Node; private bossName!: Label; private bossTell!: Graphics;
    private sigilViews: Node[]=[]; private sigilCircle!: Node; private sigilFloor!: Node;
    private backdrop!: Node;
    private audioTimes: Record<string, number> = {};
    private audioClock = 0;
    private sound(kind: keyof FeedbackHooks, strength = 1): void {
        if(this.paused||this.appHidden||!this.preferences.sound)return;
        if (this.audioClock < (this.audioTimes[kind] || 0)) return;
        this.audioTimes[kind] = this.audioClock + (kind === 'coin' ? UI_THEME.effects.coinGap : .05);
        this.audio?.play(kind, strength);
        try { this.feedbackHooks[kind]?.(strength); } catch { /* Optional audio cannot interrupt play. */ }
    }
    private root!: Node; private world!: Node; private actors!: Node; private effects!: Node;
    private battleUI!: Node; private menu!: Node; private shop!: Node; private overlay!: Node;
    private player!: Node; private joystick!: Node; private knob!: Node; private flash!: Node;
    private hpLabel!: Label; private goldLabel!: Label; private waveLabel!: Label; private timeLabel!: Label; private killsLabel!: Label;
    private resultLabel!: Label; private notice!: Label; private menuBest!: Label;
    private shopGold!: Label; private shopTitle!: Label; private shopSummary!: Label; private shopHint!: Label;
    private timerFill!: Node;
    private shopCards: ShopCard[] = []; private buttons: ButtonArea[] = []; private orbitViews: Node[] = [];
    private enemyViews = new Map<number, Node>(); private boltViews = new Map<number, Node>();
    private enemyIds = new Set<number>(); private boltIds = new Set<number>();
    
    private pools: Record<string, Node[]> = { slime: [], bat: [], boss: [], bolt: [], coin: [], burst: [], ring: [], number: [], spark: [], hostileShot: [], hostileRune: [], rangedTell: [], beetle: [], beetleTell: [] };
    private dying: TimedVisual[] = []; private fx: TimedVisual[] = []; private numbers: FloatingNumber[] = [];
    private timedPool: TimedVisual[] = []; private numberPool: FloatingNumber[] = [];
    private keys = new Set<KeyCode>(); private touchId: number | null = null;
    private uiTouch: { id: number; button: ButtonArea; x: number; y: number } | null = null;
    private axisX = 0; private axisY = 0; private accumulator = 0; private hudClock = 0;
    private paused = false; private oldHp = RULES.maxHp; private oldGold = 0;
    private lastPhase: Phase = 'menu'; private noticeClock = 0; private shopHintClock = 0;
    private visualStop = 0; private stopCooldown = 0; private shakeClock = 0; private shakeAmount = 0;
    private soundCooldown = 0; private coinPulse = 0; private damageFlashClock = 0; private touchPoint = new Vec3();
    private feedbackHooks: FeedbackHooks = {}; private best: BestRecord = { wave: 0, kills: 0, elapsed: 0 };
    private readonly storageKey = 'rune-rampage.v02.best';

    /** Optional feedback observer. Built-in audio remains managed by AudioFeedback. */
    setFeedbackHooks(hooks: FeedbackHooks): void { this.feedbackHooks = hooks; }

    start(): void {
        this.audio = this.node.addComponent(AudioFeedback);
        this.canvas = this.node.scene.getChildByName('Canvas')!.getComponent(Canvas)!;
        this.root = this.makeNode('术式过载', this.canvas.node, 720, 1280);
        this.backdrop = this.makeGraphics('Backdrop', this.root, g => { g.fillColor = C.bg; g.rect(-360, -640, 720, 1280); g.fill(); });
        // The world has an identity transform and its own 2D render root. Canvas only owns UI.
        this.world = this.makeNode('GameWorld', this.node.scene);
        this.world.layer = this.worldLayer;
        this.world.addComponent(RenderRoot2D);
        const cameraNode = new Node('Camera'); this.world.addChild(cameraNode);
        this.worldCamera = cameraNode.addComponent(Camera);
        const uiCamera = this.canvas.cameraComponent!;
        this.originalUIClearColor=uiCamera.clearColor.clone();uiCamera.clearColor=C.bg;this.originalUIClear = uiCamera.clearFlags; this.originalUIVisibility = uiCamera.visibility;
        this.worldCamera.projection = Camera.ProjectionType.ORTHO;
        this.worldCamera.near = 1; this.worldCamera.far = 2000;
        this.worldCamera.visibility = this.worldLayer; this.worldCamera.priority = uiCamera.priority - 1;
        this.worldCamera.clearFlags = Camera.ClearFlag.SOLID_COLOR; this.worldCamera.clearColor = C.bg;
        uiCamera.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
        uiCamera.visibility = Layers.Enum.UI_2D;
        this.mapRoot=this.makeNode('Map',this.world,RULES.right-RULES.left,RULES.top-RULES.bottom);
        this.decorRoot=this.makeNode('MapDecorations',this.world);
        this.actors = this.world;
        // Friendly feedback stays below silhouettes; hostile warnings and damage numbers stay above.
        this.coinsRoot = this.makeNode('CoinManager', this.world);
        this.effects = this.makeNode('Feedback', this.world);
        this.bulletsRoot = this.makeNode('BulletManager', this.world);
        this.magicRoot = this.makeNode('PlayerMagic', this.world);
        this.enemiesRoot = this.makeNode('EnemyManager', this.world);
        this.eliteRoot=this.makeNode('EliteManager',this.world);this.bossRoot=this.makeNode('BossManager',this.world);
        this.numberRoot=this.makeNode('DamageNumbers',this.world);
        this.bossDangerRoot = this.makeNode('BossWarnings', this.world);
        this.dangerRoot = this.makeNode('DangerProjectiles', this.world);
        this.player = this.makeNode('Player', this.world, 64, 64);this.player.addComponent(UIOpacity);
        const shadow=this.makeSprite('FootShadow',this.player,'shadow');shadow.setPosition(0,-6);
        shadow.getComponent(UITransform)!.setContentSize(46,16);shadow.addComponent(UIOpacity).opacity=65;
        // Rotate the square rune inside a fixed ground plane, never the flattened plane itself.
        const footPlane=this.makeNode('FootPlane',this.player);footPlane.setPosition(0,-6);footPlane.setScale(1,.34,1);
        this.playerSigil = this.makeSprite('Runes', footPlane, 'rune');
        this.playerSigil.getComponent(UITransform)!.setAnchorPoint(.5,.5);this.playerSigil.getComponent(UITransform)!.setContentSize(48,48);
        this.playerSigil.addComponent(UIOpacity).opacity=65;
        this.playerBody = this.makeSprite('Robe', this.player, 'mage');this.playerBody.getComponent(UITransform)!.setAnchorPoint(.5,.125);
        this.playerStaff = this.makeSprite('Staff', this.player, 'staff'); this.playerStaff.setPosition(22, 5);
        this.castHalo = this.makeSprite('CastHalo', this.player, 'cast'); this.castHalo.setPosition(32,65); this.castHalo.active = false;
        this.castHalo.addComponent(UIOpacity).opacity=75;this.castHalo.getComponent(UITransform)!.setContentSize(26,26);this.playerStaff.active=false;
        // Explicit world-only render order; coins are always below every actor and hostile warning.
        [this.mapRoot,this.decorRoot,this.coinsRoot,this.bulletsRoot,this.effects,this.magicRoot,this.enemiesRoot,this.eliteRoot,this.bossRoot,this.player,this.bossDangerRoot,this.dangerRoot,this.numberRoot].forEach((n,i)=>n.setSiblingIndex(i));
        for(let i=0;i<3;i++){const n=this.makeSprite('Orbit',this.magicRoot,'orbit');n.getComponent(UITransform)!.setContentSize(20,20);this.sprite(n).color=C.cyan;n.addComponent(UIOpacity).opacity=175;this.orbitViews.push(n);}
        for(let i=0;i<5;i++){const n=this.makeSprite('SigilOrbit',this.magicRoot,'orbit');n.getComponent(UITransform)!.setContentSize(16,16);this.sprite(n).color=C.purple;n.addComponent(UIOpacity).opacity=165;this.sigilViews.push(n);}
        this.sigilFloor=this.makeNode('AutoSigilGround',this.magicRoot);this.sigilFloor.setScale(1,.36,1);
        this.sigilCircle=this.makeSprite('AutoSigil',this.sigilFloor,'rune');this.sigilCircle.getComponent(UITransform)!.setContentSize(88,88);this.sigilCircle.addComponent(UIOpacity).opacity=40;
        this.bossTell=this.makeGraphics('BossTelegraph',this.bossDangerRoot,()=>{}).getComponent(Graphics)!;
        this.platform=new WeChatPlatformService();this.leaderboard=new LeaderboardService(this.platform.api);this.records=new RecordsService(sys.localStorage);
        this.ui=new UIManager(this.root,this.art,this.label.bind(this),(id)=>this.activate(id));Object.assign(this,this.ui.refs);
        this.loadExperience();
        resources.load('fonts/RuneSans',Font,(error,font)=>{if(!this.isValid)return;if(error){this.uiFontError=error.message;return;}this.uiFont=font;this.uiFontReady=true;for(const label of this.labels)if(label.isValid){label.font=font;label.useSystemFont=false;}});
        this.loadBest();this.records.migrate(this.progress);this.ui.refreshModes(this.progress.campaignBest,this.progress.endlessBest,this.progress.unlocked);
        this.art.load(() => {if(this.isValid&&this.startRequested&&this.art.ready){this.startRequested=false;this.restart();}});
        this.fit(); this.refreshHud(); this.applyPhase();
        input.on(Input.EventType.TOUCH_START, this.touchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this.touchMove, this);
        input.on(Input.EventType.TOUCH_END, this.touchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.touchCancel, this);
        input.on(Input.EventType.KEY_DOWN, this.keyDown, this); input.on(Input.EventType.KEY_UP, this.keyUp, this);
        view.on('canvas-resize', this.fit, this); game.on(Game.EVENT_HIDE, this.hide, this); game.on(Game.EVENT_SHOW, this.show, this);
    }
    private makeNode(name: string, parent: Node, w = 720, h = 1280): Node {
        const node = new Node(name); node.layer = parent.layer; parent.addChild(node);
        node.addComponent(UITransform).setContentSize(w, h); return node;
    }
    private makeSprite(name: string, parent: Node, key: ArtKey): Node {
        const node = this.makeNode(name, parent, 64, 64);
        const sprite = node.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.art.bind(sprite,key);
        if(key==='bolt'||key==='flameBolt')node.getComponent(UITransform)!.setContentSize(28,16);
        else if(key==='coin')node.getComponent(UITransform)!.setContentSize(22,25);
        else if(key==='spark'||key==='burst')node.getComponent(UITransform)!.setContentSize(16,16);
        return node;
    }
    private makeGraphics(name: string, parent: Node, draw: (g: Graphics) => void): Node {
        const node = this.makeNode(name, parent); draw(node.addComponent(Graphics)); return node;
    }
    private label(name: string, text: string, x: number, y: number, size: number,
        color: Color, width: number, height = 46, parent = this.root): Label {
        const node = this.makeNode(name, parent, width, height); node.setPosition(x, y);
        const label = node.addComponent(Label); label.string = text; label.fontSize = size; label.lineHeight = size + UI_THEME.space.unit;
        label.color = color;label.useSystemFont=!this.uiFont;if(this.uiFont)label.font=this.uiFont;this.labels.push(label);label.cacheMode=Label.CacheMode.NONE; label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER; label.overflow = Label.Overflow.SHRINK; return label;
    }

    private fit(): void {
        const visible=view.getVisibleSize();let l=0,r=0,t=0,b=0;
        try{
            if(typeof wx!=='undefined'&&wx.getWindowInfo){
                const w=wx.getWindowInfo(),safe=w.safeArea;
                if(safe&&w.windowWidth>0&&w.windowHeight>0){l=safe.left/w.windowWidth;r=(w.windowWidth-safe.right)/w.windowWidth;t=safe.top/w.windowHeight;b=(w.windowHeight-safe.bottom)/w.windowHeight;}
                const capsule=wx.getMenuButtonBoundingClientRect?.();if(capsule&&w.windowHeight>0)t=Math.max(t,(capsule.bottom+8)/w.windowHeight);
            }else if(sys.isMobile){
                const safe=sys.getSafeAreaRect(),win=screen.windowSize;
                if(safe.width>0&&safe.height>0){l=safe.x/win.width;r=(win.width-safe.x-safe.width)/win.width;b=safe.y/win.height;t=(win.height-safe.y-safe.height)/win.height;}
            }
        }catch{/* Older platform without safe-area API keeps a padded portrait layout. */}
        l=Math.max(0,Math.min(.2,l));r=Math.max(0,Math.min(.2,r));t=Math.max(0,Math.min(.2,t));b=Math.max(0,Math.min(.2,b));
        const padding=visible.width/720*8,scale=Math.min((visible.width*(1-l-r)-padding*2)/720,(visible.height*(1-t-b)-padding*2)/1280);
        this.root.setPosition(visible.width*(l-r)/2,visible.height*(b-t)/2);this.root.setScale(scale,scale,1);
        this.ui.fitShop((visible.width*(1-l-r)-padding*2)/scale,(visible.height*(1-t-b)-padding*2)/scale);
        const halfWidth=(visible.width/2+Math.abs(this.root.position.x))/scale,halfHeight=(visible.height/2+Math.abs(this.root.position.y))/scale;
        this.hudPanels.clear();this.hudPanels.fillColor=C.bg;
        this.hudPanels.rect(-halfWidth,PRODUCT.ui.battleTop,halfWidth*2,Math.max(0,halfHeight-PRODUCT.ui.battleTop));this.hudPanels.rect(-halfWidth,-halfHeight,halfWidth*2,Math.max(0,halfHeight+PRODUCT.ui.battleBottom));this.hudPanels.fill();
        const win=screen.windowSize,hh=Math.max(640,360/(win.width/Math.max(1,win.height)));
        this.battleTop=(this.root.position.y+PRODUCT.ui.battleTop*scale)/visible.height*hh*2;
        this.battleBottom=(this.root.position.y+PRODUCT.ui.battleBottom*scale)/visible.height*hh*2;
        this.updateCamera(0);
    }
    private local(event: EventTouch): Vec3 {
        const p = event.getLocation(this.touchScreen); this.touchPoint.set(p.x, p.y, 0);
        this.canvas.cameraComponent!.screenToWorld(this.touchPoint, this.touchPoint);
        return this.root.getComponent(UITransform)!.convertToNodeSpaceAR(this.touchPoint,this.touchLocal);
    }
    private buttonAt(x:number,y:number):ButtonArea|undefined {const hit=this.ui.hit(x,y);return hit?{...hit,phase:this.model.phase}:undefined;}
    private touchStart(event: EventTouch): void {
        if(this.appHidden||(this.paused&&this.modal==='none'))return;const id=event.getID();if(id===null)return;const p=this.local(event);
        this.audio?.unlockMusic();
        const button=this.buttonAt(p.x,p.y);
        if(button){if(!this.uiTouch){this.uiTouch={id,button,x:p.x,y:p.y};}return;}
        // The HUD and modal screens never claim a movement finger.
        if(!this.paused&&this.modal==='none'&&this.model.inCombat&&this.touchId===null&&p.y<PRODUCT.ui.battleTop&&p.y>-580){
            this.touchId=id;this.stickCenterX=p.x;this.stickCenterY=p.y;
            this.ui.shortcut.begin(p.x,p.y);
            this.joystick.setPosition(p.x,p.y);this.joystick.active=true;this.moveStick(p.x,p.y);
        }
    }
    private touchMove(event: EventTouch): void {
        const p=this.local(event);
        if(event.getID()===this.touchId){this.moveStick(p.x,p.y);this.ui.shortcut.move(p.x,p.y);}
        if(this.uiTouch&&event.getID()===this.uiTouch.id&&Math.hypot(p.x-this.uiTouch.x,p.y-this.uiTouch.y)>24)this.uiTouch=null;
    }
    private touchEnd(event: EventTouch): void {
        if(event.getID()===this.touchId){const p=this.local(event),cast=this.ui.shortcut.end(p.x,p.y);this.clearStick();if(cast)this.activate('overloadQuick');}
        const tap=this.uiTouch;if(!tap||tap.id!==event.getID())return;
        this.uiTouch=null;const p=this.local(event);
        // Native Cocos Button dispatches CLICK exactly once; global input only routes movement.
    }
    private touchCancel(event: EventTouch): void {
        if(event.getID()===this.touchId)this.clearStick();
        if(event.getID()===this.uiTouch?.id)this.uiTouch=null;
    }
    private clearStick(): void { this.touchId=null;this.axisX=0;this.axisY=0;this.knob.setPosition(0,0);this.joystick.active=false;this.ui?.shortcut.cancel(); }
    private moveStick(x: number,y: number): void {
        const dx=x-this.stickCenterX,dy=y-this.stickCenterY,distance=Math.hypot(dx,dy),factor=distance>58?58/distance:1;
        this.axisX=distance<6?0:dx*factor/58;this.axisY=distance<6?0:dy*factor/58;
        this.knob.setPosition(dx*factor,dy*factor);
    }
    private keyDown(event: EventKeyboard): void {
        if(!this.appHidden)this.audio?.unlockMusic();
        if(event.keyCode===KeyCode.ESCAPE){if(this.modal==='stats')this.activate('stats:back');else if(this.modal==='confirm')this.openModal('pause');else if(this.modal!=='none')this.resumeSession();else if(this.model.inCombat||this.model.phase==='shop')this.openModal('pause');return;}
        if(this.paused||this.appHidden)return;
        this.keys.add(event.keyCode);
        if(event.keyCode===KeyCode.SPACE)this.activate('overload');
        if (event.keyCode === KeyCode.ENTER) {
            if (this.model.phase === 'menu') {this.requestedMode=this.ui.selectedMode;this.restart();}
            else if(this.model.finished)this.restart();
            else if (this.model.phase === 'shop') this.activate('continue');
        }
    }
    private keyUp(event: EventKeyboard): void { this.keys.delete(event.keyCode); }
    private clearInput(): void {
        this.clearStick();this.uiTouch=null;this.keys.clear();this.moving=false;this.ui?.dismissOverloadShortcut();
    }
    private hide():void {
        this.appHidden=true;this.paused=true;this.audio?.setSuspended(true);this.clearInput();this.accumulator=0;this.visualStop=0;
    }
    private show():void {
        this.appHidden=false;this.fit();this.clearInput();this.accumulator=0;
        if(this.model.phase==='downed'){this.paused=false;this.audio?.setSuspended(true);if(this.deferredRevive)this.completeRevive();return;}
        if(this.model.inCombat||this.model.phase==='shop'||this.modal!=='none'){
            if(this.modal==='none')this.openModal('pause');this.paused=true;this.modalHint.string=this.modal==='settings'?'已返回 · 设置自动保存在本机':'已返回 · 战斗仍暂停，请点继续';
        }else {this.paused=false;this.audio?.setSuspended(false);}
    }

    private loadExperience():void {
        let options:string|null=null;try{options=sys.localStorage.getItem(this.optionsKey);}catch{}
        this.preferences=readPreferences(options);this.applyAudioPreferences();
    }
    private saveExperience():void {try{sys.localStorage.setItem(this.optionsKey,JSON.stringify(this.preferences));}catch{/* Settings stay valid for this session when storage is unavailable. */}}
    private openModal(kind:'pause'|'settings'|'confirm'):void {
        this.modal=kind;this.ui.state.replace(kind);this.paused=true;this.clearInput();this.accumulator=0;this.audio?.setSuspended(true);this.modalUI.active=true;
        const confirm=kind==='confirm';this.modalTitle.string=confirm?'结束本局？':kind==='settings'?'符文设置':'术式封存';
        this.modalHint.string=confirm?'本局金币与装备将结束。\n最高纪录与设置会保留。':kind==='settings'?'设置自动保存在本机':'世界与计时已暂停';
        this.ui.settingsVisible(confirm,kind);this.modalResume.string=kind==='settings'?'返回':'继续游戏';
        this.soundLabel.string='音效音量  /  '+Math.round((this.preferences.sound?this.preferences.sfxVolume:0)*100)+'%';
        this.musicLabel.string='音乐音量  /  '+Math.round(this.preferences.musicVolume*100)+'%';
        this.shakeLabel.string='屏幕震动  /  '+Math.round(this.preferences.shake*100)+'%';this.effectsLabel.string='特效强度  /  '+(this.preferences.effects<1?'精简':'标准');
    }
    private showCurrentStats(origin:'none'|'pause'):void {
        this.statsReturn=origin;this.modal='stats';this.ui.state.replace('stats');this.paused=true;this.modalUI.active=false;this.clearInput();this.accumulator=0;this.audio?.setSuspended(true);this.ui.showStats(this.model);
    }
    private resumeSession():void {
        if(this.appHidden)return;this.modal='none';this.ui.state.clear();this.modalUI.active=false;this.ui.refs.statsUI.active=false;this.paused=false;this.clearInput();this.accumulator=0;this.audio?.setSuspended(false);this.refreshHud();
    }
    private modalAction(id:string):void {
        if(this.appHidden)return;
        if(id==='modal:resume'){this.resumeSession();return;}
        if(id==='modal:exit'){this.openModal('confirm');return;}
        if(id==='modal:cancel'){this.openModal('pause');return;}
        if(id==='modal:confirm'){this.finalizeRun();this.saveBest();this.model.returnToMenu();this.clearVisuals();this.modal='none';this.modalUI.active=false;this.paused=false;this.audio?.setSuspended(false);this.applyPhase();return;}
        if(id==='modal:sound'){const v=this.preferences.sound?this.preferences.sfxVolume:0;this.preferences.sfxVolume=v>=1?0:Math.round((v+.25)*100)/100;this.preferences.sound=this.preferences.sfxVolume>0;}
        if(id==='modal:music')this.preferences.musicVolume=this.preferences.musicVolume>=1?0:Math.round((this.preferences.musicVolume+.25)*100)/100;
        if(id==='modal:effects')this.preferences.effects=this.preferences.effects<1?1:.5;
        if(id==='modal:shake')this.preferences.shake=this.preferences.shake<.25?.5:this.preferences.shake<.75?1:0;
        this.applyAudioPreferences();this.saveExperience();this.openModal(this.modal==='settings'?'settings':'pause');
    }
    private applyAudioPreferences():void {this.audio?.setEnabled(this.preferences.sound);this.audio?.setVolumes(this.preferences.musicVolume,this.preferences.sfxVolume);this.ui?.get('quickSound')?.configure(this.preferences.sound?'音效 / 开':'音效 / 关');}
    private showRecords(reload=true):void {const mode=this.ui.rankingMode;this.ui.records(this.records.data[mode],this.best,this.leaderboard.available,this.leaderboard.error||(this.records.saveError?'本机保存失败，当前纪录可能无法保留':''));if(this.ui.isFriend&&this.leaderboard.available){this.ui.enableSubContext();if(reload)this.leaderboard.show(mode);}}
    private finalizeRun():void {if(!this.runId)return;this.records.finish(this.runId,this.model);this.leaderboard.publish(this.model.mode,this.model.wave);if(this.records.saveError)this.ui.toast.show('本机保存失败，当前纪录可能无法保留',true);}
    private async watchRevive():Promise<void> {
        if(this.model.phase!=='downed'||this.platform.ads.busy)return;
        const id=this.runId;this.ui.get('revive:watch')?.loading('广告加载中…');this.ui.refs.reviveHint.string='广告完整播放后方可获得复活';
        const result=await this.platform.ads.request();if(!this.isValid||this.model.phase!=='downed'||id!==this.runId)return;
        this.ui.get('revive:watch')?.configure('观看广告 · 复活一次',this.platform.ads.available);
        if(result==='completed'){if(this.appHidden){this.deferredRevive=true;this.ui.refs.reviveHint.string='广告已完成，返回游戏后恢复';}else this.completeRevive();}
        else this.ui.refs.reviveHint.string=result==='skipped'?'未完整观看，未获得复活。可重试或结束本局。':result==='unavailable'?'广告位尚未配置，请结束本局查看战绩。':'广告加载失败或暂无广告，可重试或结束本局。';
    }
    private completeRevive():void {this.deferredRevive=false;if(this.model.revive()){this.oldHp=this.model.hp;this.damageFlashClock=0;this.visualStop=0;this.accumulator=0;this.clearInput();this.applyPhase();this.refreshHud();}}
    private activate(id: string): void {
        if(this.appHidden)return;
        this.audio?.unlockMusic();
        if(this.model.phase==='downed'){if(id==='revive:watch')void this.watchRevive();else if(id==='revive:end'){this.deferredRevive=false;this.model.endRevive();this.applyPhase();}return;}
        if(id==='stats:back'){this.ui.refs.statsUI.active=false;if(this.statsReturn==='pause')this.openModal('pause');else this.resumeSession();return;}
        if(id==='modal:stats'){this.showCurrentStats('pause');return;}
        if(id.startsWith('modal:')){this.modalAction(id);return;}
        if(this.paused||this.appHidden)return;
        if(id.startsWith('nav:')){this.ui.showPage(id.slice(4) as UIPage);if(id==='nav:records')this.showRecords();return;}
        if(id==='quickSound'){this.preferences.sound=!this.preferences.sound;this.applyAudioPreferences();this.saveExperience();this.ui.toast.show(this.preferences.sound?'音效已开启':'音效已关闭');return;}
        if(id==='share'||id==='shareScore'){this.ui.toast.show(this.platform.share(id==='shareScore'?this.model.wave:undefined));return;}
        if(id==='privacy'){this.ui.toast.show(this.platform.privacy());return;}
        if(id.startsWith('catalog:')){this.ui.selectCatalog(Number(id.slice(8)));return;}
        if(id.startsWith('mode:')){const mode=id.slice(5);if(mode==='apply'){this.requestedMode=this.ui.selectedMode;this.ui.showPage('home');}else this.ui.setMode(mode as GameMode,this.model.endlessUnlocked);this.ui.refreshModes(this.progress.campaignBest,this.progress.endlessBest,this.model.endlessUnlocked);return;}
        if(id.startsWith('record:')){const command=id.slice(7);if(command==='prev'||command==='next'){this.leaderboard.page(command==='next'?1:-1);return;}const mode=command==='campaign'||command==='endless'?command:this.ui.rankingMode,friend=command==='friends'?true:command==='local'?false:this.ui.isFriend;this.ui.setRanking(mode,friend);this.showRecords();return;}
        if(id==='pause'){this.openModal('pause');return;}if(id==='settings'){this.openModal('settings');return;}
        if(id==='stats'){this.showCurrentStats('none');return;}
        if(id==='shopTab'){this.shopPage=this.shopPage==='gear'?'boost':'gear';this.refreshShop();return;}
        if(id==='overload'||id==='overloadQuick'){if(this.model.activateOverload()){this.ui.dismissOverloadShortcut();this.refreshHud();}return;}
        if(id==='start'||id==='restart'||id==='endless'){
            this.requestedMode=id==='start'?this.ui.selectedMode:id==='endless'?'endless':this.model.mode;
            if(this.requestedMode==='endless'&&!this.model.endlessUnlocked)return;
            if(this.art.ready)this.restart();else this.startRequested=true;return;
        }
        if (id === 'menu') { this.model.returnToMenu(); this.clearVisuals(); this.applyPhase(); return; }
        if (id === 'continue') {
            if (this.model.nextWave()) { this.clearVisuals(); this.accumulator = 0; this.noticeClock = 2; this.notice.string = `第 ${this.model.wave} 波 · 术式已强化`; this.notice.color = C.cyan; this.applyPhase(); }
            return;
        }
        const beforeGold=this.model.gold,beforeDamage=this.model.stats.damage,beforeShots=this.model.stats.projectileCount,beforeInterval=this.model.stats.interval;
        const result=id==='reinforce'?this.model.reinforce():id==='refresh'?this.model.reroll():id==='blessing'?this.model.bless():
            id.startsWith('offer:')?(this.shopPage==='boost'?this.model.buyBoost(RUN_BOOSTS[Number(id.slice(6))]):this.model.buyOffer(Number(id.slice(6)))):'unavailable';
        if(result==='purchased'){const b=this.ui.get(id)!;this.ui.animation.pop(b.node.getChildByName('Face')||b.label.node);this.ui.animation.pop(this.shopGold.node,.035,.25);}
        if(result==='purchased'){this.sound('purchase');if(id.startsWith('offer:'))this.shopFlashes[Number(id.slice(6))]=UI_THEME.motion.purchase;}
        this.shopHint.string=result==='purchased'?(id==='refresh'?'术式已刷新 · 新商品已到达':'购置成功 · 强化已立即生效'):
            result==='insufficient'?'金币不足 · 继续战斗收集金币':id==='reinforce'?'任意装备 Lv5 后解锁递减强化':id==='blessing'?'击败巨像后开放一次符文祝福':
            id==='refresh'?'装备已全部满级':'此商品已售出';
        this.shopHint.color=result==='purchased'?C.cyan:C.red;this.shopHintClock=2.5;this.refreshShop();
        this.ui.get(id)?.feedback(result==='purchased');
        if(result==='purchased'&&id!=='refresh'){const changes:string[]=[];if(this.model.stats.damage>beforeDamage)changes.push('伤害 +'+(this.model.stats.damage-beforeDamage).toFixed(2));if(this.model.stats.projectileCount>beforeShots)changes.push('弹体 +'+(this.model.stats.projectileCount-beforeShots));if(this.model.stats.interval<beforeInterval)changes.push('攻速 +'+Math.round((beforeInterval/this.model.stats.interval-1)*100)+'%');this.shopHint.string='购置成功 · -'+(beforeGold-this.model.gold)+' 金币'+(changes.length?'\n'+changes.slice(0,2).join(' / '):' · 新效果已生效');}
        if(result==='purchased'&&id.startsWith('offer:')&&this.shopPage==='gear'){const item=this.model.shopOffers[Number(id.slice(6))];if(item&&this.model.levels[item.id]===5){this.shopHint.string=EQUIPMENT.find(e=>e.id===item.id)!.name+' · Lv5 术式圆满！';this.shopHint.color=C.cyan;}}
    }
    private installWorldArt():void {
        if(this.mapInstalled||!this.art.worldReady)return;this.mapInstalled=true;
        const floor=this.mapRoot.addComponent(Sprite);floor.sizeMode=Sprite.SizeMode.CUSTOM;floor.spriteFrame=this.art.named('arena');floor.color=new Color(92,97,116);
        this.mapRoot.getComponent(UITransform)!.setContentSize(RULES.right-RULES.left,RULES.top-RULES.bottom);
        const names=['crystal_purple','crystal_blue','pillar_rune','banner_torn','rock_large','rock_small','skull_small','crystal_cluster','platform_rune','wall_broken','torch_stone','altar_stone'];
        for(let i=0;i<16;i++){
            const node=this.makeNode('WorldDecoration',this.decorRoot),sp=node.addComponent(Sprite);sp.sizeMode=Sprite.SizeMode.CUSTOM;
            this.art.pose(sp,names[i%names.length],i%4===0?78:52);node.setPosition(i%2?RULES.left+70:RULES.right-70,RULES.bottom+140+Math.floor(i/2)*(RULES.top-RULES.bottom-280)/7);
            node.addComponent(UIOpacity).opacity=155;
        }
    }
    private restart(): void {
        if(!this.art.ready){this.startRequested=true;return;}
        if(!this.art.worldReady){if(this.startRequested)return;this.startRequested=true;this.menuBest.string='正在载入竞技场…';
            this.art.loadWorld(()=>{this.startRequested=false;if(!this.isValid)return;if(this.art.worldReady){this.installWorldArt();if(!this.appHidden&&!this.paused&&this.modal==='none')this.restart();else this.menuBest.string=this.bestText();}else this.menuBest.string='地图载入失败，请重试';});return;}
        this.installWorldArt();
        if(!this.model.reset(this.requestedMode))return;this.runId=Date.now().toString(36)+'-'+(++this.runSerial);this.deferredRevive=false;this.deathClock=0;this.modal='none';this.modalUI.active=false;this.paused=false;this.audio?.setSuspended(false);this.clearVisuals(); this.clearInput(); this.accumulator = 0;
        this.oldHp = RULES.maxHp; this.oldGold = 0; this.hudClock = 0;
        this.noticeClock = 3; this.notice.string = '移动躲避，术式会自动追击'; this.notice.color = C.cyan;
        this.facing=1;this.moving=false;this.playerStride=0;this.playerMoveBlend=0;this.castClock=0;this.wasOverloaded=false;this.cameraX = 0; this.cameraY = 0; this.player.setPosition(0, 0); this.player.setScale(1, 1, 1); this.applyPhase(); this.refreshHud();
    }
    private applyPhase(): void {
        this.clearInput(); this.accumulator = 0; this.lastPhase = this.model.phase;
        this.routeMusic();
        this.audio?.setSuspended(this.appHidden||this.paused||this.model.phase==='downed');
        if(this.model.phase==='shop'||this.model.phase==='victory')this.clearVisuals();
        this.menu.active = this.model.phase === 'menu'; this.shop.active = this.model.phase === 'shop';
        this.overlay.active=this.model.finished;this.world.active=this.model.inCombat||this.model.finished||this.model.phase==='downed';this.ui.refs.reviveUI.active=this.model.phase==='downed';
        if(this.model.phase==='downed'){this.ui.get('revive:watch')?.configure(this.platform.ads.available?'观看广告 · 复活一次':'广告复活暂不可用',this.platform.ads.available);this.ui.get('revive:end')?.setPrimary(!this.platform.ads.available);this.ui.refs.reviveHint.string=this.platform.ads.available?'完整观看可恢复 50% 生命，本局仅一次。':'广告位尚未配置。可直接结束本局，不影响战绩。';}
        this.battleUI.active = this.world.active; this.worldCamera.enabled = this.world.active; this.backdrop.active = !this.world.active; this.flash.active = false;
        this.canvas.cameraComponent!.clearFlags = this.world.active ? Camera.ClearFlag.DEPTH_ONLY : Camera.ClearFlag.SOLID_COLOR;
        if (this.model.inCombat) {
            // Start / next wave / restart must show the player before the next update.
            this.player.active = true; this.syncActors(true); this.updateCamera(0, true);
        }
        if (this.model.phase === 'shop') {this.shopPage='gear';this.saveBest();this.refreshShop();this.shopHint.string='';this.shopHintClock=0;}
        if(this.model.finished){
            const old=this.model.mode==='campaign'?this.progress.campaignBest:this.progress.endlessBest;
            this.ui.result(this.model,old,this.records.data[this.model.mode].kills);
            const record=this.model.wave>old||this.model.kills>this.records.data[this.model.mode].kills;
            this.saveBest();this.finalizeRun();if(this.model.dead)this.effect('burst',this.model.x,this.model.y,1.6);const win=this.model.phase==='victory';this.resultTitle.string=win?'终式解封 · 试炼通关':'术式失控';
            this.recordLabel.string=(record?'刷新本机最高纪录':'本次抵达第 '+this.model.wave+' 波')+(win?'\n无限模式已解锁':'');
            this.recordLabel.color=record?C.gold:C.muted;
            if(record)this.ui.animation.pop(this.recordLabel.node,.045,.3);this.resultSigil.active=win;
            this.resultLabel.string=(this.model.mode==='campaign'?'通关试炼':'无限模式')+' · 第 '+this.model.wave+' 波\n存活时间  '+Math.floor(this.model.elapsed)+' 秒\n击杀  '+this.model.kills+'    最高连杀  '+this.model.maxCombo+'\n最高伤害  '+this.model.highestDamage.toFixed(1)+'\n获得金币  '+this.model.earned+'\n过载释放  '+this.model.overloadUses+' 次\n巨像击破  '+this.model.bossClears+' 次';
        }
        if(this.model.phase==='menu'){
            this.ui.showPage('home');this.ui.refreshModes(this.progress.campaignBest,this.progress.endlessBest,this.model.endlessUnlocked);
        }
    }
    private refreshShop(): void {
        this.shopTitle.string=this.model.blessingAvailable?'巨像奖励 · 魔法商店':`第 ${this.model.wave} 波结束`;
        this.shopGold.string=`金币 ${this.model.gold}`;
        this.ui.refs.shopHealth.string=`生命 ${this.model.hp} / ${RULES.maxHp}`;
        this.shopTabLabel.string=this.shopPage==='gear'?'本局强化':'返回装备';
        this.refreshLabel.string=this.model.refreshPrice===0?'免费稀有刷新':`刷新 · ${this.model.refreshPrice} 金币`;
        this.reinforceLabel.string=`全能强化 · ${this.model.reinforcementPrice} 金币`;
        this.blessingLabel.string=`巨像祝福 · ${this.model.blessingPrice} 金币`;
        for(let i=0;i<4;i++){
            const offer=this.model.shopOffers[i],card=this.shopCards[i],item=offer?EQUIPMENT.find(e=>e.id===offer.id):undefined;
            const rare=offer?.quality==='rare';
            const iconKey=this.shopPage==='boost'?(['equipCrystal','equipWatch','equipCore','equipBlast'] as ArtKey[])[i]:item?('equip'+item.id[0].toUpperCase()+item.id.slice(1)) as ArtKey:'crest';
            this.art.bind(card.icon.getComponent(Sprite)!,iconKey);
            if(this.shopPage==='boost'){
                const id=RUN_BOOSTS[i],n=this.model.boosts[id],price=this.model.boostPrice(id),gain=this.model.boostGain(id)*100;
                card.name.string=['攻击强化','移速强化','暴击强化','范围强化'][i];card.name.color=C.ink;card.level.string='本局 '+n+' 次强化';
                card.effect.string='下次 +'+gain.toFixed(2)+(id==='critical'?' 百分点':'%');card.price.string=price+' 金币 · 购买';card.price.color=this.model.gold>=price?C.gold:C.red;
                continue;
            }
            if(!offer||!item){card.name.string='暂无商品';card.level.string='全部装备已满级';card.effect.string='可购买递减强化';card.price.string='';continue;}
            card.name.string=item.name;card.name.color=rare?C.purple:C.ink;
            const current=this.model.levels[item.id];
            card.level.string=offer.sold?`已装备 Lv${current}`:`${rare?'稀有 · ':''}${current?'Lv'+current+' → ':'获得 '}Lv${offer.targetLevel}`;
            card.effect.string=item.id==='ring'&&offer.targetLevel===1?'弹道修正 20°\n保留散射':item.id==='ring'&&offer.targetLevel===2?'分配近处目标\n保留弹道':item.id==='twin'&&offer.targetLevel===3?'三弹齐发\n3 枚环绕术式':item.id==='pierce'&&offer.targetLevel===4?'贯穿伤害递增\n最多 +24%':item.id==='core'&&offer.targetLevel<=3?`伤害 +${(offer.targetLevel*BALANCE.gear.coreDamagePerLevel).toFixed(1)}\n攻击速度 +${Math.round(offer.targetLevel*BALANCE.gear.coreHastePerLevel*100)}%`:item.effects[offer.targetLevel-1];
            card.price.string=offer.sold?'本次已购置':`${offer.price} 金币 · 购买`;
            card.price.color=offer.sold?C.muted:this.model.gold>=offer.price?C.gold:C.red;

        }
        this.ui.refreshShopStates(this.model,this.shopPage);
    }
    private refreshHud(): void {
        this.ui.get('overload')?.configure('',this.model.overloadReady);
        this.hpLabel.string = `生命 ${this.model.hp} / ${RULES.maxHp}`; this.goldLabel.string = `${this.model.gold}`;
        this.healthFill.setScale(this.model.hp/RULES.maxHp,1,1);
        this.killsLabel.string = this.model.combo > 1 ? this.model.combo + ' 连杀' : '击败 ' + this.model.kills;
        this.energyFill.setScale(this.model.overload>0?this.model.overload/8:this.model.energy/100,1,1);
        this.overloadLabel.string=this.model.overload>0?'过载 · '+this.model.overload.toFixed(1)+' 秒':
            this.model.overloadCooldown>0?'冷却 '+Math.ceil(this.model.overloadCooldown)+' 秒':
            this.model.overloadReady?'术式就绪 · 单手释放':'过载充能 '+Math.floor(this.model.energy)+'%' ;
        this.overloadButtonLabel.string=this.model.overload>0?'过载中':this.model.overloadCooldown>0?Math.ceil(this.model.overloadCooldown)+'s':this.model.overloadReady?'释放':'过载';
        this.overloadButtonLabel.color=this.model.overloadReady?C.cyan:C.purple;
        const mode=this.model.mode==='campaign'?this.model.wave+' / 20':this.model.wave+' · 无限';
        this.waveLabel.string='第 '+mode+' 波';
        this.timeLabel.string=this.model.remaining>0?Math.ceil(this.model.remaining)+' 秒':this.model.boss?'巨像混战':'波次结束';
        this.timerFill.setScale(this.model.remaining/RULES.waveSeconds,1,1);
        this.bossHud.active=!!this.model.boss&&this.model.inCombat;
        if(this.model.boss){const b=this.model.boss;this.bossName.string=BOSS_PHASES[b.phase-1].name+' · '+(b.enraged?'狂暴':BOSS_PHASES[b.phase-1].motif);this.bossName.color=b.enraged?C.red:C.purple;this.bossHealthFill.setScale(Math.max(.0001,b.enemy.hp/b.enemy.maxHp),1,1);}
        this.notice.node.setPosition(0,this.model.boss?352:420);
    }
    private loadBest(): void {
        try{
            const p=JSON.parse(sys.localStorage.getItem(this.progressKey)||'null');
            if(p&&[p.campaignBest,p.endlessBest].every(n=>Number.isFinite(n)&&n>=0)){
                this.progress={campaignBest:Math.min(20,Math.floor(p.campaignBest)),endlessBest:Math.min(100000,Math.floor(p.endlessBest)),unlocked:p.unlocked===true};
                this.model.endlessUnlocked=this.progress.unlocked;
            }
        }catch{/* Invalid local progress starts locked. */}
        try {
            const value = JSON.parse(sys.localStorage.getItem(this.storageKey) || 'null') as BestRecord | null;
            if (value && [value.wave, value.kills, value.elapsed].every(v => Number.isFinite(v) && v >= 0)) {
                this.best = { wave: Math.floor(Math.min(value.wave, 100000)), kills: Math.floor(Math.min(value.kills, 1e9)), elapsed: Math.min(value.elapsed, 1e9) };
            }
        } catch { /* Storage unavailable or corrupt: keep a valid in-memory record. */ }
    }
    private bestText(): string { return '通关试炼最高 '+this.progress.campaignBest+' / 20 波\n无限模式最高 '+this.progress.endlessBest+' 波'; }
    private saveBest(): void {
        this.records.checkpoint(this.model.mode,this.model.wave);this.leaderboard.publish(this.model.mode,this.model.wave);
        if(this.model.mode==='campaign')this.progress.campaignBest=Math.max(this.progress.campaignBest,Math.min(20,this.model.wave));
        else this.progress.endlessBest=Math.max(this.progress.endlessBest,this.model.wave);
        this.progress.unlocked=this.model.endlessUnlocked;
        try{sys.localStorage.setItem(this.progressKey,JSON.stringify(this.progress));}catch{/* Session progress remains usable. */}
        if (this.model.wave < this.best.wave || (this.model.wave === this.best.wave && this.model.kills <= this.best.kills)) return;
        this.best = { wave: this.model.wave, kills: this.model.kills, elapsed: this.model.elapsed };
        try { sys.localStorage.setItem(this.storageKey, JSON.stringify(this.best)); } catch { /* Local record remains available for this session. */ }
    }

    private updateInterface(dt:number):void {this.ui.update(dt,this.model,!this.paused&&!this.appHidden&&this.modal==='none');}
    private routeMusic():void {
        const phase=this.model.phase;
        if(phase==='downed')return; // Keep the interrupted theme paused until the revive decision.
        this.audio?.setMusicScene(phase==='battle'?(this.model.boss?'boss':'battle'):phase==='shop'?'shop':phase==='victory'?'victory':'menu');
    }
    update(dt: number): void {
        if(!this.root)return;this.updateInterface(Math.min(.1,dt));if(this.paused)return;
        dt = Math.min(dt, 0.1); this.audioClock += dt;this.visualClock+=dt;this.castClock=Math.max(0,this.castClock-dt);
        this.visualStop = Math.max(0, this.visualStop - dt); this.stopCooldown = Math.max(0, this.stopCooldown - dt);
        this.soundCooldown = Math.max(0, this.soundCooldown - dt); this.coinPulse = Math.max(0, this.coinPulse - dt);
        this.damageFlashClock = Math.max(0, this.damageFlashClock - dt);
        if (this.model.inCombat) {
            const right = this.keys.has(KeyCode.KEY_D) || this.keys.has(KeyCode.ARROW_RIGHT);
            const left = this.keys.has(KeyCode.KEY_A) || this.keys.has(KeyCode.ARROW_LEFT);
            const up = this.keys.has(KeyCode.KEY_W) || this.keys.has(KeyCode.ARROW_UP);
            const down = this.keys.has(KeyCode.KEY_S) || this.keys.has(KeyCode.ARROW_DOWN);
            const mx = this.touchId !== null ? this.axisX : Number(right) - Number(left);
            const my = this.touchId !== null ? this.axisY : Number(up) - Number(down);
            // Render frames without a fixed simulation step must not switch locomotion back to idle.
            this.moving=Math.hypot(mx,my)>.05;
            if(Math.abs(mx)>.12)this.facing=mx>0?1:-1;
            this.accumulator += dt;
            while (this.accumulator >= 1 / 60) { this.model.step(1 / 60, mx, my); this.accumulator -= 1 / 60; }
            if(this.model.overload>0&&!this.wasOverloaded){this.sound('overload');this.notice.string='术式过载 · 魔力释放';this.notice.color=C.purple;this.noticeClock=1.6;}
            this.wasOverloaded=this.model.overload>0;
            this.model.consumeEvents(event => this.feedback(event));
            if (this.model.hp < this.oldHp) { this.notice.string = '受到伤害 · 拉开距离！'; this.notice.color = C.red; this.noticeClock = 1.2; this.damageFlashClock = 0.22; }
            this.oldHp = this.model.hp;
            if (this.model.gold > this.oldGold) this.coinPulse = 0.16;
            this.oldGold = this.model.gold;
            this.noticeClock -= dt; this.notice.node.active = this.noticeClock > 0;
        }
        if(this.model.dead&&!this.model.reviveOffered&&this.model.revivesUsed<PRODUCT.revive.maxPerRun)this.model.holdForRevive();
        if (this.lastPhase !== this.model.phase) this.applyPhase();
        this.routeMusic();
        this.syncActors(true,dt); this.updateVisuals(dt);
        this.goldLabel.node.setScale(this.coinPulse > 0 ? 1.08 : 1, this.coinPulse > 0 ? 1.08 : 1, 1);
        this.flash.active = this.model.inCombat && this.damageFlashClock > 0;
        this.hpLabel.color=this.damageFlashClock>0?C.red:C.ink;
        this.shakeClock = Math.max(0, this.shakeClock - dt);
        this.updateCamera(dt);
        this.hudClock -= dt;
        if (this.hudClock <= 0 || this.model.dead) { this.refreshHud(); this.hudClock = 0.1; }
        if (this.shopHintClock > 0) {
            this.shopHintClock -= dt;
            if (this.shopHintClock <= 0) { this.shopHint.string = ''; this.shopHint.color = C.muted; }
        }
    }

    private updateCamera(dt: number, snap = false): void {
        if (!this.worldCamera || !this.player) return;
        // All model coordinates are world units; no Canvas translation or scale is involved.
        const size = screen.windowSize, aspect = size.width / Math.max(1, size.height);
        const halfHeight = Math.max(640, 360 / Math.max(0.01, aspect)),hw=halfHeight*aspect;
        const minX=RULES.left+hw-64,maxX=RULES.right-hw+64;
        const minY=RULES.bottom-this.battleBottom-48,maxY=RULES.top-this.battleTop+120;
        const targetX=minX>maxX?0:Math.max(minX,Math.min(maxX,this.player.worldPosition.x));
        const targetY=minY>maxY?0:Math.max(minY,Math.min(maxY,this.player.worldPosition.y));
        const smooth = snap ? 1 : 1 - Math.exp(-9 * dt);
        this.cameraX += (targetX - this.cameraX) * smooth;
        this.cameraY += (targetY - this.cameraY) * smooth;
        this.worldCamera.orthoHeight = halfHeight;
        const amount = this.model.inCombat ? this.preferences.shake*this.shakeAmount * this.shakeClock / 0.12 : 0;
        this.worldCamera.node.setWorldPosition(this.cameraX + Math.sin(this.shakeClock * 180) * amount,
            this.cameraY + Math.cos(this.shakeClock * 145) * amount, 1000);
        this.model.cameraX = this.cameraX; this.model.cameraY = this.cameraY;
        this.model.viewHalfWidth = halfHeight * aspect; this.model.viewHalfHeight = halfHeight;
    }
    private acquire(kind: string): Node {
        let node = this.pools[kind].pop();
        if (!node) {
            if (kind === 'number') {
                node=this.label('number','',0,0,28,C.ink,280,72,this.numberRoot).node;
                // Pooled empty labels must never use SHRINK: it can retain a tiny/blank raster.
                node.getComponent(Label)!.overflow=Label.Overflow.NONE;
                const outline=node.addComponent(LabelOutline);outline.color=C.bg;outline.width=3;
            } else if(kind==='hostileRune') {
                node=this.makeGraphics('hostileRune',this.bossDangerRoot,g=>{
                    g.fillColor=C.dangerFill;g.circle(0,0,100);g.fill();
                    g.strokeColor=C.dangerShadow;g.lineWidth=8;g.circle(0,0,100);g.stroke();
                    g.strokeColor=C.danger;g.lineWidth=4;g.circle(0,0,100);g.stroke();
                    g.strokeColor=C.dangerEdge;g.lineWidth=1.5;g.circle(0,0,96);g.stroke();
                    g.strokeColor=C.danger;g.lineWidth=3;
                    for(let i=0;i<4;i++){const a=i*Math.PI/2,dx=Math.cos(a),dy=Math.sin(a);g.moveTo(dx*76,dy*76);g.lineTo(dx*90,dy*90);}g.stroke();
                });
                this.makeGraphics('Countdown',node,g=>{g.strokeColor=C.danger;g.lineWidth=2;g.circle(0,0,100);g.stroke();});
            } else if(kind==='hostileShot') {
                // Fixed vector arrow: unlike circular gold or the player's cyan/flame bolts, direction stays legible.
                node=this.makeGraphics('hostileShot',this.dangerRoot,g=>{
                    g.fillColor=C.danger;g.strokeColor=C.dangerShadow;g.lineWidth=5;
                    g.moveTo(18,0);g.lineTo(-10,11);g.lineTo(-5,0);g.lineTo(-10,-11);g.close();g.fill();g.stroke();
                    g.strokeColor=C.dangerEdge;g.lineWidth=1.6;g.moveTo(18,0);g.lineTo(-10,11);g.lineTo(-5,0);g.lineTo(-10,-11);g.close();g.stroke();
                    g.strokeColor=C.danger;g.lineWidth=3;g.moveTo(-15,0);g.lineTo(-23,0);g.stroke();
                });
            } else if(kind==='beetleTell') {
                node=this.makeGraphics('beetleTell',this.dangerRoot,g=>{
                    g.fillColor=C.dangerFill;g.strokeColor=C.dangerShadow;g.lineWidth=5;g.rect(0,-23,170,46);g.fill();g.stroke();
                    g.strokeColor=C.danger;g.lineWidth=2;g.rect(0,-23,170,46);g.stroke();
                    g.moveTo(135,-10);g.lineTo(151,0);g.lineTo(135,10);g.stroke();
                });
            } else if(kind==='rangedTell') {
                node=this.makeGraphics('rangedTell',this.dangerRoot,g=>{
                    g.strokeColor=C.dangerShadow;g.lineWidth=6;g.moveTo(22,0);g.lineTo(650,0);g.stroke();
                    g.strokeColor=C.danger;g.lineWidth=2.5;g.moveTo(22,0);g.lineTo(650,0);g.stroke();
                    g.strokeColor=C.dangerEdge;g.lineWidth=2;g.moveTo(636,8);g.lineTo(650,0);g.lineTo(636,-8);g.stroke();
                });
            } else if(kind==='ring') {
                node=this.makeGraphics('ring',this.effects,g=>{g.strokeColor=C.cyan;g.lineWidth=2;g.circle(0,0,100);g.stroke();});
            } else {
                const parent=kind==='spark'||kind==='burst'?this.effects:kind==='slime'||kind==='bat'||kind==='beetle'||kind==='boss'?this.enemiesRoot:kind==='bolt'?this.bulletsRoot:this.coinsRoot;
                node=this.makeSprite(kind,parent,kind==='bolt'?(this.model.levels.flame>0?'flameBolt':'bolt'):kind==='boss'?'golem':kind as ArtKey);
                if(kind==='slime'||kind==='bat'||kind==='beetle'||kind==='boss'){
                    const burn=this.makeSprite('Burn',node,'burn');burn.getComponent(UITransform)!.setContentSize(12,12);burn.addComponent(UIOpacity).opacity=120;burn.active=false;
                    const crown=this.makeSprite('EliteMark',node,'rune');crown.setPosition(0,26);crown.setScale(.5,.5,1);crown.active=false;this.enemyParts.set(node,{mark:crown,burn,transform:node.getComponent(UITransform)!});
                }
            }
            node.addComponent(UIOpacity);
        }
        (node as any).artFamily='';(node as any).artHeight=0;node.active=true;node.setScale(1,1,1);node.angle=0;this.opacity(node).opacity=255;
        if(kind==='slime'||kind==='bat'||kind==='beetle'||kind==='boss') {this.sprite(node).spriteFrame=this.art.frame(kind==='boss'?'golem':kind);this.enemyParts.get(node)!.burn.active=false;this.enemyParts.get(node)!.mark.active=false;this.sprite(node).color=C.white;}
        if(kind==='bolt')this.sprite(node).spriteFrame=this.art.frame(this.model.levels.flame>0?'flameBolt':'bolt');
        return node;
    }
    private release(node: Node): void { node.active = false; this.pools[node.name].push(node); }
    private syncActors(move: boolean,dt=0): void {
        this.enemyIds.clear();this.boltIds.clear();this.hostileIds.clear();this.rangedTellIds.clear();this.beetleTellIds.clear();
        this.nearbyDanger=false;
        for(const h of this.model.hostiles)if(Math.hypot(h.x-this.model.x,h.y-this.model.y)<(h.kind==='rune'?h.radius+180:420)){this.nearbyDanger=true;break;}
        if(this.model.boss?.mode==='dashTell')this.nearbyDanger=true;
        for(const e of this.model.enemies)if(e.kind==='beetle'&&e.beetleMode==='tell')this.nearbyDanger=true;
        for(const e of this.model.enemies)if(e.ranged&&e.telegraph&&Math.hypot(e.x-this.model.x,e.y-this.model.y)<650){this.nearbyDanger=true;break;}
        for(const h of this.model.hostiles){
            this.hostileIds.add(h.id);let node=this.hostileViews.get(h.id);
            if(!node){node=this.acquire(h.kind==='rune'?'hostileRune':'hostileShot');this.hostileViews.set(h.id,node);}
            node.setPosition(h.x,h.y);
            if(h.kind==='rune'){
                const r=h.radius/100;node.setScale(r,r,1);this.opacity(node).opacity=h.applied?255:225;
                const progress=node.getChildByName('Countdown')!,s=Math.max(.03,1-h.warning/Math.max(.01,h.warningTotal));progress.setScale(s,s,1);progress.active=!h.applied;
            } else{node.angle=Math.atan2(h.vy,h.vx)*180/Math.PI;node.setScale(1,1,1);}
        }
        for(const [id,node]of this.hostileViews)if(!this.hostileIds.has(id)){this.release(node);this.hostileViews.delete(id);}

        for (const enemy of this.model.enemies) {
            this.enemyIds.add(enemy.id); let node = this.enemyViews.get(enemy.id); const fresh = !node;
            if (!node) { node = this.acquire(enemy.kind); this.enemyViews.set(enemy.id, node); }
            if (fresh || !(this.visualStop>0&&enemy.hit>.075)) node.setPosition(enemy.x + (enemy.hit > 0 ? Math.sin(enemy.hit * 140) * 1.2 : 0), enemy.y);
            const cullMargin=enemy.kind==='boss'?160:enemy.elite?100:75;
            node.active = Math.abs(enemy.x-this.cameraX) < this.model.viewHalfWidth+cullMargin && Math.abs(enemy.y-this.cameraY) < this.model.viewHalfHeight+cullMargin;
            const pulse=Math.sin(Math.min(1,enemy.hit/.1)*Math.PI/2);
            const idle=enemy.kind==='slime'?Math.sin(this.visualClock*3+enemy.id)*.035:Math.sin(this.visualClock*12+enemy.id)*.10;
            const size=enemy.kind==='boss'?2.4:enemy.elite?1.4:1;
            node.setScale(size*(1+idle+pulse*.23),size*(1-idle*.4-pulse*.17),1);
            const mark=this.enemyParts.get(node)!.mark;mark.active=enemy.elite||enemy.ranged||enemy.fast||enemy.kind==='boss';this.sprite(mark).color=enemy.elite?C.gold:enemy.ranged?C.purple:C.red;
            const telegraph=enemy.ranged&&enemy.telegraph ? .72+Math.sin(this.visualClock*12)*.07 : .5;mark.setScale(telegraph,telegraph,1);
            if(enemy.ranged&&enemy.telegraph){
                this.rangedTellIds.add(enemy.id);let tell=this.rangedTellViews.get(enemy.id);
                if(!tell){tell=this.acquire('rangedTell');this.rangedTellViews.set(enemy.id,tell);}
                tell.setPosition(enemy.aimOriginX,enemy.aimOriginY);tell.setScale(Math.min(650,Math.hypot(enemy.aimX-enemy.aimOriginX,enemy.aimY-enemy.aimOriginY))/650,1,1);tell.angle=Math.atan2(enemy.aimVY,enemy.aimVX)*180/Math.PI;
                this.opacity(tell).opacity=200+Math.round(Math.sin(this.visualClock*10)*25);
            }
            const family=enemy.kind==='boss'?'golem_stage_'+(this.model.boss?.phase||1)+'_pose':enemy.elite?'rune_guard':enemy.ranged?'rune_mage':enemy.kind==='beetle'?'beetle':enemy.kind==='slime'&&(enemy.fast||this.model.wave>=6&&enemy.id%4===0)?'imp':enemy.kind;
            const root=enemy.kind==='boss'?this.bossRoot:enemy.elite?this.eliteRoot:this.enemiesRoot;if(node.parent!==root)node.setParent(root);
            const height=enemy.kind==='boss'?82:enemy.elite?82:family==='slime'?60:family==='bat'?62:family==='rune_mage'?82:68;
            const grounded=family!=='bat'&&family!=='beetle';if((node as any).artFamily!==family)this.enemyParts.get(node)!.transform.setAnchorPoint(.5,grounded?.18:.5);
            (node as any).artFamily=family;(node as any).artHeight=height;
            // Assign tint after choosing the pose. Do not overwrite role identification with white.
            const sprite=this.sprite(node);sprite.color=enemy.hit>.035?C.white:enemy.kind==='boss'&&this.model.boss?.enraged?C.fast:enemy.elite?C.elite:enemy.ranged?C.ranged:enemy.fast?C.fast:C.white;
            if(enemy.kind==='boss')this.art.pose(sprite,family+(this.model.boss?.mode==='dash'||this.model.boss?.mode==='shockTell'?'_02':'_01'),height);
            else {const dx=enemy.x-this.model.x,dy=enemy.y-this.model.y;
                const attacking=enemy.telegraph||enemy.kind==='beetle'&&enemy.beetleMode==='dash'||(family==='imp'||family==='bat'||family==='rune_guard')&&dx*dx+dy*dy<8100;
                const action=enemy.hit>.035&&(family==='slime'||family==='rune_mage'||family==='rune_guard')?'hit':attacking?'attack':enemy.kind==='beetle'&&enemy.beetleMode==='guard'||family==='rune_mage'||family==='rune_guard'?'idle':'move';
                this.art.animate(sprite,family+'_'+action,this.visualClock+enemy.id*.071,height);}
            if(enemy.hit>.082)this.art.pose(sprite,family+'_flash',height);
            if(enemy.kind==='boss'&&this.model.boss){const phase=this.model.boss.phase;this.sprite(mark).color=phase===1?C.cyan:phase===2?C.purple:phase===3?C.gold:C.danger;mark.setScale(.32,.32,1);mark.setPosition(0,height*.9);}
            else mark.setPosition(0,height*(grounded?.9:.55));
            if(enemy.kind==='beetle'){
                node.angle=(Math.atan2(enemy.beetleMode==='tell'||enemy.beetleMode==='dash'?enemy.actionVY:this.model.y-enemy.y,enemy.beetleMode==='tell'||enemy.beetleMode==='dash'?enemy.actionVX:this.model.x-enemy.x)*180/Math.PI)-90;
                if(enemy.beetleMode==='tell'){
                    this.beetleTellIds.add(enemy.id);let tell=this.beetleTellViews.get(enemy.id);if(!tell){tell=this.acquire('beetleTell');this.beetleTellViews.set(enemy.id,tell);}
                    tell.setPosition(enemy.aimOriginX,enemy.aimOriginY);tell.angle=Math.atan2(enemy.actionVY,enemy.actionVX)*180/Math.PI;
                }
            }else node.angle=0;
            const burn=this.enemyParts.get(node)!.burn;burn.active=enemy.burn>0;burn.setPosition(0,-height*(grounded?.08:.35));
        }
        for (const [id, node] of this.enemyViews) if (!this.enemyIds.has(id)) { this.release(node); this.enemyViews.delete(id); }
        for(const [id,node]of this.rangedTellViews)if(!this.rangedTellIds.has(id)){this.release(node);this.rangedTellViews.delete(id);}
        for(const [id,node]of this.beetleTellViews)if(!this.beetleTellIds.has(id)){this.release(node);this.beetleTellViews.delete(id);}
        for (const bolt of this.model.bolts) {
            this.boltIds.add(bolt.id); let node = this.boltViews.get(bolt.id); const fresh = !node;
            if (!node) { node = this.acquire('bolt'); this.boltViews.set(bolt.id, node); }
            if (move || fresh) {node.setPosition(bolt.x, bolt.y);node.angle=Math.atan2(bolt.vy,bolt.vx)*180/Math.PI;}
            // Growth remains visible without turning a full volley into a screen-wide blanket.
            const scale = (this.model.levels.twin >= 4 ? 1.35 : 1) + this.model.levels.core * 0.035 + (this.model.overload > 0 ? 0.12 : 0); node.setScale(scale, scale, 1);this.sprite(node).color=bolt.homing?C.purple:C.white;
            this.opacity(node).opacity=this.nearbyDanger?170:220;
        }
        for (const [id, node] of this.boltViews) if (!this.boltIds.has(id)) { this.release(node); this.boltViews.delete(id); }
        this.syncCoinRepresentatives();
        if (move) this.player.setPosition(this.model.x, this.model.y);
        const scale = 1;
        this.player.setScale(scale*this.facing,scale,1);
        // Match the enemies' continuous squash/stretch movement language.
        // Deform only the artwork: the world root, foot sigil and collision stay fixed.
        const walking=this.moving&&this.model.inCombat;
        this.playerMoveBlend+=((walking?1:0)-this.playerMoveBlend)*(1-Math.exp(-18*dt));
        if(!walking&&this.playerMoveBlend<.0001){this.playerMoveBlend=0;this.playerStride=0;}
        else this.playerStride+=dt;
        const pulse=Math.sin(this.playerStride*12)*this.playerMoveBlend;
        const bodyX=1+pulse*.08,bodyY=1-pulse*.10;
        this.playerBody.setScale(bodyX,bodyY,1);
        // The approved pose's sole is 1 source pixel above its (.5,.125) pivot.
        // Compensate that tiny offset so stretching never moves the planted foot.
        const soleOffset=(1-bodyY)*112/88;
        this.playerBody.setPosition(0,soleOffset);this.playerBody.angle=0;
        this.playerStaff.angle=this.castClock>0?-18*(this.castClock/.16):0;
        const playerSprite=this.sprite(this.playerBody);playerSprite.color=C.white;
        this.art.pose(playerSprite,'player_idle_02',112);
        const overloaded=this.model.overload>0;
        this.playerSigil.angle=this.visualClock*(overloaded?38:18);
        const glow=(overloaded?1.18:1)*(1+Math.sin(this.visualClock*3)*.015);
        this.playerSigil.setScale(glow,glow,1);this.opacity(this.playerSigil).opacity=overloaded?110:65;
        this.castHalo.setPosition(32*bodyX,65*bodyY+soleOffset);
        this.castHalo.active=this.castClock>0;const castScale=.8+(1-this.castClock/.16)*.22;this.castHalo.setScale(castScale,castScale,1);this.opacity(this.castHalo).opacity=Math.round(70*this.castClock/.16);
        for (let i = 0; i < 3; i++) {
            const node = this.orbitViews[i]; node.active = this.model.stats.orbitDamage > 0;
            if (move) node.setPosition(this.model.orbit[i].x, this.model.orbit[i].y);
        }
        this.sigilCircle.active=this.model.levels.ring>=5&&this.model.inCombat;
        this.sigilFloor.setPosition(this.model.x,this.model.y-6);this.sigilCircle.angle=-this.visualClock*25;
        this.opacity(this.sigilCircle).opacity=overloaded?65:40;
        for(let i=0;i<5;i++){const n=this.sigilViews[i];n.active=i<this.model.ringOrbitCount&&this.model.inCombat;if(n.active){n.setPosition(this.model.sigilOrbit[i].x,this.model.sigilOrbit[i].y);n.angle=-this.visualClock*42;}}
        this.drawBossTell();
        if(this.model.dead){this.opacity(this.player).opacity=Math.round(255*(1-this.deathClock/.4));this.playerBody.angle=-this.deathClock/.4*50;}else this.opacity(this.player).opacity=255;
        // World roots retain their explicit ordering; player never moves above danger information.
    }
    private syncCoinRepresentatives(): void {
        // Read-only visual grouping: every Coin remains in the model and is collected/settled independently.
        // These fixed scratch records and retained nodes avoid allocation while coins move between clusters.
        for(const group of this.coinClusters){group.x=0;group.y=0;group.count=0;group.age=0;}
        const flightCap=this.nearbyDanger?LIMITS.dangerFlyingCoins:LIMITS.flyingCoins;
        for(const coin of this.model.coins){
            if(Math.abs(coin.x-this.cameraX)>this.model.viewHalfWidth+40||Math.abs(coin.y-this.cameraY)>this.model.viewHalfHeight+40)continue;
            const flying=coin.age>=.23,start=flying?LIMITS.groundCoins:0,end=start+(flying?flightCap:LIMITS.groundCoins);
            let slot=-1,empty=-1,nearest=(flying?112:76)**2;
            for(let i=start;i<end;i++){
                const g=this.coinClusters[i];if(!g.count){if(empty<0)empty=i;continue;}
                const dx=coin.x-g.x/g.count,dy=coin.y-g.y/g.count,d=dx*dx+dy*dy;
                if(d<nearest){nearest=d;slot=i;}
            }
            if(slot<0)slot=empty;
            if(slot<0)continue; // Unrepresented coins still move, pay out and settle in the simulation.
            const g=this.coinClusters[slot];g.x+=coin.x;g.y+=coin.y;g.age+=coin.age;g.count++;
        }
        this.activeCoinRepresentatives=0;this.flyingCoinRepresentatives=0;
        for(let i=0;i<this.coinClusters.length;i++){
            const g=this.coinClusters[i];let node=this.coinRepresentatives[i];
            if(!g.count){if(node)node.active=false;continue;}
            if(!node){node=this.acquire('coin');this.coinRepresentatives[i]=node;this.sprite(node).color=C.coinQuiet;}
            node.active=true;this.activeCoinRepresentatives++;const flying=i>=LIMITS.groundCoins;
            if(flying)this.flyingCoinRepresentatives++;
            const age=g.age/g.count,pop=flying?0:Math.sin(Math.min(1,age/.23)*Math.PI)*7;
            node.setPosition(g.x/g.count,g.y/g.count+pop);node.angle=Math.sin(age*3)*9;
            const size=flying ? .52 : .65;node.setScale(size*(.85+Math.abs(Math.cos(age*3))*.15),size,1);
            this.opacity(node).opacity=this.nearbyDanger?(flying?72:115):(flying?140:175);
        }
    }
    private drawBossTell(): void {
        const b=this.model.boss,g=this.bossTell;
        g.node.active=!!b&&this.model.inCombat&&b.mode==='dashTell';
        if(!g.node.active||!b)return;
        if(this.bossTellX===b.originX&&this.bossTellY===b.originY&&this.bossTellVX===b.vx&&this.bossTellVY===b.vy&&this.bossTellRadius===b.enemy.radius)return;
        this.bossTellX=b.originX;this.bossTellY=b.originY;this.bossTellVX=b.vx;this.bossTellVY=b.vy;this.bossTellRadius=b.enemy.radius;
        g.clear();g.fillColor=C.dangerFill;g.strokeColor=C.danger;g.lineWidth=4;
        const len=Math.hypot(b.vx,b.vy)||1,radius=b.enemy.radius,nx=-b.vy/len*radius,ny=b.vx/len*radius,tx=b.originX+b.vx*.7,ty=b.originY+b.vy*.7;
        g.moveTo(b.originX+nx,b.originY+ny);g.lineTo(tx+nx,ty+ny);g.lineTo(tx-nx,ty-ny);g.lineTo(b.originX-nx,b.originY-ny);g.close();g.fill();g.stroke();
        g.circle(b.originX,b.originY,radius);g.circle(tx,ty,radius);g.fill();g.stroke();
        g.strokeColor=C.dangerEdge;g.lineWidth=2;
        const ax=b.originX+b.vx*.35,ay=b.originY+b.vy*.35,ux=b.vx/len,uy=b.vy/len;
        g.moveTo(ax-ux*18-uy*12,ay-uy*18+ux*12);g.lineTo(ax,ay);g.lineTo(ax-ux*18+uy*12,ay-uy*18-ux*12);g.stroke();
    }
    private timed(node: Node, duration: number, x: number, y: number, size: number): TimedVisual {
        const visual = this.timedPool.pop() || {} as TimedVisual;
        visual.node = node; visual.age = 0; visual.duration = duration; visual.x = x; visual.y = y; visual.size = size; return visual;
    }
    private effect(kind: 'burst' | 'ring' | 'spark', x: number, y: number, size: number): void {
        if (this.fx.length >= (this.preferences.effects<1?4:this.nearbyDanger?6:LIMITS.effects)) return;
        let same=0;const cap=kind==='ring'?3:4;
        for(const fx of this.fx)if(fx.node.name===kind){
            same++;if(fx.age<.09&&Math.hypot(fx.x-x,fx.y-y)<(kind==='ring'?70:40))return;
        }
        if(same>=cap)return;
        const node=this.acquire(kind);node.setPosition(x,y);
        this.fx.push(this.timed(node,kind==='ring'?.18:kind==='spark'?.10:.20,x,y,size));
    }
    private float(event: CombatEvent, coin: boolean): void {
        // Currency is consolidated into the HUD, not a second stream of text around the player.
        if(coin)return;
        const style = event.value>=80 || (this.model.overload>0&&event.strong&&event.value>=30) ? 'overload' : event.critical ? 'critical' : event.source === 'explosion' ? 'explosion' : 'normal';
        const existing = this.numbers.find(n => n.style === style && (n.id === event.id || style==='overload' || (style==='explosion' && Math.hypot(n.x-event.x,n.y-event.y)<100)) && n.age < .25);
        if (existing) { existing.age=Math.min(existing.age,.18); existing.value += event.value; existing.label.string = this.numberText(existing.value, coin, style); return; }
        if(style==='overload'&&this.numbers.some(n=>n.style==='overload'))return;
        if (this.numbers.length >= (this.nearbyDanger?UI_THEME.effects.dangerNumbers:LIMITS.numbers)) {
            const replace=(style==='critical'||style==='overload')?this.numbers.findIndex(n=>n.style==='normal'||n.coin):-1;
            if(replace<0)return;const old=this.numbers.splice(replace,1)[0];this.release(old.node);this.numberPool.push(old);
        }
        const node = this.acquire('number'), label = node.getComponent(Label)!;
        const visual = this.numberPool.pop() || {} as FloatingNumber;
        visual.node = node; visual.label = label; visual.opacity=this.opacity(node); visual.age = 0; visual.duration = this.nearbyDanger?.42:.55;
        const side=style==='overload'?160:style==='critical'||style==='explosion'?115:60;
        visual.x = Math.max(this.cameraX-this.model.viewHalfWidth+side,Math.min(this.cameraX+this.model.viewHalfWidth-side,event.x)); visual.y = Math.max(this.cameraY-315,Math.min(this.cameraY+(this.model.boss?240:330),event.y+58)); visual.id = event.id; visual.value = event.value; visual.coin = coin; visual.style = style; visual.size = style === 'critical' || style === 'overload' ? 1.13 : 1;
        if(Math.abs(visual.x-this.model.x)<80&&Math.abs(visual.y-this.model.y)<70)visual.y=this.model.y+100;
        label.color = style === 'critical' ? C.gold : style === 'overload' ? C.purple : style === 'explosion' ? C.cyan : C.ink; label.fontSize = style === 'overload' ? 26 : style === 'critical' ? 28 : 23;label.lineHeight=label.fontSize+4; label.string = this.numberText(event.value, coin, style);
        node.setPosition(visual.x, visual.y); this.numbers.push(visual);
    }
    private numberText(value: number, coin: boolean, style = 'normal'): string { return coin ? `+${value}` : (style === 'overload' ? 'OVERLOAD ' : '') + `-${Number(value.toFixed(1))}`; }
    private feedback(event: CombatEvent): void {
        if(event.type==='bossStart'){this.notice.string=(this.model.boss?.phase===4?'终式降临 · ':'巨大术式反应 · ')+BOSS_PHASES[(this.model.boss?.phase||1)-1].name;this.notice.color=C.purple;this.noticeClock=3;this.sound('overload');return;}
        if(event.type==='bossDefeated'){this.sound('purchase');this.effect('burst',event.x,event.y,2.4);return;}
        if(event.type==='bossSkill'){this.notice.string=event.source==='dashTell'?'巨像冲撞 · 移开粉色路线':'符文冲击 · 离开粉色区域';this.notice.color=C.danger;this.noticeClock=1.1;return;}
        if (event.type === 'attack') { this.castClock=.16;this.sound('attack');return; }
        if (event.type === 'hit') {
            if(event.critical) this.sound('critical');
            this.float(event, false);this.effect('spark',event.x,event.y,event.critical?1.3:.8);
            if (event.critical&&event.strong&&event.value>=40&&this.stopCooldown<=0) { this.visualStop=.018;this.stopCooldown=.45; }
            if (event.strong && this.shakeClock <= 0) { this.shakeClock = 0.10; this.shakeAmount = 2; }
            if (this.soundCooldown <= 0) {
                try { this.sound('hit', event.strong ? 1 : 0.5); } catch { /* Audio adapters cannot interrupt combat. */ }
                this.soundCooldown = 0.035;
            }
        } else if (event.type === 'death') {
            let node = this.enemyViews.get(event.id);
            if (node) this.enemyViews.delete(event.id); else node = this.acquire(event.kind);
            node.active = true;this.enemyParts.get(node)!.burn.active=false;
            if(!(node as any).artFamily){(node as any).artFamily=event.kind==='boss'?'golem_stage_'+Math.min(4,Math.floor(this.model.wave/5))+'_pose':event.value?'rune_guard':event.kind;(node as any).artHeight=64;}
            this.enemyParts.get(node)!.mark.active=false;
            if(event.kind==='boss'){
                this.art.pose(this.sprite(node),(node as any).artFamily+'_02',82);this.sprite(node).color=C.white;
                if(this.dying.length>=LIMITS.deaths){const old=this.dying.shift()!;this.release(old.node);this.timedPool.push(old);}
            }
            node.setPosition(event.x, event.y);
            if (this.dying.length < LIMITS.deaths) this.dying.push(this.timed(node,event.kind==='boss'?.8:.5,event.x,event.y,event.kind==='boss'?2.4:event.value?1.4:1));
            else this.release(node);
            this.effect('burst', event.x, event.y, 1.5);
        } else if (event.type === 'coin') { this.sound('coin',.6); this.coinPulse = 0.16; }
        else {
            this.effect('ring', event.x, event.y, event.value);
            if (this.shakeClock <= 0) { this.shakeClock = 0.12; this.shakeAmount = 2; }
            try { this.sound('explosion'); } catch { /* Silent fallback. */ }
        }
    }
    private updateVisuals(dt: number): void {
        for (let i = this.dying.length - 1; i >= 0; i--) {
            const v = this.dying[i]; v.age += dt; const t = Math.min(1, v.age / v.duration);
            const scale = t < 0.2 ? 1 + t * 1.3 : Math.max(0.05, 1.3 * (1 - t));
            const family=(v.node as any).artFamily||'slime';
            if(!family.startsWith('golem'))this.art.animate(this.sprite(v.node),family+'_death',v.age,(v.node as any).artHeight||52,false);
            v.node.setScale(scale*v.size, scale*v.size, 1); this.opacity(v.node).opacity = Math.round(255 * (1 - t));
            if (t >= 1) { this.release(v.node); this.timedPool.push(this.dying.splice(i, 1)[0]); }
        }
        for (let i = this.fx.length - 1; i >= 0; i--) {
            const v = this.fx[i]; v.age += dt; const t = Math.min(1, v.age / v.duration);
            const scale = v.node.name === 'ring' ? v.size / 100 * (0.72 + t * 0.28) : 0.4 + t * v.size;
            v.node.setScale(scale, scale, 1); this.opacity(v.node).opacity = Math.round((v.node.name==='ring'?(this.nearbyDanger?65:100):110) * (1 - t));
            if (t >= 1) { this.release(v.node); this.timedPool.push(this.fx.splice(i, 1)[0]); }
        }
        for (let i = this.numbers.length - 1; i >= 0; i--) {
            const v = this.numbers[i]; v.age += dt; const t = Math.min(1, v.age / v.duration);
            const pop = v.size * (1 + Math.sin(Math.min(1,t*3)*Math.PI)*0.18); v.node.setScale(pop,pop,1);
            v.node.setPosition(v.x, v.y + t * 42); v.opacity.opacity = Math.round((this.nearbyDanger?215:255) * (1 - t * t));
            if (t >= 1) { this.release(v.node); this.numberPool.push(this.numbers.splice(i, 1)[0]); }
        }
    }
    private clearVisuals(): void {
        for (const map of [this.enemyViews,this.boltViews,this.hostileViews,this.rangedTellViews,this.beetleTellViews]) { for (const node of map.values()) this.release(node); map.clear(); }
        for(const node of this.coinRepresentatives)if(node)node.active=false;
        this.activeCoinRepresentatives=0;this.flyingCoinRepresentatives=0;this.nearbyDanger=false;
        for (const v of this.dying) { this.release(v.node); this.timedPool.push(v); }
        for (const v of this.fx) { this.release(v.node); this.timedPool.push(v); }
        for (const v of this.numbers) { this.release(v.node); this.numberPool.push(v); }
        this.dying.length = 0; this.fx.length = 0; this.numbers.length = 0;
        this.visualStop = 0; this.stopCooldown = 0; this.shakeClock = 0; this.coinPulse = 0; this.damageFlashClock = 0;
        this.bossTell.clear();this.bossTell.node.active=false;this.bossTellX=NaN;
        this.world.setPosition(0, 0);
    }
    getDiagnostics(): object {
        return { version:this.model.version,mode:this.model.mode,energy:this.model.energy,overload:this.model.overload,overloadCooldown:this.model.overloadCooldown,overloadUses:this.model.overloadUses,hostiles:this.model.hostiles.length,phase: this.model.phase, bossMode:this.model.boss?.mode,bossHP:this.model.boss?.enemy.hp,bossClears:this.model.bossClears,ringOrbits:this.model.ringOrbitCount,eliteCount:this.model.enemies.filter(e=>e.elite).length,enemies: this.model.enemies.length, bolts: this.model.bolts.length,
            coins: this.model.coins.length,coinRepresentatives:this.activeCoinRepresentatives,flyingCoinRepresentatives:this.flyingCoinRepresentatives,nearbyDanger:this.nearbyDanger,rangedWarnings:this.rangedTellViews.size, effects: this.fx.length, particles: this.fx.filter(v => v.node.name === 'burst'||v.node.name==='spark').length * 4,
            numbers: this.numbers.length, dying: this.dying.length, actorNodes: this.enemiesRoot.children.length + this.eliteRoot.children.length + this.bossRoot.children.length + this.bulletsRoot.children.length + this.coinsRoot.children.length + this.dangerRoot.children.length + 4,
            paused:this.paused,modal:this.modal,hidden:this.appHidden,preferences:{...this.preferences},shortcut:{visible:this.ui.shortcut.visible,armed:this.ui.shortcut.armed,x:this.ui.shortcut.x,y:this.ui.shortcut.y},artReady:this.art.ready,artError:this.art.error,beetles:this.model.enemies.filter(e=>e.kind==='beetle').length,beetleWarnings:this.beetleTellViews.size,bossPhase:this.model.boss?.phase,artFrames:this.art.frameCount,worldArtReady:this.art.worldReady,artLoadMs:this.art.loadMs,worldLoadMs:this.art.worldLoadMs,fontReady:this.uiFontReady,fontError:this.uiFontError,audio:this.audio.getDiagnostics(),modelAllocations: { ...this.model.allocations }, effectNodes: this.effects.children.length };
    }
    onDestroy(): void {
        this.platform?.dispose();
        this.world?.destroy(); this.root?.destroy();this.art.dispose();this.audio?.stopAll();
        if (this.canvas?.cameraComponent) {
            if(this.originalUIClearColor)this.canvas.cameraComponent.clearColor=this.originalUIClearColor;this.canvas.cameraComponent.clearFlags = this.originalUIClear;
            this.canvas.cameraComponent.visibility = this.originalUIVisibility;
        }
        input.off(Input.EventType.TOUCH_START, this.touchStart, this); input.off(Input.EventType.TOUCH_MOVE, this.touchMove, this);
        input.off(Input.EventType.TOUCH_END, this.touchEnd, this); input.off(Input.EventType.TOUCH_CANCEL, this.touchCancel, this);
        input.off(Input.EventType.KEY_DOWN, this.keyDown, this); input.off(Input.EventType.KEY_UP, this.keyUp, this);
        view.off('canvas-resize', this.fit, this); game.off(Game.EVENT_HIDE, this.hide, this); game.off(Game.EVENT_SHOW, this.show, this);
    }
}











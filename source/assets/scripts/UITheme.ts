import { Color, Graphics } from 'cc';
/** Shared visual tokens. World danger colors deliberately stay brighter than rewards or decoration. */
export const PALETTE = {
    bg:new Color(10,14,27),panel:new Color(25,31,47),grid:new Color(43,53,76),
    ink:new Color(244,239,227),muted:new Color(175,183,202),cyan:new Color(113,235,221),
    lime:new Color(157,220,175),purple:new Color(180,155,255),red:new Color(255,114,132),
    gold:new Color(231,193,111),white:new Color(255,255,255),
    danger:new Color(255,79,161),dangerEdge:new Color(255,224,242),
    dangerFill:new Color(255,79,161,24),dangerShadow:new Color(20,10,30),coinQuiet:new Color(177,154,108),
    rim:new Color(67,80,111),shade:new Color(5,8,17),stone:new Color(16,23,37),
    elite:new Color(255,224,164),fast:new Color(255,183,170),ranged:new Color(222,202,255),
    button:new Color(43,51,67),buy:new Color(81,65,37),buyPressed:new Color(100,79,40),
    primary:new Color(34,79,84),primaryPressed:new Color(42,98,102),
};
export const UI_THEME = {
    font:{caption:18,small:20,body:24,button:26,section:32,title:56},
    space:{unit:8,padding:24,gap:16},
    motion:{press:.12,purchase:.48,menuRunes:7,readyPulse:2.4},
    effects:{menuMotes:6,normalNumbers:8,dangerNumbers:4,coinGap:.24},
};
export function cutRect(g:Graphics,x:number,y:number,w:number,h:number,cut=10):void {
    const s=Math.max(3,Math.round(cut/2));
    g.moveTo(x+cut,y);g.lineTo(x+w-cut,y);g.lineTo(x+w-cut,y+s);g.lineTo(x+w-s,y+s);g.lineTo(x+w-s,y+cut);g.lineTo(x+w,y+cut);
    g.lineTo(x+w,y+h-cut);g.lineTo(x+w-s,y+h-cut);g.lineTo(x+w-s,y+h-s);g.lineTo(x+w-cut,y+h-s);g.lineTo(x+w-cut,y+h);
    g.lineTo(x+cut,y+h);g.lineTo(x+cut,y+h-s);g.lineTo(x+s,y+h-s);g.lineTo(x+s,y+h-cut);g.lineTo(x,y+h-cut);
    g.lineTo(x,y+cut);g.lineTo(x+s,y+cut);g.lineTo(x+s,y+s);g.lineTo(x+cut,y+s);g.close();
}
export function paintPanel(g:Graphics,w:number,h:number,accent=PALETTE.rim,button=false,disabled=false):void {
    const x=-w/2,y=-h/2;g.clear();
    g.fillColor=PALETTE.shade;cutRect(g,x,y-5,w,h,12);g.fill();
    g.fillColor=PALETTE.panel;g.strokeColor=disabled?PALETTE.grid:accent;g.lineWidth=2;cutRect(g,x,y,w,h,12);g.fill();g.stroke();
    g.strokeColor=PALETTE.grid;g.lineWidth=1;cutRect(g,x+5,y+5,w-10,h-10,8);g.stroke();
    g.fillColor=disabled?PALETTE.grid:accent;g.rect(x+16,y+h-4,Math.min(42,w/4),2);g.rect(x+w-58,y+2,42,2);g.fill();
    if(button){
        g.fillColor=disabled?PALETTE.rim:accent;
        g.moveTo(x+18,0);g.lineTo(x+23,5);g.lineTo(x+28,0);g.lineTo(x+23,-5);g.close();g.fill();
        g.moveTo(w/2-28,0);g.lineTo(w/2-23,5);g.lineTo(w/2-18,0);g.lineTo(w/2-23,-5);g.close();g.fill();
    }
}
export function paintSigil(g:Graphics,r:number,accent=PALETTE.cyan):void {
    g.strokeColor=PALETTE.grid;g.lineWidth=2;g.circle(0,0,r);g.circle(0,0,r*.84);g.stroke();
    g.strokeColor=accent;g.lineWidth=2;
    for(let i=0;i<8;i++){const a=i*Math.PI/4,c=Math.cos(a),s=Math.sin(a);g.moveTo(c*r*.9,s*r*.9);g.lineTo(c*r,s*r);}g.stroke();
    g.moveTo(0,r*.68);g.lineTo(r*.59,-r*.34);g.lineTo(-r*.59,-r*.34);g.close();g.stroke();
    g.moveTo(0,-r*.68);g.lineTo(r*.59,r*.34);g.lineTo(-r*.59,r*.34);g.close();g.stroke();
}

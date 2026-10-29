// Original code-authored pixel nine-slices. No external artwork or image-generation dependency.
const fs=require('fs'),path=require('path'),sharp=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const target=path.join(__dirname,'../assets/resources/art/ui/panels.png'),data=Buffer.alloc(64*32*4);
function inside(x,y){if(x<0||x>31||y<0||y>30)return false;const a=Math.min(x,31-x),b=Math.min(y,30-y);return !(a<4&&b<8||a<8&&b<4);}
for(let y=0;y<32;y++)for(let x=0;x<32;x++){if(!inside(x,y))continue;let edge=false;for(let d=1;d<=2;d++)if(!inside(x-d,y)||!inside(x+d,y)||!inside(x,y-d)||!inside(x,y+d))edge=true;
 for(let part=0;part<2;part++){const j=(y*64+x+part*32)*4;if(part===1&&!edge)continue;const cornerMark=(y===2||y===3)&&x>=8&&x<=11||(y===27||y===28)&&x>=20&&x<=23;const v=part?255:y>=28?78:edge?165:255;data[j]=data[j+1]=data[j+2]=v;data[j+3]=part?(cornerMark?255:160):255;}}
sharp(data,{raw:{width:64,height:32,channels:4}}).png({palette:true}).toFile(target).then(info=>console.log({target,...info}));

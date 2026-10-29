// Deterministic asset normalization; the artist's original pixels remain in assets/art (not packed).
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..'),source=path.join(root,'assets/art/third-party/7soul/I_Crystal01.png');
(async()=>{
 const target=path.join(root,'assets/resources/art/ui/overload.png');
 await sharp(source).png({palette:true,colours:64,effort:10,compressionLevel:9}).toFile(target);
 const rawSource=await sharp(source).ensureAlpha().raw().toBuffer(),rawOutput=await sharp(target).ensureAlpha().raw().toBuffer();
 if(rawSource.length!==rawOutput.length)throw Error('Changed dimensions');
 for(let i=0;i<rawSource.length;i+=4)if(rawSource[i+3]!==rawOutput[i+3]||(rawSource[i+3]>0&&rawSource.subarray(i,i+4).compare(rawOutput.subarray(i,i+4))))throw Error('Changed visible pixels or alpha');
 const metaPath=target+'.meta';
 if(!fs.existsSync(metaPath)){
  const template=fs.readFileSync(path.join(root,'assets/resources/art/ui/panels.png.meta'),'utf8');
  const old=JSON.parse(template).uuid,id=crypto.randomUUID();
  fs.writeFileSync(metaPath,template.replaceAll(old,id).replaceAll('"panels"','"overload"'));
 }
 const meta=await sharp(target).metadata(),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
 const result={author:'Henrique Lazarini (7Soul1)',license:'CC0-1.0',sourcePage:'https://opengameart.org/content/496-pixel-art-icons-for-medievalfantasy-rpg',download:'https://opengameart.org/sites/default/files/496_RPG_icons.zip',selected:'I_Crystal01.png',sourceSHA256:hash(source),outputSHA256:hash(target),width:meta.width,height:meta.height,alpha:meta.hasAlpha,bytes:fs.statSync(target).size,processing:'Strip metadata, lossless palette compression; one icon only; nearest/clamp/no mipmaps in Cocos.'};
 fs.mkdirSync(path.join(root,'docs/one-hand-overload'),{recursive:true});fs.writeFileSync(path.join(root,'docs/one-hand-overload/asset-manifest.json'),JSON.stringify(result,null,2));console.log(result);
})().catch(e=>{console.error(e);process.exit(1)});

const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/story/manifest.json'),'utf8'));
const assets=['characters','ships','scenes','gameplay','panels'].flatMap(key=>manifest[key]);
const missing=[],invalid=[];let valid=0;
for(const item of assets){
 const file=path.join(root,item.asset);
 if(!fs.existsSync(file)){missing.push(item.asset);continue;}
 const bytes=fs.readFileSync(file);
 if(bytes.length<24||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'){invalid.push({file:item.asset,reason:'不是PNG文件，请转换格式，不能只改扩展名。'});continue;}
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
 if(width<512||height<512)invalid.push({file:item.asset,reason:`图片较小（${width}×${height}），建议至少512像素。`});else valid++;
}
console.log(`素材共 ${assets.length} 张；已就绪 ${valid} 张；待补 ${missing.length} 张；需检查 ${invalid.length} 张。`);
if(process.argv.includes('--list'))console.log(missing.join('\n'));
for(const item of invalid)console.log(item.file+': '+item.reason);
if(invalid.length)process.exitCode=1;

// Deterministic production handoff; does not call any image service.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),D=require('../js/journey-data.js');
const common='原创日系彩色漫画，纯2D手绘，清晰细腻的深色线稿，赛璐璐上色，少量柔和水彩环境纹理，适量漫画网点，人物表情生动，友善阳光的奇幻冒险世界，暖金色日光，青绿与奶油白为主色，低饱和背景与清楚的人物配色，精致自然的构图，全年龄，角色衣服完整，无文字、无对白气泡、无边框、无水印。';
const negative='3D，三维渲染，写实照片，真人，塑料皮肤，黏土，恐怖，血腥，阴森，过度性感，裸露，成人内容，文字，汉字，英文字母，对白气泡，字幕，标志，水印，拼图，多格漫画，多视角混在同一画面，多余手指，多余肢体，扭曲手脚，重复人物，模糊，低清，过曝，杂乱背景。';
const ship='萤火号：原创小型圆润甲虫形双人飞船，奶油白椭圆船身，橙色装甲饰板，黄铜接缝，青蓝色圆形玻璃驾驶舱，两片短圆侧翼，船尾两盏金色萤光推进灯，底部环状升力装置，温暖可爱、机械结构可信，不像现代战斗机，不带武器，无文字编号';
const manifest={version:1,base:'assets/story/',characters:[],scenes:[],gameplay:[],ships:[],panels:[]};
let guide=`# 海艺 AI · 星隙几何素材制作指南\n\n本文件的提示词可直接复制使用。不依赖海艺的某个模型或特定版本界面。分辨率是构图建议，具体以所选模型支持的尺寸为准。\n\n## 先做哪几张\n\n先做 **8位角色头像 + 2张飞船设定 + 3张场景，共13张核心图**。先定小航和萤火号，再定其他角色，最后做场景。全部定稿后才开始单格漫画，避免每张图长相不同。角色三视图是可选辅助资产。\n\n1. 每位角色先选定一张满意的定稿。后面出现同一角色时使用该定稿作为角色参考（如果所用模型/工作流支持参考图）。固定角色外形描述，记录使用的模型和参数；只固定随机种子不能保证跨场景一致。\n2. 风格参考使用你发的彩色漫画图，只参考线稿、网点与上色，不照搬其中人物的服装或身份。\n3. 漫画**一格一张图**，不要让模型生成整页多格排版。对白、分镜编号和按钮由游戏绘制，图片里不要生成文字。\n4. 建议角色头像1:1（如1024×1024），场景和漫画16:9（如1536×864）。不要拉伸；必要时等比裁切。角色脸部放在画面中央偏上，漫画主要人物和关键动作放在中央60%区域，兼容手机裁切。\n5. 图片按下方文件名保存为真正的PNG文件，放入项目的 assets/story 对应目录。不要只把JPG的扩展名改成PNG。刷新网页即会显示已有图片；缺图位置继续显示分镜说明。\n6. 不需要透明背景，头像在网页中裁成圆形；飞船设定用干净浅色底。正式漫画场景要有环境背景。\n7. 多人画面尽量先保证主要两三个人一致。大合照先做构图，再逐个检查角色脸、衣服和人数；必要时分区域修正，不能仅依赖一次生成。\n\n## 统一风格词\n\n下面每条具体提示词已包含风格词，直接复制对应完整提示词即可。\n\n> ${common}\n\n## 通用反向提示词\n\n所用工作流支持反向提示词时填入；不支持时把关键限制附在正向提示词末尾。\n\n> ${negative}\n\n## 角色定稿（8张）\n\n`;
for(const [id,c] of Object.entries(D.characters)){
 const asset=`assets/story/characters/${id}.png`,prompt=`${common}单人半身角色定稿肖像，${c.look}。性格表现：${c.personality}。正面微微转向三分之二视角，温和自然的微笑，双眼清楚，干净奶油白背景，头顶和肩部完整留边，不裁切头发，只有这一名角色，面部位于画面中央偏上。`;
 manifest.characters.push({id,name:c.name,asset,ratio:'1:1',prompt});
 guide+=`### ${c.name}｜${c.role}\n\n文件：\`${asset}\` · 建议1:1\n\n\`\`\`text\n${prompt}\n\`\`\`\n\n`;
}
guide+='## 飞船定稿（2张）\n\n两张使用同一船体设计，先生成完好版，再以完好版为参考制作损坏版。不要换成另一艘船。\n\n';
for(const [id,title,detail] of [['ship-repaired','修复后的萤火号','飞船结构完整，侧翼对称，尾灯温暖发光，舱门关闭，停在地面，完整展示底部升力环'],['ship-broken','坠落后损坏的萤火号','同一艘飞船，左侧翼片折弯，橙色装甲有擦痕，尾部检修盖打开，极少量细烟，尾灯熄灭，舱门可正常打开，主体完整，无爆炸无明火']]){
 const asset=`assets/story/ships/${id}.png`,prompt=`${common}${ship}。${detail}。三分之四侧前方全景，飞船完整入画，干净浅色背景，不出现人物，不是多格设定页。`;
 manifest.ships.push({id,asset,ratio:'4:3',prompt});guide+=`### ${title}\n\n文件：\`${asset}\` · 建议4:3\n\n\`\`\`text\n${prompt}\n\`\`\`\n\n`;
}
guide+='## 三个场景（3张）\n\n场景图用作地图背景，人物、按钮和道路标记由网页叠加。保持中部明亮、细节简洁，不要在图里画关卡按钮。三个地方都必须保留深渊岩壁，让人看出它们位于同一个世界的不同高度。\n\n';
for(const c of D.chapters){
 const prompt=`${common}${c.scene}。环境全景概念插画，横向16:9，前中远景层次明确，岩壁和建筑集中在画面两侧与远处，中间留出清楚开阔的可行走平台，留出可叠加界面的空间，没有人物，没有飞船，没有文字，没有关卡按钮。`;
 manifest.scenes.push({id:c.theme,asset:c.asset,ratio:'16:9',prompt});guide+=`### ${c.name}\n\n文件：\`${c.asset}\`\n\n\`\`\`text\n${prompt}\n\`\`\`\n\n`;
}
guide+='## 游玩背景（另做3张）\n\n这是消除方块后面的背景，必须比地图图更简洁。六色方块由游戏实时渲染，不需要海艺生成纹理，已改成奶油色星形印记、柔和色块和细描边的卡通质感。\n\n';
for(const c of D.chapters){
 const asset=`assets/story/scenes/play-${c.theme}.png`,prompt=`${common}${c.scene}。用于3D消除游戏背后的2D环境背景，横向16:9。景物集中在最左侧、最右侧和远处下方，画面中央60%保持大面积明亮、柔和、低细节的浅色空间，没有物体遮挡中央，不出现前景栏杆，不出现棋盘或任何方块。背景比角色插画更低饱和、低对比，避免鲜艳的红紫绿蓝黄粉色小斑点，以免和六色消除块混淆。没有人物、飞船、文字、按钮，天空和岩壁保留轻微水彩与纸张纹理。`;
 manifest.gameplay.push({id:c.theme,asset,ratio:'16:9',prompt});guide+=`### ${c.name} · 游戏内背景\n\n文件：\`${asset}\`\n\n\`\`\`text\n${prompt}\n\`\`\`\n\n`;
}
guide+='## 可选角色三视图\n\n用于检查衣服和轮廓，不直接显示在游戏中。给每位角色使用对应定稿作为参考，保留同一个模型/风格。\n\n```text\n[统一风格词]，[该角色完整外貌描述]。角色服装结构参考页，正面、侧面、背面三个全身视角，三个人像为同一个角色的不同角度，等比例站立，轮廓清楚，纯浅色背景，不写标签，不加入其他人物，不更改服装与发色。\n```\n\n这里三视图是反向词“多视角混在同一画面”的例外，请移除该条及“重复人物”。保存到 assets/story/references/<角色ID>-sheet.png。\n\n## 分镜生成与验收\n\n逐格完整提示词见 [海艺AI-逐镜提示词.md](海艺AI-逐镜提示词.md)。角色ID/文件名与本文件一致。先做 opening-01 至 opening-06，确认主角和飞船一致后再批量做后续。\n\n验收：人物没有换脸或换衣；场景所在高度正确；飞船损坏/修复状态正确；人数与分镜一致；对白不用出现在图片里；手机居中裁切后仍能看懂主要动作；leave-06 必须是没有飞船和人物的空出口。\n\n## 交给游戏的方法\n\n将PNG放到指定目录，刷新 index.html。想改变文件格式或路径时，同时修改 js/journey-data.js 的 asset 字段。不要在导出的提示词文档里改路径代替代码修改。运行 node scripts/export-story.cjs 会从剧情数据重新生成本指南和分镜清单。\n';
let panels='# 海艺 AI · 全部分镜提示词\n\n每一格是一张独立图片。以下均为完整正向提示词；通用反向词见素材制作指南。\n对白由游戏显示，仅供理解，不要画进图片。人物外形以已定稿角色参考图为准。\n\n';
let script='# 星隙几何 · 完整剧情分镜\n\n状态：剧情脚本完成，正式插画待海艺生成。\n\n';
for(const s of Object.values(D.stories)){
 panels+=`## ${s.id} · ${s.title}\n\n`;script+=`## ${s.title}（${s.id}）\n\n场地：${D.chapters[s.scene].name}\n\n`;
 s.panels.forEach((p,i)=>{
  const cast=p.cast.map(id=>`${D.characters[id].name}：${D.characters[id].look}`).join('；');
  const shipHere=/飞船|萤火号|驾驶舱|船舱|船尾|翼片|引擎/.test(p.shot)&&!(s.id==='leave'&&i===5)&&!(s.id==='if-life'&&i===0);
  const broken=(s.id==='opening'&&i>=2)||(/^main-0[1-4]$/.test(s.id));
  const prompt=`${common}单张漫画分镜插画，不是拼图。本格所在环境：${p.environment||D.chapters[s.scene].scene}。本格画面：${p.shot}。${cast?`本格人物及固定外形：${cast}。严格区分服装与发色，不把不同人物合并。`:'空镜，不出现人物。'}${shipHere?`${ship}。${broken?'飞船处于损坏状态，左翼折弯，装甲擦痕，尾灯熄灭；坠落镜头只有少量细烟，无爆炸。':'飞船处于修复完好状态，尾灯金色发光。'}`:''}${s.id==='leave'&&i===5?'出口泊位完全空着，绝对没有飞船，没有人物，只剩风吹白花和旗帜。':''}横向16:9，主要动作与主要人物位于中央60%区域，景别按分镜描述，手部与道具关系清楚，画面底部不要写字，角色和飞船必须与参考图保持一致。`;
  manifest.panels.push({story:s.id,index:i+1,asset:p.asset,cast:p.cast,ratio:'16:9',prompt});
  panels+=`### 第 ${i+1} 格\n\n文件：\`${p.asset}\`\n\n参考：${p.cast.map(id=>D.characters[id].name+'（'+id+'.png）').join('、')||'场景图，无人物'}${shipHere?'；'+(broken?'ship-broken.png':'ship-repaired.png'):''}\n\n对白（不要生成在图片上）：**${p.speaker}：${p.text}**\n\n\`\`\`text\n${prompt}\n\`\`\`\n\n`;
  script+=`### ${i+1}. ${p.shot}\n\n人物：${p.cast.map(id=>D.characters[id].name).join('、')||'无'}\n\n**${p.speaker}：** ${p.text}\n\n图片：\`${p.asset}\`；动态：${p.motion}\n\n`;
 });
}
for(const dir of ['characters','scenes','ships','panels','references'])fs.mkdirSync(path.join(root,'assets/story',dir),{recursive:true});
for(const [file,body] of [['docs/海艺AI-素材制作指南.md',guide],['docs/海艺AI-逐镜提示词.md',panels],['docs/完整剧情分镜.md',script],['assets/story/manifest.json',JSON.stringify(manifest,null,2)]])fs.writeFileSync(path.join(root,file),body,'utf8');
console.log(JSON.stringify({characters:manifest.characters.length,ships:manifest.ships.length,scenes:manifest.scenes.length,gameplay:manifest.gameplay.length,stories:Object.keys(D.stories).length,panels:manifest.panels.length}));

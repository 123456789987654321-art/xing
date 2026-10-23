# 星隙几何 · 已确认设计

基于 F:/F-P/game 的原生 JS/WebGL 游戏，在独立工作区 F:/F-P/gamess 制作。保留原版。

小航驾驶萤火号坠入友善、阳光的深渊，船损坏。萤灯谷居民阿芽、团团救助他并修船；风轮镇的风铃、铜伯帮助恢复上升动力；映光庭的阿镜、露婆婆帮助点亮出口。拾荒客灰翎与两只机械鸟制造麻烦，随后用行动弥补。

主线三章各五关：普通、旋转、视角。每章尺寸5至9。每关独立计分，达到目标且结算结束才通关。初始只有第一关可用。完成小关回地图、播放3至5格故事，再移动主角并亮起下一关。章节完成播放6至8格飞船过场；最终所有朋友送行。选择离开播放飞船离开，停留空出口，提供“假设他留下来的生活”；选择留下或进入IF线解锁创造模式。创造模式复用11个挑战关，逐关解锁，无分数目标，保留任务失败条件，每关生活故事。

2D彩色日系漫画剧情与场景，3D消除保留。开场、旅行、结局6至8格，逐格阅读；已看可跳过/回看。存档隔离于旧版本，刷新可继续未完剧情。手机与桌面、键盘、减少动态效果均支持。

用户后续决定：本次先实现流程和分镜脚本；图片由用户在海艺AI生成。提供统一角色、场景、飞船提示词和逐镜提示词/文件名。缺图位置明确显示待绘分镜说明，不冒充正式漫画成品。

实施选择：独立 journey 模块适配已有引擎，不重写消除算法。目标以尺寸独立计算，章节不叠加分数。新旧存档不迁移，避免旧记录直接解锁。通过结算后保存待播队列，已看故事只回放不产生解锁副作用。

## Confirmed addition
User also requested gameplay background and block appearance changes. Added game-theme.css, distinct chapter atmosphere, real-time warm cartoon material and palette. Background prompts include three low-detail gameplay variants (play-valley.png, play-wind.png, play-light.png) with clear central space. This does not change matching, collision or gravity rules.

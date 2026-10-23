# 生成素材

使用内置 imagegen 工具生成，非 CLI。原图保存在 `assets/source/`，游戏素材保存在 `public/assets/`。`scripts/prepare-assets.mjs` 仅负责 Sprite 切片、缩放与 WebP 编码，保留透明通道。

## 主角与投射物帧动画

完整生成提示词保存在 `assets/source/animation-prompts.json`，使用内置 imagegen，主角两套图集以 `public/assets/hero.png` 为人物造型参考。

- `hero-walk.png`：6 列 × 8 行，48 帧；每行一个方向，顺序为东、东南、南、西南、西、西北、北、东北。左右腿交替、手臂摆动。
- `hero-attack.png`：4 列 × 8 行，32 帧；同样的方向顺序，每行依次为蓄势、出手、随动、收势。
- `projectiles.png`：6 列 × 3 行，18 帧；三行依次为皮搋子、薄荷绿友方能量弹、珊瑚橙敌方能量弹。

运行 `node scripts/prepare-animation-assets.mjs` 将原图按透明轮廓提取，去掉邻帧碎片、统一比例和脚底锚点，保留透明通道并无损压缩为 `public/assets/` 下的同名 WebP 图集。攻击动作按完整人物轮廓提取，不会被等分网格截断手臂。主角帧大小为 256×256，投射物为 96×96；布局信息保存在 `assets/source/animation-layout.json`。动画在 Phaser Sprite 上逐帧播放，绳索和飞行拖尾由 Phaser Graphics 绘制。

## 城市地图

当前游戏使用内置 imagegen 基于原图 `assets/source/city.png` 的六个 724×362 裁片重绘高清细节。最终源图为 `assets/source/city-hd-{west,central,east}-{top,bottom}.png`，每块原生 1774×887，总像素为 5322×1774。裁片参数与输出尺寸见 `assets/source/city-hd-prompts.json`；保持原道路、路口、建筑轮廓和俯视构图，仅提高瓦片、砖缝、路缘及路面纹理的清晰度。

运行 `node scripts/prepare-map-assets.mjs` 生成六张 `public/assets/city-{west,central,east}-{top,bottom}.webp`，质量 94，不放大生成图。编码时以原图的连续像素锁定内部共享边缘，再在 40 像素内平滑过渡到高清细节，避免独立重绘的接缝。Phaser 按 3×2 网格铺满原 5400×1800 世界，不改变相机、碰撞或动画时序。低分辨率 `city.webp` 已停止发布。

原始地图提示词：

Use case: stylized-concept. Asset type: production background map for a TOP-DOWN 2D action videogame. Create an extremely wide 3:1 landscape, ideally 3072x1024. Orthographic bird's-eye view straight down, no isometric horizon. A richly illustrated small Chinese city neighborhood at golden evening, hand-painted indie game art with crisp ink outlines, muted sage green and petrol teal tiled rooftops, warm cream concrete sidewalks, charcoal gray asphalt, golden street lamps, small shop awnings, potted plants, parked scooters and compact cars, roof AC units. Precise playable layout: one completely clear WIDE horizontal main avenue across the entire image centered at y=512, asphalt from y=365 to y=659, sidewalks outside. Three perpendicular open streets cross at x=512,1536,2560, each about 180 px wide, extending top to bottom. Buildings occupy ONLY the rectangular blocks between streets. White zebra crossings at the intersections, dashed worn center lane markings. Large readable shapes, charming detail, subtly distressed screenprint textures, limited warm color palette. No characters or monsters, no HUD, NO readable text, no lettering, no frame. This is the actual tiled background in a game so the clear streets must remain navigable and unblocked, main road horizontally continuous from left edge to right edge.

## 人物 Sprite Sheet（透明背景）

Use case: stylized-concept. Asset type: four-character game sprite sheet with ACTUAL transparent background alpha. A wide horizontal sheet divided into exactly FOUR equal square cells, all 4 characters separated with generous empty margin, no frames, NO text. Consistent hand-painted 2D indie game art, strong ink outlines and warm desaturated colors matching a Chinese city street at dusk. Camera strict steep overhead / top-down 3/4 like Enter the Gungeon, characters' heads visible from above, face toward bottom of canvas. Cell 1 left: a sturdy middle-aged Chinese plumber man, short dark hair, mustard yellow work vest over a cream shirt, dark petrol trousers, red rubber plunger in hand with a coiled rope, scruffy charming heroic. Cell 2: fictional humanoid SHADOW MONSTER with charcoal-black tar skin, glowing tiny coral eyes, bulky muscular arms with claw hands, hunched melee brute, clearly non-human with no realistic racial features. Cell 3: slender fictional humanoid SHADOW MONSTER with charcoal black tar skin, glowing tiny mint eyes, angular shoulders, carrying a luminous jade green organic energy orb, ranged attacker, clearly inhuman. Cell 4 right: giant elite fictional shadow humanoid, charcoal tar skin, branching orange glowing fissures, wide shoulders, orange eyes, powerful fists. Each character centered in its equal cell, full body fits cell, feet at same baseline. No cast ground shadows, transparent empty space, no scenery, no floor, no labels, no UI. Bold readable silhouettes at small size, textured cel shading, professional game asset.

## 怪物动作图集

使用内置 imagegen 生成，提示词与方向布局保存于 `assets/source/monster-animation-prompts.json`，造型参考既有近战/远程怪物。近战图集重新生成了一轮以扩大姿势间的透明留白，避免攻击手臂接触相邻帧。

- `assets/source/monster-melee.png`：近战暗影怪，八行对应东、东南、南、西南、西、西北、北、东北；每行前四列为行走循环，后四列为挥爪攻击。
- `assets/source/monster-ranged.png`：远程暗影怪，方向和列布局相同，攻击为聚能、蓄势、前伸施法、收势。
- `node scripts/prepare-animation-assets.mjs` 同时处理怪物图集，按完整透明连通轮廓提取每帧，统一角色比例与脚底锚点，输出 `public/assets/monster-melee.webp` 和 `public/assets/monster-ranged.webp`；每帧 256×256，每张 2048×2048，共 128 帧。原图和最终 WebP 均保存在项目中。

青蓝/珊瑚红阵营描边与覆盖色、地面圆环/菱形、攻击弧线和受击光圈均在 Phaser 中绘制，不烘焙到图集。普通近战/远程怪物及其僚机共享两套动作图集；震地精英使用下文的独立图集，并通过体型、血条和等级与先破甲的标签区分。

Phaser WebGL 模式直接使用 tint；Canvas 回退模式在运行时缓存半分辨率纯色透明蒙版，保持阵营覆盖色与受击闪白一致，不增加下载资源。

## 震地精英动作图集

使用内置 imagegen 生成，以 `public/assets/elite.png` 为造型参考，提示词完整保存在 `assets/source/elite-animation-prompt.json`。新原图为 `assets/source/monster-elite.png`，处理后的部署图集为 `public/assets/monster-elite.webp`，每帧 256×256，8 列 × 8 行，共 64 帧。方向行顺序与普通怪物一致；每行前四列为行走，后四列依次为蓄力、双拳举过头顶、落拳砸地、收招。

`eliteSlamPose` 按技能模拟时间选帧并连续计算抬升、拉伸、落地压缩与衰减回弹。地面固定红圈、倒计时扇形、收缩提示圈、冲击波、裂纹和尘屑由 Phaser Graphics 动态绘制；角色图集不包含地面和粒子，因此预警能与实际范围精确对应，暂停和升级时保持同步。Canvas 模式沿用运行时透明蒙版以保持阵营颜色和受击闪白一致。

精英退化时复用已有精英和普通近战图集，通过 `devolutionPose` 计算 0.65 秒的残影散开、角色缩放与渐显，不新增位图。过渡和 3.2 秒捕获保护均由模型时间驱动；重开、捕获和移除时销毁临时残影与标签。

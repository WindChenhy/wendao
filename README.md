# 问道

文字修仙养成游戏 · 网页快速迭代版。

> **当前版本 v1.5.1**（`package.json`）· 存档格式 `saveVersion = 18`（浏览器 localStorage，AES 密文）· 平台：网页（Vite）+ Android（Capacitor 8）

从练气一层修到飞升，九境十二道途、宗门秘境、炼丹炼器、道侣灵兽、转生道痕一条龙。
玩法是**回合制文字养成**：时间 / 打坐 / 闭关推进修炼，历练与秘境打怪，洞府百艺生产，转生叠加永久加成。

## 技术栈

| 层 | 选型 |
|---|---|
| 前端框架 | React 19 + TypeScript 6 |
| 构建 | Vite 8（`vendor-react` / `vendor-crypto` 手工分包） |
| 状态 | Zustand 5（按领域切 slices） |
| 样式 | Tailwind CSS 4（`@tailwindcss/vite`） |
| 移动壳 | Capacitor 8（`android/` 工程，appId `com.wendao.app`） |
| 质量 | Vitest 4（node 环境单测）+ oxlint（静态检查） |

## 快速开始

要求 Node 22+（CI 使用 Node 22）。

```bash
npm install
npm run dev      # 本地开发（Vite，默认 http://localhost:5173）
npm run build    # tsc -b + vite build，产物在 dist/
npm run preview  # 预览构建产物
npm test         # Vitest 单元测试（一次运行）
npm run lint     # oxlint 静态检查
```

CI（`.github/workflows/ci.yml`）在 push 到 `main` / `v1.3` 与所有 PR 上依次执行 `lint → test → build`。

## 移动端（Android / Capacitor）

源码即网页，`android/` 只是 Capacitor 壳工程。可用脚本：

```bash
npm run cap:sync    # vite build + cap sync android（同步 Web 资源到壳工程）
npm run android:run # 连接设备/模拟器直接运行
npm run android:apk # cap:sync + gradlew assembleDebug（调试包）
```

若 `cap sync` 在资源清理步骤失败（本机 Windows 曾出现回收站删除报错），可先 `npm run build`，再手工同步：

```bash
rm -rf android/app/src/main/assets/public && cp -r dist/. android/app/src/main/assets/public/
```

正式包需签名：`cd android && ./gradlew assembleRelease`。签名配置见 [app/build.gradle](./android/app/build.gradle) 的 `signingConfigs.release`，凭据取自 `android/keystore.properties`、密钥库为 `android/release-key.jks`——两者已列入 `android/.gitignore`，**切勿提交**；更换密钥将无法覆盖更新已安装的应用。

## 配置方式

| 配置 | 位置 | 说明 |
|---|---|---|
| 玩法数值 | [src/game/tuning.ts](./src/game/tuning.ts) | `TUNING`：存档版本、丹纹倍率、事件触发率（12%）、离线门槛（5 分钟）等全局魔数 |
| 内容数据 | `src/data/db/*.json` | 调数值/加内容改 JSON 即可，逻辑仍在 TS |
| 玩家设置 | localStorage `wendao-settings` | 历练/秘境「跳过战斗」、新战斗默认自动托管 |
| DLC 启停 | localStorage `wendao-dlc-enabled` | 5 个内置 DLC，纯数据合并，可在游戏内开关 |
| 调试菜单 | URL `?debug=1` 或 localStorage `wendao-debug = '1'` | 开发调试入口，默认不显示 |
| 构建/测试 | `vite.config.ts`、`vitest.config.ts`、`.oxlintrc.json` | 分包规则、单测范围（`src/**/*.test.ts`，node 环境） |

## 目录与模块结构

```
src/
├─ data/        # 数据加载与派生
│  ├─ db/*.json # 内容数据唯一事实来源
│  └─ *.ts      # 类型化加载、公式与聚合（items / gongfa / classes / realms …）
├─ game/        # 纯函数引擎层（无 React 依赖，易单测）
│  ├─ combatEngine / combatStats   # 回合制战斗与属性计算
│  ├─ breakthrough / rules/        # 突破判定、成功率装配与天劫结算
│  ├─ offline / day / lifespan     # 离线结算、日推进、寿元
│  ├─ saveCrypto / saveMigrate*    # 存档加解密、旧档迁移
│  ├─ paths / heartDemon / reputation / reincarnate / seal / bounty / farm / reward
│  ├─ artifactCraft / inventory / daily / characterRoll / settings / format / sfx
│  └─ *.test.ts                    # 引擎层单测
├─ stores/      # Zustand 状态层
│  ├─ slices/   # meta / cultivate / explore / combat / sect / abode / pet / companion / daily / inventory / path / save
│  ├─ helpers/  # 跨 slice 原语（player / progress / combat / daily / save）
│  └─ saveMigrate.ts / useGameStore.ts / useLogStore.ts
├─ panels/      # 面板层（React.lazy 分包）
├─ components/  # 通用组件（战斗面板、事件弹窗、状态栏、日志、路径面板等）
├─ platform/    # native.ts：原生壳判定与文件落地（Capacitor 按需动态 import）
└─ dlc/         # DLC 定义与内置数据包（builtin.ts）
```

约定：**业务数据只在 `src/data/db/*.json` 改，派生只在 `src/data/*.ts` 做**，勿两处写数；新增存档字段必须同步 `saveMigrate.ts` 迁移与回归测试。

面板导航共 10 项：修炼 / 人物 / 历练 / 秘境 / 背包 / 坊市 / 洞府 / 宗门 / 红尘 / 设置（图鉴与成就以章节形式内嵌，见 `CodexPanels`）。

## 游戏静态数据（`src/data/db`）

| 文件 | 内容 |
|---|---|
| `items.json` | `items`（106 条：丹药 / 材料 / 法宝 / 功法秘籍卷等）、`treasureBonus`（25 件法宝加成）、`breakthroughPills`（5 种突破丹）、`breakthroughMaterials`（8 个大境界突破灵材，键为**目标大境界**）、`marketStock`（坊市货架 pill / herb / material / treasure 四分区） |
| `gongfa.json` | 功法 103 部（品阶、起步境界、适用范围、售价、效果；仙阶 `price = 0` 不入坊市） |
| `gongfa_synergy.json` | 功法羁绊规则 |
| `skills.json` | `combatConfig`（战斗全局参数）+ 36 条技能（十二道途各 1 被动 + 2 主动） |
| `classes.json` | 道途表 12 条（剑 / 体 / 丹 / 器 / 符 / 阵 / 御兽 / 傀儡 / 医 / 音，另有魂 / 魔为禁忌之道） |
| `aptitudes.json` | 灵根 6 种（天 / 变异 / 真 / 双 / 杂 / 伪，含稀有度与突破加成） |
| `origins.json` | 出身 8 种（起始灵石与行囊差异） |
| `character_roll.json` | 创角掷卷配置（权重、每卷组合数、最大掷卷次数、卷内灵根不重复） |
| `realms.json` | 境界表（九境 + `ascended` 飞升哨兵） |
| `enemies.json` | 敌人模板 27 条（阵营 / 强度档 / 掉落偏移 / `minRealm` 门槛） |
| `secret_realms.json` | 秘境 12 座（层数 / 环境加成 / 层奖励） |
| `sects.json` | 宗门 5 门（正 3 魔 2）+ 十大职级 + 藏经阁与道途传承条目 |
| `sect_quests.json` | 宗门任务链 5 条 |
| `sect_buildings.json` | 宗门建筑 3 种（灵脉 / 丹房 / 剑冢） |
| `sect_plot_events.json` | 宗门权谋事件 5 条 |
| `tribulation.json` | 天劫冲关方案 4 种 + 三灾与心魔劫 4 类（雷 / 火 / 风 / 心魔） |
| `achievements.json` | 成就 47 条 |
| `events.json` | 事件 67 条（含事件包与 `dlcId`） |
| `codex.json` | 图鉴 6 类（境界 / 敌人 / 功法 / 物品 / 道侣 / 秘境）及集齐奖励 |
| `companion_stories.json` | 道侣长线剧情（`stories`）与隐藏道侣（`hidden`） |
| `recipes.json` | 炼丹配方 49 条（1–9 品，含五纹丹方） |
| `artifact_recipes.json` | 炼器：`qualities`（凡品 / 灵器 / 宝器 / 仙器）、`affixes`（10 条词条）、`forgeLevels`（器阁 0→3 级）、`recipes`（25 条） |
| `herbs.json` / `seeds.json` | 灵药 32 种 / 灵植种子 27 种 |
| `pets.json` | 本命灵兽 4 种 + 数值（等级/突破/亲和上限/协战/看家减损等） |
| `daily_tasks.json` | 日课与周礼包数值 |

## 术语表

全项目统一用词（旧称「职业 / 副职」已废止）：

| 术语 | 含义 | 代码落点 |
|---|---|---|
| 灵根 | 创角决定，只影响修炼速度与突破 | `db/aptitudes.json`、`player.aptitude` |
| 出身 | 创角决定，只给起始灵石与行囊 | `db/origins.json`、`player.origin` |
| 道途 | 修行道路（原「职业」），共十二条 | `db/classes.json`、`PATH_LIST` |
| 主修 | 首立之道，享全额数值 | `player.classId` |
| 兼修 | 其后所立之道，吃半数数值并占用兼修位 | `player.paths` |
| 兼修位 | 随境界扩张的兼修容量（练气 0 → 渡劫 5） | `secondarySlots(realm)` |
| 未择道 | 尚未立下任何道途 | `classId === 'none'`（`NO_PATH`） |
| 禁忌之道 | 魂道 / 魔道，以永久心魔为代价，不占兼修位 | `kind: 'forbidden'`、`isForbiddenPath` |
| 立场 | 正 / 中立 / 魔，与道途正交，由双声望推导或事件改写 | `player.alignment`、`src/game/reputation.ts` |
| 心魔 | 道心负担（0–100），压制突破、≥ 60 引动心魔劫 | `player.heartDemon`、`src/game/heartDemon.ts` |
| 百艺 / 技艺 | 谋生与生产之技（炼丹 / 炼器 / 阵法 / 灵植 / 御兽），原「副职」 | 洞府 `AbodePanel`、`db/recipes.json`、`db/artifact_recipes.json` |

**道途与百艺分层**：道途是「修行道路」（定属性倍率、技能与战斗风格），百艺是「生产技艺」（洞府丹房/器阁/灵田/聚灵阵的产出）。两者可重叠——立下丹道是道路之争，能炼丹是技艺之能。

## 核心系统

### 创角：灵根 × 出身掷卷

道号 / 性别 / 灵根 / 出身，**创角不选职业**。由 `db/character_roll.json` 加权不放回抽取：每卷随机出 4 组「灵根 × 出身」组合任选其一，最多掷卷 5 次，第 5 次后固定；卷内灵根不重复、跨卷排除已出。灵根是唯一影响长期数值的选择，出身只影响起始灵石与行囊。

### 十二道途（v1.5）

修仙为本，道途为用：道途在修行途中于「人物」页「问道」立下，立道条件由修行履历决定，且不止比次数，还要求一次质变。

- 剑道（获胜 8 次 **且** 单场剑意叠满 5 层）、体道（败北 1 次 + 获胜 6 次）、
  丹道（炼丹 8 炉 **且** 炼出过五纹丹）、器道（炼器 3 件 **且** 出过宝器以上）、
  符道（筑基 + 秘境 9 层）、阵道（筑基 + 秘境 12 层）、御兽道（获胜 6 次 + 秘境 6 层）、
  傀儡道（金丹 + 炼器 6 次 + 秘境 15 层）、医道（炼丹 5 炉 + 出过三纹丹）、音道（筑基 + 秘境 8 层）、
  魂道（金丹 + 秘境 18 层 + 耗 1 年寿元）、魔道（练气五层 + 魔道声望 30 + 血誓，正道声望 −40）。
- **主修 / 兼修**：首立之道为主修，享全额数值；其后为兼修，只吃半数属性与突破加成，且每多一门**修炼速度 −2%**。
  兼修位随境界扩张：练气 0 → 筑基 1 → 金丹 2 → 元婴 2 → 化神 3 → 炼虚 3 → 合体 4 → 大乘 4 → 渡劫/飞升 5。
- **兼修之技受压制**：兼修道途的技能解锁境界不得高于「主修境界 − 1」。
- **禁忌之道不占兼修位**：魂道 / 魔道以永久心魔为代价（立道即 +20）；心魔每 10 点压制 1% 突破成功率，≥ 60 时破关额外引动心魔劫，可用清心丹、长久闭关、洗魔事件线削减。
- **拜师传承**：宗门藏经阁列出「道途传承」，以贡献拜师立道，免去自悟履历（仍付道途自身的寿元 / 血誓代价）；元婴及以下方可拜师，化神起只能靠历练顿悟。
- **改立主修**：花灵石洗炼道基（费用随境界上浮），与兼修列表互换，代价为损当前境界满寿元 5% + 闭关 30 日。
- **立场为独立字段**：`alignment` 与道途正交，由双声望推导或被血誓 / 屠村 / 血祭 / 投案 / 洗魔等事件显式改写。
- **旧档迁移**：旧档创角所选「职业」升格为主修，兼修列表为空；v18 起补记心魔值并收敛 `alignment`（见 `saveMigrate.ts` 的 `sanitizePlayerPaths`）。

代码落点：`src/data/classes.ts`（`pathIdsOf` / `pathMults` / `playerMults` / `secondarySlots` / `isForbiddenPath`）、`src/game/paths.ts`（立道条件校验与结算，纯函数）、`src/game/heartDemon.ts`、`src/stores/slices/pathSlice.ts`、`src/components/PathPanel.tsx`。

### 坊市：买卖不限境界，境界只约束「使用」

完整口径见 `src/data/items.ts` 的 `itemUsageRealm` / `itemUsableAt` / `itemUsageHint` / `marketStock(tab)`：

- 货架分区为 `all | pill | herb | material | gongfa | treasure`，**所有在售货物一律列出，不因境界隐藏或灰锁**。
- 想买随时买、想卖随时卖；未达使用境界只影响后续环节（丹药服用药效大减、功法到境界才可参悟、突破灵材到境界才有用），UI 仅提示「需 XX 修为方可使用」。
- 功法只上架坊市秘籍（`isMarketGongfa`），宗门秘法仅藏经阁产出。

### 突破 · 天劫 · 心魔

- 修为满足即可冲关，成功率 = 境界基础率 + 灵根/道途/法宝/丹药/宗门/道侣加成，最终夹取在 5%–92%。
- 大境界突破需对应灵材 + 可选辅助丹药/法宝（含渡劫令）；冲关方案 4 种：常规 / 金丹护道 / 道侣护法 / 强行冲关。
- 失败按严重度受罚：小境界损修为与气血；大境界失败**跌落一层**；天劫严重失败（超出成功率 35 点）重伤并损失大量修为——不会直接死亡，但突破失败会累积 5 点心魔。
- 三灾与心魔劫（雷 / 火 / 风 / 心魔）各有解法道具；魔修天劫换皮为心魔劫 / 煞火焚身。
- 心魔每 10 点压制 1% 突破成功率、≥ 60 引动心魔劫，可用清心丹（−15）、闭关（−3）、洗魔事件线削减。
- 飞升为终局哨兵境界，与道消互斥。

### 战斗

回合制引擎（`src/game/combatEngine.ts`）：灵力 / 魔元、剑意 / 反伤 / 煞气 / 护盾 / 眩晕等状态；十二道途各 1 被动 + 2 主动；敌方 AI（普攻 / 技能 / 低血狂暴，镇守 BOSS 额外技能）。战斗为全屏接管，支持自动战斗与「跳过战斗」设置；历练敌人按玩家大境界动态缩放。

### 宗门

正道 3 门（青云剑宗 / 太一丹宗 / 浩天体宗）、魔道 2 门（血煞魔宫 / 幽冥鬼宗）。委托、贡献、兑换、藏经阁（高阶物资有职位 / 境界门槛）、道途传承；职级十档（杂役 → … → 宗主 → 太上长老），宗门大比走回合制技能战；权谋事件 5 条，宗门建筑灵脉 / 丹房 / 剑冢 0–5 级。

### 秘境爬塔

12 座：青云小境 / 玄冰地窟 / 熔岩火狱 / 虚空裂隙 / 灵虚仙府 / 太虚古战场 / 归墟之地 / 天劫绝域（掉渡劫令）/ 血魔渊 / 九幽鬼域 / 仙武遗墟 / 太虚仙阙。逐层挑战、镇守 BOSS，贯通全部层数后自动退出。

### 道侣与结拜

可结缘 NPC 共 14 位：女性（林婉 / 苏青 / 血梅 / 云瑶 / 白露 / 洛清漪 / 赤练 / 胡九）可结为道侣，男性（燕洛 / 顾沉 / 秦无咎 / 石敢当 / 墨尘 / 沈孤舟）义结金兰结拜为兄弟，另有隐藏道侣玄灵（高境界 + 特殊事件解锁）。互动为闲谈 / 赠礼 / 心事件 / 双修 / 结缘：每人每日闲谈前 3 次加好感、收礼至多 2 次（超出婉拒）；道侣可有多位（灵石 200），结拜消耗灵石 100。主位道侣提供修炼加成与秘境助战，突破护法取所有结缘对象中最优加成；道侣可代劳（托付灵田、代炼低阶丹，每日一次）。结缘后按 `db/companion_stories.json` 推进多幕长线剧情（含 HE / BE），正魔之恋判定走 `isCrossAlignment`。

### 洞府 · 百艺 · 聚灵阵

- **灵田**：桃源式网格（6×6 = 36 格 → 可开拓至 16×8 = 128 格），一键播种 / 收获，灵植按阶产出灵药，旧档自动迁移。
- **丹房**：炼丹配方 49 条（1–9 品，含五纹丹方），产出丹药带丹纹，纹数越高药效越强。
- **器阁**：炼器配方 25 条、品质凡品 / 灵器 / 宝器 / 仙器（0–3 条词条），器阁等级 0→3 决定成功率与品质上限；成品可认主出战、洗练、分解。
- **聚灵阵**：0→3 重，每重修炼与离线收益 +5%，可自定义数额捐献灵石入池。

### 本命灵兽

筑基后历练或天象事件触发「灵兽认主」四选一（云月山兔 / 青羽云雀 / 玄纹石龟 / 赤瞳灵狐）。灵兽栏支持喂食、升级、突破、灵田协助、看家、改名、放生；出战提供属性加成（封顶 10%）与协战辅助技，看家减损 20%，灵田跨日自动收获；捕捉含连续失败软保底（`petCaptureFails`）。

### 转生 · 道痕 · 封印

转生永久累积道痕（境界 / 寿龄 / 道侣 / 飞升 / 仙缘折算），提供修炼速度、突破加成、起始灵石与气血加成（`src/game/reincarnate.ts`）。成就在单世有 20 点道痕软上限，超出部分折算灵石。转生封印传承物上限 3 槽（随道痕里程碑按每 120 点解锁一槽，封印宝器以上需额外道痕）。

### 图鉴 · 成就 · 日课

天道图鉴 6 类（境界 / 敌人 / 功法 / 物品 / 道侣 / 秘境）+ 集齐进度发奖；成就 47 条，跨转生保留；日课与周礼包构成日常留存循环。

### 离线修炼

离线 ≥ 5 分钟回游戏弹「闭关归来」结算，时长上限随境界从 8h 增至 48h；只涨修为、不自动突破，并防改系统时间。`GameLayout` 每 60 秒刷新在线心跳，避免长时间只做历练 / 炼丹时在线时段被误算为离线收益。

## 存档与本地存储

| 键 | 用途 |
|---|---|
| `wendao-slot-1` / `-2` / `-3` | 三个存档槽位 |
| `wendao-settings` | 玩家设置 |
| `wendao-dlc-enabled` | 已启用的 DLC id 列表 |
| `wendao-debug` | 调试菜单开关 |

- 槽位内容为 AES 密文（v2 信封带 SHA-256 完整性校验段，旧格式仍可解密），手改即失效。
- 读档前经最小 schema 校验（数值收敛、`player` 存在性与时间字段合法性），防损坏档 NaN 传播。
- 支持导入 / 导出 `.wdsave`；导出文件名形如 `存档_道号_转生N次_本世第Y年M月D日.wdsave`，Android 壳内改走应用目录 + 系统分享（`src/platform/native.ts`）。

## 版本沿革

| 版本 | saveVersion | 核心变更 |
|---|---|---|
| **v1.5.1** | 18 | 道途系统收尾（十二道途 / 立道质变 / 拜师传承）、心魔值 + 独立立场字段；内容合理性修正与数值拍板 |
| **v1.5** | 16 → 17 | 创角改「灵根 × 出身」随机掷卷、道途取代职业、主修 / 兼修体系、魔道 = 立场 + 道途 |
| **v1.4** | — | 日常留存循环（日课 / 周礼包）、魔修差异化、飞升终局、DLC 内容化 |
| **v1.3** | — | 内容扩充（练气 → 飞升）、功法 89 → 103、秘境 8 → 12、法宝与炼器配方扩充、聚灵阵、存档 v2 信封 |
| v1.2 及更早 | — | 本命灵兽、洞府与百艺、宗门建筑与贡献池、离线修炼、天道图鉴与成就、炼器词条、功法羁绊、转生封印 |

`docs/` 目录存放本地设计稿与代码审查报告，默认不纳入 git 提交，不随仓库分发。

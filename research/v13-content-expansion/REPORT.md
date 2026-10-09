# v1.3→v1.4 内容扩充调研报告（功法/丹药/秘境/敌对势力怪物/法宝/灵药）

> 本报告是后续数据生成代理的**唯一契约**。所有结论均可按 `file:line` 复核。
> 调研基准：commit 工作区（2026-09-27，saveVersion 15，`src/game/tuning.ts:4`）。
> 范围：只读调研；本报告不修改 `src/` 任何文件。
>
> 一手材料清单（均已完整读取）：
> - 类型与加载：`src/types/index.ts`、`src/data/gongfa.ts`、`src/data/items.ts`、`src/data/abode.ts`、`src/data/enemies.ts`、`src/data/secretRealms.ts`、`src/data/realms.ts`、`src/data/gongfaSynergy.ts`、`src/data/sects.ts`、`src/data/codex.ts`、`src/data/artifacts.ts`
> - 数据：`src/data/db/gongfa.json`、`items.json`、`herbs.json`、`seeds.json`、`recipes.json`、`enemies.json`、`secret_realms.json`、`gongfa_synergy.json`、`artifact_recipes.json`、`realms.json`、`codex.json`、`sects.json`
> - 消费逻辑：`src/game/combatStats.ts`、`src/game/offline.ts`、`src/game/farm.ts`、`src/game/inventory.ts`、`src/game/tuning.ts`、`src/stores/slices/inventorySlice.ts`、`src/stores/slices/abodeSlice.ts`、`src/stores/slices/exploreSlice.ts`、`src/stores/helpers/combat.ts`、`src/stores/helpers/player.ts`、`src/panels/MarketPanel.tsx`、`src/panels/SecretRealmPanel.tsx`
> - 文档与测试：`README.md`、`docs/修仙养成游戏方案.md`、`src/data/items.gongfa.test.ts`、`src/data/sectBuildings.test.ts`
>
> 注：任务描述中的「src/game/enemies 缩放逻辑」实际位于 `src/data/enemies.ts`（`scaleEnemyToPlayer`，src/data/enemies.ts:64-101）；`src/game/` 下无 enemies 模块。

---

## A. 六类数据的 Schema 契约

### A.0 全局枚举（各类共用）

| 枚举 | 取值 | 出处 |
|---|---|---|
| `RealmId`（10 大境界，索引 0→9） | `qi 练气 / foundation 筑基 / golden_core 金丹 / nascent_soul 元婴 / spirit_sea 化神 / void 炼虚 / integration 合体 / mahayana 大乘 / tribulation 渡劫 / ascended 飞升` | src/types/index.ts:14-24；REALM_ORDER src/data/realms.ts:7-18 |
| `Faction`（敌人阵营） | `righteous（修士/正道）/ demonic（魔修）/ beast（妖兽）/ abomination（异类）` | src/types/index.ts:12；文案映射 src/data/enemies.ts:134-139 |
| 敌人 tier | `minion 杂兵 / normal 寻常 / elite 精英 / boss 头目` | src/data/enemies.ts:5、141-146 |
| 境界层数 | 练气→大乘各 9 层，渡劫 3 层，飞升 1 层 | src/data/db/realms.json:2-81 |

### A.1 功法 GongfaDef（`src/data/db/gongfa.json`，数组）

字段契约（src/data/gongfa.ts:14-28）：

| 字段 | 类型 | 必填 | 取值域/语义 |
|---|---|---|---|
| `id` | string | 是 | 前缀惯例：坊市功法 `gf_*`；宗门秘法 `js_*(青云)/ty_*(太一)/ht_*(浩天)/xs_*(血煞)/ym_*(幽冥)`。前缀决定羁绊「脉系」（src/data/gongfaSynergy.ts:32-39），未知前缀一律按 wandering（市井）计 |
| `name` | string | 是 | 2-6 字修仙风格名 |
| `grade` | `'黄阶'\|'玄阶'\|'地阶'\|'天阶'\|'仙阶'` | 是 | 品阶序 src/data/gongfa.ts:31；**仙阶当前 0 部**，特例规则见下 |
| `kind` | `'心法'\|'攻击法诀'\|'防御法'\|'身法'\|'锻体法'\|'功法'` | 是 | src/data/gongfa.ts:9；kind 参与羁绊 kind_count（gongfa_synergy.json:13-38） |
| `desc` | string | 是 | 一句半文半白风味（对照 gongfa.json 全部条目） |
| `minRealm` | RealmId | 是 | 起步大境界门槛（gongfa.ts:20-21） |
| `maxRealm` | RealmId | 否 | 适用范围上限，超出后**加成完全失效**（gongfa.ts:96-100）。现有 89 部中 22 部无此字段（不限） |
| `price` | number | 是 | 坊市秘籍售价；**0 = 宗门秘法**（不生成秘籍物品、不可出售，src/data/gongfa.ts:131-134、src/stores/slices/inventorySlice.ts:183-188），只能从 `sects.json` 藏经阁贡献参悟 |
| `effect` | `{atk?,def?,hp?,cultivate?,dodge?}` | 是 | **比例值（0-1）**，圆满×1.5、小成×0.75、入门×0.5（GONGFA_STAGE_MUL src/data/gongfa.ts:51）。各字段语义：atk/def/hp 为面板乘区，cultivate 为修炼倍率，dodge 为受伤降低（加算） |

品阶硬规则（生成代理必须遵守）：
1. 品阶可见性随境界收紧：元婴以下天地玄黄；元婴以上天地玄；炼虚以上天地；**大乘及以上仅天阶**（`gongfaGradesAllowed` src/data/gongfa.ts:76-85，测试断言 src/data/items.gongfa.test.ts:48-53）。
2. 仙阶特例：仅大乘及以上可参悟（`gongfaGradeOk` src/data/gongfa.ts:88-94），注释定位为「传世仙经…不走坊市常规筛选」（gongfa.ts:71-75）。**但注意**：坊市上架列表实际无品阶过滤（`MARKET_STOCK.gongfa` = 全部 `price>0` 功法，src/data/items.ts:186-192；MarketPanel.tsx:39-47 也无 grade 过滤），而仙阶不属于任何宗门、price=0 将导致**无任何获取途径**。因此本报告的仙阶设计采用 `price>0` 高价上架（见 D.1 与 E.4）。
3. 参悟校验用 `canLearnGongfaFull`（起步境界+品阶双门槛，src/data/gongfa.ts:110-112；消费点 inventorySlice.ts:131）。
4. 功法秘籍物品由功法表**自动派生**（id=`scroll_{gongfaId}`，name=`{name}·秘籍`，type='quest'，src/data/items.ts:17-29）——**不要**在 items.json 里手写秘籍。
5. 进阶消耗由品阶决定（GONGFA_GRADE_ADVANCE_BASE 黄200/玄800/地3000/天10000/仙40000 × 阶段倍率 1/3/6，gongfa.ts:41-59），无需为每部功法配置。

### A.2 丹药 ItemDef（`items.json` 顶层 `items` 数组中 `pill_*` 条目）

字段契约（src/types/index.ts:71-100）：

| 字段 | 类型 | 必填 | 语义 |
|---|---|---|---|
| `id` | string | 是 | 前缀 `pill_`（分类判定 src/data/items.ts:35-42）。多纹变体后缀惯例：`_w3` 三纹、`_w5` 五纹 |
| `name` | string | 是 | `XXX·N纹` 命名（对照 items.json 现有条目） |
| `type` | `'consumable'` | 是 | 丹药一律 consumable（items.json 全部 pill_*） |
| `desc` | string | 是 | 首句惯例「N品丹·N纹。」+ 功效风味 |
| `price` | number | 是 | 坊市售价；exp 丹惯例 price ≈ effect.exp（见 C.1） |
| `effect` | `{hp?,exp?,stone?,energy?,breakthroughRate?,special?}` | 是 | 定值效果；`special: 'full_heal'\|'cleanse'`（types/index.ts:85-86）。**只含 breakthroughRate 的丹不可手动服用**，冲击壁垒时自动消耗（inventorySlice.ts:50-54） |
| `pillGrade` | 1-9 | 是 | 品阶（对应大境界） |
| `danMarks` | 0-5 | 是 | 丹纹；效果 = 基础 × (1 + marks×0.15)，5 纹 1.75×（src/data/items.ts:60-63，TUNING.danMarkPerStack src/game/tuning.ts:5） |
| `minRealm` | RealmId | 建议填 | 可服用起步境界（inventorySlice.ts:56-60 强制） |
| `maxRealm` | RealmId | 否 | 超范围仍可用但药效 ×0.25（`overScopeEfficiency`，tuning.ts:6；消费 inventorySlice.ts:61-68） |

注意事项：
- `effect.breakthroughRate` 丹的自动选药池是 items.json 的 `breakthroughPills` 硬编码数组（items.json:1299-1320；消费 src/data/items.ts:117、151-161）——新增突破丹需同步追加；本次设计**不新增**突破丹（6/10/15/20/25 五档已全）。
- `pill_qi*` 系列 exp 走动态公式 `pillExp(realm, grade, marks)`（inventorySlice.ts:89-92 特判；公式 src/data/items.ts:178-184），其余丹药 exp 为定值——新丹按定值设计。
- `cultivate` 等字段不在 ItemDef.effect 白名单内，写了无效。

### A.3 灵药 ItemDef（`db/herbs.json` 数组）

- 与丹药同一 `ItemDef` 结构，但 `type: 'material'`、`herbTier: 1-9`（types/index.ts:92-94；展示「N阶灵物」src/data/items.ts:90）。
- 加载路径：`HERB_ITEMS` ← herbs.json（src/data/abode.ts:43）；`ITEMS = {...HERB_ITEMS, ...dbItems}`（src/data/items.ts:14-16）——**同名 id 以 items.json 为准**。现状 items.json:1020-1145 重复定义了 10 株 herbs.json 已有的灵药（herb_spiritgrass/herb_frost/herb_flame/herb_cloud/herb_ghoul/herb_auroraleaf/herb_thunder/herb_iceheart/herb_goldlotus/herb_starcore）。**新增灵药只写 herbs.json，避免再增重复**。
- 部分旧妖材不在 `herb_` 前缀内，由硬编码名单纳入 herb 分类：`snake_gall/fox_core/tiger_bone/demon_shard`（src/data/items.ts:120-122）。新灵药请统一用 `herb_` 前缀。
- 坊市灵药货架 = items.json `marketStock.herb`（items.json:1389-1430）；新灵药需手动加入才上架。
- **herb_ 条目不进天道图鉴**（图鉴 item 页只收 `pill_*`/treasure 分类/`mat_*`，src/data/codex.ts:69-84）。

### A.4 种子 SeedDef（`db/seeds.json` 数组）

契约（src/data/abode.ts:6-18）：

| 字段 | 类型 | 语义 |
|---|---|---|
| `id` | string | 惯例前缀 `seed_`；种子**也是背包物品但不在 ITEMS 里**——购买走 `abodeSlice.buySeed`（src/stores/slices/abodeSlice.ts:61-66，按 `seedPrice` 扣灵石），仅限洞府灵田 UI 购买（AbodePanel.tsx:225-233），不进坊市 |
| `name` | string | `XXX种/苗/核` |
| `desc` | string | 惯例以「N阶。」结尾 |
| `growDays` | number | 成熟所需游戏日（farm.ts:73-91） |
| `yieldItemId` | string | **必须是已存在的灵药 id**（收获直接 addItem 该灵药） |
| `yieldMin/yieldMax` | number | 收获数量区间（farm.ts:87-91，闭区间随机） |
| `seedPrice` | number | 现值 ≈ 灵药价 × 0.7-0.83（见 C.3） |

### A.5 丹方 RecipeDef（`db/recipes.json` 数组）

契约（src/data/abode.ts:20-31）：

| 字段 | 语义 |
|---|---|
| `id` | 惯例前缀 `craft_` |
| `inputs` | `{itemId,count}[]`；itemId 必须存在于 ITEMS（herbs.json/ items.json 均可），1-3 项、单项 1-6 个（现有 31 条区间） |
| `outputItemId/outputCount` | 产物与数量；产物必须存在于 ITEMS |
| `craftDays` | 炼制耗时 1-14 日（现有区间） |
| `baseRate` | 基础成功率 %；实际成功率 = baseRate + 丹修 12 + 道痕/20，**clamp 20-98**（src/game/farm.ts:93-99） |

### A.6 敌人模板 EnemyTemplate（`db/enemies.json` 数组）

契约（src/data/enemies.ts:7-19）：

| 字段 | 类型 | 语义 |
|---|---|---|
| `id` | string | 无统一前缀（现有：wolf/snake/demon_*/boss_*）。**硬约束：任何模板 id 不得是另一模板 id 的前缀**——实战敌人 id 为 `{template}_{realm}_{layer}`（enemies.ts:85），图鉴回溯用前缀匹配 `enemyId === t.id \|\| enemyId.startsWith(t.id + '_')`（enemies.ts:128-132），前缀冲突会记错图鉴 |
| `name` | string | 3-5 字 |
| `faction` | Faction | 见 A.0。声望影响：杀 demonic 正+8/魔-12、beast 正+3、righteous 正+0/魔+4（src/game/combatStats.ts:109-113） |
| `tier` | minion/normal/elite/boss | 决定遭遇概率池与 layer 偏移/掉落倍率（enemies.ts:68、78、108-112） |
| `power` | number | 相对同境界无加成玩家的强度系数；现有区间 minion 0.62-0.7 / normal 0.78-0.9 / elite 1.02-1.08 / boss 1.4-1.6 |
| `matOffset` | 0\|1 | 掉落材料相对玩家境界的偏移：0=当前境、1=下一境（enemies.ts:15-17、42-58）。惯例：boss/elite=1，minion/normal=0 |
| `dropRate` | number | 可选；默认 minion 0.05、其余 0.2（enemies.ts:97）；显式覆盖值区间 0.3-0.7 |
| `flavor` | string | 一句风味，直接进图鉴（codex.ts:55-61） |

要点：**模板不写 atk/def/hp**——实战数值按玩家大境界动态缩放（见 C.5）；模板也不写掉落 itemId（由 `matForRealmOffset` 派生，enemies.ts:42-58），图鉴按模板 id 记录。

### A.7 秘境 SecretRealmDef（`db/secret_realms.json` 数组）

契约（src/data/secretRealms.ts:5-29）：

| 字段 | 类型 | 语义 |
|---|---|---|
| `id` | string | 蛇形命名（qingyun/ice_cave/…） |
| `minRealm`/`minLayer` | RealmId/number | 进入门槛（canEnterRealm secretRealms.ts:34-42） |
| `floors` | number | 总层数 30-90（现有区间） |
| `bossEvery` | number | 每 N 层一个镇守（isBossFloor secretRealms.ts:44-46），现有 10-18 |
| `env.playerHpMul` | number | 可选；环境压气血（<1），现值 0.6-1（消费 exploreSlice.ts:503） |
| `env.rewardMul` | number | 奖励倍率 1→5（随解锁境界递增） |
| `loot.stonePerFloor/expPerFloor` | number | 每层基础奖励；实际 ×`2.2^realmIndex(minRealm)` × rewardMul × 层内爬升（0.8+0.4×(ramp-1)），BOSS ×4/×3（secretRealms.ts:67-96） |
| `loot.bossItemId` | string | 镇守掉落物，**必须是已存在或本清单新定义的 item id**（dropRate 0.75，secretRealms.ts:95-96；UI 展示 SecretRealmPanel.tsx:133-135） |

要点：**秘境没有逐层敌人引用字段**——每层守卫与镇守由 `towerEnemy()` 程序生成（secretRealms.ts:53-100），数值锚定「恰好处于 minRealm 入门层的无加成玩家」（注释 secretRealms.ts:48-52）；守卫 faction 硬编码 `'beast'`（secretRealms.ts:74）。BOSS 名称自动为「{秘境名}镇守」（secretRealms.ts:71-73）。

### A.8 法宝（`items.json` 中 `treasure_*` 条目 + `treasureBonus` 表）

- 物品条目：`type: 'material'`、`treasureTier: 1-9`（types/index.ts:94-96）、`minRealm` 佩戴门槛、`price`。
- 加成表：顶层 `treasureBonus` 对象，键=物品 id，值 `{atk?,def?,hp?,breakthrough?,cultivate?}`（类型 src/data/items.ts:55-58）。
- **结算范围（重要）**：战斗乘区只吃 `atk/def/hp`（`treasureBonus` src/game/combatStats.ts:17-38）；`breakthrough` 只吃认主突破加成（`treasureBreakthroughTotal` combatStats.ts:56-72 + rules/breakthrough.ts:50）；**`cultivate` 字段与 treasure_qin 的 `dodge: 0.04` 当前无任何消费点**（全仓 TREASURE_BONUS 消费者仅 items.ts 显示、combatStats 两函数、CharacterPanel.tsx:18 显示）——见 E.6。
- 同类法宝只生效一件（combatStats.ts:21-22 seen 去重）。
- 坊市法宝货架 = `marketStock.treasure`（items.json:1431-1451）。
- 炼器配方（`artifact_recipes.json` `recipes` 数组，src/data/artifacts.ts:146-166 加载）：字段 `id/name/itemId/desc/baseRate/craftDays/minForgeLevel(1-3)/qualityFloor?/inputs/stoneCost`；品质凡品-仙器 0-3 词条（artifact_recipes.json:1-27），器阁 0-3 级决定品质上限（:116-145）。

---

## B. 现状分布与缺口分析

### B.1 功法（89 部，gf_ 71 / 宗门 18；仙阶 0）

起步境界 × 品阶分布（脚本统计 gongfa.json）：

| minRealm | 黄阶 | 玄阶 | 地阶 | 天阶 | 仙阶 | 小计 |
|---|---|---|---|---|---|---|
| 练气 qi | 13 | 4 | 0 | 0 | 0 | 17 |
| 筑基 foundation | 0 | 14 | 2 | 0 | 0 | 16 |
| 金丹 golden_core | 0 | 0 | 16 | 0 | 0 | 16 |
| 元婴 nascent_soul | 0 | 0 | 7 | 3 | 0 | 10 |
| 化神 spirit_sea | 0 | 0 | 0 | 12 | 0 | 12 |
| 炼虚 void | 0 | 0 | 0 | 6 | 0 | 6 |
| 合体 integration | 0 | 0 | 0 | 4 | 0 | 4 |
| 大乘 mahayana | 0 | 0 | 0 | 5 | 0 | 5 |
| 渡劫 tribulation | 0 | 0 | 0 | 3 | 0 | 3 |
| 飞升 ascended | 0 | 0 | 0 | 0 | 0 | 0 |

kind 分布：心法 29 / 攻击法诀 26 / 锻体法 16 / 身法 11 / **防御法仅 5** / 功法 2。
宗门秘法（price=0）按前缀：js 4 / ty 4 / ht 3 / xs 4 / ym 3。

**缺口结论**：
1. 后期断崖：合体 4 部、渡劫 3 部、飞升 0 部；且合体/大乘/渡劫缺防御法（防御法全表仅 5 部，元婴、合体、大乘、渡劫各 0-1 部；练气期防御法 0 部）。
2. 仙阶整套体系（品阶定义+特例规则齐备，gongfa.ts:71-94）从未被填充。
3. 大乘及以上按规则只能产天阶（gongfa.ts:76-85），新增后期功法 grade 一律天阶（仙阶除外）。

**建议新增 14 部**（D.1）：练气 1、元婴 1、炼虚 2、合体 3、大乘 2、渡劫 3、仙阶 2；kind 补向防御法 +4。

### B.2 丹药（56 颗）

按 pillGrade：1品 8 / 2品 9 / 3品 7 / 4品 6 / 5品 6 / 6品 6 / 7品 6 / 8品 4 / **9品 4**。

功效线覆盖矩阵（×=有，○=缺）：

| 功效线 | G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 | G9 |
|---|---|---|---|---|---|---|---|---|---|
| exp 修为 | × | × | × | × | × | × | × | × | ×(pill_xian 传世) |
| heal 气血 | × | ×(混合) | **○** | × | × | **○** | × | **○** | **○** |
| energy 灵力 | × | × | × | × | × | × | × | × | × |
| breakthrough | × | × | × | — | — | × | — | — | × |
| cleanse | × | × | — | ×(定魂) | — | × | — | **○** | **○** |
| full_heal | — | — | — | — | — | — | × | — | **○** |
| stone | — | × | — | — | — | — | — | — | — |

**建议新增 8 颗**（D.2）：补 G3/G6/G8/G9 heal 线、G8 cleanse、G9 full_heal、G8 exp 三纹、G9 mana 五纹。

### B.3 灵药（28 株）与种子（17 颗）

按 herbTier：1阶 3 / 2阶 4 / 3阶 4 / 4阶 3 / 5阶 3 / 6阶 3 / 7阶 3 / 8阶 3 / 9阶 2 —— **1-9 阶全覆盖**，缺口在：
1. **可种性**：11 株灵药无种子（脚本核对 seeds.json.yieldItemId）：herb_ghoul(T3)、herb_nightjade(T4)、herb_starfern(T5)、herb_yinyang(T6)、herb_iceheart(T6)、herb_sealroot(T7)、herb_aurora(T7)、herb_taowu(T8)、herb_starcore(T8)、herb_tribflower(T9)、herb_xiantai(T9)。高阶炼丹原料只能坊市购买。
2. **同阶品种密度**：9 阶仅 2 株。

**建议新增**：灵药 4 株（T6/T7/T8/T9 各 1）+ 种子 10 颗（补 8 株旧药 + 2 株新药；herb_aurora「花期一瞬」、herb_starcore「星骸矿物」按风味不补，D.3）。

### B.4 法宝（19 件 + 炼器配方 21 条）

按 treasureTier：**1阶 0** / 2阶 1 / 3阶 3 / 4阶 4 / 5阶 4 / 6阶 2 / 7阶 2 / 8阶 2 / 9阶 1。
按修向（据 treasureBonus）：攻 5 / 防 6 / 修 4 / 混合 4。缺口：**T1 全缺**（玩家第一件法宝直接从 T2 起）、T6-9 每阶仅 1-2 件、T9 无攻向、T8 无防向。

**建议新增 6 件**（T1×1、T6×1、T7×1、T8×1、T9×2）+ 炼器配方 3-4 条（D.6）。

### B.5 敌人（14 模板）

tier：minion 2 / normal 4 / elite 3 / boss 5。faction：beast 9 / demonic 5 / **righteous 0 / abomination 0**。
缺口：敌对势力只有魔修+妖兽两族；产品方案点名的「阴煞傀儡、域外天魔、异类/天灾兽」（docs/修仙养成游戏方案.md:99-102、134-137）与「魔道宗门镜像的敌对正道修士」均未落地；minion 池仅 2 个，低境界遭遇单调（pickEnemy 练气期 minion 概率 ~25%-8%=0.75-0.06-0.15…，enemies.ts:108-112）。

**建议新增 12 模板**：righteous 4（黑煞教邪派）、abomination 5（鬼修/傀儡/天魔）、demonic 2、beast 1（D.4）。

### B.6 秘境（8 座）

解锁境界分布：qi 1 / foundation 1 / golden_core 1 / nascent_soul 1 / spirit_sea 1 / void 1 / integration 1 / mahayana 1，**渡劫 0、飞升 0**；且无魔域/鬼域风味（方案规划 docs/修仙养成游戏方案.md:158-164 的「天外陨仙墟、轮回秘境」亦未落地）。

**建议新增 3 座必做 + 1 座可选**（D.5）：金丹后期魔域、炼虚期鬼域、渡劫期仙武遗墟（+飞升后太虚仙阙可选）。

---

## C. 平衡锚点（新内容必须落在同区间或平滑外推）

### C.1 丹药价格/功效锚点（items.json）

| 锚 | 现值序列 | 出处（items.json 行） |
|---|---|---|
| exp 丹 price ≈ effect.exp | G1 50/80、G2 200/280、G3 1200/1200、G4 5200/5200、G5 18000/18000、G6 55000/55000、G7 160000/160000、G8 480000/480000 | 4-16,72-84,126-139,182-194,222-234,264-277,306-318,348-360 |
| 五纹版 price ≈ 基础 ×5.4-6 | pill_core_w5 6800、pill_soul_w5 28000、pill_god_w5 98000、pill_void_w5 320000、pill_join_w5 920000、pill_maha_w5 2800000 | 140-153,195-208,236-249,278-291,319-332,361-373 |
| 三纹版 price ≈ 基础 ×3-3.6 | pill_qi_w3 180、pill_mana4_w3 18000 | 17-30,812-824 |
| 五纹版 minRealm = 基础 minRealm 的**下一大境界** | pill_core_w5 foundation→golden_core…pill_maha_w5 integration→mahayana | 同上；w3 版惯例 = 基础同境或下一境（pill_qi_w3 qi 同境 :17-30、pill_mana4_w3 nascent_soul 同境 :812-824、pill_great_w3 foundation 为基础的下一境 :85-98） |
| heal 丹 价/血比 | G1 0.375、G4 4.1、G5 3.7、G7 4.4（每点 hp 价格随品阶升至 ~4-5） | 46-70,209-221,251-263,333-346 |
| energy 丹 价/点比 | G1 0.67 → G4 5 → G7 8 → G9 7.5（高阶收敛 ~7.5-8） | 661-685,758-783,798-825,924-949,991-1004 |
| 突破丹 | +6% 900 / +10% 4500 / +15% 28000 / +20% 180000 / +25% 1200000 | 113-125,168-180,292-304,374-399 |
| 高阶参照 | pill_xian G9 传世 5,000,000 {exp 1200000, hp 200000}；pill_rebirth G7 900,000 {hp 80000, full_heal}；pill_bright G6 88,000 {exp 20000, energy 2000, cleanse} | 400-413,951-963,908-922 |

### C.2 灵药价格锚点（herbs.json；≈×3.3/阶）

T1 18-50（herbs.json:3-25）/ T2 130-220（:27-51）/ T3 750-960（:53-77）/ T4 3200-4000（:79-103）/ T5 12000-16000（:105-129）/ T6 42000-55000（:131-155）/ T7 140000-180000（:157-181）/ T8 420000-550000（:183-207）/ T9 1200000-1500000（:209-233）。效果（exp/hp/energy）同阶同步放大约 ×3.3。
种子：seedPrice ≈ 灵药价 ×0.7-0.83（seeds.json:1-171 对照 herbs.json）；growDays 序列：T1 3-7 → T2 12-20 → T3 28-32 → T4 40-45 → T5 60-70 → T6 80 → T7 100 → T8 120（约 ×1.4/阶，外推 T9 ≈150-160）。yield 惯例：T1 2-4，T2+ 1-2，T8/T9 1-1。

### C.3 功法售价/效果锚点（gongfa.json）

售价（坊市 gf_，按 minRealm，天阶）：

| minRealm | 现值区间 | 样本行 |
|---|---|---|
| qi 黄阶 | 100-280 | gf_tuiqi 100、gf_mingxiang 120、gf_yangqi 180（:995-1005,980-992,2-14） |
| foundation 玄阶 | 700-960 | gf_yunqi 400、gf_qingyuan 700、gf_zhenwu 960（:802-814,94-106,170-184） |
| golden_core 地阶 | 2400-3600 | gf_taixu 2400、gf_jianqi2 3600（:185-197,883-896） |
| nascent_soul 地阶 | 4200-5200 | gf_yuanying 4200、gf_jianyu 5200（:278-290,1102-1114） |
| spirit_sea 天阶 | 9000-12000 | gf_dayan 9000、gf_hundun 12000（:330-343,910-923） |
| void 天阶 | 16000-22000 | gf_xukong 16000、gf_zhanxian 22000（:397-409,1130-1142） |
| integration 天阶 | 28000-34000 | gf_heyi 28000、gf_liuli2 34000（:436-449,1143-1156） |
| mahayana 天阶 | 60000-80000 | gf_dacheng 60000、gf_tiandao 80000（:476-488,503-514） |
| tribulation 天阶 | 110000-130000 | gf_bumie 110000、gf_hundun_xin 130000（:528-541,1170-1183） |

圆满效果数值区间（effect ×1.5 才是圆满值；下表为 effect 定义值域）：

| grade | atk | def | hp | cultivate | dodge |
|---|---|---|---|---|---|
| 黄阶 | 0.04-0.07 | 0.06-0.08 | 0.04-0.08 | 0.04-0.08 | 0.05 |
| 玄阶 | 0.1-0.12 | 0.1-0.15 | 0.12-0.15 | 0.08-0.12 | 0.05-0.06 |
| 地阶 | 0.15-0.22 | 0.12-0.14 | 0.2-0.25 | 0.14-0.2 | 0.08-0.1 |
| 天阶 | 0.24-0.42 | 0.2-0.25 | 0.22-0.4 | 0.16-0.45 | 0.03-0.14 |
| 仙阶 | 无现值（外推 0.5-0.55） | 无现值 | 无现值 | 外推 ~0.5 | 外推 ≤0.16 |

多词条混合功法允许（如 gf_taoyi 0.36+0.1+0.04，gongfa.json:965-978），但主词条应落在上表内。

### C.4 灵田/炼丹锚点

- 配方：craftDays 1-14、baseRate 85（一品单味）→ 25（八品），成功 clamp 20-98（farm.ts:93-99）；g3 方 48-52、g5 方 36-40、g7 方 28、g8 方 25（recipes.json:121-142,499-516,583-604,254-276）。
- 聚灵阵/田地开垦费用与本次无关（abode.ts:56-87）。

### C.5 战斗基准曲线（生成敌人/秘境数值时的换算基准）

玩家基准 `realmCombatBase`（src/data/realms.ts:46-103；HP 200×3.4^ri、ATK (48+3×层)×3.85^ri、DEF (20+2×层)×3.25^ri、层内每层 ×1.04）：

| ri | 境界 | L1 atk/def/hp | L9 atk/def/hp |
|---|---|---|---|
| 0 | 练气 | 51/22/200 | 99/50/264 |
| 1 | 筑基 | 196/71/680 | 381/163/897 |
| 2 | 金丹 | 755/232/2311 | 1467/529/3051 |
| 3 | 元婴 | 2910/755/7860 | 5649/1721/10376 |
| 4 | 化神 | 11205/2454/26726 | 21750/5596/35279 |
| 5 | 炼虚 | 43139/7976/90870 | 83741/18187/119949 |
| 6 | 合体 | 166086/25925/308960 | 322403/59109/407828 |
| 7 | 大乘 | 639433/84257/1050467 | 1241252/192106/1386616 |
| 8 | 渡劫 | 2461818/273835/3571587 | 4778823/624344/4714495 |
| 9 | 飞升 | 9478000/889965/12143398 | 18398472/2029120/16029286 |

历练敌人缩放（src/data/enemies.ts:64-101）：`atk=base.atk×0.92×power`、`def=base.def×0.75×power`、`hp=base.hp×0.48×power`；layer 偏移 boss +2/elite +1/minion −2（:68）；飞升玩家历练时 ri clamp 到渡劫（:66）；掉落 `stone=(12+layer×3)×2.15^ri×tierLootMul×power`、`exp=(20+layer×6)×…`（:78-81），tierLootMul boss 3.2/elite 1.5/minion 0.7。
秘境敌人缩放（src/data/secretRealms.ts:53-100）：锚定 minRealm L1 基准，顶层 ramp 2.2 倍；奖励 ×2.2^ri×rewardMul。
示例锚（按上述公式实算，供抽查）：金丹期 normal(power 0.85) 约 A846/D233/H1093、掉 106 石 196 修为；大乘期 boss(power 1.5) 约 A148万/D18万/H94万、掉 3.4 万石。

### C.6 法宝锚点（items.json + treasureBonus）

| tier | 价格区间 | 加成锚 | 样本行 |
|---|---|---|---|
| 2 | 1800 | def 0.2 | treasure_mirror 544-551,1232-1234 |
| 3 | 2600-5400 | atk 0.25 / hp 0.3 / def+hp | 535-596,1228-1251 |
| 4 | 7500-11000 | cultivate 0.1-0.12、breakthrough 4-8 | 562-578,1183-1190,1237-1250,1278-1280 |
| 5 | 26000-30000 | atk 0.3-0.35 / def 0.28-0.3 | 597-614,1251-1258,1281-1287 |
| 6 | 110000-120000 | atk 0.4 / def 0.32+hp 0.15 | 616-631,1259-1265 |
| 7 | 340000-360000 | bt 10+cultivate 0.08 / def 0.35+hp 0.25 | 633-640,1209-1217,1266-1269,1288-1292 |
| 8 | 880000-980000 | atk 0.5 / cultivate 0.15+bt 8 | 642-649,1218-1226,1270-1277,1293-1297 |
| 9 | 2200000 | def 0.4+hp 0.2+bt 5 | 651-659,1273-1277 |

炼器配方锚（artifact_recipes.json:146-613）：T3 baseRate 62/3日/器阁1/400 石；T5 38/6日/器阁2/qualityFloor spirit/4000；T6 28-30/9日/器阁3/treasure/14000-15000；T7 20/14日/器阁3/treasure/50000；T8 14-15/16-18日/器阁3/immortal/120000-150000。

### C.7 秘境锚点（secret_realms.json）

| id | minRealm/层 | floors | bossEvery | env | stone/exp 每层 | boss 掉 | 行 |
|---|---|---|---|---|---|---|---|
| qingyun | qi/1 | 30 | 10 | rewardMul 1 | 12/25 | mat_foundation | 3-17 |
| ice_cave | foundation/3 | 40 | 10 | hpMul 0.9, 1.35 | 35/70 | mat_core | 19-33 |
| lava_hell | golden_core/1 | 50 | 10 | hpMul 0.85, 1.7 | 90/180 | mat_soul | 35-49 |
| void_rift | nascent_soul/5 | 60 | 15 | hpMul 0.8, 2.2 | 250/480 | mat_spirit | 51-65 |
| lingxu_palace | spirit_sea/1 | 70 | 14 | hpMul 0.75, 2.8 | 600/1100 | mat_void | 67-81 |
| taixu_battlefield | void/1 | 80 | 16 | hpMul 0.7, 3.4 | 1600/3000 | mat_integration | 83-97 |
| guixu_land | integration/1 | 90 | 18 | hpMul 0.65, 4.2 | 4200/8000 | mat_mahayana | 99-113 |
| tianjie_realm | mahayana/3 | 60 | 15 | hpMul 0.6, 5.0 | 9000/16000 | mat_tribulation | 115-129 |

外推规律：floors 30→90→后期回落、rewardMul ≈×1.35/境（上限附近 ~5-7）、stone/exp 每境 ×2.5-3、hpMul 递减 0.9→0.55。

### C.8 经济大数参照（用于定价 sanity check）

- 击杀收益：大乘 boss 约 3.4 万石/3.2 万修为（C.5 公式实算）。
- 修为需求：`expNeeded` 练气一层 80 起、全局步 ×1.215（realms.ts:36-79）；化神九层约 40 万（注释 realms.ts:41-43）；大乘九层 ≈ 80×1.215^79 ≈ 1.4 亿。
- 离线每小时修为：12×1.32^ri×(1+0.18×(层-1))×0.85（src/game/offline.ts:45-56）。
- 出售价 = 0.55×price（inventorySlice.ts:191）。

---

## D. 新内容设计清单（核心产出，可直接执行）

> 通用规则：
> 1. 所有 id 均核查过与现存 id 无冲突；敌人模板 id 互不为前缀（A.6 硬约束）。
> 2. 所有引用字段（yieldItemId / outputItemId / inputs.itemId / bossItemId / itemId）只使用「仓库已存在 ∪ 本清单已定义」的 id，逐条标注。
> 3. 标注「genre 通例」的命名/风味为修仙题材通用惯例（取意于凡人流/传统仙侠常见词），非仓库既有出处；数值与机制锚点均给仓库 file:line。
> 4. 新丹药/法宝/灵药需同步追加到 items.json `marketStock` 对应数组（丹药 →pill、法宝 →treasure、灵药 →herb），下表不再逐条重复；新种子购买走洞府（A.4），不进 marketStock。
> 5. 新功法不加 `maxRealm` 除非明确给出（惯例：后期功法多不限，gongfa.json 现有 22 部无上限）。

### D.1 功法 +14 部（追加到 `src/data/db/gongfa.json`）

| # | id | 名称 | 品阶 | kind | minRealm | maxRealm | price | effect | 命名/数值依据 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `gf_shifu` | 石肤诀 | 黄阶 | 防御法 | qi | foundation | 190 | def 0.07 | 练气期防御法 0 部（B.1）；锚 gf_tiegong def 0.08@180、gf_panshi def 0.06@200（gongfa.json:16-27,66-79）；「石肤」genre 通例 |
| 2 | `gf_yuanying_gang` | 元婴护身罡 | 地阶 | 防御法 | nascent_soul | integration | 4300 | def 0.15, hp 0.08 | 元婴期防御法 0 部；锚 gf_jindanhu def 0.14@2800（gongfa.json:222-236）；价取元婴地阶带 4200-5200（:278-317） |
| 3 | `gf_xujing_lianxing` | 虚境炼形篇 | 天阶 | 锻体法 | void | ascended | 21000 | hp 0.26, def 0.10 | 炼虚缺锻体；锚 gf_xingchen hp 0.24 def 0.1@11500（:924-937）、gf_liuli2 hp 0.28 def 0.14@34000（:1143-1156）；价取炼虚带 16000-22000（:397-449,1130-1142） |
| 4 | `gf_jieyun_dun` | 劫云遁 | 天阶 | 身法 | void | tribulation | 18500 | dodge 0.10, cultivate 0.04 | 炼虚身法仅 gf_lianxu；锚 dodge 天阶 0.12-0.14（:424-435,1157-1169），混合词条先例 gf_taoyi（:965-978）；「劫云」呼应渡劫意象，genre 通例 |
| 5 | `gf_zhoutian_hu` | 周天护身箓 | 天阶 | 防御法 | integration | ascended | 32000 | def 0.26, hp 0.12 | 合体防御法 0 部；锚 gf_xuanwu def 0.22 hp 0.12@19000（:951-964）、合体价带 28000-34000（:436-475,1143-1156） |
| 6 | `gf_xiumi_bu` | 须弥芥子步 | 天阶 | 身法 | integration | — | 30000 | dodge 0.12, hp 0.06 | 合体身法 0 部；锚 gf_qiankun dodge 0.14@68000（:1157-1169）、gf_lianxu dodge 0.12（:424-435）；「须弥芥子」genre 通例（佛藏用语） |
| 7 | `gf_yunxing_zhi` | 陨星指 | 天阶 | 攻击法诀 | integration | tribulation | 34000 | atk 0.30, dodge 0.05 | 锚 gf_zhanxian atk 0.3@22000（:1130-1142）、gf_yinyang 0.35@32000（:450-461）；混合攻先例 gf_jianxin（:251-263）；genre 通例 |
| 8 | `gf_hunyuan_zhao` | 混元道罩 | 天阶 | 防御法 | mahayana | — | 72000 | def 0.28, hp 0.16 | 大乘防御法 0 部；价取大乘带 60000-80000（:476-514）；def 0.28 为 gf_wuxiang 0.25（:462-475）平滑外推 |
| 9 | `gf_wanjie_bumo` | 万劫不磨体 | 天阶 | 锻体法 | mahayana | ascended | 78000 | hp 0.32, def 0.16 | 大乘锻体 0 部；锚 gf_bumie hp 0.4 def 0.22@110000（渡劫，:528-541）；「万劫不磨」genre 通例 |
| 10 | `gf_mieji_lei` | 灭劫神雷指 | 天阶 | 攻击法诀 | tribulation | — | 140000 | atk 0.46 | 渡劫攻法 0 部；锚 gf_tiandao atk 0.42@80000（大乘，:503-514）；渡劫价带外推 110000-130000（:516-541,1170-1183）+10% |
| 11 | `gf_jinguang_zhou` | 金光护道咒 | 天阶 | 防御法 | tribulation | — | 135000 | def 0.30, hp 0.20 | 渡劫防御法 0 部；锚 gf_hunyuan_zhao 0.28/0.16 外推一档；「金光咒」genre 通例 |
| 12 | `gf_suodi_cun` | 缩地成寸 | 天阶 | 身法 | tribulation | — | 125000 | dodge 0.15, atk 0.06 | 渡劫身法 0 部；锚 gf_qiankun dodge 0.14（:1157-1169）；「缩地成寸」genre 通例（《神仙传》意） |
| 13 | `gf_wangqing` | 太上忘情录 | 仙阶 | 心法 | mahayana | — | 1600000 | cultivate 0.50, hp 0.15 | 仙阶 0 部（B.1）；仙阶规则 gongfa.ts:71-94（大乘+可参悟）；cultivate 0.5 = 天阶上限 0.45（gf_dujie，gongfa.json:516-527）外推一档；定价对标 T9 法宝 2200000（items.json:651-659）与 pill_xian 5000000（:400-413）之间；「太上忘情」genre 通例 |
| 14 | `gf_zhuxian` | 诛仙剑典 | 仙阶 | 攻击法诀 | tribulation | — | 2200000 | atk 0.55, dodge 0.05 | 仙阶攻伐；atk 0.55 = 渡劫天阶 0.46 外推；「诛仙」genre 通例（《诛仙》类仙侠泛用词） |

合计 14 部；kind 增量：防御法 +4、锻体 +2、身法 +2、攻 +3、心 +1。仙阶 2 部将自动生成高价秘籍上架坊市（items.ts:17-29、186-192），大乘+方可参悟（gongfa.ts:88-94）。

### D.2 丹药 +8 颗（追加到 `items.json` items 数组，type 一律 `consumable`）

| # | id | 名称 | 品/纹 | price | minRealm | maxRealm | effect | 依据 |
|---|---|---|---|---|---|---|---|---|
| 1 | `pill_core_heal` | 玉露续脉散 | 三品·一纹 | 3000 | golden_core | spirit_sea | hp 900, energy 200 | G3 heal 缺口（B.2）；锚 G2 pill_bone hp 260@320（items.json:100-112）与 G4 pill_soul_heal hp 2200@9000（:209-221）之间插值，价/血 ≈3.3 对齐 G3 能量线 |
| 2 | `pill_void_heal` | 锁魂固元丹 | 六品·二纹 | 150000 | void | mahayana | hp 30000, energy 2500 | G6 heal 缺口；锚 G5 pill_god_heal 6000hp@22000（:251-263）→ G7 pill_join_heal 45000hp@200000（:333-346）插值 |
| 3 | `pill_maha_heal` | 道元续命丹 | 八品·三纹 | 700000 | mahayana | — | hp 130000, energy 12000 | G8 heal 缺口；锚 G7 45000@200000 与 G9 pill_xian hp 200000@5000000（:400-413）之间 |
| 4 | `pill_trib_heal` | 仙元护命丹 | 九品·四纹 | 2400000 | tribulation | — | hp 380000, energy 30000 | G9 heal 缺口；锚 pill_mana9 1500000（:991-1004）与 pill_xian 5000000（:400-413）之间 |
| 5 | `pill_mana9_w5` | 劫雷洗髓丹·五纹 | 九品·五纹 | 9000000 | tribulation | — | energy 200000, exp 200000 | 补 mana9 五纹版；w5=基础×6（pill_mana9 1500000，items.json:991-1004；C.1 w5 比值）；minRealm 惯例=基础（九品已无下一境，保持 tribulation，对照 pill_trib_w5 :387-399） |
| 6 | `pill_maha_cleanse` | 太清涤尘丹 | 八品·二纹 | 560000 | mahayana | — | exp 60000, energy 6000, special cleanse | G8 cleanse 缺口；锚 pill_bright G6 88000 {exp 20000, energy 2000, cleanse}（:908-922）按品阶 ×6.4 |
| 7 | `pill_huanhun` | 九转还魂丹 | 九品·五纹 | 4800000 | tribulation | — | hp 500000, special full_heal | G9 full_heal 缺口；锚 pill_rebirth G7 900000 {hp 80000, full_heal}（:951-963）×5.3 |
| 8 | `pill_maha_w3` | 大乘道丹·三纹 | 八品·三纹 | 1650000 | mahayana | — | exp 480000 | 补 exp 线 G8 三纹（现 G8 仅无纹/五纹）；w3=基础 480000×3.4（C.1 三纹比值）；minRealm 取 mahayana（基础 integration 的下一境，同时满足「同境」与「下一境」两种 w3 先例；对照 pill_great_w3 items.json:85-98） |

desc 模板（保持现有文风）：「N品丹·N纹。……」；五纹/三纹变体命名 = 基础名 + `·五纹/·三纹`（对照 items.json 现有条目）。

### D.3 灵药 +4 株（追加到 `herbs.json`）+ 种子 +10 颗（追加到 `seeds.json`）+ 丹方 +10 条（追加到 `recipes.json`）

新灵药（只写 herbs.json，勿再复制进 items.json，原因见 A.3）：

| id | 名称 | 阶 | price | minRealm | effect | 依据 |
|---|---|---|---|---|---|---|
| `herb_moonveil` | 太阴玄精 | 6 | 52000 | void | exp 11000, energy 1600 | T6 区间 42000-55000、exp 7000-12000（herbs.json:131-155）；genre 通例（太阴玄精属仙侠通用矿植名） |
| `herb_zixiao` | 紫霄芝 | 7 | 190000 | integration | exp 38000, energy 2800 | T7 区间 140000-180000、exp 22000-35000（:157-181），取上沿 |
| `herb_hundunlian` | 混沌青莲 | 8 | 560000 | mahayana | exp 130000, hp 14000 | T8 区间 420000-550000、exp 80000-120000（:183-207）平滑外推；「混沌青莲」genre 通例 |
| `herb_xianluo` | 仙落霞露 | 9 | 1600000 | tribulation | exp 300000, energy 16000 | T9 区间 1200000-1500000（:209-233）外推；exp 介于 herb_tribflower 250000 与 herb_xiantai 320000 |

新种子（yieldItemId 全部指向已存在灵药；growDays/seedPrice 按 C.2 外推）：

| id | 名称 | growDays | yield | yieldMin-Max | seedPrice | 依据 |
|---|---|---|---|---|---|---|
| `seed_ghoul` | 阴魂草种 | 26 | herb_ghoul | 1-2 | 560 | T3 28-32 日、价≈herb 750×0.75（seeds.json:43-61 先例） |
| `seed_nightjade` | 夜光玉髓草种 | 42 | herb_nightjade | 1-2 | 2900 | T4 40-45 日（seeds.json:62-71 先例 seed_soulorchid 45） |
| `seed_starfern` | 星霜蕨种 | 68 | herb_starfern | 1-1 | 11000 | T5 60-70 日（seed_godpetal 60/seed_thunder 70，:73-81,153-161） |
| `seed_yinyang` | 阴阳藤种 | 85 | herb_yinyang | 1-2 | 35000 | T6 80 日（seed_voidgrass 80，:83-91） |
| `seed_iceheart` | 冰心玉髓种 | 88 | herb_iceheart | 1-1 | 40000 | 同 T6 档 |
| `seed_sealroot` | 封灵根种 | 105 | herb_sealroot | 1-1 | 105000 | T7 100 日（seed_goldlotus 100，:163-171） |
| `seed_hundunlian` | 混沌青莲种 | 135 | herb_hundunlian | 1-1 | 420000 | T8 120 日（seed_daofruit 120，:93-101）外推 |
| `seed_taowu` | 桃悟枝插 | 125 | herb_taowu | 1-1 | 360000 | T8；枝条扦插风味 |
| `seed_tribflower` | 渡劫花种 | 150 | herb_tribflower | 1-1 | 900000 | T9 外推（C.2） |
| `seed_xianluo` | 仙落霞露种 | 155 | herb_xianluo | 1-1 | 1200000 | T9 外推 |

（herb_aurora「花期一瞬」、herb_starcore「星骸矿物」按风味不补种子；herb_xiantai 传世草留坊市/秘境产出。）

新丹方（inputs 全部为已存在 id ∪ 本清单新定义 id）：

| id | 名 | inputs | output | craftDays | baseRate | 依据 |
|---|---|---|---|---|---|---|
| `craft_pill_core_heal` | 炼玉露续脉散 | herb_cloud 1 + herb_moon 2 | pill_core_heal ×1 | 3 | 46 | G3 方 craftDays 3-4/rate 48-52（recipes.json:121-142,415-436），heal 线略低 |
| `craft_pill_god_heal` | 炼莲身丹 | herb_godpetal 1 + herb_thunder 1 + herb_starfern 1 | pill_god_heal ×1 | 7 | 36 | 补现有无方丹（B.2 脚本核对）；锚 craft_pill_body5 7日36（:517-539） |
| `craft_pill_void_heal` | 炼锁魂固元丹 | herb_iceheart 1 + herb_yinyang 1 + mat_void 1 | pill_void_heal ×1 | 9 | 30 | 锚 G6 方 8日 32-35（:563-581）；mat_void 为现有 id（items.json:499-506） |
| `craft_pill_mana8` | 炼大道灵犀丹 | herb_starcore 1 + herb_goldlotus 1 | pill_mana8 ×1 | 12 | 26 | 补现有无方丹；锚 craft_pill_mana7 10日28（:582-604） |
| `craft_pill_maha_heal` | 炼道元续命丹 | herb_hundunlian 1 + herb_starcore 1 + mat_mahayana 1 | pill_maha_heal ×1 | 13 | 24 | 锚 craft_pill_maha 14日25（recipes.json:254-276）；mat_mahayana items.json:517-524 |
| `craft_pill_maha_cleanse` | 炼太清涤尘丹 | herb_iceheart 1 + herb_daofruit 1 + mat_mahayana 1 | pill_maha_cleanse ×1 | 12 | 26 | 锚 craft_pill_bright 8日34（:540-562）外推 |
| `craft_pill_rebirth` | 炼还魂丹 | herb_aurora 2 + herb_goldlotus 1 + mat_integration 1 | pill_rebirth ×1 | 12 | 22 | 补 G7 full_heal 丹；锚 craft_pill_join 10日30（:232-253） |
| `craft_pill_mana9` | 炼劫雷洗髓丹 | herb_tribflower 1 + herb_xianluo 1 | pill_mana9 ×1 | 15 | 22 | 补 G9 mana 丹；craftDays/ rate 顺 C.4 曲线外推 |
| `craft_pill_trib_heal` | 炼仙元护命丹 | herb_xianluo 1 + herb_xiantai 1 | pill_trib_heal ×1 | 16 | 20 | 顶格外推；baseRate 20 = clamp 下限（farm.ts:93-99） |
| `craft_pill_maha_w3` | 炼三纹大乘道丹 | herb_daofruit 1 + herb_taowu 1 + herb_hundunlian 1 | pill_maha_w3 ×1 | 15 | 20 | 多纹方惯例（craft_pill_qi_w3/w5、craft_pill_mana_w5，:37-54,301-318,624-642） |

### D.4 敌人模板 +12（追加到 `db/enemies.json`）

统一 `matOffset`：boss/elite=1、minion/normal=0（现有惯例，enemies.json 全表）。掉落材料由 `matForRealmOffset` 自动派生（enemies.ts:42-58），无需配置 itemId。

| # | id | 名称 | faction | tier | power | dropRate | flavor 要点 | 依据 |
|---|---|---|---|---|---|---|---|---|
| 1 | `rogue_scout` | 黑风寨探子 | righteous | minion | 0.66 | （默认 0.05） | 散修马贼，专劫行囊 | 邪派修士补 righteous 空缺（B.5）；power 锚 minion 0.62-0.7（enemies.json:2,9） |
| 2 | `wraith` | 阴煞小鬼 | abomination | minion | 0.60 | （默认） | 怨气所凝，畏正阳 | abomination 空缺；方案点名异类（docs/修仙养成游戏方案.md:100-102） |
| 3 | `rogue_captain` | 黑风寨头目 | righteous | normal | 0.88 | 0.45 | 寨中头目，刀法泼辣 | normal 锚 0.78-0.9（:4-5,10） |
| 4 | `ghost_soldier` | 幽冥鬼卒 | abomination | normal | 0.84 | 0.5 | 鬼修驱使的阴兵 | 「鬼修」风味映射 abomination（EnemyDef 无 ghost 枚举，types/index.ts:12） |
| 5 | `demon_knight` | 魔渊武士 | demonic | normal | 0.92 | 0.5 | 万魔窟武卒，煞气护体 | 补魔宗中坚（现魔 normal 仅 1）；normal 上沿 |
| 6 | `rogue_sword` | 邪剑传人 | righteous | elite | 1.06 | 0.4 | 修禁术的剑修，剑气带煞 | elite 锚 1.02-1.08（:6-7,11） |
| 7 | `demon_priest` | 摄魂魔祭酒 | demonic | elite | 1.10 | 0.4 | 魔道祭司，摄魂炼魄 | elite 上沿外推 0.02，与 demon_elite 1.05（:11）错开 |
| 8 | `puppet` | 阴煞傀儡 | abomination | elite | 1.08 | 0.4 | 修士骸骨炼成的战傀 | 方案点名「阴煞傀儡」（docs/修仙养成游戏方案.md:101） |
| 9 | `rogue_boss` | 黑煞教主 | righteous | boss | 1.52 | 0.5 | 邪派枭雄，正道悬赏之首 | boss 锚 1.4-1.6（:12-17） |
| 10 | `boss_ghost_king` | 白骨鬼王 | abomination | boss | 1.48 | 0.55 | 万骨窟之主 | boss 中档 |
| 11 | `boss_jiaolong` | 黑水蛟王 | beast | boss | 1.55 | 0.5 | 深渊蛟龙，翻江倒海 | 妖族高阶补位；「蛟龙」genre 通例 |
| 12 | `boss_heaven_demon` | 域外天魔 | abomination | boss | 1.62 | 0.45 | 虚空裂缝中窥伺的天魔 | 方案点名「域外天魔（后期）」（docs/修仙养成游戏方案.md:101）；power 取全表现最高（超 boss_devour 1.6，:17） |

落点核对：id 互不为前缀（与现有 wolf/snake/…/boss_* 亦无前缀冲突）；tier 分布变为 minion 4 / normal 7 / elite 6 / boss 9，低境界 minion 池翻倍。
声望提示：击杀 righteous 模板 = 正道声望 +0、魔道 +4（combatStats.ts:109-113）——「杀邪派涨魔望不掉正望」，单机语义可接受（E.9）。

### D.5 秘境 +3 必做 +1 可选（追加到 `db/secret_realms.json`）

> 秘境无逐层敌人引用字段，层数/镇守间隔由 `floors/bossEvery` 驱动（A.7）；以下只配数据。

| id | 名称 | minRealm/minLayer | floors | bossEvery | env | loot | 风味/依据 |
|---|---|---|---|---|---|---|---|
| `blood_abyss` | 血魔渊 | golden_core / 6 | 45 | 9 | hpMul 0.85, rewardMul 1.9 | stone 130, exp 260, bossItemId `mat_soul` | 魔域类秘境（方案 :163「煞气环境、魔修驻守」）；插入 lava_hell(1.7) 与 void_rift(2.2) 之间；boss 提前半境掉元婴果——先例：boss 模板 matOffset 1 掉下一境材料（enemies.ts:15-17）；bossItemId 为现有 id（items.json:481-488） |
| `youming_valley` | 九幽鬼域 | void / 1 | 75 | 15 | hpMul 0.72, rewardMul 3.8 | stone 2200, exp 4200, bossItemId `mat_integration` | 鬼域风味（呼应 abomination 敌族与幽冥宗门）；数值插值 taixu_battlefield(3.4) 与 guixu_land(4.2)（secret_realms.json:83-113）；bossItemId 现有 id（items.json:507-515） |
| `xianwu_ruins` | 仙武遗墟 | tribulation / 1 | 50 | 10 | hpMul 0.6, rewardMul 5.8 | stone 24000, exp 45000, bossItemId `mat_tribulation` | 填补渡劫期 0 秘境（B.6）；rewardMul/stone 沿 C.7 曲线外推（tianjie 5.0/9000 → 5.8/24000，×2.2^ri 由代码叠加）；掉渡劫令强化终局材料渠道（与 tianjie_realm 双渠道）；bossItemId 现有 id（items.json:525-533） |
| `taixu_palace`（可选） | 太虚仙阙 | ascended / 1 | 99 | 9 | hpMul 0.55, rewardMul 7.0 | stone 80000, exp 150000, bossItemId `pill_xian` | 飞升后终局循环（现飞升 0 秘境）；towerEnemy ri=9 → 奖励系数 2.2^9≈1207（secretRealms.ts:67），实算顶层 boss 约 A1900万/D260万/H2900万，飞升玩家（面板攻 948 万×功法法宝倍率）可战；bossItemId 掉传世仙露形成终局闭环；**若采纳需在验收时实测**（E.10） |

镇守 BOSS：名称自动「{秘境名}镇守」（secretRealms.ts:71-73），无需配置；boss 战力 = 基准×(atk 1.15/def 1.15/hp 1.5)（secretRealms.ts:65）。

### D.6 法宝 +6（追加到 `items.json` items 数组 + `treasureBonus`）+ 炼器配方 +3（追加 `artifact_recipes.json` recipes）

物品 + 加成：

| id | 名称 | 阶/修向 | price | minRealm | treasureBonus | 依据 |
|---|---|---|---|---|---|---|
| `treasure_copper_bell` | 辟邪铜铃 | T1 防 | 800 | qi | def 0.10, hp 0.05 | T1 全缺（B.4）；锚 T2 mirror def 0.2@1800（items.json:544-551）减档；「辟邪铜铃」genre 通例 |
| `treasure_spear` | 燎原火戟 | T6 攻 | 125000 | void | atk 0.42 | T6 攻仅 seal 0.4@120000（:616-623,1259-1261）；「燎原」genre 通例 |
| `treasure_hammer` | 崩岳锤 | T7 攻 | 360000 | integration | atk 0.45, hp 0.08 | T7 无攻向；锚 T6 atk 0.4 → T7 0.45；价取 T7 带 340000-360000（:633-640,1209-1217）；genre 通例 |
| `treasure_shield` | 周天星盾 | T8 防 | 950000 | mahayana | def 0.38, hp 0.15 | T8 无防向；锚 T9 mirror def 0.4 hp 0.2@2200000（:651-659,1273-1277）让位一档 |
| `treasure_immortal_blade` | 斩仙飞刀 | T9 攻 | 3200000 | tribulation | atk 0.55 | T9 无攻向；atk 0.55 = T8 0.5（:642-649,1270-1272）外推；价对标 T9 2200000×1.45；「斩仙飞刀」genre 通例（封神演义器名，公有领域意象） |
| `treasure_dao_lotus` | 道韵青莲 | T9 修 | 2800000 | tribulation | breakthrough 12, cultivate 0.18 | T9 无修向；bt 12 = 现最高 halo/qin 8-10（:1266-1269,1293-1297）外推；**cultivate 字段当前不参与结算**（E.6），主效果依赖 breakthrough |

炼器配方（itemId 均指向上表新法宝；inputs 均为已存在 id）：

| id | 名 | itemId | baseRate | craftDays | minForgeLevel | qualityFloor | inputs | stoneCost | 依据 |
|---|---|---|---|---|---|---|---|---|---|
| `art_spear` | 燎原火戟胚 | treasure_spear | 26 | 11 | 3 | treasure | herb_yinyang 2, mat_void 1, tiger_bone 3 | 16000 | 锚 art_seal 30/9/15000、art_net 28/9/14000（artifact_recipes.json:401-445） |
| `art_hammer` | 崩岳锤胚 | treasure_hammer | 20 | 14 | 3 | treasure | mat_yangjade 1, mat_integration 1, herb_sealroot 2 | 55000 | 锚 art_pagoda9 20/14/50000（:563-587）；mat_yangjade items.json:1173-1181 |
| `art_shield` | 周天星盾胚 | treasure_shield | 16 | 17 | 3 | immortal | herb_starcore 1, mat_mahayana 1, herb_taowu 1 | 160000 | 锚 art_qin 14/18/immortal/150000（:588-612） |
| `art_blade` | 斩仙飞刀胚 | treasure_immortal_blade | 13 | 20 | 3 | immortal | herb_xianluo 1（D.3 新）, mat_tribulation 1, herb_tribflower 1 | 260000 | 顶格外推；首例消耗 mat_tribulation 的炼器方（现有配方不用渡劫令，增稀缺消耗） |

T1 辟邪铜铃与 T9 道韵青莲不进炼器（前者低于器阁最低实用线，后者定位传世坊市/秘境物）。

---

## E. 风险与注意事项（生成代理与验收必读）

1. **图鉴自动收录范围**：功法（GONGFA_LIST 全量，codex.ts:62-68）、敌人模板（ENEMY_TEMPLATES 全量，:55-61）、秘境（SECRET_REALMS 全量，:117-123）、物品页只收 `pill_*` / treasure 分类 / `mat_*`（:69-84）——**新 herb_* 不进图鉴，属预期**；新丹药/法宝/敌人/秘境自动进。无需改 codex 代码。
2. **图鉴百分比稀释**：集齐奖励按 `unlocked/total` 百分比节点发放（codex.ts:26、140-152，节点 25/50/75/100）。总量增大后已有存档的百分比会下降（如秘境 8→11/12 座，原 25% 已领者不受影响——奖励 key `page:pct` 已领取不重复发，codexRewardKey/pendingCodexRewards :154-182；但「已解锁 75%」可能回落到 <75%）。属可接受表现，建议版本说明提示。
3. **marketStock 必须手动追加**：新丹药/法宝/灵药若未加入 items.json `marketStock.pill/treasure/herb`（items.json:1331-1451）将「存在但买不到」；`itemCategory` 靠 id 前缀自动分类（items.ts:35-43），无需登记。
4. **仙阶功法上架与代码注释的张力**：gongfa.ts:71-75 注释称仙阶「不进常规池」，但坊市/参悟的实际过滤（items.ts:186-192、MarketPanel.tsx:39-47、gongfa.ts:88-94）允许仙阶以 price>0 上架、大乘+参悟。本报告按此设计（D.1 #13/#14）；若产品坚持「非坊市」，需给仙阶新增宗门藏经阁条目（改 sects.json，成本更高）或秘境掉落途径——二选一需回主管部门确认，默认执行本报告方案。
5. **离线加深丹白名单**：`OFFLINE_PILL_IDS = ['pill_qi','pill_great','snake_gall','fox_core']` 硬编码（offline.ts:27-28；消费 progress.ts:188）——新丹药不会自动支持离线加深；本次不扩（如需，另行小改代码）。
6. **treasureBonus 的 cultivate/dodge 是死字段**：类型里声明了 cultivate（items.ts:55-58），treasure_qin 还写了 dodge 0.04（items.json:1296），但结算只取 atk/def/hp/breakthrough（combatStats.ts:17-38、56-72；UI 文案 treasureEffectText 也不显示 cultivate，items.ts:124-134）。`treasure_dao_lotus` 的 cultivate 0.18 仅作未来兼容声明，**当前实际效果只有 breakthrough 12**——验收时不要按 cultivate 期待强度；如需生效是代码改动，超出本数据扩充范围。
7. **pill_qi 特判**：只有 `pill_qi*` 的 exp 走随境界放大的 `pillExp`（inventorySlice.ts:89-92）；新丹药 exp 按定值结算，设计已按定值锚定（C.1）。新增突破丹还需同步 `breakthroughPills` 数组（items.json:1299-1320）——本次不含新突破丹，规避。
8. **存档兼容**：静态数据不入存档；存档只存 id（collection/inventory/gongfa.learned 等），新条目对旧档是纯增量，`saveVersion 15` 不动（tuning.ts:4）。种子/灵田：旧档 plots 存 seedId，新增种子 id 不影响迁移逻辑（farm.ts:39-71）。
9. **击杀 righteous 敌人的声望语义**：repDeltaOnKill 对 righteous 返回 {right +0, demonic +4}（combatStats.ts:109-113）——「剿灭邪派涨魔道声望」与直觉略悖，但改动属代码行为；数据层接受。若后续要「邪派敌对正道双方声望」，需改该函数，不在本契约内。
10. **秘境守卫 faction 硬编码 beast**（secretRealms.ts:74）：九幽鬼域等新秘境的守卫在图鉴/战报中仍显示「妖兽」。数据层无法表达守卫阵营，接受；若要魔域/鬼域专属守卫阵营，需改 `towerEnemy`（另立任务）。
11. **craftRate 下限**：新配方 baseRate 20 已触 clamp 下限（farm.ts:93-99，min 20），丹修（+12）与道痕仍可抬升，符合「高阶丹难成但不绝望」的现状体验。
12. **炼丹成功率/丹纹不可 Farm 突破**：`breakthroughRate` 丹与 `mat_tribulation`（渡劫令）仍是终局刚需，本次新增不触碰突破成功率上限体系（现有 5 档已全，B.2）。
13. **敌人模板 id 前缀约束**：新增 id 不得互为前缀、也不得为现有 id 的前缀（A.6），验收用例见下。
14. **herbs.json 与 items.json 的重复定义**：10 株灵药两处同 id 定义，ITEMS 合并以 items.json 为准（items.ts:14-16）。新增灵药只写 herbs.json；**不要**顺手去改 items.json 里的重复株，避免本次范围膨胀。
15. **gongfa_synergy 无需强制扩充**：新增功法全是 `gf_` 前缀 → wandering 脉系，`syn_same_sect`（任一脉系 ≥2）不受影响；kind_count 类羁绊（攻击/锻体/心法 ×3）会因新功法更易激活，属正向内容效果。可选项：为仙阶双件加 combo `syn_xian_dao`（ids: `gf_wangqing`+`gf_zhuxian`，effects {atk 0.05, cultivate 0.04}，flavor genre 通例），追加到 gongfa_synergy.json rules 数组，结构与现有 combo 条目一致（gongfa_synergy.json:46-99）。**禁止**发明新宗门前缀——gongfaSchool 只认 5 个前缀（gongfaSynergy.ts:32-39），新前缀会被静默归入 wandering 且 RIGHT_SCHOOLS/DEMON_SCHOOLS 不含它。
16. **事件/天劫/宗门引用不受影响**：tribulation.json 仅引用 pill_break_trib；events.json 引用 demon_guard/demon_shard/mat_foundation/mat_core/sect_fragment 等既有 id——新增内容是纯增量，无引用需回填。

### 建议新增的数据完备性测试（新文件，建议 `src/data/content.completeness.test.ts`，断言风格对照 items.gongfa.test.ts / sectBuildings.test.ts）

1. **引用完整性**：
   - 每颗种子 `yieldItemId ∈ ITEMS`；每条配方 `inputs[].itemId`、`outputItemId ∈ ITEMS`；每条炼器配方 `itemId/inputs[].itemId ∈ ITEMS`；每座秘境 `bossItemId ∈ ITEMS`（若配置）。
   - 敌人模板：id 无前缀互相冲突（两两 `a !== b && !a.startsWith(b+'_') && !b.startsWith(a+'_')`）；faction/tier 枚举合法；power ∈ [0.5, 1.7]。
2. **品阶规则**：
   - 功法：`minRealm` 为大乘/渡劫时 `grade ∈ {天阶,仙阶}`（对齐 gongfaGradesAllowed gongfa.ts:76-85）；仙阶条目 `minRealm ∈ {mahayana, tribulation}`（gongfaGradeOk :88-94）。
   - 丹药/灵药/法宝：`pillGrade/herbTier/treasureTier ∈ 1-9`、`danMarks ∈ 0-5`；`pill_*` 必有 pillGrade，`treasure_*` 必有 treasureTier 且在 treasureBonus 有键（反向：treasureBonus 键必须存在于 ITEMS）。
3. **价格区间（防数值崩坏）**：
   - exp 丹（danMarks=0）：`|price − effect.exp| / effect.exp ≤ 0.5`（现状最大偏差 G1 50/80=0.375）。
   - 丹药 price 随 pillGrade（同功效线）单调不减；gongfa price 随 minRealm 单调不减（同 grade）。
   - 功法 effect 单字段上限：atk ≤0.6、def ≤0.35、hp ≤0.45、cultivate ≤0.55、dodge ≤0.18（= 现上限 +10% 余量）。
   - 法宝 treasureBonus：atk ≤0.6、def ≤0.45、hp ≤0.3、breakthrough ≤12。
   - 灵药 price 随 herbTier 单调区间校验（每阶 ±60% 带宽）。
4. **种子经济**：`yieldMin ≤ yieldMax` 且 ≥1；`seedPrice < yieldMin × 灵药价`（种田毛收益为正的现状惯例，见 C.2）。

---

## 附：执行顺序建议（供生成代理）

1. `gongfa.json` +14 → 2. `items.json`（items 数组 +8 丹、+6 法宝；treasureBonus +6；marketStock.pill/treasure 追加新 id）→ 3. `herbs.json` +4、`seeds.json` +10 → 4. `recipes.json` +10 → 5. `enemies.json` +12 → 6. `secret_realms.json` +3（+1 可选）→ 7. `artifact_recipes.json` +3~4 → 8. （可选）`gongfa_synergy.json` +1 combo → 9. 新增完备性测试并跑 `npm test`、`npm run lint`、`npm run build`。
每一步都是对现有 JSON 数组的**纯追加**；不修改既有条目、不改任何 TS 逻辑。

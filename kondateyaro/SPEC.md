# こんだて野郎 仕様書
最終更新: 2026-05-27（買い物リスト改修）

---

## デプロイ情報
- URL: kondateyaro.vercel.app
- リポジトリ: GitHub / kondateyaro
- フレームワーク: React (Vite) + Vercel
- APIプロキシ: `/api/claude.js` → Anthropic API
- 環境変数: `ANTHROPIC_KEY`

---

## タブ構成（BottomNav）
| タブ | アイコン | コンポーネント |
|---|---|---|
| 0 | 📅 献立 | MenuScreen |
| 1 | ⭐ 評価 | RatingScreen |
| 2 | 🛒 買い物 | ShopScreen |
| 3 | ⚙️ 設定 | SettingsScreen |

---

## データ構造（localStorageキー: `kondateyaro-v1`）

```js
{
  plan: {
    weekStart: "2026-05-26",  // 週開始日
    groups: [
      {
        days: ["monday","wednesday","friday"],
        main: "鶏かつ丼",
        sides: ["ひじき煮", "ポテトサラダ"],
        cat: "丼",
        diff: 2,   // 1=かんたん 2=ふつう 3=本格
        score: null
      },
      ...
    ]
  },
  session: {
    weekStart: "2026-05-26",
    items: [
      {
        id: "item_xxx",
        groupIdx: 0,       // plan.groupsのインデックス
        dishType: "main" | "side1" | "side2",
        dishName: "鶏かつ丼",
        name: "鶏むね肉",
        qty: "600g",
        type: "ingredient" | "seasoning",
        floor: "R" | "L" | null,  // 仕分け先カテゴリID
        excluded: false
      }
    ],
    dailyGoods: [
      { id: "dg_xxx", name: "シャンプー", selected: true, floor: "R" | null }
    ]
  },
  sortMem: { "鶏むね肉": "R", ... },  // 食材名→仕分け先の記憶（キーは食材名のみ・量を含まない）
  ingredientMem: { "鶏むね肉": 150, "鶏むね肉_unit": "g", ... },  // 食材名→1人前量の記憶
  dailyGoods: ["シャンプー", "洗剤", ...],  // 日用品マスタ
  dishes: {
    "鶏かつ丼": {
      scores: [4, 5, 3],        // 直近10件の評価
      difficulty: 2,            // 1=かんたん 2=ふつう 3=本格
      lastServed: "2026-05-26"  // 最後に提供した週
    }
  },
  customRecipes: [
    {
      id: "cr_xxx",
      name: "料理名",
      ingredients: "鶏もも・玉ねぎ",
      url: "https://...",
      score: 4
    }
  ],
  settings: {
    // ★ day_groups は辞書形式（曜日→グループ番号）
    day_groups: { monday:1, tuesday:2, wednesday:1, thursday:2, friday:1, saturday:3, sunday:4 },
    frozen_meals: ["saturday_lunch", "sunday_lunch"],  // 冷凍食品固定枠
    ng_foods: ["えび", "牛肉"],
    sort_cats: [
      { id:"R", name:"2階", color:"#00897B", dir:"right" },
      { id:"L", name:"3階", color:"#1565C0", dir:"left"  }
      // 最大4つ、dir は right/left/up/down
    ],
    line_token: "",
    sheets_url: "",
    sheets_token: "",
    servings: 2,           // 1食の人数
    rotation_weeks: 3,     // ローテーション週数（直近N週除外）
    meal_config: {
      lunch:  { sides: 0, soup: false },
      dinner: { sides: 2, soup: false }
    },
    recipe_sites: [
      { id:"nadia",   label:"Nadia",      url:"https://oceans-nadia.com/search?q={dish}" },
      { id:"cookpad", label:"クックパッド", url:"https://cookpad.com/search/{dish}" },
      { id:"youtube", label:"YouTube",    url:"https://www.youtube.com/results?search_query={dish}+レシピ" },
      { id:"insta",   label:"Instagram",  url:"https://www.instagram.com/explore/tags/{dish}レシピ" }
    ]
  }
}
```

---

## 旧データ互換マイグレーション（migrateSettings）
- `cat_R` / `cat_L` → `sort_cats` 配列に変換
- `day_groups` が配列形式 `[["mon","wed"],...]` → 辞書形式 `{monday:1,...}` に変換

---

## 献立タブ（MenuScreen）

### 表示
- ヘッダー: 「こんだて野郎」（サブに週開始日）
- 使いたい食材フリーワード入力欄（「これでも食らえ」の上）
- 「これでも食らえ」ボタン → AI献立生成
- 献立がある場合「🛒 買い物リストを更新」ボタン

### グループカード（GroupCard）
- ヘッダー: グループ色 + 曜日ラベル + 「↕ 入替」ボタン（グループ単位の入替）
- 主菜名 + 評価⭐平均 + 難易度タグ
- 副菜1・副菜2 それぞれ表示
- **ドラッグ＆ドロップ**: 主菜・副菜1・副菜2 それぞれのスロットをドラッグして別スロットと入れ替え可能（グループ間・スロット間どちらも可）
- **🔍ボタン**: 各料理（主菜・副菜）の横に配置。タップするとDishActionSheetが開く
- グループカード上に「変更」「削除」の単独ボタンは**ない**

### DishActionSheet（🔍タップ時のBottomSheet）
各料理に対して以下を選択できる：
- 登録済みレシピURLがある場合は上部に表示（タップで開く）
- Nadia / クックパッド / YouTube / Instagram でレシピを探す
- 🔗 レシピURLを登録 → `dishes[name].recipeUrl` に保存。次回買い物リスト生成時にURLから食材を取得（インスタは除外）
- 🔄 この料理を変更（AI提案）→ 変更シートへ（使いたい食材 + 除外カテゴリ選択）
- 🗑️ この料理を削除（そのスロットを空にする）

### グループ入替（↕ 入替）
- グループヘッダーの「↕ 入替」ボタン → BottomSheetで対象グループを選択 → 主菜・副菜ごと丸ごと入れ替え

---

## 評価タブ（RatingScreen）
- 今週のplan.groupsの全料理（主菜・副菜）を一覧表示
- 各料理に ★1〜5 の評価ボタン → `dishes[name].scores` に追加（直近10件保持）
- 難易度ボタン（かんたん/ふつう/本格）→ `dishes[name].difficulty` を更新

## 手動レシピ登録（CustomRecipesEditor）の評価
- 評価入力は★1〜5のボタン選択式（評価タブと統一）
- 数字入力欄は使わない

---

## 買い物タブ（ShopScreen）
### Step1: 食材確認
- sessionのitemsをingredient/seasoningに分けてタグ表示
- **食材（ingredient）はデフォルトON、調味料（seasoning）はデフォルトOFF**
- タップでexcluded切替（取り消し線）
- **長押しで量を編集**できるシートが開く
  - 「保存して次回以降も自動計算」→ 入力量÷（人数×日数）で1人前量を`ingredientMem`に保存
  - 「今回だけ変更」→ 今週のセッションのみ反映
- 食材の自由追加フォーム（入力→追加ボタン or Enter）

### Step2: 日用品
- dailyGoodsマスタをタグ表示
- タップで選択/解除（session.dailyGoodsに反映）

### Step3: 仕分けスワイプ
- 未仕分け食材を1枚ずつカード表示
- mount時に未仕分けリストを1回だけ確定（途中で変化しない）
- sort_catsのdir（right/left/up/down）に対応したボタン配置
- タッチスワイプでも仕分け可能
- 「← 1つ戻る」「🔄 全リセット」ボタン
- sortMemに仕分け結果を記憶

### Step4: 確認・送信
- 今週の献立（主菜+食材、副菜+食材）を表示
- 買い物リストをsort_catsごとに分類表示
- 「📲 LINEに送信」→ LINE Notify API
- 「📋 コピーしてLINEに貼付」→ クリップボード

---

## 設定タブ（SettingsScreen）

| セクション | 内容 |
|---|---|
| 📊 Googleスプレッドシート | GAS URL + トークン + 接続テスト + 今すぐ読み込み |
| 📲 LINE Notify | トークン入力 |
| 📅 曜日グループ | DayGroupEditor（後述） |
| ❄️ 冷凍食品 | FrozenMealsEditor（曜日×昼夜グリッド） |
| 🚫 NG食材 | NgFoodsEditor（追加・削除） |
| 👨‍👩‍👧 1食の人数 | 1〜5人ボタン |
| 🔄 ローテーション | 1〜6週ボタン |
| 🍽 食事構成 | MealConfigEditor（昼夜×おかず品数・汁物） |
| ↔️ 仕分けカテゴリ | SortCatsEditor（追加・削除・方向設定・最大4つ） |
| 🔍 レシピ検索サイト | サイト名編集 |
| 📖 手動レシピ登録 | CustomRecipesEditor（料理名・食材・URL・★評価） |
| 🧴 日用品リスト | 追加・削除 |
| 🗑️ データ管理 | 献立・買い物リストリセット |

---

## 曜日グループ設定（DayGroupEditor）★重要★

### データ形式
```js
// ★ 辞書形式を厳守。配列形式は使わない
day_groups: { monday:1, tuesday:2, wednesday:1, thursday:2, friday:1, saturday:3, sunday:4 }
```

### deriveGroups(day_groups) の戻り値
```js
// 辞書から配列に変換
[
  { gid:1, rep:"monday",   days:["monday","wednesday","friday"], label:"月・水・金" },
  { gid:2, rep:"tuesday",  days:["tuesday","thursday"],          label:"火・木" },
  { gid:3, rep:"saturday", days:["saturday"],                    label:"土" },
  { gid:4, rep:"sunday",   days:["sunday"],                      label:"日" },
]
```

### UIの動作
- 月〜日の7ボタンを横並び表示
- 各ボタンはそのグループ番号の色で表示（GROUP_COLORS[gid-1]）
- タップするたびに現在のGID+1へ。G7を超えたらG1に戻る
- 新グループ作成は `Math.min(現在の最大GID + 1, 7)` まで可能
- サイクル例：G1→G2→G3→...→G7→G1
- ボタン下に「G{n}」と番号表示
- 下にサマリー（G1: 月・水・金（3日間・同一献立）など）

---

## 仕分けカテゴリ（SortCatsEditor）
- 最大4つ（right/left/up/down の4方向に1つずつ）
- 各カテゴリに: 名前入力 + 色（自動割当）+ 方向ボタン（→←↑↓）
- 追加ボタン（4つ未満のとき表示）
- 削除ボタン（1つ以上ある場合）

---

## AI連携
### 献立生成（buildMenu）
渡す情報:
- グループ構成（deriveGroupsの結果）
- 冷凍食品固定枠
- NG食材
- 直近N週の除外リスト（rotation_weeks）
- 過去評価（4点以上を優先）
- 手動登録レシピ
- 使いたい食材（フリーワード）
- 人数

### 買い物リスト生成（buildShoppingItems）
渡す情報:
- グループ×日数×人数×料理名（主菜・副菜）
- AIへのプロンプトに「肉・魚は1人前150g、卵は1個、野菜は80g」の基準量を明示
- レシピURL登録済みの料理はURLから食材を取得（インスタはAI生成）
- groupIdx・dishType（main/side1/side2）・dishName を食材ごとに付与

処理の流れ:
1. AIに食材リストを生成させる
2. 同一食材名をマージ（量は連結表示）
3. ingredientMemに記憶がある食材は1人前量×人数×日数で量を上書き
4. 調味料（seasoning）はexcluded=trueでセット（デフォルトOFF）
5. sortMemのキーは食材名のみ（量を含まない）

---

## Google Apps Script（GoogleAppsScript.gs）
- GET: データ取得（token認証あり）
- POST: データ保存（A1セルにJSON、B1に最終更新日時）
- シート名: "data"

---

## ホームアイコン
- public/icon-192.png, icon-512.png（弁当箱グラフィック）
- public/icon.svg（SVGフォールバック）
- public/manifest.json（PWA設定、theme_color: #1B5E20）
- index.html に apple-touch-icon / manifest リンクあり

---

## 開発ルール（必ず守ること）
1. 依頼されていない仕様・UIを絶対に勝手に変更・削除しない
2. ロジック的に動かなくなる場合のみ事前に許可を取る
3. コーディング後はこの仕様書と照合してチェックする
4. `day_groups` は必ず辞書形式 `{monday:N, ...}` を使う（配列にしない）
5. str_replace での修正前に必ず view で現在の内容を確認する

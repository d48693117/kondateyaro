# こんだて野郎 仕様書
最終更新: 2026-05-27

---

## デプロイ情報
- URL: kondateyaro.vercel.app
- リポジトリ: GitHub / d48693117/kondateyaro
- フレームワーク: React (Vite) + Vercel
- APIプロキシ一覧:
  - `/api/claude.js` → Anthropic API
  - `/api/sheets.js` → Google Apps Script（CORSバイパス）
  - `/api/fetch-url` → **未作成**（レシピURL食材取得用・将来実装予定）
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
    weekStart: "2026-05-27",
    groups: [
      {
        days: ["monday","wednesday","friday"],  // 設定側のdaysを使用（AI出力のdaysは無視）
        lunch: {
          main: "焼きそば",  // 一品完結のみ（焼きそば・丼・パスタ等）
          cat: "麺・パスタ",
          diff: 1
        },
        dinner: {
          main: "生姜焼き",  // 肉か魚料理のみ
          sides: ["ひじき煮", "ポテトサラダ"],
          cat: "肉",
          diff: 2
        },
        score: null
      }, ...
    ]
  },
  session: {
    weekStart: "2026-05-27",
    items: [
      {
        id: "item_xxx",
        groupIdx: 0,       // plan.groupsのインデックス
        dishType: "main" | "side1" | "side2",
        dishName: "生姜焼き",
        name: "豚ロース",
        qty: "600g",
        type: "ingredient" | "seasoning",
        floor: "R" | "L" | null,
        excluded: false    // 調味料はデフォルトtrue
      }
    ],
    dailyGoods: [
      { id: "dg_xxx", name: "シャンプー", selected: true, floor: "R" | null }
    ]
  },
  sortMem: { "豚ロース": "R", ... },          // 食材名のみキー（量を含まない）
  ingredientMem: { "豚ロース": 150, "豚ロース_unit": "g", ... },  // 1人前量の記憶
  dailyGoods: ["シャンプー", "洗剤", ...],    // 日用品マスタ（文字列配列）
  dishes: {
    "生姜焼き": {
      scores: [4, 5],       // 直近10件の評価
      difficulty: 2,
      lastServed: "2026-05-27",
      recipeUrl: "https://..."  // 任意
    }
  },
  customRecipes: [           // 必ず配列（{}ではない）
    { id:"cr_xxx", name:"料理名", ingredients:"食材", url:"https://...", score:4 }
  ],
  settings: {
    day_groups: { monday:1, tuesday:2, wednesday:1, thursday:2, friday:1, saturday:3, sunday:4 },
    frozen_meals: ["saturday_lunch", "sunday_lunch"],
    ng_foods: ["えび"],       // 文字列配列のみ
    sort_cats: [
      { id:"R", name:"2階", color:"#00897B", dir:"right" },
      { id:"L", name:"3階", color:"#1565C0", dir:"left"  }
      // 最大4つ、dir: right/left/up/down
    ],
    sheets_url: "", sheets_token: "",
    line_token: "",  // コードに残存するがUIは非表示（LINE Notifyサービス終了のため）
    servings: 2,
    rotation_weeks: 3,
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

## データ安全化（sanitizeState）
**対象: state全体**。localStorage読込・Sheets読込（起動時・loadNow）の全箇所で実行：
- `customRecipes` → 配列でなければ `[]` に
- `dailyGoods` → 文字列以外の要素を除去
- `ng_foods` → 文字列以外の要素を除去
- `sort_cats` / `recipe_sites` → 不正形式ならデフォルト値に
- `day_groups` → 配列形式なら辞書形式に変換

## 旧データ互換マイグレーション（migrateSettings）
**対象: settings内のみ**。loadState内でsanitizeStateの前に実行：
- `cat_R` / `cat_L` → `sort_cats` 配列に変換
- `day_groups` 配列形式 → 辞書形式に変換（sanitizeStateでも対応）

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
- **ドラッグ＆ドロップ**: 主菜・副菜スロットをドラッグして入れ替え（グループ間・スロット間可）
- **🔍ボタン**: 各料理横に配置 → DishActionSheetを開く
- グループカード上に単独の「変更」「削除」ボタンはない

### DishActionSheet（🔍タップ時のBottomSheet）
- 登録済みレシピURLがある場合は上部に表示
- Nadia / クックパッド / YouTube / Instagram でレシピを探す
- 🔗 レシピURLを登録 → `dishes[name].recipeUrl` に保存
- 🔄 この料理を変更（AI提案）→ 変更シートへ
  - `slotKey`（"main"/"side0"/"side1"）を渡して該当スロットのみ更新
  - mainは肉か魚料理のみ提案、副菜は家庭的なおかずのみ提案
- 🗑️ この料理を削除

### グループ入替（↕ 入替）
- グループヘッダーの「↕ 入替」→ 対象グループ選択 → 主菜・副菜丸ごと入れ替え

---

## 評価タブ（RatingScreen）
- 今週の全料理（主菜・副菜）を一覧表示
- ★1〜5評価 → `dishes[name].scores` に追加（直近10件保持）
- 難易度ボタン（かんたん/ふつう/本格）→ `dishes[name].difficulty` を更新

## 手動レシピ登録（CustomRecipesEditor）
- 評価入力は★1〜5ボタン選択式

---

## 買い物タブ（ShopScreen）

### Step1: 食材確認
- ingredient/seasoningに分けてタグ表示
- **食材（ingredient）デフォルトON、調味料（seasoning）デフォルトOFF**
- タップでexcluded切替
- **長押しで量を編集** → 「保存して次回以降も自動計算」で1人前量をingredientMemに保存
- 食材の自由追加フォーム

### Step2: 日用品
- dailyGoodsマスタをタグ表示（文字列）
- タップで選択/解除

### Step3: 仕分けスワイプ
- mount時に未仕分けリストを1回だけ確定
- sort_catsのdir（right/left/up/down）対応ボタン + タッチスワイプ
- 「← 1つ戻る」「🔄 全リセット」ボタン
- sortMemに仕分け結果を記憶（キー=食材名のみ）

### Step4: 確認・送信
- 今週の献立（主菜+食材、副菜+食材）表示。調味料・仕分け先は表示
- 登録済みレシピURLも表示
- 「📋 LINEに貼付用コピー」→ クリップボードにコピー（UIはコピーボタンのみ。LINE Notifyはサービス終了のためUIから削除済みだがコードは残存）
- LINEメッセージ: 献立+レシピURL+食材（調味料除外）+買い物リスト

---

## 設定タブ（SettingsScreen）
| セクション | 内容 |
|---|---|
| 📊 Googleスプレッドシート | GAS URL + トークン + 接続テスト + 今すぐ読み込み |
| 📅 曜日グループ | DayGroupEditor |
| ❄️ 冷凍食品 | FrozenMealsEditor（曜日×昼夜グリッド） |
| 🚫 NG食材 | NgFoodsEditor（追加・削除） |
| 👨‍👩‍👧 1食の人数 | 1〜5人ボタン |
| 🔄 ローテーション | 1〜6週ボタン |
| 🍽 食事構成 | MealConfigEditor（おかず品数・汁物） |
| ↔️ 仕分けカテゴリ | SortCatsEditor（追加・削除・方向・最大4つ） |
| 🔍 レシピ検索サイト | サイト名編集 |
| 📖 手動レシピ登録 | CustomRecipesEditor |
| 🧴 日用品リスト | 追加・削除 |
| 🗑️ データ管理 | 献立・買い物リストリセット |

---

## 曜日グループ設定（DayGroupEditor）★重要★

### データ形式
```js
// ★ 辞書形式を厳守。配列にしない
day_groups: { monday:1, tuesday:2, wednesday:1, thursday:2, friday:1, saturday:3, sunday:4 }
```

### deriveGroups(day_groups) の戻り値
```js
[
  { gid:1, days:["monday","wednesday","friday"], label:"月・水・金" },
  { gid:2, days:["tuesday","thursday"],          label:"火・木" },
  { gid:3, days:["saturday"],                    label:"土" },
  { gid:4, days:["sunday"],                      label:"日" },
]
```

### UIの動作
- 月〜日の7ボタンを横並び表示
- タップするたびにGID+1へ。G7を超えたらG1に戻る
- 新グループは Math.min(現在の最大GID+1, 7) まで
- ボタン下に「G{n}」表示、下にサマリー

---

## 仕分けカテゴリ（SortCatsEditor）
- 最大4つ（right/left/up/down）
- 各カテゴリ: 名前 + 色（自動割当）+ 方向ボタン
- 追加ボタン（4つ未満のとき）、削除ボタン

---

## AI連携

### 献立生成（buildMenu）
- グループを番号付きで明示（「G1: 月・水、G2: 火・木...」）
- **昼食（lunch）**: 一品完結のみ（焼きそば・丼・パスタ・チャーハン等）。sidesなし
- **夕食（dinner）**: mainは肉か魚料理のみ。土日グループは丼もの必須
- 同日の昼夜で同じ食材をメインにしない
- 汁物設定（meal_config.dinner.soup）に応じて副菜フィルタリング
- AIの返すdaysフィールドは無視し、設定側のdaysを使用
- グループ数不足の場合は最大2回リトライ、それでも失敗したらエラー表示
- 冷凍食品強制適用: `frozen_meals` 設定に基づき昼・夜それぞれ強制上書き（土日の自動固定はなし）

### 料理の変更（handleChangeMain）
- `slotKey` で変更対象スロットを特定:
  - `"lunch_main"` → `g.lunch.main`（昼食・一品完結のみ提案）
  - `"dinner_main"` → `g.dinner.main`（肉か魚料理のみ提案）
  - `"dinner_side0"` → `g.dinner.sides[0]`（副菜1）
  - `"dinner_side1"` → `g.dinner.sides[1]`（副菜2）
- 他のグループ・他のスロットは変更しない

### 買い物リスト生成（buildShoppingItems）
- 日数×人数（totalPersons）分の量を計算
- 肉・魚1人前150g、卵1個、野菜80g基準
- レシピURL登録済みの料理はURLから食材取得（インスタはAI生成）
- 同一食材名をマージ
- ingredientMemに記憶がある場合は1人前量×人数×日数で上書き
- 調味料はexcluded=true（qty=""）

---

## Google Apps Script（GoogleAppsScript.gs）
- GET: データ取得（token認証あり）
- POST: データ保存（A1セルにJSON、B1に最終更新日時）
- シート名: "data"
- デプロイ設定: 次のユーザーとして実行=**自分**、アクセス=**Googleアカウントを持つ全員**
- アプリ→ `/api/sheets.js` プロキシ経由（CORS回避）
- 変更から2秒後に自動同期。別端末では「今すぐ読み込み」で取得

---

## ホームアイコン
- public/icon-192.png, icon-512.png（人物画・正方形・maskable対応）
- public/manifest.json（PWA設定、purpose: "any maskable"）
- index.html に apple-touch-icon / manifest リンクあり
- ローディング中オーバーレイ: icon-512.pngがズームインアニメーション

---

## エラーバウンダリ（ErrorBoundary）
- 設定タブを `ErrorBoundary` でラップ
- エラー発生時に「⚠️ 表示エラー」とメッセージを表示、再試行ボタンあり

---

## 開発ルール（必ず守ること）
1. **依頼されていない仕様・UIを絶対に勝手に変更・削除しない**
2. ロジック的に動かなくなる場合のみ事前に許可を取る
3. コーディング前に必ずこの仕様書を確認する
4. コーディング後はこの仕様書と照合してチェックする
5. `day_groups` は必ず辞書形式 `{monday:N, ...}` を使う（配列にしない）
6. str_replace での修正前に必ず view で現在の内容を確認する
7. コーディングする前に修正方針を提示し、OKが出てから書く

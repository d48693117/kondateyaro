import { useState, useEffect, useRef } from "react";

/* ══════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════ */
const MODEL  = "claude-sonnet-4-5";
const DB_KEY = "kondateyaro-v1";
const DAYS   = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const DAY_JP = {monday:"月",tuesday:"火",wednesday:"水",thursday:"木",friday:"金",saturday:"土",sunday:"日"};

const GROUP_COLORS = ["#2E7D32","#1565C0","#E65100","#6A1B9A","#00695C","#AD1457","#37474F"];
const GROUP_LIGHT  = ["#E8F5E9","#E3F2FD","#FBE9E7","#EDE7F6","#E0F2F1","#FCE4EC","#ECEFF1"];

const DEF_DAY_GROUPS = {monday:1,tuesday:2,wednesday:1,thursday:2,friday:1,saturday:3,sunday:3};
const DEF_SORT_CATS  = [
  {id:"R",label:"2階",dir:"right",active:true},
  {id:"L",label:"3階",dir:"left", active:true},
  {id:"U",label:"",   dir:"up",   active:false},
  {id:"D",label:"",   dir:"down", active:false},
];
const DEF_MEAL_CONF = {
  lunch:  {okazu:0, soup:false},
  dinner: {okazu:2, soup:false},
};

const DIFF_LABEL = ["","⚡かんたん","👨‍🍳ふつう","🔥本格"];
const DIFF_COLOR = ["","#43A047","#FB8C00","#E53935"];
const DIR_ICON   = {right:"👉",left:"👈",up:"👆",down:"👇"};
const DIR_COLOR  = {R:"#00897B",L:"#F4511E",U:"#7E57C2",D:"#039BE5"};

const nadiaUrl    = n=>`https://oceans-nadia.com/search?q=${encodeURIComponent(n)}`;
const avg         = arr=>arr?.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
const uid         = ()=>`${Date.now()}${Math.random().toString(36).slice(2,5)}`;
const getWeekStart= ()=>{const d=new Date(),dy=d.getDay(),df=d.getDate()-dy+(dy===0?-6:1);return new Date(d.setDate(df)).toISOString().split("T")[0];};

/* ══════════════════════════════════════════
   PRE-LOADED DISH DATA (from LINE history)
══════════════════════════════════════════ */
const INITIAL_DISHES = {
  // ── 肉メイン ──
  "唐揚げ":                {cat:"肉",diff:2,scores:[4],lastServed:""},
  "塩唐揚げ":              {cat:"肉",diff:2,scores:[4],lastServed:""},
  "大葉塩唐揚げ":          {cat:"肉",diff:2,scores:[4],lastServed:""},
  "唐揚げ丼":              {cat:"丼",diff:2,scores:[4],lastServed:""},
  "竜田丼":                {cat:"丼",diff:2,scores:[4],lastServed:""},
  "ハンバーグ":             {cat:"肉",diff:2,scores:[4],lastServed:""},
  "豆腐ハンバーグ":         {cat:"肉",diff:2,scores:[4],lastServed:""},
  "プルコギ":               {cat:"肉",diff:2,scores:[4],lastServed:""},
  "豚キャベもやし":         {cat:"肉",diff:1,scores:[3],lastServed:""},
  "豚キャベ":               {cat:"肉",diff:1,scores:[3],lastServed:""},
  "豚えのきキャベ":         {cat:"肉",diff:1,scores:[3],lastServed:""},
  "豚レンコン":             {cat:"肉",diff:2,scores:[4],lastServed:""},
  "豚こま大根":             {cat:"肉",diff:1,scores:[3],lastServed:""},
  "豚ニラ焼きそば":         {cat:"肉",diff:1,scores:[3],lastServed:""},
  "豚キムチ豆腐":           {cat:"肉",diff:1,scores:[3],lastServed:""},
  "ねぎ塩豚レモン":         {cat:"肉",diff:1,scores:[4],lastServed:""},
  "ロールキャベツ":         {cat:"肉",diff:3,scores:[4],lastServed:""},
  "ローストポーク":         {cat:"肉",diff:2,scores:[4],lastServed:""},
  "ローストポーク丼":       {cat:"丼",diff:2,scores:[4],lastServed:""},
  "メンチカツ":             {cat:"肉",diff:1,scores:[3],lastServed:""},
  "手羽元":                 {cat:"肉",diff:2,scores:[4],lastServed:""},
  "手羽とうもろこし":       {cat:"肉",diff:2,scores:[4],lastServed:""},
  "肉豆腐":                 {cat:"肉",diff:1,scores:[3],lastServed:""},
  "ヤンニョムポーク丼":     {cat:"丼",diff:2,scores:[4],lastServed:""},
  "タコライス丼":           {cat:"丼",diff:2,scores:[4],lastServed:""},
  "キムチ豚丼":             {cat:"丼",diff:1,scores:[4],lastServed:""},
  "菜の花ロール":           {cat:"肉",diff:2,scores:[3],lastServed:""},
  "ズッキーニ肉巻き":       {cat:"肉",diff:2,scores:[3],lastServed:""},
  "エリンギのローストサンド":{cat:"肉",diff:2,scores:[3],lastServed:""},
  // ── 鶏メイン ──
  "サラダチキン":           {cat:"肉",diff:1,scores:[4],lastServed:""},
  "ハニーマスタードチキンサラダ":{cat:"肉",diff:2,scores:[5],lastServed:""},
  "マスタードチキンサラダ": {cat:"肉",diff:2,scores:[5],lastServed:""},
  "棒棒鶏サラダ":           {cat:"肉",diff:2,scores:[4],lastServed:""},
  "チキンスティック":       {cat:"肉",diff:1,scores:[4],lastServed:""},
  "ガパオサラダ":           {cat:"肉",diff:2,scores:[5],lastServed:""},
  "ガパオ":                 {cat:"肉",diff:2,scores:[5],lastServed:""},
  "油淋鶏":                 {cat:"肉",diff:2,scores:[4],lastServed:""},
  "タンドリーサラダ":       {cat:"肉",diff:2,scores:[4],lastServed:""},
  "チンジャオロース":       {cat:"肉",diff:2,scores:[4],lastServed:""},
  "鶏むねガーリック醤油":   {cat:"肉",diff:1,scores:[5],lastServed:""},
  "鶏むねレモンクリーム":   {cat:"肉",diff:2,scores:[4],lastServed:""},
  "鶏と茄子のコク旨煮":     {cat:"肉",diff:2,scores:[5],lastServed:""},
  "鶏むね甘辛スティック":   {cat:"肉",diff:1,scores:[4],lastServed:""},
  "鶏ムネ甘辛スティック":   {cat:"肉",diff:1,scores:[4],lastServed:""},
  "よだれ鶏豆腐":           {cat:"肉",diff:2,scores:[4],lastServed:""},
  "鳥なす":                 {cat:"肉",diff:2,scores:[4],lastServed:""},
  "とりモモのみぞれ煮":     {cat:"肉",diff:2,scores:[4],lastServed:""},
  "鶏とナスのミゾレ煮":     {cat:"肉",diff:2,scores:[4],lastServed:""},
  "チキンクリーム":         {cat:"肉",diff:2,scores:[4],lastServed:""},
  "参鶏湯":                 {cat:"肉",diff:2,scores:[5],lastServed:""},
  "根菜煮":                 {cat:"肉",diff:2,scores:[4],lastServed:""},
  "鶏れんこん":             {cat:"肉",diff:2,scores:[4],lastServed:""},
  "バターチキンカレー":     {cat:"肉",diff:2,scores:[5],lastServed:""},
  "オーブン焼き":           {cat:"肉",diff:1,scores:[4],lastServed:""},
  "鶏団子スープ":           {cat:"肉",diff:2,scores:[4],lastServed:""},
  "鶏団子の和風あんかけ":   {cat:"肉",diff:2,scores:[4],lastServed:""},
  "鶏肉ロール":             {cat:"肉",diff:3,scores:[5],lastServed:""},
  "おろぽんチキン":         {cat:"肉",diff:1,scores:[3],lastServed:""},
  "かぶのスープ":           {cat:"肉",diff:1,scores:[3],lastServed:""},
  "つくね":                 {cat:"肉",diff:2,scores:[4],lastServed:""},
  // ── 魚メイン ──
  "アジフライ":             {cat:"魚",diff:2,scores:[4],lastServed:""},
  "鯖キムチ茶漬け":         {cat:"魚",diff:1,scores:[4],lastServed:""},
  // ── 丼・週末 ──
  "親子丼":                 {cat:"丼",diff:1,scores:[5],lastServed:""},
  "麻婆豆腐丼":             {cat:"丼",diff:2,scores:[4],lastServed:""},
  "チキンカツ丼":           {cat:"丼",diff:2,scores:[4],lastServed:""},
  "そぼろ丼":               {cat:"丼",diff:1,scores:[4],lastServed:""},
  "鶏アボカド丼":           {cat:"丼",diff:1,scores:[4],lastServed:""},
  "まぐろたたき丼":         {cat:"丼",diff:1,scores:[4],lastServed:""},
  "ねぎとろ丼":             {cat:"丼",diff:1,scores:[4],lastServed:""},
  "豆腐卵とじ丼":           {cat:"丼",diff:1,scores:[3],lastServed:""},
  "天津飯":                 {cat:"丼",diff:1,scores:[4],lastServed:""},
  "アボカドしらす丼":       {cat:"丼",diff:1,scores:[4],lastServed:""},
  "三色丼":                 {cat:"丼",diff:1,scores:[4],lastServed:""},
  "カツ丼":                 {cat:"丼",diff:2,scores:[4],lastServed:""},
  "ドライカレー":           {cat:"丼",diff:2,scores:[4],lastServed:""},
  "オムハヤシ":             {cat:"丼",diff:2,scores:[4],lastServed:""},
  "オムライス":             {cat:"丼",diff:2,scores:[4],lastServed:""},
  // ── カレー ──
  "カレー":                 {cat:"丼",diff:1,scores:[5],lastServed:""},
  "キーマカレー":           {cat:"丼",diff:2,scores:[5],lastServed:""},
  "カツカレー":             {cat:"丼",diff:2,scores:[4],lastServed:""},
  // ── 鍋・スープ系メイン ──
  "鶏鍋":                   {cat:"肉",diff:1,scores:[4],lastServed:""},
  "しゃぶしゃぶ":           {cat:"肉",diff:1,scores:[4],lastServed:""},
  "キムチ鍋":               {cat:"肉",diff:1,scores:[5],lastServed:""},
  "お好み焼き":             {cat:"その他",diff:2,scores:[4],lastServed:""},
  "海鮮お好み焼き":         {cat:"その他",diff:2,scores:[4],lastServed:""},
  "チヂミ":                 {cat:"その他",diff:2,scores:[4],lastServed:""},
  "餃子":                   {cat:"肉",diff:2,scores:[4],lastServed:""},
  "麻婆豆腐":               {cat:"卵・豆腐",diff:2,scores:[4],lastServed:""},
  "なすのラザニア":         {cat:"肉",diff:3,scores:[4],lastServed:""},
  "ミートソースドリア":     {cat:"肉",diff:2,scores:[4],lastServed:""},
  "ポテトグラタン":         {cat:"その他",diff:2,scores:[4],lastServed:""},
  "カレーつけ麺":           {cat:"麺・パスタ",diff:2,scores:[4],lastServed:""},
  "野菜ラーメン":           {cat:"麺・パスタ",diff:1,scores:[3],lastServed:""},
  "ささみサラダ":           {cat:"肉",diff:1,scores:[4],lastServed:""},
  // ── 昼メイン ──
  "焼きそば":               {cat:"麺・パスタ",diff:1,scores:[4],lastServed:""},
  "焼きうどん":             {cat:"麺・パスタ",diff:1,scores:[4],lastServed:""},
  "ざるそば":               {cat:"麺・パスタ",diff:1,scores:[3],lastServed:""},
  "パスタ":                 {cat:"麺・パスタ",diff:1,scores:[3],lastServed:""},
  "鮭パスタ":               {cat:"麺・パスタ",diff:1,scores:[4],lastServed:""},
  "納豆パスタ":             {cat:"麺・パスタ",diff:1,scores:[4],lastServed:""},
  "ミートソースパスタ":     {cat:"麺・パスタ",diff:1,scores:[3],lastServed:""},
  "ピリ辛まぜそば":         {cat:"麺・パスタ",diff:1,scores:[5],lastServed:""},
  "まぜそば":               {cat:"麺・パスタ",diff:1,scores:[4],lastServed:""},
  "チャーハン":             {cat:"丼",diff:1,scores:[3],lastServed:""},
  "納豆キムチチャーハン":   {cat:"丼",diff:1,scores:[4],lastServed:""},
  "海鮮キムチチャーハン":   {cat:"丼",diff:1,scores:[4],lastServed:""},
  "そぼろキムチ丼":         {cat:"丼",diff:1,scores:[4],lastServed:""},
  "ピリ辛ひき肉丼":         {cat:"丼",diff:1,scores:[4],lastServed:""},
  "プルコギ丼":             {cat:"丼",diff:1,scores:[4],lastServed:""},
  "鶏そば":                 {cat:"麺・パスタ",diff:1,scores:[4],lastServed:""},
  "鶏にゅうめん":           {cat:"麺・パスタ",diff:1,scores:[4],lastServed:""},
  "ボロネーゼパスタ":       {cat:"麺・パスタ",diff:2,scores:[4],lastServed:""},
  "つけそば":               {cat:"麺・パスタ",diff:2,scores:[4],lastServed:""},
  "あんかけそば":           {cat:"麺・パスタ",diff:1,scores:[3],lastServed:""},
  "だし茶漬け":             {cat:"丼",diff:1,scores:[4],lastServed:""},
  "鮭茶漬け":               {cat:"丼",diff:1,scores:[4],lastServed:""},
  "しらす明太だし茶漬け":   {cat:"丼",diff:1,scores:[5],lastServed:""},
  "豚塩うどん":             {cat:"麺・パスタ",diff:1,scores:[3],lastServed:""},
  "坦々スープもち":         {cat:"麺・パスタ",diff:2,scores:[4],lastServed:""},
};

/* ══════════════════════════════════════════
   HELPERS
══════════════════════════════════════════ */
const deriveGroups=dg=>{
  const map={};
  DAYS.forEach(day=>{const g=(dg||DEF_DAY_GROUPS)[day]??1;if(!map[g])map[g]=[];map[g].push(day);});
  return Object.entries(map).sort((a,b)=>DAYS.indexOf(a[1][0])-DAYS.indexOf(b[1][0]))
    .map(([gid,days])=>({gid:Number(gid),rep:days[0],days,label:days.map(d=>DAY_JP[d]).join("・")}));
};
const isFrozen=(day,meal,fm)=>(fm||[]).includes(`${day}_${meal}`);
const avgScore=(dishes,name)=>(!name||!dishes?.[name]?.scores?.length)?null:avg(dishes[name].scores);

const mkEmptyMeal=()=>({main:"",cat:"",diff:1,recipe:""});
const mkPlan=()=>Object.fromEntries(DAYS.map(d=>[d,{
  lunch: {...mkEmptyMeal(),okazu:[],soup:""},
  dinner:{...mkEmptyMeal(),okazu:[],soup:""},
}]));

const mkState=()=>({
  plan:mkPlan(),
  dishes:JSON.parse(JSON.stringify(INITIAL_DISHES)),
  sortMem:{},dailyGoods:[],customRecipes:[],session:null,lineHist:"",
  settings:{
    line_token:"",rotation_weeks:3,sort_cats:DEF_SORT_CATS,
    day_groups:DEF_DAY_GROUPS,frozen_meals:["saturday_lunch","sunday_lunch"],
    ng_foods:[],meal_conf:DEF_MEAL_CONF,
  },
});

const migrateSettings=s=>({
  ...mkState().settings,...s,
  sort_cats:s.sort_cats||DEF_SORT_CATS,
  day_groups:s.day_groups||DEF_DAY_GROUPS,
  frozen_meals:s.frozen_meals||["saturday_lunch","sunday_lunch"],
  ng_foods:s.ng_foods||[],
  meal_conf:s.meal_conf||DEF_MEAL_CONF,
});

const emojiOf=n=>{
  if(/鶏|豚|牛|ひき|ソーセージ|ベーコン/.test(n))return"🥩";
  if(/魚|鮭|さば|たら|ぶり|あじ|鯛|えび|いか|かつ|ツナ/.test(n))return"🐟";
  if(/卵|たまご/.test(n))return"🥚";
  if(/豆腐|豆|納豆|厚揚|油揚/.test(n))return"🥣";
  if(/キャベツ|玉ねぎ|にんじん|大根|ほうれん|ブロッコリー|トマト|じゃがいも|なす|ピーマン|もやし|ねぎ|野菜|レタス|きゅうり/.test(n))return"🥦";
  if(/きのこ|しいたけ|えのき|まいたけ/.test(n))return"🍄";
  if(/醤油|みりん|料理酒|砂糖|塩|酢|味噌|だし|ごま油|サラダ油|マヨ|ケチャップ|片栗|小麦粉/.test(n))return"🫙";
  if(/ご飯|米|パスタ|麺|うどん|そば|そうめん/.test(n))return"🍚";
  if(/シャンプー|洗剤|ティッシュ|トイレ|石鹸|歯ブラシ|洗濯/.test(n))return"🧴";
  return"🛒";
};

/* ══════════════════════════════════════════
   STORAGE (localStorage for web app)
══════════════════════════════════════════ */
const db={
  load(){
    try{const r=localStorage.getItem(DB_KEY);return r?JSON.parse(r):null;}
    catch{return null;}
  },
  save(d){
    try{localStorage.setItem(DB_KEY,JSON.stringify(d));}catch{}
  }
};

/* ══════════════════════════════════════════
   AI
══════════════════════════════════════════ */


async function callAI(sys,msg,max=2000){
 const r=await fetch("/api/claude",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:MODEL,max_tokens:max,system:sys,messages:[{role:"user",content:msg}]})
  });
  const d=await r.json();
  if(!d.content)throw new Error(JSON.stringify(d));
  return d.content[0].text;
}
const pj=s=>JSON.parse(s.replace(/```json\s*/g,"").replace(/```\s*/g,"").trim());

/* ══════════════════════════════════════════
   CSS
══════════════════════════════════════════ */
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap');
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;margin:0;padding:0;}
body{background:#F7F8FA;}
button{font-family:'Noto Sans JP',sans-serif;cursor:pointer;transition:transform .12s;}
button:active:not(:disabled){transform:scale(.95);}
input,textarea{font-family:'Noto Sans JP',sans-serif;}
::-webkit-scrollbar{width:0;}
@keyframes fadeup{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
@keyframes scalein{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}
@keyframes slideup{from{transform:translateY(100%)}to{transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes bounce{0%{transform:scale(0)}65%{transform:scale(1.2)}100%{transform:scale(1)}}
`;

/* ══════════════════════════════════════════
   APP ROOT
══════════════════════════════════════════ */
export default function App(){
  const [sc,setSc]      =useState("plan");
  const [st,setSt]      =useState(mkState());
  const [busy,setBusy]  =useState(false);
  const [bMsg,setBMsg]  =useState("");
  const [toast,setToast]=useState(null);
  const [rdy,setRdy]    =useState(false);
  const [kw,setKw]      =useState("");
  const snap=useRef(st);
  useEffect(()=>{snap.current=st;},[st]);

  useEffect(()=>{
    const d=db.load();
    if(d){
      const s={...mkState(),...d};
      if(d.settings)s.settings=migrateSettings(d.settings);
      // Merge new initial dishes without overwriting user scores
      const merged={...INITIAL_DISHES};
      Object.entries(d.dishes||{}).forEach(([k,v])=>{merged[k]={...merged[k],...v};});
      s.dishes=merged;
      setSt(s);
    }
    setRdy(true);
  },[]);

  const save=patch=>{const next={...snap.current,...patch};setSt(next);snap.current=next;db.save(next);};
  const notify=msg=>{setToast(msg);setTimeout(()=>setToast(null),3200);};

  const buildSys=(extra="")=>{
    const {dishes,settings,lineHist,customRecipes}=snap.current;
    const {rotation_weeks:rotW,day_groups,frozen_meals,ng_foods,meal_conf}=settings;
    const groups=deriveGroups(day_groups);
    const cutoff=Date.now()-((rotW||3)*7*86400000);
    const recent=Object.entries(dishes).filter(([,v])=>v.lastServed&&new Date(v.lastServed)>cutoff).map(([k])=>k).join("、")||"なし";
    const highRated=Object.entries(dishes).filter(([,v])=>avg(v.scores||[])>=4).map(([k])=>k).join("、")||"なし";
    const scoreInfo=Object.entries(dishes).filter(([,v])=>v.scores?.length).map(([k,v])=>`${k}:${avg(v.scores).toFixed(1)}点`).join("、")||"なし";
    const customList=customRecipes.map(r=>`${r.name}${r.score?`(${r.score}点)`:""}`).join("、")||"なし";
    const frozenInfo=(frozen_meals||[]).map(k=>{const[d,m]=k.split("_");return`${DAY_JP[d]}曜${m==="lunch"?"昼":"夜"}`;}).join("、")||"なし";
    const groupInfo=groups.map(g=>`グループ${g.gid}（${g.label}）`).join("、");
    const lc=meal_conf?.lunch||{okazu:0,soup:false};
    const dc=meal_conf?.dinner||{okazu:2,soup:false};
    return `家庭料理の献立作成AI。純粋なJSONのみ返すこと。
グループ（同じグループは同一献立）: ${groupInfo}
冷凍食品固定: ${frozenInfo}
NG食材: ${(ng_foods||[]).join("、")||"なし"}
除外（直近${rotW||3}週）: ${recent}
高評価（4点以上・優先提案）: ${highRated}
評価一覧: ${scoreInfo}
登録レシピ（優先）: ${customList}
${lineHist?`食事記録参考:\n${lineHist.slice(0,500)}`:""}
昼食構成: メイン1品${lc.okazu>0?`+おかず${lc.okazu}品`:""}${lc.soup?"+汁物":""}
夕食構成: メイン1品${dc.okazu>0?`+おかず${dc.okazu}品`:""}${dc.soup?"+汁物":""}
ルール:
・昼食メインは丼・焼きそば・パスタ・チャーハン・そば・うどん・茶漬け等一品完結の料理のみ
・同日の昼夜で同じ食材をメインに使わない
・catは「肉/魚/卵・豆腐/野菜メイン/麺・パスタ/丼/その他」
・diffは1=かんたん/2=ふつう/3=本格
・高評価料理ほど提案確率を上げる（同週連続不可）
${extra}`;
  };

  const genPlan=async(keyword="")=>{
    setBusy(true);setBMsg("🍳 献立を考えています…");
    try{
      const {settings}=snap.current;
      const {day_groups,frozen_meals,meal_conf}=settings;
      const groups=deriveGroups(day_groups);
      const lc=meal_conf?.lunch||{okazu:0,soup:false};
      const dc=meal_conf?.dinner||{okazu:2,soup:false};
      const fmtLunch=()=>{
        let s=`{"main":"料理名","cat":"丼","diff":1,"recipe":""}`;
        if(lc.okazu>0)s=s.replace("}",`,"okazu":[${Array(lc.okazu).fill('"おかず名"').join(",")}]}`);
        if(lc.soup)s=s.replace("}",`,"soup":"汁物名"}`);
        return s;
      };
      const fmtDinner=()=>{
        let s=`{"main":"料理名","cat":"肉","diff":2,"recipe":""}`;
        if(dc.okazu>0)s=s.replace("}",`,"okazu":[${Array(dc.okazu).fill('"おかず名"').join(",")}]}`);
        if(dc.soup)s=s.replace("}",`,"soup":"汁物名"}`);
        return s;
      };
      const sys=buildSys(keyword?`特別リクエスト: 「${keyword}」を使ったレシピを積極的に提案。`:"");
      const raw=await callAI(sys,`今週の献立を作成してください。7日分全て。\n返す形式:\n{"monday":{"lunch":${fmtLunch()},"dinner":${fmtDinner()}},...,"sunday":{...}}`);
      const p=pj(raw);
      groups.forEach(({rep,days})=>{days.forEach(d=>{if(d!==rep)p[d]=JSON.parse(JSON.stringify(p[rep]));});});
      DAYS.forEach(d=>{
        if(isFrozen(d,"lunch",frozen_meals))  p[d].lunch={...mkEmptyMeal(),main:"冷凍食品",okazu:[],soup:""};
        if(isFrozen(d,"dinner",frozen_meals)) p[d].dinner={...p[d].dinner,main:"冷凍食品",cat:"その他",diff:1,recipe:""};
      });
      DAYS.forEach(d=>{
        if(p[d].lunch.main&&p[d].lunch.main!=="冷凍食品")   p[d].lunch.recipe=nadiaUrl(p[d].lunch.main);
        if(p[d].dinner.main&&p[d].dinner.main!=="冷凍食品") p[d].dinner.recipe=nadiaUrl(p[d].dinner.main);
        ["lunch","dinner"].forEach(m=>{if(!Array.isArray(p[d][m].okazu))p[d][m].okazu=[];if(!p[d][m].soup)p[d][m].soup="";});
      });
      setBMsg("🛒 食材リストを作成中…");
      const shopRaw=await callAI(`献立から食材と調味料のリストを作成。重複合算。純粋なJSONのみ。形式:[{"name":"食材名","amount":"量","type":"ingredient"}]`,`献立:${JSON.stringify(p)}`);
      const shopItems=pj(shopRaw);
      const mem=snap.current.sortMem||{};
      const session={weekStart:getWeekStart(),items:shopItems.map((it,i)=>({id:`s${i}${uid()}`,name:it.name,amount:it.amount||"",type:it.type||"ingredient",floor:mem[it.name]||null,excluded:false})),dailyGoods:[],sent:false};
      const nd={...snap.current.dishes};
      const ws=getWeekStart();
      DAYS.forEach(d=>{
        const md=p[d];
        [md.lunch.main,md.dinner.main,...(md.lunch.okazu||[]),...(md.dinner.okazu||[]),md.lunch.soup,md.dinner.soup]
          .filter(n=>n&&n!=="冷凍食品").forEach(name=>{
            if(!nd[name])nd[name]={cat:"その他",diff:1,scores:[],lastServed:ws};
            else nd[name].lastServed=ws;
          });
      });
      save({plan:p,dishes:nd,session});
      notify("✅ 献立と買い物リストを生成しました！");
    }catch(e){console.error(e);notify("❌ エラーが発生しました。APIキーを確認してください");}
    setBusy(false);setBMsg("");
  };

  const replaceMeal=async(repDay,mealType,role,currentName,excludeCat,keyword="")=>{
    setBusy(true);setBMsg("🔄 別の料理を探しています…");
    try{
      const grp=deriveGroups(snap.current.settings.day_groups).find(g=>g.days.includes(repDay));
      const isSide=role.startsWith("okazu")||role==="soup";
      const extra=[
        keyword?`特別リクエスト「${keyword}」を使った料理を提案。`:"",
        excludeCat?`カテゴリ「${excludeCat}」は除外。`:"",
        role==="soup"?"汁物を1品提案。":"",
        role.startsWith("okazu")?"副菜・おかずを1品提案。":"",
        mealType==="lunch"&&role==="main"?"昼食なので丼・焼きそば・パスタ等一品完結を提案。":"",
      ].filter(Boolean).join(" ");
      const sys=buildSys(extra);
      const raw=await callAI(sys,`${isSide?"副菜":"料理"}を1品提案。除外:${currentName||"なし"}\n形式:{"name":"料理名","cat":"肉","diff":1}`);
      const nd=pj(raw);
      const np=JSON.parse(JSON.stringify(snap.current.plan));
      grp?.days.forEach(d=>{
        if(role==="main") np[d][mealType]={...np[d][mealType],main:nd.name,cat:nd.cat,diff:nd.diff,recipe:nadiaUrl(nd.name)};
        else if(role==="soup") np[d][mealType].soup=nd.name;
        else{const idx=parseInt(role.replace("okazu",""));if(!np[d][mealType].okazu)np[d][mealType].okazu=[];np[d][mealType].okazu[idx]=nd.name;}
      });
      save({plan:np});
      notify(`✅ ${nd.name} に変更しました`);
    }catch(e){console.error(e);notify("❌ エラー");}
    setBusy(false);setBMsg("");
  };

  const removeSlot=async(repDay,mealType,role)=>{
    const grp=deriveGroups(snap.current.settings.day_groups).find(g=>g.days.includes(repDay));
    const np=JSON.parse(JSON.stringify(snap.current.plan));
    grp?.days.forEach(d=>{
      if(role==="main")      {np[d][mealType]={...np[d][mealType],main:"",cat:"",diff:1,recipe:""};}
      else if(role==="soup") {np[d][mealType].soup="";}
      else{const idx=parseInt(role.replace("okazu",""));if(np[d][mealType].okazu)np[d][mealType].okazu[idx]="";}
    });
    save({plan:np});
    notify("🗑️ メニューを削除しました");
  };

  const handleDrop=async(fromDay,fromMeal,fromRole,toDay,toMeal,toRole)=>{
    if(fromDay===toDay&&fromMeal===toMeal&&fromRole===toRole)return;
    const groups=deriveGroups(snap.current.settings.day_groups);
    const fromGrp=groups.find(g=>g.days.includes(fromDay));
    const toGrp  =groups.find(g=>g.days.includes(toDay));
    const np=JSON.parse(JSON.stringify(snap.current.plan));
    const getV=(plan,day,meal,role)=>{if(role==="main")return{...plan[day][meal]};if(role==="soup")return plan[day][meal].soup||"";const idx=parseInt(role.replace("okazu",""));return plan[day][meal].okazu?.[idx]||"";};
    const setV=(plan,day,meal,role,val)=>{if(role==="main"){plan[day][meal]={...plan[day][meal],...(typeof val==="object"?val:{main:val,cat:"その他",diff:1,recipe:val?nadiaUrl(val):""})};}else if(role==="soup"){plan[day][meal].soup=typeof val==="string"?val:val?.main||"";}else{const idx=parseInt(role.replace("okazu",""));if(!plan[day][meal].okazu)plan[day][meal].okazu=[];plan[day][meal].okazu[idx]=typeof val==="string"?val:val?.main||"";}};
    const fromVal=getV(np,fromDay,fromMeal,fromRole);
    const toVal  =getV(np,toDay,toMeal,toRole);
    const toEmpty=typeof toVal==="string"?!toVal:!toVal?.main;
    toGrp?.days.forEach(d=>setV(np,d,toMeal,toRole,fromVal));
    if(!toEmpty)fromGrp?.days.forEach(d=>setV(np,d,fromMeal,fromRole,toVal));
    else fromGrp?.days.forEach(d=>setV(np,d,fromMeal,fromRole,""));
    save({plan:np});
    notify(toEmpty?"↩️ 移動しました":"🔄 入れ替えました");
  };

  const setFloor=async(itemId,floor,isDaily=false)=>{
    const s=snap.current.session;if(!s)return;
    const key=isDaily?"dailyGoods":"items";
    const item=s[key].find(i=>i.id===itemId);
    const nm={...snap.current.sortMem,...(item?{[item.name]:floor}:{})};
    save({session:{...s,[key]:s[key].map(i=>i.id===itemId?{...i,floor}:i)},sortMem:nm});
  };

  if(!rdy)return<Loading/>;
  const ucCount=((snap.current.session?.items||[]).concat(snap.current.session?.dailyGoods||[])).filter(i=>!i.floor&&!i.excluded).length;
  const props={st,save,notify,genPlan,replaceMeal,removeSlot,handleDrop,setFloor,setSc,busy,kw,setKw};

  return(
    <div style={{maxWidth:480,margin:"0 auto",minHeight:"100dvh",background:"#F7F8FA",fontFamily:"'Noto Sans JP',sans-serif",paddingBottom:72,position:"relative"}}>
      <style>{CSS}</style>
      {busy&&<Overlay msg={bMsg}/>}
      {toast&&<Toast msg={toast}/>}
      {sc==="plan"    &&<PlanScreen     {...props}/>}
      {sc==="rate"    &&<RateScreen     {...props}/>}
      {sc==="shop"    &&<ShopScreen     {...props}/>}
      {sc==="settings"&&<SettingsScreen {...props}/>}
      <NavBar cur={sc} set={setSc} badge={ucCount}/>
    </div>
  );
}

/* ══════════════════════════════════════════
   PLAN SCREEN
══════════════════════════════════════════ */
function PlanScreen({st,genPlan,replaceMeal,removeSlot,handleDrop,busy,kw,setKw}){
  const [sheet,setSheet]=useState(null);
  const [drag,setDrag]  =useState(null);
  const groups=deriveGroups(st.settings.day_groups);
  const mc=st.settings.meal_conf||DEF_MEAL_CONF;
  const onDragStart=(day,meal,role)=>setDrag({day,meal,role});
  const onDrop=(toDay,toMeal,toRole)=>{if(!drag)return;handleDrop(drag.day,drag.meal,drag.role,toDay,toMeal,toRole);setDrag(null);};

  return(
    <div>
      <div style={{background:"linear-gradient(135deg,#1B5E20,#2E7D32)",padding:"18px 16px 20px",color:"white"}}>
        <div style={{fontSize:11,opacity:.6,letterSpacing:3,marginBottom:2}}>こんだて野郎</div>
        <div style={{fontSize:24,fontWeight:900,letterSpacing:"-1px"}}>📅 今週の献立</div>
        <div style={{fontSize:11,opacity:.6,marginTop:3}}>タップして変更 / ドラッグで入れ替え</div>
      </div>
      <div style={{padding:"12px 13px 0"}}>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <input value={kw} onChange={e=>setKw(e.target.value)} placeholder="🔍 使いたい食材・リクエスト（任意）"
            style={{flex:1,padding:"10px 14px",borderRadius:12,border:"2px solid #E0E0E0",fontSize:13,outline:"none",background:"white"}}/>
          {kw&&<button onClick={()=>setKw("")} style={{padding:"10px 12px",borderRadius:12,border:"none",background:"#F5F5F5",color:"#9E9E9E",fontWeight:700}}>✕</button>}
        </div>
        <button onClick={()=>genPlan(kw)} disabled={busy}
          style={{width:"100%",padding:"15px 14px",borderRadius:14,border:"none",background:busy?"#CCC":"linear-gradient(135deg,#F4511E,#E53935)",color:"white",fontWeight:900,fontSize:16,boxShadow:busy?"none":"0 4px 16px rgba(244,81,30,.4)",marginBottom:14,letterSpacing:"1px"}}>
          🍳 これでも食らえ
        </button>
        {groups.map(({gid,rep,days,label})=>{
          const d=st.plan[rep];if(!d)return null;
          const ci=(gid-1)%GROUP_COLORS.length;
          const hc=GROUP_COLORS[ci];
          return(
            <div key={rep} style={{background:"white",borderRadius:16,overflow:"hidden",marginBottom:10,boxShadow:"0 2px 10px rgba(0,0,0,.08)"}}>
              <div style={{background:hc,padding:"9px 14px",color:"white",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontWeight:700,fontSize:13}}>{label}</span>
                {days.length>1&&<Pill label={`${days.length}日間 同一`} bg="rgba(255,255,255,.2)" color="white"/>}
              </div>
              <div style={{padding:"10px 14px",borderBottom:"1px solid #F5F5F5"}}>
                <Lbl>☀️ 昼食</Lbl>
                {isFrozen(rep,"lunch",st.settings.frozen_meals)
                  ?<Pill label="❄️ 冷凍食品" bg="#ECEFF1" color="#546E7A"/>
                  :<div>
                    <MealSlot label="メイン" val={d.lunch.main} dishes={st.dishes} day={rep} meal="lunch" role="main"
                      onTap={()=>setSheet({day:rep,mealType:"lunch",role:"main",val:d.lunch.main,cat:d.lunch.cat,diff:d.lunch.diff,recipe:d.lunch.recipe})}
                      onDragStart={onDragStart} onDrop={onDrop} drag={drag}/>
                    {(mc.lunch?.okazu||0)>0&&Array.from({length:mc.lunch.okazu}).map((_,i)=>(
                      <MealSlot key={i} label={`おかず${i+1}`} val={d.lunch.okazu?.[i]||""} dishes={st.dishes} day={rep} meal="lunch" role={`okazu${i}`}
                        onTap={()=>setSheet({day:rep,mealType:"lunch",role:`okazu${i}`,val:d.lunch.okazu?.[i]||"",cat:"その他",diff:0,recipe:""})}
                        onDragStart={onDragStart} onDrop={onDrop} drag={drag}/>
                    ))}
                    {mc.lunch?.soup&&<MealSlot label="汁物" val={d.lunch.soup||""} dishes={st.dishes} day={rep} meal="lunch" role="soup"
                      onTap={()=>setSheet({day:rep,mealType:"lunch",role:"soup",val:d.lunch.soup||"",cat:"その他",diff:0,recipe:""})}
                      onDragStart={onDragStart} onDrop={onDrop} drag={drag}/>}
                  </div>
                }
              </div>
              <div style={{padding:"10px 14px"}}>
                <Lbl>🌙 夕食</Lbl>
                {isFrozen(rep,"dinner",st.settings.frozen_meals)
                  ?<Pill label="❄️ 冷凍食品" bg="#ECEFF1" color="#546E7A"/>
                  :<div>
                    <MealSlot label="メイン" val={d.dinner.main} dishes={st.dishes} day={rep} meal="dinner" role="main"
                      onTap={()=>setSheet({day:rep,mealType:"dinner",role:"main",val:d.dinner.main,cat:d.dinner.cat,diff:d.dinner.diff,recipe:d.dinner.recipe})}
                      onDragStart={onDragStart} onDrop={onDrop} drag={drag}/>
                    {(mc.dinner?.okazu||0)>0&&Array.from({length:mc.dinner.okazu}).map((_,i)=>(
                      <MealSlot key={i} label={`おかず${i+1}`} val={d.dinner.okazu?.[i]||""} dishes={st.dishes} day={rep} meal="dinner" role={`okazu${i}`}
                        onTap={()=>setSheet({day:rep,mealType:"dinner",role:`okazu${i}`,val:d.dinner.okazu?.[i]||"",cat:"その他",diff:0,recipe:""})}
                        onDragStart={onDragStart} onDrop={onDrop} drag={drag}/>
                    ))}
                    {mc.dinner?.soup&&<MealSlot label="汁物" val={d.dinner.soup||""} dishes={st.dishes} day={rep} meal="dinner" role="soup"
                      onTap={()=>setSheet({day:rep,mealType:"dinner",role:"soup",val:d.dinner.soup||"",cat:"その他",diff:0,recipe:""})}
                      onDragStart={onDragStart} onDrop={onDrop} drag={drag}/>}
                  </div>
                }
              </div>
            </div>
          );
        })}
      </div>
      {sheet&&<MealSheet sheet={sheet} dishes={st.dishes} onClose={()=>setSheet(null)}
        onReplace={async(exCat,kw2)=>{setSheet(null);await replaceMeal(sheet.day,sheet.mealType,sheet.role,sheet.val,exCat||null,kw2||"");}}
        onRemove={async()=>{setSheet(null);await removeSlot(sheet.day,sheet.mealType,sheet.role);}}/>}
    </div>
  );
}

function MealSlot({label,val,dishes,day,meal,role,onTap,onDragStart,onDrop,drag}){
  const [over,setOver]=useState(false);
  const sc=avgScore(dishes,val);
  const diff=dishes?.[val]?.diff||0;
  const isDragging=drag?.day===day&&drag?.meal===meal&&drag?.role===role;
  return(
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
      <span style={{fontSize:11,color:"#BDBDBD",width:44,flexShrink:0,textAlign:"right"}}>{label}</span>
      <div draggable={!!val} onClick={onTap}
        onDragStart={()=>onDragStart(day,meal,role)}
        onDragOver={e=>{e.preventDefault();setOver(true);}}
        onDragLeave={()=>setOver(false)}
        onDrop={()=>{setOver(false);onDrop(day,meal,role);}}
        style={{display:"inline-flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:20,cursor:"pointer",background:over?"#FFF3E0":!val?"#FFF8E1":"#E8F5E9",color:over?"#F4511E":!val?"#E65100":"#2E7D32",fontSize:13,fontWeight:500,opacity:isDragging?.5:1,border:over?"2px dashed #F4511E":"2px solid transparent",transition:"all .15s",maxWidth:"calc(100% - 52px)"}}>
        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:130}}>{val||"未設定"}</span>
        {diff>0&&<Pill label={DIFF_LABEL[diff]} bg={`${DIFF_COLOR[diff]}18`} color={DIFF_COLOR[diff]}/>}
        {sc!==null&&<Pill label={`⭐${sc.toFixed(1)}`} bg="#FFF8E1" color="#F57F17"/>}
        <span style={{fontSize:10,opacity:.35}}>✏</span>
      </div>
    </div>
  );
}

function MealSheet({sheet,dishes,onClose,onReplace,onRemove}){
  const [kw,setKw]=useState("");
  const sc=avgScore(dishes,sheet.val);
  const diff=dishes?.[sheet.val]?.diff||sheet.diff||0;
  const isSide=sheet.role!=="main";
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:300}} onClick={onClose}>
      <div style={{background:"white",borderRadius:"20px 20px 0 0",padding:"18px 18px 40px",width:"100%",maxWidth:480,animation:"slideup .22s ease"}} onClick={e=>e.stopPropagation()}>
        <div style={{width:36,height:4,background:"#E0E0E0",borderRadius:2,margin:"0 auto 16px"}}/>
        <div style={{fontSize:19,fontWeight:700,marginBottom:6}}>{sheet.val||"（未設定）"}</div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:12}}>
          {sheet.cat&&sheet.cat!=="その他"&&<Pill label={sheet.cat} bg="#ECEFF1" color="#546E7A"/>}
          {diff>0&&<Pill label={DIFF_LABEL[diff]} bg={`${DIFF_COLOR[diff]}18`} color={DIFF_COLOR[diff]}/>}
          {sc!==null&&<Pill label={`⭐ ${sc.toFixed(1)}点`} bg="#FFF8E1" color="#F57F17"/>}
        </div>
        {sheet.recipe&&sheet.val&&(
          <a href={sheet.recipe} target="_blank" rel="noreferrer"
            style={{display:"flex",alignItems:"center",gap:8,padding:"11px 14px",borderRadius:12,background:"#FFF3E0",color:"#E65100",textDecoration:"none",fontSize:14,fontWeight:500,marginBottom:12}}>
            📖 Nadiaでレシピを検索<span style={{marginLeft:"auto",fontSize:12,opacity:.5}}>→</span>
          </a>
        )}
        <input value={kw} onChange={e=>setKw(e.target.value)} placeholder="🔍 変更リクエスト（例：鶏肉を使って）"
          style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1px solid #E0E0E0",fontSize:13,outline:"none",marginBottom:12}}/>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          <button onClick={()=>onReplace(null,kw)} style={{padding:13,borderRadius:12,border:"2px solid #1565C0",background:"white",color:"#1565C0",fontWeight:700,fontSize:14}}>👈 別の料理に変更する</button>
          {!isSide&&sheet.cat&&!["その他","丼"].includes(sheet.cat)&&(
            <button onClick={()=>onReplace(sheet.cat,kw)} style={{padding:13,borderRadius:12,border:"2px solid #E53935",background:"white",color:"#E53935",fontWeight:700,fontSize:14}}>👆 {sheet.cat}以外のカテゴリで提案</button>
          )}
          <button onClick={onRemove} style={{padding:13,borderRadius:12,border:"2px solid #9E9E9E",background:"white",color:"#757575",fontWeight:700,fontSize:14}}>🗑️ このメニューを削除</button>
          <button onClick={onClose} style={{padding:12,borderRadius:12,border:"none",background:"#F5F5F5",color:"#757575",fontWeight:600,fontSize:13}}>閉じる</button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   RATE SCREEN
══════════════════════════════════════════ */
function RateScreen({st,save,notify}){
  const seen=new Set(),dishes=[];
  DAYS.forEach(day=>{
    const d=st.plan[day];if(!d)return;
    [d.lunch.main,d.dinner.main,...(d.lunch.okazu||[]),...(d.dinner.okazu||[]),d.lunch.soup,d.dinner.soup]
      .filter(Boolean).forEach(n=>{if(n&&n!=="冷凍食品"&&!seen.has(n)){seen.add(n);dishes.push(n);}});
  });
  const rate=async(name,score)=>{
    const nd={...st.dishes};
    if(!nd[name])nd[name]={cat:"その他",diff:1,scores:[],lastServed:""};
    nd[name]={...nd[name],scores:[...(nd[name].scores||[]),score].slice(-20)};
    save({dishes:nd});notify(`⭐ ${name}に${score}点`);
  };
  const updateDiff=async(name,diff)=>{
    const nd={...st.dishes};
    if(!nd[name])nd[name]={cat:"その他",diff,scores:[],lastServed:""};
    else nd[name]={...nd[name],diff};
    save({dishes:nd});notify("✅ 難易度を変更（次回から反映）");
  };
  return(
    <div>
      <Hdr bg="#4527A0" title="⭐ 料理の評価" sub="今週の料理に点数をつけてください"/>
      <div style={{padding:"12px 13px"}}>
        {dishes.length===0&&<Empty icon="⭐" msg="献立を生成すると料理が表示されます"/>}
        {dishes.map(name=>{
          const info=st.dishes[name];const sc=info?.scores?.length?avg(info.scores):null;const diff=info?.diff||1;
          return(
            <div key={name} style={{background:"white",borderRadius:14,padding:"14px 15px",marginBottom:10,boxShadow:"0 1px 6px rgba(0,0,0,.07)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                <div><div style={{fontWeight:700,fontSize:15,marginBottom:5}}>{name}</div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {info?.cat&&info.cat!=="その他"&&<Pill label={info.cat} bg="#ECEFF1" color="#546E7A"/>}
                    <Pill label={DIFF_LABEL[diff]} bg={`${DIFF_COLOR[diff]}18`} color={DIFF_COLOR[diff]}/>
                  </div>
                </div>
                {sc!==null&&<div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:22,fontWeight:700,color:"#F9A825"}}>⭐{sc.toFixed(1)}</div>
                  <div style={{fontSize:11,color:"#BDBDBD"}}>{info.scores.length}回</div>
                </div>}
              </div>
              <StarRow name={name} onRate={rate}/>
              <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #F5F5F5"}}>
                <div style={{fontSize:11,color:"#BDBDBD",marginBottom:6}}>難易度（変更すると次回から反映）</div>
                <div style={{display:"flex",gap:6}}>
                  {[1,2,3].map(v=>(
                    <button key={v} onClick={()=>updateDiff(name,v)}
                      style={{flex:1,padding:"6px 0",borderRadius:8,border:`2px solid ${diff===v?DIFF_COLOR[v]:"#E0E0E0"}`,background:diff===v?`${DIFF_COLOR[v]}15`:"white",color:diff===v?DIFF_COLOR[v]:"#9E9E9E",fontSize:12,fontWeight:diff===v?700:400}}>
                      {DIFF_LABEL[v]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function StarRow({name,onRate}){
  const [hov,setHov]=useState(0);
  return(
    <div style={{display:"flex",justifyContent:"center",gap:4}}>
      {[1,2,3,4,5].map(n=>(
        <button key={n} onClick={()=>onRate(name,n)} onMouseEnter={()=>setHov(n)} onMouseLeave={()=>setHov(0)}
          style={{fontSize:30,background:"none",border:"none",padding:"2px 5px",color:n<=hov?"#F9A825":"#E0E0E0"}}>★</button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════
   SHOP SCREEN
══════════════════════════════════════════ */
function ShopScreen({st,save,notify,setFloor}){
  const [step,setStep]=useState(1);
  const sess=st.session;
  const groups=deriveGroups(st.settings.day_groups);
  if(!sess)return(<div><Hdr bg="#0D47A1" title="🛒 買い物リスト" sub="まず献立を生成してください"/><Empty icon="🛒" msg={"献立タブで\n「これでも食らえ」を押してください"}/></div>);
  const uncat=[...sess.items,...(sess.dailyGoods||[])].filter(i=>!i.floor&&!i.excluded);
  return(
    <div>
      <Hdr bg="#0D47A1" title="🛒 買い物リスト" sub={`${sess.weekStart} の週`}/>
      <div style={{display:"flex",background:"white",borderBottom:"2px solid #E3F2FD"}}>
        {["①食材確認","②日用品","③仕分け","④確認送信"].map((s,i)=>(
          <button key={i} onClick={()=>setStep(i+1)}
            style={{flex:1,padding:"11px 2px",border:"none",background:"none",fontSize:10,fontWeight:step===i+1?700:400,color:step===i+1?"#1565C0":"#9E9E9E",borderBottom:`2px solid ${step===i+1?"#1565C0":"transparent"}`,marginBottom:-2}}>
            {s}
          </button>
        ))}
      </div>
      {step===1&&<Step1 sess={sess} save={save}/>}
      {step===2&&<Step2 sess={sess} dailyGoods={st.dailyGoods} sortMem={st.sortMem} save={save}/>}
      {step===3&&(uncat.length>0
        ?<Step3Swipe sess={sess} sortCats={st.settings.sort_cats} setFloor={setFloor} onDone={()=>setStep(4)}/>
        :<div style={{padding:28,textAlign:"center"}}>
          <div style={{fontSize:52,animation:"bounce .4s ease",marginBottom:12}}>✅</div>
          <div style={{color:"#9E9E9E",fontSize:14,marginBottom:16}}>すべて仕分け済みです</div>
          <BtnFull label="④ 確認・送信へ →" color="#0D47A1" onClick={()=>setStep(4)}/>
        </div>
      )}
      {step===4&&<Step4 sess={sess} plan={st.plan} sortCats={st.settings.sort_cats} lineToken={st.settings.line_token} save={save} notify={notify} groups={groups}/>}
    </div>
  );
}
function Step1({sess,save}){
  const toggle=id=>save({session:{...sess,items:sess.items.map(i=>i.id===id?{...i,excluded:!i.excluded}:i)}});
  return(
    <div style={{padding:"12px 13px"}}>
      <p style={{fontSize:13,color:"#9E9E9E",marginBottom:12,lineHeight:1.7}}>家にある食材・調味料をタップしてOFFにしてください。</p>
      {[["ingredient","🥩 食材"],["seasoning","🫙 調味料"]].map(([type,label])=>{
        const items=sess.items.filter(i=>i.type===type);if(!items.length)return null;
        return(<div key={type} style={{marginBottom:14}}>
          <Lbl>{label}</Lbl>
          <div style={{display:"flex",flexWrap:"wrap",gap:7,marginTop:6}}>
            {items.map(it=>(
              <button key={it.id} onClick={()=>toggle(it.id)}
                style={{padding:"7px 13px",borderRadius:20,border:`2px solid ${it.excluded?"#E0E0E0":"#1565C0"}`,background:it.excluded?"#F5F5F5":"#E3F2FD",color:it.excluded?"#BDBDBD":"#1565C0",fontSize:13,fontWeight:500,textDecoration:it.excluded?"line-through":"none"}}>
                {it.name}{it.amount?<span style={{opacity:.5,fontSize:11}}> {it.amount}</span>:null}
              </button>
            ))}
          </div>
        </div>);
      })}
    </div>
  );
}
function Step2({sess,dailyGoods,sortMem,save}){
  const selNames=(sess.dailyGoods||[]).map(i=>i.name);
  const toggle=name=>{
    let dg=[...(sess.dailyGoods||[])];
    if(selNames.includes(name))dg=dg.filter(i=>i.name!==name);
    else dg=[...dg,{id:`dg${uid()}`,name,floor:sortMem?.[name]||null,excluded:false}];
    save({session:{...sess,dailyGoods:dg}});
  };
  if(!dailyGoods.length)return(<div style={{padding:24,textAlign:"center",color:"#9E9E9E"}}><div style={{fontSize:40,marginBottom:10}}>🧴</div><div style={{fontSize:14}}>設定タブで日用品を登録してください</div></div>);
  return(
    <div style={{padding:"12px 13px"}}>
      <p style={{fontSize:13,color:"#9E9E9E",marginBottom:12}}>今週買う日用品を選択してください。</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        {dailyGoods.map(g=>{const sel=selNames.includes(g.name);return(
          <button key={g.id} onClick={()=>toggle(g.name)}
            style={{padding:"9px 16px",borderRadius:20,border:`2px solid ${sel?"#4CAF50":"#E0E0E0"}`,background:sel?"#E8F5E9":"white",color:sel?"#2E7D32":"#757575",fontSize:14,fontWeight:sel?700:400}}>
            {sel&&"✓ "}{g.name}
          </button>
        );})}
      </div>
    </div>
  );
}
function Step3Swipe({sess,sortCats,setFloor,onDone}){
  const activeCats=(sortCats||DEF_SORT_CATS).filter(c=>c.active&&c.label);
  const uncat=[...sess.items,...(sess.dailyGoods||[])].filter(i=>!i.floor&&!i.excluded);
  const [idx,setIdx]=useState(0);
  const [posX,setPosX]=useState(0);
  const [posY,setPosY]=useState(0);
  const startX=useRef(0),startY=useRef(0),dragging=useRef(false);
  const THRESH=68;
  const cur=uncat[idx];
  if(!cur){onDone();return null;}
  const absX=Math.abs(posX),absY=Math.abs(posY);
  const domDist=Math.max(absX,absY);
  const domDir=absX>=absY?(posX>0?"R":"L"):(posY<0?"U":"D");
  const activeDomCat=domDist>THRESH*0.42?activeCats.find(c=>c.id===domDir):null;
  const opa=Math.min(domDist/90,1);
  const doSwipe=async floor=>{
    const isDaily=(sess.dailyGoods||[]).some(i=>i.id===cur.id);
    await setFloor(cur.id,floor,isDaily);
    setPosX(0);setPosY(0);dragging.current=false;
    if(idx>=uncat.length-1)onDone();else setIdx(v=>v+1);
  };
  const onS=(cx,cy)=>{startX.current=cx;startY.current=cy;dragging.current=true;};
  const onM=(cx,cy)=>{if(!dragging.current)return;setPosX(cx-startX.current);setPosY(cy-startY.current);};
  const onE=()=>{if(!dragging.current)return;dragging.current=false;if(domDist>THRESH){const cat=activeCats.find(c=>c.id===domDir);if(cat)doSwipe(cat.id);else{setPosX(0);setPosY(0);}}else{setPosX(0);setPosY(0);}};
  return(
    <div style={{minHeight:420,background:"#1A2744",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20,position:"relative",userSelect:"none",WebkitUserSelect:"none"}}
      onMouseMove={e=>onM(e.clientX,e.clientY)} onMouseUp={onE} onMouseLeave={onE}>
      <div style={{position:"absolute",top:14,left:20,right:20}}>
        <div style={{display:"flex",justifyContent:"space-between",color:"rgba(255,255,255,.4)",fontSize:12,marginBottom:5}}><span>仕分け</span><span>{idx+1}/{uncat.length}</span></div>
        <div style={{height:3,background:"rgba(255,255,255,.12)",borderRadius:2}}><div style={{height:"100%",width:`${Math.round(idx/uncat.length*100)}%`,background:"#00897B",borderRadius:2,transition:"width .3s"}}/></div>
      </div>
      {activeCats.map(cat=>{
        const isAct=activeDomCat?.id===cat.id;
        const pos=cat.dir==="right"?{right:6,top:"50%",transform:"translateY(-50%)"}:cat.dir==="left"?{left:6,top:"50%",transform:"translateY(-50%)"}:cat.dir==="up"?{top:56,left:"50%",transform:"translateX(-50%)"}:{bottom:94,left:"50%",transform:"translateX(-50%)"};
        return(<div key={cat.id} style={{position:"absolute",...pos,textAlign:"center",opacity:isAct?1:0.2,transition:"opacity .15s",pointerEvents:"none"}}><div style={{fontSize:24}}>{DIR_ICON[cat.dir]}</div><div style={{fontSize:10,fontWeight:700,color:DIR_COLOR[cat.id],marginTop:2}}>{cat.label}</div></div>);
      })}
      <div style={{transform:`translate(${posX}px,${posY}px) rotate(${posX*.04}deg)`,transition:dragging.current?"none":"transform .3s cubic-bezier(.34,1.4,.64,1)",cursor:"grab",touchAction:"none",zIndex:10,width:"72vw",maxWidth:270}}
        onMouseDown={e=>onS(e.clientX,e.clientY)}
        onTouchStart={e=>{e.preventDefault();const t=e.touches[0];onS(t.clientX,t.clientY);dragging.current=true;}}
        onTouchMove={e=>{e.preventDefault();const t=e.touches[0];onM(t.clientX,t.clientY);}}
        onTouchEnd={onE}>
        <div style={{background:"white",borderRadius:22,padding:"38px 22px 30px",textAlign:"center",position:"relative",overflow:"hidden",boxShadow:"0 20px 56px rgba(0,0,0,.55)"}}>
          {activeDomCat&&<div style={{position:"absolute",inset:0,background:DIR_COLOR[activeDomCat.id],opacity:opa*.13,pointerEvents:"none"}}/>}
          {activeDomCat&&<div style={{position:"absolute",top:12,...(domDir==="R"?{right:12}:domDir==="L"?{left:12}:{left:"50%",transform:"translateX(-50%)"}),background:DIR_COLOR[activeDomCat.id],color:"white",padding:"3px 12px",borderRadius:16,fontWeight:700,fontSize:11,opacity:opa,whiteSpace:"nowrap"}}>{activeDomCat.label} ✓</div>}
          <div style={{fontSize:52,marginBottom:12}}>{emojiOf(cur.name)}</div>
          <div style={{fontSize:19,fontWeight:700,color:"#212121",marginBottom:6}}>{cur.name}</div>
          {cur.amount&&<div style={{fontSize:12,color:"#9E9E9E",background:"#F5F5F5",display:"inline-block",padding:"3px 12px",borderRadius:10}}>{cur.amount}</div>}
        </div>
      </div>
      <div style={{color:"rgba(255,255,255,.28)",fontSize:12,marginTop:18}}>スワイプして仕分け</div>
      <div style={{display:"flex",gap:10,marginTop:14,flexWrap:"wrap",justifyContent:"center"}}>
        {activeCats.map(cat=>(<button key={cat.id} onClick={()=>doSwipe(cat.id)}
          style={{padding:"9px 18px",borderRadius:24,border:`2px solid ${DIR_COLOR[cat.id]}`,background:"rgba(255,255,255,.07)",color:DIR_COLOR[cat.id],fontWeight:700,fontSize:12}}>
          {DIR_ICON[cat.dir]} {cat.label}
        </button>))}
      </div>
    </div>
  );
}
function Step4({sess,plan,sortCats,lineToken,save,notify,groups}){
  const [sending,setSending]=useState(false);
  const activeCats=(sortCats||DEF_SORT_CATS).filter(c=>c.active&&c.label);
  const rItems=sess.items.filter(i=>!i.excluded);
  const rDG=(sess.dailyGoods||[]).filter(i=>!i.excluded);
  const buildText=()=>{
    const L=["🍱 今週の献立\n"];
    groups.forEach(({rep,label})=>{
      const d=plan[rep];if(!d)return;
      L.push(`【${label}】`);
      L.push(`☀️ 昼：${d.lunch.main||"未設定"}`);
      if(d.lunch.recipe&&d.lunch.main&&d.lunch.main!=="冷凍食品")L.push(`  📖 ${d.lunch.recipe}`);
      if(d.lunch.okazu?.filter(Boolean).length)d.lunch.okazu.filter(Boolean).forEach(o=>L.push(`  おかず：${o}`));
      if(d.lunch.soup)L.push(`  汁物：${d.lunch.soup}`);
      L.push(`🌙 夜：${d.dinner.main||"未設定"}`);
      if(d.dinner.recipe&&d.dinner.main!=="冷凍食品")L.push(`  📖 ${d.dinner.recipe}`);
      if(d.dinner.okazu?.filter(Boolean).length)d.dinner.okazu.filter(Boolean).forEach(o=>L.push(`  おかず：${o}`));
      if(d.dinner.soup)L.push(`  汁物：${d.dinner.soup}`);
      L.push("");
    });
    L.push("🛒 買い物リスト\n");
    activeCats.forEach(cat=>{const gi=[...rItems,...rDG].filter(i=>i.floor===cat.id);if(gi.length){L.push(`【${cat.label}】`);gi.forEach(i=>L.push(`・${i.name}${i.amount?" "+i.amount:""}`));L.push("");}});
    const uf=[...rItems,...rDG].filter(i=>!i.floor);if(uf.length){L.push("【未仕分け】");uf.forEach(i=>L.push(`・${i.name}${i.amount?" "+i.amount:""}`));}
    return L.join("\n");
  };
  const send=async()=>{
    const txt=buildText();
    if(!lineToken){try{await navigator.clipboard.writeText(txt);notify("📋 クリップボードにコピーしました！");}catch{notify("⚠️ LINE Notifyトークンを設定してください");}return;}
    setSending(true);
    try{
      const r=await fetch("https://notify-api.line.me/api/notify",{method:"POST",headers:{"Authorization":`Bearer ${lineToken}`,"Content-Type":"application/x-www-form-urlencoded"},body:`message=${encodeURIComponent("\n"+txt)}`});
      if(r.ok){notify("✅ LINEに送信しました！");save({session:{...sess,sent:true}});}else throw new Error();
    }catch{try{await navigator.clipboard.writeText(txt);notify("📋 CORSエラー→クリップボードにコピーしました");}catch{notify("❌ 送信エラー");}}
    setSending(false);
  };
  return(
    <div style={{padding:"12px 13px"}}>
      {sess.sent&&<div style={{background:"#E8F5E9",padding:"10px 14px",borderRadius:10,color:"#2E7D32",fontSize:13,fontWeight:500,marginBottom:12}}>✅ 送信済み（再送信も可能）</div>}
      {[...activeCats.map(c=>[c.label,DIR_COLOR[c.id],[...rItems,...rDG].filter(i=>i.floor===c.id)]),["未仕分け","#9E9E9E",[...rItems,...rDG].filter(i=>!i.floor)]].map(([name,color,items])=>{
        if(!items.length)return null;
        return(<div key={name} style={{background:"white",borderRadius:13,overflow:"hidden",marginBottom:10}}>
          <div style={{padding:"9px 13px",fontWeight:700,fontSize:13,borderLeft:`4px solid ${color}`,color}}>{name}（{items.length}品）</div>
          <div style={{padding:"4px 13px 10px"}}>
            {items.map(it=>(<div key={it.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #FAFAFA",fontSize:13}}>
              <span>{it.name}</span><span style={{color:"#9E9E9E",fontSize:12}}>{it.amount}</span>
            </div>))}
          </div>
        </div>);
      })}
      <button onClick={send} disabled={sending} style={{width:"100%",padding:14,borderRadius:14,border:"none",background:sending?"#CCC":"#06C755",color:"white",fontWeight:700,fontSize:15,marginTop:4}}>
        {sending?"送信中…":"📤 LINEに送信する"}
      </button>
      <p style={{fontSize:12,color:"#BDBDBD",textAlign:"center",marginTop:8,lineHeight:1.7}}>※ CORSエラー時は自動でクリップボードにコピーします</p>
    </div>
  );
}

/* ══════════════════════════════════════════
   SETTINGS
══════════════════════════════════════════ */
function SettingsScreen({st,save,notify}){
  const s=st.settings;
  const [tok,setTok]            =useState(s.line_token||"");
  const [rot,setRot]            =useState(s.rotation_weeks||3);
  const [cats,setCats]          =useState(JSON.parse(JSON.stringify(s.sort_cats||DEF_SORT_CATS)));
  const [dayGroups,setDayGroups]=useState({...s.day_groups||DEF_DAY_GROUPS});
  const [frozenMeals,setFrozenMeals]=useState([...(s.frozen_meals||[])]);
  const [mc,setMc]              =useState(JSON.parse(JSON.stringify(s.meal_conf||DEF_MEAL_CONF)));
  const [ngInput,setNgInput]    =useState("");
  const [newG,setNewG]          =useState("");
  const [rName,setRName]        =useState("");
  const [rIngs,setRIngs]        =useState("");
  const [rUrl,setRUrl]          =useState("");
  const [rScore,setRScore]      =useState(0);

  const saveAll=()=>{save({settings:{...s,line_token:tok,rotation_weeks:rot,sort_cats:cats,day_groups:dayGroups,frozen_meals:frozenMeals,meal_conf:mc}});notify("✅ 設定を保存しました");};
  const cycleGroup=day=>{const cur=dayGroups[day]||1;setDayGroups({...dayGroups,[day]:cur>=7?1:cur+1});};
  const toggleFrozen=key=>setFrozenMeals(f=>f.includes(key)?f.filter(k=>k!==key):[...f,key]);
  const addNG=()=>{if(!ngInput.trim())return;save({settings:{...s,ng_foods:[...(s.ng_foods||[]),ngInput.trim()]}});setNgInput("");notify(`✅ ${ngInput.trim()} をNGに追加`);};
  const delNG=item=>save({settings:{...s,ng_foods:(s.ng_foods||[]).filter(n=>n!==item)}});
  const addGood=()=>{if(!newG.trim())return;save({dailyGoods:[...st.dailyGoods,{id:`dg${uid()}`,name:newG.trim()}]});setNewG("");};
  const delGood=id=>save({dailyGoods:st.dailyGoods.filter(g=>g.id!==id)});
  const addRecipe=()=>{
    if(!rName.trim())return;
    const nr={id:`cr${uid()}`,name:rName.trim(),ingredients:rIngs.trim(),url:rUrl.trim(),score:rScore};
    const nd={...st.dishes};
    if(!nd[rName.trim()])nd[rName.trim()]={cat:"その他",diff:1,scores:rScore?[rScore]:[],lastServed:""};
    else if(rScore)nd[rName.trim()].scores=[...(nd[rName.trim()].scores||[]),rScore].slice(-20);
    save({customRecipes:[...st.customRecipes,nr],dishes:nd});
    setRName("");setRIngs("");setRUrl("");setRScore(0);notify("✅ レシピを登録しました");
  };
  const delRecipe=id=>save({customRecipes:st.customRecipes.filter(r=>r.id!==id)});
  const groups=deriveGroups(dayGroups);

  return(
    <div>
      <Hdr bg="#263238" title="⚙️ 設定" sub="こんだて野郎"/>
      <div style={{padding:"12px 13px"}}>

        <SCard title="🍽️ 食事構成の設定" accent="#E65100">
          {[["lunch","☀️ 昼食"],["dinner","🌙 夕食"]].map(([meal,label])=>(
            <div key={meal} style={{marginBottom:16}}>
              <div style={{fontSize:13,fontWeight:700,color:"#555",marginBottom:8}}>{label}</div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <span style={{fontSize:13,color:"#555",flexShrink:0}}>おかず</span>
                <div style={{display:"flex",gap:5}}>
                  {[0,1,2,3,4].map(n=>(
                    <button key={n} onClick={()=>setMc(m=>({...m,[meal]:{...m[meal],okazu:n}}))}
                      style={{width:34,height:34,borderRadius:8,border:`2px solid ${(mc[meal]?.okazu||0)===n?"#E65100":"#E0E0E0"}`,background:(mc[meal]?.okazu||0)===n?"#FBE9E7":"white",color:(mc[meal]?.okazu||0)===n?"#E65100":"#9E9E9E",fontWeight:700,fontSize:13}}>
                      {n}
                    </button>
                  ))}
                </div>
                <span style={{fontSize:12,color:"#9E9E9E"}}>品</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:13,color:"#555",flexShrink:0}}>汁物</span>
                <button onClick={()=>setMc(m=>({...m,[meal]:{...m[meal],soup:!m[meal]?.soup}}))}
                  style={{padding:"6px 16px",borderRadius:20,border:`2px solid ${mc[meal]?.soup?"#0097A7":"#E0E0E0"}`,background:mc[meal]?.soup?"#E0F7FA":"white",color:mc[meal]?.soup?"#0097A7":"#9E9E9E",fontWeight:600,fontSize:13}}>
                  {mc[meal]?.soup?"✓ あり":"なし"}
                </button>
              </div>
            </div>
          ))}
          <BtnFull label="保存" color="#E65100" onClick={saveAll}/>
        </SCard>

        <SCard title="📅 曜日グループ設定" accent="#2E7D32">
          <p style={{fontSize:12,color:"#9E9E9E",marginBottom:12,lineHeight:1.7}}>同じ色の曜日は同じ献立になります。タップするたびにグループが変わります。</p>
          <div style={{display:"flex",gap:7,marginBottom:14,justifyContent:"center"}}>
            {DAYS.map(day=>{const g=dayGroups[day]||1;const ci=(g-1)%GROUP_COLORS.length;return(
              <button key={day} onClick={()=>cycleGroup(day)}
                style={{width:40,height:44,borderRadius:10,border:`2px solid ${GROUP_COLORS[ci]}`,background:GROUP_LIGHT[ci],color:GROUP_COLORS[ci],fontWeight:700,fontSize:14,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1,padding:0}}>
                <span>{DAY_JP[day]}</span><span style={{fontSize:9,opacity:.7}}>G{g}</span>
              </button>
            );})}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:14}}>
            {groups.map(({gid,days,label})=>{const ci=(gid-1)%GROUP_COLORS.length;return(
              <div key={gid} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,background:GROUP_LIGHT[ci],border:`1px solid ${GROUP_COLORS[ci]}40`}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:GROUP_COLORS[ci],flexShrink:0}}/>
                <span style={{fontSize:13,fontWeight:600,color:GROUP_COLORS[ci]}}>{label}</span>
                {days.length>1&&<span style={{fontSize:11,color:"#9E9E9E"}}>（{days.length}日間・同一献立）</span>}
              </div>
            );})}
          </div>
          <BtnFull label="保存" color="#2E7D32" onClick={saveAll}/>
        </SCard>

        <SCard title="❄️ 冷凍食品の設定" accent="#546E7A">
          <p style={{fontSize:12,color:"#9E9E9E",marginBottom:12,lineHeight:1.7}}>❄️のマスは「冷凍食品」が固定されます。全てOFFで冷凍食品なし。</p>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"separate",borderSpacing:4}}>
              <thead><tr><th style={{fontSize:11,color:"#9E9E9E",fontWeight:400,width:36}}></th><th style={{fontSize:12,color:"#9E9E9E",fontWeight:400,textAlign:"center"}}>☀️ 昼</th><th style={{fontSize:12,color:"#9E9E9E",fontWeight:400,textAlign:"center"}}>🌙 夜</th></tr></thead>
              <tbody>{DAYS.map(day=>(<tr key={day}>
                <td style={{fontSize:13,color:"#555",paddingRight:4,whiteSpace:"nowrap"}}>{DAY_JP[day]}曜</td>
                {["lunch","dinner"].map(meal=>{const key=`${day}_${meal}`;const checked=frozenMeals.includes(key);return(<td key={meal} style={{textAlign:"center"}}>
                  <button onClick={()=>toggleFrozen(key)} style={{padding:"7px 14px",borderRadius:8,border:`2px solid ${checked?"#546E7A":"#E0E0E0"}`,background:checked?"#ECEFF1":"white",color:checked?"#37474F":"#BDBDBD",fontSize:checked?15:13}}>{checked?"❄️":"○"}</button>
                </td>);})}
              </tr>))}</tbody>
            </table>
          </div>
          <div style={{marginTop:12}}><BtnFull label="保存" color="#546E7A" onClick={saveAll}/></div>
        </SCard>

        <SCard title="🚫 NG食材" accent="#E53935">
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <input value={ngInput} onChange={e=>setNgInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addNG()} placeholder="例：えび、ナッツ、パクチー..."
              style={{flex:1,padding:"10px 12px",borderRadius:8,border:"1px solid #E0E0E0",fontSize:14,outline:"none"}}/>
            <button onClick={addNG} style={{padding:"10px 16px",borderRadius:8,border:"none",background:"#E53935",color:"white",fontWeight:700,fontSize:14}}>追加</button>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
            {(s.ng_foods||[]).map(item=>(<div key={item} style={{display:"flex",alignItems:"center",gap:5,background:"#FFEBEE",padding:"6px 12px 6px 14px",borderRadius:20,border:"1px solid #FFCDD2"}}>
              <span style={{fontSize:13,color:"#C62828"}}>🚫 {item}</span>
              <button onClick={()=>delNG(item)} style={{background:"none",border:"none",color:"#FFCDD2",fontSize:16,lineHeight:1,padding:0}}>×</button>
            </div>))}
            {!(s.ng_foods||[]).length&&<span style={{fontSize:13,color:"#BDBDBD"}}>登録されていません</span>}
          </div>
        </SCard>

        <SCard title="↔️ 振り分け設定（最大4方向）" accent="#0D47A1">
          <p style={{fontSize:12,color:"#9E9E9E",marginBottom:12,lineHeight:1.6}}>名前を入力した方向が有効になります。スーパー名・コーナー名など自由に設定できます。</p>
          {cats.map((cat,i)=>(<div key={cat.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:9}}>
            <span style={{fontSize:18,flexShrink:0}}>{DIR_ICON[cat.dir]}</span>
            <input value={cat.label} onChange={e=>{const nc=[...cats];nc[i]={...nc[i],label:e.target.value,active:!!e.target.value};setCats(nc);}}
              placeholder={`例：${cat.dir==="right"?"食品売場":cat.dir==="left"?"日用品売場":cat.dir==="up"?"冷凍コーナー":"惣菜コーナー"}`}
              style={{flex:1,padding:"9px 11px",borderRadius:8,border:"1px solid #E0E0E0",fontSize:14,outline:"none"}}/>
            {cat.label&&<span style={{fontSize:11,color:"#4CAF50",flexShrink:0}}>✓</span>}
          </div>))}
          <BtnFull label="保存" color="#0D47A1" onClick={saveAll}/>
        </SCard>

        <SCard title="🔄 ローテーション設定" accent="#6A1B9A">
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <span style={{fontSize:13,color:"#555",flexShrink:0}}>直近</span>
            <input type="number" min={1} max={8} value={rot} onChange={e=>setRot(Number(e.target.value))}
              style={{width:56,padding:"8px",borderRadius:8,border:"1px solid #E0E0E0",fontSize:16,textAlign:"center",outline:"none"}}/>
            <span style={{fontSize:13,color:"#555"}}>週間以内の料理は除外</span>
          </div>
          <BtnFull label="保存" color="#6A1B9A" onClick={saveAll}/>
        </SCard>

        <SCard title="🔑 LINE Notify トークン" accent="#06C755">
          <input type="password" value={tok} onChange={e=>setTok(e.target.value)} placeholder="トークンを入力..."
            style={{width:"100%",padding:"11px 13px",borderRadius:10,border:"2px solid #E0E0E0",fontSize:14,outline:"none",marginBottom:10}}/>
          <BtnFull label="保存" color="#06C755" onClick={saveAll}/>
          <p style={{fontSize:11,color:"#9E9E9E",marginTop:8,lineHeight:1.7}}><a href="https://notify-bot.line.me/ja/" target="_blank" rel="noreferrer" style={{color:"#06C755"}}>notify-bot.line.me</a> でトークン発行 → 送りたいグループにLINE Notifyを招待してください。</p>
        </SCard>

        <SCard title="📖 レシピ手動登録" accent="#0097A7">
          <input value={rName} onChange={e=>setRName(e.target.value)} placeholder="料理名（必須）" style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #E0E0E0",fontSize:14,outline:"none",marginBottom:8}}/>
          <textarea value={rIngs} onChange={e=>setRIngs(e.target.value)} placeholder={"材料（任意）\n例：鶏むね肉 300g"} rows={3} style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #E0E0E0",fontSize:13,outline:"none",resize:"vertical",marginBottom:8,lineHeight:1.6}}/>
          <input value={rUrl} onChange={e=>setRUrl(e.target.value)} placeholder="レシピURL（任意）" style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1px solid #E0E0E0",fontSize:13,outline:"none",marginBottom:10}}/>
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:"#9E9E9E",marginBottom:6}}>評価（任意）</div>
            <div style={{display:"flex",gap:4}}>{[1,2,3,4,5].map(n=>(<button key={n} onClick={()=>setRScore(n===rScore?0:n)} style={{fontSize:26,background:"none",border:"none",padding:"2px 4px",color:n<=rScore?"#F9A825":"#E0E0E0"}}>★</button>))}</div>
          </div>
          <BtnFull label="✅ レシピを登録する" color="#0097A7" onClick={addRecipe}/>
          {st.customRecipes.length>0&&(<div style={{marginTop:14}}><Lbl>登録済み（{st.customRecipes.length}件）</Lbl>
            {st.customRecipes.map(r=>(<div key={r.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #F5F5F5"}}>
              <div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:500}}>{r.name}</div>
                <div style={{display:"flex",gap:6,marginTop:3}}>
                  {r.score>0&&<span style={{fontSize:12,color:"#F9A825"}}>{"⭐".repeat(r.score)}</span>}
                  {r.url&&<a href={r.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#0097A7"}}>レシピを見る</a>}
                </div>
              </div>
              <button onClick={()=>delRecipe(r.id)} style={{background:"none",border:"none",color:"#BDBDBD",fontSize:18,padding:"4px 8px"}}>×</button>
            </div>))}
          </div>)}
        </SCard>

        <SCard title="🧴 日用品リスト" accent="#E65100">
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <input value={newG} onChange={e=>setNewG(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addGood()} placeholder="例：シャンプー、洗濯洗剤..."
              style={{flex:1,padding:"10px 12px",borderRadius:8,border:"1px solid #E0E0E0",fontSize:14,outline:"none"}}/>
            <button onClick={addGood} style={{padding:"10px 16px",borderRadius:8,border:"none",background:"#E65100",color:"white",fontWeight:700,fontSize:14}}>追加</button>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
            {st.dailyGoods.map(g=>(<div key={g.id} style={{display:"flex",alignItems:"center",gap:5,background:"#FFF3E0",padding:"6px 12px 6px 14px",borderRadius:20,border:"1px solid #FFCCBC"}}>
              <span style={{fontSize:13,color:"#BF360C"}}>{g.name}</span>
              <button onClick={()=>delGood(g.id)} style={{background:"none",border:"none",color:"#FFAB91",fontSize:16,lineHeight:1,padding:0}}>×</button>
            </div>))}
            {!st.dailyGoods.length&&<span style={{fontSize:13,color:"#BDBDBD"}}>まだ登録されていません</span>}
          </div>
        </SCard>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   SHARED COMPONENTS
══════════════════════════════════════════ */
function NavBar({cur,set,badge}){
  const tabs=[{id:"plan",icon:"📅",label:"献立"},{id:"rate",icon:"⭐",label:"評価"},{id:"shop",icon:"🛒",label:"買い物",badge},{id:"settings",icon:"⚙️",label:"設定"}];
  return(
    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"rgba(255,255,255,.97)",backdropFilter:"blur(12px)",borderTop:"1px solid #EBEBEB",display:"flex",zIndex:100,boxShadow:"0 -1px 10px rgba(0,0,0,.06)"}}>
      {tabs.map(t=>(<button key={t.id} onClick={()=>set(t.id)}
        style={{flex:1,padding:"8px 4px 12px",border:"none",background:"transparent",display:"flex",flexDirection:"column",alignItems:"center",gap:2,position:"relative"}}>
        <span style={{fontSize:21,filter:cur===t.id?"none":"grayscale(60%)",opacity:cur===t.id?1:.55,transition:"all .15s"}}>{t.icon}</span>
        <span style={{fontSize:9,color:cur===t.id?"#1B5E20":"#9E9E9E",fontWeight:cur===t.id?700:400}}>{t.label}</span>
        {t.badge>0&&<span style={{position:"absolute",top:5,right:"calc(50% - 17px)",background:"#F44336",color:"white",borderRadius:10,fontSize:9,fontWeight:700,padding:"1px 5px"}}>{t.badge}</span>}
        <span style={{position:"absolute",bottom:0,left:"20%",right:"20%",height:2,background:"#1B5E20",borderRadius:1,opacity:cur===t.id?1:0,transition:"opacity .2s"}}/>
      </button>))}
    </div>
  );
}
function Hdr({bg,title,sub}){return(<div style={{background:bg,padding:"20px 16px 22px",color:"white"}}><div style={{fontSize:22,fontWeight:700,letterSpacing:"-.3px"}}>{title}</div>{sub&&<div style={{fontSize:12,opacity:.65,marginTop:4}}>{sub}</div>}</div>);}
function SCard({title,accent,children}){return(<div style={{background:"white",borderRadius:15,overflow:"hidden",marginBottom:13,boxShadow:"0 1px 8px rgba(0,0,0,.07)"}}><div style={{padding:"11px 15px",fontWeight:700,fontSize:14,borderLeft:`4px solid ${accent}`,color:accent}}>{title}</div><div style={{padding:"12px 15px 16px"}}>{children}</div></div>);}
function BtnFull({label,color,onClick}){return(<button onClick={onClick} style={{width:"100%",padding:12,borderRadius:10,border:"none",background:color,color:"white",fontWeight:700,fontSize:14}}>{label}</button>);}
function Pill({label,bg,color}){return(<span style={{fontSize:11,background:bg,color,padding:"2px 8px",borderRadius:10,fontWeight:500,whiteSpace:"nowrap"}}>{label}</span>);}
function Lbl({children}){return(<div style={{fontSize:11,color:"#BDBDBD",fontWeight:600,letterSpacing:1,marginBottom:7}}>{children}</div>);}
function Empty({icon,msg}){return(<div style={{textAlign:"center",padding:"56px 24px",color:"#BDBDBD"}}><div style={{fontSize:52,marginBottom:12}}>{icon}</div><div style={{fontSize:14,lineHeight:1.9,whiteSpace:"pre-line"}}>{msg}</div></div>);}
function Toast({msg}){return(<div style={{position:"fixed",bottom:82,left:"50%",transform:"translateX(-50%)",background:"rgba(33,33,33,.92)",color:"white",padding:"11px 22px",borderRadius:25,zIndex:2000,fontSize:14,fontWeight:500,whiteSpace:"nowrap",animation:"fadeup .25s ease"}}>{msg}</div>);}
function Overlay({msg}){return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}><div style={{background:"white",borderRadius:20,padding:"28px 40px",textAlign:"center",animation:"scalein .2s ease"}}><div style={{fontSize:34,animation:"spin 1.6s linear infinite",display:"inline-block",marginBottom:10}}>⚙️</div><div style={{fontWeight:700,fontSize:14,marginBottom:4}}>{msg}</div><div style={{color:"#9E9E9E",fontSize:12}}>しばらくお待ちください…</div></div></div>);}
function Loading(){return(<div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#F7F8FA"}}><div style={{textAlign:"center"}}><div style={{fontSize:64,animation:"pulse 1.4s ease-in-out infinite"}}>🍱</div><div style={{marginTop:14,color:"#BDBDBD",fontSize:14}}>読み込み中…</div></div></div>);}

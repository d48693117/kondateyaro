import { useState, useEffect, useRef, useCallback } from "react";

/* ══════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════ */
const MODEL  = "claude-sonnet-4-5";
const DB_KEY = "kondateyaro-v1";
const DAYS   = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
const DAY_JP = {monday:"月",tuesday:"火",wednesday:"水",thursday:"木",friday:"金",saturday:"土",sunday:"日"};
const GROUP_COLORS = ["#2E7D32","#1565C0","#E65100","#6A1B9A","#00695C","#AD1457","#37474F"];
const GROUP_LIGHT  = ["#E8F5E9","#E3F2FD","#FBE9E7","#F3E5F5","#E0F2F1","#FCE4EC","#ECEFF1"];
const CAT_COLORS   = ["#00897B","#1565C0","#E65100","#6A1B9A"];
const DIR_LABELS   = { right:"→", left:"←", up:"↑", down:"↓" };
const DIFF_LABELS  = ["","かんたん","ふつう","本格"];
const DIFF_COLORS  = ["","#43A047","#FB8C00","#E53935"];

const INIT_SETTINGS = {
  sort_cats: [
    { id:"R", name:"2階", color:CAT_COLORS[0], dir:"right" },
    { id:"L", name:"3階", color:CAT_COLORS[1], dir:"left"  }
  ],
  line_token:"", sheets_url:"", sheets_token:"",
  servings:2, rotation_weeks:3,
  ng_foods:[], frozen_meals:[],
  meal_config:{ lunch:{sides:0,soup:false}, dinner:{sides:2,soup:false} },
  recipe_sites:[
    {id:"nadia",   label:"Nadia",      url:"https://oceans-nadia.com/search?q={dish}"},
    {id:"cookpad", label:"クックパッド", url:"https://cookpad.com/search/{dish}"},
    {id:"youtube", label:"YouTube",    url:"https://www.youtube.com/results?search_query={dish}+レシピ"},
    {id:"insta",   label:"Instagram",  url:"https://www.instagram.com/explore/tags/{dish}レシピ"}
  ],
  day_groups:{monday:1,tuesday:2,wednesday:1,thursday:2,friday:1,saturday:3,sunday:4}
};

const INIT_STATE = {
  plan:null, session:null, sortMem:{}, dailyGoods:[],
  dishes:{}, customRecipes:{}, ingredientMem:{},
  settings:INIT_SETTINGS
};

/* ══════════════════════════════════════════
   CSS
══════════════════════════════════════════ */
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap');
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
body{margin:0;padding:0;background:#F7F8FA;}
button{cursor:pointer;-webkit-appearance:none;font-family:inherit;}
input,textarea{-webkit-appearance:none;outline:none;font-family:inherit;}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes bounce{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
@keyframes fadeup{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
.fade-in{animation:fadeIn .25s ease}
`;

/* ══════════════════════════════════════════
   UTILITIES
══════════════════════════════════════════ */
function migrateSettings(s){
  // 旧データ互換: cat_R / cat_L → sort_cats
  if(!s.sort_cats && (s.cat_R||s.cat_L)){
    s.sort_cats=[
      {id:"R",name:s.cat_R||"2階",color:CAT_COLORS[0],dir:"right"},
      {id:"L",name:s.cat_L||"3階",color:CAT_COLORS[1],dir:"left"}
    ];
    delete s.cat_R; delete s.cat_L;
  }
  // 旧データ互換: day_groups が配列形式 → 辞書形式に変換
  if(Array.isArray(s.day_groups)){
    const dict={};
    s.day_groups.forEach((days,i)=>days.forEach(d=>{dict[d]=i+1;}));
    s.day_groups=dict;
  }
  return {...INIT_SETTINGS,...s};
}

function loadState(){
  try{
    const raw=localStorage.getItem(DB_KEY);
    if(raw){
      const p=JSON.parse(raw);
      return {...INIT_STATE,...p, settings:migrateSettings(p.settings||{})};
    }
  }catch(e){}
  return {...INIT_STATE};
}
function saveState(st){ try{localStorage.setItem(DB_KEY,JSON.stringify(st));}catch(e){} }

async function callAI(sys,msg,max=1500){
  const r=await fetch("/api/claude",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({model:MODEL,max_tokens:max,system:sys,messages:[{role:"user",content:msg}]})
  });
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  const d=await r.json();
  if(d.error) throw new Error(d.error.message||String(d.error));
  return d.content?.[0]?.text||"";
}

async function syncToSheets(url,token,data){
  if(!url) return;
  const r=await fetch("/api/sheets",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({gasUrl:url,token:token||"",data})});
  if(!r.ok) throw new Error(`HTTP ${r.status}`);
  const d=await r.json();
  if(d.error) throw new Error(d.error);
}
async function loadFromSheets(url,token){
  if(!url) return null;
  const r=await fetch(`/api/sheets?gasUrl=${encodeURIComponent(url)}&token=${encodeURIComponent(token||"")}`);
  if(!r.ok) return null;
  const d=await r.json();
  if(d.error) throw new Error(d.error);
  return d.data||null;
}

function deriveGroups(dayGroups){
  const dg=dayGroups||INIT_SETTINGS.day_groups;
  // 辞書形式 {monday:1,...} → グループ配列に変換
  const map={};
  DAYS.forEach(day=>{
    const gid=(dg[day]||1);
    if(!map[gid]) map[gid]=[];
    map[gid].push(day);
  });
  return Object.entries(map)
    .sort((a,b)=>DAYS.indexOf(a[1][0])-DAYS.indexOf(b[1][0]))
    .map(([gid,days],idx)=>({
      id:'g'+idx, gid:Number(gid), days,
      color:GROUP_COLORS[(Number(gid)-1)%GROUP_COLORS.length],
      light:GROUP_LIGHT[(Number(gid)-1)%GROUP_LIGHT.length],
      label:days.map(d=>DAY_JP[d]).join('・')
    }));
}

function weekStartStr(){
  const d=new Date(); const day=d.getDay();
  const diff=day===0?-6:1-day; d.setDate(d.getDate()+diff);
  return d.toISOString().split("T")[0];
}

function avg(arr){ return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0; }

function isFrozen(day,meal,frozen_meals){
  return (frozen_meals||[]).includes(`${day}_${meal}`);
}

async function buildMenu(st,wantedIngredients=""){
  const groups=deriveGroups(st.settings.day_groups);
  const servings=st.settings.servings||2;
  const rotW=st.settings.rotation_weeks||3;
  const ngFoods=(st.settings.ng_foods||[]).join("、")||"なし";
  const wantedLine=wantedIngredients.trim()?`\n使いたい食材（できるだけ含める）: ${wantedIngredients.trim()}`:"";
  const frozen_meals=st.settings.frozen_meals||[];

  // ローテーション除外（直近N週に出した料理）
  const cutoff=Date.now()-(rotW*7*86400000);
  const dishes=st.dishes||{};
  const recent=Object.entries(dishes)
    .filter(([,v])=>v.lastServed&&new Date(v.lastServed)>cutoff)
    .map(([k])=>k).join("、")||"なし";

  // 高評価情報
  const scoreInfo=Object.entries(dishes)
    .filter(([,v])=>v.scores?.length)
    .map(([k,v])=>`${k}:${avg(v.scores).toFixed(1)}点`)
    .join("、")||"なし";

  // 手動登録レシピ
  const customList=(st.customRecipes||[]).map(r=>`${r.name}${r.score?`(${r.score}点)`:""}`).join("、")||"なし";

  // 冷凍食品の枠
  const frozenInfo=frozen_meals.map(k=>{
    const[d,m]=k.split("_"); return `${DAY_JP[d]}曜${m==="lunch"?"昼":"夜"}`;
  }).join("、")||"なし";

  const sys=`家庭料理の週間献立作成AI。純粋なJSONのみ返すこと。前置き不要。
グループ（同じグループは同一献立）: ${groups.map(g=>g.label).join("、")}
冷凍食品固定の枠: ${frozenInfo}（これらはmain="冷凍食品"で固定）
NG食材（絶対に使わない）: ${ngFoods}
除外（直近${rotW}週）: ${recent}
過去評価（高評価優先）: ${scoreInfo}
登録レシピ（優先）: ${customList}${wantedLine}
ルール:
・夜はmain1品+sides2品（副菜は家庭的なもの：ひじき煮・ポテサラ・冷奴・卵焼き等）
・汁物設定がfalseのグループは副菜に味噌汁・豚汁・スープ・お吸い物などの汁物を絶対に含めない
・土日夜は丼もの（親子丼・牛丼・カツ丼等）
・同じ料理を週内で繰り返さない
・catは「肉/魚/卵・豆腐/野菜メイン/麺・パスタ/丼/その他」
・diffは1=かんたん/2=ふつう/3=本格

出力形式（JSON配列・グループ数分）:
[{"days":["monday","wednesday","friday"],"main":"料理名","sides":["副菜1","副菜2"],"cat":"肉","diff":2},...]`;

  const txt=await callAI(sys,`今週の献立。グループ: ${groups.map(g=>g.label).join("、")}（${servings}人家族）`,2000);
  const clean=txt.replace(/```json|```/g,"").trim();
  const groupData=JSON.parse(clean);
  const mealCfg=st.settings?.meal_config||INIT_SETTINGS.meal_config;
  const SOUP_PATTERN=/汁$|スープ$|お吸い物|汁物/;
  const filtered=groupData.map(g=>{
    if(mealCfg.dinner?.soup) return g; // 汁物ありならフィルターしない
    const sides=(g.sides||[]).filter(s=>!SOUP_PATTERN.test(s));
    return {...g, sides};
  });
  return {weekStart:weekStartStr(), groups:filtered.map(g=>({...g,score:null}))};
}

async function buildShoppingItems(plan,sortMem,settings,dishes,ingredientMem){
  const servings=settings?.servings||2;
  const validGroups=plan.groups.filter(g=>g.main);

  // レシピURLが登録されている料理を特定
  const urlDishes={};
  validGroups.forEach((g,gi)=>{
    const allDishes=[{key:"main",name:g.main},...(g.sides||[]).filter(s=>s).map((s,si)=>({key:`side${si+1}`,name:s}))];
    allDishes.forEach(d=>{
      const url=(dishes||{})[d.name]?.recipeUrl;
      if(url) urlDishes[`${gi}_${d.key}`]={name:d.name,url};
    });
  });

  // レシピURLから食材を取得（インスタ以外）
  const urlIngredients={};
  await Promise.all(Object.entries(urlDishes).map(async([key,{name,url}])=>{
    if(url.includes("instagram.com")) return; // インスタはスキップ
    try{
      const r=await fetch(`/api/fetch-url?url=${encodeURIComponent(url)}`);
      if(r.ok){
        const text=await r.text();
        const sys=`食材リストをJSONで返すこと。前置き不要。形式: [{"name":"食材名","qty":"量","type":"ingredient"}]`;
        const result=await callAI(sys,`このレシピページから食材リストを抽出: ${text.slice(0,3000)}`);
        const clean=result.replace(/```json|```/g,"").trim();
        urlIngredients[key]=JSON.parse(clean);
      }
    }catch(e){}
  }));

  const groupInfo=validGroups.map((g,gi)=>{
    const dayCount=g.days.length;
    const total=servings*dayCount;
    const dishes2=[
      {dishType:"main",name:g.main},
      ...(g.sides||[]).filter(s=>s).map((s,si)=>({dishType:`side${si+1}`,name:s}))
    ];
    return {groupIdx:gi, days:g.days.map(d=>DAY_JP[d]).join("・"),dayCount,servings,total,dishes:dishes2};
  });

  const sys=`買い物リスト作成AI。JSONのみ返すこと。前置き不要。
各グループ・各料理ごとに食材をリストアップ。totalPersons（人数×日数）分の量を計算すること。
肉・魚のメイン食材は1人前150g、卵は1人前1個を基準にtotalPersons倍で計算。野菜は1人前80g基準。
塩・砂糖・サラダ油・水・ごま油・片栗粉は除外。食材名は量を含めず名前だけにすること。
出力形式:
[{"groupIdx":0,"dishType":"main","dishName":"料理名","name":"食材名","qty":"量と単位","type":"ingredient"}]
typeは"ingredient"か"seasoning"のみ。`;
  const txt=await callAI(sys,`献立: ${JSON.stringify(groupInfo)}`,4000);
  let clean=txt.replace(/```json|```/g,"").trim();
  let aiItems;
  try{
    aiItems=JSON.parse(clean);
  }catch(e){
    const lastBracket=clean.lastIndexOf("}");
    if(lastBracket>0){
      clean=clean.substring(0,lastBracket+1);
      if(!clean.endsWith("]")) clean+="]";
      if(!clean.startsWith("[")) clean="["+clean;
      aiItems=JSON.parse(clean);
    } else {
      throw new Error("買い物リストの生成に失敗しました。もう一度お試しください。");
    }
  }

  // URLから取得した食材をマージ
  Object.entries(urlIngredients).forEach(([key,items])=>{
    const [gi,dishType]=key.split("_");
    const group=validGroups[Number(gi)];
    const dishName=dishType==="main"?group.main:(group.sides||[])[Number(dishType.replace("side",""))-1]||"";
    items.forEach(item=>{
      aiItems.push({groupIdx:Number(gi),dishType,dishName,name:item.name,qty:item.qty||"",type:item.type||"ingredient"});
    });
  });

  // 食材名の正規化（名前に量が混入している場合を除去）
  aiItems=aiItems.map(item=>({...item,name:item.name.replace(/[\d]+(g|kg|ml|l|本|個|枚|束|袋|缶|パック)/g,"").trim()})).filter(item=>item.name);

  // 同一食材名をグループ・タイプ問わずまとめる（名前のみキー）
  const merged={};
  aiItems.forEach(item=>{
    const key=item.name;
    if(!merged[key]){
      merged[key]={...item};
    } else {
      // 量を結合（数値は加算、それ以外は連結）
      if(merged[key].qty && item.qty && merged[key].qty!==item.qty){
        merged[key].qty=merged[key].qty+"・"+item.qty;
      } else if(item.qty){
        merged[key].qty=item.qty;
      }
    }
  });

  const iMem=ingredientMem||{};
  return Object.values(merged).map((item,i)=>{
    // ingredientMemに1人前量が記憶されていれば上書き計算
    // そのアイテムが属するグループの日数を特定
    const group=validGroups[item.groupIdx];
    const dayCount=group?.days?.length||1;
    const total=servings*dayCount;
    const perServing=iMem[item.name];
    const qty=perServing?`${Math.round(perServing*total*10)/10}${iMem[item.name+"_unit"]||"g"}`:item.qty;
    const isSeasoning=item.type==="seasoning";
    return {
      id:`item_${Date.now()}_${i}`,
      groupIdx:item.groupIdx??0, dishType:item.dishType||"main", dishName:item.dishName||"",
      name:item.name, qty:isSeasoning?"":qty, type:item.type||"ingredient",
      floor:(sortMem||{})[item.name]||null,
      excluded:isSeasoning // 調味料はデフォルトOFF
    };
  });
}

function buildLINEMessage(plan,session,sortCats,dishes){
  let msg="🍱 こんだて野郎\n";
  if(plan?.groups){
    msg+="\n📅 今週の献立\n";
    plan.groups.forEach((g,gi)=>{
      const label=g.days.map(d=>DAY_JP[d]).join("・");
      msg+=`\n【${label}】\n🍽 主菜: ${g.main}\n`;
      // 登録済みレシピURL
      const mainUrl=(dishes||{})[g.main]?.recipeUrl;
      if(mainUrl) msg+=`  🔗 ${mainUrl}\n`;
      if(session?.items){
        const mainIng=session.items.filter(i=>i.groupIdx===gi&&i.dishType==="main"&&!i.excluded&&i.type==="ingredient");
        if(mainIng.length) msg+=`  食材: ${mainIng.map(i=>`${i.name}${i.qty?` ${i.qty}`:""}`).join("、")}\n`;
      }
      (g.sides||[]).forEach((side,si)=>{
        const sideIng=(session?.items||[]).filter(i=>i.groupIdx===gi&&i.dishType===`side${si+1}`&&!i.excluded&&i.type==="ingredient");
        msg+=`🥗 副菜: ${side}\n`;
        const sideUrl=(dishes||{})[side]?.recipeUrl;
        if(sideUrl) msg+=`  🔗 ${sideUrl}\n`;
        if(sideIng.length) msg+=`  食材: ${sideIng.map(i=>`${i.name}${i.qty?` ${i.qty}`:""}`).join("、")}\n`;
      });
    });
  }
  if(session){
    msg+="\n🛒 買い物リスト\n";
    const included=[...(session.items||[]),...(session.dailyGoods||[])].filter(i=>!i.excluded&&i.selected!==false);
    (sortCats||[]).forEach(cat=>{
      const catItems=included.filter(i=>i.floor===cat.id);
      if(catItems.length){ msg+=`\n【${cat.name}】\n`; catItems.forEach(i=>{msg+=`・${i.name}${i.qty?` ${i.qty}`:""}\n`;}); }
    });
    const unassigned=included.filter(i=>!i.floor);
    if(unassigned.length){ msg+="\n【未仕分け】\n"; unassigned.forEach(i=>{msg+=`・${i.name}${i.qty?` ${i.qty}`:""}\n`;}); }
  }
  return msg;
}

/* ══════════════════════════════════════════
   SMALL COMPONENTS
══════════════════════════════════════════ */
function Hdr({bg,title,sub}){
  return(<div style={{background:bg||"#1B5E20",color:"white",padding:"14px 16px 12px"}}>
    <div style={{fontWeight:700,fontSize:16}}>{title}</div>
    {sub&&<div style={{fontSize:12,opacity:0.8,marginTop:2}}>{sub}</div>}
  </div>);
}
function BtnFull({label,color="#2E7D32",onClick,disabled,small}){
  return(<button onClick={onClick} disabled={disabled} style={{
    display:"block",width:"100%",padding:small?"10px 16px":"14px 16px",
    background:disabled?"#E0E0E0":color,color:"white",border:"none",
    borderRadius:10,fontSize:small?14:15,fontWeight:700,
    cursor:disabled?"not-allowed":"pointer"
  }}>{label}</button>);
}
function Lbl({children,color}){
  return(<div style={{fontSize:11,fontWeight:700,color:color||"#9E9E9E",letterSpacing:"0.06em",marginBottom:5}}>{children}</div>);
}
function Empty({icon,msg}){
  return(<div style={{padding:40,textAlign:"center"}}>
    <div style={{fontSize:48,marginBottom:12}}>{icon}</div>
    <div style={{color:"#9E9E9E",fontSize:14,lineHeight:1.8,whiteSpace:"pre-line"}}>{msg}</div>
  </div>);
}
function Overlay({msg}){
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,flexDirection:"column",gap:14}}>
    <div style={{width:32,height:32,border:"3px solid rgba(255,255,255,.3)",borderTop:"3px solid white",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
    <div style={{color:"white",fontSize:14}}>{msg}</div>
  </div>);
}
function Toast({msg}){
  return(<div style={{position:"fixed",bottom:82,left:"50%",transform:"translateX(-50%)",background:"rgba(33,33,33,.92)",color:"white",padding:"11px 22px",borderRadius:25,zIndex:2000,fontSize:14,fontWeight:500,whiteSpace:"nowrap",animation:"fadeup .25s ease"}}>{msg}</div>);
}
function SyncBadge({status}){
  const map={pending:{icon:"⏳",text:"保存待ち",bg:"#FFF9C4",c:"#F57F17"},syncing:{icon:"🔄",text:"同期中",bg:"#E3F2FD",c:"#1565C0"},err:{icon:"⚠️",text:"同期失敗",bg:"#FFEBEE",c:"#C62828"}};
  const info=map[status]; if(!info) return null;
  return(<div style={{position:"fixed",top:8,right:8,zIndex:200,background:info.bg,borderRadius:12,padding:"4px 10px",fontSize:11,display:"flex",alignItems:"center",gap:4,boxShadow:"0 2px 8px rgba(0,0,0,.14)",color:info.c,fontWeight:600}}>
    <span>{info.icon}</span><span>{info.text}</span>
  </div>);
}
function BottomNav({tab,setTab}){
  const tabs=[{icon:"📅",label:"献立"},{icon:"⭐",label:"評価"},{icon:"🛒",label:"買い物"},{icon:"⚙️",label:"設定"}];
  return(<div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"white",borderTop:"1px solid #E0E0E0",display:"flex",boxShadow:"0 -2px 8px rgba(0,0,0,.06)",zIndex:100}}>
    {tabs.map((t,i)=>(<button key={i} onClick={()=>setTab(i)} style={{flex:1,padding:"10px 0 8px",border:"none",background:"none",fontSize:10,color:tab===i?"#2E7D32":"#9E9E9E",fontWeight:tab===i?700:400,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
      <span style={{fontSize:22}}>{t.icon}</span>{t.label}
    </button>))}
  </div>);
}
function Card({title,children}){
  return(<div style={{background:"white",borderRadius:12,padding:14,marginBottom:12,boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
    <div style={{fontWeight:700,fontSize:14,marginBottom:10}}>{title}</div>
    {children}
  </div>);
}
function Btn({label,color,onClick}){
  return(<button onClick={onClick} style={{flex:1,padding:"10px 8px",background:color,color:"white",border:"none",borderRadius:8,fontSize:13,fontWeight:600}}>{label}</button>);
}
function BottomSheet({title,onClose,children}){
  return(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:500}} onClick={onClose}>
    <div onClick={e=>e.stopPropagation()} style={{background:"white",borderRadius:"18px 18px 0 0",width:"100%",maxWidth:480,padding:"20px 16px 32px",maxHeight:"80vh",overflowY:"auto"}}>
      <div style={{width:36,height:4,background:"#E0E0E0",borderRadius:2,margin:"0 auto 14px"}}/>
      {title&&<div style={{fontWeight:700,fontSize:15,marginBottom:12}}>{title}</div>}
      {children}
    </div>
  </div>);
}

/* ══════════════════════════════════════════
   RECIPE PICKER
══════════════════════════════════════════ */
function RecipePicker({dishName,sites,onClose}){
  const open=site=>{ window.open(site.url.replace("{dish}",encodeURIComponent(dishName)),"_blank","noopener,noreferrer"); onClose(); };
  return(<BottomSheet title={`🔍「${dishName}」のレシピを探す`} onClose={onClose}>
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      {(sites||[]).map(site=>(<button key={site.id} onClick={()=>open(site)} style={{padding:"14px 16px",background:"#F7F8FA",border:"1.5px solid #E0E0E0",borderRadius:10,textAlign:"left",fontSize:15,fontWeight:600,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:20}}>{site.id==="nadia"?"👩‍🍳":site.id==="cookpad"?"🍳":site.id==="youtube"?"▶️":"📸"}</span>{site.label}
      </button>))}
    </div>
    <button onClick={onClose} style={{marginTop:12,width:"100%",padding:10,border:"none",background:"none",color:"#9E9E9E",fontSize:14}}>キャンセル</button>
  </BottomSheet>);
}

/* ══════════════════════════════════════════
   MENU SCREEN
══════════════════════════════════════════ */
function MenuScreen({st,save,setBusy,setBMsg,notify}){
  const plan=st.plan;
  const groups=deriveGroups(st.settings.day_groups);
  const [wanted,setWanted]=useState("");
  const [pickerDish,setPickerDish]=useState(null);
  const [swapSrc,setSwapSrc]=useState(null); // swap中のsrc groupIdx

  const handleGenerate=async()=>{
    setBusy(true);setBMsg("献立を考えています...");
    try{ const p=await buildMenu(st,wanted); save({plan:p}); }
    catch(e){alert("エラー: "+e.message);}
    finally{setBusy(false);setBMsg("");}
  };

  const handleUpdateShopping=async()=>{
    if(!plan) return alert("先に献立を生成してください");
    setBusy(true);setBMsg("買い物リストを更新中...");
    try{
      const items=await buildShoppingItems(plan,st.sortMem,st.settings,st.dishes,st.ingredientMem);
      save({session:{weekStart:plan.weekStart,items,dailyGoods:st.session?.dailyGoods||[]}});
      notify("✅ 買い物リストを更新しました！");
    }catch(e){alert("エラー: "+e.message);}
    finally{setBusy(false);setBMsg("");}
  };

  const handleChangeMain=async(gi,oldMain,wantedForChange="",excludeCat="")=>{
    setBusy(true);setBMsg("別の料理を提案中...");
    try{
      const current=plan.groups.map(g=>g.main).join("、");
      const ngFoods=(st.settings.ng_foods||[]).join("、")||"なし";
      const wLine=wantedForChange.trim()?`\n使いたい食材: ${wantedForChange.trim()}`:"";
      const exLine=excludeCat?`\nカテゴリ「${excludeCat}」は除外`:"";
      const sys=`料理名を1つだけ返してください。余計なテキスト不要。NG食材: ${ngFoods}${wLine}${exLine}`;
      const txt=await callAI(sys,`今週の献立は「${current}」です。「${oldMain}」の代わりになる家庭的な料理を1つ提案してください。`);
      const newMain=txt.trim().replace(/[「」]/g,"");
      save({plan:{...plan,groups:plan.groups.map((g,i)=>i===gi?{...g,main:newMain}:g)}});
    }catch(e){alert("エラー: "+e.message);}
    finally{setBusy(false);setBMsg("");}
  };

  const handleDeleteGroup=gi=>{
    if(!confirm("このグループの献立を削除しますか？")) return;
    save({plan:{...plan,groups:plan.groups.map((g,i)=>i===gi?{...g,main:"",sides:[]}:g)}});
  };

  const handleSwap=(srcGi,dstGi)=>{
    const newGroups=[...plan.groups];
    const srcMain=newGroups[srcGi].main; const srcSides=newGroups[srcGi].sides||[];
    newGroups[srcGi]={...newGroups[srcGi],main:newGroups[dstGi].main,sides:newGroups[dstGi].sides||[]};
    newGroups[dstGi]={...newGroups[dstGi],main:srcMain,sides:srcSides};
    save({plan:{...plan,groups:newGroups}});
    setSwapSrc(null);
  };

  // 一品ごとのドラッグ＆ドロップ・削除（deleteFlag=trueのとき空にする）
  const handleDishSwap=(srcGi,srcSlot,dstGi,dstSlot,deleteFlag=false)=>{
    if(!plan) return;
    const getVal=(gi,slot)=>{
      const g=plan.groups[gi];
      if(slot==="main") return g.main||"";
      const idx=Number(slot.replace("side",""));
      return g.sides?.[idx]||"";
    };
    const setVal=(groups,gi,slot,val)=>{
      const g={...groups[gi]};
      if(slot==="main"){ g.main=val; }
      else{
        const idx=Number(slot.replace("side",""));
        const sides=[...(g.sides||[])];
        while(sides.length<=idx) sides.push("");
        sides[idx]=val;
        g.sides=sides;
      }
      return groups.map((gr,i)=>i===gi?g:gr);
    };
    let newGroups=[...plan.groups];
    if(deleteFlag){
      newGroups=setVal(newGroups,srcGi,srcSlot,"");
    } else {
      const srcVal=getVal(srcGi,srcSlot);
      const dstVal=getVal(dstGi,dstSlot);
      newGroups=setVal(newGroups,srcGi,srcSlot,dstVal);
      newGroups=setVal(newGroups,dstGi,dstSlot,srcVal);
    }
    save({plan:{...plan,groups:newGroups}});
  };

  const recipeSites=st.settings.recipe_sites||INIT_SETTINGS.recipe_sites;

  return(<div>
    {pickerDish&&<RecipePicker dishName={pickerDish} sites={recipeSites} onClose={()=>setPickerDish(null)}/>}
    {swapSrc!==null&&<BottomSheet title="どのグループと入れ替えますか？" onClose={()=>setSwapSrc(null)}>
      {plan.groups.map((g,gi)=>gi===swapSrc?null:(
        <button key={gi} onClick={()=>handleSwap(swapSrc,gi)} style={{display:"block",width:"100%",padding:"14px 16px",marginBottom:8,background:"#F7F8FA",border:"1.5px solid #E0E0E0",borderRadius:10,fontSize:15,fontWeight:600,textAlign:"left"}}>
          【{groups[gi]?.label}】{g.main||"（空）"}
        </button>
      ))}
      <button onClick={()=>setSwapSrc(null)} style={{marginTop:4,width:"100%",padding:10,border:"none",background:"none",color:"#9E9E9E",fontSize:14}}>キャンセル</button>
    </BottomSheet>}

    <Hdr bg="#1B5E20" title="こんだて野郎" sub={plan?`${plan.weekStart} 週`:null}/>
    <div style={{padding:"12px 13px 8px"}}>
      <input value={wanted} onChange={e=>setWanted(e.target.value)}
        placeholder="使いたい食材（例：豚バラ、きのこ）"
        style={{width:"100%",padding:"10px 12px",marginBottom:8,border:"2px solid #E0E0E0",borderRadius:8,fontSize:14,background:wanted?"#F1F8E9":"white"}}/>
      <BtnFull label="これでも食らえ" color="#2E7D32" onClick={handleGenerate}/>
      {plan&&<div style={{marginTop:8}}><BtnFull label="🛒 買い物リストを更新" color="#0D47A1" onClick={handleUpdateShopping} small/></div>}
    </div>

    {!plan?<Empty icon="🍱" msg={"上のボタンを押すと\nAIが今週の献立を提案します！"}/>:(
      <div style={{padding:"4px 13px 12px"}}>
        {plan.groups?.map((group,gi)=>{
          const gInfo=groups[gi]||groups[0];
          const dishInfo=st.dishes?.[group.main];
          return(<GroupCard key={gi} group={group} gi={gi} gInfo={gInfo} dishInfo={dishInfo}
            onPickRecipe={setPickerDish} onChangeMain={handleChangeMain}
            onDelete={()=>handleDeleteGroup(gi)} onSwap={()=>setSwapSrc(gi)} onDishSwap={handleDishSwap}
            onSaveDishInfo={(name,info)=>save({dishes:{...st.dishes,[name]:info}})}/>);
        })}
      </div>
    )}
  </div>);
}

/* 料理カード（変更ポップアップ内にフリーワード＋カテゴリ除外あり） */
function GroupCard({group,gi,gInfo,dishInfo,onPickRecipe,onChangeMain,onDelete,onSwap,onDishSwap,onSaveDishInfo}){
  const [dragOver,setDragOver]=useState(null);
  // dishAction: {slotKey, name} → DishActionSheetを開く
  const [dishAction,setDishAction]=useState(null);
  const [urlInput,setUrlInput]=useState("");
  // 変更シート用
  const [changeSheet,setChangeSheet]=useState(null); // {slotKey, name}
  const [changeWanted,setChangeWanted]=useState("");
  const [excludeCat,setExcludeCat]=useState("");
  const cats=["肉","魚","卵・豆腐","野菜メイン","麺・パスタ","丼","その他"];

  const avgScore=dishInfo?.scores?.length?avg(dishInfo.scores).toFixed(1):null;
  const diff=dishInfo?.difficulty||group.diff||0;

  // ドラッグ＆ドロップ
  const handleDragStart=(e,slotKey)=>{
    e.dataTransfer.setData("text/plain",JSON.stringify({gi,slotKey}));
    e.dataTransfer.effectAllowed="move";
  };
  const handleDragOver=(e,slotKey)=>{ e.preventDefault(); setDragOver(slotKey); };
  const handleDrop=(e,slotKey)=>{
    e.preventDefault(); setDragOver(null);
    try{
      const src=JSON.parse(e.dataTransfer.getData("text/plain"));
      if(src.gi===gi&&src.slotKey===slotKey) return;
      onDishSwap(src.gi,src.slotKey,gi,slotKey);
    }catch(err){}
  };

  const getSlotName=key=>{
    if(key==="main") return group.main||"";
    const idx=Number(key.replace("side",""));
    return group.sides?.[idx]||"";
  };

  const doChange=()=>{
    if(!changeSheet) return;
    onChangeMain(gi, changeSheet.name, changeWanted, excludeCat);
    setChangeSheet(null); setChangeWanted(""); setExcludeCat("");
  };

  const doDelete=(slotKey)=>{
    if(!confirm("この料理を削除しますか？")) return;
    onDishSwap(gi, slotKey, gi, slotKey, true); // delete flag
    setDishAction(null);
  };

  const SlotRow=({slotKey,label})=>{
    const name=getSlotName(slotKey);
    const isOver=dragOver===slotKey;
    return(
      <div
        draggable
        onDragStart={e=>handleDragStart(e,slotKey)}
        onDragOver={e=>handleDragOver(e,slotKey)}
        onDrop={e=>handleDrop(e,slotKey)}
        onDragLeave={()=>setDragOver(null)}
        style={{display:"flex",alignItems:"center",gap:6,marginBottom:4,padding:"5px 8px",borderRadius:8,cursor:"grab",background:isOver?"#E3F2FD":"transparent",border:isOver?"1.5px dashed #1565C0":"1.5px solid transparent",transition:"background .1s"}}
      >
        <span style={{fontSize:11,color:"#BDBDBD",userSelect:"none"}}>⠿</span>
        {slotKey==="main"?(
          <div style={{display:"flex",alignItems:"center",gap:6,flex:1,flexWrap:"wrap"}}>
            <span style={{fontWeight:700,fontSize:16}}>{name||"（空）"}</span>
            {avgScore&&<span style={{fontSize:11,color:"#FB8C00"}}>⭐{avgScore}</span>}
            {diff>0&&<span style={{fontSize:11,color:DIFF_COLORS[diff],background:DIFF_COLORS[diff]+"22",padding:"1px 6px",borderRadius:8}}>{DIFF_LABELS[diff]}</span>}
          </div>
        ):(
          <span style={{fontSize:13,color:"#616161",flex:1}}>{label}：{name||"（空）"}</span>
        )}
        {name&&(
          <button
            onClick={e=>{e.stopPropagation();setDishAction({slotKey,name});}}
            style={{padding:"3px 9px",background:"#E8F5E9",color:"#2E7D32",border:"1px solid #A5D6A7",borderRadius:6,fontSize:13,flexShrink:0}}
          >🔍</button>
        )}
      </div>
    );
  };

  return(<>
    {/* 一品アクションシート */}
    {dishAction&&(
      <BottomSheet title={"「"+dishAction.name+"」"} onClose={()=>setDishAction(null)}>
        {/* 登録済みレシピURL表示 */}
        {dishInfo?.recipeUrl&&(
          <div style={{background:"#E8F5E9",borderRadius:8,padding:"8px 12px",marginBottom:8,fontSize:12,color:"#2E7D32",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span>🔗 レシピURL登録済み</span>
            <a href={dishInfo.recipeUrl} target="_blank" rel="noopener noreferrer" style={{color:"#1565C0",fontSize:11}}>開く</a>
          </div>
        )}
        <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:8}}>
          {(INIT_SETTINGS.recipe_sites).map(site=>(
            <button key={site.id} onClick={()=>{window.open(site.url.replace("{dish}",encodeURIComponent(dishAction.name)),"_blank","noopener,noreferrer");setDishAction(null);}}
              style={{padding:"13px 16px",background:"#F7F8FA",border:"1.5px solid #E0E0E0",borderRadius:10,textAlign:"left",fontSize:14,fontWeight:600,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>{site.id==="nadia"?"👩‍🍳":site.id==="cookpad"?"🍳":site.id==="youtube"?"▶️":"📸"}</span>{site.label}でレシピを探す
            </button>
          ))}
          {/* レシピURL登録 */}
          <div style={{background:"#F7F8FA",border:"1.5px solid #E0E0E0",borderRadius:10,padding:"10px 14px"}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:6}}>🔗 レシピURLを登録</div>
            <div style={{display:"flex",gap:6}}>
              <input value={urlInput} onChange={e=>setUrlInput(e.target.value)} placeholder="https://..." style={{flex:1,padding:"8px 10px",border:"1.5px solid #E0E0E0",borderRadius:7,fontSize:13}}/>
              <button onClick={()=>{
                if(!urlInput.trim()) return;
                const prev=(dishInfo)||{scores:[],difficulty:0,lastServed:null};
                onSaveDishInfo(dishAction.name,{...prev,recipeUrl:urlInput.trim()});
                setUrlInput(""); setDishAction(null);
              }} style={{padding:"8px 12px",background:"#1565C0",color:"white",border:"none",borderRadius:7,fontSize:13,fontWeight:700}}>保存</button>
            </div>
          </div>
          <button onClick={()=>{setDishAction(null);setChangeSheet({slotKey:dishAction.slotKey,name:dishAction.name});}}
            style={{padding:"13px 16px",background:"#E8F5E9",border:"1.5px solid #A5D6A7",borderRadius:10,textAlign:"left",fontSize:14,fontWeight:600,display:"flex",alignItems:"center",gap:10}}>
            🔄 この料理を変更（AI提案）
          </button>
          <button onClick={()=>doDelete(dishAction.slotKey)}
            style={{padding:"13px 16px",background:"#FFEBEE",border:"1.5px solid #FFCDD2",borderRadius:10,textAlign:"left",fontSize:14,fontWeight:600,display:"flex",alignItems:"center",gap:10}}>
            🗑️ この料理を削除
          </button>
        </div>
        <button onClick={()=>setDishAction(null)} style={{width:"100%",padding:10,border:"none",background:"none",color:"#9E9E9E",fontSize:14}}>キャンセル</button>
      </BottomSheet>
    )}
    {/* 変更シート */}
    {changeSheet&&(
      <BottomSheet title={"「"+changeSheet.name+"」を変更"} onClose={()=>setChangeSheet(null)}>
        <div style={{marginBottom:10}}>
          <Lbl>使いたい食材（任意）</Lbl>
          <input value={changeWanted} onChange={e=>setChangeWanted(e.target.value)} placeholder="例：鶏もも、キャベツ" autoFocus
            style={{width:"100%",padding:"10px 12px",border:"2px solid #E0E0E0",borderRadius:8,fontSize:14}}/>
        </div>
        <div style={{marginBottom:14}}>
          <Lbl>除外したいカテゴリ（任意）</Lbl>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {cats.map(cat=>(<button key={cat} onClick={()=>setExcludeCat(excludeCat===cat?"":cat)}
              style={{padding:"6px 12px",borderRadius:16,border:"1.5px solid "+(excludeCat===cat?"#C62828":"#E0E0E0"),background:excludeCat===cat?"#FFEBEE":"#F5F5F5",color:excludeCat===cat?"#C62828":"#757575",fontSize:13,fontWeight:500}}>{cat}</button>))}
          </div>
        </div>
        <BtnFull label="別の料理に変更" color={gInfo.color} onClick={doChange}/>
        <button onClick={()=>setChangeSheet(null)} style={{marginTop:10,width:"100%",padding:10,border:"none",background:"none",color:"#9E9E9E",fontSize:14}}>キャンセル</button>
      </BottomSheet>
    )}

    <div className="fade-in" style={{background:"white",borderRadius:12,marginBottom:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
      <div style={{background:gInfo.color,color:"white",padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontWeight:700,fontSize:13}}>{gInfo.label}</span>
        <button onClick={onSwap} style={{padding:"4px 10px",background:"rgba(255,255,255,.2)",color:"white",border:"1px solid rgba(255,255,255,.4)",borderRadius:6,fontSize:12,fontWeight:600}}>↕ 入替</button>
      </div>
      <div style={{padding:"10px 14px"}}>
        <SlotRow slotKey="main" label="主菜"/>
        {(group.sides||[]).map((_,si)=>(<SlotRow key={si} slotKey={"side"+si} label={"副菜"+(si+1)}/>))}
        <div style={{fontSize:10,color:"#BDBDBD",marginTop:2}}>⠿ ドラッグで並び替え　🔍 タップで操作</div>
      </div>
    </div>
  </>);
}

/* ══════════════════════════════════════════
   RATING SCREEN
══════════════════════════════════════════ */
function RatingScreen({st,save,notify}){
  const plan=st.plan;
  if(!plan||!plan.groups?.length) return(<div><Hdr bg="#F57F17" title="⭐ 評価"/><Empty icon="⭐" msg={"献立タブで献立を生成してから\n評価してください"}/></div>);

  const allDishes=[...plan.groups.flatMap(g=>[g.main,...(g.sides||[])])].filter(Boolean);

  const rateDish=(name,score)=>{
    const prev=st.dishes?.[name]||{scores:[],difficulty:0,lastServed:null};
    const scores=[...prev.scores,score].slice(-10); // 直近10件
    save({dishes:{...st.dishes,[name]:{...prev,scores,lastServed:plan.weekStart}}});
    notify(`${name}：★${score} 評価済み`);
  };

  const setDifficulty=(name,diff)=>{
    const prev=st.dishes?.[name]||{scores:[],difficulty:0,lastServed:null};
    save({dishes:{...st.dishes,[name]:{...prev,difficulty:diff}}});
  };

  return(<div>
    <Hdr bg="#F57F17" title="⭐ 評価" sub={`${plan.weekStart} 週の料理`}/>
    <div style={{padding:"12px 13px"}}>
      {plan.groups.map((g,gi)=>{
        const gInfo=deriveGroups(st.settings.day_groups)[gi]||deriveGroups(st.settings.day_groups)[0];
        return(<div key={gi} style={{background:"white",borderRadius:12,marginBottom:10,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.07)"}}>
          <div style={{background:gInfo.color,color:"white",padding:"7px 14px",fontSize:13,fontWeight:700}}>{gInfo.label}</div>
          <div style={{padding:"10px 14px"}}>
            {[{name:g.main,label:"主菜"},...(g.sides||[]).map((s,i)=>({name:s,label:`副菜${i+1}`}))].filter(d=>d.name).map(({name,label})=>{
              const info=st.dishes?.[name]||{};
              const avgS=info.scores?.length?avg(info.scores).toFixed(1):null;
              const diff=info.difficulty||0;
              return(<div key={name} style={{marginBottom:12,paddingBottom:12,borderBottom:"1px solid #F5F5F5"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div>
                    <span style={{fontSize:11,color:"#9E9E9E"}}>{label}　</span>
                    <span style={{fontSize:15,fontWeight:600}}>{name}</span>
                    {avgS&&<span style={{fontSize:12,color:"#FB8C00",marginLeft:6}}>⭐平均{avgS}</span>}
                  </div>
                </div>
                {/* 星評価 */}
                <div style={{display:"flex",gap:6,marginBottom:8}}>
                  {[1,2,3,4,5].map(s=>(<button key={s} onClick={()=>rateDish(name,s)} style={{flex:1,padding:"8px 4px",border:`2px solid ${(info.scores?.slice(-1)[0]||0)>=s?"#FB8C00":"#E0E0E0"}`,borderRadius:8,background:(info.scores?.slice(-1)[0]||0)>=s?"#FFF8E1":"white",fontSize:18,fontWeight:700,color:(info.scores?.slice(-1)[0]||0)>=s?"#FB8C00":"#BDBDBD"}}>★</button>))}
                </div>
                {/* 難易度 */}
                <div style={{display:"flex",gap:6}}>
                  {[1,2,3].map(d=>(<button key={d} onClick={()=>setDifficulty(name,d)} style={{flex:1,padding:"6px 4px",border:`1.5px solid ${diff===d?DIFF_COLORS[d]:"#E0E0E0"}`,borderRadius:7,background:diff===d?DIFF_COLORS[d]+"22":"white",color:diff===d?DIFF_COLORS[d]:"#9E9E9E",fontSize:12,fontWeight:600}}>{DIFF_LABELS[d]}</button>))}
                </div>
              </div>);
            })}
          </div>
        </div>);
      })}
    </div>
  </div>);
}

/* ══════════════════════════════════════════
   SHOP SCREEN
══════════════════════════════════════════ */
function ShopScreen({st,save,notify,setFloor}){
  const [step,setStep]=useState(1);
  const sess=st.session;

  if(!sess) return(<div><Hdr bg="#0D47A1" title="🛒 買い物リスト" sub="まず献立を生成してください"/><Empty icon="🛒" msg={"献立タブで献立を生成したあと\n「買い物リストを更新」を押してください"}/></div>);

  const uncatCount=[...(sess.items||[]).filter(i=>!i.floor&&!i.excluded),...(sess.dailyGoods||[]).filter(i=>!i.floor&&i.selected!==false)].length;

  return(<div>
    <Hdr bg="#0D47A1" title="🛒 買い物リスト" sub={`${sess.weekStart||""}の週`}/>
    <div style={{display:"flex",background:"white",borderBottom:"2px solid #E3F2FD"}}>
      {["①食材確認","②日用品","③仕分け","④確認送信"].map((s,i)=>(<button key={i} onClick={()=>setStep(i+1)} style={{flex:1,padding:"11px 2px",border:"none",background:"none",fontSize:10,fontWeight:step===i+1?700:400,color:step===i+1?"#1565C0":"#9E9E9E",borderBottom:`2px solid ${step===i+1?"#1565C0":"transparent"}`,marginBottom:-2}}>{s}</button>))}
    </div>
    {step===1&&<Step1 sess={sess} save={save} ingredientMem={st.ingredientMem} servings={st.settings.servings||2} plan={st.plan}/>}
    {step===2&&<Step2 sess={sess} dailyGoods={st.dailyGoods} sortMem={st.sortMem} save={save}/>}
    {step===3&&(uncatCount>0
      ?<Step3Swipe sess={sess} sortCats={st.settings.sort_cats} setFloor={setFloor} onDone={()=>setStep(4)}/>
      :<div style={{padding:28,textAlign:"center"}}>
        <div style={{fontSize:52,animation:"bounce .4s ease",marginBottom:12}}>✅</div>
        <div style={{color:"#9E9E9E",fontSize:14,marginBottom:16}}>すべて仕分け済みです</div>
        <div style={{padding:"0 16px"}}><BtnFull label="④ 確認・送信へ →" color="#0D47A1" onClick={()=>setStep(4)}/></div>
      </div>
    )}
    {step===4&&<Step4 sess={sess} plan={st.plan} sortCats={st.settings.sort_cats} save={save} notify={notify} groups={deriveGroups(st.settings.day_groups)} dishes={st.dishes}/>}
  </div>);
}

/* Step1: 食材確認 + 自由追加 + 量編集 */
function Step1({sess,save,ingredientMem,servings,plan}){
  const [newItem,setNewItem]=useState("");
  const [editItem,setEditItem]=useState(null); // {id, name, qty, groupIdx}
  const [editQty,setEditQty]=useState("");

  const toggle=id=>save({session:{...sess,items:sess.items.map(i=>i.id===id?{...i,excluded:!i.excluded}:i)}});

  const addItem=()=>{
    const name=newItem.trim(); if(!name) return;
    save({session:{...sess,items:[...sess.items,{id:`custom_${Date.now()}`,name,qty:"",type:"ingredient",groupIdx:0,dishType:"main",dishName:"",floor:null,excluded:false}]}});
    setNewItem("");
  };

  const openEdit=it=>{ setEditItem(it); setEditQty(it.qty||""); };

  const saveEdit=(savePerServing)=>{
    if(!editItem) return;
    // セッションのqtyを更新
    const newItems=sess.items.map(i=>i.id===editItem.id?{...i,qty:editQty}:i);
    if(savePerServing){
      // 1人前量を計算して記憶
      const group=plan?.groups?.[editItem.groupIdx];
      const dayCount=group?.days?.length||1;
      const total=(servings||2)*dayCount;
      // 数値部分を抽出
      const numMatch=editQty.match(/[\d.]+/);
      const unitMatch=editQty.match(/[^\d.\s]+/);
      if(numMatch && total>0){
        const perServing=parseFloat(numMatch[0])/total;
        const unit=unitMatch?unitMatch[0]:"g";
        const newMem={...(ingredientMem||{}),[editItem.name]:perServing,[editItem.name+"_unit"]:unit};
        save({session:{...sess,items:newItems},ingredientMem:newMem});
      } else {
        save({session:{...sess,items:newItems}});
      }
    } else {
      save({session:{...sess,items:newItems}});
    }
    setEditItem(null);
  };

  return(<div style={{padding:"12px 13px"}}>
    {editItem&&(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:500}} onClick={()=>setEditItem(null)}>
        <div onClick={e=>e.stopPropagation()} style={{background:"white",borderRadius:"18px 18px 0 0",width:"100%",maxWidth:480,padding:"20px 16px 32px"}}>
          <div style={{width:36,height:4,background:"#E0E0E0",borderRadius:2,margin:"0 auto 14px"}}/>
          <div style={{fontWeight:700,fontSize:15,marginBottom:12}}>「{editItem.name}」の量を編集</div>
          <input value={editQty} onChange={e=>setEditQty(e.target.value)} autoFocus
            style={{width:"100%",padding:"11px 12px",border:"2px solid #E0E0E0",borderRadius:8,fontSize:16,marginBottom:12}}/>
          <button onClick={()=>saveEdit(true)} style={{display:"block",width:"100%",padding:"13px",background:"#2E7D32",color:"white",border:"none",borderRadius:10,fontSize:14,fontWeight:700,marginBottom:8}}>
            保存して次回以降も自動計算（推奨）
          </button>
          <button onClick={()=>saveEdit(false)} style={{display:"block",width:"100%",padding:"13px",background:"#F5F5F5",color:"#616161",border:"1px solid #E0E0E0",borderRadius:10,fontSize:14,fontWeight:600,marginBottom:8}}>
            今回だけ変更
          </button>
          <button onClick={()=>setEditItem(null)} style={{width:"100%",padding:10,border:"none",background:"none",color:"#9E9E9E",fontSize:14}}>キャンセル</button>
        </div>
      </div>
    )}
    <p style={{fontSize:13,color:"#9E9E9E",marginBottom:12,lineHeight:1.7}}>
      食材はON・調味料はOFF（家にあるため）がデフォルトです。タップで切替、長押しで量を編集できます。
    </p>
    {[["ingredient","🥩 食材"],["seasoning","🫙 調味料"]].map(([type,label])=>{
      const items=(sess.items||[]).filter(i=>i.type===type); if(!items.length) return null;
      return(<div key={type} style={{marginBottom:14}}>
        <Lbl>{label}</Lbl>
        <div style={{display:"flex",flexWrap:"wrap",gap:7,marginTop:6}}>
          {items.map(it=>(<button key={it.id}
            onClick={()=>toggle(it.id)}
            onContextMenu={e=>{e.preventDefault();openEdit(it);}}
            onPointerDown={e=>{
              const t=setTimeout(()=>openEdit(it),600);
              e.currentTarget._longPressTimer=t;
            }}
            onPointerUp={e=>clearTimeout(e.currentTarget._longPressTimer)}
            onPointerLeave={e=>clearTimeout(e.currentTarget._longPressTimer)}
            style={{padding:"7px 13px",borderRadius:20,border:`2px solid ${it.excluded?"#E0E0E0":"#1565C0"}`,background:it.excluded?"#F5F5F5":"#E3F2FD",color:it.excluded?"#BDBDBD":"#1565C0",fontSize:13,fontWeight:500,textDecoration:it.excluded?"line-through":"none"}}>
            {it.name}{it.qty?` (${it.qty})`:""}
          </button>))}
        </div>
      </div>);
    })}
    <div style={{marginTop:16}}>
      <Lbl>＋ 食材を追加</Lbl>
      <div style={{display:"flex",gap:8,marginTop:6}}>
        <input value={newItem} onChange={e=>setNewItem(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="食材名を入力..." style={{flex:1,padding:"10px 12px",borderRadius:8,border:"2px solid #E0E0E0",fontSize:14}}/>
        <button onClick={addItem} style={{padding:"10px 16px",background:"#1565C0",color:"white",border:"none",borderRadius:8,fontSize:14,fontWeight:700}}>追加</button>
      </div>
    </div>
  </div>);
}

/* Step2: 日用品 */
function Step2({sess,dailyGoods,sortMem,save}){
  const toggle=name=>{
    const existing=sess.dailyGoods||[];
    const found=existing.find(i=>i.name===name);
    if(found){ save({session:{...sess,dailyGoods:existing.map(i=>i.name===name?{...i,selected:!i.selected}:i)}}); }
    else{ save({session:{...sess,dailyGoods:[...existing,{id:`dg_${Date.now()}`,name,selected:true,floor:(sortMem||{})[name]||null}]}}); }
  };
  const isSelected=name=>(sess.dailyGoods||[]).find(i=>i.name===name)?.selected??false;
  if(!dailyGoods.length) return(<div style={{padding:24}}><Empty icon="🧴" msg={"設定タブで日用品を\n登録してください"}/></div>);
  return(<div style={{padding:"12px 13px"}}>
    <p style={{fontSize:13,color:"#9E9E9E",marginBottom:12,lineHeight:1.7}}>今週買うものをタップして選択してください。</p>
    <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
      {dailyGoods.map((name,i)=>{ const sel=isSelected(name); return(
        <button key={i} onClick={()=>toggle(name)} style={{padding:"7px 13px",borderRadius:20,border:`2px solid ${sel?"#E65100":"#E0E0E0"}`,background:sel?"#FBE9E7":"#F5F5F5",color:sel?"#E65100":"#757575",fontSize:13,fontWeight:500}}>{sel?"✓ ":""}{name}</button>
      );})}
    </div>
  </div>);
}

/* Step3: 仕分けスワイプ（タッチ対応 + 最大4方向）*/
function Step3Swipe({sess,sortCats,setFloor,onDone}){
  const [initList]=useState(()=>[
    ...(sess.items||[]).filter(i=>!i.floor&&!i.excluded),
    ...(sess.dailyGoods||[]).filter(i=>!i.floor&&i.selected!==false)
  ]);
  const [idx,setIdx]=useState(0);
  const [history,setHistory]=useState([]);
  const [animDir,setAnimDir]=useState(null);
  const touchStartRef=useRef(null);

  const current=initList[idx];
  const isDaily=current&&(sess.dailyGoods||[]).some(i=>i.id===current.id);

  const handleSelect=cat=>{
    setAnimDir(cat.dir||"right");
    setTimeout(()=>{
      setFloor(current.id,cat.id,isDaily);
      setHistory(h=>[...h,{itemId:current.id,isDaily}]);
      setIdx(i=>i+1);
      setAnimDir(null);
    },180);
  };

  const handleUndo=()=>{
    if(!history.length||idx===0) return;
    const last=history[history.length-1];
    setFloor(last.itemId,null,last.isDaily);
    setHistory(h=>h.slice(0,-1));
    setIdx(i=>i-1);
  };

  const handleReset=()=>{
    if(!confirm("仕分けを最初からやり直しますか？")) return;
    history.forEach(h=>setFloor(h.itemId,null,h.isDaily));
    setHistory([]); setIdx(0);
  };

  // タッチスワイプ検出
  const onTouchStart=e=>{ touchStartRef.current={x:e.touches[0].clientX,y:e.touches[0].clientY}; };
  const onTouchEnd=e=>{
    if(!touchStartRef.current||!current) return;
    const dx=e.changedTouches[0].clientX-touchStartRef.current.x;
    const dy=e.changedTouches[0].clientY-touchStartRef.current.y;
    const absDx=Math.abs(dx); const absDy=Math.abs(dy);
    if(absDx<40&&absDy<40) return;
    let dir;
    if(absDx>absDy){ dir=dx>0?"right":"left"; }
    else{ dir=dy<0?"up":"down"; }
    const cat=(sortCats||[]).find(c=>c.dir===dir);
    if(cat) handleSelect(cat);
    touchStartRef.current=null;
  };

  if(!current){
    return(<div style={{padding:28,textAlign:"center"}}>
      <div style={{fontSize:52,marginBottom:12}}>✅</div>
      <div style={{color:"#9E9E9E",fontSize:14,marginBottom:16}}>仕分け完了！</div>
      <div style={{padding:"0 16px"}}><BtnFull label="④ 確認・送信へ →" color="#0D47A1" onClick={onDone}/></div>
    </div>);
  }

  const progress=Math.round((idx/initList.length)*100);
  const tx=animDir==="right"?"translateX(130%) rotate(18deg)":animDir==="left"?"translateX(-130%) rotate(-18deg)":animDir==="up"?"translateY(-130%)":animDir==="down"?"translateY(130%)":"none";

  // ボタン配置を方向ごとに決める
  const cats=sortCats||[];
  const rightCat=cats.find(c=>c.dir==="right"); const leftCat=cats.find(c=>c.dir==="left");
  const upCat=cats.find(c=>c.dir==="up"); const downCat=cats.find(c=>c.dir==="down");

  return(<div style={{padding:"16px 13px"}} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:12,color:"#9E9E9E"}}>
        <span>仕分け中</span><span>{idx} / {initList.length}</span>
      </div>
      <div style={{height:5,background:"#E0E0E0",borderRadius:3}}>
        <div style={{height:"100%",background:"#1565C0",borderRadius:3,width:`${progress}%`,transition:"width .25s ease"}}/>
      </div>
    </div>

    {upCat&&<div style={{marginBottom:8}}><button onClick={()=>handleSelect(upCat)} style={{width:"100%",padding:"12px 8px",border:"none",borderRadius:10,background:upCat.color,color:"white",fontSize:15,fontWeight:700,boxShadow:"0 3px 8px rgba(0,0,0,.18)"}}>↑ {upCat.name}</button></div>}

    <div style={{background:"white",borderRadius:18,padding:"36px 24px",textAlign:"center",boxShadow:"0 6px 24px rgba(0,0,0,.1)",marginBottom:12,minHeight:140,transform:tx,opacity:animDir?0:1,transition:"transform .18s ease, opacity .18s ease"}}>
      <div style={{fontSize:13,color:"#9E9E9E",marginBottom:10}}>{isDaily?"🧴 日用品":"🥩 食材"}</div>
      <div style={{fontSize:24,fontWeight:700,marginBottom:8}}>{current.name}</div>
      {current.qty&&<div style={{fontSize:14,color:"#757575"}}>{current.qty}</div>}
      <div style={{fontSize:11,color:"#BDBDBD",marginTop:8}}>スワイプまたはボタンで仕分け</div>
    </div>

    <div style={{display:"flex",gap:10,marginBottom:8}}>
      {leftCat&&<button onClick={()=>handleSelect(leftCat)} style={{flex:1,padding:"18px 8px",border:"none",borderRadius:14,background:leftCat.color,color:"white",fontSize:17,fontWeight:700,boxShadow:"0 4px 10px rgba(0,0,0,.18)"}}>← {leftCat.name}</button>}
      {rightCat&&<button onClick={()=>handleSelect(rightCat)} style={{flex:1,padding:"18px 8px",border:"none",borderRadius:14,background:rightCat.color,color:"white",fontSize:17,fontWeight:700,boxShadow:"0 4px 10px rgba(0,0,0,.18)"}}>→ {rightCat.name}</button>}
    </div>

    {downCat&&<div style={{marginBottom:8}}><button onClick={()=>handleSelect(downCat)} style={{width:"100%",padding:"12px 8px",border:"none",borderRadius:10,background:downCat.color,color:"white",fontSize:15,fontWeight:700,boxShadow:"0 3px 8px rgba(0,0,0,.18)"}}>↓ {downCat.name}</button></div>}

    <div style={{display:"flex",gap:8}}>
      <button onClick={handleUndo} disabled={!history.length} style={{flex:1,padding:"11px 8px",border:`2px solid ${history.length?"#9E9E9E":"#E0E0E0"}`,borderRadius:10,background:"white",color:history.length?"#424242":"#BDBDBD",fontSize:13,fontWeight:600,cursor:history.length?"pointer":"not-allowed"}}>← 1つ戻る</button>
      <button onClick={handleReset} style={{flex:1,padding:"11px 8px",border:"2px solid #EF5350",borderRadius:10,background:"white",color:"#EF5350",fontSize:13,fontWeight:600}}>🔄 全リセット</button>
    </div>
  </div>);
}

/* Step4: 確認送信 */
function Step4({sess,plan,sortCats,save,notify,groups,dishes}){
  const included=[...(sess.items||[]).filter(i=>!i.excluded),...(sess.dailyGoods||[]).filter(i=>i.selected!==false)];

  const handleSend=async()=>{
    const msg=buildLINEMessage(plan,sess,sortCats||[],dishes);
    await notify(msg,true);
  };
  const handleCopy=async()=>{
    const msg=buildLINEMessage(plan,sess,sortCats||[],dishes);
    try{ await navigator.clipboard.writeText(msg); notify("✅ クリップボードにコピーしました！"); }
    catch(e){ alert("コピーに失敗しました"); }
  };

  return(<div style={{padding:"12px 13px 20px"}}>
    {plan?.groups&&(<div style={{marginBottom:16}}>
      <Lbl color="#2E7D32">📅 今週の献立</Lbl>
      <div style={{background:"white",borderRadius:12,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
        {plan.groups.map((g,gi)=>{
          const gInfo=groups[gi]||groups[0];
          const mainIng=(sess.items||[]).filter(i=>i.groupIdx===gi&&i.dishType==="main"&&!i.excluded&&i.type==="ingredient");
          return(<div key={gi} style={{padding:"11px 14px",borderBottom:gi<plan.groups.length-1?"1px solid #F5F5F5":"none"}}>
            <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:3}}>
              <span style={{fontSize:11,fontWeight:700,color:gInfo.color,minWidth:56,flexShrink:0}}>{gInfo.label}</span>
              <span style={{fontSize:15,fontWeight:600}}>🍽 {g.main||"（削除済み）"}</span>
            </div>
            {(dishes||{})[g.main]?.recipeUrl&&<div style={{fontSize:11,color:"#1565C0",marginLeft:64,marginBottom:2}}>🔗 <a href={(dishes||{})[g.main].recipeUrl} target="_blank" rel="noopener noreferrer" style={{color:"#1565C0"}}>{(dishes||{})[g.main].recipeUrl}</a></div>}
            {mainIng.length>0&&<div style={{fontSize:11,color:"#9E9E9E",marginLeft:64,marginBottom:3}}>食材：{mainIng.map(i=>`${i.name}${i.qty?` ${i.qty}`:""}`).join("、")}</div>}
            {(g.sides||[]).map((side,si)=>{
              const sideIng=(sess.items||[]).filter(i=>i.groupIdx===gi&&i.dishType===`side${si+1}`&&!i.excluded&&i.type==="ingredient");
              return(<div key={si} style={{marginLeft:64}}>
                <span style={{fontSize:12,color:"#757575"}}>🥗 {side}</span>
                {(dishes||{})[side]?.recipeUrl&&<div style={{fontSize:11,color:"#1565C0"}}>🔗 <a href={(dishes||{})[side].recipeUrl} target="_blank" rel="noopener noreferrer" style={{color:"#1565C0"}}>{(dishes||{})[side].recipeUrl}</a></div>}
                {sideIng.length>0&&<div style={{fontSize:11,color:"#BDBDBD"}}>食材：{sideIng.map(i=>`${i.name}${i.qty?` ${i.qty}`:""}`).join("、")}</div>}
              </div>);
            })}
          </div>);
        })}
      </div>
    </div>)}

    <Lbl color="#0D47A1">🛒 買い物リスト</Lbl>
    {(sortCats||[]).map(cat=>{
      const catItems=included.filter(i=>i.floor===cat.id); if(!catItems.length) return null;
      return(<div key={cat.id} style={{background:"white",borderRadius:12,marginBottom:8,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
        <div style={{background:cat.color,color:"white",padding:"7px 14px",fontSize:13,fontWeight:700}}>{cat.name}（{catItems.length}品）</div>
        {catItems.map((it,i)=>(<div key={it.id} style={{padding:"9px 14px",fontSize:14,borderBottom:i<catItems.length-1?"1px solid #F5F5F5":"none"}}>{it.name}{it.qty?` — ${it.qty}`:""}</div>))}
      </div>);
    })}
    {included.filter(i=>!i.floor).length>0&&(<div style={{background:"white",borderRadius:12,marginBottom:8,overflow:"hidden",boxShadow:"0 1px 4px rgba(0,0,0,.06)"}}>
      <div style={{background:"#9E9E9E",color:"white",padding:"7px 14px",fontSize:13,fontWeight:700}}>未仕分け</div>
      {included.filter(i=>!i.floor).map((it,i)=>(<div key={it.id} style={{padding:"9px 14px",fontSize:14,borderBottom:"1px solid #F5F5F5"}}>{it.name}{it.qty?` — ${it.qty}`:""}</div>))}
    </div>)}

    <div style={{marginTop:18,display:"flex",flexDirection:"column",gap:8}}>
      <BtnFull label="📲 LINEに送信" color="#2E7D32" onClick={handleSend}/>
      <BtnFull label="📋 コピーしてLINEに貼付" color="#5C6BC0" onClick={handleCopy} small/>
    </div>
  </div>);
}

/* ══════════════════════════════════════════
   DAY GROUP EDITOR（バグ修正済み）
══════════════════════════════════════════ */
function DayGroupEditor({dayGroups,onChange}){
  // dayGroups は辞書形式 {monday:1, tuesday:2, ...}
  const getGid=day=>dayGroups[day]||1;

  const cycleDayGroup=day=>{
    const curGid=getGid(day);
    const existingGids=[...new Set(DAYS.map(d=>dayGroups[d]||1))].sort((a,b)=>a-b);
    const maxGid=existingGids[existingGids.length-1];
    // G7を超えたら必ずG1に戻る。新グループはmaxGid+1（上限7）まで
    const maxAllowed=Math.min(maxGid+1, GROUP_COLORS.length);
    const nextGid=curGid>=maxAllowed ? 1 : curGid+1;
    onChange({...dayGroups,[day]:nextGid});
  };

  // サマリー生成（辞書→グループ別集計）
  const groupMap={};
  DAYS.forEach(day=>{
    const gid=getGid(day);
    if(!groupMap[gid]) groupMap[gid]=[];
    groupMap[gid].push(day);
  });
  const summaryGroups=Object.entries(groupMap).sort((a,b)=>a[0]-b[0]);

  return(<div>
    <div style={{display:"flex",gap:6,marginBottom:10}}>
      {DAYS.map(day=>{
        const gid=getGid(day);
        const ci=(gid-1)%GROUP_COLORS.length;
        const color=GROUP_COLORS[ci];
        const light=GROUP_LIGHT[ci];
        return(<button key={day} onClick={()=>cycleDayGroup(day)} style={{flex:1,padding:"10px 2px",border:"2px solid "+color,borderRadius:8,background:light,color,fontWeight:700,fontSize:14,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <span>{DAY_JP[day]}</span>
          <span style={{fontSize:9,opacity:0.8}}>G{gid}</span>
        </button>);
      })}
    </div>
    <div style={{fontSize:12,color:"#9E9E9E"}}>
      {summaryGroups.map(([gid,days])=>(<div key={gid} style={{display:"flex",alignItems:"center",gap:4,marginBottom:3}}>
        <div style={{width:10,height:10,borderRadius:2,background:GROUP_COLORS[(Number(gid)-1)%GROUP_COLORS.length],flexShrink:0}}/>
        <span>G{gid}：{days.map(d=>DAY_JP[d]).join("・")}（{days.length}日間・同一献立）</span>
      </div>))}
    </div>
  </div>);
}

/* ══════════════════════════════════════════
   SORT CATS EDITOR（追加・削除・4方向対応）
══════════════════════════════════════════ */
function SortCatsEditor({sortCats,onChange}){
  const cats=sortCats||[];
  const dirs=["right","left","up","down"];
  const usedDirs=cats.map(c=>c.dir);
  const availDirs=dirs.filter(d=>!usedDirs.includes(d));

  const updateCat=(i,patch)=>onChange(cats.map((c,ci)=>ci===i?{...c,...patch}:c));
  const deleteCat=i=>{ if(cats.length<=1){alert("最低1つは必要です");return;} onChange(cats.filter((_,ci)=>ci!==i)); };
  const addCat=()=>{
    if(cats.length>=4){alert("最大4つまでです");return;}
    const dir=availDirs[0]||"right";
    const id=`cat_${Date.now()}`;
    onChange([...cats,{id,name:"新カテゴリ",color:CAT_COLORS[cats.length%CAT_COLORS.length],dir}]);
  };

  return(<div>
    {cats.map((cat,i)=>(<div key={cat.id} style={{background:"#F7F8FA",borderRadius:10,padding:"10px 12px",marginBottom:8}}>
      <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
        <div style={{width:14,height:14,borderRadius:3,background:cat.color,flexShrink:0}}/>
        <input value={cat.name} onChange={e=>updateCat(i,{name:e.target.value})}
          style={{flex:1,padding:"7px 10px",border:"2px solid #E0E0E0",borderRadius:7,fontSize:14}}/>
        <button onClick={()=>deleteCat(i)} style={{padding:"6px 10px",background:"#FFEBEE",color:"#C62828",border:"1px solid #FFCDD2",borderRadius:7,fontSize:12,fontWeight:600}}>削除</button>
      </div>
      <div style={{display:"flex",gap:6}}>
        {dirs.map(dir=>(<button key={dir} onClick={()=>updateCat(i,{dir})} style={{flex:1,padding:"6px 4px",border:`1.5px solid ${cat.dir===dir?cat.color:"#E0E0E0"}`,borderRadius:7,background:cat.dir===dir?cat.color+"22":"white",color:cat.dir===dir?cat.color:"#9E9E9E",fontSize:13,fontWeight:600}}>{DIR_LABELS[dir]}</button>))}
      </div>
    </div>))}
    {cats.length<4&&<button onClick={addCat} style={{width:"100%",padding:"10px",background:"#F7F8FA",border:"2px dashed #E0E0E0",borderRadius:10,color:"#9E9E9E",fontSize:14,fontWeight:600}}>＋ カテゴリを追加</button>}
  </div>);
}

/* ══════════════════════════════════════════
   FROZEN MEALS EDITOR
══════════════════════════════════════════ */
function FrozenMealsEditor({frozenMeals,onChange}){
  const toggle=key=>{
    if(frozenMeals.includes(key)) onChange(frozenMeals.filter(k=>k!==key));
    else onChange([...frozenMeals,key]);
  };
  return(<div>
    <p style={{fontSize:12,color:"#9E9E9E",marginBottom:10,lineHeight:1.6}}>❄️をタップすると冷凍食品固定になります。AIはその枠をスキップします。</p>
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
        <thead><tr>
          <th style={{padding:"6px 4px",color:"#9E9E9E",fontWeight:600,width:40}}></th>
          {DAYS.map(d=>(<th key={d} style={{padding:"6px 4px",color:"#616161",fontWeight:600,textAlign:"center"}}>{DAY_JP[d]}</th>))}
        </tr></thead>
        <tbody>{["lunch","dinner"].map(meal=>(<tr key={meal}>
          <td style={{padding:"6px 4px",color:"#9E9E9E",fontSize:11,fontWeight:600}}>{meal==="lunch"?"昼":"夜"}</td>
          {DAYS.map(d=>{ const key=`${d}_${meal}`; const on=frozenMeals.includes(key);
            return(<td key={d} style={{padding:"4px",textAlign:"center"}}>
              <button onClick={()=>toggle(key)} style={{width:32,height:32,borderRadius:6,border:`1.5px solid ${on?"#1565C0":"#E0E0E0"}`,background:on?"#E3F2FD":"white",fontSize:16}}>{on?"❄️":"・"}</button>
            </td>);
          })}
        </tr>))}</tbody>
      </table>
    </div>
  </div>);
}

/* ══════════════════════════════════════════
   MEAL CONFIG EDITOR
══════════════════════════════════════════ */
function MealConfigEditor({mealConfig,onChange}){
  const cfg=mealConfig||INIT_SETTINGS.meal_config;
  const upd=(meal,patch)=>onChange({...cfg,[meal]:{...cfg[meal],...patch}});
  return(<div>
    {["lunch","dinner"].map(meal=>(<div key={meal} style={{marginBottom:12}}>
      <Lbl>{meal==="lunch"?"昼食":"夕食"}</Lbl>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{fontSize:13,color:"#757575"}}>おかず</span>
        {[0,1,2,3,4].map(n=>(<button key={n} onClick={()=>upd(meal,{sides:n})} style={{width:36,height:36,borderRadius:18,border:`2px solid ${cfg[meal].sides===n?"#2E7D32":"#E0E0E0"}`,background:cfg[meal].sides===n?"#E8F5E9":"white",color:cfg[meal].sides===n?"#2E7D32":"#757575",fontWeight:700,fontSize:14}}>{n}</button>))}
        <span style={{fontSize:13,color:"#757575"}}>品</span>
        <button onClick={()=>upd(meal,{soup:!cfg[meal].soup})} style={{padding:"7px 12px",border:`2px solid ${cfg[meal].soup?"#0D47A1":"#E0E0E0"}`,borderRadius:8,background:cfg[meal].soup?"#E3F2FD":"white",color:cfg[meal].soup?"#0D47A1":"#757575",fontSize:13,fontWeight:600}}>汁物{cfg[meal].soup?"✓ あり":"なし"}</button>
      </div>
    </div>))}
  </div>);
}

/* ══════════════════════════════════════════
   CUSTOM RECIPES EDITOR
══════════════════════════════════════════ */
function CustomRecipesEditor({customRecipes,onChange,notify}){
  const [form,setForm]=useState({name:"",ingredients:"",url:"",score:""});
  const [showForm,setShowForm]=useState(false);
  const recipes=customRecipes||[];

  const add=()=>{
    if(!form.name.trim()){alert("料理名を入力してください");return;}
    const newR={id:`cr_${Date.now()}`,name:form.name.trim(),ingredients:form.ingredients.trim(),url:form.url.trim(),score:form.score?Number(form.score):null};
    onChange([...recipes,newR]);
    setForm({name:"",ingredients:"",url:"",score:""});
    setShowForm(false);
    notify("✅ レシピを登録しました");
  };
  const del=id=>{ if(!confirm("削除しますか？"))return; onChange(recipes.filter(r=>r.id!==id)); };

  return(<div>
    {recipes.length===0&&<div style={{fontSize:12,color:"#BDBDBD",marginBottom:10}}>登録なし</div>}
    {recipes.map(r=>(<div key={r.id} style={{background:"#F7F8FA",borderRadius:10,padding:"10px 12px",marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontWeight:600,fontSize:14}}>{r.name}{r.score?` ⭐${r.score}`:""}</div>
          {r.ingredients&&<div style={{fontSize:12,color:"#757575",marginTop:2}}>食材: {r.ingredients}</div>}
          {r.url&&<a href={r.url} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:"#1565C0"}}>🔗 レシピURL</a>}
        </div>
        <button onClick={()=>del(r.id)} style={{padding:"4px 8px",background:"#FFEBEE",color:"#C62828",border:"none",borderRadius:6,fontSize:12}}>削除</button>
      </div>
    </div>))}
    {showForm?(
      <div style={{background:"#F7F8FA",borderRadius:10,padding:"12px"}}>
        {[{k:"name",ph:"料理名 *"},{k:"ingredients",ph:"食材（例：鶏もも・玉ねぎ）"},{k:"url",ph:"レシピURL（任意）"}].map(({k,ph})=>(<input key={k} value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} placeholder={ph}
          style={{display:"block",width:"100%",padding:"9px 11px",border:"2px solid #E0E0E0",borderRadius:8,fontSize:14,marginBottom:8}}/>))}
        <div style={{marginBottom:8}}>
          <div style={{fontSize:12,color:"#9E9E9E",marginBottom:5}}>評価（任意）</div>
          <div style={{display:"flex",gap:6}}>
            {[1,2,3,4,5].map(s=>(<button key={s} type="button" onClick={()=>setForm(f=>({...f,score:f.score===s?0:s}))}
              style={{flex:1,padding:"8px 4px",border:"2px solid "+(form.score>=s?"#FB8C00":"#E0E0E0"),borderRadius:8,background:form.score>=s?"#FFF8E1":"white",fontSize:18,fontWeight:700,color:form.score>=s?"#FB8C00":"#BDBDBD"}}>★</button>))}
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={add} style={{flex:1,padding:"10px",background:"#2E7D32",color:"white",border:"none",borderRadius:8,fontSize:14,fontWeight:700}}>登録</button>
          <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"10px",background:"white",color:"#9E9E9E",border:"1px solid #E0E0E0",borderRadius:8,fontSize:14}}>キャンセル</button>
        </div>
      </div>
    ):(
      <button onClick={()=>setShowForm(true)} style={{width:"100%",padding:"10px",background:"#F7F8FA",border:"2px dashed #E0E0E0",borderRadius:10,color:"#9E9E9E",fontSize:14,fontWeight:600}}>＋ レシピを登録</button>
    )}
  </div>);
}

/* ══════════════════════════════════════════
   SETTINGS SCREEN
══════════════════════════════════════════ */
function SettingsScreen({st,save,setBusy,setBMsg,notify}){
  const s=st.settings;
  const [newGood,setNewGood]=useState("");
  const [sheetsMsg,setSheetsMsg]=useState("");
  const upd=patch=>save({settings:{...s,...patch}});

  const testSheets=async()=>{
    if(!s.sheets_url)return alert("URLを入力してください");
    setBusy(true);setBMsg("接続テスト中...");
    try{ await syncToSheets(s.sheets_url,s.sheets_token,st); setSheetsMsg("✅ 接続成功！"); }
    catch(e){ setSheetsMsg("❌ 失敗: "+e.message); }
    finally{setBusy(false);setBMsg("");}
  };
  const loadNow=async()=>{
    if(!s.sheets_url)return alert("URLを入力してください");
    setBusy(true);setBMsg("データを読み込み中...");
    try{
      const remote=await loadFromSheets(s.sheets_url,s.sheets_token);
      if(remote){ save({...remote}); notify("✅ データを読み込みました！"); }
      else alert("データがありませんでした");
    }catch(e){alert("エラー: "+e.message);}
    finally{setBusy(false);setBMsg("");}
  };
  const addGood=()=>{
    const name=newGood.trim();
    if(!name||st.dailyGoods.includes(name))return;
    save({dailyGoods:[...st.dailyGoods,name]});
    setNewGood("");
  };
  const Field=({label,value,onChange,placeholder})=>(<div style={{marginBottom:12}}>
    <Lbl>{label}</Lbl>
    <input value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{width:"100%",padding:"11px 12px",borderRadius:8,border:"2px solid #E0E0E0",fontSize:14}}/>
  </div>);

  return(<div>
    <Hdr bg="#37474F" title="⚙️ 設定"/>
    <div style={{padding:"16px 13px"}}>

      {/* Sheets */}
      <Card title="📊 Googleスプレッドシート連携">
        <p style={{fontSize:12,color:"#9E9E9E",marginBottom:10,lineHeight:1.6}}>複数端末でデータを共有できます。GASのURLを設定してください。</p>
        <Field label="GAS Web App URL" value={s.sheets_url} onChange={v=>upd({sheets_url:v})} placeholder="https://script.google.com/..."/>
        <Field label="認証トークン（任意）" value={s.sheets_token} onChange={v=>upd({sheets_token:v})} placeholder="自分で決めたパスワード文字列"/>
        <div style={{display:"flex",gap:8}}>
          <Btn label="接続テスト" color="#37474F" onClick={testSheets}/>
          <Btn label="今すぐ読み込み" color="#1B5E20" onClick={loadNow}/>
        </div>
        {sheetsMsg&&<div style={{marginTop:8,fontSize:12,color:sheetsMsg.includes("✅")?"#2E7D32":"#C62828"}}>{sheetsMsg}</div>}
      </Card>

      {/* LINE */}
      <Card title="📲 LINE Notify設定">
        <Field label="LINEトークン" value={s.line_token} onChange={v=>upd({line_token:v})} placeholder="LINE Notifyのアクセストークン"/>
      </Card>

      {/* 曜日グループ */}
      <Card title="📅 曜日グループ設定">
        <p style={{fontSize:12,color:"#9E9E9E",marginBottom:10,lineHeight:1.6}}>同じ色の曜日は同じ献立になります。タップするたびに色が変わります。</p>
        <DayGroupEditor dayGroups={s.day_groups||INIT_SETTINGS.day_groups} onChange={v=>upd({day_groups:v})}/>
      </Card>

      {/* 冷凍食品 */}
      <Card title="❄️ 冷凍食品設定">
        <FrozenMealsEditor frozenMeals={s.frozen_meals||[]} onChange={v=>upd({frozen_meals:v})}/>
      </Card>

      {/* NG食材 */}
      <Card title="🚫 NG食材">
        <p style={{fontSize:12,color:"#9E9E9E",marginBottom:10,lineHeight:1.6}}>ここに登録した食材はAIが献立に含めません。</p>
        <NgFoodsEditor ngFoods={s.ng_foods||[]} onChange={v=>upd({ng_foods:v})}/>
      </Card>

      {/* 人数 */}
      <Card title="👨‍👩‍👧 1食の人数">
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {[1,2,3,4,5].map(n=>(<button key={n} onClick={()=>upd({servings:n})} style={{width:44,height:44,borderRadius:22,border:`2px solid ${s.servings===n?"#2E7D32":"#E0E0E0"}`,background:s.servings===n?"#E8F5E9":"white",color:s.servings===n?"#2E7D32":"#757575",fontWeight:700,fontSize:16}}>{n}</button>))}
          <span style={{fontSize:13,color:"#757575"}}>人</span>
        </div>
      </Card>

      {/* ローテーション */}
      <Card title="🔄 ローテーション管理">
        <p style={{fontSize:12,color:"#9E9E9E",marginBottom:10,lineHeight:1.6}}>直近N週間に出した料理は提案から除外します。</p>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {[1,2,3,4,5,6].map(n=>(<button key={n} onClick={()=>upd({rotation_weeks:n})} style={{width:44,height:44,borderRadius:22,border:`2px solid ${s.rotation_weeks===n?"#1565C0":"#E0E0E0"}`,background:s.rotation_weeks===n?"#E3F2FD":"white",color:s.rotation_weeks===n?"#1565C0":"#757575",fontWeight:700,fontSize:16}}>{n}</button>))}
          <span style={{fontSize:13,color:"#757575"}}>週間</span>
        </div>
      </Card>

      {/* 食事構成 */}
      <Card title="🍽 食事構成設定">
        <MealConfigEditor mealConfig={s.meal_config} onChange={v=>upd({meal_config:v})}/>
      </Card>

      {/* 仕分けカテゴリ */}
      <Card title="↔️ 仕分けカテゴリ（最大4つ）">
        <SortCatsEditor sortCats={s.sort_cats} onChange={v=>upd({sort_cats:v})}/>
      </Card>

      {/* レシピサイト */}
      <Card title="🔍 レシピ検索サイト">
        {(s.recipe_sites||INIT_SETTINGS.recipe_sites).map((site,i)=>(<div key={site.id} style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
          <span style={{fontSize:18,width:28,flexShrink:0}}>{site.id==="nadia"?"👩‍🍳":site.id==="cookpad"?"🍳":site.id==="youtube"?"▶️":"📸"}</span>
          <input value={site.label} onChange={e=>{
            const sites=(s.recipe_sites||INIT_SETTINGS.recipe_sites).map((ss,si)=>si===i?{...ss,label:e.target.value}:ss);
            upd({recipe_sites:sites});
          }} style={{flex:1,padding:"7px 10px",border:"2px solid #E0E0E0",borderRadius:7,fontSize:14}}/>
        </div>))}
      </Card>

      {/* 手動レシピ登録 */}
      <Card title="📖 手動レシピ登録">
        <CustomRecipesEditor customRecipes={st.customRecipes} onChange={v=>save({customRecipes:v})} notify={notify}/>
      </Card>

      {/* 日用品 */}
      <Card title="🧴 日用品リスト">
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <input value={newGood} onChange={e=>setNewGood(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addGood()} placeholder="日用品名を入力..."
            style={{flex:1,padding:"9px 11px",border:"2px solid #E0E0E0",borderRadius:8,fontSize:14}}/>
          <button onClick={addGood} style={{padding:"9px 14px",background:"#E65100",color:"white",border:"none",borderRadius:8,fontSize:14,fontWeight:700}}>追加</button>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {st.dailyGoods.map((name,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 10px",background:"#FBE9E7",borderRadius:16,border:"1px solid #FFCCBC"}}>
            <span style={{fontSize:13}}>{name}</span>
            <button onClick={()=>save({dailyGoods:st.dailyGoods.filter(g=>g!==name)})} style={{background:"none",border:"none",color:"#BF360C",fontSize:16,cursor:"pointer",padding:"0 2px",lineHeight:1}}>×</button>
          </div>))}
        </div>
      </Card>

      {/* データ管理 */}
      <Card title="🗑️ データ管理">
        <button onClick={()=>{ if(!confirm("献立と買い物リストをリセットしますか？\n設定・仕分け記憶・評価は保持されます。"))return; save({plan:null,session:null}); }}
          style={{width:"100%",padding:11,background:"#FFEBEE",color:"#C62828",border:"2px solid #EF9A9A",borderRadius:8,fontSize:13,fontWeight:600}}>
          献立・買い物リストをリセット
        </button>
      </Card>
    </div>
  </div>);
}

/* NG食材Editor（Settings内で使用） */
function NgFoodsEditor({ngFoods,onChange}){
  const [input,setInput]=useState("");
  const add=()=>{ const v=input.trim(); if(!v||ngFoods.includes(v))return; onChange([...ngFoods,v]); setInput(""); };
  return(<div>
    <div style={{display:"flex",gap:8,marginBottom:10}}>
      <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="食材名（例：えび、牛肉）"
        style={{flex:1,padding:"9px 11px",border:"2px solid #E0E0E0",borderRadius:8,fontSize:14}}/>
      <button onClick={add} style={{padding:"9px 14px",background:"#C62828",color:"white",border:"none",borderRadius:8,fontSize:14,fontWeight:700}}>追加</button>
    </div>
    {ngFoods.length===0&&<div style={{fontSize:12,color:"#BDBDBD"}}>登録なし</div>}
    <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
      {ngFoods.map((name,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 10px",background:"#FFEBEE",borderRadius:16,border:"1px solid #FFCDD2"}}>
        <span style={{fontSize:13}}>🚫 {name}</span>
        <button onClick={()=>onChange(ngFoods.filter((_,fi)=>fi!==i))} style={{background:"none",border:"none",color:"#C62828",fontSize:16,cursor:"pointer",padding:"0 2px",lineHeight:1}}>×</button>
      </div>))}
    </div>
  </div>);
}

/* ══════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════ */
export default function App(){
  const [st,setSt]=useState(()=>loadState());
  const [tab,setTab]=useState(0);
  const [busy,setBusy]=useState(false);
  const [bMsg,setBMsg]=useState("");
  const [toast,setToast]=useState(null);
  const [syncStatus,setSyncStatus]=useState("idle");
  const syncTimer=useRef(null);
  const isFirst=useRef(true);

  useEffect(()=>{
    saveState(st);
    if(isFirst.current){isFirst.current=false;return;}
    if(!st.settings.sheets_url) return;
    clearTimeout(syncTimer.current);
    setSyncStatus("pending");
    syncTimer.current=setTimeout(async()=>{
      setSyncStatus("syncing");
      try{ await syncToSheets(st.settings.sheets_url,st.settings.sheets_token,st); setSyncStatus("ok"); setTimeout(()=>setSyncStatus("idle"),2000); }
      catch(e){ setSyncStatus("err"); }
    },2000);
  },[st]);

  useEffect(()=>{
    const {sheets_url,sheets_token}=st.settings;
    if(!sheets_url) return;
    (async()=>{ try{ const remote=await loadFromSheets(sheets_url,sheets_token); if(remote) setSt(prev=>({...prev,...remote,settings:{...prev.settings,...(remote.settings||{})}})); }catch(e){} })();
  },[]);

  const save=useCallback(patch=>{
    setSt(prev=>{
      const next={...prev};
      Object.keys(patch).forEach(k=>{ next[k]=k==="settings"?{...prev.settings,...patch.settings}:patch[k]; });
      return next;
    });
  },[]);

  const setFloor=useCallback((itemId,floor,isDaily=false)=>{
    setSt(prev=>{
      if(!prev.session) return prev;
      const newSortMem={...prev.sortMem};
      const newSession={...prev.session};
      if(isDaily){
        const item=(prev.session.dailyGoods||[]).find(i=>i.id===itemId);
        if(item&&floor) newSortMem[item.name]=floor;
        newSession.dailyGoods=(prev.session.dailyGoods||[]).map(i=>i.id===itemId?{...i,floor}:i);
      }else{
        const item=(prev.session.items||[]).find(i=>i.id===itemId);
        if(item&&floor) newSortMem[item.name]=floor;
        newSession.items=(prev.session.items||[]).map(i=>i.id===itemId?{...i,floor}:i);
      }
      return {...prev,session:newSession,sortMem:newSortMem};
    });
  },[]);

  const notify=useCallback(async(msg,sendLine=false)=>{
    if(sendLine){
      const token=st.settings.line_token;
      setBusy(true);setBMsg("LINEに送信中...");
      try{
        if(token){
          const r=await fetch("https://notify-api.line.me/api/notify",{method:"POST",headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/x-www-form-urlencoded"},body:`message=${encodeURIComponent(msg)}`});
          if(r.ok){setToast("✅ LINEに送信しました！");setTimeout(()=>setToast(null),3000);return;}
        }
        await navigator.clipboard.writeText(msg);
        setToast(token?"LINE送信失敗。クリップボードにコピーしました":"クリップボードにコピーしました");
        setTimeout(()=>setToast(null),3000);
      }catch(e){alert("送信に失敗しました");}
      finally{setBusy(false);setBMsg("");}
    }else{
      setToast(msg);
      setTimeout(()=>setToast(null),3000);
    }
  },[st.settings.line_token]);

  return(<div style={{maxWidth:480,margin:"0 auto",minHeight:"100dvh",background:"#F7F8FA",fontFamily:"'Noto Sans JP',sans-serif",paddingBottom:72,position:"relative"}}>
    <style>{CSS}</style>
    {busy&&<Overlay msg={bMsg}/>}
    {toast&&<Toast msg={toast}/>}
    <SyncBadge status={syncStatus}/>
    {tab===0&&<MenuScreen st={st} save={save} setBusy={setBusy} setBMsg={setBMsg} notify={notify}/>}
    {tab===1&&<RatingScreen st={st} save={save} notify={notify}/>}
    {tab===2&&<ShopScreen st={st} save={save} notify={notify} setFloor={setFloor}/>}
    {tab===3&&<SettingsScreen st={st} save={save} setBusy={setBusy} setBMsg={setBMsg} notify={notify}/>}
    <BottomNav tab={tab} setTab={setTab}/>
  </div>);
}

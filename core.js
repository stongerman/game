// core.js — 游戏引擎主逻辑（状态/行为/战斗/渲染）
// 版本：v2
'use strict';

// ===== SAVE / LOAD =====
function buildDbIndex(arr){
  const m={}; (arr||[]).forEach(o=>m[o.id]=o); return m;
}
const GONGFA_BY_ID = buildDbIndex(typeof GONGFA_DB!=='undefined'?GONGFA_DB:[]);
const FABAO_BY_ID  = buildDbIndex(typeof FABAO_DB!=='undefined'?FABAO_DB:[]);

function serializeState(){
  if(!window.G) return null;
  const sys = (typeof Systems!=='undefined' && Systems.dumpState) ? Systems.dumpState() : null;
  return {
    v:2,
    ts:Date.now(),
    name:G.name, linggen:G.linggen,
    realmIndex:G.realmIndex, exp:G.exp,
    qi:G.qi, qiMax:G.qiMax,
    hp:G.hp, hpMax:G.hpMax,
    age:G.age, lifespan:G.lifespan,
    lingshi:G.lingshi,
    baseAtk:G.baseAtk, baseDef:G.baseDef,
    meditateLevel:G.meditateLevel,
    gongfaId:G.gongfa?G.gongfa.id:null,
    fabaoId:G.fabao?G.fabao.id:null,
    inventory:(G.inventory||[]).map(i=>({type:i.type,id:i.data.id})),
    systems: sys
  };
}

function saveGame(){
  try{
    const data=serializeState();
    if(!data) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  }catch(e){}
}

function hasSave(){
  try{ return !!localStorage.getItem(SAVE_KEY); }catch(e){ return false; }
}

function loadGame(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw) return false;
    const state=JSON.parse(raw);
    if(!state || state.v!==2) return false;

    // 初始化 G（由后面的 core 逻辑提供默认结构）
    window.G = window.G || {};
    G={...G, ...state, gongfa:null, fabao:null, inventory:[]};

    // 重建背包
    (state.inventory||[]).forEach(it=>{
      if(it.type==='gongfa' && GONGFA_BY_ID[it.id]) addToInventory('gongfa', GONGFA_BY_ID[it.id]);
      if(it.type==='fabao' && FABAO_BY_ID[it.id]) addToInventory('fabao', FABAO_BY_ID[it.id]);
    });
    if(state.gongfaId && GONGFA_BY_ID[state.gongfaId]) G.gongfa=GONGFA_BY_ID[state.gongfaId];
    if(state.fabaoId && FABAO_BY_ID[state.fabaoId]) G.fabao=FABAO_BY_ID[state.fabaoId];

    if(typeof Systems!=='undefined' && Systems.loadState) Systems.loadState(state.systems||null);
    if(typeof Systems!=='undefined') Systems.emit('stateInit',{mode:'load'});

    return true;
  }catch(e){
    return false;
  }
}

function resetSave(){
  try{ localStorage.removeItem(SAVE_KEY); }catch(e){}
  addLog('🧹 已清空存档，可重新踏入仙途。','warn');
  // 回到标题页
  showScreen('title');
  const c=document.getElementById('btn-continue');
  const r=document.getElementById('btn-reset');
  if(c) c.style.display='none';
  if(r) r.style.display='none';
}

function continueGame(){
  const ok = loadGame();
  if(!ok){
    addLog('未找到可用存档。','warn');
    return;
  }
  showScreen('game');
  updateHUD();
}


// ========== GAME STATE ==========
let G={};
let selectedLinggen=null;

function selectLinggen(el){
  document.querySelectorAll('.linggen-card').forEach(c=>c.classList.remove('selected'));
  el.classList.add('selected');
  selectedLinggen=el.dataset.type;
}

function initGameState(name,linggen){
  const lg=LG[linggen];
  G={name,linggen,realmIndex:0,exp:0,qi:100,qiMax:100,hp:100,hpMax:100,
    age:16,lifespan:100+lg.ls,lingshi:10,baseAtk:10,baseDef:5,
    meditateLevel:1,actionLocked:false,
    gongfa:null,fabao:null, // equipped
    inventory:[], // {type:'gongfa'|'fabao', data:{...}}
  };
  // Give starter gongfa
  addToInventory('gongfa',GONGFA_DB[0]);
  G.gongfa=GONGFA_DB[0];
  // Systems init
  if(typeof Systems!=='undefined'){ Systems.emit('stateInit',{mode:'new'}); }
}

function addToInventory(type,data){
  if(!G.inventory.find(i=>i.data.id===data.id)){
    G.inventory.push({type,data});
  }
}

function getAtk(){
  let a=G.baseAtk + G.realmIndex*5;
  if(G.gongfa)a+=G.gongfa.atkB;
  if(G.fabao)a+=G.fabao.atkB;
  a*=LG[G.linggen].cbt;
  const mods=(typeof Systems!=='undefined'&&Systems.getModifiers)?Systems.getModifiers():{atkMult:0};
  a*= (1+(mods.atkMult||0));
  return Math.floor(a);
}
function getDef(){
  let d=G.baseDef + G.realmIndex*3;
  if(G.gongfa)d+=G.gongfa.defB;
  if(G.fabao)d+=G.fabao.defB;
  const mods=(typeof Systems!=='undefined'&&Systems.getModifiers)?Systems.getModifiers():{defMult:0};
  d*= (1+(mods.defMult||0));
  return Math.floor(d);
}
function getPower(){ return getAtk()+getDef()+G.realmIndex*10; }

// ========== SCREENS ==========
function showScreen(name){
  document.querySelectorAll('#screen-title,#screen-create,#screen-game').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+name).classList.add('active');
  if(name==='game'){initSceneCanvas();startGameLoop();}
}

function startGame(){
  const name=document.getElementById('input-name').value.trim()||'无名散修';
  if(!selectedLinggen){alert('请选择灵根属性！');return}
  initGameState(name,selectedLinggen);
  showScreen('game');
  updateHUD();
  renderEquipPanel();
  addLog('你踏入修仙之路，成为一名练气期修士。','info');
  addLog(`灵根属性：${LG[selectedLinggen].desc}，获得功法【吐纳术】`,'purple');
  addLog('静心打坐，感受天地灵气...','normal');
  saveGame();
}

// ========== TABS ==========
function switchTab(tab){
  document.querySelectorAll('.panel-tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  document.querySelector(`.panel-tab[onclick="switchTab('${tab}')"]`).classList.add('active');
  document.getElementById('tab-'+tab).classList.add('active');
  if(tab==='log'){const l=document.getElementById('game-log');l.scrollTop=l.scrollHeight}
  if(tab==='equip')renderEquipPanel();
}

// ========== HUD ==========
function updateHUD(){
  const r=REALMS[G.realmIndex];
  document.getElementById('hud-name').textContent=G.name;
  document.getElementById('hud-realm').textContent=r.name;
  document.getElementById('hud-age').textContent=G.age;
  document.getElementById('hud-lifespan').textContent=G.lifespan;
  document.getElementById('hud-lingshi').textContent=G.lingshi;
  document.getElementById('hud-power').textContent=getPower();
  const qP=Math.min(100,G.qi/G.qiMax*100),eP=Math.min(100,G.exp/r.expMax*100),hP=Math.min(100,G.hp/G.hpMax*100);
  document.getElementById('bar-qi').style.width=qP+'%';
  document.getElementById('bar-qi-text').textContent=`${G.qi}/${G.qiMax}`;
  document.getElementById('bar-exp').style.width=eP+'%';
  document.getElementById('bar-exp-text').textContent=`${G.exp}/${r.expMax}`;
  document.getElementById('bar-hp').style.width=hP+'%';
  document.getElementById('bar-hp-text').textContent=`${G.hp}/${G.hpMax}`;
  const btn=document.getElementById('btn-breakthrough');
  if(G.exp>=r.expMax&&G.realmIndex<REALMS.length-1){btn.classList.add('highlight');btn.style.animation='pulse 1.5s infinite'}
  else{btn.classList.remove('highlight');btn.style.animation=''}
}

function addLog(text,type='normal'){
  const log=document.getElementById('game-log');
  const e=document.createElement('div');e.className='log-entry';
  e.innerHTML=`<span class="log-time">[${G.age}岁]</span> <span class="log-${type}">${text}</span>`;
  log.appendChild(e);log.scrollTop=log.scrollHeight;
  // Keep log manageable
  while(log.children.length>200)log.removeChild(log.firstChild);
}

// ========== EQUIP PANEL ==========
function renderEquipPanel(){
  const p=document.getElementById('equip-panel');
  const gf=G.gongfa, fb=G.fabao;
  p.innerHTML=`
    <div class="equip-slot" onclick="openEquipChoice('gongfa')">
      <div class="slot-label">功法</div>
      <div class="slot-name ${gf?GRADE_CSS[gf.grade]:'empty'}">${gf?gf.name:'未装备'}</div>
      ${gf?`<div class="slot-desc">攻+${gf.atkB} 防+${gf.defB} 修+${gf.expB} [${GRADE_NAMES[gf.grade]}阶]</div>`:''}
    </div>
    <div class="equip-slot" onclick="openEquipChoice('fabao')">
      <div class="slot-label">法宝</div>
      <div class="slot-name ${fb?GRADE_CSS[fb.grade]:'empty'}">${fb?fb.name:'未装备'}</div>
      ${fb?`<div class="slot-desc">攻+${fb.atkB} 防+${fb.defB} [${GRADE_NAMES[fb.grade]}阶]</div>`:''}
    </div>
    <div style="padding:12px;border-top:2px solid var(--border-pixel)">
      <div style="font-size:13px;color:var(--text-cyan);margin-bottom:8px">· 背包 ·</div>
      ${G.inventory.length===0?'<div style="color:var(--text-dim);font-size:13px">空空如也</div>':''}
      ${G.inventory.map(i=>`<div style="font-size:12px;padding:4px 0;color:${GRADE_COLOR[i.data.grade]}">
        ${i.type==='gongfa'?'📖':'⚔️'} ${i.data.name} [${GRADE_NAMES[i.data.grade]}阶]
      </div>`).join('')}
    </div>
  `;
}

function openEquipChoice(type){
  const items=G.inventory.filter(i=>i.type===type);
  if(items.length===0){addLog('背包中没有可装备的'+(type==='gongfa'?'功法':'法宝')+'。','info');return}
  G.actionLocked=true;
  const modal=document.getElementById('modal');modal.classList.add('active');
  document.getElementById('modal-title').textContent=type==='gongfa'?'选择功法':'选择法宝';
  document.getElementById('modal-body').innerHTML='<p style="font-size:13px;color:var(--text-dim)">点击装备</p>';
  const choices=items.map(i=>({
    text:`${i.data.name} [${GRADE_NAMES[i.data.grade]}阶] 攻+${i.data.atkB} 防+${i.data.defB}${type==='gongfa'?' 修+'+i.data.expB:''}`,
    action:()=>{
      if(type==='gongfa')G.gongfa=i.data; else G.fabao=i.data;
      addLog(`装备${type==='gongfa'?'功法':'法宝'}【${i.data.name}】！`,'info');
      closeModal();renderEquipPanel();updateHUD();saveGame();
    }
  }));
  choices.push({text:'取消',action:()=>closeModal()});
  showModalChoices(choices);
}

// ========== MODAL ==========
function showModalChoices(choices){
  const c=document.getElementById('modal-choices');c.innerHTML='';
  choices.forEach(ch=>{
    const b=document.createElement('button');b.className='modal-choice-btn';b.textContent=ch.text;
    b.onclick=()=>ch.action();c.appendChild(b);
  });
}
function closeModal(){document.getElementById('modal').classList.remove('active');G.actionLocked=false;updateHUD()}

// ========== ACTIONS ==========
function doAction(type){
  if(G.actionLocked)return;
  switch(type){
    case 'meditate':actionMeditate();break;case 'practice':actionPractice();break;
    case 'explore':actionExplore();break;case 'rest':actionRest();break;
    case 'breakthrough':actionBreakthrough();break;case 'shop':actionShop();break;
    case 'secret':actionSecret();break;
  }
  G.age++;checkDeath();
  if(typeof Systems!=='undefined'){ Systems.emit('afterAction',{type}); }
  saveGame();
  updateHUD();saveGame();
}

function checkDeath(){
  if(G.age>=G.lifespan)showGameOver(false);
  if(G.hp<=0)showGameOver(false,'修炼走火入魔，身死道消...');
}

function showGameOver(asc,msg){
  const o=document.getElementById('gameover');o.classList.add('active');
  if(asc){o.classList.add('ascend');document.getElementById('gameover-title').textContent='飞升成仙';
    document.getElementById('gameover-desc').textContent=`${G.name}，历经${G.age}年苦修，终成大道！\n最终境界：${REALMS[G.realmIndex].name}\n战力：${getPower()}`;}
  else{document.getElementById('gameover-title').textContent='道陨';
    document.getElementById('gameover-desc').textContent=msg||`${G.name}，享年${G.age}岁，${REALMS[G.realmIndex].name}。\n寿元耗尽，魂归天地...`;}
}

// -- Meditate --
function actionMeditate(){
  const lg=LG[G.linggen];
  const gfBonus=G.gongfa?G.gongfa.expB:0;
  const mods=(typeof Systems!=='undefined'&&Systems.getModifiers)?Systems.getModifiers():{expMult:0,enlightenBonus:0};
  const base=Math.floor((BALANCE.meditate.base+G.meditateLevel*BALANCE.meditate.levelScale+G.realmIndex+gfBonus)*lg.expM*(1+(mods.expMult||0)));
  const v=Math.floor(Math.random()*4)-1;
  const gained=Math.max(1,base+v);
  G.exp+=gained;G.qi=Math.max(0,G.qi-(BALANCE.cost?BALANCE.cost.qiMeditate:0));
  if(Math.random()<(BALANCE.meditate.enlightenChance+(mods.enlightenBonus||0))){const b=Math.floor(gained*1.5);G.exp+=b;addLog(`打坐修炼，获得${gained}修为。灵光一闪，顿悟+${b}！`,'great')}
  else addLog(`静心打坐，获得${gained}修为。`,'normal');
  if(Math.random()<0.12)triggerRandomEvent();
}

// -- Practice --
function actionPractice(){
  const lg=LG[G.linggen];
  const mods=(typeof Systems!=='undefined'&&Systems.getModifiers)?Systems.getModifiers():{expMult:0};
  const base=Math.floor((BALANCE.practice.base+G.realmIndex)*lg.expM*(1+(mods.expMult||0)));
  const qiCost=(BALANCE.cost?BALANCE.cost.qiPractice:0);
  if(G.qi<qiCost){addLog('灵力不足，修习效果不佳。','danger');G.exp+=Math.floor(base*0.3)}
  else{G.qi-=qiCost;G.exp+=base;
    if(Math.random()<0.3)G.baseAtk++;if(Math.random()<0.2)G.baseDef++;
    addLog(`修习功法，获得${base}修为，战力微增。`,'normal')}
  if(Math.random()<0.1)triggerRandomEvent();
}

// -- Explore (now can find gongfa/fabao!) --
function actionExplore(){
  const mods=(typeof Systems!=='undefined'&&Systems.getModifiers)?Systems.getModifiers():{exploreMult:0};
  const r=Math.random();G.qi=Math.max(0,G.qi-(BALANCE.cost?BALANCE.cost.qiExplore:0));
  if(r<0.2){
    const ls=Math.floor((Math.random()*BALANCE.explore.lingshiVar+BALANCE.explore.lingshiBase+G.realmIndex*BALANCE.explore.lingshiRealmScale)*(1+(mods.exploreMult||0)));G.lingshi+=ls;
    addLog(`探索发现${ls}块灵石！`,'good');
  } else if(r<0.35){
    // Auto battle!
    const tier=Math.min(4,Math.floor(G.realmIndex/5));
    const pool=ENEMIES[tier];
    const enemy={...pool[Math.floor(Math.random()*pool.length)]};
    enemy.hp=Math.floor(enemy.hp*(0.8+Math.random()*0.4));
    startBattle(enemy);return;
  } else if(r<0.45){
    // Find gongfa!
    const maxGrade=Math.min(4,Math.floor(G.realmIndex/5));
    const pool=GONGFA_DB.filter(g=>g.grade<=maxGrade);
    const found=pool[Math.floor(Math.random()*pool.length)];
    addToInventory('gongfa',found);
    addLog(`发现功法【${found.name}】(${GRADE_NAMES[found.grade]}阶)！已放入背包。`,'great');
  } else if(r<0.55){
    // Find fabao!
    const maxGrade=Math.min(3,Math.floor(G.realmIndex/6));
    const pool=FABAO_DB.filter(f=>f.grade<=maxGrade);
    const found=pool[Math.floor(Math.random()*pool.length)];
    addToInventory('fabao',found);
    addLog(`获得法宝【${found.name}】(${GRADE_NAMES[found.grade]}阶)！`,'great');
  } else if(r<0.65){
    G.hp=Math.min(G.hpMax,G.hp+20);G.qi=Math.min(G.qiMax,G.qi+15);
    addLog('发现灵药，恢复灵力和生命！','good');
  } else if(r<0.75){
    const exp=Math.floor((Math.random()*BALANCE.explore.expVar+BALANCE.explore.expBase)*(1+(mods.exploreMult||0)));G.exp+=exp;
    addLog('偶遇散修交流，获得'+exp+'修为。','info');
  } else{addLog('四处探索，一无所获。','normal')}
  if(Math.random()<0.1)triggerRandomEvent();
}

// -- Rest --
function actionRest(){
  const hr=Math.floor(G.hpMax*0.3),qr=Math.floor(G.qiMax*0.4);
  G.hp=Math.min(G.hpMax,G.hp+hr);G.qi=Math.min(G.qiMax,G.qi+qr);
  addLog(`休息恢复${hr}生命，${qr}灵力。`,'normal');
}

// -- Breakthrough --
function actionBreakthrough(){
  const r=REALMS[G.realmIndex];
  if(G.exp<r.expMax){addLog(`修为不足(${G.exp}/${r.expMax})，无法突破。`,'danger');return}
  if(G.realmIndex>=REALMS.length-1){showGameOver(true);return}
  const next=REALMS[G.realmIndex+1];
  if(next.major){showBreakthroughEvent(next)}
  else{
    const mods=(typeof Systems!=='undefined'&&Systems.getModifiers)?Systems.getModifiers():{brkBonus:0};
    if(Math.random()<(BALANCE.breakthrough.baseChance+LG[G.linggen].brk+(mods.brkBonus||0)))advanceRealm();
    else{G.exp=Math.floor(G.exp*0.7);addLog('突破失败！修为倒退。','danger')}
  }
}

function showBreakthroughEvent(next){
  G.actionLocked=true;
  const m=document.getElementById('modal');m.classList.add('active');
  document.getElementById('modal-title').textContent='⚡ 突破 · '+next.name;
  const high=G.realmIndex>=12;
  if(high&&Math.random()<0.5){
    document.getElementById('modal-body').innerHTML='<p>天空骤然暗沉，紫色雷云汇聚...</p><p>天劫降临！</p>';
    showModalChoices([
      {text:'以身硬抗天劫',action:()=>handleTrib('tank')},
      {text:'运转功法化解',action:()=>handleTrib('tech')},
      {text:'服用丹药护体（20灵石）',action:()=>handleTrib('pill')},
    ]);
  }else{
    document.getElementById('modal-body').innerHTML='<p>意识沉入识海深处...</p><p>心魔显现！</p>';
    showModalChoices([
      {text:'以道心斩之',action:()=>handleDemon('fight')},
      {text:'以平常心接纳',action:()=>handleDemon('accept')},
      {text:'强行压制封印',action:()=>handleDemon('suppress')},
    ]);
  }
}

function handleTrib(ch){
  const mods=(typeof Systems!=='undefined'&&Systems.getModifiers)?Systems.getModifiers():{brkBonus:0};
  let rate=BALANCE.breakthrough.tribBase+LG[G.linggen].brk+(mods.brkBonus||0),dmg=0;
  if(ch==='tank'){rate+=0.1;dmg=Math.floor(G.hpMax*0.4)}
  else if(ch==='tech'){rate+=0.15;dmg=Math.floor(G.hpMax*0.2)}
  else{if(G.lingshi>=20){G.lingshi-=20;rate+=0.25;dmg=Math.floor(G.hpMax*0.1)}else{addLog('灵石不足！','danger');closeModal();return}}
  G.hp=Math.max(1,G.hp-dmg);
  if(Math.random()<rate){advanceRealm();addLog('天劫散去，突破成功！','great')}
  else{G.exp=Math.floor(G.exp*0.5);G.hp=Math.max(1,G.hp-Math.floor(G.hpMax*0.3));addLog('天劫之下，突破失败！','danger')}
  closeModal();
}

function handleDemon(ch){
  const mods=(typeof Systems!=='undefined'&&Systems.getModifiers)?Systems.getModifiers():{brkBonus:0};
  let rate=BALANCE.breakthrough.demonBase+LG[G.linggen].brk+(mods.brkBonus||0);
  if(ch==='fight')rate+=0.1;else if(ch==='accept')rate+=0.2;else rate+=0.05;
  if(Math.random()<rate){advanceRealm();addLog('心魔化解，突破成功！','great')}
  else{
    if(ch==='fight'){G.hp=Math.max(1,G.hp-Math.floor(G.hpMax*0.3));G.exp=Math.floor(G.exp*0.4);addLog('心魔反噬！','danger')}
    else{G.exp=Math.floor(G.exp*(ch==='suppress'?0.7:0.6));addLog('突破失败。','danger')}
  }
  closeModal();
}

function advanceRealm(){
  G.realmIndex++;const r=REALMS[G.realmIndex];G.exp=0;
  G.qiMax+=20;G.hpMax+=15;G.qi=G.qiMax;G.hp=G.hpMax;G.baseAtk+=5;G.baseDef+=3;G.meditateLevel++;
  if(r.lsBonus>0){G.lifespan+=r.lsBonus;addLog(`✨ 突破至【${r.name}】！寿元+${r.lsBonus}！`,'great')}
  else addLog(`✨ 突破至【${r.name}】！`,'great');
  if(typeof Systems!=='undefined'){ Systems.emit('realmUp',{realmIndex:G.realmIndex, realm:r}); }
  saveGame();
  saveGame();
  if(G.realmIndex>=REALMS.length-1&&G.exp>=REALMS[G.realmIndex].expMax)setTimeout(()=>showGameOver(true),500);
}

// -- Shop --
function actionShop(){
  G.actionLocked=true;
  const m=document.getElementById('modal');m.classList.add('active');
  document.getElementById('modal-title').textContent='🏪 坊市';
  document.getElementById('modal-body').innerHTML=`<p>琳琅满目的修仙坊市。</p><p style="color:var(--text-dim)">灵石：${G.lingshi}</p>`;
  const choices=[
    {text:'回气丹 (10灵石)',action:()=>{if(G.lingshi>=10){G.lingshi-=10;G.qi=Math.min(G.qiMax,G.qi+50);addLog('服用回气丹！','good')}else addLog('灵石不足！','danger');closeModal()}},
    {text:'疗伤丹 (10灵石)',action:()=>{if(G.lingshi>=10){G.lingshi-=10;G.hp=Math.min(G.hpMax,G.hp+50);addLog('服用疗伤丹！','good')}else addLog('灵石不足！','danger');closeModal()}},
    {text:'悟道丹 (25灵石)',action:()=>{if(G.lingshi>=25){G.lingshi-=25;const g=30+G.realmIndex*10;G.exp+=g;addLog(`悟道丹+${g}修为！`,'great')}else addLog('灵石不足！','danger');closeModal()}},
  ];
  // Sell random gongfa/fabao at shop
  const shopGrade=Math.min(3,Math.floor(G.realmIndex/5));
  const shopGF=GONGFA_DB.filter(g=>g.grade<=shopGrade+1);
  const randGF=shopGF[Math.floor(Math.random()*shopGF.length)];
  const gfCost=20+randGF.grade*30;
  choices.push({text:`${randGF.name}(${GRADE_NAMES[randGF.grade]}阶功法) ${gfCost}灵石`,action:()=>{
    if(G.lingshi>=gfCost){G.lingshi-=gfCost;addToInventory('gongfa',randGF);addLog(`购得功法【${randGF.name}】！`,'great')}else addLog('灵石不足！','danger');closeModal()}});
  const shopFB=FABAO_DB.filter(f=>f.grade<=shopGrade);
  const randFB=shopFB[Math.floor(Math.random()*shopFB.length)];
  const fbCost=15+randFB.grade*25;
  choices.push({text:`${randFB.name}(${GRADE_NAMES[randFB.grade]}阶法宝) ${fbCost}灵石`,action:()=>{
    if(G.lingshi>=fbCost){G.lingshi-=fbCost;addToInventory('fabao',randFB);addLog(`购得法宝【${randFB.name}】！`,'great')}else addLog('灵石不足！','danger');closeModal()}});
  choices.push({text:'离开',action:()=>closeModal()});
  showModalChoices(choices);
}

// -- Secret Realm --
function actionSecret(){
  const available=SECRET_REALMS.filter(s=>G.realmIndex>=s.minRealm);
  if(available.length===0){addLog('当前境界没有可挑战的秘境。','info');return}
  G.actionLocked=true;
  const m=document.getElementById('modal');m.classList.add('active');
  document.getElementById('modal-title').textContent='🌀 秘境选择';
  document.getElementById('modal-body').innerHTML='<p>选择要闯入的秘境：</p>';
  const choices=available.map(s=>({
    text:`${s.name} (${s.floors}层) - ${s.desc}`,
    action:()=>{closeModal();enterSecretRealm(s)}
  }));
  choices.push({text:'返回',action:()=>closeModal()});
  showModalChoices(choices);
}

function enterSecretRealm(sr){
  addLog(`进入秘境【${sr.name}】...`,'purple');
  let floor=0;
  const next=()=>{
    floor++;
    if(floor>sr.floors){
      addLog(`秘境【${sr.name}】探索完毕！`,'great');
      // Boss reward
      const maxG=Math.min(4,Math.floor(sr.minRealm/5)+1);
      const pool=[...GONGFA_DB.filter(g=>g.grade<=maxG),...FABAO_DB.filter(f=>f.grade<=maxG)];
      const reward=pool[Math.floor(Math.random()*pool.length)];
      const rType=GONGFA_DB.includes(reward)?'gongfa':'fabao';
      addToInventory(rType,reward);
      addLog(`秘境奖励：${rType==='gongfa'?'功法':'法宝'}【${reward.name}】(${GRADE_NAMES[reward.grade]}阶)！`,'great');
      G.age+=sr.floors;updateHUD();return;
    }
    const r=Math.random();
    if(r<0.5){
      // Battle
      const tier=Math.min(4,Math.floor(sr.minRealm/5));
      const pool=ENEMIES[tier];
      const enemy={...pool[Math.floor(Math.random()*pool.length)]};
      enemy.name=`${sr.name}·${enemy.name}`;
      enemy.hp=Math.floor(enemy.hp*(0.9+floor*0.15));
      enemy.atk=Math.floor(enemy.atk*(0.9+floor*0.12));
      addLog(`第${floor}层：遭遇${enemy.name}！`,'danger');
      startBattle(enemy,()=>next());
    }else if(r<0.7){
      const ls=Math.floor(10+sr.minRealm*2+Math.random()*20);G.lingshi+=ls;
      addLog(`第${floor}层：发现宝箱，获得${ls}灵石！`,'good');
      next();
    }else if(r<0.85){
      G.hp=Math.min(G.hpMax,G.hp+Math.floor(G.hpMax*0.2));G.qi=Math.min(G.qiMax,G.qi+Math.floor(G.qiMax*0.2));
      addLog(`第${floor}层：发现泉水，恢复体力。`,'good');next();
    }else{
      const exp=Math.floor(20+sr.minRealm*5+Math.random()*30);G.exp+=exp;
      addLog(`第${floor}层：参悟壁画，+${exp}修为。`,'info');next();
    }
  };
  next();
}

// ========== BATTLE SYSTEM ==========
let battleState=null;
let battleCanvas,battleCtx,battleAnim;

function startBattle(enemy,onWinCb){
  battleState={
    enemy:{...enemy,maxHp:enemy.hp},
    playerHp:G.hp,playerMaxHp:G.hpMax,
    turn:0,log:'',done:false,won:false,
    effects:[],onWin:onWinCb||null
  };
  const bo=document.getElementById('battle-overlay');bo.classList.add('active');
  document.getElementById('battle-title').textContent=`⚔️ ${enemy.name}`;
  document.getElementById('bl-pname').textContent=G.name;
  document.getElementById('bl-ename').textContent=enemy.name;
  battleCanvas=document.getElementById('battle-canvas');
  battleCtx=battleCanvas.getContext('2d');
  const rect=battleCanvas.parentElement.getBoundingClientRect();
  battleCanvas.width=Math.floor(rect.width);
  battleCanvas.height=Math.floor(rect.height);
  updateBattleHUD();
  // Auto battle with delay
  battleTurn();
}

function updateBattleHUD(){
  const bs=battleState;
  document.getElementById('bl-php').textContent=`${bs.playerHp}/${bs.playerMaxHp}`;
  document.getElementById('bl-ehp').textContent=`${Math.max(0,bs.enemy.hp)}/${bs.enemy.maxHp}`;
  document.getElementById('bb-php').style.width=Math.max(0,bs.playerHp/bs.playerMaxHp*100)+'%';
  document.getElementById('bb-ehp').style.width=Math.max(0,bs.enemy.hp/bs.enemy.maxHp*100)+'%';
  document.getElementById('battle-log').textContent=bs.log;
}

function battleTurn(){
  if(battleState.done)return;
  battleState.turn++;
  const atk=getAtk(),def=getDef();
  const e=battleState.enemy;

  // Player attacks
  const pDmg=Math.max(1,Math.floor(atk*(0.8+Math.random()*0.4)-e.def*0.3));
  const mods=(typeof Systems!=='undefined'&&Systems.getModifiers)?Systems.getModifiers():{critBonus:0};
  const crit=Math.random()<(BALANCE.combat.critRate+(mods.critBonus||0));
  const finalPDmg=crit?Math.floor(pDmg*BALANCE.combat.critMult):pDmg;
  e.hp-=finalPDmg;
  battleState.log=`你使出${G.gongfa?G.gongfa.name:'攻击'}，造成${finalPDmg}伤害${crit?'（暴击！）':''}`;
  battleState.effects.push({type:'hit',x:battleCanvas.width*0.7,y:battleCanvas.height*0.4,t:20,txt:'-'+finalPDmg,color:crit?'#ffd866':'#ff6666'});
  saveGame();
  updateBattleHUD();drawBattle();

  if(e.hp<=0){
    setTimeout(()=>endBattle(true),600);return;
  }

  // Enemy attacks after delay
  setTimeout(()=>{
    const eDmg=Math.max(1,Math.floor(e.atk*(0.8+Math.random()*0.4)-def*0.3));
    battleState.playerHp-=eDmg;
    battleState.log=`${e.name}反击，造成${eDmg}伤害！`;
    battleState.effects.push({type:'hit',x:battleCanvas.width*0.25,y:battleCanvas.height*0.4,t:20,txt:'-'+eDmg,color:'#ff4444'});
    updateBattleHUD();drawBattle();
    if(battleState.playerHp<=0){setTimeout(()=>endBattle(false),600);return}
    setTimeout(()=>battleTurn(),500);
  },500);
}

function endBattle(won){
  battleState.done=true;battleState.won=won;
  const e=battleState.enemy;
  if(won){
    G.hp=battleState.playerHp;
    G.exp+=e.exp;G.lingshi+=e.ls;
    battleState.log=`胜利！+${e.exp}修为 +${e.ls}灵石`;
    addLog(`击败${e.name}！+${e.exp}修为，+${e.ls}灵石。`,'good');
    // Chance to drop fabao
    if(Math.random()<0.15){
      const maxG=Math.min(3,Math.floor(G.realmIndex/5));
      const pool=FABAO_DB.filter(f=>f.grade<=maxG);
      const drop=pool[Math.floor(Math.random()*pool.length)];
      addToInventory('fabao',drop);
      addLog(`${e.name}掉落法宝【${drop.name}】！`,'great');
    }
  }else{
    G.hp=Math.max(1,Math.floor(G.hpMax*0.1));
    battleState.log='战败！你重伤逃离...';
    addLog(`不敌${e.name}，重伤败退。`,'danger');
  }
  updateBattleHUD();drawBattle();
  if(typeof Systems!=='undefined'){ Systems.emit('battleEnd',{won,enemy:e}); }
  saveGame();
  setTimeout(()=>{
    document.getElementById('battle-overlay').classList.remove('active');
    updateHUD();
    if(won&&battleState.onWin)battleState.onWin();
  },1200);
}

function drawBattle(){
  const c=battleCtx,w=battleCanvas.width,h=battleCanvas.height;
  // BG
  const bg=c.createLinearGradient(0,0,0,h);
  bg.addColorStop(0,'#0a0a1e');bg.addColorStop(1,'#141428');
  c.fillStyle=bg;c.fillRect(0,0,w,h);
  // Ground
  c.fillStyle='#1a1a30';c.fillRect(0,h*0.7,w,h*0.3);

  // Player character (left side)
  drawBattleChar(c,w*0.25,h*0.55,false);
  // Enemy (right side)
  drawBattleEnemy(c,w*0.72,h*0.5);

  // Effects
  battleState.effects=battleState.effects.filter(e=>{
    e.t--;
    c.font='bold 18px "ZCOOL QingKe HuangYou"';
    c.fillStyle=e.color;
    c.globalAlpha=Math.min(1,e.t/10);
    c.fillText(e.txt,e.x-15,e.y-20+e.t*0.5);
    c.globalAlpha=1;
    return e.t>0;
  });

  // VS
  c.font='24px "Ma Shan Zheng"';c.fillStyle='rgba(255,100,100,0.5)';
  c.fillText('VS',w*0.47,h*0.45);
}

function drawBattleChar(c,x,y,flip){
  const px=3;
  // Head
  c.fillStyle='#ddccaa';c.fillRect(x-px,y-px*8,px*3,px*3);
  // Hair
  c.fillStyle='#222';c.fillRect(x-px,y-px*9,px*3,px);c.fillRect(x-px*2,y-px*8,px,px*2);
  // Robe
  const rc=G.realmIndex>=12?'#8866aa':G.realmIndex>=9?'#4466aa':'#334488';
  c.fillStyle=rc;c.fillRect(x-px*2,y-px*5,px*5,px*5);
  // Legs
  c.fillStyle='#2a3366';c.fillRect(x-px,y,px*1.5,px*3);c.fillRect(x+px,y,px*1.5,px*3);
  // Sword
  if(G.fabao){c.fillStyle='#aaccff';c.fillRect(x+px*3,y-px*6,px*0.5,px*7)}
  // Qi aura
  const as=10+5*Math.sin(Date.now()*0.005);
  const au=c.createRadialGradient(x,y-px*2,3,x,y-px*2,as);
  au.addColorStop(0,'rgba(68,136,255,0.3)');au.addColorStop(1,'rgba(68,136,255,0)');
  c.fillStyle=au;c.fillRect(x-as,y-px*2-as,as*2,as*2);
}

function drawBattleEnemy(c,x,y){
  const px=3;const e=battleState.enemy;
  // Body (red-tinted monster)
  c.fillStyle='#883333';c.fillRect(x-px*3,y-px*5,px*6,px*6);
  // Head
  c.fillStyle='#aa4444';c.fillRect(x-px*2,y-px*8,px*4,px*3);
  // Eyes
  c.fillStyle='#ffaa00';c.fillRect(x-px,y-px*7,px,px);c.fillRect(x+px,y-px*7,px,px);
  // Legs
  c.fillStyle='#662222';c.fillRect(x-px*2,y+px,px*2,px*3);c.fillRect(x+px,y+px,px*2,px*3);
  // Aura
  const as=12+4*Math.sin(Date.now()*0.004);
  const au=c.createRadialGradient(x,y-px*2,3,x,y-px*2,as);
  au.addColorStop(0,'rgba(255,68,68,0.25)');au.addColorStop(1,'rgba(255,68,68,0)');
  c.fillStyle=au;c.fillRect(x-as,y-px*2-as,as*2,as*2);
  // Name
  c.font='13px "ZCOOL QingKe HuangYou"';c.fillStyle='#ff8888';
  c.fillText(e.name,x-px*4,y-px*10);
}

// ========== RANDOM EVENTS (enhanced) ==========
function triggerRandomEvent(){
  const events=[
    ()=>{const g=Math.floor(Math.random()*20+10);G.exp+=g;addLog(`发现前人玉简，+${g}修为！`,'great')},
    ()=>{const g=Math.floor(Math.random()*15+5);G.lingshi+=g;addLog(`灵兽叼来${g}块灵石。`,'good')},
    ()=>{G.qi=G.qiMax;addLog('天地灵气涌入，灵力完全恢复！','great')},
    ()=>{const d=Math.floor(Math.random()*15+5);G.hp=Math.max(1,G.hp-d);addLog(`毒雾侵体，-${d}生命。`,'danger')},
    ()=>{G.meditateLevel++;addLog('仙人梦中指点，修炼感悟提升！','purple')},
    ()=>{G.baseAtk+=3;addLog('瀑布下练剑，攻击+3。','good')},
    ()=>{const l=Math.floor(Math.random()*8+3);G.lingshi=Math.max(0,G.lingshi-l);addLog(`散修劫道，失去${l}灵石！`,'danger')},
    ()=>{G.lifespan+=5;addLog('服食灵果，寿元+5！','great')},
    ()=>{
      const maxG=Math.min(2,Math.floor(G.realmIndex/5));
      const pool=GONGFA_DB.filter(g=>g.grade<=maxG);
      const f=pool[Math.floor(Math.random()*pool.length)];
      addToInventory('gongfa',f);addLog(`机缘巧合得到功法【${f.name}】！`,'purple');
    },
    ()=>{G.baseDef+=3;addLog('顿悟护体真气，防御+3。','good')},
  ];
  events[Math.floor(Math.random()*events.length)]();
}

// ========== SCENE CANVAS ==========
let sceneCanvas,sceneCtx,sceneParticles=[],sceneFrame=0;
function initSceneCanvas(){
  sceneCanvas=document.getElementById('scene-canvas');
  sceneCtx=sceneCanvas.getContext('2d');
  resizeSceneCanvas();initSceneParticles();
}
function resizeSceneCanvas(){
  const ct=sceneCanvas.parentElement,r=ct.getBoundingClientRect();
  const sb=ct.querySelector('.status-bars'),sh=sb?sb.getBoundingClientRect().height:70;
  sceneCanvas.width=Math.floor(r.width);sceneCanvas.height=Math.max(100,Math.floor(r.height-sh));
}
function initSceneParticles(){
  sceneParticles=[];
  for(let i=0;i<40;i++)sceneParticles.push({x:Math.random()*800,y:Math.random()*600,
    size:Math.random()*2+1,speedY:-(Math.random()*0.3+0.05),speedX:(Math.random()-0.5)*0.2,
    alpha:Math.random()*0.5+0.2,color:['#4488ff','#66eeff','#88aaff','#aaccff'][Math.floor(Math.random()*4)]});
}

function drawScene(){
  const w=sceneCanvas.width,h=sceneCanvas.height,c=sceneCtx;sceneFrame++;
  const isNight=(G.age%24)/24>0.5;
  const sg=c.createLinearGradient(0,0,0,h);
  if(isNight){sg.addColorStop(0,'#05050f');sg.addColorStop(0.5,'#0a0a1e');sg.addColorStop(1,'#0e1020')}
  else{sg.addColorStop(0,'#0a0e2a');sg.addColorStop(0.5,'#121840');sg.addColorStop(1,'#1a2050')}
  c.fillStyle=sg;c.fillRect(0,0,w,h);
  if(isNight){for(let i=0;i<30;i++){const sx=(i*97+13)%w,sy=(i*53+7)%(h*0.5);
    c.fillStyle=`rgba(255,255,255,${(Math.sin(sceneFrame*0.02+i)*0.3+0.7)*0.6})`;c.fillRect(Math.round(sx),Math.round(sy),2,2)}
    c.fillStyle='#ddeeff';c.beginPath();c.arc(w*0.8,h*0.15,20,0,Math.PI*2);c.fill();
    c.fillStyle='#05050f';c.beginPath();c.arc(w*0.8+7,h*0.15-3,18,0,Math.PI*2);c.fill()}
  drawMtn(c,w,h,0.5,'#0e1228',0.35);drawMtn(c,w,h,0.55,'#121838',0.42);drawMtn(c,w,h,0.62,'#1a2248',0.55);
  c.fillStyle='#141a30';c.fillRect(0,h*0.75,w,h*0.25);
  c.fillStyle='#1e2840';for(let i=0;i<w;i+=8)for(let j=h*0.75;j<h;j+=8)if((i+j)%16===0)c.fillRect(i,j,4,4);
  const cx=w*0.35,cy=h*0.58;
  c.fillStyle='#080a14';c.beginPath();c.ellipse(cx,cy+20,40,30,0,Math.PI,0);c.fill();
  const ga=0.2+0.1*Math.sin(sceneFrame*0.03);
  const gl=c.createRadialGradient(cx,cy+10,5,cx,cy+10,50);
  gl.addColorStop(0,`rgba(68,136,255,${ga})`);gl.addColorStop(1,'rgba(68,136,255,0)');
  c.fillStyle=gl;c.fillRect(cx-50,cy-40,100,80);
  drawChar(c,cx,cy+5);
  const as=15+5*Math.sin(sceneFrame*0.05);
  const rc=G.realmIndex>=12?'255,216,102':G.realmIndex>=9?'187,136,255':'68,136,255';
  const au=c.createRadialGradient(cx,cy,5,cx,cy,as);au.addColorStop(0,`rgba(${rc},0.3)`);au.addColorStop(1,`rgba(${rc},0)`);
  c.fillStyle=au;c.fillRect(cx-30,cy-25,60,50);
  drawTree(c,w*0.1,h*0.7,1);drawTree(c,w*0.15,h*0.72,0.8);drawTree(c,w*0.7,h*0.68,1.2);drawTree(c,w*0.8,h*0.71,0.9);drawTree(c,w*0.85,h*0.69,1.1);
  sceneParticles.forEach(p=>{p.x+=p.speedX;p.y+=p.speedY;
    if(p.y<-10){p.y=h+10;p.x=Math.random()*w}if(p.x<-10)p.x=w+10;if(p.x>w+10)p.x=-10;
    c.fillStyle=p.color;c.globalAlpha=p.alpha*(Math.sin(sceneFrame*0.04+p.x*0.01)*0.3+0.7);
    c.fillRect(Math.round(p.x),Math.round(p.y),Math.round(p.size),Math.round(p.size))});
  c.globalAlpha=1;
  drawWaterfall(c,w*0.62,h*0.35,h*0.4);
  c.fillStyle='rgba(0,0,0,0.5)';c.fillRect(8,8,100,24);c.strokeStyle='#2a2a4a';c.strokeRect(8,8,100,24);
  c.fillStyle='#7a7a9a';c.font='14px "ZCOOL QingKe HuangYou"';c.fillText('📍 灵山洞府',16,25);
}

function drawMtn(c,w,h,by,col,ph){c.fillStyle=col;c.beginPath();c.moveTo(0,h);
  for(let i=0;i<=12;i++){const x=i/12*w;const pk=Math.sin(i*0.8+1)*h*ph*0.3+h*(1-ph);
    const y=by*h+(pk-by*h)*(1-Math.abs(i/12-0.5)*1.2);if(i===0)c.lineTo(x,h*by);c.lineTo(x,Math.min(y,h*by))}
  c.lineTo(w,h);c.fill()}
function drawChar(c,x,y){const p=2;c.fillStyle='#ddccaa';c.fillRect(x-p,y-p*8,p*3,p*3);
  c.fillStyle='#222';c.fillRect(x-p,y-p*9,p*3,p);c.fillRect(x-p*2,y-p*8,p,p*2);
  const rc=G.realmIndex>=12?'#8866aa':G.realmIndex>=9?'#4466aa':'#334488';
  c.fillStyle=rc;c.fillRect(x-p*2,y-p*5,p*5,p*4);c.fillStyle='#2a3366';c.fillRect(x-p*2,y-p*1,p*5,p*2);
  c.fillStyle=rc;c.fillRect(x-p*3,y-p*4,p,p*2);c.fillRect(x+p*3,y-p*4,p,p*2);
  c.fillStyle='#ddccaa';c.fillRect(x-p*3,y-p*2,p,p);c.fillRect(x+p*3,y-p*2,p,p)}
function drawTree(c,x,y,s){const p=Math.round(2*s);c.fillStyle='#3a2a1a';c.fillRect(x-p,y-p*4,p*2,p*5);
  c.fillStyle='#1a4a2a';c.fillRect(x-p*3,y-p*8,p*6,p*3);c.fillRect(x-p*2,y-p*10,p*4,p*2);c.fillRect(x-p,y-p*11,p*2,p)}
function drawWaterfall(c,x,sy,ht){c.fillStyle='rgba(100,180,255,0.15)';c.fillRect(x,sy,6,ht);
  for(let i=0;i<ht;i+=6){const o=(sceneFrame*2+i)%12;c.fillStyle=`rgba(150,200,255,${0.2+0.15*Math.sin(sceneFrame*0.1+i*0.1)})`;
    c.fillRect(x+(o%3),sy+i,2,4)}
  for(let i=0;i<3;i++){c.fillStyle='rgba(150,200,255,0.3)';
    c.fillRect(Math.round(x-5+Math.sin(sceneFrame*0.08+i*2)*8),Math.round(sy+ht+Math.sin(sceneFrame*0.1+i)*3),2,2)}}

// ========== GAME LOOP ==========
let gameRunning=false;
function startGameLoop(){gameRunning=true;gameLoop()}
function gameLoop(){if(!gameRunning)return;
  if(document.getElementById('screen-game').classList.contains('active'))drawScene();
  if(battleState&&!battleState.done)drawBattle();
  requestAnimationFrame(gameLoop)}

// ========== TITLE SCREEN ==========
const titleCanvas=document.getElementById('title-canvas');
const titleCtx=titleCanvas.getContext('2d');
let titleParticles=[];
function initTitle(){titleCanvas.width=window.innerWidth;titleCanvas.height=window.innerHeight;titleParticles=[];
  for(let i=0;i<80;i++)titleParticles.push({x:Math.random()*titleCanvas.width,y:Math.random()*titleCanvas.height,
    size:Math.random()*3+1,speedY:-(Math.random()*0.5+0.1),speedX:(Math.random()-0.5)*0.3,
    alpha:Math.random()*0.6+0.2,color:Math.random()>0.5?'#4488ff':'#66eeff'})}
function drawTitleScreen(){titleCtx.clearRect(0,0,titleCanvas.width,titleCanvas.height);
  const w=titleCanvas.width,h=titleCanvas.height;
  titleCtx.fillStyle='#0e0e1a';titleCtx.beginPath();titleCtx.moveTo(0,h);
  titleCtx.lineTo(0,h*0.7);titleCtx.lineTo(w*0.15,h*0.45);titleCtx.lineTo(w*0.25,h*0.55);
  titleCtx.lineTo(w*0.4,h*0.3);titleCtx.lineTo(w*0.5,h*0.5);titleCtx.lineTo(w*0.6,h*0.25);
  titleCtx.lineTo(w*0.75,h*0.5);titleCtx.lineTo(w*0.85,h*0.35);titleCtx.lineTo(w,h*0.55);titleCtx.lineTo(w,h);titleCtx.fill();
  titleParticles.forEach(p=>{p.x+=p.speedX;p.y+=p.speedY;
    if(p.y<-10){p.y=h+10;p.x=Math.random()*w}
    titleCtx.fillStyle=p.color;titleCtx.globalAlpha=p.alpha*(0.6+0.4*Math.sin(Date.now()*0.002+p.x));
    titleCtx.fillRect(Math.round(p.x),Math.round(p.y),Math.round(p.size),Math.round(p.size))});
  titleCtx.globalAlpha=1;
  if(document.getElementById('screen-title').classList.contains('active'))requestAnimationFrame(drawTitleScreen)}
initTitle();drawTitleScreen();
window.addEventListener('resize',()=>{initTitle();if(sceneCanvas)resizeSceneCanvas()});


// ===== BOOT =====
document.addEventListener('DOMContentLoaded', ()=>{
  try{
    const cont=document.getElementById('btn-continue');
    const clr=document.getElementById('btn-clear-save');
    if(cont && hasSave()){
      cont.style.display='inline-block';
      clr.style.display='inline-block';
    }
  }catch(e){}
});

// ===== 启动：标题页按钮显示 =====
document.addEventListener('DOMContentLoaded', ()=>{
  const c=document.getElementById('btn-continue');
  const r=document.getElementById('btn-reset');
  if(hasSave()){
    if(c) c.style.display='inline-block';
    if(r) r.style.display='inline-block';
  }
});

// Expose
window.continueGame = continueGame;
window.resetSave = resetSave;

// ===== expose for inline onclick =====
window.closeModal = closeModal;

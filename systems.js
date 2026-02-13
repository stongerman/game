// systems.js — 插件系统（任务/连胜/觉醒等都在这里挂载）
// 版本：v2
'use strict';

const Systems = (function(){
  const _systems = [];
  const _states = {}; // name -> state

  function register(sys){
    if(!sys || !sys.name) throw new Error('System must have a name');
    _systems.push(sys);
    if(sys.initState && !_states[sys.name]) _states[sys.name] = sys.initState();
  }

  function emit(event, payload){
    for(const sys of _systems){
      const fn = sys['on_' + event];
      if(typeof fn === 'function'){
        try{ fn(payload); }catch(e){ /* isolate */ }
      }
    }
  }

  function dumpState(){
    const out = {};
    for(const sys of _systems){
      if(typeof sys.getState === 'function'){
        out[sys.name] = sys.getState();
      }else if(_states[sys.name]){
        out[sys.name] = _states[sys.name];
      }
    }
    return out;
  }

  function loadState(saved){
    if(!saved) return;
    for(const sys of _systems){
      const s = saved[sys.name];
      if(typeof sys.setState === 'function') sys.setState(s);
      else if(s) _states[sys.name] = s;
    }
  }

  function getModifiers(){
    // 聚合修饰器：后续系统越多，这里越有用
    const m = {
      atkMult: 0, defMult: 0, expMult: 0, exploreMult: 0,
      brkBonus: 0, critBonus: 0, enlightenBonus: 0
    };
    for(const sys of _systems){
      if(typeof sys.modify === 'function'){
        try{ sys.modify(m); }catch(e){}
      }
    }
    return m;
  }

  return { register, emit, dumpState, loadState, getModifiers };
})();

// ===== 系统 1：连胜（战斗粘性）=====
const StreakSystem = (function(){
  const name = 'streak';
  let wins = 0;

  function initState(){ return { wins: 0 }; }
  function getState(){ return { wins }; }
  function setState(s){ wins = (s && s.wins) ? s.wins : 0; }

  function on_battleEnd({won}){
    if(won){
      wins += 1;
      if(wins === 2) addLog('🔥 连胜x2！气势如虹，攻击小幅提升。','great');
      if(wins === 3) addLog('🔥 连胜x3！你进入“杀意”状态，攻击显著提升！','great');
      if(wins === 4) addLog('🔥 连胜x4！你已不可阻挡。','great');
    }else{
      if(wins>=2) addLog('💨 连胜被打断，气势散去。','bad');
      wins = 0;
    }
  }

  function on_afterAction({type}){
    // 休息会让气势回落，避免无限叠
    if(type==='rest' && wins>0){
      wins = Math.max(0, wins-1);
    }
  }

  function modify(mods){
    // 攻击增益随连胜阶梯
    if(wins>=4) mods.atkMult += (BALANCE.streak.win4Atk||0);
    else if(wins>=3) mods.atkMult += (BALANCE.streak.win3Atk||0);
    else if(wins>=2) mods.atkMult += (BALANCE.streak.win2Atk||0);
  }

  return { name, initState, getState, setState, on_battleEnd, on_afterAction, modify };
})();

// ===== 系统 2：觉醒/大境界奖励（阶跃成长）=====
const BurstSystem = (function(){
  const name = 'burst';
  let passives = { exploreMult:0, enlightenBonus:0, critBonus:0 };

  function initState(){ return { passives }; }
  function getState(){ return { passives }; }
  function setState(s){
    passives = (s && s.passives) ? s.passives : { exploreMult:0, enlightenBonus:0, critBonus:0 };
  }

  function on_stateInit(){
    // 确保字段存在
    if(!passives) passives = { exploreMult:0, enlightenBonus:0, critBonus:0 };
  }

  function on_realmUp({realm}){
    if(!realm || !realm.major) return;

    // 每个大境界给一次“质变”
    // 这里不追求复杂，只追求体感：更容易爆、爆得更大、打得更爽
    if(realm.name.includes('筑基')){
      passives.exploreMult += 0.30;
      addLog('✨ 筑基觉醒：你对天地灵气更敏锐，探索收益提升！','great');
    }else if(realm.name.includes('金丹')){
      passives.enlightenBonus += 0.10;
      addLog('✨ 金丹觉醒：丹田自转，顿悟更频繁！','great');
    }else if(realm.name.includes('元婴')){
      passives.critBonus += 0.10;
      addLog('✨ 元婴觉醒：杀机内敛，暴击更容易触发！','great');
    }else{
      // 其他大境界：给通用收益
      passives.exploreMult += 0.10;
      passives.enlightenBonus += 0.03;
      addLog('✨ 境界跃迁：你感到天地更“顺”了。','great');
    }
  }

  function modify(mods){
    mods.exploreMult += passives.exploreMult||0;
    mods.enlightenBonus += passives.enlightenBonus||0;
    mods.critBonus += passives.critBonus||0;
  }

  return { name, initState, getState, setState, on_stateInit, on_realmUp, modify };
})();

// ===== 系统 3：任务牵引（让玩家知道“接下来干嘛”）=====
const QuestSystem = (function(){
  const name = 'quest';
  let qIndex = 0;

  const quests = [
    {
      id:'q_main_1',
      title:'踏稳根基',
      desc:'突破到【练气三层】',
      type:'reachRealm',
      targetRealmName:'练气三层',
      reward:{ exp: 60, lingshi: 30 },
    },
    {
      id:'q_main_2',
      title:'初试锋芒',
      desc:'在战斗中击败 3 个敌人',
      type:'killCount',
      target:3,
      reward:{ exp: 80, lingshi: 60 },
    },
    {
      id:'q_main_3',
      title:'囤一点灵石',
      desc:'累计获得 120 灵石',
      type:'earnLingshi',
      target:120,
      reward:{ exp: 120, lingshi: 120 },
    },
  ];

  let prog = { kills:0, earned:0 };

  function initState(){ return { qIndex:0, prog:{kills:0, earned:0} }; }
  function getState(){ return { qIndex, prog }; }
  function setState(s){
    qIndex = (s && Number.isFinite(s.qIndex)) ? s.qIndex : 0;
    prog = (s && s.prog) ? s.prog : { kills:0, earned:0 };
    renderSummary();
  }

  function current(){ return quests[Math.min(qIndex, quests.length-1)]; }

  function isDone(q){
    if(!q) return false;
    if(q.type==='reachRealm'){
      return REALMS[G.realmIndex]?.name === q.targetRealmName || G.realmIndex >= REALMS.findIndex(r=>r.name===q.targetRealmName);
    }
    if(q.type==='killCount') return (prog.kills||0) >= q.target;
    if(q.type==='earnLingshi') return (prog.earned||0) >= q.target;
    return false;
  }

  function grantReward(q){
    const r=q.reward||{};
    const exp = Math.floor((r.exp||0) * (BALANCE.quest.rewardExpMult||1));
    const ls  = Math.floor((r.lingshi||0) * (BALANCE.quest.rewardLingshiMult||1));
    if(exp>0) G.exp += exp;
    if(ls>0) G.lingshi += ls;

    addLog(`🏆 目标完成：【${q.title}】`,'great');
    addLog(`  奖励：修为 +${exp}，灵石 +${ls}`,'great');
    // 小演出：轻微震动（仅支持的浏览器）
    try{ if(navigator.vibrate) navigator.vibrate([30,20,30]); }catch(e){}
  }

  function advanceQuest(){
    const q=current();
    if(isDone(q)){
      grantReward(q);
      qIndex = Math.min(qIndex+1, quests.length-1);
      renderSummary();
      updateHUD(); // 奖励后刷新
    }
  }

  function on_afterAction(){
    // 行为后检查
    advanceQuest();
  }

  function on_battleEnd({won}){
    if(won){
      prog.kills = (prog.kills||0)+1;
      renderSummary();
    }
  }

  // 追踪灵石获取：用一个小技巧，在 afterAction 时比较前后值
  let lastLingshi = 0;
  function on_stateInit(){
    lastLingshi = G.lingshi||0;
    renderSummary();
  }
  function on_afterAction_track(){
    const now = G.lingshi||0;
    if(now > lastLingshi){
      prog.earned = (prog.earned||0) + (now - lastLingshi);
      lastLingshi = now;
      renderSummary();
    }else{
      lastLingshi = now;
    }
    advanceQuest();
  }

  // 由于系统事件名固定，这里用 on_afterAction 组合
  function on_afterAction(payload){
    on_afterAction_track(payload);
  }

  function renderSummary(){
    const el = document.getElementById('quest-summary');
    const sub = document.getElementById('quest-sub');
    if(!el||!sub) return;

    const q=current();
    if(!q){ el.textContent='暂无目标'; sub.textContent=''; return; }

    let progressText='';
    if(q.type==='reachRealm'){
      progressText = `当前境界：${REALMS[G.realmIndex]?.name||'未知'} → 目标：${q.targetRealmName}`;
    }else if(q.type==='killCount'){
      progressText = `进度：${prog.kills||0}/${q.target}（战斗获胜计数）`;
    }else if(q.type==='earnLingshi'){
      progressText = `进度：${prog.earned||0}/${q.target}（累计新增灵石）`;
    }

    el.textContent = `${q.title}：${q.desc}`;
    sub.textContent = progressText;
  }

  function openModal(){
    const q=current();
    const title = q ? `🎯 当前目标：${q.title}` : '🎯 当前目标';
    const body = q ? `${q.desc}` : '暂无';
    showModal(title, body + `<div style="margin-top:10px;color:#999;font-size:12px">提示：完成后会获得一次性爆发奖励。</div>`);
  }

  return { name, initState, getState, setState, on_stateInit, on_afterAction, on_battleEnd, renderSummary, openModal };
})();

// 注册系统（顺序：目标 -> 阶跃 -> 连胜）
Systems.register(QuestSystem);
Systems.register(BurstSystem);
Systems.register(StreakSystem);

// 暴露给 UI
window.Systems = Systems;
window.openQuestModal = () => { try{ QuestSystem.openModal(); }catch(e){} };

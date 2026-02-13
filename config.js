// config.js — 数据与数值参数（可调参中心）
// 说明：这里不写游戏流程逻辑，只放“数据表 + 平衡参数”。
// 版本：v2

'use strict';

// ===== 平衡参数（爽感调参入口）=====
const BALANCE = {
  meditate: { base: 6, levelScale: 2, enlightenChance: 0.10 },
  practice: { base: 4 },
  explore:  { lingshiBase: 6, lingshiVar: 18, lingshiRealmScale: 3, expBase: 6, expVar: 16 },
  breakthrough: { baseChance: 0.85, tribBase: 0.50, demonBase: 0.55 },
  combat: { critRate: 0.15, critMult: 2.0 },
  streak: { win2Atk: 0.05, win3Atk: 0.10, win4Atk: 0.15 },
  quest: { rewardExpMult: 1.2, rewardLingshiMult: 1.0 }
};

const SAVE_KEY = 'fanren_save_v2';

// ========== DATA ==========
const REALMS=[
  {name:'练气一层',expMax:100,lsBonus:0},{name:'练气二层',expMax:150,lsBonus:0},
  {name:'练气三层',expMax:200,lsBonus:0},{name:'练气四层',expMax:280,lsBonus:0},
  {name:'练气五层',expMax:360,lsBonus:0},{name:'练气六层',expMax:450,lsBonus:0},
  {name:'练气七层',expMax:550,lsBonus:0},{name:'练气八层',expMax:660,lsBonus:0},
  {name:'练气九层',expMax:800,lsBonus:0},
  {name:'筑基初期',expMax:1200,lsBonus:100,major:1},{name:'筑基中期',expMax:1600,lsBonus:0},{name:'筑基后期',expMax:2200,lsBonus:0},
  {name:'金丹初期',expMax:3500,lsBonus:200,major:1},{name:'金丹中期',expMax:5000,lsBonus:0},{name:'金丹后期',expMax:7000,lsBonus:0},
  {name:'元婴初期',expMax:12000,lsBonus:400,major:1},{name:'元婴中期',expMax:18000,lsBonus:0},{name:'元婴后期',expMax:25000,lsBonus:0},
  {name:'化神初期',expMax:40000,lsBonus:500,major:1},{name:'化神中期',expMax:60000,lsBonus:0},{name:'化神后期',expMax:85000,lsBonus:0},
  {name:'渡劫期',expMax:150000,lsBonus:800,major:1},{name:'大乘期',expMax:300000,lsBonus:1000,major:1},
];

const LG={
  fire:{expM:1.0,brk:0.10,ls:0,cbt:1.2,desc:'火灵根'},
  water:{expM:1.1,brk:0.0,ls:20,cbt:1.0,desc:'水灵根'},
  wood:{expM:1.0,brk:0.0,ls:10,cbt:0.9,desc:'木灵根'},
  gold:{expM:0.9,brk:0.05,ls:0,cbt:1.3,desc:'金灵根'},
  thunder:{expM:1.3,brk:-0.1,ls:-10,cbt:1.1,desc:'雷灵根'},
};

// GONGFA (功法) database
const GONGFA_DB=[
  {id:'gf_base',name:'吐纳术',grade:0,atkB:0,defB:0,expB:2,desc:'最基础的修炼法门'},
  {id:'gf_fire1',name:'焚天诀',grade:1,atkB:8,defB:0,expB:3,desc:'火属性攻击功法',elem:'fire'},
  {id:'gf_water1',name:'沧澜心经',grade:1,atkB:2,defB:6,expB:4,desc:'水属性防御功法',elem:'water'},
  {id:'gf_sword1',name:'御剑术',grade:1,atkB:10,defB:0,expB:2,desc:'基础剑修功法',elem:'gold'},
  {id:'gf_thunder1',name:'引雷诀',grade:2,atkB:15,defB:0,expB:5,desc:'引动天雷之力',elem:'thunder'},
  {id:'gf_wood1',name:'长春功',grade:1,atkB:0,defB:5,expB:6,desc:'木属性恢复功法',elem:'wood'},
  {id:'gf_fire2',name:'九阳真经',grade:2,atkB:20,defB:5,expB:8,desc:'至阳至刚的上等功法',elem:'fire'},
  {id:'gf_sword2',name:'万剑归宗',grade:3,atkB:35,defB:5,expB:10,desc:'剑修至高法门',elem:'gold'},
  {id:'gf_ice1',name:'玄冰神功',grade:2,atkB:12,defB:15,expB:7,desc:'极寒之力，攻守兼备',elem:'water'},
  {id:'gf_body1',name:'金刚不坏体',grade:2,atkB:5,defB:25,expB:4,desc:'炼体至高功法'},
  {id:'gf_void1',name:'太虚剑意',grade:3,atkB:40,defB:10,expB:12,desc:'传说中的虚空剑道',elem:'gold'},
  {id:'gf_heaven',name:'天道无极功',grade:4,atkB:50,defB:30,expB:20,desc:'天阶功法！传说仙人所创'},
];

// FABAO (法宝) database
const FABAO_DB=[
  {id:'fb_sword1',name:'青锋剑',grade:0,atkB:5,defB:0,desc:'一把普通的灵剑'},
  {id:'fb_shield1',name:'玄铁盾',grade:0,atkB:0,defB:8,desc:'坚固的防御法宝'},
  {id:'fb_ring1',name:'储物戒',grade:1,atkB:3,defB:3,desc:'增加少量全属性'},
  {id:'fb_sword2',name:'寒冰剑',grade:1,atkB:12,defB:0,desc:'附带冰霜之力'},
  {id:'fb_armor1',name:'金蚕丝甲',grade:1,atkB:0,defB:15,desc:'以灵蚕丝编织而成'},
  {id:'fb_bell1',name:'混元钟',grade:2,atkB:5,defB:20,desc:'古老的防御至宝'},
  {id:'fb_sword3',name:'紫电青霜',grade:2,atkB:25,defB:3,desc:'雷电之力凝聚的名剑'},
  {id:'fb_mirror1',name:'照妖镜',grade:2,atkB:18,defB:12,desc:'可破一切妖邪'},
  {id:'fb_pagoda1',name:'玲珑宝塔',grade:3,atkB:15,defB:35,desc:'镇压万邪的佛门至宝'},
  {id:'fb_sword4',name:'诛仙剑',grade:3,atkB:45,defB:5,desc:'上古诛仙四剑之首'},
  {id:'fb_cauldron',name:'乾坤鼎',grade:4,atkB:30,defB:40,desc:'天阶法宝！蕴含乾坤之力'},
];

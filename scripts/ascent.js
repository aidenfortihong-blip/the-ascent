// THE ASCENT // RUNTIME
// Skill slots, ranks, ticks, techniques and the menus around them, on top of
// dnd5e. Skills live in actor flags; one managed Active Effect turns the
// slotted ones into real dnd5e proficiencies, so every normal roll on the
// sheet already includes them. The Spells tab (there is no magic) becomes
// the Skills tab.

(() => {
  const VERSION = "0.2.2";
  const MODULE = "the-ascent";
  const C = globalThis.ASCENT_CATALOG;
  if (!C) throw new Error("THE ASCENT // catalog missing");

  const hooks = [];
  const on = (name,fn) => hooks.push([name,Hooks.on(name,fn)]);

  const esc = value => String(value ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;")
    .replaceAll(">","&gt;").replaceAll('"',"&quot;");
  const ROMAN = ["","I","II","III","IV","V"];

  // ---------- state ----------

  const flags = actor => actor?.flags?.[MODULE] ?? {};
  const skillsOf = actor => flags(actor).skills ?? {};
  const levelOf = actor => Number(actor?.system?.details?.level) || 1;
  const floor = () => Number(game.settings.get(MODULE,"floor")) || 1;
  const hasTalent = (actor,key) => actor?.items?.some(i => i.flags?.[MODULE]?.talent === key);

  function slotted(actor) {
    return Object.entries(skillsOf(actor))
      .filter(([key,s]) => s.slotted && C.SKILL[key])
      .map(([key,s]) => ({key,...s,def:C.SKILL[key]}));
  }

  function slotInfo(actor) {
    const list = slotted(actor);
    const used = list.filter(s => !s.free).length;
    const total = C.slotsAt(levelOf(actor));
    return {used,total,open:Math.max(0,total - used)};
  }

  const ticksTable = actor => hasTalent(actor,"selftaught") ? C.TICKS_SELF_TAUGHT : C.TICKS;
  const ticksToNext = (actor,rank) => rank >= 5 ? null : ticksTable(actor)[rank - 1];
  const isLocked = def => def.lock > floor();

  const canEdit = actor => game.user.isGM || actor?.isOwner;

  async function writeSkill(actor,key,patch) {
    const current = skillsOf(actor)[key] ?? {rank:1,ticks:0,slotted:false};
    await actor.update({["flags."+MODULE+".skills."+key]:{...current,...patch}});
    await syncEffect(actor);
  }

  // ---------- proficiencies (managed effect) ----------

  function effectChanges(actor) {
    const changes = [];
    for (const s of slotted(actor)) {
      const bonus = s.rank - 1;
      for (const id of s.def.weapons ?? []) {
        changes.push({key:"system.traits.weaponProf.value",mode:2,value:id});
      }
      if (s.key === "shield") changes.push({key:"system.traits.armorProf.value",mode:2,value:"shl"});
      for (const id of s.def.skills ?? []) {
        changes.push({key:"system.skills."+id+".value",mode:4,value:"1"});
        if (bonus) changes.push({key:"system.skills."+id+".bonuses.check",mode:2,value:"+"+bonus});
      }
      if (s.key === "sprint") {
        changes.push({key:"system.attributes.movement.walk",mode:2,value:s.rank >= 4 ? "20" : "10"});
      }
    }
    return changes;
  }

  async function syncEffect(actor) {
    if (!canEdit(actor)) return;
    const changes = effectChanges(actor);
    const existing = actor.effects.find(e => e.flags?.[MODULE]?.managed);
    const data = {
      name:"Skill Slots",
      img:"icons/svg/upgrade.svg",
      description:"Managed by The Ascent: proficiencies and bonuses from slotted skills. Edit skills in the Skills tab.",
      changes,
      flags:{[MODULE]:{managed:true}}
    };
    if (existing) {
      if (JSON.stringify(existing.changes) !== JSON.stringify(changes)) await existing.update({changes});
    } else {
      await actor.createEmbeddedDocuments("ActiveEffect",[data]);
    }
  }

  // ---------- skill actions ----------

  async function slotSkill(actor,key) {
    const def = C.SKILL[key];
    if (!def || !canEdit(actor)) return;
    const s = skillsOf(actor)[key];
    if (s?.slotted) return;
    if (isLocked(def) && !game.user.isGM) {
      return ui.notifications.warn(def.name + " is locked until Floor " + def.lock + ".");
    }
    if (slotInfo(actor).open < 1) {
      return ui.notifications.warn("No open skill slots. You get more at levels 3, 6, 9, 12 and 15.");
    }
    await writeSkill(actor,key,{slotted:true});
    ui.notifications.info(actor.name + " slotted " + def.name + (s ? " (rank " + s.rank + ")" : "") + ".");
  }

  async function unslotSkill(actor,key) {
    if (!game.user.isGM) return;
    const s = skillsOf(actor)[key];
    if (!s?.slotted) return;
    await writeSkill(actor,key,{slotted:false});
  }

  // GM: award ticks. Ranks go up when enough ticks are in, capped by level.
  async function addTicks(actor,key,amount = 1) {
    if (!game.user.isGM) return;
    const s = skillsOf(actor)[key];
    if (!s) return;
    let {rank,ticks} = s;
    ticks = Math.max(0,ticks + amount);
    const cap = C.rankCapAt(levelOf(actor));
    const ups = [];
    while (rank < cap && ticks >= ticksToNext(actor,rank)) {
      ticks -= ticksToNext(actor,rank);
      rank += 1;
      ups.push(rank);
    }
    await writeSkill(actor,key,{rank,ticks});
    if (ups.length) announceRankUp(actor,C.SKILL[key],rank);
  }

  async function setRank(actor,key,rank) {
    if (!game.user.isGM) return;
    rank = Math.max(1,Math.min(5,rank));
    await writeSkill(actor,key,{rank,ticks:0});
  }

  function announceRankUp(actor,def,rank) {
    const unlock = def.cat === "weapon"
      ? (rank === 5 ? "Finisher choice unlocked" : "Technique: " + def.tech[rank - 1].name)
      : def.ranks[rank - 1];
    ChatMessage.create({
      speaker:ChatMessage.getSpeaker({actor}),
      content:
        '<div class="asc-chat asc-chat-rank">' +
          '<small>SKILL RANK UP</small>' +
          '<h3><i class="' + esc(def.icon) + '"></i> ' + esc(def.name) + ' ' + ROMAN[rank] + '</h3>' +
          '<p>' + esc(unlock) + '</p>' +
        '</div>'
    });
  }

  async function chooseFinisher(actor,key,index) {
    const s = skillsOf(actor)[key];
    if (!s || s.rank < 5 || s.finisher != null) return;
    await writeSkill(actor,key,{finisher:index});
  }

  async function hotSwap(actor,inKey) {
    if (!hasTalent(actor,"hotswap")) return;
    if (flags(actor).hotSwapUsed) return ui.notifications.warn("Hot Swap is used until your next long rest.");
    const options = slotted(actor).filter(s => !s.free);
    if (!options.length) return;
    const outKey = await foundry.applications.api.DialogV2.prompt({
      window:{title:"Hot Swap: " + C.SKILL[inKey].name},
      content:'<p>Swap out which skill?</p><select name="out">' +
        options.map(s => '<option value="' + s.key + '">' + esc(s.def.name) + ' ' + ROMAN[s.rank] + '</option>').join("") +
        '</select>',
      ok:{label:"Swap",callback:(event,button) => button.form.elements.out.value},
      rejectClose:false
    });
    if (!outKey) return;
    const all = skillsOf(actor);
    await actor.update({
      ["flags."+MODULE+".skills."+outKey]:{...all[outKey],slotted:false},
      ["flags."+MODULE+".skills."+inKey]:{...all[inKey],slotted:true},
      ["flags."+MODULE+".hotSwapUsed"]:true
    });
    await syncEffect(actor);
    ChatMessage.create({
      speaker:ChatMessage.getSpeaker({actor}),
      content:'<div class="asc-chat"><small>HOT SWAP</small><p>' + esc(C.SKILL[outKey].name) + ' &rarr; ' + esc(C.SKILL[inKey].name) + '</p></div>'
    });
  }

  // ---------- techniques ----------

  const techKey = (key,rank) => key + "_" + rank;

  function techniquesOf(actor,s) {
    const def = s.def;
    if (def.cat !== "weapon") return [];
    const list = def.tech.filter(t => t.rank <= s.rank);
    if (s.rank >= 5 && s.finisher != null) list.push(def.finishers[s.finisher]);
    return list;
  }

  const inCombat = actor => !!game.combat?.started && game.combat.combatants.some(c => c.actor?.id === actor.id);

  async function useTechnique(actor,key,rank) {
    const s = slotted(actor).find(x => x.key === key);
    if (!s || !canEdit(actor)) return;
    const tech = techniquesOf(actor,s).find(t => t.rank === rank);
    if (!tech) return;
    const spent = flags(actor).spent ?? {};
    if (spent[techKey(key,rank)]) return ui.notifications.warn(tech.name + " is recharging.");

    const updates = {};
    if (rank >= 3) updates["flags."+MODULE+".spent."+techKey(key,rank)] = true;
    if (Object.keys(updates).length) await actor.update(updates);

    const heavy = rank >= 4;
    if (inCombat(actor)) {
      for (const old of actor.effects.filter(e => e.flags?.[MODULE]?.recovery)) await old.delete();
      await actor.createEmbeddedDocuments("ActiveEffect",[{
        name:"Recovery",
        img:"icons/svg/daze.svg",
        description:"No reaction until your next turn" + (heavy ? "; -2 AC." : ".") + " An adjacent ally can Tag Out to take your place.",
        changes:heavy ? [{key:"system.attributes.ac.bonus",mode:2,value:"-2"}] : [],
        flags:{[MODULE]:{recovery:true}}
      }]);
    }

    const use = rank <= 2 ? "At will" : rank <= 4 ? "Recharge 5-6" : "Once per fight";
    ChatMessage.create({
      speaker:ChatMessage.getSpeaker({actor}),
      content:
        '<div class="asc-chat asc-chat-tech" data-cat="weapon">' +
          '<small>' + esc(s.def.name) + ' // TECHNIQUE ' + ROMAN[rank] + '</small>' +
          '<h3>' + esc(tech.name) + '</h3>' +
          '<p>' + esc(tech.text) + '</p>' +
          '<footer>' + use + ' &middot; Recovery: no reaction' + (heavy ? ', -2 AC' : '') + '</footer>' +
        '</div>'
    });
  }

  // Start of a combatant's turn: Recovery ends, spent rank 3-4 techniques roll to recharge.
  async function onTurnStart(combat) {
    const actor = combat.combatant?.actor;
    if (!actor) return;
    for (const effect of actor.effects.filter(e => e.flags?.[MODULE]?.recovery)) await effect.delete();

    const spent = flags(actor).spent ?? {};
    const lines = [];
    const updates = {};
    for (const [id,isSpent] of Object.entries(spent)) {
      if (!isSpent) continue;
      const [key,rankText] = id.split("_");
      const rank = Number(rankText);
      if (rank >= 5) continue;
      const roll = await new Roll("1d6").evaluate();
      const name = C.SKILL[key]?.tech?.[rank - 1]?.name ?? id;
      if (roll.total >= 5) updates["flags."+MODULE+".spent."+id] = false;
      lines.push(esc(name) + ": " + roll.total + (roll.total >= 5 ? " &mdash; recharged" : ""));
    }
    if (Object.keys(updates).length) await actor.update(updates);
    if (lines.length) {
      ChatMessage.create({
        speaker:ChatMessage.getSpeaker({actor}),
        whisper:ChatMessage.getWhisperRecipients("GM").concat(game.users.filter(u => actor.testUserPermission(u,"OWNER") && !u.isGM)),
        content:'<div class="asc-chat"><small>RECHARGE</small><p>' + lines.join("<br>") + '</p></div>'
      });
    }
  }

  async function clearFight(actor) {
    const spent = flags(actor).spent ?? {};
    const updates = {};
    for (const id of Object.keys(spent)) if (spent[id]) updates["flags."+MODULE+".spent."+id] = false;
    if (Object.keys(updates).length) await actor.update(updates);
    for (const effect of actor.effects.filter(e => e.flags?.[MODULE]?.recovery)) await effect.delete();
  }

  const isActiveGM = () => game.user.isGM && (game.users.activeGM?.isSelf ?? true);

  // ---------- weapon rank bonus ----------

  function weaponSkillFor(actor,item) {
    const base = item.system?.type?.baseItem;
    const natural = item.system?.type?.value === "natural";
    return slotted(actor).find(s =>
      s.def.cat === "weapon" &&
      ((base && s.def.weapons.includes(base)) || (natural && s.key === "martial"))
    );
  }

  function onPreRollAttack(config) {
    try {
      const item = config?.subject?.item;
      const actor = item?.actor;
      if (!actor || item.type !== "weapon") return;
      const s = weaponSkillFor(actor,item);
      if (!s || s.rank < 2) return;
      // dnd5e fills in the roll's parts after this hook, so the list may not exist yet.
      const roll = config.rolls?.[0];
      if (roll) (roll.parts ??= []).push(String(s.rank - 1));
    } catch (error) {
      console.warn("THE ASCENT // attack bonus failed",error);
    }
  }

  // ---------- levels ----------

  function hpFor(actor,level) {
    const con = actor.system.abilities.con.mod;
    return Math.max(1,10 + con + (level - 1) * (6 + con));
  }

  async function setLevel(actor,level) {
    if (!game.user.isGM) return;
    level = Math.max(1,Math.min(20,level));
    const cls = actor.items.find(i => i.type === "class");
    if (cls) await cls.update({"system.levels":level});
    else await actor.createEmbeddedDocuments("Item",[classData(level)]);
    const max = hpFor(actor,level);
    await actor.update({"system.attributes.hp.max":max,"system.attributes.hp.value":max});

    const attacks = level >= 11 ? 3 : level >= 5 ? 2 : 1;
    const existing = actor.items.find(i => i.flags?.[MODULE]?.extraAttack);
    if (attacks === 1 && existing) await existing.delete();
    if (attacks > 1) {
      const data = {
        name:attacks === 3 ? "Extra Attack (3)" : "Extra Attack",
        type:"feat",
        img:"icons/svg/sword.svg",
        system:{description:{value:"<p>When you take the Attack action you attack " + (attacks === 3 ? "three" : "twice") + " instead of once.</p>"}},
        flags:{[MODULE]:{extraAttack:attacks}}
      };
      if (existing) await existing.update({name:data.name,"system.description.value":data.system.description.value,["flags."+MODULE+".extraAttack"]:attacks});
      else await actor.createEmbeddedDocuments("Item",[data]);
    }
    refresh();
  }

  const classData = level => ({
    name:"Player",
    type:"class",
    img:"icons/svg/mystery-man.svg",
    system:{
      identifier:"player",
      levels:level,
      hd:{denomination:"d10"},
      description:{value:"<p>Everyone in the game is a Player. Your build comes from skills, not a class. HP: 10 + Con at level 1, then 6 + Con a level.</p>"}
    }
  });

  // ---------- prefabs ----------

  const GEAR = {
    sword:{name:"Longsword",type:"weapon",system:{type:{value:"martialM",baseItem:"longsword"},damage:{base:{number:1,denomination:8,types:["slashing"]}},properties:["ver"]}},
    rapier:{name:"Rapier",type:"weapon",system:{type:{value:"martialM",baseItem:"rapier"},damage:{base:{number:1,denomination:8,types:["piercing"]}},properties:["fin"]}},
    dagger:{name:"Dagger",type:"weapon",system:{type:{value:"simpleM",baseItem:"dagger"},damage:{base:{number:1,denomination:4,types:["piercing"]}},properties:["fin","lgt","thr"],range:{value:20,long:60}}},
    spear:{name:"Spear",type:"weapon",system:{type:{value:"simpleM",baseItem:"spear"},damage:{base:{number:1,denomination:10,types:["piercing"]}},properties:["rch","two"]}},
    bow:{name:"Shortbow",type:"weapon",system:{type:{value:"simpleR",baseItem:"shortbow"},damage:{base:{number:1,denomination:8,types:["piercing"]}},properties:["two"],range:{value:150,long:600}}},
    martial:{name:"Fists",type:"weapon",system:{type:{value:"natural"},damage:{base:{number:1,denomination:6,types:["bludgeoning"]}}}},
    shield:{name:"Round Shield",type:"equipment",system:{type:{value:"shield"},armor:{value:2}}}
  };

  const STARTER = [
    {name:"Traveler's Leathers",type:"equipment",system:{type:{value:"light"},armor:{value:11}}},
    {name:"Potion",type:"consumable",system:{type:{value:"potion"},quantity:3,description:{value:"<p>Bonus action: heal 2d4 + 2 HP.</p>"}}}
  ];

  function talentItem(t) {
    return {
      name:t.name,
      type:"feat",
      img:"icons/svg/aura.svg",
      system:{description:{value:"<p>" + esc(t.text) + "</p><p><em>Talent: free, fixed, never levels.</em></p>"}},
      flags:{[MODULE]:{talent:t.key}}
    };
  }

  async function buildPrefabs() {
    if (!game.user.isGM) return;
    let folder = game.folders.find(f => f.type === "Actor" && f.flags?.[MODULE]?.prefabs);
    folder ??= await Folder.create({name:"Prefabs",type:"Actor",color:"#2a4a6b",flags:{[MODULE]:{prefabs:true}}});

    const made = [];
    for (const p of C.PREFABS) {
      if (game.actors.find(a => a.flags?.[MODULE]?.prefab === p.key)) continue;
      const skills = {};
      for (const key of p.skills) skills[key] = {rank:1,ticks:0,slotted:true};
      for (const key of p.free ?? []) skills[key] = {rank:1,ticks:0,slotted:true,free:true};

      const actor = await Actor.create({
        name:p.name,
        type:"character",
        folder:folder.id,
        prototypeToken:{name:p.name,actorLink:true,disposition:1},
        system:{
          abilities:Object.fromEntries(Object.entries(p.abilities).map(([k,v]) => [k,{value:v}])),
          attributes:{movement:{walk:30}},
          details:{biography:{value:p.handle ? "<p><b>Handle:</b> " + esc(p.handle) + "</p>" : ""}},
          currency:{gp:100}
        },
        flags:{[MODULE]:{prefab:p.key,skills}}
      });

      const gear = [...p.skills,...(p.free ?? [])].map(k => GEAR[k]).filter(Boolean)
        .map(g => foundry.utils.mergeObject(foundry.utils.deepClone(g),{system:{equipped:true}}));
      await actor.createEmbeddedDocuments("Item",[
        classData(1),
        ...C.TALENTS.filter(t => t.owner === p.key).map(talentItem),
        ...gear,
        ...STARTER.map(s => foundry.utils.mergeObject(foundry.utils.deepClone(s),{system:{equipped:true}}))
      ]);
      const max = hpFor(actor,1);
      await actor.update({"system.attributes.hp.max":max,"system.attributes.hp.value":max});
      await syncEffect(actor);
      made.push(actor.name);
    }
    ui.notifications.info(made.length ? "Built prefabs: " + made.join(", ") : "All prefabs already exist.");
    return made;
  }

  // ---------- views ----------

  function rankPips(rank) {
    return '<span class="asc-pips" aria-label="Rank ' + rank + ' of 5">' +
      [1,2,3,4,5].map(n => '<i class="' + (n <= rank ? "on" : "") + '"></i>').join("") +
      '</span>';
  }

  function tickBar(actor,s) {
    const need = ticksToNext(actor,s.rank);
    if (need == null) return '<span class="asc-ticks is-max">MAX RANK</span>';
    const capped = s.rank >= C.rankCapAt(levelOf(actor));
    const pct = Math.min(100,Math.round(100 * s.ticks / need));
    return '<span class="asc-ticks' + (capped ? " is-capped" : "") + '" title="' + (capped ? "Rank capped by level" : "Ticks to next rank") + '">' +
      '<span class="asc-bar"><span style="width:' + pct + '%"></span></span>' +
      '<b>' + s.ticks + '/' + need + '</b>' + (capped ? '<em>CAP</em>' : '') +
    '</span>';
  }

  function perkList(s) {
    const def = s.def;
    if (def.cat === "weapon") return "";
    return '<ol class="asc-perks">' + def.ranks.map((text,i) =>
      '<li class="' + (i < s.rank ? "on" : "") + '"><b>' + ROMAN[i + 1] + '</b> ' + esc(text) + '</li>'
    ).join("") + '</ol>';
  }

  function techList(actor,s) {
    const def = s.def;
    if (def.cat !== "weapon") return "";
    const spent = flags(actor).spent ?? {};
    const rows = def.tech.map(t => {
      const open = t.rank <= s.rank;
      const isSpent = spent[techKey(def.key,t.rank)];
      const use = t.rank <= 2 ? "AT WILL" : "RECHARGE 5-6";
      return '<li class="' + (open ? "on" : "") + (isSpent ? " is-spent" : "") + '">' +
        '<b>' + ROMAN[t.rank] + '</b><span><strong>' + esc(t.name) + '</strong> ' + esc(t.text) + '<small>' + use + '</small></span>' +
        (open ? '<button type="button" data-asc="use" data-key="' + def.key + '" data-rank="' + t.rank + '"' + (isSpent ? " disabled" : "") + '>' + (isSpent ? "SPENT" : "USE") + '</button>' : '') +
      '</li>';
    });

    let finisher;
    if (s.rank >= 5 && s.finisher != null) {
      const f = def.finishers[s.finisher];
      const isSpent = spent[techKey(def.key,5)];
      finisher = '<li class="on is-finisher' + (isSpent ? " is-spent" : "") + '"><b>V</b><span><strong>' + esc(f.name) + '</strong> ' + esc(f.text) + '<small>ONCE PER FIGHT</small></span>' +
        '<button type="button" data-asc="use" data-key="' + def.key + '" data-rank="5"' + (isSpent ? " disabled" : "") + '>' + (isSpent ? "SPENT" : "USE") + '</button></li>';
    } else if (s.rank >= 5) {
      finisher = '<li class="on is-choice"><b>V</b><span><strong>Choose your finisher</strong> (permanent)</span>' +
        def.finishers.map((f,i) => '<button type="button" data-asc="finisher" data-key="' + def.key + '" data-index="' + i + '" title="' + esc(f.text) + '">' + esc(f.name) + '</button>').join("") +
      '</li>';
    } else {
      finisher = '<li><b>V</b><span><strong>Finisher</strong> ' + def.finishers.map(f => esc(f.name)).join(" or ") + '</span></li>';
    }
    return '<ol class="asc-techs">' + rows.join("") + finisher + '</ol>';
  }

  function skillCard(actor,s) {
    const def = s.def;
    const gm = game.user.isGM;
    return '<article class="asc-card" data-cat="' + def.cat + '">' +
      '<header>' +
        '<i class="asc-icon ' + esc(def.icon) + '"></i>' +
        '<div class="asc-title"><small>' + esc(C.CATEGORIES[def.cat]) + (s.free ? " // FREE" : "") + (def.dmg ? " // " + esc(def.dmg) : "") + '</small><h4>' + esc(def.name) + '</h4></div>' +
        rankPips(s.rank) +
      '</header>' +
      '<div class="asc-row">' + tickBar(actor,s) +
        (gm ? '<span class="asc-gm">' +
          '<button type="button" data-asc="tick" data-key="' + def.key + '" data-n="1" title="Award a tick">+TICK</button>' +
          '<button type="button" data-asc="tick" data-key="' + def.key + '" data-n="-1" title="Remove a tick">&minus;</button>' +
          '<button type="button" data-asc="rank" data-key="' + def.key + '" data-n="1" title="Rank up (ignores ticks)">R+</button>' +
          '<button type="button" data-asc="rank" data-key="' + def.key + '" data-n="-1" title="Rank down">R&minus;</button>' +
          (s.free ? "" : '<button type="button" data-asc="unslot" data-key="' + def.key + '" title="Unslot (keeps rank)">UNSLOT</button>') +
        '</span>' : '') +
      '</div>' +
      techList(actor,s) + perkList(s) +
    '</article>';
  }

  function comboKeys(combo) {
    return [combo.a,combo.b].map(x => Array.isArray(x) ? x : [x]);
  }

  function combosFor(actor) {
    const ranks = Object.fromEntries(slotted(actor).map(s => [s.key,s.rank]));
    return C.COMBOS.map(combo => {
      const parts = comboKeys(combo).map(keys => Math.max(0,...keys.map(k => ranks[k] ?? 0)));
      return {...combo,active:parts.every(r => r >= 3),started:parts.some(r => r > 0)};
    });
  }

  const comboLabel = combo => comboKeys(combo).map(keys => keys.map(k => C.SKILL[k].name).join("/")).join(" + ");

  function skillsPanel(actor) {
    const info = slotInfo(actor);
    const list = slotted(actor);
    const known = Object.entries(skillsOf(actor)).filter(([k,s]) => !s.slotted && C.SKILL[k]);
    const talents = actor.items.filter(i => i.flags?.[MODULE]?.talent);
    const combos = combosFor(actor).filter(c => c.active || c.started);
    const gm = game.user.isGM;
    const owner = canEdit(actor);
    const swap = hasTalent(actor,"hotswap");

    const empty = Array.from({length:info.open},() =>
      '<button type="button" class="asc-empty" data-asc="picker"' + (owner ? "" : " disabled") + '><i class="fa-solid fa-plus"></i><span>Open slot<small>Choose a skill</small></span></button>'
    ).join("");

    return '<section class="asc-panel">' +
      '<header class="asc-head">' +
        '<div><small>THE ASCENT // PLAYER STATUS</small><h3>SKILLS</h3></div>' +
        '<dl>' +
          '<div><dt>LEVEL</dt><dd>' + levelOf(actor) + (gm ? ' <button type="button" data-asc="level" data-n="-1" title="Level down">&minus;</button><button type="button" data-asc="level" data-n="1" title="Level up">+</button>' : '') + '</dd></div>' +
          '<div><dt>SLOTS</dt><dd>' + info.used + ' / ' + info.total + '</dd></div>' +
          '<div><dt>RANK CAP</dt><dd>' + ROMAN[C.rankCapAt(levelOf(actor))] + '</dd></div>' +
          '<div><dt>FLOOR</dt><dd>' + floor() + '</dd></div>' +
        '</dl>' +
        '<button type="button" class="asc-browse" data-asc="picker"><i class="fa-solid fa-book-open"></i> ALL SKILLS</button>' +
      '</header>' +
      (talents.length ? '<div class="asc-talents"><small>TALENTS</small>' + talents.map(t =>
        '<span class="asc-talent" data-tooltip="' + esc(foundry.utils.stripHTML?.(t.system.description.value) ?? "") + '">' + esc(t.name) + '</span>').join("") + '</div>' : '') +
      '<div class="asc-grid">' + list.map(s => skillCard(actor,s)).join("") + empty + '</div>' +
      (known.length ? '<div class="asc-stored"><small>STORED SKILLS (KEEP THEIR RANK)</small>' + known.map(([k,s]) =>
        '<span class="asc-chip" data-cat="' + C.SKILL[k].cat + '">' + esc(C.SKILL[k].name) + ' ' + ROMAN[s.rank] +
          (info.open && owner ? ' <button type="button" data-asc="slot" data-key="' + k + '">SLOT</button>' : '') +
          (swap && owner && !flags(actor).hotSwapUsed ? ' <button type="button" data-asc="hotswap" data-key="' + k + '">HOT SWAP</button>' : '') +
        '</span>').join("") + '</div>' : '') +
      '<div class="asc-combos"><small>COMBO SKILLS // TWO SKILLS AT RANK III</small>' +
        (combos.length ? combos.map(c =>
          '<span class="asc-combo' + (c.active ? " on" : "") + '" data-tooltip="' + esc(c.text) + '"><b>' + esc(c.name) + '</b> ' + esc(comboLabel(c)) + '</span>').join("")
          : '<em>Slot related skills to work toward combos. Browse them in All Skills.</em>') +
      '</div>' +
    '</section>';
  }

  async function handleAction(actor,button) {
    const {asc:action,key} = button.dataset;
    const n = Number(button.dataset.n);
    switch (action) {
      case "picker": return openPicker(actor);
      case "slot": return slotSkill(actor,key);
      case "unslot": return unslotSkill(actor,key);
      case "tick": return addTicks(actor,key,n);
      case "rank": return setRank(actor,key,(skillsOf(actor)[key]?.rank ?? 1) + n);
      case "level": return setLevel(actor,levelOf(actor) + n);
      case "use": return useTechnique(actor,key,Number(button.dataset.rank));
      case "finisher": return chooseFinisher(actor,key,Number(button.dataset.index));
      case "hotswap": return hotSwap(actor,key);
    }
  }

  function bindActions(root,actor) {
    root.addEventListener("click",event => {
      const button = event.target.closest("[data-asc]");
      if (!button || button.disabled || !root.contains(button)) return;
      event.preventDefault();
      event.stopPropagation();
      handleAction(actor,button).catch(error => {
        console.error("THE ASCENT // action failed",error);
        ui.notifications.error("That didn't work: " + error.message);
      });
    });
  }

  // ---------- sheet: Spells tab becomes Skills ----------

  function decorateSheet(app,html) {
    const actor = app?.document;
    if (actor?.documentName !== "Actor" || actor.type !== "character") return;
    const root = html instanceof HTMLElement ? html : app.element;
    const tab = root?.querySelector?.('.tab[data-tab="spells"]');
    if (!tab) return;

    const nav = root.querySelector('nav.tabs [data-tab="spells"]');
    if (nav) {
      nav.setAttribute("data-tooltip","Skills");
      nav.setAttribute("aria-label","Skills");
      const icon = nav.querySelector("i");
      if (icon) icon.className = "fa-solid fa-bolt";
    }

    tab.classList.add("asc-tab");
    tab.querySelector(":scope > .asc-panel")?.remove();
    tab.insertAdjacentHTML("beforeend",skillsPanel(actor));
    bindActions(tab.querySelector(":scope > .asc-panel"),actor);
  }

  // ---------- skill picker ----------

  const {ApplicationV2} = foundry.applications.api;

  class SkillPicker extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      classes:["asc-app","asc-picker"],
      window:{title:"Skill Select",resizable:true},
      position:{width:960,height:720}
    };

    constructor(actor,options = {}) {
      super({id:"asc-picker-" + (actor?.id ?? "browse"),...options});
      this.actor = actor;
      this.filter = "all";
      this.query = "";
      this.expanded = null;
    }

    get title() {
      return this.actor ? "Skill Select // " + this.actor.name : "Skill Compendium";
    }

    statusOf(def) {
      const s = this.actor ? skillsOf(this.actor)[def.key] : null;
      if (s?.slotted) return {label:"SLOTTED " + ROMAN[s.rank],cls:"is-slotted"};
      if (s) return {label:"STORED " + ROMAN[s.rank],cls:"is-stored"};
      if (isLocked(def)) return {label:"LOCKED // FLOOR " + def.lock,cls:"is-locked"};
      return {label:"AVAILABLE",cls:""};
    }

    detail(def) {
      if (def.cat === "weapon") {
        return '<ol class="asc-techs">' +
          def.tech.map(t => '<li class="on"><b>' + ROMAN[t.rank] + '</b><span><strong>' + esc(t.name) + '</strong> ' + esc(t.text) + '<small>' + (t.rank <= 2 ? "AT WILL" : "RECHARGE 5-6") + '</small></span></li>').join("") +
          '<li class="on is-finisher"><b>V</b><span><strong>Pick one finisher</strong> (once per fight)' +
            def.finishers.map(f => '<em class="asc-fin"><strong>' + esc(f.name) + ':</strong> ' + esc(f.text) + '</em>').join("") +
          '</span></li>' +
        '</ol>';
      }
      return '<ol class="asc-perks">' + def.ranks.map((t,i) => '<li class="on"><b>' + ROMAN[i + 1] + '</b> ' + esc(t) + '</li>').join("") + '</ol>';
    }

    async _renderHTML() {
      const actor = this.actor;
      const info = actor ? slotInfo(actor) : null;
      const q = this.query.toLowerCase();
      const defs = C.SKILLS.filter(d =>
        (this.filter === "all" || d.cat === this.filter) &&
        (!q || d.name.toLowerCase().includes(q) || JSON.stringify(d.tech ?? d.ranks).toLowerCase().includes(q))
      );

      const tabs = [["all","All"],...Object.entries(C.CATEGORIES)].map(([id,label]) =>
        '<button type="button" class="' + (this.filter === id ? "on" : "") + '" data-filter="' + id + '" data-cat="' + id + '">' + esc(label) + '</button>'
      ).join("");

      const cards = defs.map(def => {
        const st = this.statusOf(def);
        const s = actor ? skillsOf(actor)[def.key] : null;
        const canSlot = actor && canEdit(actor) && info.open > 0 && !s?.slotted && (!isLocked(def) || game.user.isGM);
        const open = this.expanded === def.key;
        const unlocks = def.cat === "weapon"
          ? def.tech.map(t => t.name).join(" · ")
          : def.ranks[0];
        const combos = C.COMBOS.filter(c => comboKeys(c).flat().includes(def.key)).map(c => c.name);
        return '<article class="asc-pick ' + st.cls + (open ? " is-open" : "") + '" data-cat="' + def.cat + '">' +
          '<button type="button" class="asc-pick-head" data-expand="' + def.key + '" aria-expanded="' + open + '">' +
            '<i class="asc-icon ' + esc(def.icon) + '"></i>' +
            '<span class="asc-title"><small>' + esc(C.CATEGORIES[def.cat]) + (def.dmg ? " // " + esc(def.dmg) : "") + '</small><b>' + esc(def.name) + '</b><em>' + esc(unlocks) + '</em></span>' +
            '<span class="asc-status">' + st.label + '</span>' +
          '</button>' +
          (open ? '<div class="asc-pick-body">' + this.detail(def) +
            (combos.length ? '<p class="asc-pick-combos"><small>COMBOS</small> ' + combos.map(esc).join(", ") + '</p>' : '') +
            (def.skills?.length ? '<p class="asc-pick-combos"><small>PROFICIENCY</small> ' + def.skills.map(id => CONFIG.DND5E.skills[id]?.label ?? id).join(", ") + '</p>' : '') +
          '</div>' : '') +
          (canSlot ? '<button type="button" class="asc-slot-btn" data-slot="' + def.key + '">' + (s ? "SLOT (RANK " + ROMAN[s.rank] + ")" : "SLOT SKILL") + '</button>' : '') +
        '</article>';
      }).join("");

      return '<div class="asc-picker-wrap">' +
        '<header class="asc-picker-head">' +
          '<div><small>' + (actor ? "PLAYER // " + esc(actor.name).toUpperCase() : "ALL SKILLS") + '</small>' +
            '<h2>' + (actor ? (info.open ? info.open + " OPEN SLOT" + (info.open > 1 ? "S" : "") : "NO OPEN SLOTS") : "SKILL COMPENDIUM") + '</h2>' +
            (actor ? '<p>' + info.used + ' / ' + info.total + ' slots used &middot; rank cap ' + ROMAN[C.rankCapAt(levelOf(actor))] + ' &middot; skills grow by use</p>' : '') +
          '</div>' +
          '<input type="search" placeholder="Search skills and techniques" value="' + esc(this.query) + '" aria-label="Search skills">' +
        '</header>' +
        '<nav class="asc-filters">' + tabs + '</nav>' +
        '<div class="asc-pick-grid">' + (cards || '<p class="asc-none">No skills match.</p>') + '</div>' +
      '</div>';
    }

    _replaceHTML(result,content) {
      content.innerHTML = result;
      const search = content.querySelector("input[type=search]");
      search?.addEventListener("input",foundry.utils.debounce(() => {
        this.query = search.value;
        this.render().then(() => {
          const input = this.element.querySelector("input[type=search]");
          input?.focus();
          input?.setSelectionRange(input.value.length,input.value.length);
        });
      },200));
      content.addEventListener("click",event => {
        const filter = event.target.closest("[data-filter]");
        if (filter) { this.filter = filter.dataset.filter; return this.render(); }
        const expand = event.target.closest("[data-expand]");
        if (expand) { this.expanded = this.expanded === expand.dataset.expand ? null : expand.dataset.expand; return this.render(); }
        const slot = event.target.closest("[data-slot]");
        if (slot) slotSkill(this.actor,slot.dataset.slot).then(() => this.render());
      });
    }
  }

  function openPicker(actor) {
    const id = "asc-picker-" + (actor?.id ?? "browse");
    const existing = foundry.applications.instances.get(id);
    if (existing) return existing.render({force:true});
    return new SkillPicker(actor).render({force:true});
  }

  // ---------- character select ----------
  // Full-screen pick screen. Players without a character see it when they
  // join; clicking a prefab plays its theme, LOCK IN asks the GM to assign it.
  // The GM sets each prefab's portrait and theme from the same screen.

  const QUERY = MODULE + ".select";
  const SQUAD_SIZE = 4;
  const STAT_KEYS = ["str","dex","con","int","wis","cha"];
  const DEFAULT_IMG = /mystery-man|icons\/svg\//;

  const prefabs = () => C.PREFABS
    .map(p => ({p,actor:game.actors.find(a => a.flags?.[MODULE]?.prefab === p.key)}))
    .filter(x => x.actor);
  const pickedBy = actor => game.users.find(u => !u.isGM && u.character?.id === actor.id);
  const squadCount = () => prefabs().filter(x => pickedBy(x.actor)).length;

  const select = {el:null,index:0,sound:null,soundSrc:null,flash:null};

  async function stopTheme() {
    const sound = select.sound;
    select.sound = null;
    select.soundSrc = null;
    if (!sound) return;
    try {
      await sound.fade?.(0,{duration:500});
      setTimeout(() => sound.stop?.(),520);
    } catch { sound.stop?.(); }
  }

  async function playTheme(actor) {
    const src = actor.flags?.[MODULE]?.theme;
    if (src === select.soundSrc) return;
    await stopTheme();
    if (!src) return;
    select.soundSrc = src;
    // Each theme starts at its hook and loops back to it, not to 0:00.
    const start = Number(actor.flags?.[MODULE]?.themeStart) || 0;
    try {
      // Browsers keep audio locked until the first real click; the music
      // context only exists after that.
      await game.audio.unlock;
      if (select.soundSrc !== src) return;
      const sound = new foundry.audio.Sound(src,{context:game.audio.music});
      await sound.load();
      if (select.soundSrc !== src) return;
      await sound.play({loop:true,offset:start,loopStart:start,volume:0.8,fade:600});
      if (select.soundSrc === src) select.sound = sound;
      else sound.stop();
    } catch (error) {
      console.warn("THE ASCENT // theme failed",src,error);
    }
  }

  function selectCard({p,actor},i) {
    const by = pickedBy(actor);
    const mine = by?.isSelf;
    const art = DEFAULT_IMG.test(actor.img)
      ? '<div class="asc-sel-art is-blank"><span>' + esc(p.name[0]) + '</span></div>'
      : '<div class="asc-sel-art"><img src="' + esc(actor.img) + '" alt=""></div>';
    return '<button type="button" class="asc-sel-card' + (i === select.index ? " is-active" : "") + (by ? " is-taken" : "") + (mine ? " is-mine" : "") +
      '" data-sel-index="' + i + '" aria-pressed="' + (i === select.index) + '" aria-label="' + esc(p.name) + (by ? ", picked by " + esc(by.name) : "") + '">' +
      art +
      '<span class="asc-sel-name"><b>' + esc(p.name) + '</b>' + (p.handle ? '<small>' + esc(p.handle) + '</small>' : '') + '</span>' +
      (by ? '<span class="asc-sel-tag">' + (mine ? "YOU" : esc(by.name)) + '</span>' : '') +
    '</button>';
  }

  function selectDetail({p,actor}) {
    const by = pickedBy(actor);
    const me = game.user;
    const gm = me.isGM;
    const full = squadCount() >= SQUAD_SIZE;
    const talents = C.TALENTS.filter(t => t.owner === p.key);
    const skills = [...(p.free ?? []).map(k => [k,true]),...p.skills.map(k => [k,false])];
    const stats = STAT_KEYS.map(k => {
      const v = p.abilities[k];
      return '<li><span>' + k.toUpperCase() + '</span><i><b style="width:' + Math.round(v / 20 * 100) + '%"></b></i><em>' + v + '</em></li>';
    }).join("");

    let action = "";
    if (gm) {
      action =
        '<button type="button" data-sel="art"><i class="fa-solid fa-image"></i> SET PORTRAIT</button>' +
        '<button type="button" data-sel="theme"><i class="fa-solid fa-music"></i> ' + (actor.flags?.[MODULE]?.theme ? "CHANGE THEME" : "SET THEME") + '</button>' +
        '<label class="asc-sel-start">START AT <input type="number" min="0" step="1" value="' + (Number(actor.flags?.[MODULE]?.themeStart) || 0) + '" data-sel-start aria-label="Theme start, seconds"> s</label>' +
        (by ? '<button type="button" data-sel="release"><i class="fa-solid fa-user-xmark"></i> RELEASE FROM ' + esc(by.name).toUpperCase() + '</button>' : '');
    } else if (by) {
      action = '<p class="asc-sel-note">' + (by.isSelf ? "This is you. See you inside." : "Picked by " + esc(by.name) + ".") + '</p>';
    } else if (me.character) {
      action = '<p class="asc-sel-note">You are already ' + esc(me.character.name) + '.</p>';
    } else if (full) {
      action = '<p class="asc-sel-note">The squad is full: the BD only takes four.</p>';
    } else {
      action = '<button type="button" class="asc-sel-lock" data-sel="lock">LOCK IN</button>';
    }

    const theme = actor.flags?.[MODULE]?.theme;
    return '<section class="asc-sel-detail">' +
      '<header><small>' + (p.handle ? esc(p.handle) : "NO HANDLE") + '</small><h2>' + esc(p.name) + '</h2>' +
        (theme ? '<span class="asc-sel-playing"><i class="fa-solid fa-music"></i> ' + esc(decodeURIComponent(theme.split("/").pop()).replace(/\.[^.]+$/,"")) + '</span>' : '') +
      '</header>' +
      '<div class="asc-sel-cols">' +
        '<div><small>STATS</small><ul class="asc-sel-stats">' + stats + '</ul>' +
          '<p class="asc-sel-vitals"><span>HP <b>' + actor.system.attributes.hp.max + '</b></span><span>AC <b>' + actor.system.attributes.ac.value + '</b></span><span>SPEED <b>' + actor.system.attributes.movement.walk + '</b></span></p></div>' +
        '<div><small>TALENTS</small><ul class="asc-sel-talents">' + talents.map(t => '<li><b>' + esc(t.name) + '</b> ' + esc(t.text) + '</li>').join("") + '</ul>' +
          '<small>STARTING SKILLS</small><p class="asc-sel-skills">' + skills.map(([k,free]) =>
            '<span class="asc-chip" data-cat="' + C.SKILL[k].cat + '">' + esc(C.SKILL[k].name) + (free ? " · FREE" : "") + '</span>').join("") + '</p></div>' +
      '</div>' +
      '<footer>' + action + '</footer>' +
    '</section>';
  }

  function renderSelect() {
    if (!select.el) return;
    const list = prefabs();
    if (!list.length) {
      select.el.innerHTML = '<div class="asc-sel-empty">No prefabs yet. The GM builds them with ASCENT.buildPrefabs().</div>';
      return;
    }
    select.index = Math.min(select.index,list.length - 1);
    const scrollY = select.el.querySelector(".asc-sel-detail")?.scrollTop ?? 0;
    select.el.innerHTML =
      '<div class="asc-sel-bg" aria-hidden="true"></div>' +
      '<header class="asc-sel-head">' +
        '<div><small>BD LINK ESTABLISHED // UPPER BRACKET TRIAL</small><h1>SELECT YOUR PLAYER</h1></div>' +
        '<span class="asc-sel-squad">SQUAD <b>' + squadCount() + ' / ' + SQUAD_SIZE + '</b></span>' +
        '<button type="button" class="asc-sel-close" data-sel="close" aria-label="Close character select"><i class="fa-solid fa-xmark"></i></button>' +
      '</header>' +
      '<div class="asc-sel-row" role="group" aria-label="Characters">' + list.map(selectCard).join("") + '</div>' +
      selectDetail(list[select.index]) +
      (select.flash ? '<div class="asc-sel-flash"><span>' + esc(select.flash) + '</span></div>' : '');
    const detail = select.el.querySelector(".asc-sel-detail");
    if (detail) detail.scrollTop = scrollY;
  }

  async function choose(index) {
    const list = prefabs();
    if (!list[index]) return;
    select.index = index;
    renderSelect();
    select.el?.querySelector('[data-sel-index="' + index + '"]')?.focus();
    await playTheme(list[index].actor);
  }

  function pickFile(type,current,callback) {
    const FP = foundry.applications.apps.FilePicker.implementation;
    const fp = new FP({type,current,callback});
    fp.render(true).then(() => { if (fp.element) fp.element.style.zIndex = 1200; });
  }

  async function onSelectClick(event) {
    const card = event.target.closest("[data-sel-index]");
    if (card) return choose(Number(card.dataset.selIndex));
    const button = event.target.closest("[data-sel]");
    if (!button || button.disabled) return;
    const entry = prefabs()[select.index];
    const actor = entry?.actor;
    switch (button.dataset.sel) {
      case "close": return closeSelect();
      case "art":
        return pickFile("image",actor.img,path => actor.update({img:path,"prototypeToken.texture.src":path}));
      case "theme":
        return pickFile("audio",actor.flags?.[MODULE]?.theme ?? "",async path => {
          await actor.update({["flags."+MODULE+".theme"]:path});
          select.soundSrc = null;
          playTheme(actor);
        });
      case "release":
        return selectRequest("release",{actorId:actor.id});
      case "lock": {
        button.disabled = true;
        const ok = await selectRequest("claim",{actorId:actor.id,userId:game.user.id});
        if (!ok) { button.disabled = false; return; }
        select.flash = actor.name.toUpperCase() + " // LOCKED IN";
        renderSelect();
        setTimeout(() => { select.flash = null; closeSelect(); },2600);
        return;
      }
    }
  }

  function onSelectKey(event) {
    if (!select.el) return;
    if (event.target.closest?.("input, textarea")) return;
    const n = prefabs().length;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      choose((select.index + (event.key === "ArrowRight" ? 1 : n - 1)) % n);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeSelect();
    }
  }

  function openSelect() {
    if (!select.el) {
      select.el = document.createElement("div");
      select.el.id = "asc-select";
      select.el.setAttribute("role","dialog");
      select.el.setAttribute("aria-modal","true");
      select.el.setAttribute("aria-label","Character select");
      select.el.addEventListener("click",event => {
        onSelectClick(event).catch(error => ui.notifications.error(error.message));
      });
      select.el.addEventListener("change",async event => {
        const input = event.target.closest("[data-sel-start]");
        const actor = prefabs()[select.index]?.actor;
        if (!input || !actor || !game.user.isGM) return;
        await actor.update({["flags."+MODULE+".themeStart"]:Math.max(0,Number(input.value) || 0)});
        select.soundSrc = null;
        playTheme(actor);
      });
      document.body.appendChild(select.el);
      document.addEventListener("keydown",onSelectKey,true);
    }
    const list = prefabs();
    const mine = list.findIndex(x => x.actor.id === game.user.character?.id);
    select.index = mine >= 0 ? mine : 0;
    renderSelect();
    select.el.querySelector(".asc-sel-card.is-active")?.focus();
    if (list[select.index]) playTheme(list[select.index].actor);
  }

  function closeSelect() {
    stopTheme();
    document.removeEventListener("keydown",onSelectKey,true);
    select.el?.remove();
    select.el = null;
  }

  async function selectRequest(kind,payload) {
    let result;
    if (game.user.isGM) result = await onSelectQuery({kind,payload});
    else {
      const gm = game.users.activeGM;
      if (!gm) {
        ui.notifications.warn("The GM has to be online to lock in a character.");
        return false;
      }
      result = await gm.query(QUERY,{kind,payload},{timeout:15000});
    }
    if (!result?.ok) ui.notifications.warn(result?.error ?? "That didn't go through.");
    return !!result?.ok;
  }

  // Runs on the active GM: the only client allowed to hand out characters.
  async function onSelectQuery(message) {
    if (!game.user.isGM) return {ok:false,error:"Not the GM."};
    const {kind,payload = {}} = message ?? {};
    const actor = game.actors.get(payload.actorId);
    if (!actor?.flags?.[MODULE]?.prefab) return {ok:false,error:"That character doesn't exist."};

    if (kind === "claim") {
      const user = game.users.get(payload.userId);
      if (!user || user.isGM) return {ok:false,error:"Unknown player."};
      if (user.character) return {ok:false,error:"You are already " + user.character.name + "."};
      const by = pickedBy(actor);
      if (by) return {ok:false,error:actor.name + " was just picked by " + by.name + "."};
      if (squadCount() >= SQUAD_SIZE) return {ok:false,error:"The squad is full."};
      await actor.update({["ownership." + user.id]:CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER});
      await user.update({character:actor.id});
      ChatMessage.create({content:'<div class="asc-chat"><small>CHARACTER SELECT</small><p><b>' + esc(user.name) + '</b> locked in as <b>' + esc(actor.name) + '</b>.</p></div>'});
      return {ok:true};
    }

    if (kind === "release") {
      const by = pickedBy(actor);
      if (by) {
        await by.update({character:null});
        await actor.update({["ownership." + by.id]:CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE});
      }
      return {ok:true};
    }
    return {ok:false,error:"Not allowed."};
  }

  function addSelectButton(app,html) {
    if (!game.user.isGM && game.user.character) return;
    const root = html instanceof HTMLElement ? html : app.element;
    const header = root?.querySelector?.(".directory-header .header-actions") ?? root?.querySelector?.(".directory-header");
    if (!header || header.querySelector(".asc-open-select")) return;
    header.insertAdjacentHTML("beforeend",'<button type="button" class="asc-open-select"><i class="fa-solid fa-users"></i> Character Select</button>');
    header.querySelector(".asc-open-select").addEventListener("click",() => openSelect());
  }

  // ---------- lifecycle ----------

  function refresh() {
    for (const app of foundry.applications.instances.values()) {
      if (app instanceof SkillPicker || (app.document?.documentName === "Actor" && app.rendered)) app.render();
    }
    renderSelect();
  }

  globalThis.ASCENT = {
    version:VERSION,
    catalog:C,
    slotted,
    slotInfo,
    slotSkill,
    unslotSkill,
    addTicks,
    setRank,
    setLevel,
    useTechnique,
    syncEffect,
    buildPrefabs,
    openPicker,
    openSelect,
    closeSelect,
    refresh,

    async init() {
      CONFIG.queries[QUERY] = onSelectQuery;
      on("renderActorDirectory",addSelectButton);
      on("updateUser",(user,changed) => { if ("character" in changed) renderSelect(); });
      on("updateActor",(actor,changed) => {
        if (actor.flags?.[MODULE]?.prefab && ("img" in changed || "flags" in changed || "ownership" in changed)) renderSelect();
      });
      ui.actors?.render();
      if (!game.user.isGM && !game.user.character && prefabs().length) openSelect();

      on("renderActorSheetV2",(app,html) => {
        try { decorateSheet(app,html); } catch (error) { console.warn("THE ASCENT // sheet failed",error); }
      });
      on("dnd5e.preRollAttackV2",onPreRollAttack);
      on("updateActor",actor => {
        const app = foundry.applications.instances.get("asc-picker-" + actor.id);
        if (app?.rendered) app.render();
      });
      on("updateCombat",(combat,changed) => {
        if (!isActiveGM() || !combat.started) return;
        if (!("turn" in changed) && !("round" in changed)) return;
        onTurnStart(combat).catch(error => console.warn("THE ASCENT // turn start failed",error));
      });
      on("deleteCombat",combat => {
        if (!isActiveGM()) return;
        for (const c of combat.combatants) if (c.actor) clearFight(c.actor).catch(() => {});
      });
      on("dnd5e.restCompleted",(actor,result,config) => {
        if (!canEdit(actor)) return;
        const long = result?.longRest ?? config?.type === "long";
        clearFight(actor).catch(() => {});
        if (long && flags(actor).hotSwapUsed) actor.update({["flags."+MODULE+".hotSwapUsed"]:false});
      });
      refresh();
    },

    async destroy() {
      for (const [name,id] of hooks.splice(0)) Hooks.off(name,id);
      if (CONFIG.queries[QUERY] === onSelectQuery) delete CONFIG.queries[QUERY];
      closeSelect();
      document.querySelectorAll(".asc-open-select").forEach(node => node.remove());
      for (const app of [...foundry.applications.instances.values()]) {
        if (app instanceof SkillPicker) await app.close();
      }
    }
  };
})();

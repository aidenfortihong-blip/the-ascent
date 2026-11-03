// THE ASCENT // CATALOG
// Rules data: skills, techniques, combos, talents and the progression tables.
// Plain data only; scripts/ascent.js reads it from globalThis.ASCENT_CATALOG.

(() => {
  // Weapon skills: ranks 1-4 are techniques, rank 5 is a choice of two finishers.
  // weapons = dnd5e base weapon ids the skill makes you proficient with.
  const weapon = (key,name,icon,dmg,weapons,tech,finishers) => ({
    key,name,icon,cat:"weapon",lock:0,dmg,weapons,
    tech:tech.map(([n,t],i) => ({rank:i + 1,name:n,text:t})),
    finishers:finishers.map(([n,t]) => ({rank:5,name:n,text:t}))
  });

  // Every other skill: one perk per rank. skills = dnd5e skills it gives proficiency in.
  const perk = (key,name,icon,cat,skills,ranks,lock = 0,extra = {}) => ({
    key,name,icon,cat,lock,skills,ranks,...extra
  });

  const SKILLS = [
    weapon("sword","One-Handed Sword","fa-solid fa-khanda","d8",["longsword","shortsword","scimitar"],[
      ["Lunge","Move 10 ft and attack in one motion."],
      ["Twin Cut","Make 2 attacks, each at -2."],
      ["Cross Slash","One attack roll hits 2 adjacent enemies."],
      ["Riposte","Reaction: when a melee attack misses you, attack back."]
    ],[
      ["Starfall","4 attacks; the last one is a critical hit if it lands."],
      ["Sever","One attack with triple damage dice. The target can't use Techniques on its next turn."]
    ]),
    weapon("rapier","Rapier","fa-solid fa-wand-sparkles","d8 finesse",["rapier"],[
      ["Feint","Your next attack this turn has advantage."],
      ["Pin","On a hit, the target's speed is 0 until its next turn."],
      ["Flurry Thrust","Make 3 attacks, each at -2."],
      ["Disarm","On a hit, the target drops its weapon (Str save vs 8 + prof + Dex)."]
    ],[
      ["Thousand Points","6 attacks, each at -4."],
      ["Perfect Line","One attack that hits automatically and deals +4d8."]
    ]),
    weapon("dagger","Dagger","fa-solid fa-scissors","d4 finesse, thrown",["dagger"],[
      ["Backstab","+2d6 damage against an unaware or flanked target."],
      ["Quick Toss","Throw a dagger as a bonus action."],
      ["Bleed","On a hit, the target takes 1d6 at the start of its turn for 3 turns."],
      ["Vanish Strike","Attack, then Hide in the same action."]
    ],[
      ["Execution","Double damage against a target under half HP."],
      ["Puppet Cut","On a hit, the target's speed is 0 and it has disadvantage on attacks for 2 rounds."]
    ]),
    weapon("greatsword","Greatsword","fa-solid fa-gavel","2d6 heavy",["greatsword"],[
      ["Cleave","One attack roll hits every adjacent enemy."],
      ["Guard Break","On a hit, the target has -2 AC until your next turn."],
      ["Momentum","Each kill this turn grants another attack."],
      ["Unstoppable","This turn you can't be stopped, grappled or knocked prone."]
    ],[
      ["Titan Fall","6d12 to everything in a 15 ft radius (Dex save for half)."],
      ["Moonsplitter","A 60 ft line, 6d6, Dex save for half."]
    ]),
    weapon("hammer","Hammer & Axe","fa-solid fa-hammer","d10 heavy",["warhammer","battleaxe","greataxe","maul","handaxe","lighthammer","mace"],[
      ["Concuss","On a hit, the target has disadvantage on its next attack."],
      ["Armor Crack","On a hit, the target's AC drops by 1 (stacks to -3, lasts the fight)."],
      ["Ground Slam","Everything within 10 ft: Str save or prone."],
      ["Wrecker","Double damage to objects, shields and constructs."]
    ],[
      ["Earthbreaker","20 ft radius: prone and difficult terrain until the end of the fight."],
      ["Headsman","For the rest of the fight you crit on 18-20."]
    ]),
    weapon("spear","Spear","fa-solid fa-staff-snake","d10 reach",["spear","pike","glaive","halberd","trident"],[
      ["Sweep","On a hit, the target is knocked prone (Str save)."],
      ["Hold the Line","Until your next turn, enemies entering your reach provoke a free attack."],
      ["Impale","One attack roll hits 2 enemies in a line."],
      ["Vault","Jump 20 ft and attack where you land."]
    ],[
      ["Skewer","A line of up to 4 enemies, double damage."],
      ["Dragon Rush","Charge 60 ft and hit everything in the path."]
    ]),
    weapon("bow","Bow","fa-solid fa-bullseye","d8, 150 ft",["shortbow","longbow"],[
      ["Aimed Shot","+5 to hit."],
      ["Double Shot","Shoot 2 different targets."],
      ["Pinning Arrow","On a hit, the target is restrained until it uses its action to break free."],
      ["Rain","15 ft area, Dex save, weapon damage."]
    ],[
      ["Heartseeker","Hits automatically and is a critical hit."],
      ["Sky Piercer","A 300 ft line that ignores cover."]
    ]),
    weapon("martial","Martial Arts","fa-solid fa-hand-fist","d6 unarmed + bonus punch",[],[
      ["Jab Combo","2 extra unarmed hits."],
      ["Throw","On a hit, throw the target 10 ft; it lands prone."],
      ["Pressure Point","On a hit, the target is stunned for 1 turn (Con save)."],
      ["Deflect","Reaction: reduce the damage of one hit by 2d10."]
    ],[
      ["Hundred Fists","8 unarmed hits."],
      ["One Inch","A single blow: 8d6 and push 30 ft."]
    ]),
    weapon("shield","Shield","fa-solid fa-shield-halved","+2 AC, bash d4",[],[
      ["Bash","On a hit, push the target 10 ft."],
      ["Cover Ally","Reaction: take a hit meant for an adjacent ally."],
      ["Wall","Take half damage from everything until your next turn."],
      ["Taunt","Until your next turn, enemies that can see you must target you."]
    ],[
      ["Aegis","The whole party takes no damage for 1 round."],
      ["Reflect","Reaction: send one attack back at its attacker."]
    ]),
    weapon("throwing","Throwing","fa-solid fa-star","d6, 60 ft",["dart","javelin"],[
      ["Ricochet","On a hit, a second target within 10 ft takes half damage."],
      ["Hobble","On a hit, the target's speed is halved until its next turn."],
      ["Fan Throw","15 ft cone: one attack against each of up to 3 targets."],
      ["Return","Your thrown weapons come back; throw again as a bonus action."]
    ],[
      ["Storm of Blades","One attack against every enemy within 30 ft."],
      ["Needle","Automatic critical hit against a target that hasn't acted this fight."]
    ]),

    perk("parry","Parry","fa-solid fa-shield","support",[],[
      "Reaction: +2 AC against one melee attack.",
      "Parry works against ranged attacks too.",
      "If the parried attack misses, your next attack against that enemy has advantage.",
      "You can parry for an adjacent ally.",
      "Once per fight, negate any attack, even a boss Technique."
    ]),
    perk("evasion","Evasion","fa-solid fa-wind","support",[],[
      "+1 AC while in light armor or none.",
      "A successful Dex save means no damage at all.",
      "Sidestep: reaction, move 10 ft when you are targeted.",
      "Attackers never have advantage against you.",
      "Afterimage: once per fight, one attack misses automatically."
    ]),
    perk("sprint","Sprint","fa-solid fa-person-running","support",[],[
      "+10 ft speed.",
      "Dash as a bonus action.",
      "Dashing doesn't provoke opportunity attacks.",
      "+20 ft speed instead of +10.",
      "Blitz: once per fight, an extra full move and one attack."
    ]),
    perk("freerun","Free Running","fa-solid fa-person-falling","support",["acr","ath"],[
      "Climbing costs no extra movement.",
      "Jump twice as far.",
      "Run along walls for up to 30 ft.",
      "No fall damage from under 60 ft.",
      "Move across any surface, even ceilings, for one turn."
    ]),
    perk("regen","Battle Regen","fa-solid fa-heart-pulse","support",[],[
      "Regain 1 HP at the start of each of your turns in combat.",
      "2 HP a turn.",
      "3 HP a turn.",
      "5 HP a turn.",
      "You stabilize on your own while Fading."
    ],5),
    perk("command","Command","fa-solid fa-flag","support",[],[
      "Bonus action: an ally adds 1d4 to their next roll.",
      "An ally can move 10 ft as a reaction on your order.",
      "The whole party gets +2 initiative.",
      "Once per fight, an ally makes one attack as a reaction.",
      "Rally: once per fight, every ally gains 2 x your level temp HP and stops being frightened."
    ],6),

    perk("searching","Searching","fa-solid fa-magnifying-glass","explore",["prc","inv"],[
      "Proficiency in Perception and Investigation.",
      "You notice traps within 10 ft without trying.",
      "Basic traps are always spotted.",
      "Illusions and hidden doors are noticed without a check.",
      "You find every hidden room on the floor."
    ]),
    perk("detection","Detection","fa-solid fa-satellite-dish","explore",[],[
      "Enemy markers on your HUD within 30 ft.",
      "Markers out to 60 ft.",
      "Invisible enemies are marked too.",
      "Hostile NPCs show as red names.",
      "You and your party can't be surprised."
    ]),
    perk("hiding","Hiding","fa-solid fa-user-ninja","explore",["ste"],[
      "Proficiency in Stealth.",
      "You can hide in dim light.",
      "Hide as a bonus action.",
      "After attacking from hiding, roll a d6: on 5-6 you stay hidden.",
      "You are invisible while you don't move."
    ]),
    perk("tracking","Tracking","fa-solid fa-paw","explore",["sur"],[
      "Proficiency in Survival.",
      "Tracks tell you creature type and number.",
      "You can follow any trail.",
      "You can predict where monsters will spawn.",
      "Mark: one target takes +1d6 from your hits and you always know where it is."
    ]),
    perk("lockpicking","Lockpicking","fa-solid fa-key","explore",["slt"],[
      "Proficiency in Sleight of Hand and with locks.",
      "Disarm mechanical traps.",
      "Pick locks as a bonus action.",
      "Steal an item from an enemy mid-combat.",
      "Open magic and boss locks."
    ]),
    perk("cartography","Cartography","fa-solid fa-map","explore",[],[
      "Auto-map: the GM gives you the map of everywhere you've been.",
      "You always know the direction of the safe zone.",
      "Chests are marked in explored areas.",
      "You sense the direction of the boss room.",
      "Once per floor, find a hidden shortcut."
    ]),

    perk("negotiation","Negotiation","fa-solid fa-handshake","social",["per","dec"],[
      "Proficiency in Persuasion and Deception.",
      "Shop prices -10%.",
      "-20% when buying, +20% when selling.",
      "Talk a non-boss enemy out of fighting (Wis save).",
      "Recruit an NPC companion for one floor."
    ]),
    perk("intimidation","Intimidation","fa-solid fa-skull","social",["itm"],[
      "Proficiency in Intimidation.",
      "Bonus action: frighten a weak enemy.",
      "Frightened enemies can't move closer to you.",
      "Enemies under half HP flee on a failed Wis save.",
      "Presence: in round 1, every enemy makes a Wis save or is frightened."
    ]),
    perk("insight","Insight","fa-solid fa-eye","social",["ins"],[
      "Proficiency in Insight.",
      "You know when someone is lying.",
      "You see hidden quest markers over NPCs.",
      "Once per fight, the GM tells you one enemy's next action.",
      "You can tell whether an NPC used to be a player."
    ]),
    perk("performance","Performance","fa-solid fa-music","social",["prf"],[
      "Proficiency in Performance and instruments.",
      "Bonus action: allies get +1 to hit while you play.",
      "You can open music locks and earn coin playing.",
      "Your music calms beasts.",
      "Anthem: once per fight, every ally has advantage for 1 round."
    ]),

    perk("medicine","Medicine","fa-solid fa-kit-medical","craft",["med"],[
      "Proficiency in Medicine. Potions you give heal +1.",
      "Stabilize someone as a bonus action.",
      "Potions you give heal + your rank.",
      "Cure poison, bleed and disease.",
      "Revive a Fading ally from 30 ft at 1d10 + your level HP."
    ]),
    perk("alchemy","Alchemy","fa-solid fa-flask","craft",[],[
      "Craft Potions for 30c.",
      "Craft poisons: a coated weapon deals +1d6.",
      "Craft bombs. Potions cost half.",
      "Craft Greater Potions and antidotes.",
      "Craft Heal Crystals."
    ]),
    perk("cooking","Cooking","fa-solid fa-utensils","craft",[],[
      "Your meals heal +1d6 on a short rest.",
      "Meals also give 5 temp HP.",
      "Meals give +1 to one kind of check for the day.",
      "Meals give advantage on one save.",
      "Feast: the party gains temp HP equal to your level and can't be frightened for a day."
    ]),
    perk("smithing","Smithing","fa-solid fa-fire","craft",[],[
      "Repair weapons and armor.",
      "Forge +1 weapons.",
      "Add elemental properties from materials.",
      "Forge +2 weapons.",
      "Forge +3 named weapons."
    ],2),
    perk("tailoring","Tailoring","fa-solid fa-shirt","craft",[],[
      "Repair armor.",
      "Make +1 light armor.",
      "Add resistances from monster hides.",
      "Make +2 armor.",
      "Make +3 armor and disguises."
    ],3),
    perk("appraisal","Appraisal","fa-solid fa-gem","craft",["arc"],[
      "Proficiency in Arcana. You see item stats.",
      "You spot cursed and fake items.",
      "You see enemy HP bars.",
      "You see enemy resistances and weaknesses.",
      "You see where a boss changes phase."
    ]),
    perk("fishing","Fishing","fa-solid fa-fish","craft",["nat"],[
      "Proficiency in Nature. Fish for food and coin.",
      "Catch rare fish for ingredients.",
      "Fish up items.",
      "Fish up a monster: a mini-fight with loot.",
      "Each floor has a legendary fish quest for you."
    ]),
    perk("taming","Taming","fa-solid fa-dragon","craft",["ani"],[
      "Proficiency in Animal Handling. Calm a beast.",
      "Tame a small pet that can take the Help action.",
      "Your pet fights, with its own stat block.",
      "Your pet evolves.",
      "Tame a large beast or a mount."
    ],4)
  ];

  const COMBOS = [
    {name:"Ghost Kill",a:"dagger",b:"hiding",text:"Attacking from hiding doesn't reveal you."},
    {name:"Spotter",a:"bow",b:"searching",text:"Ignore half cover; crit on 19-20."},
    {name:"Flow State",a:"martial",b:"evasion",text:"When an attack misses you, make a free unarmed hit."},
    {name:"Fortress",a:"shield",b:"parry",text:"Parry and Cover Ally both work on the same turn."},
    {name:"Duelist",a:"rapier",b:"evasion",text:"+2 AC against anyone you attacked this turn."},
    {name:"Cavalry",a:"spear",b:"sprint",text:"When you charge, your first hit deals double damage."},
    {name:"Executioner",a:["hammer","greatsword"],b:"intimidation",text:"When you kill an enemy, nearby enemies make a Wis save or are frightened."},
    {name:"Field Surgeon",a:"medicine",b:"alchemy",text:"Potions you give heal the maximum."},
    {name:"Five-Star",a:"cooking",b:"alchemy",text:"Your meals also give +1 AC for the day."},
    {name:"Master Key",a:"lockpicking",b:"smithing",text:"Craft a key for any lock you've seen."},
    {name:"Floor Sense",a:"cartography",b:"searching",text:"You know how many secrets are left on the floor."},
    {name:"Packmate",a:"taming",b:"tracking",text:"Your pet tracks perfectly and gets +2 to hit."},
    {name:"Crowd Work",a:"performance",b:"negotiation",text:"Talk your way into restricted areas while you perform."},
    {name:"Bait",a:"fishing",b:"taming",text:"Lure monsters into traps or ambushes."}
  ];

  // Talents: who you were before you jacked in. Free, fixed, never level.
  const TALENTS = [
    {key:"pattern",owner:"kevin",name:"Pattern Recognition",text:"Once per fight, ask the GM one question about an enemy's behavior and get a true answer."},
    {key:"calledit",owner:"kevin",name:"Called It",text:"Once per floor, get one meaningful hint about anything: a puzzle, a lie, a trap, the boss."},
    {key:"rideordie",owner:"kevin",name:"Ride or Die",text:"Take the Help action as a bonus action on an ally within 30 ft."},
    {key:"debater",owner:"andrei",name:"Dubious Debater",text:"Advantage on arguments, negotiations and haggling."},
    {key:"yourmom",owner:"andrei",name:"Your Mom",text:"Bonus action: insult an enemy so its next attack has disadvantage. You have to actually say the joke."},
    {key:"mcevilson",owner:"andrei",name:"Evil McEvilson",text:"Advantage on Intimidation against creatures with lower Intelligence than you."},
    {key:"brawler",owner:"evan",name:"Brawler",text:"Your unarmed hits deal real damage (d6 + Str) even without the Martial Arts skill."},
    {key:"mooscles",owner:"evan",name:"Mooscles",text:"Advantage on grapples, shoves and Athletics checks."},
    {key:"doggo",owner:"evan",name:"Doggo",text:"Advantage on Persuasion checks."},
    {key:"mentalmath",owner:"cara",name:"Mental Math",text:"Once per short rest, after seeing any ally's roll, add or subtract 2."},
    {key:"wiki",owner:"cara",name:"Walking Wiki",text:"Advantage on all lore and knowledge checks."},
    {key:"hotswap",owner:"cara",name:"Hot Swap",text:"Once per long rest, at any moment, even mid-fight, swap one slotted skill for another you know. It keeps its rank."},
    {key:"rt107",owner:"aiden",name:".107",text:"Always first in initiative."},
    {key:"clipthat",owner:"aiden",name:"Clip That",text:"Once per fight, declare an attack a critical hit before rolling."},
    {key:"selftaught",owner:"aiden",name:"Self-Taught",text:"Skills need about half the ticks to rank up. Once per floor, after watching someone use a skill well, gain a tick in it."}
  ];

  // Prefabs: the five people the players pick from.
  const PREFABS = [
    {key:"kevin",name:"Kevin",handle:"Agent Tangerine",abilities:{str:10,dex:11,con:10,int:17,wis:13,cha:9},skills:["spear","appraisal","searching"]},
    {key:"andrei",name:"Andrei",handle:"MF9900",abilities:{str:14,dex:10,con:11,int:17,wis:10,cha:16},skills:["sword","performance","hiding"]},
    {key:"evan",name:"Evan",handle:"Evballs",abilities:{str:14,dex:14,con:13,int:17,wis:11,cha:14},skills:["martial","shield","cooking"]},
    {key:"cara",name:"Cara",handle:"Human Personson",abilities:{str:8,dex:12,con:10,int:18,wis:13,cha:11},skills:["dagger","medicine","alchemy"]},
    {key:"aiden",name:"Aiden",handle:"",abilities:{str:10,dex:18,con:8,int:15,wis:16,cha:15},skills:["lockpicking"],free:["rapier","bow"]}
  ];

  const CATEGORIES = {
    weapon:"Weapon",
    support:"Combat Support",
    explore:"Exploration",
    social:"Social",
    craft:"Crafting & Life"
  };

  // Ticks needed to reach rank 2, 3, 4, 5.
  const TICKS = [3,5,8,12];
  const TICKS_SELF_TAUGHT = [2,3,4,6];

  const slotsAt = level => level >= 15 ? 8 : level >= 12 ? 7 : level >= 9 ? 6 : level >= 6 ? 5 : level >= 3 ? 4 : 3;
  const rankCapAt = level => level >= 12 ? 5 : level >= 9 ? 4 : level >= 6 ? 3 : level >= 3 ? 2 : 1;

  globalThis.ASCENT_CATALOG = {
    SKILLS,
    SKILL:Object.fromEntries(SKILLS.map(skill => [skill.key,skill])),
    COMBOS,
    TALENTS,
    PREFABS,
    CATEGORIES,
    TICKS,
    TICKS_SELF_TAUGHT,
    slotsAt,
    rankCapAt
  };
})();

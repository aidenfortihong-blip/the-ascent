// THE ASCENT // BOOTSTRAP
// The installed module is only this loader. On every client it fetches the
// live build from GitHub main, so pushing to main updates the table without
// reinstalling. game.ascent.reload() refetches it on the current client.

const MODULE = "the-ascent";
const BASE = "https://raw.githubusercontent.com/aidenfortihong-blip/the-ascent/main/";
const STYLES = ["styles/ascent.css"];
const SCRIPTS = ["scripts/catalog.js","scripts/ascent.js"];

async function fetchText(path) {
  const response = await fetch(BASE + path + "?t=" + Date.now(),{cache:"no-store"});
  if (!response.ok) throw new Error(path + " fetch failed: " + response.status);
  return response.text();
}

async function load() {
  const [styles,scripts] = await Promise.all([
    Promise.all(STYLES.map(fetchText)),
    Promise.all(SCRIPTS.map(fetchText))
  ]);

  // Check every script parses before swapping anything.
  scripts.forEach((source,i) => {
    try { new Function(source); } catch (error) {
      throw new Error(SCRIPTS[i] + " syntax error: " + error.message);
    }
  });

  await globalThis.ASCENT?.destroy?.();

  styles.forEach((css,i) => {
    const id = "asc-style-" + i;
    let node = document.getElementById(id);
    if (!node) {
      node = document.createElement("style");
      node.id = id;
      document.head.appendChild(node);
    }
    node.textContent = css;
  });

  scripts.forEach((source,i) => {
    (0,eval)(source + "\n//# sourceURL=" + MODULE + "/" + SCRIPTS[i]);
  });

  await globalThis.ASCENT?.init?.();
}

async function reload() {
  try {
    await load();
    console.info("THE ASCENT // loaded",globalThis.ASCENT?.version);
    return true;
  } catch (error) {
    console.error("THE ASCENT // load failed",error);
    ui.notifications?.error("The Ascent failed to load. Check the console.");
    return false;
  }
}

Hooks.once("init",() => {
  game.settings.register(MODULE,"floor",{
    name:"Current floor",
    hint:"Highest floor the party has reached. Locked skills open on their floor.",
    scope:"world",
    config:true,
    type:Number,
    default:1,
    onChange:() => globalThis.ASCENT?.refresh?.()
  });

  // Free-form world state the live build can use without a reinstall.
  game.settings.register(MODULE,"state",{
    scope:"world",
    config:false,
    type:Object,
    default:{},
    onChange:value => globalThis.ASCENT?.onState?.(value)
  });
});

Hooks.once("ready",() => {
  game.ascent = {reload};
  void reload();
});

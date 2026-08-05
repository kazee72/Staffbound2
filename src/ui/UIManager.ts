/**
 * DOM overlay UI — HUD, start/game-over overlays, and the Grimoire skill-tree
 * panel — layered over the Phaser canvas. Mirrors reference/full-reference.html's
 * DOM structure + CSS classes 1:1 (see src/ui/hud.css) but is built/managed
 * imperatively from TypeScript instead of static markup, so it can bind to
 * live World state each frame.
 */
import './hud.css';
import type { World } from '../game/types';
import { availableSP, buySkill, hasNode } from '../game/skillTree';
import { SKILL_NODES, NODE_BY_ID, BRANCHES, LOCAL } from '../game/skillTree';
import { maxHP } from '../game/player';
import { currentDay } from '../game/enemies';
import { PLACES } from '../game/waves';
import {
  META_UPGRADES,
  buyMetaRank,
  metaStateOf,
  getRunEssence,
} from '../game/metaProgression';

const GAME_OVER_FLAVORS = [
  'the road was long, but not long enough',
  'one more spell might have saved you',
  'the grimoire remembers, even if you cannot',
  'some doors should stay closed',
];

export class UIManager {
  root: HTMLDivElement;
  private flashEl: HTMLDivElement;
  private hpfill: HTMLDivElement;
  private hptext: HTMLSpanElement;
  private lvlTxt: HTMLElement;
  private xpfill2: HTMLDivElement;
  private dayline: HTMLDivElement;
  private slainTxt: HTMLElement;
  private dashTxt: HTMLElement;
  private aimTxt: HTMLElement;
  private spBadge: HTMLSpanElement;
  private grimoireBtn: HTMLButtonElement;
  private cooldownBar: HTMLDivElement;
  private bossBar: HTMLDivElement;
  private bossBarFill: HTMLDivElement;
  private cooldownSlots: Record<string, { container: HTMLDivElement; fill: HTMLDivElement; time: HTMLDivElement; label: string }>;

  private startOverlay: HTMLDivElement;
  private elementOverlay: HTMLDivElement;
  private startBtn: HTMLButtonElement;

  private gameOverOverlay: HTMLDivElement;
  private goFlavor: HTMLDivElement;
  private goDay: HTMLElement;
  private goSlain: HTMLElement;
  private goLvl: HTMLElement;
  private goEssence: HTMLElement;
  private goBankedVal: HTMLElement;
  private retryBtn: HTMLButtonElement;
  private metaGrimBtn: HTMLButtonElement;

  private grimoireOverlay: HTMLDivElement;
  private spAvail: HTMLSpanElement;
  private closeGrimBtn: HTMLButtonElement;
  private tooltip: HTMLDivElement;
  private staffSelectorEl: HTMLDivElement;
  private branchViewEl: HTMLDivElement;
  private currentBranch: string | null = null;

  private metaOverlay: HTMLDivElement;
  private metaEssenceTxt: HTMLSpanElement;
  private metaRunEssenceTxt: HTMLSpanElement;
  private closeMetaBtn: HTMLButtonElement;
  private metaRowsEl: HTMLDivElement;

  private abilityOverlay: HTMLDivElement;
  private abilityContinueBtn: HTMLButtonElement;

  onStart: () => void = () => {};
  onElementPick: (element: string) => void = () => {};
  onRetry: () => void = () => {};
  onToggleGrimoire: () => void = () => {};
  onOpenMetaGrimoire: () => void = () => {};
  /** When set, skill purchases go through this callback instead of the default buySkill(). */
  onBuySkill: ((nodeId: string) => void) | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'ui-root';
    container.appendChild(this.root);

    // vignette + flash banner
    const vignette = document.createElement('div');
    vignette.id = 'vignette';
    this.root.appendChild(vignette);

    this.flashEl = document.createElement('div');
    this.flashEl.id = 'flashEl';
    this.root.appendChild(this.flashEl);

    // HUD
    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.innerHTML = `
      <div class="hudleft">
        <div class="hudlabel">life</div>
        <div class="bar"><div class="barfill" id="hpfill" style="width:100%"></div></div>
        <div class="hudrow"><span id="hptext">100 / 100</span><span>lvl <b id="lvlTxt">1</b></span></div>
        <div class="bar" style="height:6px;"><div class="barfill" id="xpfill2" style="width:0%"></div></div>
        <div id="dayline">Day 1 &mdash; the fallen kingdom</div>
      </div>
      <div class="hudright">
        <button id="grimoireBtn">GRIMOIRE <span id="spBadge" style="display:none;">0</span></button>
        <div class="hudrow"><span>slain</span><b id="slainTxt" style="margin-left:6px;">0</b></div>
        <div id="dashind">dash <b id="dashTxt">ready</b></div>
        <div id="aimind">aim <b id="aimTxt">auto</b> (Q)</div>
      </div>
    `;
    this.root.appendChild(hud);
    this.hpfill = hud.querySelector('#hpfill')!;
    this.hptext = hud.querySelector('#hptext')!;
    this.lvlTxt = hud.querySelector('#lvlTxt')!;
    this.xpfill2 = hud.querySelector('#xpfill2')!;
    this.dayline = hud.querySelector('#dayline')!;
    this.slainTxt = hud.querySelector('#slainTxt')!;
    this.dashTxt = hud.querySelector('#dashTxt')!;
    this.aimTxt = hud.querySelector('#aimTxt')!;
    this.spBadge = hud.querySelector('#spBadge')!;
    this.grimoireBtn = hud.querySelector('#grimoireBtn')!;
    this.grimoireBtn.addEventListener('click', () => this.onToggleGrimoire());

    // Boss spawn progress bar (top-center of screen)
    this.bossBar = document.createElement('div');
    this.bossBar.id = 'bossBar';
    this.bossBar.innerHTML = `<div class="bossBarLabel">NEXT BOSS</div><div class="bossBarTrack"><div class="bossBarFill"></div></div>`;
    this.root.appendChild(this.bossBar);
    this.bossBarFill = this.bossBar.querySelector('.bossBarFill')!;

    // Skill cooldown bar (bottom-center of screen)
    this.cooldownBar = document.createElement('div');
    this.cooldownBar.id = 'cooldownBar';
    this.root.appendChild(this.cooldownBar);
    this.cooldownSlots = {};
    const spellDefs = [
      { id: 'bolt',         label: 'Bolt',     color: '#2f8fff' },
      { id: 'dash',         label: 'Dash',     color: '#c9a869' },
      { id: 'fireNova',     label: 'Nova',     color: '#e2793d' },
      { id: 'iceLance',     label: 'Lance',    color: '#8ec9e8' },
      { id: 'shadowBolt',   label: 'Shadow',   color: '#c4728f' },
      { id: 'arcaneBurst',  label: 'Burst',    color: '#c7bdf5' },
      { id: 'vines',        label: 'Vines',    color: '#8bc48a' },
      { id: 'frostArmor',   label: 'Armor',    color: '#8ec9e8' },
      { id: 'windGust',     label: 'Gust',     color: '#a8d4e8' },
      { id: 'vortex',       label: 'Vortex',   color: '#a8d4e8' },
      { id: 'cataclysm',    label: 'Tornado',  color: '#a8d4e8' },
      { id: 'stormCall',    label: 'Storm',    color: '#c4e842' },
      { id: 'thunderclap',  label: 'Clap',     color: '#c4e842' },
      { id: 'lightningStorm',label: 'L.Storm', color: '#c4e842' },
      { id: 'stormLord',    label: 'StormLord',color: '#c4e842' },
      { id: 'thunderStrike',label: 'T.Strike', color: '#c4e842' },
      { id: 'timeWarp',     label: 'Warp',     color: '#9d8ce0' },
      { id: 'overgrowth',   label: 'Growth',   color: '#8bc48a' },
      { id: 'shadowBlink',  label: 'Blink',    color: '#c4728f' },
      { id: 'eternalFrost', label: 'E.Frost',  color: '#8ec9e8' },
      { id: 'apexSurge',    label: 'Surge',    color: '#4fd6c0' },
      { id: 'arcaneExplosion',label: 'Explosion',color: '#c7bdf5' },
      { id: 'blizzard',     label: 'Blizzard', color: '#b8d8f0' },
      { id: 'earthquake',   label: 'Quake',    color: '#c9a869' },
      { id: 'sporeBurst',   label: 'Spores',   color: '#8bc48a' },
      { id: 'shadowNova',   label: 'Nova',     color: '#c4728f' },
      { id: 'whirlwindStrike',label: 'Whirl',  color: '#4fd6c0' },
      { id: 'magmaCore',    label: 'Magma',    color: '#e2793d' },
    ];
    spellDefs.forEach((sd) => {
      const slot = document.createElement('div');
      slot.className = 'cdSlot';
      slot.innerHTML = `<div class="cdIcon" style="border-color:${sd.color};color:${sd.color}">${sd.label}</div><div class="cdBar"><div class="cdFill" style="background:${sd.color}"></div></div><div class="cdTime"></div>`;
      slot.style.display = 'none'; // hidden until the skill is unlocked/active
      this.cooldownBar.appendChild(slot);
      this.cooldownSlots[sd.id] = {
        container: slot,
        fill: slot.querySelector('.cdFill')!,
        time: slot.querySelector('.cdTime')!,
        label: sd.label,
      };
    });

    // Start overlay
    this.startOverlay = document.createElement('div');
    this.startOverlay.className = 'overlay';
    this.startOverlay.id = 'startOverlay';
    this.startOverlay.innerHTML = `
      <div class="bigtitle">HOLLOWMERE</div>
      <div class="sub">a long road, an old grimoire, and whatever still lurks in the dark</div>
      <div style="font-size:12.5px;color:var(--dim);max-width:420px;line-height:1.6;">
        Move with <span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span> or arrow keys.
        Press <span class="key">Space</span> to dash through danger.
        Your spells cast themselves &mdash; survive, grow stronger, and open your <b style="color:var(--gold);">Grimoire</b> to shape how.
      </div>
      <button id="startBtn">BEGIN THE JOURNEY</button>
    `;
    this.root.appendChild(this.startOverlay);
    this.startBtn = this.startOverlay.querySelector('#startBtn')!;
    this.startBtn.addEventListener('click', () => this.onStart());

    // Element selection overlay
    this.elementOverlay = document.createElement('div');
    this.elementOverlay.className = 'overlay hidden';
    this.elementOverlay.id = 'elementOverlay';
    const elements = [
      { code: 'fire',      name: 'Fire',      color: '#e2793d', desc: 'Fire balls that burn enemies over time' },
      { code: 'ice',       name: 'Ice',       color: '#8ec9e8', desc: 'Ice shards that slow enemies on hit' },
      { code: 'void',      name: 'Void',      color: '#9d8ce0', desc: 'Void bolts with homing and pierce' },
      { code: 'shadow',    name: 'Shadow',    color: '#c4728f', desc: 'Shadow bolts that mark enemies for extra damage' },
      { code: 'nature',    name: 'Nature',    color: '#8bc48a', desc: 'Thorn spikes that pierce through enemies' },
      { code: 'holy',      name: 'Holy',      color: '#c9a869', desc: 'Holy light with AoE splash on hit' },
      { code: 'lightning', name: 'Lightning', color: '#c4e842', desc: 'Chain lightning that arcs between enemies' },
      { code: 'wind',      name: 'Wind',      color: '#a8d4e8', desc: 'Wind blades that knock back + leave wind trails' },
      { code: 'water',     name: 'Water',    color: '#4a9eff', desc: 'Water bolts that heal you on every hit' },
    ];
    this.elementOverlay.innerHTML = `
      <div class="bigtitle">CHOOSE YOUR ELEMENT</div>
      <div class="sub">Your auto-attack will be infused with this element</div>
      <div id="elementGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:600px;margin-top:16px;"></div>
    `;
    this.root.appendChild(this.elementOverlay);
    const grid = this.elementOverlay.querySelector('#elementGrid')!;
    for (const el of elements) {
      const btn = document.createElement('div');
      btn.style.cssText = `cursor:pointer;text-align:center;padding:14px 10px;border:2px solid ${el.color};border-radius:10px;background:var(--panel);transition:transform 0.12s,box-shadow 0.12s;`;
      btn.innerHTML = `
        <div style="font-family:Cinzel,serif;font-size:16px;color:${el.color};font-weight:700;letter-spacing:1px;">${el.name}</div>
        <div style="font-size:10px;color:var(--dim);margin-top:6px;line-height:1.4;">${el.desc}</div>
      `;
      btn.addEventListener('mouseenter', () => { btn.style.transform = 'scale(1.05)'; btn.style.boxShadow = `0 0 16px ${el.color}44`; });
      btn.addEventListener('mouseleave', () => { btn.style.transform = 'scale(1)'; btn.style.boxShadow = 'none'; });
      btn.addEventListener('click', () => this.onElementPick(el.code));
      grid.appendChild(btn);
    }

    // Game-over overlay
    this.gameOverOverlay = document.createElement('div');
    this.gameOverOverlay.className = 'overlay hidden';
    this.gameOverOverlay.id = 'gameOverOverlay';
    this.gameOverOverlay.innerHTML = `
      <div class="bigtitle" style="color:var(--hp);">YOUR JOURNEY ENDS HERE</div>
      <div class="sub" id="goFlavor">the road was long, but not long enough</div>
      <div id="goStats">
        <div><div class="v" id="goDay">1</div><div class="l">days survived</div></div>
        <div><div class="v" id="goSlain">0</div><div class="l">foes slain</div></div>
        <div><div class="v" id="goLvl">1</div><div class="l">level reached</div></div>
        <div><div class="v" id="goEssence" style="color:var(--gold-bright);">0</div><div class="l">essence earned</div></div>
      </div>
      <div id="goBanked" style="color:var(--gold);font-size:12px;margin-bottom:6px;">banked essence: <b id="goBankedVal">0</b></div>
      <div id="goBtnRow">
        <button id="retryBtn">WALK AGAIN</button>
        <button id="metaGrimBtn">META GRIMOIRE</button>
      </div>
    `;
    this.root.appendChild(this.gameOverOverlay);
    this.goFlavor = this.gameOverOverlay.querySelector('#goFlavor')!;
    this.goDay = this.gameOverOverlay.querySelector('#goDay')!;
    this.goSlain = this.gameOverOverlay.querySelector('#goSlain')!;
    this.goLvl = this.gameOverOverlay.querySelector('#goLvl')!;
    this.goEssence = this.gameOverOverlay.querySelector('#goEssence')!;
    this.goBankedVal = this.gameOverOverlay.querySelector('#goBankedVal')!;
    this.retryBtn = this.gameOverOverlay.querySelector('#retryBtn')!;
    this.retryBtn.addEventListener('click', () => this.onRetry());
    this.metaGrimBtn = this.gameOverOverlay.querySelector('#metaGrimBtn')!;
    this.metaGrimBtn.addEventListener('click', () => this.onOpenMetaGrimoire());

    // Grimoire overlay — staff selector + branch column view
    this.grimoireOverlay = document.createElement('div');
    this.grimoireOverlay.className = 'overlay hidden';
    this.grimoireOverlay.id = 'grimoireOverlay';
    this.grimoireOverlay.style.flexDirection = 'column';
    this.grimoireOverlay.innerHTML = `
      <div id="grimHeader">
        <div class="disp">THE GRIMOIRE</div>
        <div id="grimSP"><span id="spAvail">0</span> unspent skill points</div>
        <button id="closeGrim">CLOSE (G)</button>
      </div>
      <div id="grimStaffSelector">
        <div class="staff-pick-title">CHOOSE YOUR PATH</div>
        <div class="staff-row"></div>
      </div>
      <div id="branchView" style="display:none;"></div>
    `;
    this.root.appendChild(this.grimoireOverlay);
    this.staffSelectorEl = this.grimoireOverlay.querySelector('#grimStaffSelector')!;
    this.branchViewEl = this.grimoireOverlay.querySelector('#branchView')!;
    this.spAvail = this.grimoireOverlay.querySelector('#spAvail')!;
    this.closeGrimBtn = this.grimoireOverlay.querySelector('#closeGrim')!;
    this.closeGrimBtn.addEventListener('click', () => this.onToggleGrimoire());

    this.tooltip = document.createElement('div');
    this.tooltip.id = 'tooltip';
    this.root.appendChild(this.tooltip);

    // Meta Grimoire overlay — persistent upgrade panel (gold/amber theme).
    this.metaOverlay = document.createElement('div');
    this.metaOverlay.className = 'overlay hidden';
    this.metaOverlay.id = 'metaOverlay';
    this.metaOverlay.style.flexDirection = 'column';
    this.metaOverlay.innerHTML = `
      <div id="metaHeader">
        <div class="disp">META GRIMOIRE</div>
        <div id="metaEssenceLine">
          <span id="metaEssenceTxt">0</span> essence available
          <span id="metaRunEssenceTxt" style="display:none;color:var(--ember);margin-left:10px;"></span>
        </div>
        <button id="closeMeta">CLOSE</button>
      </div>
      <div id="metaBody">
        <div id="metaRows"></div>
      </div>
    `;
    this.root.appendChild(this.metaOverlay);
    this.metaEssenceTxt = this.metaOverlay.querySelector('#metaEssenceTxt')!;
    this.metaRunEssenceTxt = this.metaOverlay.querySelector('#metaRunEssenceTxt')!;
    this.closeMetaBtn = this.metaOverlay.querySelector('#closeMeta')!;
    this.metaRowsEl = this.metaOverlay.querySelector('#metaRows')!;
    this.closeMetaBtn.addEventListener('click', () => this.hideMetaGrimoire());

    // Ability unlock overlay — persistent purple/violet banner shown when a
    // boss is defeated and drops a new ability. Pauses the game until dismissed.
    this.abilityOverlay = document.createElement('div');
    this.abilityOverlay.className = 'overlay hidden';
    this.abilityOverlay.id = 'abilityOverlay';
    this.abilityOverlay.style.zIndex = '28';
    this.abilityOverlay.innerHTML = `
      <div class="ability-title">NEW ABILITY UNLOCKED</div>
      <div class="ability-name" id="abilityName"></div>
      <div class="ability-boss" id="abilityBoss"></div>
      <div class="ability-desc" id="abilityDesc"></div>
      <button id="abilityContinueBtn" class="ability-continue">CONTINUE</button>
    `;
    this.root.appendChild(this.abilityOverlay);
    this.abilityContinueBtn = this.abilityOverlay.querySelector('#abilityContinueBtn')!;
    // Click anywhere on the overlay or the button to dismiss.
    this.abilityOverlay.addEventListener('click', () => this.hideAbilityUnlock());
    this.abilityContinueBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideAbilityUnlock();
    });

    const footnote = document.createElement('div');
    footnote.id = 'footnote';
    footnote.textContent = 'a session-only tale — no record of this journey is kept once the page is closed';
    this.root.appendChild(footnote);

  }

  flash(text: string, color: string): void {
    // color may be a CSS var() token (matches reference) or a literal color
    this.flashEl.textContent = text;
    this.flashEl.style.color = color;
    this.flashEl.style.textShadow = '0 0 24px currentColor, 0 0 46px currentColor';
    this.flashEl.style.transition = 'none';
    this.flashEl.style.opacity = '1';
    requestAnimationFrame(() => {
      this.flashEl.style.transition = 'opacity 1.3s ease';
      this.flashEl.style.opacity = '0';
    });
  }

  showStart(): void {
    this.startOverlay.classList.remove('hidden');
    this.gameOverOverlay.classList.add('hidden');
  }

  hideStart(): void {
    this.startOverlay.classList.add('hidden');
  }

  showElementSelect(): void {
    this.elementOverlay.classList.remove('hidden');
  }

  hideElementSelect(): void {
    this.elementOverlay.classList.add('hidden');
  }

  showGameOver(world: World): void {
    this.currentWorld = world;
    this.goDay.textContent = String(currentDay(world));
    this.goSlain.textContent = String(world.slain);
    this.goLvl.textContent = String(world.level);
    const runEssence = getRunEssence(world);
    this.goEssence.textContent = String(runEssence);
    const meta = metaStateOf(world);
    // Show what will be banked (run essence added to existing banked total).
    this.goBankedVal.textContent = String(meta.essence + runEssence);
    this.goFlavor.textContent = GAME_OVER_FLAVORS[(Math.random() * GAME_OVER_FLAVORS.length) | 0];
    this.gameOverOverlay.classList.remove('hidden');
  }

  hideGameOver(): void {
    this.gameOverOverlay.classList.add('hidden');
  }

  /** Show the Meta Grimoire panel (called from game-over screen). Renders the upgrade rows. */
  showMetaGrimoire(world: World): void {
    this.currentWorld = world;
    this.renderMetaTree(world);
    this.metaOverlay.classList.remove('hidden');
  }

  hideMetaGrimoire(): void {
    this.metaOverlay.classList.add('hidden');
  }

  /** Show the persistent ability-unlock overlay (pauses game until dismissed). */
  showAbilityUnlock(world: World): void {
    const info = world.pendingAbilityDisplay;
    if (!info) return;
    this.abilityOverlay.querySelector('#abilityName')!.textContent = info.abilityName;
    this.abilityOverlay.querySelector('#abilityBoss')!.textContent = 'Dropped by ' + info.bossName;
    this.abilityOverlay.querySelector('#abilityDesc')!.textContent = info.desc;
    this.abilityOverlay.classList.remove('hidden');
  }

  /** Dismiss the ability-unlock overlay and resume the game. */
  hideAbilityUnlock(): void {
    if (this.abilityOverlay.classList.contains('hidden')) return;
    this.abilityOverlay.classList.add('hidden');
    if (this.currentWorld) {
      this.currentWorld.grimoireOpen = false; // unpause
    }
  }

  /** Render the meta upgrade rows from the world's attached meta state. */
  renderMetaTree(world: World): void {
    const meta = metaStateOf(world);
    this.metaEssenceTxt.textContent = String(meta.essence);
    const runEssence = getRunEssence(world);
    if (runEssence > 0) {
      this.metaRunEssenceTxt.style.display = 'inline';
      this.metaRunEssenceTxt.textContent = '(+' + runEssence + ' pending from this run)';
    } else {
      this.metaRunEssenceTxt.style.display = 'none';
    }
    let html = '';
    META_UPGRADES.forEach((def) => {
      const rank = meta.ranks[def.id] || 0;
      const maxed = rank >= def.maxRank;
      const cost = maxed ? 0 : def.costAt(rank + 1);
      const afford = !maxed && meta.essence >= cost;
      const rankDots = Array.from({ length: def.maxRank }, (_, i) =>
        i < rank ? '<span class="metadot on"></span>' : '<span class="metadot"></span>',
      ).join('');
      html += `
        <div class="metarow${maxed ? ' maxed' : ''}" data-id="${def.id}">
          <div class="metainfo">
            <div class="metaname">${def.name}</div>
            <div class="metadesc">${def.desc}</div>
            <div class="metaranks">${rankDots} <span class="metaranktxt">rank ${rank}/${def.maxRank}</span></div>
          </div>
          <div class="metabuy">
            ${maxed
              ? '<span class="metamaxed">MAX</span>'
              : `<button class="metabuybtn${afford ? '' : ' disabled'}" data-id="${def.id}" ${afford ? '' : 'disabled'}>${cost} essence</button>`}
          </div>
        </div>
      `;
    });
    this.metaRowsEl.innerHTML = html;
    // Wire up buy buttons.
    this.metaRowsEl.querySelectorAll<HTMLButtonElement>('.metabuybtn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id')!;
        if (buyMetaRank(world, id)) {
          this.renderMetaTree(world);
          // Refresh game-over essence display too.
          const m = metaStateOf(world);
          this.goBankedVal.textContent = String(m.essence);
        }
      });
    });

  }

  setGrimoireVisible(open: boolean): void {
    this.grimoireOverlay.classList.toggle('hidden', !open);
    if (open) {
      this.currentBranch = null;
      this.renderStaffSelector(this.currentWorld!);
    }
  }

  private currentWorld: World | null = null;

  updateHUD(world: World): void {
    this.currentWorld = world;
    const p = world.player;
    const mhp = maxHP(world);
    this.hpfill.style.width = Math.max(0, (p.hp / mhp) * 100) + '%';
    this.hptext.textContent = Math.max(0, Math.round(p.hp)) + ' / ' + Math.round(mhp);
    this.lvlTxt.textContent = String(world.level);
    this.xpfill2.style.width = (world.xp / world.xpNext) * 100 + '%';
    this.dayline.textContent = 'Day ' + currentDay(world) + ' — ' + PLACES[(currentDay(world) - 1) % PLACES.length];
    this.slainTxt.textContent = String(world.slain);
    this.dashTxt.textContent = p.dashCd > 0 ? p.dashCd.toFixed(1) + 's' : 'ready';
    this.aimTxt.textContent = world.autoAim ? 'auto' : 'mouse';
    this.aimTxt.style.color = world.autoAim ? 'var(--frost)' : 'var(--gold)';

    // Boss spawn progress bar: fills as bossTimer counts down.
    if (world.bossFight) {
      this.bossBar.style.display = 'none';
    } else {
      this.bossBar.style.display = 'flex';
      const bossMaxTimer = 130;
      const progress = Math.max(0, Math.min(1, 1 - world.bossTimer / bossMaxTimer));
      this.bossBarFill.style.width = (progress * 100) + '%';
      if (progress >= 0.85) {
        this.bossBarFill.style.background = 'var(--umbral)';
        this.bossBarFill.style.boxShadow = '0 0 8px var(--umbral)';
      } else {
        this.bossBarFill.style.background = 'var(--gold)';
        this.bossBarFill.style.boxShadow = 'none';
      }
    }
    const sp = availableSP(world);
    this.spBadge.style.display = sp > 0 ? 'flex' : 'none';
    this.spBadge.textContent = String(sp);

    // Skill cooldown bar: show each unlocked skill's cooldown progress.
    this.updateCooldown('bolt', world.cd.bolt, 0.55 * (1 - (hasNode(world.purchased, 'V_A') ? 0.2 : 0)) * (1 - (hasNode(world.purchased, 'V_E2') ? 0.2 : 0)), true);
    this.updateCooldown('dash', p.dashCd, 3.4, true);
    this.updateCooldown('fireNova', world.cd.fireNova, 6, hasNode(world.purchased, 'F_B'));
    this.updateCooldown('iceLance', world.cd.iceLance, 5, hasNode(world.purchased, 'R_B'));
    this.updateCooldown('shadowBolt', world.cd.shadowBolt, 4, hasNode(world.purchased, 'S_B'));
    this.updateCooldown('arcaneBurst', world.cd.arcaneBurst, 8, hasNode(world.purchased, 'V_E1'));
    this.updateCooldown('vines', world.cd.vines, 10, hasNode(world.purchased, 'N_B'));
    this.updateCooldown('frostArmor', world.cd.frostArmor, 14, hasNode(world.purchased, 'R_E2'));
    // Lightning branch
    this.updateCooldown('stormCall', world.cd.stormCall, 4, hasNode(world.purchased, 'T_C1'));
    this.updateCooldown('thunderclap', world.cd.thunderclap, 3, hasNode(world.purchased, 'T_B'));
    this.updateCooldown('lightningStorm', world.cd.lightningStorm, 8, hasNode(world.purchased, 'T_E1'));
    this.updateCooldown('stormLord', world.cd.stormLord, 10, hasNode(world.purchased, 'T_I'));
    this.updateCooldown('thunderStrike', world.cd.thunderStrike, 5, hasNode(world.purchased, 'T_L'));
    // Wind branch
    this.updateCooldown('windGust', world.cd.windGust, 4, hasNode(world.purchased, 'W_B'));
    this.updateCooldown('vortex', world.cd.vortex, 6, hasNode(world.purchased, 'W_D'));
    this.updateCooldown('cataclysm', world.cd.cataclysm, 12, hasNode(world.purchased, 'W_F'));
    // Special abilities (from other skill nodes)
    this.updateCooldown('timeWarp', world.cd.timeWarp, 20, hasNode(world.purchased, 'V_I'));
    this.updateCooldown('overgrowth', world.cd.overgrowth, 12, hasNode(world.purchased, 'N_F'));
    this.updateCooldown('shadowBlink', world.cd.shadowBlink, 15, hasNode(world.purchased, 'S_I'));
    this.updateCooldown('eternalFrost', world.cd.eternalFrost, 25, hasNode(world.purchased, 'R_I'));
    this.updateCooldown('apexSurge', world.cd.apexSurge, 15, hasNode(world.purchased, 'P_I'));
    this.updateCooldown('arcaneExplosion', world.cd.arcaneExplosion, 8, hasNode(world.purchased, 'V_L'));
    this.updateCooldown('blizzard', world.cd.blizzard, 20, hasNode(world.purchased, 'R_L'));
    this.updateCooldown('earthquake', world.cd.earthquake, 15, hasNode(world.purchased, 'B_L'));
    this.updateCooldown('sporeBurst', world.cd.sporeBurst, 10, hasNode(world.purchased, 'N_L'));
    this.updateCooldown('shadowNova', world.cd.shadowNova, 12, hasNode(world.purchased, 'S_L'));
    this.updateCooldown('whirlwindStrike', world.cd.whirlwindStrike, 8, hasNode(world.purchased, 'P_L'));
    this.updateCooldown('magmaCore', world.cd.magmaCore, 8, true); // boss ability, always active if unlocked
  }

  private updateCooldown(id: string, cd: number, maxCd: number, visible: boolean): void {
    const slot = this.cooldownSlots[id];
    if (!slot) return;
    slot.container.style.display = visible ? 'flex' : 'none';
    if (!visible) return;
    if (cd <= 0) {
      slot.fill.style.width = '100%';
      slot.fill.style.opacity = '0.25';
      slot.time.textContent = '';
    } else {
      slot.fill.style.width = Math.max(0, (1 - cd / maxCd) * 100) + '%';
      slot.fill.style.opacity = '1';
      slot.time.textContent = cd.toFixed(1);
    }
  }

  /** Render the staff selector — one staff per branch, flying in with animation. */
  renderStaffSelector(world: World): void {
    this.currentWorld = world;
    this.currentBranch = null;
    this.staffSelectorEl.style.display = 'flex';
    this.branchViewEl.style.display = 'none';
    const row = this.staffSelectorEl.querySelector('.staff-row') as HTMLDivElement;
    row.innerHTML = '';
    BRANCHES.forEach((br, i) => {
      const pick = document.createElement('div');
      pick.className = 'staff-pick';
      pick.style.color = br.color;
      pick.style.animationDelay = (i * 0.06) + 's';
      // Use the actual staff GIF as the icon, tinted via CSS filter
      pick.innerHTML = `
        <img class="staff-gif" src="assets/icons/staff.gif" alt="${br.name}"
             style="filter: hue-rotate(${this.hueRotateFor(br.color)}deg) saturate(1.4) drop-shadow(0 0 10px ${br.color});" />
        <div class="staff-label">${br.name}</div>
      `;
      pick.addEventListener('click', () => this.renderBranchColumn(world, br.code));
      row.appendChild(pick);
    });
    this.spAvail.textContent = String(availableSP(world));
  }

  /** Approximate hue-rotate to match a target branch color. */
  private hueRotateFor(color: string): number {
    // Simple mapping by branch code since we know the colors
    const map: Record<string, number> = {
      '#e2793d': 0,    // Ember — orange (no rotation needed, staff is already warm)
      '#8ec9e8': 200,  // Rime — blue
      '#9d8ce0': 250,  // Void — purple
      '#c4728f': 320,  // Umbral — pink
      '#8bc48a': 100,  // Verdant — green
      '#c9a869': 40,   // Warden — gold
      '#4fd6c0': 160,  // Potency — teal
    };
    return map[color] ?? 0;
  }

  /** Render a single branch as a radial layout with the staff GIF at center. */
  renderBranchColumn(world: World, branchCode: string): void {
    this.currentWorld = world;
    this.currentBranch = branchCode;
    this.staffSelectorEl.style.display = 'none';
    this.branchViewEl.style.display = 'flex';

    const br = BRANCHES.find((b) => b.code === branchCode)!;
    const branchNodes = SKILL_NODES.filter((n) => n.branch === branchCode);

    // Use a local radial layout: the staff is at the center, nodes radiate
    // outward in all directions like the big radial tree, but only for this
    // one branch. We re-project each node's angular offset from the branch
    // base angle into a local coordinate system centered on the staff.

    // Use a smaller set of radii scaled for the single-branch view
    const LOCAL_RADII = [60, 110, 165, 225, 290, 360, 430];
    const TIER_HEIGHT = 0; // not used, radial instead

    // The branch base angle is where tier-0 sits. We want nodes to spread
    // in all directions from center, so we use the node's angular offset
    // as the angle and the tier as the radius.
    const positions: Record<string, { x: number; y: number }> = {};
    branchNodes.forEach((n) => {
      const idPart = n.id.split('_')[1];
      const localDef = LOCAL.find((l) => l.id === idPart);
      const voidExtra = branchCode === 'V' && idPart === 'X'
        ? { off: 20, radius: undefined as number | undefined }
        : null;
      const off = (voidExtra ?? localDef)?.off ?? 0;
      const radiusOverride = (voidExtra ?? localDef)?.radius;
      const tier = n.tier;
      const r = radiusOverride ? radiusOverride * 0.42 : LOCAL_RADII[tier] ?? 430;

      // Spread nodes in a circle around the staff. Use the angular offset
      // as the angle, and for main-column nodes (off=0), stack them going
      // upward (north). Side nodes branch off at their offset angles.
      // To make it look like a radial branch, we map off=0 to angle=-90°
      // (straight up) and spread side nodes relative to that.
      const angleDeg = -90 + off * 1.8; // scale offset for wider spread
      const angleRad = (angleDeg * Math.PI) / 180;

      positions[n.id] = {
        x: Math.cos(angleRad) * r,
        y: Math.sin(angleRad) * r,
      };
    });

    // Canvas size: needs to fit the largest radius + node size + padding
    const maxR = Math.max(...Object.values(positions).map((p) => Math.hypot(p.x, p.y)));
    const canvasSize = Math.ceil(maxR * 2 + 120);
    const center = canvasSize / 2;

    // Build SVG connectors (curved lines from parent to child)
    let svgLines = '';
    branchNodes.forEach((n) => {
      n.pre.forEach((preId) => {
        const pre = positions[preId];
        const cur = positions[n.id];
        if (!pre || !cur) return;
        const lit = hasNode(world.purchased, preId);
        const x1 = center + pre.x;
        const y1 = center + pre.y;
        const x2 = center + cur.x;
        const y2 = center + cur.y;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const color = lit ? br.color : '#3a3d5c';
        svgLines += `<path d="M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}" stroke="${color}" stroke-width="${lit ? 3 : 1.5}" fill="none" opacity="${lit ? 0.8 : 0.35}" />`;
      });
    });

    // Build the HTML
    let html = `
      <div class="branch-view-header">
        <div class="branch-title" style="color:${br.color};text-shadow:0 0 16px ${br.color};">${br.name}</div>
      </div>
      <div class="branch-canvas" style="width:${canvasSize}px;height:${canvasSize}px;position:relative;margin:0 auto;">
        <svg class="branch-svg" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;">
          ${svgLines}
        </svg>
    `;

    // Staff GIF at center (back button)
    html += `
      <div class="branch-staff-btn" style="position:absolute;left:${center - 28}px;top:${center - 28}px;width:56px;height:56px;cursor:pointer;z-index:5;">
        <img src="assets/icons/staff.gif" alt="Back"
             style="width:56px;height:56px;filter:hue-rotate(${this.hueRotateFor(br.color)}deg) saturate(1.4) drop-shadow(0 0 12px ${br.color});" />
      </div>
    `;

    // Nodes as square boxes at their radial positions
    branchNodes.forEach((n) => {
      const pos = positions[n.id];
      const x = center + pos.x;
      const y = center + pos.y;
      html += this.nodeBoxHTML(n, world, x, y);
    });

    html += '</div>';
    this.branchViewEl.innerHTML = html;

    // Wire up staff back button
    const backBtn = this.branchViewEl.querySelector('.branch-staff-btn') as HTMLDivElement;
    backBtn.addEventListener('click', () => this.renderStaffSelector(world));

    // Wire up node clicks + tooltips
    this.branchViewEl.querySelectorAll<HTMLDivElement>('.gem-node').forEach((div) => {
      const id = div.getAttribute('data-id')!;
      const node = NODE_BY_ID[id];
      const bought = hasNode(world.purchased, id);
      const preOk = node.pre.every((p) => hasNode(world.purchased, p));
      div.addEventListener('click', () => {
        if (preOk && !bought) {
          if (this.onBuySkill) {
            this.onBuySkill(id);
          } else {
            buySkill(world, id);
          }
          this.renderBranchColumn(world, branchCode);
        }
      });
      div.addEventListener('mouseenter', (e) => this.showTip(e as MouseEvent, world, id, bought, preOk));
      div.addEventListener('mousemove', (e) => this.positionTip(e as MouseEvent));
      div.addEventListener('mouseleave', () => {
        this.tooltip.style.opacity = '0';
      });
    });

    this.spAvail.textContent = String(availableSP(world));
    void TIER_HEIGHT;
  }

  /** Generate HTML for a single square node at absolute position. */
  private nodeBoxHTML(n: typeof SKILL_NODES[0], world: World, x: number, y: number): string {
    const bought = hasNode(world.purchased, n.id);
    const preOk = n.pre.every((p) => hasNode(world.purchased, p));
    const afford = availableSP(world) >= n.cost;
    const cls = 'gem-node' + (n.capstone ? ' capstone' : '') + (bought ? ' bought' : !preOk ? ' locked' : afford ? ' affordable' : ' available');
    const label = n.name.split(' ')[0];
    const size = n.capstone ? 46 : 38;
    return `<div class="${cls} gem-box" data-id="${n.id}" style="color:${n.color};position:absolute;left:${x - size/2}px;top:${y - size/2}px;width:${size}px;height:${size}px;">
      <div class="gem-inner">${label}</div>
    </div>`;
  }

  /** Lightweight per-frame refresh of gem node states without rebuilding DOM. */
  updateNodeStates(world: World): void {
    if (this.currentBranch) {
      // Re-render the branch column to update connector colors + node states
      this.renderBranchColumn(world, this.currentBranch);
    } else {
      this.spAvail.textContent = String(availableSP(world));
    }
  }

  private showTip(e: MouseEvent, world: World, id: string, bought: boolean, preOk: boolean): void {
    const n = NODE_BY_ID[id];
    this.tooltip.innerHTML =
      `<div class="ttname" style="color:${n.color}">${n.name}${n.capstone ? ' — Capstone' : ''}</div><div class="ttdesc">${n.desc}</div>` +
      (bought
        ? '<div style="color:#8bc48a;font-weight:700;">unlocked</div>'
        : preOk
          ? `<div class="ttcost">${n.cost} skill point${n.cost > 1 ? 's' : ''}</div>`
          : '<div style="color:#c15b5b;">requires earlier nodes in this path</div>');
    this.tooltip.style.opacity = '1';
    this.positionTip(e);
    void world;
  }

  private positionTip(e: MouseEvent): void {
    this.tooltip.style.left = e.clientX + 16 + 'px';
    this.tooltip.style.top = e.clientY + 16 + 'px';
  }
}

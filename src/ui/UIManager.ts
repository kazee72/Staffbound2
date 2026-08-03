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
import { SKILL_NODES, NODE_BY_ID, BRANCHES } from '../game/skillTree';
import { maxHP } from '../game/player';
import { currentDay } from '../game/enemies';
import { PLACES } from '../game/waves';
import {
  META_UPGRADES,
  buyMetaRank,
  metaStateOf,
  getRunEssence,
  hasBossAbility,
} from '../game/metaProgression';
import { BOSS_ABILITIES } from '../game/stages';

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
      { id: 'bolt',       label: 'Bolt',    color: '#9d8ce0' },
      { id: 'fireNova',   label: 'Nova',    color: '#e2793d' },
      { id: 'iceLance',   label: 'Lance',   color: '#8ec9e8' },
      { id: 'shadowBolt', label: 'Shadow',  color: '#c4728f' },
      { id: 'arcaneBurst',label: 'Burst',   color: '#c7bdf5' },
      { id: 'vines',      label: 'Vines',   color: '#8bc48a' },
      { id: 'frostArmor', label: 'Armor',   color: '#8ec9e8' },
      { id: 'dash',       label: 'Dash',    color: '#c9a869' },
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

    // --- Boss Abilities section (purple/violet accent) ---
    const bossSection = document.createElement('div');
    bossSection.className = 'boss-ability-section';
    bossSection.innerHTML = '<div class="boss-ability-header">BOSS ABILITIES</div>';
    BOSS_ABILITIES.forEach((ability) => {
      const unlocked = hasBossAbility(world, ability.bossId);
      const row = document.createElement('div');
      row.className = 'boss-ability-row' + (unlocked ? ' unlocked' : ' locked');
      row.innerHTML = `
        <div class="boss-ability-info">
          <div class="boss-ability-name">${ability.abilityName}</div>
          <div class="boss-ability-boss">from ${ability.bossName}</div>
          <div class="boss-ability-desc">${ability.desc}</div>
        </div>
        <div class="boss-ability-status">
          ${unlocked
            ? '<span class="boss-ability-badge unlocked">✓ UNLOCKED</span>'
            : '<span class="boss-ability-badge locked">LOCKED</span>'}
        </div>
      `;
      bossSection.appendChild(row);
    });
    this.metaRowsEl.appendChild(bossSection);
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
      pick.innerHTML = `
        <div class="staff-orb"></div>
        <div class="staff-shaft"></div>
        <div class="staff-label">${br.name}</div>
      `;
      pick.addEventListener('click', () => this.renderBranchColumn(world, br.code));
      row.appendChild(pick);
    });
    this.spAvail.textContent = String(availableSP(world));
  }

  /** Render a single branch as a vertical column of gem nodes. */
  renderBranchColumn(world: World, branchCode: string): void {
    this.currentWorld = world;
    this.currentBranch = branchCode;
    this.staffSelectorEl.style.display = 'none';
    this.branchViewEl.style.display = 'flex';

    const br = BRANCHES.find((b) => b.code === branchCode)!;
    const branchNodes = SKILL_NODES.filter((n) => n.branch === branchCode).sort((a, b) => a.tier - b.tier);

    // Build ordered list: main column (A,B,G,D,E1/E2,F,I) + side nodes (C1,C2,H,J,K) near their prereqs.
    // We lay out vertically by tier; side nodes appear as small branches to the side.
    const mainColumn = branchNodes.filter((n) => {
      const id = n.id.split('_')[1];
      return ['A', 'B', 'G', 'D', 'E1', 'E2', 'F', 'I'].includes(id);
    });
    const sideNodes = branchNodes.filter((n) => {
      const id = n.id.split('_')[1];
      return ['C1', 'C2', 'H', 'J', 'K', 'X'].includes(id);
    });

    let html = `
      <div class="branch-view-header">
        <button class="branch-back">&larr; ALL PATHS</button>
        <div class="branch-title" style="color:${br.color};text-shadow:0 0 16px ${br.color};">${br.name}</div>
      </div>
      <div class="branch-column">
    `;

    // Render main column with connectors, interleaving side nodes at appropriate tiers.
    // For simplicity, render main column top to bottom, then add side nodes as a second column to the right.
    // Actually, let's do a simpler layout: main column vertical, side nodes shown inline after their prerequisite tier.
    
    // Build a tier map for side nodes
    const sideByTier: Record<number, typeof sideNodes> = {};
    sideNodes.forEach((n) => {
      const t = n.tier;
      if (!sideByTier[t]) sideByTier[t] = [];
      sideByTier[t].push(n);
    });

    mainColumn.forEach((n, idx) => {
      // connector before node (except first)
      if (idx > 0) {
        const prev = mainColumn[idx - 1];
        const lit = hasNode(world.purchased, prev.id);
        html += `<div class="branch-connector${lit ? ' lit' : ''}" style="color:${prev.color};background:${lit ? prev.color : 'var(--line)'};"></div>`;
      }
      html += this.gemNodeHTML(n, world);
      // Add side nodes for this tier after the main node
      const sides = sideByTier[n.tier] || [];
      sides.forEach((sn) => {
        // connector to side node
        const prereqBought = hasNode(world.purchased, n.id);
        html += `<div class="branch-connector${prereqBought ? ' lit' : ''}" style="color:${sn.color};background:${prereqBought ? sn.color : 'var(--line)'};"></div>`;
        html += this.gemNodeHTML(sn, world);
      });
    });

    html += '</div>';
    this.branchViewEl.innerHTML = html;

    // Wire up back button
    const backBtn = this.branchViewEl.querySelector('.branch-back') as HTMLButtonElement;
    backBtn.addEventListener('click', () => this.renderStaffSelector(world));

    // Wire up gem node clicks + tooltips
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
  }

  /** Generate HTML for a single gem node. */
  private gemNodeHTML(n: typeof SKILL_NODES[0], world: World): string {
    const bought = hasNode(world.purchased, n.id);
    const preOk = n.pre.every((p) => hasNode(world.purchased, p));
    const afford = availableSP(world) >= n.cost;
    const cls = 'gem-node' + (n.capstone ? ' capstone' : '') + (bought ? ' bought' : !preOk ? ' locked' : afford ? ' affordable' : ' available');
    const label = n.name.split(' ')[0]; // first word as short label
    return `<div class="${cls}" data-id="${n.id}" style="color:${n.color};">
      <div class="gem-shape"></div>
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

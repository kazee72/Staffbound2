/**
 * DOM overlay UI — HUD, start/game-over overlays, and the Grimoire skill-tree
 * panel — layered over the Phaser canvas. Mirrors reference/full-reference.html's
 * DOM structure + CSS classes 1:1 (see src/ui/hud.css) but is built/managed
 * imperatively from TypeScript instead of static markup, so it can bind to
 * live World state each frame.
 */
import './hud.css';
import type { World } from '../game/types';
import { availableSP, buySkill, hasNode, nodeIcon } from '../game/skillTree';
import { SKILL_NODES, NODE_BY_ID, BRANCHES, CX, CY, TREE_W, TREE_H, RADII, radialPath } from '../game/skillTree';
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
  private treeSVG: SVGSVGElement;
  private treeInner: HTMLDivElement;
  private spAvail: HTMLSpanElement;
  private closeGrimBtn: HTMLButtonElement;
  private tooltip: HTMLDivElement;

  private metaOverlay: HTMLDivElement;
  private metaEssenceTxt: HTMLSpanElement;
  private metaRunEssenceTxt: HTMLSpanElement;
  private closeMetaBtn: HTMLButtonElement;
  private metaRowsEl: HTMLDivElement;

  private nodeDivs = new Map<string, HTMLDivElement>();

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

    // Grimoire overlay
    this.grimoireOverlay = document.createElement('div');
    this.grimoireOverlay.className = 'overlay hidden';
    this.grimoireOverlay.id = 'grimoireOverlay';
    this.grimoireOverlay.style.flexDirection = 'column';
    this.grimoireOverlay.innerHTML = `
      <div id="grimHeader">
        <div class="disp">THE GRIMOIRE</div>
        <div id="grimSP"><span id="spAvail">0</span> unspent skill points</div>
        <button id="closeGrim">CLOSE &nbsp;(G)</button>
      </div>
      <div id="treewrap">
        <div id="treeinner">
          <svg id="treeSVG"></svg>
          <div class="core">YOUR<br>PATH</div>
        </div>
      </div>
    `;
    this.root.appendChild(this.grimoireOverlay);
    this.treeSVG = this.grimoireOverlay.querySelector('#treeSVG')!;
    this.treeInner = this.grimoireOverlay.querySelector('#treeinner')!;
    // Size the tree container to the radial layout and place the hub core at CX/CY.
    this.treeInner.style.width = TREE_W + 'px';
    this.treeInner.style.height = TREE_H + 'px';
    const coreEl = this.grimoireOverlay.querySelector('.core') as HTMLDivElement | null;
    if (coreEl) {
      coreEl.style.left = CX + 'px';
      coreEl.style.top = CY + 'px';
    }
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

    const footnote = document.createElement('div');
    footnote.id = 'footnote';
    footnote.textContent = 'a session-only tale — no record of this journey is kept once the page is closed';
    this.root.appendChild(footnote);

    // Branch labels (static, drawn once) — placed radially just beyond the
    // outermost tier of each branch, at the branch's base angle.
    BRANCHES.forEach((br) => {
      const labelR = RADII[6] + 50; // just beyond the outermost tier
      const ang = (br.angle * Math.PI) / 180;
      const lx = CX + Math.cos(ang) * labelR;
      const ly = CY + Math.sin(ang) * labelR;
      const lab = document.createElement('div');
      lab.className = 'branchlabel';
      lab.style.left = lx + 'px';
      lab.style.top = ly + 'px';
      lab.style.transform = 'translate(-50%,-50%)';
      lab.style.color = br.color;
      lab.textContent = br.name;
      this.treeInner.appendChild(lab);
    });
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
    if (open) this.renderTree(this.currentWorld!);
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

  /** Full (re)render of the skill tree — connectors + node divs + labels. Called when opening the Grimoire or after a purchase. */
  renderTree(world: World): void {
    this.currentWorld = world;
    let lines = '';
    SKILL_NODES.forEach((n) => {
      n.pre.forEach((p) => {
        const pn = NODE_BY_ID[p];
        const lit = hasNode(world.purchased, p);
        const d = radialPath(pn.x, pn.y, n.x, n.y);
        lines += `<path d="${d}" style="stroke:${lit ? n.color : '#333a5c'};fill:none"${lit ? ' class="lit"' : ''}></path>`;
      });
      if (n.tier === 0) {
        // Radial spoke from the hub center to each branch's first node.
        lines += `<path class="spoke" d="M ${CX} ${CY} L ${n.x} ${n.y}"></path>`;
      }
    });
    this.treeSVG.innerHTML = lines;

    this.nodeDivs.forEach((div) => div.remove());
    this.nodeDivs.clear();

    SKILL_NODES.forEach((n) => {
      const bought = hasNode(world.purchased, n.id);
      const preOk = n.pre.every((p) => hasNode(world.purchased, p));
      const afford = availableSP(world) >= n.cost;
      const div = document.createElement('div');
      div.className =
        'node' + (n.capstone ? ' capstone' : '') + (bought ? ' bought' : !preOk ? ' locked' : afford ? ' affordable' : ' available');
      div.style.left = n.x + 'px';
      div.style.top = n.y + 'px';
      div.style.borderColor = bought || afford ? n.color : 'var(--line)';
      if (bought) {
        div.style.background = n.color;
        div.style.boxShadow = '0 0 16px ' + n.color;
      }
      // Show icon when unbought, checkmark when bought.
      div.textContent = bought ? '✓' : nodeIcon(n);
      div.addEventListener('click', () => {
        if (preOk && !bought) {
          if (this.onBuySkill) {
            this.onBuySkill(n.id);
          } else {
            buySkill(world, n.id);
          }
          this.renderTree(world);
        }
      });
      div.addEventListener('mouseenter', (e) => this.showTip(e as MouseEvent, world, n.id, bought, preOk));
      div.addEventListener('mousemove', (e) => this.positionTip(e as MouseEvent));
      div.addEventListener('mouseleave', () => {
        this.tooltip.style.opacity = '0';
      });
      this.treeInner.appendChild(div);
      this.nodeDivs.set(n.id, div);
    });
    this.spAvail.textContent = String(availableSP(world));
  }

  /** Lightweight per-frame refresh (locked/affordable/bought classes only) without rebuilding the whole DOM tree. */
  updateNodeStates(world: World): void {
    SKILL_NODES.forEach((n) => {
      const div = this.nodeDivs.get(n.id);
      if (!div) return;
      const bought = hasNode(world.purchased, n.id);
      const preOk = n.pre.every((p) => hasNode(world.purchased, p));
      const afford = availableSP(world) >= n.cost;
      div.className =
        'node' + (n.capstone ? ' capstone' : '') + (bought ? ' bought' : !preOk ? ' locked' : afford ? ' affordable' : ' available');
    });
    this.spAvail.textContent = String(availableSP(world));
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

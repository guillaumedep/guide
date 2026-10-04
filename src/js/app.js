import { CATS, norm, scaleItem } from './scale.js';

/* ---------- État ---------- */
const app = document.getElementById('app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Mémorisé sur l'appareil (cases cochées, nombre de personnes). Même clés que le prototype.
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};
const state = { cat: 'all', q: '' };
let RECIPES = [];
let current = null;

const plural = (n, s, p) => n > 1 ? p : s;
const catOf = id => CATS.find(c => c.id === id) || { id, label: id, emoji: '🍽️' };

// Vignette : image compressée si elle existe, sinon emoji sur fond décoré.
// data-fb : en cas d'échec de chargement, on revient à l'emoji (voir écouteur 'error').
const tile = (r, cls) => `<span class="${cls} tile" aria-hidden="true">${r.emoji || '🍽️'}</span>`;
const thumb = r => r.thumb
  ? `<span class="thumb"><img src="${esc(r.thumb)}" alt="" width="72" height="72" loading="lazy" decoding="async" data-fb="thumb" data-emoji="${esc(r.emoji || '')}"></span>`
  : tile(r, 'thumb');
const heroTile = r => `<div class="hero tile"><span class="plate" aria-hidden="true">${r.emoji || '🍽️'}</span><span class="cap"><span>Le visuel s’affichera ici</span></span></div>`;

/* ---------- Accueil ---------- */
function renderHome() {
  document.title = 'Mes recettes';
  const n = RECIPES.length;
  app.innerHTML = `
    <header class="top">
      <h1>Mes recettes</h1>
      <p class="sub">${n} recette${plural(n, '', 's')} au sommaire</p>
      <label class="search"><span class="sr">Rechercher une recette</span>
        <input id="q" type="search" placeholder="Rechercher un plat, un ingrédient" autocomplete="off" enterkeyhint="search"></label>
    </header>
    <nav class="chips" id="chips" aria-label="Thèmes"></nav>
    <main id="list"></main>`;
  document.getElementById('q').value = state.q;
  updateHome();
}

function updateHome() {
  const counts = {};
  CATS.forEach(c => counts[c.id] = RECIPES.filter(r => r.cat === c.id).length);
  const chip = (id, label, emoji, n) => `<button class="chip${n === 0 ? ' zero' : ''}" data-act="cat" data-cat="${id}" aria-pressed="${state.cat === id}">${emoji ? emoji + ' ' : ''}${esc(label)} <span class="c">${n}</span></button>`;
  // Les catégories vides restent affichées.
  document.getElementById('chips').innerHTML = chip('all', 'Toutes', '', RECIPES.length) + CATS.map(c => chip(c.id, c.label, c.emoji, counts[c.id])).join('');
  const q = norm(state.q.trim());
  const match = r => {
    if (state.cat !== 'all' && r.cat !== state.cat) return false;
    if (!q) return true;
    const hay = [r.title, ...r.tags, catOf(r.cat).label, ...r.groups.flatMap(g => g.items.flatMap(i => [i.n, i.np || '']))].map(norm).join(' ');
    return hay.includes(q);
  };
  const found = RECIPES.filter(match);
  const row = r => `<a class="row" href="#/r/${encodeURIComponent(r.id)}">${thumb(r)}
    <span><span class="t">${esc(r.title)}</span>
    <span class="pills"><span class="pill">${esc(catOf(r.cat).label)}</span>${r.tags.slice(0, 1).map(t => `<span class="pill">${esc(t)}</span>`).join('')}${r.total ? `<span class="pill saf">${esc(r.total)}</span>` : ''}</span></span></a>`;
  let html = '';
  if (!found.length) {
    html = q ? `<div class="empty">Aucune recette ne correspond à « ${esc(state.q.trim())} ».</div>`
             : `<div class="empty">Aucune recette dans ce thème pour l’instant.</div>`;
  } else if (state.cat === 'all') {
    html = CATS.map(c => {
      const rs = found.filter(r => r.cat === c.id);
      if (!rs.length) return '';
      return `<section class="grp"><h2>${c.emoji} ${esc(c.label)} <span class="c">${rs.length}</span></h2>${rs.map(row).join('')}</section>`;
    }).join('');
  } else {
    html = `<section class="grp">${found.map(row).join('')}</section>`;
  }
  document.getElementById('list').innerHTML = html;
}

/* ---------- Fiche recette ---------- */
function checks(r) { return store.get('chk:' + r.id, { ing: {}, step: {} }); }
function servings(r) {
  const v = store.get('serv:' + r.id, r.base);
  return Math.min(24, Math.max(1, Number(v) || r.base));
}

function renderRecipe(r) {
  document.title = r.title;
  const c = checks(r);
  let idx = 0;
  const steps = r.steps.map(p => `
    <h3 class="ph3">${esc(p.ph)}</h3>
    <ol class="steps">${p.items.map(t => {
      const i = idx++;
      return `<li class="step${c.step[i] ? ' done' : ''}" data-act="step" data-i="${i}" role="checkbox" aria-checked="${!!c.step[i]}" tabindex="0"><span class="n">${i + 1}</span><p>${esc(t)}</p></li>`;
    }).join('')}</ol>`).join('');
  const hero = r.image
    ? `<div class="hero"><img src="${esc(r.image)}" alt="${esc(r.title)}" decoding="async" data-fb="hero" data-emoji="${esc(r.emoji || '')}"></div>`
    : heroTile(r);
  const wake = 'wakeLock' in navigator
    ? `<button class="toggle" data-act="wake" aria-pressed="${!!wakeLock}">☀️ Garder l’écran allumé</button>` : '';
  app.innerHTML = `
    <div class="bar"><a class="back" href="#/">‹ Sommaire</a></div>
    <article>
      <div class="rhead">
        ${hero}
        <div>
          <h1 class="rt">${esc(r.title)}</h1>
          <div class="pills"><span class="pill">${esc(catOf(r.cat).label)}</span>${r.tags.map(t => `<span class="pill">${esc(t)}</span>`).join('')}${r.source ? `<span class="pill saf">${esc(r.source)}</span>` : ''}</div>
          ${r.times && r.times.length ? `<dl class="times">${r.times.map(t => `<div><dt>${esc(t.l)}</dt><dd>${esc(t.v)}</dd></div>`).join('')}</dl>` : ''}
          ${wake ? `<div class="tools">${wake}</div>` : ''}
        </div>
      </div>

      <div class="rbody">
        <section class="ings-col">
          <div class="sh"><h2>Ingrédients</h2><button class="link" data-act="uncheck">Tout décocher</button></div>
          <div class="stepper" role="group" aria-label="Nombre de personnes">
            <button class="rnd" data-act="minus" aria-label="Une personne de moins">−</button>
            <div class="count"><output id="serv" aria-live="polite"></output><span id="servlab"></span></div>
            <button class="rnd" data-act="plus" aria-label="Une personne de plus">+</button>
          </div>
          <p class="basenote" id="basenote"></p>
          <div id="ings"></div>
        </section>

        <section>
          <div class="sh"><h2>Préparation</h2></div>
          ${steps}
        </section>

        ${r.notes && r.notes.length ? `<section class="notes">
          <div class="sh"><h2>À savoir</h2></div>
          <ul>${r.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
        </section>` : ''}
      </div>
    </article>`;
  updateIngs(r, false);
}

function updateIngs(r, animate) {
  const s = servings(r), mult = s / r.base, c = checks(r);
  document.getElementById('serv').textContent = s;
  document.getElementById('servlab').textContent = plural(s, 'personne', 'personnes');
  document.querySelector('[data-act="minus"]').disabled = s <= 1;
  document.querySelector('[data-act="plus"]').disabled = s >= 24;
  document.getElementById('basenote').innerHTML =
    `Recette de base : ${r.base} ${plural(r.base, 'personne', 'personnes')}. ${esc(r.baseNote || '')}` +
    (s !== r.base ? ` <button class="link" data-act="reset-serv">Revenir à ${r.base}</button>` : '') +
    (s !== r.base ? `<br>Les temps de cuisson ne changent pas avec le nombre de personnes.` : '');
  const box = document.getElementById('ings');
  box.innerHTML = r.groups.map(g => `
    <h3 class="gt">${esc(g.t)}${g.opt ? '<em class="tag">facultatif</em>' : ''}</h3>
    ${g.note ? `<p class="gnote">${esc(g.note)}</p>` : ''}
    <ul class="ings">${g.items.map(it => {
      const o = scaleItem(it, mult), on = !!c.ing[it.id];
      const extra = it.warn || it.hint;
      return `<li class="ing${on ? ' on' : ''}${it.warn ? ' flag' : ''}" data-act="ing" data-id="${esc(it.id)}" role="checkbox" aria-checked="${on}" tabindex="0">
        <span class="box" aria-hidden="true"></span>
        <span class="qty${o.fixed ? ' fixed' : ''}">${esc(o.q)}</span>
        <span class="nm">${it.warn ? '<span aria-hidden="true">⚠️ </span>' : ''}${esc(o.name)}${it.opt ? '<em class="tag">facultatif</em>' : ''}${extra ? `<small>${it.warn ? '<span class="sr">Attention : </span>' : ''}${esc(extra)}</small>` : ''}</span>
      </li>`;
    }).join('')}</ul>`).join('');
  if (animate) { box.classList.remove('bump'); void box.offsetWidth; box.classList.add('bump'); }
}

/* ---------- Écran allumé (Screen Wake Lock, si le navigateur le permet) ---------- */
let wakeLock = null, wantWake = false;
async function setWake(on) {
  wantWake = on;
  try {
    if (on && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; syncWakeBtn(); });
    } else if (!on && wakeLock) {
      await wakeLock.release(); wakeLock = null;
    }
  } catch (e) { wakeLock = null; wantWake = false; }
  syncWakeBtn();
}
function syncWakeBtn() {
  const b = document.querySelector('[data-act="wake"]');
  if (b) b.setAttribute('aria-pressed', String(!!wakeLock));
}
document.addEventListener('visibilitychange', () => {
  // Le navigateur libère le verrou quand l'appli passe en arrière-plan : on le reprend au retour.
  if (document.visibilityState === 'visible' && wantWake && current) setWake(true);
});

/* ---------- Événements ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const a = t.dataset.act, r = current;
  if (a === 'cat') { state.cat = t.dataset.cat; updateHome(); return; }
  if (a === 'reload') { location.reload(); return; }
  if (!r) return;
  if (a === 'plus' || a === 'minus') {
    const s = servings(r) + (a === 'plus' ? 1 : -1);
    store.set('serv:' + r.id, Math.min(24, Math.max(1, s)));
    updateIngs(r, true); return;
  }
  if (a === 'reset-serv') { store.set('serv:' + r.id, r.base); updateIngs(r, true); return; }
  if (a === 'ing') {
    const c = checks(r), id = t.dataset.id;
    c.ing[id] = !c.ing[id]; store.set('chk:' + r.id, c);
    t.classList.toggle('on', !!c.ing[id]); t.setAttribute('aria-checked', !!c.ing[id]); return;
  }
  if (a === 'step') {
    const c = checks(r), i = t.dataset.i;
    c.step[i] = !c.step[i]; store.set('chk:' + r.id, c);
    t.classList.toggle('done', !!c.step[i]); t.setAttribute('aria-checked', !!c.step[i]); return;
  }
  if (a === 'uncheck') { store.set('chk:' + r.id, { ing: {}, step: {} }); renderRecipe(r); return; }
  if (a === 'wake') { setWake(!wakeLock); return; }
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-act="ing"],[data-act="step"]')) {
    e.preventDefault(); e.target.click();
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') { state.q = e.target.value; updateHome(); }
});
// Image manquante ou illisible : repli sur l'emoji.
document.addEventListener('error', e => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.fb) return;
  const r = { emoji: img.dataset.emoji };
  img.parentElement.outerHTML = img.dataset.fb === 'hero' ? heroTile(r) : tile(r, 'thumb');
}, true);

function route() {
  const m = location.hash.match(/^#\/r\/(.+)$/);
  const r = m && RECIPES.find(x => x.id === decodeURIComponent(m[1]));
  if (r) { current = r; renderRecipe(r); }
  else { current = null; if (wakeLock) setWake(false); renderHome(); }
  window.scrollTo(0, 0);
}
// Chaque écran s'ouvre en haut de page (pas de restauration automatique du défilement).
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.addEventListener('hashchange', route);

/* ---------- Démarrage ---------- */
async function start() {
  try {
    const res = await fetch('data/recettes.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    RECIPES = (await res.json()).recipes;
  } catch (e) {
    app.innerHTML = `<div class="err"><h1>Impossible de charger les recettes</h1>
      <p>Vérifie la connexion puis réessaie. Détail : <code>${esc(e.message)}</code></p>
      <button class="toggle" data-act="reload">Réessayer</button></div>`;
    return;
  }
  route();
}
start();

/* ---------- Hors ligne et mises à jour (service worker) ---------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return; reloading = true; location.reload();
  });
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => {
      if (document.querySelector('.upd')) return;
      const bar = document.createElement('div');
      bar.className = 'upd'; bar.setAttribute('role', 'status');
      bar.innerHTML = 'Nouvelle version disponible <button type="button">Mettre à jour</button>';
      bar.querySelector('button').onclick = () => w.postMessage('skipWaiting');
      document.body.appendChild(bar);
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w && w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
      });
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
}

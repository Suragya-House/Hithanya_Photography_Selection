(() => {
'use strict';
/* ====== CONFIG: paste your Supabase project values (Settings > API). The anon key is safe to publish. ====== */
const CFG = { url: 'https://dkgyctyksbgtyjxfheme.supabase.co', key: 'sb_publishable_rxVkf_0FUKyILy8BJMZRWg_-N0ckUDR', bucket: 'proofs' };

const sb = window.supabase.createClient(CFG.url, CFG.key);
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = { projects: [], c: null, files: [], list: [], sel: new Set(), filter: false, vi: -1, ctx: {} };
const store = () => sb.storage.from(CFG.bucket);

const toast = (m, err) => { const t = $('#toast'); t.textContent = m; t.className = 'toast show' + (err ? ' err' : ''); clearTimeout(toast.t); toast.t = setTimeout(() => t.className = 'toast', 3500); };
const show = id => document.querySelectorAll('.view').forEach(v => v.classList.toggle('hidden', v.id !== id));
const openModal = (title, html) => { $('#m-title').textContent = title; $('#m-body').innerHTML = html; $('#modal').classList.remove('hidden'); };
const closeModal = () => $('#modal').classList.add('hidden');
const busy = (b, on, t) => { if (!b) return; if (on) { b.dataset.t = b.textContent; b.textContent = t || 'Please wait...'; } else b.textContent = b.dataset.t || b.textContent; b.disabled = on; };
const rand = (n, a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789') => Array.from(crypto.getRandomValues(new Uint32Array(n)), x => a[x % a.length]).join('');
const base = () => location.origin + location.pathname;
const linkFor = p => `${base()}#/c/${p.project_code}/${p.access_code}`;
const copy = async t => { try { await navigator.clipboard.writeText(t); toast('Copied to clipboard'); } catch { toast('Copy failed. Select the text manually.', 1); } };
const fmtDate = d => d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const IMG = /\.(jpe?g|png|webp|gif|avif)$/i;
const dlText = p => { if (!p.deadline_at) return 'No deadline'; const ms = new Date(p.deadline_at) - Date.now(); if (ms < 0) return 'Deadline passed'; const d = Math.ceil(ms / 864e5); return `${d} day${d > 1 ? 's' : ''} left`; };
const statusOf = p => p.status === 'submitted' ? ['Submitted', 'bg-emerald-500/15 text-emerald-300']
  : p.locked ? ['Locked', 'bg-red-500/15 text-red-300']
  : p.deadline_at && new Date(p.deadline_at) < Date.now() ? ['Deadline passed', 'bg-red-500/15 text-red-300']
  : p.selections.length ? ['In progress', 'bg-brass/15 text-brass'] : ['Not started', 'bg-white/5 text-zinc-400'];

/* ====== Navigation ====== */
document.querySelectorAll('[data-home]').forEach(b => b.onclick = () => show('v-home'));
$('#go-client').onclick = () => show('v-client-login');
$('#go-admin').onclick = async () => { const { data } = await sb.auth.getSession(); data.session ? loadAdmin() : show('v-admin-login'); };
$('#m-x').onclick = closeModal;
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

/* ====== Admin ====== */
$('#f-admin').onsubmit = async e => {
  e.preventDefault(); const b = e.submitter; busy(b, 1, 'Signing in...');
  const { error } = await sb.auth.signInWithPassword({ email: e.target.email.value.trim(), password: e.target.password.value });
  busy(b, 0); if (error) return toast(error.message, 1);
  e.target.reset(); loadAdmin();
};
$('#btn-alogout').onclick = async () => { await sb.auth.signOut(); show('v-home'); };

async function loadAdmin() {
  show('v-admin');
  const { data, error } = await sb.from('projects').select('*').order('created_at', { ascending: false });
  if (error) return toast(error.message, 1);
  S.projects = data; renderProjects();
}

function renderProjects() {
  const el = $('#projects');
  el.innerHTML = S.projects.length ? S.projects.map(p => {
    const sub = p.status === 'submitted', [sl, sc] = statusOf(p);
    return `<article class="bg-panel border border-white/10 rounded-xl p-5 flex flex-col gap-3" data-id="${p.id}">
      <div class="flex justify-between gap-2"><div><h3 class="font-serif text-xl text-white">${esc(p.client_name)}</h3>
      <p class="text-sm text-zinc-500">${esc(p.event_type || 'Project')}${p.event_date ? ', ' + fmtDate(p.event_date) : ''}</p></div>
      <span class="self-start text-xs px-2 py-1 rounded-full ${sc}">${sl}</span></div>
      <p class="text-sm text-zinc-400"><span class="cnt">...</span>, ${p.selections.length} selected${sub ? ' on ' + fmtDate(p.submitted_at) : ''}<br>${dlText(p)}</p>
      <div class="flex flex-wrap gap-2 mt-auto pt-2">
        <button class="btn-gold" data-act="open">Open project</button>
        <button class="btn-ghost" data-act="creds">Credentials</button>
        <button class="btn-ghost btn-danger" data-act="del">Delete</button></div></article>`;
  }).join('') : '<p class="text-zinc-500">No projects yet. Create your first one to get started.</p>';
  S.projects.forEach(async p => {
    const { data } = await store().list(p.id, { limit: 1000 });
    const n = $(`[data-id="${p.id}"] .cnt`); if (n) n.textContent = (data || []).filter(f => f.id).length + ' photos';
  });
}

$('#projects').onclick = e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const p = S.projects.find(x => x.id === b.closest('[data-id]').dataset.id);
  act[b.dataset.act](p, b);
};

$('#btn-new').onclick = () => openModal('New project', `
  <form id="f-new" class="space-y-3">
    <div><label class="lbl" for="n-name">Client name</label><input id="n-name" name="name" class="inp" required></div>
    <div><label class="lbl" for="n-type">Event type</label><input id="n-type" name="type" class="inp" placeholder="Wedding, Engagement, Portfolio..."></div>
    <div><label class="lbl" for="n-date">Event date</label><input id="n-date" name="date" type="date" class="inp"></div>
    <div><label class="lbl" for="n-days">Days to submit</label><input id="n-days" name="days" type="number" min="1" max="365" value="7" class="inp" placeholder="Leave empty for no deadline"></div>
    <button class="btn-gold w-full">Create project</button></form>`);

async function createProject(f, b) {
  busy(b, 1, 'Creating...');
  const row = { client_name: f.name.value.trim(), event_type: f.type.value.trim() || null, event_date: f.date.value || null, project_code: 'HTY-' + rand(6), access_code: rand(8), deadline_at: +f.days.value > 0 ? new Date(Date.now() + f.days.value * 864e5).toISOString() : null };
  const { data, error } = await sb.from('projects').insert(row).select().single();
  busy(b, 0); if (error) return toast(error.message, 1);
  S.projects.unshift(data); renderProjects(); act.creds(data);
}

const shrink = async f => { // downsize huge originals to web-proof size; originals stay with the studio
  try {
    const bm = await createImageBitmap(f), k = Math.min(1, 2400 / Math.max(bm.width, bm.height));
    if (k === 1 && f.size < 2.5e6) return f;
    const c = document.createElement('canvas'); c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k);
    c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, 'image/jpeg', .88)) || f;
  } catch { return f; }
};

const act = {
  open: p => openProject(p),
  upload(p, folder) {
    const i = $(folder ? '#folder' : '#file');
    i.onchange = async () => {
      const all = [...i.files], fs = all.filter(f => IMG.test(f.name)), q = [...fs]; i.value = '';
      if (all.length > fs.length) toast(`${all.length - fs.length} non-image file(s) skipped`);
      if (!fs.length) return;
      let ok = 0;
      const worker = async () => { while (q.length) {
        const f = q.shift();
        try {
          const blob = await shrink(f), name = (f.webkitRelativePath ? f.webkitRelativePath.split('/').slice(1).join('__') : f.name).replace(/[^\w.\-]+/g, '_');
          const { error } = await store().upload(`${p.id}/${name}`, blob, { upsert: true, contentType: blob.type || f.type, cacheControl: '31536000' });
          if (error) throw error; ok++; toast(`Uploading ${ok}/${fs.length}...`);
        } catch (e) { toast(`${f.name}: ${e.message}`, 1); }
      } };
      await Promise.all([worker(), worker(), worker()]);
      toast(`Uploaded ${ok} of ${fs.length} photos`, ok < fs.length); S.p && S.p.id === p.id ? loadDetail(true) : renderProjects();
    };
    i.click();
  },
  creds(p) {
    const msg = `Hello ${p.client_name}, your photos from Hitanya Photography Studio are ready for selection.\nOpen: ${linkFor(p)}\nProject ID: ${p.project_code}\nAccess code: ${p.access_code}`;
    S.ctx = { link: linkFor(p), msg, code: p.project_code, key: p.access_code };
    openModal('Client credentials', `
      <dl class="space-y-3 text-sm">
        <div><dt class="text-zinc-500">Project ID</dt><dd class="text-white font-mono text-lg">${esc(p.project_code)}</dd></div>
        <div><dt class="text-zinc-500">Access code</dt><dd class="text-white font-mono text-lg">${esc(p.access_code)}</dd></div>
        <div><dt class="text-zinc-500">Direct link</dt><dd class="break-all text-zinc-300">${esc(linkFor(p))}</dd></div></dl>
      <div class="flex flex-wrap gap-2 mt-5">
        <button class="btn-gold" data-copy="link">Copy link</button>
        <button class="btn-ghost" data-copy="msg">Copy message</button>
        <a class="btn-ghost" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(msg)}">WhatsApp</a>
        <a class="btn-ghost" href="mailto:?subject=${encodeURIComponent('Your photo gallery from Hitanya Photography Studio')}&body=${encodeURIComponent(msg)}">Email</a></div>`);
  },
  sel(p) {
    const list = p.selections || []; S.ctx = { list: list.join('\n') };
    openModal(`Selections: ${p.client_name}`, p.status === 'submitted' ? `
      <p class="text-sm text-zinc-400 mb-3">${list.length} photos submitted on ${fmtDate(p.submitted_at)}.</p>
      <ul class="max-h-64 overflow-auto bg-ink border border-white/10 rounded-lg p-3 text-sm font-mono space-y-1">${list.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
      <button class="btn-gold mt-4" data-copy="list">Copy filenames</button>` :
      '<p class="text-zinc-400">This client has not submitted a selection yet.</p>');
  },
  async del(p) {
    if (!confirm(`Delete "${p.client_name}" and permanently erase all of its photos? This cannot be undone.`)) return;
    let { data } = await store().list(p.id, { limit: 1000 });
    while (data && data.length) {
      const { data: rm, error } = await store().remove(data.map(f => `${p.id}/${f.name}`));
      if (error || !rm || !rm.length) return toast('Could not delete the photos. Nothing was removed from the project.', 1);
      ({ data } = await store().list(p.id, { limit: 1000 }));
    }
    const { error } = await sb.from('projects').delete().eq('id', p.id);
    if (error) return toast(error.message, 1);
    S.projects = S.projects.filter(x => x.id !== p.id); S.p ? backToList() : renderProjects(); toast('Project deleted');
  }
};

$('#m-body').addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'f-new') createProject(e.target, e.submitter);
  else if (e.target.id === 'f-dl') saveDeadline(e.target, e.submitter);
});
async function saveDeadline(f, b) {
  busy(b, 1, 'Saving...');
  const d = +f.days.value, at = d > 0 ? new Date(Date.now() + d * 864e5).toISOString() : null;
  const { error } = await sb.from('projects').update({ deadline_at: at }).eq('id', S.p.id);
  busy(b, 0); if (error) return toast(error.message, 1);
  closeModal(); toast(at ? 'Deadline updated' : 'Deadline removed'); loadDetail(true);
}
$('#m-body').addEventListener('click', async e => {
  const c = e.target.closest('[data-copy]'); if (c) return copy(S.ctx[c.dataset.copy]);
  if (e.target.id === 'ok-submit') {
    busy(e.target, 1, 'Sending...');
    const { data, error } = await sb.rpc('submit_selection', { p_code: S.c.code, p_access: S.c.key, p_files: [...S.sel] });
    busy(e.target, 0); if (error) return toast('Could not submit. Please try again.', 1);
    if (!data) { closeModal(); return toast('Submissions are locked or the deadline has passed. Please contact the studio.', 1); }
    S.c.status = 'submitted'; S.c.locked = true; closeModal(); banner(); toast('Selections submitted. Thank you!');
  }
});

/* ====== Admin project screen ====== */
const pu = (n, dl) => store().getPublicUrl(`${S.p.id}/${n}`, dl ? { download: n } : undefined).data.publicUrl;
async function listAll(id) {
  let all = [], o = 0;
  for (;;) {
    const { data } = await store().list(id, { limit: 1000, offset: o, sortBy: { column: 'name', order: 'asc' } });
    if (!data || !data.length) break;
    all = all.concat(data.filter(f => f.id)); if (data.length < 1000) break; o += 1000;
  }
  return all.map(f => f.name);
}
async function openProject(p) {
  S.p = p; S.tab = 'all'; S.pkey = ''; show('v-project'); await loadDetail(true);
  clearInterval(S.poll); S.poll = setInterval(() => S.p && loadDetail(), 20000); // live tracking
}
function backToList() { clearInterval(S.poll); S.p = null; show('v-admin'); renderProjects(); }
async function loadDetail(force) {
  const [{ data: row }, names] = await Promise.all([sb.from('projects').select('*').eq('id', S.p.id).single(), listAll(S.p.id)]);
  if (!S.p) return;
  if (row) { S.p = row; S.projects = S.projects.map(x => x.id === row.id ? row : x); }
  const key = [S.p.status, S.p.locked, S.p.deadline_at, S.p.selections.join(), names.length].join('|');
  if (!force && key === S.pkey) return;
  S.pkey = key; S.pf = names; renderDetail();
}
function renderDetail() {
  const p = S.p, [sl, sc] = statusOf(p), sub = p.status === 'submitted', sel = p.selections || [], set = new Set(sel), g = $('#p-grid');
  $('#p-title').textContent = p.client_name;
  $('#p-sub').textContent = [p.event_type, fmtDate(p.event_date)].filter(Boolean).join(', ');
  $('#p-status').textContent = sl; $('#p-status').className = 'text-xs px-2 py-1 rounded-full ' + sc;
  $('#p-lock').textContent = p.locked ? 'Unlock client' : 'Lock client';
  $('#p-stats').innerHTML = [
    ['Photos uploaded', S.pf.length], ['Selected so far', `${sel.length} of ${S.pf.length}`],
    ['Submission', sub ? 'Submitted ' + fmtDate(p.submitted_at) : p.locked ? 'Locked, not submitted' : 'Not submitted'],
    ['Deadline', p.deadline_at ? `${fmtDate(p.deadline_at)} (${dlText(p)})` : 'No deadline']
  ].map(([k, v]) => `<div class="bg-panel border border-white/10 rounded-lg p-4"><p class="text-xs text-zinc-500">${k}</p><p class="text-white mt-1">${esc(v)}</p></div>`).join('');
  document.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === S.tab; b.classList.toggle('btn-gold', on); b.classList.toggle('btn-ghost', !on); });
  $('#p-actions').classList.toggle('hidden', S.tab !== 'sel');
  $('#p-note').textContent = sub ? '' : 'Downloads unlock after the client submits.';
  $('#p-copy').disabled = $('#p-zip').disabled = !sub;
  if (S.tab === 'all') {
    g.className = 'grid-ph p-5 md:p-10';
    g.innerHTML = S.pf.length ? S.pf.map(n => `<a class="ph ${set.has(n) ? 'on' : ''}" href="${esc(pu(n))}" target="_blank" rel="noopener"><img loading="lazy" decoding="async" alt="${esc(n)}" src="${esc(pu(n))}"><div class="ov"><span>${esc(n)}</span></div>${set.has(n) ? '<span class="pick on grid place-items-center">&#9829;</span>' : ''}</a>`).join('')
      : '<p class="text-zinc-500 col-span-full">No photos yet. Use Upload photos or Upload folder.</p>';
  } else {
    g.className = 'grid gap-2 p-5 md:p-10 max-w-3xl';
    g.innerHTML = sel.length ? sel.map(n => `<div class="flex items-center gap-3 bg-panel border border-white/10 rounded-lg p-2"><img class="w-14 h-14 object-cover rounded" loading="lazy" alt="" src="${esc(pu(n))}"><span class="flex-1 truncate font-mono text-sm">${esc(n)}</span>${sub ? `<a class="btn-ghost" href="${esc(pu(n, 1))}" download="${esc(n)}">Download</a>` : '<span class="btn-ghost opacity-40 cursor-not-allowed" aria-disabled="true">Download</span>'}</div>`).join('')
      : '<p class="text-zinc-500">The client has not selected any photos yet.</p>';
  }
}
async function zipSel(b) {
  if (!window.JSZip) return toast('ZIP library did not load. Check your connection.', 1);
  const p = S.p, z = new JSZip(); let i = 0; busy(b, 1, 'Zipping...');
  for (const n of p.selections) {
    try { const { data, error } = await store().download(`${p.id}/${n}`); if (error) throw error; z.file(n, data); b.textContent = `Zipping ${++i}/${p.selections.length}`; }
    catch (e) { toast(`${n}: ${e.message}`, 1); }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(await z.generateAsync({ type: 'blob', compression: 'STORE' }));
  a.download = `${p.client_name.replace(/\W+/g, '_')}_selected.zip`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 6e4); busy(b, 0);
}
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { S.tab = b.dataset.tab; renderDetail(); });
$('#p-grid').addEventListener('load', e => e.target.classList.add('ld'), true);
$('#p-grid').addEventListener('error', e => e.target.classList.add('ld'), true);
$('#p-back').onclick = backToList;
$('#p-up').onclick = () => act.upload(S.p);
$('#p-folder').onclick = () => act.upload(S.p, true);
$('#p-creds').onclick = () => act.creds(S.p);
$('#p-del').onclick = () => act.del(S.p);
$('#p-refresh').onclick = () => loadDetail(true);
$('#p-copy').onclick = () => copy(S.p.selections.join('\n'));
$('#p-zip').onclick = e => zipSel(e.currentTarget);
$('#p-lock').onclick = async () => {
  const p = S.p, lock = !p.locked;
  if (!lock && !confirm('Unlock this project so the client can change their selection and submit again?')) return;
  const { error } = await sb.from('projects').update(lock ? { locked: true } : { locked: false, status: 'pending' }).eq('id', p.id);
  if (error) return toast(error.message, 1);
  toast(lock ? 'Client can no longer change or submit' : 'Project unlocked'); loadDetail(true);
};
$('#p-deadline').onclick = () => openModal('Submission deadline', `
  <form id="f-dl" class="space-y-3">
    <div><label class="lbl" for="d-days">Days from today</label><input id="d-days" name="days" type="number" min="1" max="365" value="7" class="inp" placeholder="Leave empty for no deadline"></div>
    <p class="text-xs text-zinc-500">Current: ${S.p.deadline_at ? fmtDate(S.p.deadline_at) + ' (' + dlText(S.p) + ')' : 'No deadline'}. Clearing the field removes the deadline.</p>
    <button class="btn-gold w-full">Save deadline</button></form>`);

/* ====== Client ====== */
async function clientLogin(code, key) {
  const { data, error } = await sb.rpc('client_login', { p_code: code, p_access: key });
  if (error || !data) return false;
  const pre = data.id + '/';
  S.c = { ...data, code: code.trim().toUpperCase(), key: key.trim() };
  S.files = (data.files || []).map(f => f.slice(pre.length)).filter(n => /\.(jpe?g|png|webp|gif|avif)$/i.test(n)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  let draft; try { draft = JSON.parse(localStorage.getItem('hty:' + data.id)); } catch {}
  S.sel = new Set((cState() === 'open' && draft || data.selections || []).filter(n => S.files.includes(n)));
  S.filter = false; $('#btn-filter').classList.remove('btn-gold');
  $('#g-title').textContent = data.client_name;
  $('#g-sub').textContent = [data.event_type, fmtDate(data.event_date)].filter(Boolean).join(', ');
  banner(); show('v-gallery'); renderGrid(); return true;
}
const cState = () => { const c = S.c; return c.status === 'submitted' ? 'submitted' : c.locked ? 'locked' : c.deadline_at && new Date(c.deadline_at) < Date.now() ? 'closed' : 'open'; };
function banner() {
  const b = $('#g-done'), s = cState(), open = s === 'open';
  b.textContent = {
    submitted: 'Your selection was submitted to the studio and is now locked. Contact the studio if you need to change it.',
    locked: 'The studio has locked this gallery, so your selection can no longer be changed.',
    closed: 'The submission deadline has passed. Contact the studio if you need more time.',
    open: S.c.deadline_at ? `Submission deadline: ${fmtDate(S.c.deadline_at)} (${dlText(S.c)}).` : ''
  }[s];
  b.classList.toggle('hidden', !b.textContent);
  const btn = $('#btn-submit'); btn.disabled = !open; btn.textContent = open ? 'Submit Selections' : s === 'submitted' ? 'Submitted' : 'Locked';
}
let saveT; // autosave progress so the studio can follow along
const saveProg = () => { clearTimeout(saveT); saveT = setTimeout(() => sb.rpc('save_selection', { p_code: S.c.code, p_access: S.c.key, p_files: [...S.sel] }), 800); };
$('#f-client').onsubmit = async e => {
  e.preventDefault(); busy(e.submitter, 1, 'Opening...');
  const ok = await clientLogin(e.target.code.value, e.target.key.value);
  busy(e.submitter, 0); if (!ok) toast('That Project ID and access code do not match. Check them and try again.', 1); else e.target.reset();
};
$('#btn-clogout').onclick = () => { S.c = null; S.sel.clear(); $('#grid').innerHTML = ''; show('v-home'); };

const url = n => store().getPublicUrl(`${S.c.id}/${n}`).data.publicUrl;
function renderGrid() {
  S.list = S.filter ? S.files.filter(n => S.sel.has(n)) : S.files;
  $('#grid').innerHTML = S.list.map((n, i) => `<figure class="ph" data-i="${i}" data-n="${esc(n)}"><img loading="lazy" decoding="async" alt="${esc(n)}" src="${esc(url(n))}"><div class="ov"><span>${esc(n)}</span></div><button class="pick" data-p aria-label="Select ${esc(n)}">&#9829;</button></figure>`).join('')
    || `<p class="text-zinc-500 col-span-full text-center py-24">${S.filter ? 'You have not selected any photos yet.' : 'No photos have been uploaded to this gallery yet.'}</p>`;
  sync();
}
function sync() {
  document.querySelectorAll('#grid .ph').forEach(f => { const on = S.sel.has(f.dataset.n); f.classList.toggle('on', on); f.querySelector('.pick').setAttribute('aria-pressed', on); });
  $('#count').textContent = S.sel.size; $('#total').textContent = S.files.length;
  if (S.vi >= 0) { const on = S.sel.has(S.list[S.vi]); $('#v-pick').classList.toggle('on', on); $('#v-pick').textContent = (on ? '\u2713 Selected' : 'Select this photo') + ' (' + S.sel.size + ' chosen)'; }
}
function toggle(n) {
  if (cState() !== 'open') return toast('Selections are locked and can no longer be changed.', 1);
  S.sel.has(n) ? S.sel.delete(n) : S.sel.add(n);
  try { localStorage.setItem('hty:' + S.c.id, JSON.stringify([...S.sel])); } catch {}
  saveProg();
  sync();
}
$('#grid').addEventListener('load', e => e.target.classList.add('ld'), true);
$('#grid').addEventListener('error', e => e.target.classList.add('ld'), true);
$('#grid').onclick = e => {
  const f = e.target.closest('.ph'); if (!f) return;
  e.target.closest('[data-p]') ? toggle(f.dataset.n) : openViewer(+f.dataset.i);
};
$('#btn-filter').onclick = e => { S.filter = !S.filter; e.currentTarget.classList.toggle('btn-gold', S.filter); e.currentTarget.classList.toggle('btn-ghost', !S.filter); renderGrid(); };
$('#btn-submit').onclick = () => {
  if (!S.sel.size) return toast('Select at least one photo first.', 1);
  openModal('Submit selections', `<p class="text-zinc-400 mb-5">You are sending <b class="text-white">${S.sel.size}</b> of ${S.files.length} photos to the studio. You can change your choices and submit again later.</p><button id="ok-submit" class="btn-gold w-full">Submit Selections</button>`);
};

/* ====== HD zoom viewer ====== */
const V = { s: 1, x: 0, y: 0, ptr: new Map(), d0: 0, s0: 1 };
const vw = $('#viewer'), vimg = $('#v-img'), stage = $('#stage');
const applyT = () => vimg.style.transform = `translate(${V.x}px,${V.y}px) scale(${V.s})`;
const reset = () => { V.s = 1; V.x = V.y = 0; applyT(); };
const center = () => { const r = stage.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
function zoomAt(f, px = 0, py = 0) {
  const n = Math.min(8, Math.max(1, V.s * f)), r = n / V.s;
  V.x = px - (px - V.x) * r; V.y = py - (py - V.y) * r; V.s = n;
  if (n === 1) V.x = V.y = 0; applyT();
}
function openViewer(i) {
  S.vi = (i + S.list.length) % S.list.length; const n = S.list[S.vi];
  vw.classList.remove('hidden'); document.body.style.overflow = 'hidden';
  $('#v-name').textContent = `${n}  (${S.vi + 1} / ${S.list.length})`;
  reset(); vimg.style.opacity = .3; vimg.alt = n; vimg.onload = () => vimg.style.opacity = 1; vimg.src = url(n);
  [S.vi - 1, S.vi + 1].forEach(j => { const m = S.list[(j + S.list.length) % S.list.length]; if (m) new Image().src = url(m); });
  sync();
}
function closeViewer() { vw.classList.add('hidden'); document.body.style.overflow = ''; S.vi = -1; if (document.fullscreenElement) document.exitFullscreen(); }
vw.addEventListener('click', e => {
  const b = e.target.closest('[data-v]'); if (!b) return;
  ({ close: closeViewer, prev: () => openViewer(S.vi - 1), next: () => openViewer(S.vi + 1), in: () => zoomAt(1.5), out: () => zoomAt(1 / 1.5), reset,
     pick: () => toggle(S.list[S.vi]), fs: () => document.fullscreenElement ? document.exitFullscreen() : vw.requestFullscreen?.() })[b.dataset.v]();
});
stage.addEventListener('wheel', e => { e.preventDefault(); const [cx, cy] = center(); zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, e.clientX - cx, e.clientY - cy); }, { passive: false });
stage.addEventListener('dblclick', e => { const [cx, cy] = center(); V.s > 1 ? reset() : zoomAt(2.5, e.clientX - cx, e.clientY - cy); });
stage.addEventListener('pointerdown', e => { if (e.target.closest('.vnav, .vpick')) return; stage.setPointerCapture(e.pointerId); V.ptr.set(e.pointerId, [e.clientX, e.clientY]); vw.classList.add('dragging'); if (V.ptr.size === 2) { V.d0 = pinch(); V.s0 = V.s; } });
stage.addEventListener('pointermove', e => {
  if (!V.ptr.has(e.pointerId)) return;
  const [px, py] = V.ptr.get(e.pointerId); V.ptr.set(e.pointerId, [e.clientX, e.clientY]);
  if (V.ptr.size === 2) { const [cx, cy] = center(), m = mid(); zoomAt((V.s0 * pinch() / V.d0) / V.s, m[0] - cx, m[1] - cy); }
  else if (V.s > 1) { V.x += e.clientX - px; V.y += e.clientY - py; applyT(); }
});
const up = e => { V.ptr.delete(e.pointerId); if (!V.ptr.size) vw.classList.remove('dragging'); };
stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
const pinch = () => { const [a, b] = [...V.ptr.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; };
const mid = () => { const [a, b] = [...V.ptr.values()]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
document.addEventListener('keydown', e => {
  if (vw.classList.contains('hidden')) return e.key === 'Escape' && closeModal();
  const k = { Escape: closeViewer, ArrowLeft: () => openViewer(S.vi - 1), ArrowRight: () => openViewer(S.vi + 1), '+': () => zoomAt(1.5), '=': () => zoomAt(1.5), '-': () => zoomAt(1 / 1.5), '0': reset, ' ': () => toggle(S.list[S.vi]) }[e.key];
  if (k) { e.preventDefault(); k(); }
});

if (!vw.requestFullscreen) $('[data-v="fs"]').style.display = 'none'; // e.g. iPhone Safari

/* ====== Boot ====== */
(async () => {
  if (CFG.url.startsWith('YOUR_')) toast('Add your Supabase URL and anon key at the top of app.js', 1);
  const m = location.hash.match(/^#\/c\/([^/]+)\/([^/]+)$/);
  if (m) {
    show('v-client-login');
    const ok = await clientLogin(decodeURIComponent(m[1]), decodeURIComponent(m[2]));
    history.replaceState(null, '', base()); // remove the access code from the address bar
    if (!ok) toast('This link is invalid or has expired. Ask the studio for a new one.', 1);
  } else show('v-home');
})();
})();

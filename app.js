let listings = [];
let currentUser = null;
let stats = { listings: 0, free: 0, requests: 0 };
let activeView = 'browse';
let sizeOn = false;
let sortRecent = false;
let showAll = false;
let authMode = 'signin';
let pendingAction = null;
let toastTimer;
const savedListings = new Set();

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  let payload = {};
  try { payload = await response.json(); } catch { /* handled as an empty response */ }
  if (!response.ok) throw new Error(payload.error || 'The request could not be completed.');
  return payload;
}

async function refreshData() {
  const [me, listingData, nextStats] = await Promise.all([
    api('/api/me'), api('/api/listings'), api('/api/stats')
  ]);
  currentUser = me.user;
  listings = listingData.listings;
  stats = nextStats;
  render();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function getFilters() {
  return {
    query: document.getElementById('search-input').value.trim().toLowerCase(),
    school: document.getElementById('school-filter').value,
    grade: document.getElementById('grade-filter').value,
    type: document.getElementById('type-filter').value,
    size: sizeOn ? '30' : ''
  };
}

function score(item) {
  const filters = getFilters();
  let earned = 0;
  let possible = 0;
  if (filters.school !== 'all') { possible += 50; if (item.school === filters.school || item.school === 'Any school') earned += 50; }
  if (filters.grade !== 'all') {
    possible += 30;
    const gradeNumber = filters.grade.match(/\d+/)?.[0];
    if (item.grade === filters.grade || item.grade === 'Any grade' || (gradeNumber && item.grade.includes(gradeNumber))) earned += 30;
  }
  if (filters.size) { possible += 20; if (item.size === filters.size || item.size === 'One size') earned += 20; }
  return possible ? Math.round(earned / possible * 100) : 0;
}

function visibleListings() {
  const filters = getFilters();
  const items = listings.filter(item => {
    if (activeView === 'mine' && !item.isMine) return false;
    if (filters.type !== 'all' && item.type !== filters.type) return false;
    const haystack = `${item.title} ${item.school} ${item.type} ${item.grade} ${item.area}`.toLowerCase();
    return !filters.query || haystack.includes(filters.query);
  });
  items.sort(sortRecent ? (a, b) => b.created - a.created : (a, b) => score(b) - score(a));
  return items;
}

function listingCard(item) {
  const tone = ['uniform', 'book', 'sports', 'supplies'].includes(item.tone) ? item.tone : 'uniform';
  const label = item.condition === 'Like new' ? 'GENTLY LOVED' : item.condition.toUpperCase();
  const fit = score(item);
  const match = fit >= 70 ? `<span class="match-pill">${fit}% MATCH</span>` : '';
  const saved = savedListings.has(item.id);
  const requestTag = item.requestSent ? 'REQUEST SENT' : label;
  const secondary = item.sharing === 'Free' ? 'to a new home' : item.sharing === 'Swap' ? 'open to exchange' : 'for the set';
  return `<article class="item-card">
    <button class="card-click" data-detail="${escapeHtml(item.id)}" aria-label="View ${escapeHtml(item.title)}">
      <div class="item-visual visual-${tone}"><span class="condition-tag">${escapeHtml(requestTag)}</span><span class="distance-tag">${escapeHtml(item.distance || 'Nearby')}</span><span class="item-emoji" aria-hidden="true">${escapeHtml(item.icon || '🎒')}</span>${match}</div>
      <div class="item-body"><div class="item-category"><span>${escapeHtml(item.type)}</span><span>${escapeHtml(item.grade)}</span></div><h3 class="item-title">${escapeHtml(item.title)}</h3><div class="item-meta">${escapeHtml(item.school)} · ${escapeHtml(item.size === 'One size' ? item.size : `Size ${item.size}`)}</div>
      <div class="item-footer"><span class="item-owner"><span class="owner-avatar">${escapeHtml(item.initial || item.owner.slice(0, 1))}</span>${escapeHtml(item.isMine ? 'Your listing' : item.owner)} · ${escapeHtml(item.area)}</span><span class="item-price">${escapeHtml(item.sharing)}<small>${secondary}</small></span></div></div>
    </button><button class="item-heart ${saved ? 'saved' : ''}" data-save="${escapeHtml(item.id)}" aria-label="${saved ? 'Unsave' : 'Save'} ${escapeHtml(item.title)}">${saved ? '♥' : '♡'}</button>
  </article>`;
}

function render() {
  const items = visibleListings();
  const shown = showAll ? items : items.slice(0, 8);
  document.getElementById('listing-grid').innerHTML = shown.map(listingCard).join('');
  document.getElementById('listing-grid').hidden = items.length === 0;
  document.getElementById('no-results').hidden = items.length !== 0;
  document.getElementById('result-count').textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'} nearby`;
  document.getElementById('showing-count').textContent = shown.length;
  document.getElementById('total-count').textContent = items.length;
  document.getElementById('mine-count').textContent = listings.filter(item => item.isMine).length;
  document.getElementById('size-tag').hidden = !sizeOn;
  document.getElementById('filter-size').innerHTML = sizeOn ? 'My size <span>×</span>' : 'My size <span>＋</span>';
  document.getElementById('sort-button').innerHTML = `${sortRecent ? 'Recently added' : 'Best match'} <span>⌄</span>`;
  document.getElementById('load-more').textContent = showAll ? 'Back to top ↑' : 'See all listings →';
  document.getElementById('stat-items').textContent = stats.listings;
  document.getElementById('stat-savings').textContent = stats.free;
  document.getElementById('stat-waste').textContent = stats.requests;

  const schools = [...new Set(listings.map(item => item.school).filter(school => school !== 'Any school'))].sort();
  const schoolSelect = document.getElementById('school-filter');
  const chosen = schoolSelect.value;
  schoolSelect.innerHTML = '<option value="all">Any school</option>' + schools.map(school => `<option value="${escapeHtml(school)}">${escapeHtml(school)}</option>`).join('');
  schoolSelect.value = schools.includes(chosen) ? chosen : 'all';
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.view === activeView));
  document.getElementById('section-title').innerHTML = activeView === 'mine' ? 'Your items are <em>moving.</em>' : 'Find a <em>close</em> match.';
  document.getElementById('market-eyebrow').innerHTML = activeView === 'mine' ? '<span class="eyebrow-line"></span> YOUR COMMUNITY LISTINGS' : '<span class="eyebrow-line"></span> GOOD THINGS, READY TO GO';
  document.getElementById('auth-button').hidden = !!currentUser;
  document.getElementById('signed-in-label').hidden = !currentUser;
  document.getElementById('signed-in-label').textContent = currentUser ? `Hi, ${currentUser.displayName}` : '';
  document.getElementById('signout-button').hidden = !currentUser;
}

function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-backdrop').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeModal() { document.getElementById('modal-backdrop').hidden = true; document.body.style.overflow = ''; }
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function showAuth(mode = 'signin', note = '') {
  authMode = mode;
  const signup = mode === 'signup';
  openModal(`<div class="eyebrow"><span class="eyebrow-line"></span> YOUR COMMUNITY ACCOUNT</div><h2 id="modal-title">${signup ? 'Join UniformLoop.' : 'Welcome back.'}</h2><p class="modal-lede">${escapeHtml(note || (signup ? 'Create an account to list items and request a handoff.' : 'Sign in to manage your listings and item requests.'))}</p>
    <div class="auth-tabs"><button type="button" class="auth-tab ${signup ? '' : 'active'}" data-auth-mode="signin">Sign in</button><button type="button" class="auth-tab ${signup ? 'active' : ''}" data-auth-mode="signup">Create account</button></div>
    <form id="auth-form"><div class="form-grid">
      ${signup ? '<div class="form-field full"><label for="auth-display-name">Your name</label><input id="auth-display-name" name="displayName" autocomplete="name" required minlength="2" maxlength="40" placeholder="e.g. Asha"></div>' : ''}
      <div class="form-field full"><label for="auth-username">Username</label><input id="auth-username" name="username" autocomplete="username" required minlength="3" maxlength="24" pattern="[A-Za-z0-9_]+" placeholder="letters, numbers, underscores"></div>
      <div class="form-field full"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="${signup ? 'new-password' : 'current-password'}" required minlength="8" maxlength="200" placeholder="At least 8 characters"></div>
    </div><p class="auth-error" id="auth-error" role="alert"></p><button class="button button-dark modal-submit" id="auth-submit" type="submit">${signup ? 'Create account' : 'Sign in'} <span>↗</span></button><p class="auth-help">Your password is stored as a hash on this server. No email or phone number is collected.</p></form>`);
  document.querySelectorAll('[data-auth-mode]').forEach(button => button.addEventListener('click', () => showAuth(button.dataset.authMode, note)));
  document.getElementById('auth-form').addEventListener('submit', submitAuth);
  document.getElementById('auth-username').focus();
}

async function submitAuth(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const button = document.getElementById('auth-submit');
  const errorBox = document.getElementById('auth-error');
  button.disabled = true;
  errorBox.textContent = '';
  try {
    const path = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/signin';
    const payload = { username: form.get('username'), password: form.get('password') };
    if (authMode === 'signup') payload.displayName = form.get('displayName');
    const result = await api(path, { method: 'POST', body: JSON.stringify(payload) });
    currentUser = result.user;
    await refreshData();
    closeModal();
    showToast(authMode === 'signup' ? `Welcome, ${currentUser.displayName}!` : `Welcome back, ${currentUser.displayName}.`);
    const action = pendingAction;
    pendingAction = null;
    if (action) action();
  } catch (error) {
    errorBox.textContent = error.message;
    button.disabled = false;
  }
}

function requireAccount(action, note) {
  if (currentUser) return false;
  pendingAction = action;
  showAuth('signin', note);
  return true;
}

function addListingModal() {
  if (requireAccount(addListingModal, 'Sign in or create an account to list an item.')) return;
  openModal(`<div class="eyebrow"><span class="eyebrow-line"></span> PASS IT FORWARD</div><h2 id="modal-title">List something good.</h2><p class="modal-lede">Add a uniform, book or school essential. A family nearby may be looking for exactly this.</p>
    <form id="listing-form"><div class="form-grid">
      <div class="form-field full"><label for="listing-title">What are you sharing?</label><input id="listing-title" name="title" placeholder="e.g. White school shirt, size 30" required maxlength="70"></div>
      <div class="form-field"><label for="listing-type">Item type</label><select id="listing-type" name="type"><option>Uniform</option><option>Textbook</option><option>Sportswear</option><option>Supplies</option></select></div>
      <div class="form-field"><label for="listing-school">School</label><input id="listing-school" name="school" placeholder="School name" required maxlength="60"></div>
      <div class="form-field"><label for="listing-grade">Grade</label><select id="listing-grade" name="grade"><option>Grade 4</option><option>Grade 5</option><option selected>Grade 6</option><option>Grade 7</option><option>Grade 8</option><option>Grades 4–6</option><option>Any grade</option></select></div>
      <div class="form-field"><label for="listing-size">Size / class</label><input id="listing-size" name="size" placeholder="e.g. 30, 6 or One size" required maxlength="20"></div>
      <div class="form-field"><label for="listing-condition">Condition</label><select id="listing-condition" name="condition"><option>Like new</option><option selected>Very good</option><option>Good</option></select></div>
      <div class="form-field"><label for="listing-sharing">How to pass it on</label><select id="listing-sharing" name="sharing"><option>Free</option><option>Swap</option><option>For sale</option></select></div>
      <div class="form-field full"><label for="listing-description">A little more detail</label><textarea id="listing-description" name="description" placeholder="Size, condition, pickup area, or what you hope to exchange for…" maxlength="220"></textarea></div>
    </div><p class="form-note">Your account name is shown on the listing. Your password and session data are not public.</p><button class="button button-dark modal-submit" type="submit">Add to the community <span>↗</span></button></form>`);
  document.getElementById('listing-form').addEventListener('submit', submitListing);
  document.getElementById('listing-sharing').addEventListener('change', event => {
    const priceField = document.getElementById('listing-price-field');
    if (priceField) priceField.remove();
    if (event.target.value === 'For sale') event.target.closest('.form-field').insertAdjacentHTML('afterend', '<div class="form-field" id="listing-price-field"><label for="listing-price">Price in ₹</label><input id="listing-price" name="price" type="number" min="1" placeholder="150" required></div>');
  });
}

async function submitListing(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const button = event.currentTarget.querySelector('[type=submit]');
  const sharing = form.get('sharing');
  const body = {
    title: String(form.get('title')).trim(), type: form.get('type'), school: String(form.get('school')).trim(),
    grade: form.get('grade'), size: String(form.get('size')).trim(), condition: form.get('condition'),
    sharing, price: Number(form.get('price') || 0), description: String(form.get('description') || '').trim()
  };
  button.disabled = true;
  try {
    await api('/api/listings', { method: 'POST', body: JSON.stringify(body) });
    await refreshData();
    closeModal();
    activeView = 'mine';
    showAll = true;
    render();
    showToast('Your listing is saved for the community.');
  } catch (error) {
    button.disabled = false;
    showToast(error.message);
  }
}

function showDetails(id) {
  const item = listings.find(entry => entry.id === id);
  if (!item) return;
  const tone = ['uniform', 'book', 'sports', 'supplies'].includes(item.tone) ? item.tone : 'uniform';
  const buttonText = item.isMine ? 'Close' : item.requestSent ? 'Request sent ✓' : 'Ask about this item';
  const buttonClass = item.isMine ? 'button-dark' : 'button-lime';
  openModal(`<div class="detail-visual visual-${tone}"><span>${escapeHtml(item.icon || '🎒')}</span><span class="detail-match">${score(item) >= 80 ? 'CLOSE MATCH' : 'NEARBY FIND'}</span></div><div class="eyebrow"><span class="eyebrow-line"></span>${escapeHtml(item.type)} · ${escapeHtml(item.condition).toUpperCase()}</div><h2 id="modal-title">${escapeHtml(item.title)}</h2><p class="modal-lede">${escapeHtml(item.description)}</p><div class="detail-list"><div><small>School</small><strong>${escapeHtml(item.school)}</strong></div><div><small>Grade</small><strong>${escapeHtml(item.grade)}</strong></div><div><small>Size / class</small><strong>${escapeHtml(item.size)}</strong></div><div><small>Pass it on</small><strong>${escapeHtml(item.sharing)}</strong></div>${item.isMine ? `<div><small>Requests</small><strong>${item.requestCount || 0}</strong></div>` : ''}</div><div class="detail-owner"><span class="owner-avatar">${escapeHtml(item.initial || '?')}</span><span><strong>${escapeHtml(item.isMine ? 'Your listing' : item.owner)}</strong><br>${escapeHtml(item.area)} · ${escapeHtml(item.distance || 'Nearby')}</span></div><button class="button ${buttonClass} modal-submit" id="request-item" ${item.isMine || item.requestSent ? 'disabled' : ''}>${buttonText} ${item.isMine || item.requestSent ? '' : '<span>↗</span>'}</button>`);
  document.getElementById('request-item').addEventListener('click', async () => {
    if (requireAccount(() => showDetails(id), 'Sign in to send a request to this family.')) return;
    const button = document.getElementById('request-item');
    button.disabled = true;
    try {
      await api(`/api/listings/${encodeURIComponent(id)}/request`, { method: 'POST', body: '{}' });
      await refreshData();
      closeModal();
      showToast('Request saved. The listing owner can see it in their listing details.');
    } catch (error) {
      button.disabled = false;
      showToast(error.message);
    }
  });
}

async function signOut() {
  try {
    await api('/api/auth/signout', { method: 'POST', body: '{}' });
    currentUser = null;
    activeView = 'browse';
    await refreshData();
    showToast('You have signed out.');
  } catch (error) {
    showToast(error.message);
  }
}

function setView(view) {
  if (view === 'mine' && requireAccount(() => setView('mine'), 'Sign in to see and manage your listings.')) return;
  activeView = view;
  showAll = view === 'mine';
  document.querySelector('.site-header').classList.remove('menu-open');
  render();
  if (view === 'impact') {
    document.querySelector('.proof-strip').scrollIntoView({ behavior: 'smooth' });
    showToast('These counts come from saved community listings and requests.');
  } else {
    document.getElementById('browse-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

document.getElementById('listing-grid').addEventListener('click', event => {
  const save = event.target.closest('[data-save]');
  if (save) {
    event.stopPropagation();
    if (savedListings.has(save.dataset.save)) savedListings.delete(save.dataset.save); else savedListings.add(save.dataset.save);
    render();
    showToast(savedListings.has(save.dataset.save) ? 'Saved to your shortlist.' : 'Removed from your shortlist.');
    return;
  }
  const card = event.target.closest('[data-detail]');
  if (card) showDetails(card.dataset.detail);
});

document.querySelectorAll('.nav-link').forEach(link => link.addEventListener('click', () => setView(link.dataset.view)));
document.querySelectorAll('[data-scroll-browse]').forEach(button => button.addEventListener('click', () => document.getElementById('browse-section').scrollIntoView({ behavior: 'smooth' })));
['search-input', 'school-filter', 'grade-filter', 'type-filter'].forEach(id => document.getElementById(id).addEventListener(id === 'search-input' ? 'input' : 'change', () => { showAll = false; render(); }));
document.getElementById('filter-size').addEventListener('click', () => { sizeOn = !sizeOn; showAll = false; render(); });
document.querySelector('#size-tag button').addEventListener('click', () => { sizeOn = false; render(); });
document.getElementById('sort-button').addEventListener('click', () => { sortRecent = !sortRecent; render(); });
document.getElementById('load-more').addEventListener('click', () => { if (showAll) { showAll = false; document.getElementById('browse-section').scrollIntoView({ behavior: 'smooth' }); } else showAll = true; render(); });
['add-listing-top', 'empty-add', 'community-list'].forEach(id => document.getElementById(id).addEventListener('click', addListingModal));
document.getElementById('auth-button').addEventListener('click', () => showAuth('signin'));
document.getElementById('signout-button').addEventListener('click', signOut);
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-backdrop').addEventListener('click', event => { if (event.target.id === 'modal-backdrop') closeModal(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeModal();
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.getElementById('search-input').focus(); }
});
document.getElementById('mobile-menu').addEventListener('click', () => document.querySelector('.site-header').classList.toggle('menu-open'));

refreshData().catch(error => {
  render();
  showToast(`Start the backend with npm start. ${error.message}`);
});

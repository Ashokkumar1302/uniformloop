const STORAGE_KEY = 'uniformloop-listings-v1';
const demoListings = [
  {id:'ul-101',title:'White school shirt · age 11–12',type:'Uniform',school:'Riverdale Public School',grade:'Grade 6',size:'30',condition:'Like new',sharing:'Free',price:0,owner:'Aarohi',initial:'A',area:'Kothrud',distance:'0.8 km',description:'Worn for one term, freshly washed and in excellent shape. Passing it on because my son has moved up a size.',icon:'👕',tone:'uniform',created:12},
  {id:'ul-102',title:'Maths textbook · Grade 6',type:'Textbook',school:'Riverdale Public School',grade:'Grade 6',size:'6',condition:'Good',sharing:'Free',price:0,owner:'Meera',initial:'M',area:'Erandwane',distance:'1.2 km',description:'A few notes in pencil on the first pages, all erased. No missing pages. Happy to bundle with the science book.',icon:'📗',tone:'book',created:11},
  {id:'ul-103',title:'Checked pinafore · size 30',type:'Uniform',school:'Riverdale Public School',grade:'Grade 6',size:'30',condition:'Very good',sharing:'Swap',price:0,owner:'You',initial:'Y',area:'Deccan',distance:'1.4 km',description:'Our daughter has outgrown this pinafore. Looking to swap for size 32, but happy to gift it if it helps another family.',icon:'👗',tone:'uniform',created:10},
  {id:'ul-104',title:'Sports uniform set · size 32',type:'Sportswear',school:'Greenfield Academy',grade:'Grade 7',size:'32',condition:'Good',sharing:'₹150',price:150,owner:'Kabir',initial:'K',area:'Aundh',distance:'2.1 km',description:'T-shirt and shorts as a set. A small name label inside; otherwise clean and ready for another year.',icon:'🎽',tone:'sports',created:9},
  {id:'ul-105',title:'Oxford English reader · Grade 5',type:'Textbook',school:'St. Mary’s School',grade:'Grade 5',size:'5',condition:'Like new',sharing:'Free',price:0,owner:'Nisha',initial:'N',area:'Shivajinagar',distance:'2.4 km',description:'Bought new last year and barely used. Keeping the cover on it paid off!',icon:'📘',tone:'book',created:8},
  {id:'ul-106',title:'Navy blue trousers · size 30',type:'Uniform',school:'Riverdale Public School',grade:'Grade 6',size:'30',condition:'Good',sharing:'Swap',price:0,owner:'Rohan',initial:'R',area:'Karve Nagar',distance:'2.6 km',description:'Two pairs, both in good condition. Would love a size 32 exchange, but a free handoff is fine too.',icon:'👖',tone:'uniform',created:7},
  {id:'ul-107',title:'Art kit · Grade 4–6',type:'Supplies',school:'Any school',grade:'Grades 4–6',size:'One size',condition:'Very good',sharing:'Free',price:0,owner:'Tara',initial:'T',area:'Model Colony',distance:'2.8 km',description:'Watercolours, ruler, compass and a nearly full sketchbook. Everything works, ready to use.',icon:'🎨',tone:'supplies',created:6},
  {id:'ul-108',title:'PE track jacket · size 34',type:'Sportswear',school:'Greenfield Academy',grade:'Grade 8',size:'34',condition:'Good',sharing:'₹200',price:200,owner:'Dev',initial:'D',area:'Baner',distance:'3.0 km',description:'Warm track jacket, zipper works perfectly. Small scuff on one sleeve shown in the photo.',icon:'🧥',tone:'sports',created:5},
  {id:'ul-109',title:'Science workbook · Grade 6',type:'Textbook',school:'Riverdale Public School',grade:'Grade 6',size:'6',condition:'Good',sharing:'Free',price:0,owner:'Ishita',initial:'I',area:'Prabhat Road',distance:'3.2 km',description:'A few completed exercises in pencil, with plenty of room left. Can meet near the school gate.',icon:'📙',tone:'book',created:4},
  {id:'ul-110',title:'School belt & tie set',type:'Supplies',school:'Riverdale Public School',grade:'Grade 6',size:'One size',condition:'Like new',sharing:'Free',price:0,owner:'You',initial:'Y',area:'Deccan',distance:'1.4 km',description:'Spare belt and tie, both barely used. Add these to your uniform set at no cost.',icon:'🎒',tone:'supplies',created:3}
];

let listings = loadListings();
let activeView = 'browse';
let sizeOn = false;
let sortRecent = false;
let showAll = false;
let toastTimer;

function loadListings(){
  try { const saved = localStorage.getItem(STORAGE_KEY); if(saved) return JSON.parse(saved); } catch(e) { /* use demo data if local storage is unavailable */ }
  return demoListings.map(item => ({...item}));
}
function saveListings(){ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(listings)); } catch(e) { /* the prototype still works for this session */ } }
function escapeHtml(value){ return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function getFilters(){
  return {
    query: document.getElementById('search-input').value.trim().toLowerCase(),
    school: document.getElementById('school-filter').value,
    grade: document.getElementById('grade-filter').value,
    type: document.getElementById('type-filter').value,
    size: sizeOn ? '30' : ''
  };
}
function score(item){
  const f=getFilters();let earned=0,total=0;
  if(f.school!=='all'){total+=50;if(item.school===f.school||item.school==='Any school')earned+=50;}
  if(f.grade!=='all'){total+=30;const gradeNumber=f.grade.match(/\d+/)?.[0];if(item.grade===f.grade||item.grade==='Any grade'||(gradeNumber&&item.grade.includes(gradeNumber)))earned+=30;}
  if(f.size){total+=20;if(item.size===f.size||item.size==='One size')earned+=20;}
  return total?Math.round(earned/total*100):0;
}
function visibleListings(){
  const f = getFilters();
  let items = listings.filter(item => {
    if(activeView === 'mine' && item.owner !== 'You') return false;
    if(f.type !== 'all' && item.type !== f.type) return false;
    const haystack = `${item.title} ${item.school} ${item.type} ${item.grade} ${item.area}`.toLowerCase();
    return !f.query || haystack.includes(f.query);
  });
  items.sort(sortRecent ? (a,b) => b.created-a.created : (a,b) => score(b)-score(a));
  return items;
}
function listingCard(item){
  const tone = ['uniform','book','sports','supplies'].includes(item.tone) ? item.tone : 'uniform';
  const label = item.condition === 'Like new' ? 'GENTLY LOVED' : item.condition.toUpperCase();
  const fit=score(item);const match = fit >= 70 ? `<span class="match-pill">${fit}% MATCH</span>` : '';
  return `<article class="item-card">
    <button class="card-click" data-detail="${escapeHtml(item.id)}" aria-label="View ${escapeHtml(item.title)}">
      <div class="item-visual visual-${tone}"><span class="condition-tag">${item.status==='requested'?'REQUEST SENT':escapeHtml(label)}</span><span class="distance-tag">${escapeHtml(item.distance || 'Nearby')}</span><span class="item-emoji" aria-hidden="true">${escapeHtml(item.icon || '🎒')}</span>${match}</div>
      <div class="item-body"><div class="item-category"><span>${escapeHtml(item.type)}</span><span>${escapeHtml(item.grade)}</span></div><h3 class="item-title">${escapeHtml(item.title)}</h3><div class="item-meta">${escapeHtml(item.school)} · ${escapeHtml(item.size === 'One size' ? item.size : `Size ${item.size}`)}</div>
      <div class="item-footer"><span class="item-owner"><span class="owner-avatar">${escapeHtml(item.initial || item.owner.slice(0,1))}</span>${escapeHtml(item.owner === 'You' ? 'Your listing' : item.owner)} · ${escapeHtml(item.area)}</span><span class="item-price">${escapeHtml(item.sharing)}<small>${item.sharing === 'Free' ? 'to a new home' : item.sharing === 'Swap' ? 'open to exchange' : 'for the set'}</small></span></div></div>
    </button><button class="item-heart" data-save="${escapeHtml(item.id)}" aria-label="Save ${escapeHtml(item.title)}">♡</button>
  </article>`;
}
function render(){
  const items = visibleListings();
  const shown = showAll ? items : items.slice(0,8);
  document.getElementById('listing-grid').innerHTML = shown.map(listingCard).join('');
  document.getElementById('listing-grid').hidden = items.length === 0;
  document.getElementById('no-results').hidden = items.length !== 0;
  document.getElementById('result-count').textContent = `${items.length} ${items.length === 1 ? 'item' : 'items'} nearby`;
  document.getElementById('showing-count').textContent = shown.length;
  document.getElementById('total-count').textContent = items.length;
  document.getElementById('mine-count').textContent = listings.filter(item => item.owner === 'You').length;
  document.getElementById('size-tag').hidden = !sizeOn;
  document.getElementById('filter-size').innerHTML = sizeOn ? 'My size <span>×</span>' : 'My size <span>＋</span>';
  document.getElementById('sort-button').innerHTML = `${sortRecent ? 'Recently added' : 'Best match'} <span>⌄</span>`;
  document.getElementById('load-more').textContent = showAll ? 'Back to top ↑' : 'See all listings →';
  const schools = [...new Set(listings.map(item => item.school).filter(school => school !== 'Any school'))].sort();
  const schoolSelect = document.getElementById('school-filter');
  const chosen = schoolSelect.value;
  schoolSelect.innerHTML = '<option value="all">All schools</option>' + schools.map(school => `<option value="${escapeHtml(school)}">${escapeHtml(school)}</option>`).join('');
  schoolSelect.value = schools.includes(chosen) ? chosen : 'all';
  document.querySelectorAll('.nav-link').forEach(link => link.classList.toggle('active', link.dataset.view === activeView));
  document.getElementById('section-title').innerHTML = activeView==='mine' ? 'Your items are <em>moving.</em>' : 'Find a <em>close</em> match.';
  document.getElementById('market-eyebrow').innerHTML = activeView==='mine' ? '<span class="eyebrow-line"></span> YOUR COMMUNITY LISTINGS' : '<span class="eyebrow-line"></span> GOOD THINGS, READY TO GO';
  const userListings = listings.filter(item => item.owner === 'You').length;
  document.getElementById('stat-items').textContent = String(128 + Math.max(0,listings.length-demoListings.length)*2);
  document.getElementById('stat-savings').textContent = `₹${42 + userListings}k`;
}
function openModal(html){ document.getElementById('modal-content').innerHTML = html; document.getElementById('modal-backdrop').hidden = false; document.body.style.overflow='hidden'; }
function closeModal(){ document.getElementById('modal-backdrop').hidden = true; document.body.style.overflow=''; }
function showToast(message){ const toast=document.getElementById('toast'); toast.textContent=message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove('show'),2700); }
function addListingModal(){
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
    </div><p class="form-note">Your exact address is never shown in a public listing.</p><button class="button button-dark modal-submit" type="submit">Add to the community <span>↗</span></button></form>`);
  document.getElementById('listing-form').addEventListener('submit',submitListing);
  document.getElementById('listing-sharing').addEventListener('change',event=>{const price=document.getElementById('listing-price-field'); if(price) price.remove(); if(event.target.value==='For sale'){event.target.closest('.form-field').insertAdjacentHTML('afterend','<div class="form-field" id="listing-price-field"><label for="listing-price">Price in ₹</label><input id="listing-price" name="price" type="number" min="1" placeholder="150" required></div>');}});
}
function submitListing(event){
  event.preventDefault(); const data=new FormData(event.currentTarget); const type=data.get('type'); const sharingChoice=data.get('sharing');
  const item={id:`ul-${Date.now()}`,title:data.get('title').trim(),type,school:data.get('school').trim(),grade:data.get('grade'),size:data.get('size').trim(),condition:data.get('condition'),sharing:sharingChoice==='For sale'?`₹${Number(data.get('price')||0)}`:sharingChoice,price:Number(data.get('price')||0),owner:'You',initial:'Y',area:'Your area',distance:'Nearby',description:data.get('description').trim()||'A useful school essential, ready for another family.',icon:({Uniform:'👕',Textbook:'📗',Sportswear:'🎽',Supplies:'🎒'})[type],tone:({Uniform:'uniform',Textbook:'book',Sportswear:'sports',Supplies:'supplies'})[type],created:Date.now()};
  listings.unshift(item); saveListings(); closeModal(); activeView='browse'; showAll=true; render(); showToast('Your listing is live. Thanks for passing it on!');
}
function showDetails(id){
  const item=listings.find(entry=>entry.id===id); if(!item)return;
  const tone=['uniform','book','sports','supplies'].includes(item.tone)?item.tone:'uniform';
  const isMine=item.owner==='You';
  openModal(`<div class="detail-visual visual-${tone}"><span>${escapeHtml(item.icon||'🎒')}</span><span class="detail-match">${score(item)>=80?'CLOSE MATCH':'NEARBY FIND'}</span></div><div class="eyebrow"><span class="eyebrow-line"></span>${escapeHtml(item.type)} · ${escapeHtml(item.condition).toUpperCase()}</div><h2 id="modal-title">${escapeHtml(item.title)}</h2><p class="modal-lede">${escapeHtml(item.description)}</p><div class="detail-list"><div><small>School</small><strong>${escapeHtml(item.school)}</strong></div><div><small>Grade</small><strong>${escapeHtml(item.grade)}</strong></div><div><small>Size / class</small><strong>${escapeHtml(item.size)}</strong></div><div><small>Pass it on</small><strong>${escapeHtml(item.sharing)}</strong></div></div><div class="detail-owner"><span class="owner-avatar">${escapeHtml(item.initial||'?')}</span><span><strong>${escapeHtml(item.owner==='You'?'Your listing':item.owner)}</strong><br>${escapeHtml(item.area)} · ${escapeHtml(item.distance||'Nearby')}</span></div><button class="button ${isMine?'button-dark':'button-lime'} modal-submit" id="request-item" ${item.status==='requested'?'disabled':''}>${isMine?'Manage your listing':item.status==='requested'?'Request sent ✓':'Ask about this item'} <span>↗</span></button>`);
  document.getElementById('request-item').addEventListener('click',()=>{
    if(isMine){closeModal();activeView='mine';render();showToast('Showing your community listings.');return;}
    item.status='requested';saveListings();closeModal();render();showToast(`Request noted for ${item.title}. Arrange a safe handoff with the family.`);
  });
}
function setView(view){activeView=view;showAll=view==='mine';document.querySelector('.site-header').classList.remove('menu-open');render();if(view==='impact'){document.querySelector('.proof-strip').scrollIntoView({behavior:'smooth'});showToast('Every handoff keeps useful things in use.');}else{document.getElementById('browse-section').scrollIntoView({behavior:'smooth',block:'start'});}}

document.getElementById('listing-grid').addEventListener('click',event=>{
  const save=event.target.closest('[data-save]');if(save){event.stopPropagation();save.classList.toggle('saved');save.textContent=save.classList.contains('saved')?'♥':'♡';showToast(save.classList.contains('saved')?'Saved to your shortlist.':'Removed from your shortlist.');return;}
  const card=event.target.closest('[data-detail]');if(card)showDetails(card.dataset.detail);
});
document.querySelectorAll('.nav-link').forEach(link=>link.addEventListener('click',()=>setView(link.dataset.view)));
document.querySelectorAll('[data-scroll-browse]').forEach(button=>button.addEventListener('click',()=>document.getElementById('browse-section').scrollIntoView({behavior:'smooth'})));
['search-input','school-filter','grade-filter','type-filter'].forEach(id=>document.getElementById(id).addEventListener(id==='search-input'?'input':'change',()=>{showAll=false;render();}));
document.getElementById('filter-size').addEventListener('click',()=>{sizeOn=!sizeOn;showAll=false;render();});
document.querySelector('#size-tag button').addEventListener('click',()=>{sizeOn=false;render();});
document.getElementById('sort-button').addEventListener('click',()=>{sortRecent=!sortRecent;render();});
document.getElementById('load-more').addEventListener('click',()=>{if(showAll){showAll=false;document.getElementById('browse-section').scrollIntoView({behavior:'smooth'});}else showAll=true;render();});
['add-listing-top','empty-add','community-list'].forEach(id=>document.getElementById(id).addEventListener('click',addListingModal));
document.getElementById('modal-close').addEventListener('click',closeModal);
document.getElementById('modal-backdrop').addEventListener('click',event=>{if(event.target.id==='modal-backdrop')closeModal();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeModal();if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();document.getElementById('search-input').focus();}});
document.getElementById('mobile-menu').addEventListener('click',()=>document.querySelector('.site-header').classList.toggle('menu-open'));
render();

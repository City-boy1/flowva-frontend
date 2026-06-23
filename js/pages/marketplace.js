// flowva marketplace.js — Full Cinematic Edition v2
import AppState from '../core/state.js';
import api      from '../core/api.js';

document.addEventListener('DOMContentLoaded', async () => {

  // ── Utils ──────────────────────────────────────────────────────────────
  function _esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
  }

  function showToast(msg, type = 'success') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.innerHTML = `<span class="toast-icon">${type==='success'?'✓':type==='error'?'✕':'ℹ'}</span><span class="toast-msg">${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 4000);
  }

  // ── Ambient background orbs ────────────────────────────────────────────
  function initAmbient() {
    const colors = ['124,58,237','79,70,229','167,139,250'];
    colors.forEach((c,i) => {
      const orb = document.createElement('div');
      orb.className = 'mkt-ambient';
      orb.style.cssText = `width:600px;height:600px;background:rgb(${c});
        top:${[20,50,70][i]}%;left:${[10,60,30][i]}%;
        animation:mkt-orb-float ${[18,22,16][i]}s ease-in-out infinite ${[0,6,12][i]}s alternate;`;
      document.body.appendChild(orb);
    });
  }
  initAmbient();

  // ── Animate cards in ──────────────────────────────────────────────────
  function animateIn(container, selector='.mkt-card,.tutorial-card') {
    container.querySelectorAll(selector).forEach((card,i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(40px) scale(0.95)';
      card.style.transition = `opacity 0.65s cubic-bezier(0.16,1,0.3,1) ${i*55}ms,
                               transform 0.65s cubic-bezier(0.16,1,0.3,1) ${i*55}ms`;
      requestAnimationFrame(()=>requestAnimationFrame(()=>{
        card.style.opacity='1';
        card.style.transform='translateY(0) scale(1)';
      }));
    });
    setTimeout(()=>bindTilt(container), 800);
    bindVideoAutoplay(container);
  }

  // ── 3D tilt ────────────────────────────────────────────────────────────
  function bindTilt(container) {
    container.querySelectorAll('.mkt-card').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r=card.getBoundingClientRect();
        const x=(e.clientX-r.left)/r.width-0.5;
        const y=(e.clientY-r.top)/r.height-0.5;
        card.style.transform=`perspective(900px) rotateX(${y*-9}deg) rotateY(${x*9}deg) translateY(-8px) scale(1.02)`;
        card.style.transition='transform 0.1s ease,box-shadow 0.1s ease,border-color 0.1s ease';
        card.style.borderColor='rgba(124,58,237,0.55)';
        card.style.boxShadow='0 24px 60px rgba(124,58,237,0.22),0 0 0 1px rgba(124,58,237,0.1)';
      });
      card.addEventListener('mouseleave', ()=>{
        card.style.transform='';
        card.style.transition='transform 0.7s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.5s ease,border-color 0.5s ease';
        card.style.borderColor='';card.style.boxShadow='';
        setTimeout(()=>card.style.transition='',700);
      });
    });
  }

  // ── Video autoplay ─────────────────────────────────────────────────────
  function bindVideoAutoplay(container) {
    const cards = container.querySelectorAll('.mkt-card');
    const obs = new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        const v=entry.target.querySelector('video');
        if(!v)return;
        if(entry.isIntersecting&&entry.intersectionRatio>=0.4){
          v.play().then(()=>v.classList.add('playing')).catch(()=>{});
        } else {
          v.pause();v.classList.remove('playing');v.currentTime=0;
        }
      });
    },{threshold:0.4});
    cards.forEach(card=>{
      obs.observe(card);
      const v=card.querySelector('video');
      if(!v)return;
      card.addEventListener('mouseenter',()=>{v.pause();v.classList.remove('playing');});
      card.addEventListener('mouseleave',()=>{
        const r=card.getBoundingClientRect();
        if(r.top>=-100&&r.bottom<=window.innerHeight+100)
          v.play().then(()=>v.classList.add('playing')).catch(()=>{});
      });
    });
  }

  // ── Tab switch ─────────────────────────────────────────────────────────
 function switchTab(tab) {
    document.querySelectorAll('.market-tab').forEach(btn=>{
      const on=btn.dataset.tab===tab;
      btn.classList.toggle('active',on);
          });
    document.querySelectorAll('.market-tab-panel').forEach(p=>{
      const show=p.id===`tab-${tab}`;
      if(show){
        p.style.display='block';
        p.style.opacity='0';
        requestAnimationFrame(()=>{p.style.transition='opacity 0.4s ease';p.style.opacity='1';});
      } else { p.style.display='none'; }
    });

    // ── Sync result count to active tab ──
    if(resultCount){
      if(tab==='templates'){
        resultCount.textContent=`${filtered.length} template${filtered.length!==1?'s':''}`;
      } else if(tab==='tutorials'){
        resultCount.textContent=tutFiltered.length
          ?`${tutFiltered.length} tutorial${tutFiltered.length!==1?'s':''}`
          :'0 tutorials';
      }
    }

    // Persist tab in URL so refresh restores it
const url = new URL(window.location);
url.searchParams.set('tab', tab);
window.history.replaceState({}, '', url);

if(tab==='tutorials'&&!_tutLoaded){_tutLoaded=true;loadTutorials();}
  }

  document.querySelectorAll('.market-tab').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));

  const urlParams=new URLSearchParams(window.location.search);
  const initialTab=urlParams.get('tab')==='tutorials'?'tutorials':'templates';

  // ══════════════════════════════════════════════════════════════════════
  // TEMPLATES
  // ══════════════════════════════════════════════════════════════════════
  let allTemplates=[],filtered=[],visibleCount=12,activeCategory='all';
  function _favKey() {
  const user = AppState.getUser();
  return user?.id ? `fv_favorites_${user.id}` : null;
}
function _loadFavs() {
  const key = _favKey();
  if(!key) return [];
  try { return JSON.parse(localStorage.getItem(key)||'[]'); } catch { return []; }
}
let favorites = _loadFavs();

  const HEART_OUT=`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  const HEART_IN=`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  const GRADS=['linear-gradient(135deg,#1a0a3e,#4c1d95)','linear-gradient(135deg,#0c1445,#1e3a5f)','linear-gradient(135deg,#0f2027,#203a43)','linear-gradient(135deg,#0a2018,#0f4030)','linear-gradient(135deg,#1a1208,#3d2c00)'];
  // ── Creator cache ──────────────────────────────────────────────────────
const _creatorCache = {};

async function getCreatorName(id) {
  if(!id) return 'Unknown Creator';
  if(_creatorCache[id]) return _creatorCache[id];
  const res = await api.users.getCreatorById(id);
  console.log('Creator API response for', id, ':', JSON.stringify(res.data));
  if(res.ok && res.data) {
    const name = res.data.name
      ?? res.data.username
      ?? res.data.user?.name
      ?? res.data.user?.username
      ?? res.data.creator?.name
      ?? res.data.data?.name
      ?? null;
    if(name){ _creatorCache[id] = name; return name; }
  }
  return 'Unknown Creator';
}

  const CATEGORIES=[
    {value:'all',label:'All'},{value:'animation',label:'Animation'},
    {value:'logo',label:'Logo'},{value:'social',label:'Social Media'},
    {value:'motion',label:'Motion Graphics'},{value:'intro',label:'Intro'},
    {value:'flyer',label:'Flyer'},{value:'branding',label:'Branding'},
    {value:'youtube',label:'YouTube Kit'},{value:'slides',label:'Slides'},
    {value:'gaming',label:'Gaming'},{value:'effects',label:'Effects'},
    {value:'event',label:'Event'},{value:'resume',label:'Resume'},
    {value:'broadcast',label:'Broadcast'},
  ];


  // Upgrade existing filter elements
  const searchInput=document.getElementById('market-search');
  const sortSelect=document.getElementById('market-sort');
  const priceSelect=document.getElementById('market-price');
  const loadMoreBtn=document.getElementById('load-more');
  const pillsBar=document.getElementById('category-pills');
  const resultCount=document.getElementById('result-count');

  // Style existing filter bar
  function buildPills() {
    if(!pillsBar)return;
    pillsBar.innerHTML=`<select class="filter-select" id="category-select" size="1" style="max-height:42px">
      ${CATEGORIES.map(c=>`<option value="${_esc(c.value)}" ${c.value===activeCategory?'selected':''}>${_esc(c.label)}</option>`).join('')}
    </select>`;
    pillsBar.querySelector('#category-select').addEventListener('change', function() {
      activeCategory = this.value;
      visibleCount = 12;
      applyFilters();
    });
  }


  async function fetchTemplates() {
    const skelGrid=document.getElementById('skeleton-grid');
    const grid=document.getElementById('market-grid');
    skelGrid?.classList.remove('hidden');
    if(grid)grid.innerHTML='';
    const res=await api.templates.list({limit:100});
    skelGrid?.classList.add('hidden');
    if(!res.ok||!res.data?.templates){
      if(grid)grid.innerHTML=`<div class="mkt-empty"><div class="mkt-empty-icon">!</div><h3>Failed to load</h3><p>Please refresh the page.</p></div>`;
      return;
    }
    allTemplates=res.data.templates;
    buildPills();applyFilters();

    const buyParam=urlParams.get('buy');
    if(buyParam){
      const t=allTemplates.find(t=>String(t._id)===buyParam||String(t.id)===buyParam);
      if(t)setTimeout(()=>openBuyModal(String(t._id??t.id),t.title,t.price),300);
    }

    const rateParam   = urlParams.get('rate');
    const rateOrderId = urlParams.get('orderId');
    const rateTitle   = urlParams.get('title');
    if (rateParam && rateOrderId) {
      window.history.replaceState({}, '', 'marketplace.html');
      setTimeout(() => openRateTemplateModal(rateParam, decodeURIComponent(rateTitle || ''), rateOrderId), 400);
    }
    const hlParam=urlParams.get('template');
    if(hlParam){
      setTimeout(()=>{
        const card=document.querySelector(`[data-id="${hlParam}"]`);
        if(card){card.scrollIntoView({behavior:'smooth',block:'center'});card.style.outline='2px solid var(--accent-hover)';setTimeout(()=>card.style.outline='',3000);}
      },400);
    }
  }

  function applyFilters() {
    const q=(searchInput?.value??'').toLowerCase().trim();
    const price=priceSelect?.value??'all';
    const sort=sortSelect?.value??'trending';
    filtered=allTemplates.filter(t=>{
      if(activeCategory!=='all'&&t.category!==activeCategory)return false;
      if(q&&!t.title.toLowerCase().includes(q)&&!(t.description??'').toLowerCase().includes(q)&&!(t.creator?.name??'').toLowerCase().includes(q))return false;
      const p=Number(t.price??0);
      if(price==='free'&&p!==0)return false;
      if(price==='low'&&p>=20)return false;
      if(price==='mid'&&(p<20||p>35))return false;
      if(price==='high'&&p<=35)return false;
      return true;
    });
    filtered.sort((a,b)=>{
      switch(sort){
        case 'newest':return new Date(b.createdAt)-new Date(a.createdAt);
        case 'best-selling':return(b.salesCount||0)-(a.salesCount||0);
        case 'rating':return(b.rating||0)-(a.rating||0);
        case 'price-low':return Number(a.price)-Number(b.price);
        case 'price-high':return Number(b.price)-Number(a.price);
        default:return((b.salesCount||0)+(b.rating||0)*10)-((a.salesCount||0)+(a.rating||0)*10);
      }
    });
    if(resultCount)resultCount.textContent=`${filtered.length} template${filtered.length!==1?'s':''}`;
    renderGrid();
  }

  function renderGrid() {
    const grid=document.getElementById('market-grid');
    if(!grid)return;
    const slice=filtered.slice(0,visibleCount);
    if(!slice.length){
      grid.innerHTML=`<div class="mkt-empty"><div class="mkt-empty-icon">🔍</div><h3>No templates found</h3><p>Try different filters or search terms.</p></div>`;
      loadMoreBtn?.classList.add('hidden');return;
    }
    grid.innerHTML=slice.map((t,i)=>{
      const isFav=favorites.includes(String(t._id));
      const price=Number(t.price??0).toFixed(2);
      const rating=Number(t.rating||0);
      const stars='★'.repeat(Math.round(rating))+'☆'.repeat(5-Math.round(rating));
      const prevVid=t.previewVideoUrl??'';
      const isVideo=t.fileType==='video'&&prevVid;
      const previewUrl=t.previewUrl??'';
      return `
        <div class="mkt-card" data-id="${_esc(String(t._id??t.id))}">
          <div class="mkt-card-thumb" style="background:${GRADS[i%GRADS.length]};">
            ${previewUrl?`<img src="${_esc(previewUrl)}" alt="${_esc(t.title)}" loading="lazy">`:'' }
            ${isVideo?`<video src="${_esc(prevVid)}" muted loop playsinline preload="none"></video>`:''}
            ${!previewUrl&&!isVideo?`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:3rem;opacity:0.3;position:absolute;inset:0;">▶</div>`:''}
            <div class="mkt-card-overlay">
              <button class="btn btn--ghost btn--sm preview-btn"
                data-id="${_esc(String(t._id??t.id))}"
                data-title="${_esc(t.title)}"
                data-preview="${_esc(previewUrl)}"
                data-previewvideo="${_esc(prevVid)}"
                data-type="${_esc(t.fileType??'')}">▶ Preview</button>
              <button class="btn btn--primary btn--sm buy-btn"
                data-id="${_esc(String(t._id??t.id))}"
                data-title="${_esc(t.title)}"
                data-price="${_esc(String(price))}">Buy $${price}</button>
            </div>
            ${t.category?`<span class="mkt-badge mkt-badge--cat">${_esc(t.category)}</span>`:''}
            <button class="mkt-fav ${isFav?'active':''}" data-id="${_esc(String(t._id))}" aria-label="Favourite">
              ${isFav?HEART_IN:HEART_OUT}
            </button>
          </div>
          <div class="mkt-card-body">
            <div class="mkt-card-meta">
              <h3 class="mkt-card-title">${_esc(t.title)}</h3>
              <span class="mkt-card-price">$${price}</span>
            </div>
            ${t.creator?.name??t.creator?.username?`<a href="creator.html?id=${_esc(String(t.creator?.id??t.creator?._id??t.creatorId??''))}" class="mkt-card-creator">by ${_esc(t.creator?.name??t.creator?.username)}</a>`:'<div style="height:18px;margin-bottom:10px;"></div>'}
            <div class="mkt-card-footer">
              <div style="display:flex;align-items:center;gap:4px;">
                <span class="mkt-card-stars">${stars}</span>
                <span class="mkt-card-rating">${rating > 0 ? rating.toFixed(1) : 'No ratings'}</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                ${(() => {
                const daysSince = t.createdAt ? (Date.now() - new Date(t.createdAt)) / 86400000 : 999;
                if (t.salesCount > 0) return `<span class="mkt-card-sold">${t.salesCount} sold</span>`;
                if (daysSince <= 14) return `<span class="mkt-card-new">NEW</span>`;
                return '';
              })()}
                <button class="mkt-card-rate-btn rate-tmpl-btn"
                  data-id="${_esc(String(t._id??t.id))}"
                  data-title="${_esc(t.title)}">⭐ Rate</button>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');

    filtered.length>visibleCount?loadMoreBtn?.classList.remove('hidden'):loadMoreBtn?.classList.add('hidden');
    animateIn(grid,'.mkt-card');

    grid.querySelectorAll('.mkt-fav').forEach(btn=>{
      btn.addEventListener('click',e=>{
        e.stopPropagation();
        const id=btn.dataset.id;
        const adding=!favorites.includes(id);
        if(adding){favorites.push(id);btn.innerHTML=HEART_IN;btn.classList.add('active');btn.style.color='#ef4444';btn.style.transform='scale(1.35)';setTimeout(()=>btn.style.transform='',300);api.post('/users/favourites',{templateId:id});showToast('Added to favourites ♥','success');}
        else{favorites=favorites.filter(f=>f!==id);btn.innerHTML=HEART_OUT;btn.classList.remove('active');btn.style.color='var(--text-muted)';api.delete(`/users/favourites/${id}`);showToast('Removed from favourites','info');}
        const _fk = _favKey();
if(_fk) localStorage.setItem(_fk, JSON.stringify(favorites));
      });
    });

    grid.querySelectorAll('.preview-btn').forEach(btn=>{
      btn.addEventListener('click',e=>{
        e.stopPropagation();
        openPreviewModal(btn.dataset.id,btn.dataset.title,btn.dataset.preview,btn.dataset.previewvideo,btn.dataset.type);
      });
    });

    grid.querySelectorAll('.buy-btn').forEach(btn=>{
      btn.addEventListener('click',e=>{
        e.stopPropagation();
        openBuyModal(btn.dataset.id,btn.dataset.title,btn.dataset.price);
      });
    });

    grid.querySelectorAll('.rate-tmpl-btn').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!AppState.isLoggedIn()) {
          showToast('Please login to rate templates', 'info');
          setTimeout(() => window.location.href = 'login.html', 700);
          return;
        }
        const id    = btn.dataset.id;
        const title = btn.dataset.title;
        // Find a completed order for this template
        const ordersRes = await api.users.getOrders();
        const order = ordersRes.ok
          ? (ordersRes.data?.orders ?? []).find(o =>
              o.mongoTemplateId === id &&
              ['PAID','COMPLETED'].includes(o.status) &&
              !o.rated
            )
          : null;
        if (!order) {
          showToast('You can only rate templates you have purchased', 'info');
          return;
        }
        openRateTemplateModal(id, title, order.id);
      });
    });
  }

  loadMoreBtn?.addEventListener('click',()=>{visibleCount+=12;renderGrid();});
  searchInput?.addEventListener('input',()=>{visibleCount=12;applyFilters();});
  sortSelect?.addEventListener('change',()=>{visibleCount=12;applyFilters();});
  priceSelect?.addEventListener('change',()=>{visibleCount=12;applyFilters();});

  // ── Preview Modal (brand new, self-contained) ──────────────────────────
  // Remove old stuck modal first
  document.getElementById('preview-modal')?.remove();

  // ── Template Rating Modal ──────────────────────────────────────────────
  const tmplRateModal = document.createElement('div');
  tmplRateModal.id = 'tmpl-rate-modal';
  tmplRateModal.innerHTML = `
    <div class="tmpl-rate-box">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <h3 style="font-family:var(--font-display);font-size:1.05rem;font-weight:700;">Rate this Template</h3>
        <button id="tmpl-rate-close" style="background:var(--bg-overlay);border:1px solid var(--border);border-radius:50%;width:30px;height:30px;color:var(--text-muted);cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>
      <p id="tmpl-rate-subtitle" style="font-size:0.82rem;color:var(--text-muted);margin-bottom:0;"></p>
      <div class="tmpl-rate-stars" id="tmpl-rate-stars">
        ${[1,2,3,4,5].map(n=>`<span data-score="${n}">★</span>`).join('')}
      </div>
      <textarea class="tmpl-rate-review" id="tmpl-rate-review" rows="3" maxlength="500" placeholder="Share your experience (optional)…"></textarea>
      <p id="tmpl-rate-error" style="color:var(--danger);font-size:0.8rem;margin-top:8px;display:none;"></p>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px;">
        <button class="btn btn--ghost btn--sm" id="tmpl-rate-cancel">Cancel</button>
        <button class="btn btn--primary btn--sm" id="tmpl-rate-submit">Submit Rating ⭐</button>
      </div>
    </div>`;
  document.body.appendChild(tmplRateModal);

  let _rateTemplateId = null;
  let _rateOrderId    = null;
  let _rateScore      = 0;

  function _paintRateStars(upTo) {
    tmplRateModal.querySelectorAll('#tmpl-rate-stars span').forEach(s => {
      const on = Number(s.dataset.score) <= Number(upTo);
      s.classList.toggle('lit', on);
      s.style.transform = on ? 'scale(1.15)' : '';
    });
  }

  tmplRateModal.querySelectorAll('#tmpl-rate-stars span').forEach(star => {
    star.addEventListener('mouseover', () => _paintRateStars(star.dataset.score));
    star.addEventListener('mouseout',  () => _paintRateStars(_rateScore));
    star.addEventListener('click',     () => {
      _rateScore = Number(star.dataset.score);
      _paintRateStars(_rateScore);
      // Bounce animation
      star.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)';
      star.style.transform = 'scale(1.5)';
      setTimeout(() => { star.style.transform = 'scale(1.15)'; }, 200);
    });
  });

  function openRatePrompt(templateId, templateTitle, orderId) {
  document.getElementById('fv-rate-prompt')?.remove();
  const el = document.createElement('div');
  el.id = 'fv-rate-prompt';
  el.className = 'fv-rate-prompt';
  el.innerHTML = `
    <div class="fv-rate-prompt-box">
      <div class="fv-rate-prompt-emoji">🎉</div>
      <div class="fv-rate-prompt-title">Purchase Successful!</div>
      <p class="fv-rate-prompt-sub">You just bought <strong>${_esc(templateTitle)}</strong>.<br>How would you rate it?</p>
      <div class="fv-rate-prompt-actions">
        <button class="btn btn--primary btn--sm" id="fv-rate-prompt-yes">⭐ Rate Now</button>
        <button class="btn btn--ghost btn--sm" id="fv-rate-prompt-skip">Maybe Later</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('open'));
  document.body.style.overflow='hidden';

  function closePrompt(){
    el.classList.remove('open');
    document.body.style.overflow='';
    setTimeout(()=>el.remove(),300);
  }
  el.querySelector('#fv-rate-prompt-yes').addEventListener('click',()=>{
    closePrompt();
    setTimeout(()=>openRateTemplateModal(templateId, templateTitle, orderId), 350);
  });
  el.querySelector('#fv-rate-prompt-skip').addEventListener('click', closePrompt);
  el.addEventListener('click', e=>{ if(e.target===el) closePrompt(); });
}

  function openRateTemplateModal(templateId, templateTitle, orderId) {
    _rateTemplateId = templateId;
    _rateOrderId    = orderId;
    _rateScore      = 0;
    _paintRateStars(0);
    const sub = tmplRateModal.querySelector('#tmpl-rate-subtitle');
    if (sub) sub.textContent = templateTitle;
    const rev = tmplRateModal.querySelector('#tmpl-rate-review');
    if (rev) rev.value = '';
    const err = tmplRateModal.querySelector('#tmpl-rate-error');
    if (err) err.style.display = 'none';
    const btn = tmplRateModal.querySelector('#tmpl-rate-submit');
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Rating ⭐'; }
    tmplRateModal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeRateTemplateModal() {
    tmplRateModal.classList.remove('open');
    document.body.style.overflow = '';
  }

  tmplRateModal.querySelector('#tmpl-rate-close')?.addEventListener('click', closeRateTemplateModal);
  tmplRateModal.querySelector('#tmpl-rate-cancel')?.addEventListener('click', closeRateTemplateModal);
  tmplRateModal.addEventListener('click', e => { if (e.target === tmplRateModal) closeRateTemplateModal(); });

  tmplRateModal.querySelector('#tmpl-rate-submit')?.addEventListener('click', async () => {
    const errEl = tmplRateModal.querySelector('#tmpl-rate-error');
    if (!_rateScore) {
      errEl.textContent = 'Please select a star rating first.';
      errEl.style.display = 'block';
      // Shake animation
      const box = tmplRateModal.querySelector('.tmpl-rate-box');
      box.style.animation = 'none';
      box.style.transform = 'translateX(-8px)';
      setTimeout(() => { box.style.transform = 'translateX(8px)'; }, 80);
      setTimeout(() => { box.style.transform = 'translateX(0)'; box.style.transition = 'transform 0.3s ease'; }, 160);
      return;
    }
    const btn = tmplRateModal.querySelector('#tmpl-rate-submit');
    btn.disabled = true; btn.textContent = 'Submitting…';
    errEl.style.display = 'none';

    const review = tmplRateModal.querySelector('#tmpl-rate-review')?.value.trim();
    const res = await api.templates.rate(_rateTemplateId, {
      orderId: _rateOrderId,
      score:   _rateScore,
      review:  review || undefined,
    });

    if (!res.ok) {
      btn.disabled = false; btn.textContent = 'Submit Rating ⭐';
      errEl.textContent = res.error || 'Failed to submit. Please try again.';
      errEl.style.display = 'block';
      return;
    }

    // Update card star display in place
    const card = document.querySelector(`.mkt-card[data-id="${_rateTemplateId}"]`);
    if (card && res.data) {
      const newRating = Number(res.data.rating || 0);
      const starsEl   = card.querySelector('.mkt-card-stars');
      const ratingEl  = card.querySelector('.mkt-card-rating');
      if (starsEl) starsEl.textContent = '★'.repeat(Math.round(newRating)) + '☆'.repeat(5 - Math.round(newRating));
      if (ratingEl) ratingEl.textContent = newRating.toFixed(1);
      // Also update allTemplates cache
      const t = allTemplates.find(x => String(x._id ?? x.id) === String(_rateTemplateId));
      if (t) { t.rating = newRating; t.ratingCount = res.data.ratingCount; }
    }

    showToast('Rating submitted! ⭐ Thank you.', 'success');
    closeRateTemplateModal();
  });

  const previewModal=document.createElement('div');
  previewModal.id='fv-preview-modal';
  previewModal.innerHTML=`
    <div class="fv-modal-box">
      <div class="fv-modal-head">
        <h2 id="fv-modal-title">Preview</h2>
        <button class="fv-modal-close" id="fv-modal-close">✕</button>
      </div>
      <div class="fv-modal-media" id="fv-modal-media"></div>
      <div class="fv-modal-tabs" id="fv-modal-tabs">
        <button class="fv-modal-tab active" data-panel="details">Details</button>
        <button class="fv-modal-tab" data-panel="reviews">Reviews <span id="fv-review-count-tab" style="font-size:0.75rem;opacity:0.7;margin-left:4px;"></span></button>
      </div>
      <div class="fv-modal-tab-panel active" id="fv-panel-details">
        <div id="fv-modal-foot"></div>
      </div>
      <div class="fv-modal-tab-panel" id="fv-panel-reviews">
        <div id="fv-reviews-content">
          <div class="fv-reviews-loading">
            <div class="sk" style="width:38px;height:38px;border-radius:50%;flex-shrink:0;"></div>
            <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
              <div class="sk" style="height:12px;width:60%;"></div>
              <div class="sk" style="height:12px;width:90%;"></div>
              <div class="sk" style="height:12px;width:75%;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(previewModal);

  function openPreviewModal(id,title,previewUrl,previewVideoUrl,fileType){
    const titleEl=document.getElementById('fv-modal-title');
    const media=document.getElementById('fv-modal-media');
    const foot=document.getElementById('fv-modal-foot');
    _previewTemplateId = id;
    // Reset tabs to Details on every open
    previewModal.querySelectorAll('.fv-modal-tab').forEach((t,i) => {
      t.classList.toggle('active', i===0);
      delete t.dataset.loaded;
    });
    previewModal.querySelectorAll('.fv-modal-tab-panel').forEach((p,i) => p.classList.toggle('active', i===0));
    const countEl = document.getElementById('fv-review-count-tab');
    if (countEl) countEl.textContent = '';
    if(titleEl)titleEl.textContent=title;
    const isVideo=fileType==='video'&&previewVideoUrl;
    if(media){
      if(isVideo){
  media.innerHTML=`<video controls autoplay muted loop playsinline style="width:100%;height:320px;object-fit:cover;display:block;background:#000;"><source src="${_esc(previewVideoUrl)}" type="video/mp4"></video>`;
      } else if(previewUrl){
        media.innerHTML=`<img src="${_esc(previewUrl)}" alt="${_esc(title)}" style="width:100%;max-height:220px;object-fit:cover;display:block;">`;
      } else {
        media.style.background='linear-gradient(135deg,#1a0a3e,#4c1d95)';
        media.innerHTML=`<span style="font-size:4rem;">▶</span>`;
      }
    }
    const t=allTemplates.find(x=>String(x._id??x.id)===String(id));
    if(foot&&t){
      foot.innerHTML=`
        <span style="font-size:0.85rem;color:var(--text-muted);">
          Category: <strong style="color:var(--text-primary);">${_esc(t.category??'Template')}</strong>
        </span>
        <div style="display:flex;gap:10px;">
          <button class="btn btn--ghost btn--sm" id="fv-foot-close">Close</button>
          <button class="btn btn--primary btn--sm fv-foot-buy" data-id="${_esc(String(t._id??t.id))}" data-title="${_esc(t.title)}" data-price="${_esc(String(Number(t.price??0).toFixed(2)))}">Buy $${Number(t.price??0).toFixed(2)}</button>
        </div>`;
      foot.querySelector('#fv-foot-close')?.addEventListener('click',closePreviewModal);
      foot.querySelector('.fv-foot-buy')?.addEventListener('click',btn=>{
        closePreviewModal();
        setTimeout(()=>openBuyModal(btn.target.dataset.id,btn.target.dataset.title,btn.target.dataset.price),300);
      });
    }
    previewModal.classList.add('open');
    document.body.style.overflow='hidden';
  }

  function closePreviewModal(){
    previewModal.classList.remove('open');
    document.body.style.overflow='';
    setTimeout(()=>{
      const media=document.getElementById('fv-modal-media');
      if(media){media.querySelectorAll('video').forEach(v=>{v.pause();v.src='';});media.innerHTML='';}
    },300);
  }

  // ── Modal tab switching ────────────────────────────────────────────────
  previewModal.addEventListener('click', e => {
    const tab = e.target.closest('.fv-modal-tab');
    if (!tab) return;
    previewModal.querySelectorAll('.fv-modal-tab').forEach(t => t.classList.remove('active'));
    previewModal.querySelectorAll('.fv-modal-tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`fv-panel-${tab.dataset.panel}`)?.classList.add('active');
    if (tab.dataset.panel === 'reviews' && tab.dataset.loaded !== 'true') {
      tab.dataset.loaded = 'true';
      loadPreviewReviews();
    }
  });

  let _previewTemplateId = null;

  async function loadPreviewReviews() {
    const content = document.getElementById('fv-reviews-content');
    if (!content) return;

    // Skeleton
    content.innerHTML = `
      ${[1,2,3].map(() => `
        <div class="fv-reviews-loading">
          <div class="sk" style="width:38px;height:38px;border-radius:50%;flex-shrink:0;"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:8px;padding-top:4px;">
            <div class="sk" style="height:11px;width:50%;"></div>
            <div class="sk" style="height:11px;width:85%;"></div>
            <div class="sk" style="height:11px;width:65%;"></div>
          </div>
        </div>`).join('')}`;

    const res = await api.templates.getRatings(_previewTemplateId);

    if (!res.ok || !res.data?.ratings?.length) {
      content.innerHTML = `
        <div class="fv-reviews-empty">
          <div>⭐</div>
          <p style="font-weight:600;color:var(--text-secondary);margin-bottom:6px;">No reviews yet</p>
          <p style="font-size:0.82rem;">Be the first to purchase and review this template.</p>
        </div>`;
      return;
    }

    const ratings = res.data.ratings;
    const avg = (ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(1);
    const countEl = document.getElementById('fv-review-count-tab');
    if (countEl) countEl.textContent = `(${ratings.length})`;

    content.innerHTML = `
      <div class="fv-rating-summary">
        <div>
          <div class="fv-rating-big">${avg}</div>
          <div class="fv-rating-stars-big">${'★'.repeat(Math.round(Number(avg)))}${'☆'.repeat(5 - Math.round(Number(avg)))}</div>
          <div class="fv-rating-count">${ratings.length} review${ratings.length !== 1 ? 's' : ''}</div>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
          ${[5,4,3,2,1].map(star => {
            const count = ratings.filter(r => r.score === star).length;
            const pct = ratings.length ? Math.round((count / ratings.length) * 100) : 0;
            return `
              <div style="display:flex;align-items:center;gap:8px;font-size:0.75rem;">
                <span style="color:#f59e0b;width:16px;">${star}★</span>
                <div style="flex:1;height:5px;background:var(--bg-overlay);border-radius:3px;overflow:hidden;">
                  <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#f59e0b,#fbbf24);border-radius:3px;transition:width 0.8s ease;"></div>
                </div>
                <span style="color:var(--text-muted);width:24px;">${count}</span>
              </div>`;
          }).join('')}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;">
        ${ratings.map(r => {
          const initials = (r.rater?.name || '?').trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0,2);
          const date = new Date(r.createdAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
          return `
            <div class="fv-review-item">
              <div class="fv-review-avatar">
                ${r.rater?.avatarUrl
                  ? `<img src="${r.rater.avatarUrl}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;">`
                  : initials}
              </div>
              <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                  <span style="font-weight:600;font-size:0.88rem;">${_esc(r.rater?.name || 'Anonymous')}</span>
                  <span class="fv-review-date">${date}</span>
                </div>
                <div class="fv-review-stars">${'★'.repeat(r.score)}${'☆'.repeat(5 - r.score)}</div>
                ${r.review ? `<p class="fv-review-text">${_esc(r.review)}</p>` : ''}
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }
  document.getElementById('fv-modal-close')?.addEventListener('click',closePreviewModal);
  previewModal.addEventListener('click',e=>{if(e.target===previewModal)closePreviewModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closePreviewModal();});

  // ── Buy Modal ──────────────────────────────────────────────────────────
  let _pendingBuyId=null;

  function openBuyModal(id,title,price){
  if(!AppState.isLoggedIn()){showToast('Please login to purchase','info');setTimeout(()=>window.location.href='login.html',700);return;}
  _pendingBuyId=id;
  document.getElementById('flowva-buy-modal')?.remove();
  const p=Number(price);
  const modal=document.createElement('div');
  modal.id='flowva-buy-modal';
  modal.className='modal-overlay';
  modal.innerHTML=`
    <div class="fv-buy-modal-wrap" id="flowva-buy-inner">
      <div class="fv-buy-modal-head">
        <span class="fv-buy-modal-title">Complete Purchase</span>
        <button class="fv-buy-modal-close" id="buy-modal-close">✕</button>
      </div>
      <div class="fv-buy-modal-body">
        <div class="fv-buy-modal-item-title">${_esc(title)}</div>
        <div class="fv-buy-modal-row"><span>Creator receives</span><span style="color:var(--success);">$${(p*0.7).toFixed(2)}</span></div>
        <div class="fv-buy-modal-row"><span>Platform fee</span><span>$${(p*0.3).toFixed(2)}</span></div>
        <div class="fv-buy-modal-row fv-buy-modal-row--total"><span>Total</span><span class="fv-buy-total-amount">$${p.toFixed(2)}</span></div>
      </div>
      <div class="fv-buy-modal-foot">
        <button id="helio-pay-btn" class="fv-buy-pay-btn">💳 Pay with Card</button>
        <p class="fv-buy-secure-note">Secured by Helio · Visa & Mastercard accepted</p>
        <p id="buy-modal-error" class="fv-buy-modal-error"></p>
      </div>
    </div>`;
  document.body.appendChild(modal);
  requestAnimationFrame(()=>{
    modal.classList.add('open');
    document.getElementById('flowva-buy-inner')?.classList.add('open');
  });
  document.body.style.overflow='hidden';

  function closeBuyModal(){
    modal.classList.remove('open');
    document.getElementById('flowva-buy-inner')?.classList.remove('open');
    document.body.style.overflow='';
    setTimeout(()=>modal.remove(),300);
  }
  modal.querySelector('#buy-modal-close').addEventListener('click',closeBuyModal);
  modal.addEventListener('click',e=>{if(e.target===modal)closeBuyModal();});

  modal.querySelector('#helio-pay-btn').addEventListener('click',async()=>{
    const btn=modal.querySelector('#helio-pay-btn');
    const errEl=modal.querySelector('#buy-modal-error');
    errEl.style.display='none';
    btn.disabled=true;btn.textContent='Redirecting…';
    const res=await api.templates.purchase(_pendingBuyId,`${window.location.origin}/marketplace.html?payment=success&id=${_pendingBuyId}`);
    if(!res.ok){
      btn.disabled=false;btn.innerHTML='💳 Pay with Card';
      errEl.textContent=res.error??'Payment could not be started.';
      errEl.style.display='block';
      return;
    }
    if(res.data?.authorizationUrl){
      modal.remove();
      document.body.style.overflow='';
      showToast('Redirecting to secure payment…','info');
      setTimeout(()=>window.location.href=res.data.authorizationUrl,500);
    }
  });
}

  // ══════════════════════════════════════════════════════════════════════
  // TUTORIALS
  // ══════════════════════════════════════════════════════════════════════
  let _tutLoaded=false,allTutorials=[],tutFiltered=[],tutVisibleCount=12,activeSoftware='';

  const SW_TABS=[{label:'All',value:''},{label:'Photoshop',value:'photoshop'},{label:'Canva',value:'canva'},{label:'Figma',value:'figma'},{label:'Illustrator',value:'illustrator'},{label:'After Effects',value:'after-effects'},{label:'Benime',value:'benime'},{label:'Plotagon',value:'plotagon'}];

  function buildSoftwareBar(){
    const bar=document.getElementById('tut-software-bar');
    if(!bar)return;
    bar.innerHTML=SW_TABS.map(s=>`<button class="filter-pill ${activeSoftware===s.value?'active':''}" data-sw="${_esc(s.value)}" style="opacity:0;transform:scale(0.7);">${_esc(s.label)}</button>`).join('');
    Array.from(bar.children).forEach((p,i)=>{
      p.style.transition=`opacity 0.35s ease ${i*40}ms,transform 0.45s cubic-bezier(0.34,1.56,0.64,1) ${i*40}ms`;
      requestAnimationFrame(()=>requestAnimationFrame(()=>{p.style.opacity='1';p.style.transform='scale(1)';}));
    });
    bar.querySelectorAll('.filter-pill').forEach(btn=>{
      btn.addEventListener('click',()=>{activeSoftware=btn.dataset.sw;bar.querySelectorAll('.filter-pill').forEach(b=>b.classList.toggle('active',b.dataset.sw===activeSoftware));applyTutFilters();});
    });
  }

  async function loadTutorials(){
    const skel=document.getElementById('tut-skeleton');
    const tg=document.getElementById('tut-grid');
    const empty=document.getElementById('tut-empty');
    skel?.classList.remove('hidden');tg?.classList.add('hidden');empty?.classList.add('hidden');
    const res=await api.tutorials.list({limit:100});
    skel?.classList.add('hidden');
    if(!res.ok||!res.data?.tutorials?.length){empty?.classList.remove('hidden');return;}
    allTutorials=res.data.tutorials;
    buildSoftwareBar();applyTutFilters();
    const tsWrap = document.getElementById('tut-search-wrap')?.querySelector('div');
const tsInput = document.getElementById('tut-search');
if(tsWrap && tsInput){
  tsInput.addEventListener('focus', () => {
    tsWrap.style.borderColor = 'var(--accent)';
    tsWrap.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.12)';
  });
  tsInput.addEventListener('blur', () => {
    tsWrap.style.borderColor = 'var(--border)';
    tsWrap.style.boxShadow = '';
  });
}
  }

  function applyTutFilters(){
    const q=(document.getElementById('tut-search')?.value??'').toLowerCase().trim();
    tutFiltered=allTutorials.filter(t=>{
      if(activeSoftware&&(t.category??'').toLowerCase()!==activeSoftware)return false;
      if(q&&!t.title.toLowerCase().includes(q)&&!(t.description??'').toLowerCase().includes(q))return false;
      return true;
    });
    tutVisibleCount=12;renderTutorials().catch(console.error);
  }

  async function renderTutorials(){
    const tg=document.getElementById('tut-grid');
    const empty=document.getElementById('tut-empty');
    const more=document.getElementById('tut-load-more');
    if(resultCount && document.getElementById('tab-tutorials')?.style.display !== 'none'){
      resultCount.textContent=`${tutFiltered.length} tutorial${tutFiltered.length!==1?'s':''}`;
    }
    if(!tg)return;
    const slice=tutFiltered.slice(0,tutVisibleCount);
    if(!slice.length){tg.classList.add('hidden');empty?.classList.remove('hidden');more?.classList.add('hidden');return;}
    tg.classList.remove('hidden');empty?.classList.add('hidden');

    // Resolve all creator names in parallel
    const creatorNames = await Promise.all(slice.map(t => {
      const name = t.creator?.name ?? t.creator?.username ?? t.creatorName ?? t.creator_name ?? null;
      if(name) return Promise.resolve(name);
      const id = t.creator?.id ?? t.creator?._id ?? t.creatorId ?? null;
      return getCreatorName(id);
    }));

    const creatorIds = slice.map(t =>
      String(t.creator?.id ?? t.creator?._id ?? t.creatorId ?? '')
    );

    tg.innerHTML=slice.map((t,i)=>{
      const sw=t.category??'General';
      const cr=creatorNames[i];
      const cid=creatorIds[i];
      const dur=t.duration?`${Math.floor(t.duration/60)}m`:'';
      return `
        <div class="tutorial-card" data-videourl="${_esc(t.videoUrl??'')}" data-title="${_esc(t.title)}" style="cursor:pointer;background:var(--bg-raised);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;transition:border-color 0.3s ease,transform 0.3s ease,box-shadow 0.3s ease;opacity:0;transform:translateY(32px) scale(0.96);">
          <div style="position:relative;aspect-ratio:16/9;overflow:hidden;background:${GRADS[i%GRADS.length]};">
            ${t.thumbnailUrl?`<img src="${_esc(t.thumbnailUrl)}" alt="${_esc(t.title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;transition:transform 0.6s ease;">`:`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:3rem;opacity:0.3;">▣</div>`}
            <div style="position:absolute;inset:0;background:rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center;transition:background 0.25s ease;">
              <div class="tut-play-btn" style="width:56px;height:56px;background:rgba(124,58,237,0.88);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid rgba(255,255,255,0.3);transition:transform 0.3s cubic-bezier(0.34,1.56,0.64,1),background 0.2s ease;box-shadow:0 8px 24px rgba(124,58,237,0.4);">
                <span style="color:#fff;font-size:1.3rem;margin-left:3px;">▶</span>
              </div>
            </div>
            <span style="position:absolute;top:10px;left:10px;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);color:#fff;font-size:0.7rem;font-weight:600;padding:3px 10px;border-radius:20px;">${_esc(sw)}</span>
            <span style="position:absolute;top:10px;right:10px;background:var(--success);color:#fff;font-size:0.7rem;font-weight:700;padding:3px 10px;border-radius:20px;">FREE</span>
            ${dur?`<span style="position:absolute;bottom:8px;right:10px;background:rgba(0,0,0,0.65);color:#fff;font-size:0.7rem;padding:2px 8px;border-radius:20px;">${_esc(dur)}</span>`:''}
          </div>
          <div style="padding:16px 18px;">
            <h3 style="font-family:var(--font-display);font-size:0.92rem;font-weight:700;margin-bottom:6px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${_esc(t.title)}</h3>
            ${t.description?`<p style="font-size:0.78rem;color:var(--text-muted);line-height:1.5;margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${_esc(t.description)}</p>`:''}
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:0.76rem;color:var(--text-muted);border-top:1px solid var(--border);padding-top:10px;">
              ${cid
                ? `<a href="creator.html?id=${_esc(cid)}" style="color:var(--text-muted);text-decoration:none;transition:color 0.2s;" onmouseover="this.style.color='var(--accent-hover)'" onmouseout="this.style.color='var(--text-muted)'">by ${_esc(cr)}</a>`
                : `<span>by ${_esc(cr)}</span>`
              }
              <span style="color:var(--accent-hover);font-weight:600;">▶ Watch free</span>
            </div>
          </div>
        </div>`;
    }).join('');

    tutFiltered.length>tutVisibleCount?more?.classList.remove('hidden'):more?.classList.add('hidden');

    Array.from(tg.children).forEach((card,i)=>{
      card.style.transition=`opacity 0.55s cubic-bezier(0.16,1,0.3,1) ${i*65}ms,transform 0.55s cubic-bezier(0.16,1,0.3,1) ${i*65}ms`;
      requestAnimationFrame(()=>requestAnimationFrame(()=>{card.style.opacity='1';card.style.transform='translateY(0) scale(1)';}));
    });

    tg.querySelectorAll('.tutorial-card').forEach(card=>{
      const img=card.querySelector('img');
      const play=card.querySelector('.tut-play-btn');
      const overlay=card.querySelector('div>div:nth-child(2)');
      card.addEventListener('mouseenter',()=>{
        card.style.borderColor='var(--border-hover)';card.style.transform='translateY(-6px)';card.style.boxShadow='0 20px 50px rgba(124,58,237,0.2)';
        if(img)img.style.transform='scale(1.07)';
        if(play){play.style.transform='scale(1.18)';play.style.background='var(--accent)';}
        if(overlay)overlay.style.background='rgba(0,0,0,0.45)';
      });
      card.addEventListener('mouseleave',()=>{
        card.style.borderColor='';card.style.transform='';card.style.boxShadow='';
        if(img)img.style.transform='';
        if(play){play.style.transform='';play.style.background='rgba(124,58,237,0.88)';}
        if(overlay)overlay.style.background='rgba(0,0,0,0.28)';
      });
      card.addEventListener('click', e=>{
        if(e.target.tagName==='A') return;
        openVideoModal(card.dataset.videourl,card.dataset.title);
      });
    });
  }

  document.getElementById('tut-load-more')?.addEventListener('click',()=>{tutVisibleCount+=12;renderTutorials().catch(console.error);});
  document.getElementById('tut-search')?.addEventListener('input',applyTutFilters);

  // ── Video Modal ────────────────────────────────────────────────────────
  function openVideoModal(url,title){
  document.getElementById('tut-play-modal')?.remove();
  const modal=document.createElement('div');
  modal.id='tut-play-modal';
  modal.className='modal-overlay';
  modal.innerHTML=`
    <div class="tut-video-modal-wrap" id="tut-video-inner">
      <div class="tut-video-modal-head">
        <span class="tut-video-modal-title">${_esc(title)}</span>
        <button id="tut-modal-close" class="tut-video-modal-close">✕</button>
      </div>
      <video controls autoplay playsinline style="width:100%;max-height:520px;display:block;background:#000;">
        <source src="${_esc(url)}" type="video/mp4">
      </video>
    </div>`;
  document.body.appendChild(modal);
  document.body.style.overflow='hidden';
  requestAnimationFrame(()=>{
    modal.classList.add('open');
    document.getElementById('tut-video-inner')?.classList.add('open');
  });
  function closeVid(){
    modal.classList.remove('open');
    document.getElementById('tut-video-inner')?.classList.remove('open');
    modal.querySelector('video')?.pause();
    document.body.style.overflow='';
    setTimeout(()=>modal.remove(),300);
  }
  modal.querySelector('#tut-modal-close').addEventListener('click',closeVid);
  modal.addEventListener('click',e=>{if(e.target===modal)closeVid();});
  document.addEventListener('keydown',function esc(e){if(e.key==='Escape'){closeVid();document.removeEventListener('keydown',esc);}});
}
  // ── Init ───────────────────────────────────────────────────────────────
  switchTab(initialTab);
  await fetchTemplates();

  const payStatus=urlParams.get('payment');
  const payId=urlParams.get('id');
  if(payStatus==='success'&&payId){
    window.history.replaceState({},'','marketplace.html');
    showToast('Confirming your payment…','info');
    let attempts=0;
    const poll=setInterval(async()=>{
      attempts++;
      const tokenRes=await api.get(`/templates/${payId}/download-token`);
if(tokenRes.ok){
  clearInterval(poll);
  showToast('Payment confirmed! Download starting… ✓','success');
  const BASE=window.FLOWVA_API_URL||'https://flowva-backend-ztai.onrender.com/api';
  window.open(`${BASE}/templates/${payId}/download?token=${encodeURIComponent(tokenRes.data.token)}`,'_blank');
  // Show post-payment rate prompt
  const t = allTemplates.find(x=>String(x._id??x.id)===String(payId));
  const ordersRes = await api.users.getOrders();
  const order = ordersRes.ok
    ? (ordersRes.data?.orders??[]).find(o=>
        o.mongoTemplateId===payId &&
        ['PAID','COMPLETED'].includes(o.status) &&
        !o.rated
      )
    : null;
  if(order){
    setTimeout(()=>openRatePrompt(payId, t?.title||'this template', order.id), 1200);
  }
}      else if(attempts>=8){clearInterval(poll);showToast('Payment received — check your dashboard to download.','info');}
    },3000);
  }
  if(initialTab==='tutorials'){_tutLoaded=true;await loadTutorials();}
});
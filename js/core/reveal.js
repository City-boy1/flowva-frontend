/**
 * FLOWVA — Cinema Engine
 * Framer-level animations: custom cursor, magnetic, spring physics,
 * word-by-word text, horizontal marquee, scroll sequences,
 * card flip reveal, spotlight follow, ripple clicks, counter, particles
 * Drop this as js/core/cinema.js and add to every page
 */

(function() {
'use strict';

// ── Spring easing helper ────────────────────────────────────────────────
function spring(stiffness=180, damping=12) {
  return `cubic-bezier(0.34,1.56,0.64,1)`;
}

// ══════════════════════════════════════════════════════════════════════
// 1. CUSTOM CURSOR
// ══════════════════════════════════════════════════════════════════════
function initCursor() {
  if (window.innerWidth < 1024) return;
  const style = document.createElement('style');
  style.textContent = `
    *{cursor:none!important}
    #fv-cursor-dot,#fv-cursor-ring{position:fixed;pointer-events:none;z-index:999999;border-radius:50%;top:0;left:0;}
    #fv-cursor-dot{width:8px;height:8px;background:var(--accent-hover);transform:translate(-50%,-50%);transition:transform 0.1s ease,background 0.2s ease,width 0.2s ease,height 0.2s ease;}
    #fv-cursor-ring{width:36px;height:36px;border:1.5px solid rgba(124,58,237,0.6);transform:translate(-50%,-50%);transition:width 0.35s ease,height 0.35s ease,border-color 0.3s ease,opacity 0.3s ease;}
    #fv-cursor-ring.hover{width:56px;height:56px;border-color:var(--accent);opacity:0.8;}
    #fv-cursor-ring.click{width:22px;height:22px;border-color:white;}
    #fv-cursor-label{position:fixed;pointer-events:none;z-index:999999;background:var(--accent);color:#fff;font-size:0.68rem;font-weight:700;padding:4px 10px;border-radius:20px;transform:translate(16px,-50%);opacity:0;transition:opacity 0.2s ease;letter-spacing:0.05em;white-space:nowrap;}
  `;
  document.head.appendChild(style);

  const dot  = document.createElement('div'); dot.id='fv-cursor-dot';
  const ring = document.createElement('div'); ring.id='fv-cursor-ring';
  const label= document.createElement('div'); label.id='fv-cursor-label';
  document.body.append(dot, ring, label);

  let mx=0,my=0,rx=0,ry=0;
  window.addEventListener('mousemove', e=>{
    mx=e.clientX;my=e.clientY;
    dot.style.left=mx+'px'; dot.style.top=my+'px';
    label.style.left=mx+'px'; label.style.top=my+'px';
  },{passive:true});

  (function animRing(){
    rx+=(mx-rx)*0.12; ry+=(my-ry)*0.12;
    ring.style.left=rx+'px'; ring.style.top=ry+'px';
    requestAnimationFrame(animRing);
  })();

  window.addEventListener('mousedown',()=>ring.classList.add('click'));
  window.addEventListener('mouseup',()=>ring.classList.remove('click'));

  // Hover detection
  document.addEventListener('mouseover', e=>{
    const el = e.target.closest('button,a,.mkt-card,.template-card,.tutorial-card,.btn,[data-cursor]');
    if(el){
      ring.classList.add('hover');
      const lbl = el.dataset.cursor||'';
      if(lbl){label.textContent=lbl;label.style.opacity='1';}
    } else {
      ring.classList.remove('hover');
      label.style.opacity='0';
    }
  });
}

// ══════════════════════════════════════════════════════════════════════
// 2. MAGNETIC ELEMENTS
// ══════════════════════════════════════════════════════════════════════
function initMagnetic() {
  document.querySelectorAll('.btn--primary,.btn--ghost,.nav-toggle,.nav-avatar-btn').forEach(el=>{
    el.addEventListener('mousemove',e=>{
      const r=el.getBoundingClientRect();
      const x=(e.clientX-r.left-r.width/2)*0.4;
      const y=(e.clientY-r.top-r.height/2)*0.4;
      el.style.transform=`translate(${x}px,${y}px) scale(1.05)`;
    });
    el.addEventListener('mouseleave',()=>{
      el.style.transform='';
      el.style.transition='transform 0.6s cubic-bezier(0.34,1.56,0.64,1)';
      setTimeout(()=>el.style.transition='',600);
    });
  });
}

// ══════════════════════════════════════════════════════════════════════
// 3. RIPPLE ON CLICK
// ══════════════════════════════════════════════════════════════════════
function initRipple() {
  const s=document.createElement('style');
  s.textContent=`.ripple{position:absolute;border-radius:50%;background:rgba(255,255,255,0.25);transform:scale(0);animation:ripple-anim 0.6s linear;pointer-events:none;z-index:999;}@keyframes ripple-anim{to{transform:scale(4);opacity:0;}}`;
  document.head.appendChild(s);

  document.addEventListener('click',e=>{
    const btn=e.target.closest('.btn,.mkt-card,.filter-pill,.category-pill,.mkt-pill');
    if(!btn)return;
    const r=btn.getBoundingClientRect();
    const rip=document.createElement('span');
    rip.className='ripple';
    const size=Math.max(r.width,r.height);
    rip.style.cssText=`width:${size}px;height:${size}px;left:${e.clientX-r.left-size/2}px;top:${e.clientY-r.top-size/2}px;`;
    btn.style.position='relative';btn.style.overflow='hidden';
    btn.appendChild(rip);
    setTimeout(()=>rip.remove(),700);
  });
}

// ══════════════════════════════════════════════════════════════════════
// 4. SCROLL PROGRESS BAR
// ══════════════════════════════════════════════════════════════════════
function initScrollProgress() {
  const bar=document.createElement('div');
  bar.style.cssText='position:fixed;top:0;left:0;height:2px;width:0%;background:linear-gradient(90deg,#7c3aed,#a78bfa,#c4b5fd,#7c3aed);background-size:200% 100%;z-index:99999;transition:width 0.08s linear;pointer-events:none;animation:progress-shimmer 2s linear infinite;';
  const kf=document.createElement('style');
  kf.textContent='@keyframes progress-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}';
  document.head.appendChild(kf);
  document.body.appendChild(bar);
  window.addEventListener('scroll',()=>{
    const max=document.body.scrollHeight-window.innerHeight;
    bar.style.width=((window.scrollY/max)*100)+'%';
  },{passive:true});
}

// ══════════════════════════════════════════════════════════════════════
// 5. SPOTLIGHT / CURSOR GLOW
// ══════════════════════════════════════════════════════════════════════
function initSpotlight() {
  if(window.innerWidth<1024)return;
  const glow=document.createElement('div');
  glow.style.cssText='position:fixed;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(124,58,237,0.08) 0%,transparent 70%);pointer-events:none;z-index:1;transform:translate(-50%,-50%);will-change:left,top;transition:left 0.15s ease,top 0.15s ease;';
  document.body.appendChild(glow);
  window.addEventListener('mousemove',e=>{glow.style.left=e.clientX+'px';glow.style.top=e.clientY+'px';},{passive:true});
}

// ══════════════════════════════════════════════════════════════════════
// 6. MOUSE TRAIL
// ══════════════════════════════════════════════════════════════════════
function initTrail() {
  if(window.innerWidth<1024)return;
  const N=14;
  const dots=Array.from({length:N},(_,i)=>{
    const d=document.createElement('div');
    d.style.cssText=`position:fixed;pointer-events:none;z-index:99997;border-radius:50%;
      width:${7-i*0.4}px;height:${7-i*0.4}px;
      background:rgba(124,58,237,${0.5-i*0.033});
      transform:translate(-50%,-50%);`;
    document.body.appendChild(d);
    return {el:d,x:0,y:0};
  });
  let mx=0,my=0;
  window.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;},{passive:true});
  (function anim(){
    dots[0].x+=(mx-dots[0].x)*0.3; dots[0].y+=(my-dots[0].y)*0.3;
    dots[0].el.style.left=dots[0].x+'px'; dots[0].el.style.top=dots[0].y+'px';
    for(let i=1;i<N;i++){
      dots[i].x+=(dots[i-1].x-dots[i].x)*0.5;
      dots[i].y+=(dots[i-1].y-dots[i].y)*0.5;
      dots[i].el.style.left=dots[i].x+'px'; dots[i].el.style.top=dots[i].y+'px';
    }
    requestAnimationFrame(anim);
  })();
}

// ══════════════════════════════════════════════════════════════════════
// 7. BIDIRECTIONAL REVEAL + MULTIPLE DIRECTIONS
// ══════════════════════════════════════════════════════════════════════
function initReveal() {
  const s=document.createElement('style');
  s.textContent=`
    .reveal,.reveal-left,.reveal-right,.reveal-zoom,.reveal-flip,.reveal-swing{will-change:transform,opacity;}
    .reveal{opacity:0;transform:translateY(48px) scale(0.97);transition:opacity 0.85s cubic-bezier(0.16,1,0.3,1),transform 0.85s cubic-bezier(0.16,1,0.3,1);}
    .reveal.active{opacity:1;transform:translateY(0) scale(1);}
    .reveal.exit{opacity:0;transform:translateY(-20px) scale(0.99);transition:opacity 0.4s ease,transform 0.4s ease;}
    .reveal-left{opacity:0;transform:translateX(-70px) scale(0.97);transition:opacity 0.85s cubic-bezier(0.16,1,0.3,1),transform 0.85s cubic-bezier(0.16,1,0.3,1);}
    .reveal-left.active{opacity:1;transform:translateX(0) scale(1);}
    .reveal-left.exit{opacity:0;transform:translateX(-40px);}
    .reveal-right{opacity:0;transform:translateX(70px) scale(0.97);transition:opacity 0.85s cubic-bezier(0.16,1,0.3,1),transform 0.85s cubic-bezier(0.16,1,0.3,1);}
    .reveal-right.active{opacity:1;transform:translateX(0) scale(1);}
    .reveal-right.exit{opacity:0;transform:translateX(40px);}
    .reveal-zoom{opacity:0;transform:scale(0.82);transition:opacity 0.7s cubic-bezier(0.16,1,0.3,1),transform 0.7s cubic-bezier(0.34,1.56,0.64,1);}
    .reveal-zoom.active{opacity:1;transform:scale(1);}
    .reveal-zoom.exit{opacity:0;transform:scale(0.92);}
    .reveal-flip{opacity:0;transform:perspective(600px) rotateX(-25deg) translateY(40px);transition:opacity 0.7s ease,transform 0.7s cubic-bezier(0.34,1.56,0.64,1);}
    .reveal-flip.active{opacity:1;transform:perspective(600px) rotateX(0deg) translateY(0);}
    .reveal-flip.exit{opacity:0;transform:perspective(600px) rotateX(15deg) translateY(-20px);}
    .reveal-swing[data-swing-dir=left]{opacity:0;transform:translateX(-50px) rotate(-5deg);transition:opacity 0.8s cubic-bezier(0.16,1,0.3,1),transform 0.8s cubic-bezier(0.34,1.56,0.64,1);}
    .reveal-swing[data-swing-dir=right]{opacity:0;transform:translateX(50px) rotate(5deg);transition:opacity 0.8s cubic-bezier(0.16,1,0.3,1),transform 0.8s cubic-bezier(0.34,1.56,0.64,1);}
    .reveal-swing.active{opacity:1;transform:translateX(0) rotate(0);}
    .reveal-delay-1{transition-delay:0.08s;}.reveal-delay-2{transition-delay:0.16s;}
    .reveal-delay-3{transition-delay:0.24s;}.reveal-delay-4{transition-delay:0.32s;}
    .section-title-line{width:0;height:2px;background:linear-gradient(90deg,var(--accent),transparent);border-radius:2px;margin-top:8px;transition:width 0.9s cubic-bezier(0.16,1,0.3,1) 0.2s;}
  `;
  document.head.appendChild(s);

  const obs=new IntersectionObserver(entries=>{
    entries.forEach(e=>{
      if(e.isIntersecting){e.target.classList.add('active');e.target.classList.remove('exit');}
      else{e.target.classList.remove('active');e.target.classList.add('exit');}
    });
  },{threshold:0.07,rootMargin:'0px 0px -30px 0px'});

  document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.reveal-zoom,.reveal-flip,.reveal-swing').forEach(el=>obs.observe(el));

  // Section title underlines
  document.querySelectorAll('.section-title').forEach(t=>{
    const line=document.createElement('div');line.className='section-title-line';
    t.parentNode.insertBefore(line,t.nextSibling);
    const o=new IntersectionObserver(entries=>{line.style.width=entries[0].isIntersecting?'60px':'0px';},{threshold:0.5});
    o.observe(t);
  });
}

// ══════════════════════════════════════════════════════════════════════
// 8. STAGGER CHILDREN
// ══════════════════════════════════════════════════════════════════════
function initStagger() {
  document.querySelectorAll('[data-stagger]').forEach(parent=>{
    Array.from(parent.children).forEach((child,i)=>{
      child.style.transitionDelay=`${i*80}ms`;
      if(!child.className.match(/reveal/))child.classList.add('reveal');
    });
  });
}

// ══════════════════════════════════════════════════════════════════════
// 9. PARALLAX
// ══════════════════════════════════════════════════════════════════════
function initParallax() {
  const layers=document.querySelectorAll('[data-parallax]');
  if(!layers.length)return;
  let tick=false;
  window.addEventListener('scroll',()=>{
    if(tick)return;
    requestAnimationFrame(()=>{
      layers.forEach(el=>el.style.transform=`translateY(${window.scrollY*parseFloat(el.dataset.parallax||0.3)}px)`);
      tick=false;
    });tick=true;
  },{passive:true});
}

// ══════════════════════════════════════════════════════════════════════
// 10. MARQUEE / INFINITE SCROLL STRIP
// ══════════════════════════════════════════════════════════════════════
function initMarquee() {
  document.querySelectorAll('[data-marquee]').forEach(wrap=>{
    const speed=parseInt(wrap.dataset.marquee)||40;
    const inner=wrap.querySelector('[data-marquee-inner]');
    if(!inner)return;
    // Duplicate content for seamless loop
    inner.innerHTML+=inner.innerHTML;
    inner.style.cssText=`display:flex;gap:24px;width:max-content;animation:marquee-scroll ${speed}s linear infinite;`;
    const s=document.createElement('style');
    s.textContent=`@keyframes marquee-scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
    [data-marquee]{overflow:hidden;mask-image:linear-gradient(90deg,transparent,black 10%,black 90%,transparent);}
    [data-marquee]:hover [data-marquee-inner]{animation-play-state:paused;}`;
    document.head.appendChild(s);
  });
}

// ══════════════════════════════════════════════════════════════════════
// 11. COUNTER ANIMATION
// ══════════════════════════════════════════════════════════════════════
function initCounters() {
  const section=document.getElementById('hero-stats');
  if(!section)return;
  setTimeout(()=>{
    section.querySelectorAll('[data-target]').forEach(el=>{
      const target=parseInt(el.dataset.target,10);
      const suffix=el.dataset.suffix||'';
      const start=performance.now();
      const dur=2200;
      (function step(now){
        const p=Math.min((now-start)/dur,1);
        const e=1-Math.pow(1-p,4);
        el.textContent=Math.floor(e*target).toLocaleString()+suffix;
        if(p<1)requestAnimationFrame(step);
      })(performance.now());
    });
  },800);
}

// ══════════════════════════════════════════════════════════════════════
// 12. FLOATING PARTICLES (hero)
// ══════════════════════════════════════════════════════════════════════
function initParticles() {
  const hero=document.querySelector('.hero-bg');
  if(!hero)return;
  const canvas=document.createElement('canvas');
  canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;';
  hero.appendChild(canvas);
  const ctx=canvas.getContext('2d');
  let W,H,pts;
  function resize(){W=canvas.width=hero.offsetWidth;H=canvas.height=hero.offsetHeight;}
  function make(){return Array.from({length:80},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.8+0.3,vx:(Math.random()-0.5)*0.35,vy:-Math.random()*0.45-0.1,life:Math.random(),pulse:Math.random()*Math.PI*2,color:Math.random()>0.5?'167,139,250':'124,58,237'}));}
  function draw(){
    ctx.clearRect(0,0,W,H);const t=Date.now()*0.001;
    pts.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;p.life+=0.004;
      if(p.y<-10||p.life>1){p.x=Math.random()*W;p.y=H+10;p.life=0;}
      const alpha=Math.sin(p.life*Math.PI)*0.65;
      const pulse=0.8+Math.sin(t+p.pulse)*0.2;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r*pulse,0,Math.PI*2);
      ctx.fillStyle=`rgba(${p.color},${alpha})`;ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  resize();pts=make();
  window.addEventListener('resize',()=>{resize();pts=make();});
  draw();
}

// ══════════════════════════════════════════════════════════════════════
// 13. HERO AMBIENT GLOW (follows mouse)
// ══════════════════════════════════════════════════════════════════════
function initHeroAmbient() {
  const hero=document.querySelector('.hero');
  if(!hero)return;
  const g=document.createElement('div');
  g.style.cssText='position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(700px circle at 50% 80%,rgba(124,58,237,0.13),transparent 60%);transition:background 0.4s ease;';
  hero.appendChild(g);
  hero.addEventListener('mousemove',e=>{
    const r=hero.getBoundingClientRect();
    g.style.background=`radial-gradient(700px circle at ${((e.clientX-r.left)/r.width*100).toFixed(1)}% ${((e.clientY-r.top)/r.height*100).toFixed(1)}%,rgba(124,58,237,0.18),transparent 60%)`;
  });
  hero.addEventListener('mouseleave',()=>g.style.background='radial-gradient(700px circle at 50% 80%,rgba(124,58,237,0.13),transparent 60%)');
}

// ══════════════════════════════════════════════════════════════════════
// 14. HERO ENTRANCE (staggered)
// ══════════════════════════════════════════════════════════════════════
function initHeroEntrance() {
  const els=['.hero-eyebrow','.hero-content h1','.hero-content p','.hero-actions','.hero-trust','.hero-stats'].map(s=>document.querySelector(s)).filter(Boolean);
  els.forEach((el,i)=>{
    el.style.cssText+='opacity:0;transform:translateY(36px);transition:opacity 1s cubic-bezier(0.16,1,0.3,1) '+i*130+'ms,transform 1s cubic-bezier(0.16,1,0.3,1) '+i*130+'ms;';
  });
  requestAnimationFrame(()=>requestAnimationFrame(()=>els.forEach(el=>{el.style.opacity='1';el.style.transform='translateY(0)';})));
}

// ══════════════════════════════════════════════════════════════════════
// 15. 3D CARD TILT (global)
// ══════════════════════════════════════════════════════════════════════
function initCardTilt() {
  document.querySelectorAll('.template-card,.step-card,.creator-card,.tutorial-card,.mkt-card').forEach(card=>{
    card.addEventListener('mousemove',e=>{
      const r=card.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width-0.5;
      const y=(e.clientY-r.top)/r.height-0.5;
      card.style.transform=`perspective(900px) rotateX(${y*-10}deg) rotateY(${x*10}deg) translateY(-8px) scale(1.02)`;
      card.style.transition='transform 0.1s ease,box-shadow 0.1s ease,border-color 0.1s ease';
      card.style.borderColor='rgba(124,58,237,0.55)';
      card.style.boxShadow='0 24px 60px rgba(124,58,237,0.22),0 0 0 1px rgba(124,58,237,0.1)';
    });
    card.addEventListener('mouseleave',()=>{
      card.style.transform='';
      card.style.transition='transform 0.7s cubic-bezier(0.34,1.56,0.64,1),box-shadow 0.5s ease,border-color 0.5s ease';
      card.style.borderColor='';card.style.boxShadow='';
      setTimeout(()=>card.style.transition='',700);
    });
  });
}

// ══════════════════════════════════════════════════════════════════════
// 16. DYNAMIC CARD REVEAL (watches for new cards from API)
// ══════════════════════════════════════════════════════════════════════
function initDynamicReveal() {
  ['trending-grid','tutorials-grid','creators-grid','market-grid','tut-grid'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    new MutationObserver(()=>{
      Array.from(el.children).forEach((child,i)=>{
        child.style.opacity='0';child.style.transform='translateY(32px) scale(0.97)';
        child.style.transition=`opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${i*60}ms,transform 0.6s cubic-bezier(0.16,1,0.3,1) ${i*60}ms`;
        requestAnimationFrame(()=>requestAnimationFrame(()=>{child.style.opacity='1';child.style.transform='translateY(0) scale(1)';}));
      });
      setTimeout(()=>initCardTilt(),800);
    }).observe(el,{childList:true});
  });
}

// ══════════════════════════════════════════════════════════════════════
// 17. CATEGORY PILL BOUNCE
// ══════════════════════════════════════════════════════════════════════
function initCategoryAnimation() {
  ['categories-scroll','category-pills'].forEach(id=>{
    const w=document.getElementById(id);
    if(!w)return;
    new MutationObserver(()=>{
      Array.from(w.children).forEach((pill,i)=>{
        pill.style.opacity='0';pill.style.transform='scale(0.7) translateY(10px)';
        pill.style.transition=`opacity 0.4s ease ${i*45}ms,transform 0.5s cubic-bezier(0.34,1.56,0.64,1) ${i*45}ms`;
        requestAnimationFrame(()=>requestAnimationFrame(()=>{pill.style.opacity='1';pill.style.transform='scale(1) translateY(0)';}));
      });
    }).observe(w,{childList:true});
  });
}

// ══════════════════════════════════════════════════════════════════════
// 18. STEP CARDS SWING FROM ALTERNATING SIDES
// ══════════════════════════════════════════════════════════════════════
function initStepSwing() {
  document.querySelectorAll('.step-card').forEach((card,i)=>{
    card.classList.add('reveal-swing');
    card.dataset.swingDir=i%2===0?'left':'right';
  });
}

// ══════════════════════════════════════════════════════════════════════
// 19. VIDEO AUTOPLAY ON SCROLL
// ══════════════════════════════════════════════════════════════════════
function initVideoAutoplay() {
  function bind(){
    document.querySelectorAll('.template-card,.mkt-card').forEach(card=>{
      const v=card.querySelector('.thumb-video,video:not([controls])');
      if(!v||v._bound)return;v._bound=true;
      const obs=new IntersectionObserver(entries=>{
        if(entries[0].isIntersecting&&entries[0].intersectionRatio>=0.4){v.play().then(()=>v.classList.add('playing')).catch(()=>{});}
        else{v.pause();v.classList.remove('playing');v.currentTime=0;}
      },{threshold:0.4});
      obs.observe(card);
      card.addEventListener('mouseenter',()=>{v.pause();v.classList.remove('playing');});
      card.addEventListener('mouseleave',()=>{const r=card.getBoundingClientRect();if(r.top>=-100&&r.bottom<=window.innerHeight+100)v.play().then(()=>v.classList.add('playing')).catch(()=>{});});
    });
  }
  bind();setTimeout(bind,2000);
  ['trending-grid','market-grid'].forEach(id=>{const el=document.getElementById(id);if(el)new MutationObserver(bind).observe(el,{childList:true});});
}

// ══════════════════════════════════════════════════════════════════════
// 20. PULSING GLOW ON FEATURED CARDS
// ══════════════════════════════════════════════════════════════════════
function initPulseGlow() {
  const s=document.createElement('style');
  s.textContent=`
    @keyframes pulse-glow{0%,100%{box-shadow:0 0 0 0 rgba(124,58,237,0)}50%{box-shadow:0 0 0 8px rgba(124,58,237,0.12)}}
    .mkt-card:nth-child(1),.template-card:nth-child(1){animation:pulse-glow 3s ease-in-out infinite;}
    .mkt-card:nth-child(4),.template-card:nth-child(4){animation:pulse-glow 3s ease-in-out infinite 1s;}
    @keyframes pulse-dot{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:0.6}}
    @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
    @keyframes float2{0%,100%{transform:translateY(-50%)}50%{transform:translateY(calc(-50% - 8px))}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes fade-up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
    @keyframes skeleton-wave{0%{background-position:200% 0}100%{background-position:-200% 0}}
  `;
  document.head.appendChild(s);
}

// ══════════════════════════════════════════════════════════════════════
// INIT ALL
// ══════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded',()=>{
  initCursor();
  initMagnetic();
  initRipple();
  initScrollProgress();
  initSpotlight();
  initTrail();
  initReveal();
  initStagger();
  initParallax();
  initMarquee();
  initCounters();
  initParticles();
  initHeroAmbient();
  initHeroEntrance();
  initDynamicReveal();
  initCategoryAnimation();
  initStepSwing();
  initVideoAutoplay();
  initPulseGlow();
  setTimeout(initCardTilt,1500);
});

})();
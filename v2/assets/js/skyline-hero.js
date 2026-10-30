/* Gentle pointer depth; no text movement or scroll parallax. */
(function(){
  'use strict';
  var hero=document.querySelector('.skyline-hero');
  if(!hero)return;
  var reduced=matchMedia('(prefers-reduced-motion: reduce)');
  hero.addEventListener('pointermove',function(e){
    if(reduced.matches||e.pointerType==='touch'||innerWidth<761)return;
    var r=hero.getBoundingClientRect();
    hero.style.setProperty('--scene-x',((e.clientX-r.left)/r.width-.5)*-12+'px');
    hero.style.setProperty('--scene-y',((e.clientY-r.top)/r.height-.5)*-8+'px');
  });
  hero.addEventListener('pointerleave',function(){hero.style.setProperty('--scene-x','0px');hero.style.setProperty('--scene-y','0px');});
  hero.querySelectorAll('[data-hero-category]').forEach(function(link){
    link.addEventListener('click',function(){
      var category=link.dataset.heroCategory;
      var filter=document.querySelector('[data-service-filter="'+category+'"]');
      if(filter)filter.click();
    });
  });
})();

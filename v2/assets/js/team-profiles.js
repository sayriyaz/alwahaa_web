(function(){
  'use strict';
  var reduced=matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('.team-profile').forEach(function(card){
    var inner=card.querySelector('.team-profile__inner');
    var portrait=card.querySelector('.team-profile__portrait');
    var front=card.querySelector('.team-profile__front');
    var back=card.querySelector('.team-profile__back');
    var close=card.querySelector('.team-profile__close');
    var turning=false,opened=false;
    function finish(){
      if(!turning)return;
      turning=false;card.classList.remove('is-turning');
      (opened?close:portrait).focus({preventScroll:true});
    }
    function setOpen(open){
      if(turning||opened===open)return;
      opened=open;turning=true;
      if(card.contains(document.activeElement))document.activeElement.blur();
      card.classList.add('is-turning');card.classList.toggle('is-open',open);
      portrait.setAttribute('aria-expanded',String(open));
      front.inert=open;back.inert=!open;
      front.setAttribute('aria-hidden',String(open));back.setAttribute('aria-hidden',String(!open));
      if(reduced.matches)finish();
    }
    inner.addEventListener('transitionend',function(e){if(e.target===inner&&e.propertyName==='transform')finish();});
    inner.addEventListener('transitioncancel',finish);
    reduced.addEventListener('change',function(e){if(e.matches)finish();});
    portrait.addEventListener('click',function(){setOpen(true);});
    close.addEventListener('click',function(){setOpen(false);});
    card.addEventListener('keydown',function(e){if(e.key==='Escape'&&opened&&!turning){e.preventDefault();setOpen(false);}});
  });
})();

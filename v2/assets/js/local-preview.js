/* Nested Apache localhost preview routing; production URLs remain unchanged. */
(function(){
  'use strict';
  var base=window.AW_LOCAL_BASE;
  if(!base)return;
  var routes={"/":"index.html","/services":"index.html#services","/services.html":"index.html#services","/contact":"contact.html","/api/contact":"contact.php","/dubai-it-campaign.html":"dubai-it-campaign.html","/dubai-it-campaign":"dubai-it-campaign.html","/document-attestation-uae.html":"document-attestation-uae.html","/document-attestation-uae":"document-attestation-uae.html","/police-clearance-certificate-uae.html":"police-clearance-certificate-uae.html","/police-clearance-certificate-uae":"police-clearance-certificate-uae.html","/blog.html":"blog.html","/blog":"blog.html","/mainland-company-dubai.html":"mainland-company-dubai.html","/mainland-company-dubai":"mainland-company-dubai.html","/index.html":"index.html","/about.html":"about.html","/about":"about.html","/contact.html":"contact.html","/family-visa-emirates-id-uae.html":"family-visa-emirates-id-uae.html","/family-visa-emirates-id-uae":"family-visa-emirates-id-uae.html","/corporate-tax-vat-uae.html":"corporate-tax-vat-uae.html","/corporate-tax-vat-uae":"corporate-tax-vat-uae.html","/indian-passport-appointment-uae.html":"indian-passport-appointment-uae.html","/indian-passport-appointment-uae":"indian-passport-appointment-uae.html","/blog-post.html":"blog-post.html","/blog-post":"blog-post.html","/golden-visa-uae.html":"golden-visa-uae.html","/golden-visa-uae":"golden-visa-uae.html","/pro-services-dubai.html":"pro-services-dubai.html","/pro-services-dubai":"pro-services-dubai.html","/india-independence-day-uae.html":"india-independence-day-uae.html","/india-independence-day-uae":"india-independence-day-uae.html","/free-zone-vs-mainland-dubai.html":"free-zone-vs-mainland-dubai.html","/free-zone-vs-mainland-dubai":"free-zone-vs-mainland-dubai.html","/tools/index.html":"tools/index.html","/tools":"tools/index.html","/tools/corporate-tax-calculator.html":"tools/corporate-tax-calculator.html","/tools/corporate-tax-calculator":"tools/corporate-tax-calculator.html","/tools/public-holidays-uae.html":"tools/public-holidays-uae.html","/tools/public-holidays-uae":"tools/public-holidays-uae.html","/resources/index.html":"resources/index.html","/resources":"resources/index.html","/resources/det.html":"resources/det.html","/resources/det":"resources/det.html","/resources/icp.html":"resources/icp.html","/resources/icp":"resources/icp.html","/resources/indian-passport-renewal.html":"resources/indian-passport-renewal.html","/resources/indian-passport-renewal":"resources/indian-passport-renewal.html","/resources/mohre.html":"resources/mohre.html","/resources/mohre":"resources/mohre.html","/resources/gdrfa.html":"resources/gdrfa.html","/resources/gdrfa":"resources/gdrfa.html","/resources/mofa.html":"resources/mofa.html","/resources/mofa":"resources/mofa.html","/ar/blog.html":"ar/blog.html","/ar/blog":"ar/blog.html","/ar/index.html":"ar/index.html","/ar":"ar/index.html","/ar/about.html":"ar/about.html","/ar/about":"ar/about.html","/ar/contact.html":"ar/contact.html","/ar/contact":"ar/contact.html","/ar/resources.html":"ar/resources.html","/ar/resources":"ar/resources.html","/blog/mainland-company-dubai":"mainland-company-dubai.html","/blog/uae-golden-visa":"golden-visa-uae.html","/blog/police-clearance-certificate-uae":"police-clearance-certificate-uae.html","/blog/indian-passport-appointment-uae":"indian-passport-appointment-uae.html","/blog/india-independence-day-uae":"india-independence-day-uae.html","/blog/free-zone-vs-mainland-dubai":"free-zone-vs-mainland-dubai.html","/blog/document-attestation-uae":"document-attestation-uae.html","/blog/corporate-tax-vat-uae":"corporate-tax-vat-uae.html","/blog/family-visa-emirates-id-uae":"family-visa-emirates-id-uae.html","/blog/pro-services-dubai":"pro-services-dubai.html","/blog/dubai-it-campaign":"dubai-it-campaign.html","/contact.php":"contact.html","/v2/contact.php":"contact.html","/contact-us":"contact.html","/contact-us.php":"contact.html","/contact-us.html":"contact.html","/contactus":"contact.html","/about-us":"about.html","/about-us.php":"about.html","/about-us.html":"about.html","/aboutus":"about.html","/company":"about.html","/company.php":"about.html","/team":"about.html#team","/team.php":"about.html#team","/team.html":"about.html#team","/our-team":"about.html#team","/services.php":"index.html#services","/index.php":"index.html","/home":"index.html","/home.php":"index.html"};
  function resolve(value){
    if(!value||value[0]==='#'||/^[a-z][a-z0-9+.-]*:/i.test(value)||value.slice(0,2)==='//'||value.indexOf(base)===0)return value;
    if(value[0]!=='/'){
      if(value.indexOf('assets/')===0)return base+value;
      if(/^(index|about|blog|contact)\.(html|php)([?#]|$)/.test(value)){
        var prefix=location.pathname.indexOf(base+'ar/')===0?'ar/':'';
        return base+prefix+value.replace(/^contact\.php/,'contact.html');
      }
      var relative=new URL(value,location.href);
      if(relative.pathname.indexOf(base)===0){var key='/'+relative.pathname.slice(base.length);if(routes[key])return base+routes[key]+relative.search+relative.hash;}
      return value;
    }
    var u=new URL(value,location.origin),path=u.pathname.replace(/\/$/,'')||'/';
    if(path.indexOf('/assets/')===0)return base+path.slice(1)+u.search+u.hash;
    if(path.indexOf('/v2/')===0)path=path.slice(3);
    var dest=routes[path];
    if(!dest)return value;
    return base+dest+u.search+(dest.indexOf('#')<0?u.hash:'');
  }
  function rewrite(node){
    if(node.nodeType!==1)return;
    ['href','src','action','poster'].forEach(function(attr){if(node.hasAttribute(attr)){var old=node.getAttribute(attr),next=resolve(old);if(next!==old)node.setAttribute(attr,next);}});
    if(node.hasAttribute('srcset')){var old=node.getAttribute('srcset');var next=old.split(',').map(function(part){return part.trim().split(/\s+/).map(function(v,i){return i===0?resolve(v):v;}).join(' ');}).join(', ');if(next!==old)node.setAttribute('srcset',next);}
  }
  function tree(node){rewrite(node);if(node.querySelectorAll)node.querySelectorAll('[href],[src],[action],[srcset],[poster]').forEach(rewrite);}
  new MutationObserver(function(records){records.forEach(function(r){if(r.type==='attributes')rewrite(r.target);else r.addedNodes.forEach(tree);});}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['href','src','action','srcset','poster']});
  tree(document.documentElement);
  window.AW_LOCAL_RESOLVE=resolve;
})();

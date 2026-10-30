#!/usr/bin/env python3
"""Check search metadata, JSON-LD, sitemap and deployed internal links/assets."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, urljoin, unquote
from collections import Counter
import json,re,sys,xml.etree.ElementTree as ET
from importlib.util import spec_from_file_location,module_from_spec
spec=spec_from_file_location('seo_update',Path(__file__).with_name('update-seo.py'));seo=module_from_spec(spec);spec.loader.exec_module(seo)
WEB=seo.WEB;SITE=seo.SITE
errors=[]
class Page(HTMLParser):
 def __init__(self,source):
  super().__init__();self.meta={};self.links=[];self.images=[];self.assets=[];self.ids=[];self.h1=0;self.titles=0;self.canonicals=[];self.feed(source)
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='meta':self.meta.setdefault(a.get('name',a.get('property','')),[]).append(a.get('content',''))
  if tag=='title':self.titles+=1
  if tag=='h1':self.h1+=1
  if tag=='link' and a.get('rel')=='canonical':self.canonicals.append(a.get('href'))
  if tag=='link' and a.get('rel') in ('stylesheet','icon','apple-touch-icon','preload'):self.assets.append(a.get('href',''))
  if tag=='a':self.links.append(a.get('href',''))
  if tag=='script' and a.get('src'):self.assets.append(a['src'])
  if tag=='img':
   self.images.append(a);self.assets.append(a.get('src',''))
   self.assets += [v.strip().split()[0] for v in a.get('srcset','').split(',') if v.strip()]
parsed={}
for f in WEB.rglob('*.html'):
 source=f.read_text();p=Page(source)
 if any('noindex' in v for v in p.meta.get('robots',[])):continue
 if len(p.canonicals)!=1:errors.append(f'{f.relative_to(WEB)}: expected one canonical');continue
 canonical=p.canonicals[0];parsed[canonical]=(f,p,source)
 if not canonical.startswith(SITE+'/'):errors.append(f'{f}: wrong canonical host')
 if p.h1!=1 or p.titles!=1:errors.append(f'{f}: expected one H1 and title')
 for key in ('description','robots','og:title','og:description','og:url','og:image','og:image:alt','twitter:card','twitter:image','twitter:image:alt'):
  if len(p.meta.get(key,[]))!=1 or not p.meta[key][0]:errors.append(f'{f}: missing or duplicate {key}')
 if p.meta.get('og:url')!=[canonical]:errors.append(f'{f}: OG URL differs from canonical')
 duplicates=[v for v,c in Counter(p.ids).items() if c>1]
 if duplicates:errors.append(f'{f}: duplicate IDs {duplicates}')
 for img in p.images:
  if 'alt' not in img:errors.append(f'{f}: image missing alt: {img.get("src")}')
 for match in re.finditer(r'<script\b[^>]*type=[\"\']application/ld\+json[\"\'][^>]*>(.*?)</script>',source,re.S):
  try:json.loads(match[1])
  except ValueError as e:errors.append(f'{f}: invalid JSON-LD: {e}')
for canonical,(f,p,source) in parsed.items():
 for asset in p.assets + [p.meta['og:image'][0],p.meta['twitter:image'][0]]:
  url=urlsplit(urljoin(canonical,asset))
  if url.netloc!=urlsplit(SITE).netloc:continue
  path=WEB/unquote(url.path).lstrip('/')
  if not path.is_file():errors.append(f'{f.relative_to(WEB)}: missing asset {url.path}')
 for href in p.links:
  if not href or href.startswith(('mailto:','tel:','javascript:')):continue
  u=urlsplit(urljoin(canonical,href))
  if u.netloc!=urlsplit(SITE).netloc:continue
  target=SITE+(u.path.rstrip('/') or '/')
  # Legacy paths are validated against the configured redirects.
  redirects=json.loads((WEB.parent/'vercel.json').read_text()).get('redirects',[])
  redirect=next((r['destination'] for r in redirects if r['source']==u.path),None)
  if redirect:
   dest=urlsplit(urljoin(SITE,redirect));target=SITE+(dest.path.rstrip('/') or '/')
  if target not in parsed:errors.append(f'{f.relative_to(WEB)}: unresolved internal page {href}');continue
  if u.fragment and u.fragment not in parsed[target][1].ids:errors.append(f'{f.relative_to(WEB)}: missing anchor {href}')
 # Check actual OG dimensions, including pre-existing social images.
 image=WEB/urlsplit(p.meta['og:image'][0]).path.lstrip('/')
 if image.exists():
  dimensions=seo.image_size(image)
  if dimensions:
   for key,value in zip(('og:image:width','og:image:height'),dimensions):
    if p.meta.get(key)!=[str(value)]:errors.append(f'{f}: incorrect {key}')
ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9','image':'http://www.google.com/schemas/sitemap-image/1.1'}
root=ET.parse(WEB/'sitemap.xml').getroot();urls=[e.text for e in root.findall('s:url/s:loc',ns)]
if set(urls)!=set(parsed):errors.append('Sitemap does not match canonical indexable pages')
if len(urls)!=len(set(urls)):errors.append('Duplicate sitemap URLs')
for e in root.findall('.//image:loc',ns):
 if not (WEB/urlsplit(e.text).path.lstrip('/')).is_file():errors.append('Missing sitemap image '+e.text)
for field in ('description','og:title'):
 counts=Counter(p.meta[field][0] for _,p,_ in parsed.values())
 if any(c>1 for c in counts.values()):errors.append('Duplicate '+field)
if errors:
 print('\n'.join(sorted(set(errors))));sys.exit(1)
print(f'PASS: {len(parsed)} pages; unique metadata, JSON-LD, canonical links, sitemap, images, internal links and anchors.')

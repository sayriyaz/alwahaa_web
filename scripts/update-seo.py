#!/usr/bin/env python3
"""Refresh static search metadata from visible Alwahaa page content.
Run after the PHP/resource exporters when rebuilding generated pages.
"""
from pathlib import Path
from html import escape, unescape
from html.parser import HTMLParser
from urllib.parse import urlsplit, urlunsplit
import json, re, struct, xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / 'v2'
SITE = 'https://www.alwahaagroup.com'
MODIFIED = '2026-10-30'
BRAND = 'Alwahaa Documents Clearing LLC'
BUSINESS = SITE + '/#business'

class Head(HTMLParser):
    def __init__(self, text):
        super().__init__(); self.meta={}; self.canonical=''; self.title=''; self.in_title=False
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag=='meta': self.meta[attrs.get('name',attrs.get('property',''))]=attrs.get('content','')
        if tag=='link' and attrs.get('rel')=='canonical': self.canonical=attrs.get('href','')
        if tag=='title': self.in_title=True
    def handle_endtag(self, tag):
        if tag=='title': self.in_title=False
    def handle_data(self, text):
        if self.in_title: self.title+=text

def image_size(path):
    data=path.read_bytes()
    if data[:8]==b'\x89PNG\r\n\x1a\n': return struct.unpack('>II',data[16:24])
    if data[:4]==b'RIFF' and data[8:12]==b'WEBP':
        kind=data[12:16]
        if kind==b'VP8X': return (1+int.from_bytes(data[24:27],'little'),1+int.from_bytes(data[27:30],'little'))
        if kind==b'VP8 ': return tuple(x & 0x3fff for x in struct.unpack('<HH',data[26:30]))
        if kind==b'VP8L':
            bits=int.from_bytes(data[21:25],'little');return (1+(bits&0x3fff),1+((bits>>14)&0x3fff))
    if data[:2]==b'\xff\xd8':
        i=2
        while i<len(data):
            if data[i]!=255: i+=1;continue
            marker=data[i+1];i+=2
            if marker in (216,217):continue
            size=int.from_bytes(data[i:i+2],'big')
            if marker in (192,193,194,195,197,198,199,201,202,203,205,206,207):
                h,w=struct.unpack('>HH',data[i+3:i+7]);return w,h
            i+=size
    return None

def meta(text, key, value, prop=False):
    attr='property' if prop else 'name'
    tag=f'<meta {attr}="{key}" content="{escape(str(value),quote=True)}" />'
    pattern=r'<meta\b(?=[^>]*\b'+attr+r'=[\"\']'+re.escape(key)+r'[\"\'])[^>]*>'
    if re.search(pattern,text,re.I):return re.sub(pattern,lambda m:tag,text,count=1,flags=re.I)
    return text.replace('</head>','  '+tag+'\n</head>',1)

def plain(text):return unescape(re.sub('<[^>]+>',' ',text)).strip()
def slug(text):return re.sub('[^a-z0-9]+','-',text.lower()).strip('-')
def schema_tag(obj, label=''):
    return '<script type="application/ld+json"'+(' data-seo="'+label+'"' if label else '')+'>'+json.dumps(obj,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')+'</script>'

def schemas(text):
    return [json.loads(m[1]) for m in re.finditer(r'<script\b[^>]*type=[\"\']application/ld\+json[\"\'][^>]*>(.*?)</script>',text,re.S)]

KEY_PAGES={
 '/':('Alwahaa Documents Clearing LLC | Business Setup Dubai','Business setup, visas, Emirates ID, attestation and corporate PRO services in Deira, Dubai. Alwahaa Documents Clearing LLC, serving the UAE since 1983.'),
 '/about':('About Alwahaa Documents Clearing LLC | Dubai Since 1983','Meet the Alwahaa Documents Clearing LLC team in Deira, Dubai. Four decades of experience in company formation, visa support, attestation and PRO services.'),
 '/contact':('Contact Alwahaa Documents Clearing LLC | Deira, Dubai','Contact Alwahaa Documents Clearing LLC in Port Saeed, Deira, Dubai for business setup, visa, attestation and PRO support. Call +971 4 255 2895.'),
 '/resources':('UAE Government Services Guides | Alwahaa Dubai','Independent guides to ICP, GDRFA, MOHRE, DET and MOFA services, with official links and document support from Alwahaa Documents Clearing LLC in Dubai.'),
 '/resources/det':('Dubai Trade Licence & DET Guide | Alwahaa','Understand Dubai trade licence applications, renewals and DET services. Independent guidance and licensing support from Alwahaa Documents Clearing LLC.'),
 '/resources/gdrfa':('GDRFA Dubai Visa & Residency Guide | Alwahaa','Independent guide to GDRFA Dubai entry permits, residence visas and status changes, with application and document support from Alwahaa in Deira.'),
 '/resources/icp':('ICP Emirates ID & Residency Guide | Alwahaa Dubai','Independent guide to ICP Emirates ID and UAE residency services, official links and application paperwork support from Alwahaa Documents Clearing LLC.'),
 '/resources/mohre':('MOHRE Work Permits & WPS Guide | Alwahaa Dubai','Independent guide to MOHRE labour contracts, work permits, Tasheel and WPS. Get employee paperwork support from Alwahaa Documents Clearing LLC in Dubai.'),
 '/resources/mofa':('MOFA Document Attestation UAE Guide | Alwahaa','Understand UAE MOFA certificate attestation and embassy coordination. Independent guidance and document support from Alwahaa Documents Clearing LLC.'),
}
IMAGES={
 '/':('dubai-hero-daylight.webp','Dubai skyline illustration for Alwahaa business setup and document clearing services'),
 '/about':('about-creek-heritage.webp','Dubai-inspired Creek and heritage scene for Alwahaa Documents Clearing LLC'),
 '/ar':('dubai-hero-daylight.webp','مشهد دبي لخدمات تأسيس الشركات وتخليص المعاملات من الواحة'),
 '/ar/about':('about-creek-heritage.webp','مشهد تراثي مستوحى من خور دبي لشركة الواحة لتخليص المعاملات'),
 '/contact':('services/individual/corporate-pro-abdullah.webp','Alwahaa corporate PRO consultation and document support in Dubai'),
 '/ar/contact':('services/individual/corporate-pro-abdullah.webp','خدمات المتابعة الحكومية وتخليص المعاملات من الواحة في دبي'),
 '/resources':('services/individual/corporate-pro-abdullah.webp','Government application and document coordination at Alwahaa Dubai'),
 '/resources/det':('services/individual/trade-licence.webp','Trade licence paperwork for Dubai business licensing'),
 '/resources/icp':('services/individual/emirates-id-medical.webp','Emirates ID and medical typing application paperwork'),
 '/resources/gdrfa':('services/individual/employment-visit-visa.webp','Passport and documents prepared for a Dubai visa consultation'),
 '/resources/mohre':('services/individual/labour-work-permit-hasim.webp','Employment contract and work permit consultation illustration'),
 '/resources/mofa':('services/individual/certificate-attestation.webp','Certificates prepared for UAE attestation'),
 '/resources/indian-passport-renewal':('passport_service_alhind_og.jpg','Indian passport and consular services guide in the UAE'),
 '/tools':('services/individual/vat-corporate-tax.webp','UAE business paperwork and tax planning tools'),
 '/tools/public-holidays-uae':('dubai-hero-daylight.webp','Dubai skyline accompanying the UAE public holidays calendar'),
}
TEAM=[
 {'@type':'Person','@id':SITE+'/about#mohammed-abdullah','name':'Mohammed Abdullah','jobTitle':'GM · Senior PRO','image':SITE+'/assets/img/team-mohammed-abdullah.jpg','telephone':'+971502277187','knowsLanguage':['Tamil','Arabic','Urdu','Hindi','English','Malayalam'],'hasCredential':{'@type':'EducationalOccupationalCredential','name':'MA (Arabic)'}},
 {'@type':'Person','@id':SITE+'/about#mohamed-hasim','name':'Mohamed Hasim','jobTitle':'Assistant PRO','image':SITE+'/assets/img/team-mohamed-hasim.webp','telephone':'+971526654290','knowsLanguage':['Tamil','English'],'hasCredential':{'@type':'EducationalOccupationalCredential','name':'MBA (FM)'}},
 {'@type':'Person','@id':SITE+'/about#kogila-priya','name':'Kogila Priya','jobTitle':'Accountant','image':SITE+'/assets/img/team-kogila-priya.webp','telephone':'+971527060592','knowsLanguage':['Tamil','English','Sinhala','Hindi','Malayalam'],'hasCredential':{'@type':'EducationalOccupationalCredential','name':'B.Com'}},
]
for person in TEAM:person['worksFor']={'@id':BUSINESS}

def update():
    # Add stable, meaningful service anchors and match the visible service catalogue.
    home=WEB/'index.html';text=home.read_text()
    catalogue=[]
    def service(match):
        block=match[0]; name=plain(re.search(r'<h3>(.*?)</h3>',block,re.S)[1]);id=slug(name)
        block=re.sub(r'<article class="service-entry"(?: id="[^"]+")?',f'<article class="service-entry" id="{id}"',block,count=1)
        img=re.search(r'<img\b[^>]*src="([^"]+)"',block)[1].replace('./','',1)
        detail=plain(re.search(r'<details>.*?<p>(.*?)</p>',block,re.S)[1])
        catalogue.append({'@type':'Service','@id':SITE+'/#'+id+'-service','name':name,'serviceType':name,'description':detail,'url':SITE+'/#'+id,'image':SITE+'/'+img,'provider':{'@id':BUSINESS},'areaServed':{'@type':'Country','name':'United Arab Emirates'}})
        return block
    text=re.sub(r'<article class="service-entry".*?</article>',service,text,flags=re.S)
    text=text.replace('Business setup, visas and government<br class="desktop-break"> paperwork, guided by one experienced team.','Business setup, visas and document clearing in Dubai,<br class="desktop-break"> guided by one experienced team in Deira.')
    text=re.sub(r'  <link rel="preload" as="image" href="\./assets/img/home-gateway-(light|dark).webp"[^>]*>\n','',text)
    home.write_text(text)
    pages=[]
    canonical_files={p.resolve():Head(p.read_text()).canonical for p in WEB.rglob('*.html')}
    for path in sorted(WEB.rglob('*.html')):
        text=path.read_text();head=Head(text)
        if not head.canonical or 'noindex' in head.meta.get('robots',''):continue
        route=urlsplit(head.canonical).path or '/';arabic='/ar'==route or route.startswith('/ar/')
        title,desc=KEY_PAGES.get(route,(head.title,head.meta['description']))
        text=re.sub(r'<title>.*?</title>','<title>'+escape(title)+'</title>',text,count=1,flags=re.S)
        text=meta(text,'description',desc)
        image,alt=IMAGES.get(route,(None,None))
        image=SITE+'/assets/img/'+image if image else head.meta.get('og:image',SITE+'/assets/img/lockup.png').split('?')[0]
        alt=alt or title
        for key,value in [('og:title',title),('og:description',desc),('og:url',head.canonical),('og:site_name',BRAND),('og:image',image),('og:image:alt',alt),('og:locale','ar_AE' if arabic else 'en_AE')]:text=meta(text,key,value,True)
        size=image_size(WEB/urlsplit(image).path.lstrip('/'))
        if size:
            text=meta(text,'og:image:width',size[0],True);text=meta(text,'og:image:height',size[1],True)
        for key,value in [('twitter:card','summary_large_image'),('twitter:title',title),('twitter:description',desc),('twitter:image',image),('twitter:image:alt',alt),('author',BRAND),('robots','index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1')]:text=meta(text,key,value)
        if not re.search('name="twitter:site"',text):text=meta(text,'twitter:site','@al_wahaabiz')
        # Always refresh homepage shared CSS after design changes.
        text=re.sub(r'main.css\?v=[^"\s]+','main.css?v=20261030seo',text)
        # Keep company facts and schema in sync with the visible team and service catalogue.
        text=re.sub(r'\s*<script type="application/ld\+json" data-seo="supplemental">.*?</script>','',text,flags=re.S)
        def enrich(match):
            obj=json.loads(match[1])
            if obj.get('@type')=='GovernmentService':
                provider=obj.get('provider',{})
                obj={'@context':'https://schema.org','@type':'WebPage','@id':head.canonical+'#webpage','url':head.canonical,'name':title,'description':desc,'about':provider,'publisher':{'@id':BUSINESS},'inLanguage':'en-AE'}
            if obj.get('@type')=='CollectionPage':
                for subject in obj.get('about',[]) if isinstance(obj.get('about'),list) else []:
                    if isinstance(subject,dict) and subject.get('@type')=='GovernmentService':subject['@type']='GovernmentOrganization'
            nodes=list(obj.get('@graph',[obj]))
            if isinstance(obj.get('mainEntity'),dict) and obj['mainEntity'].get('@id')==BUSINESS:nodes.append(obj['mainEntity'])
            for node in nodes:
                if node.get('@type')=='WebPage' and node.get('@id')==SITE+'/#webpage':node.update(name=title,description=desc)
                if node.get('@id')==BUSINESS:
                    node['alternateName']=['Alwahaa Documents Clearing','Al Wahaa Documents Clearing LLC','الواحة لتخليص المعاملات ش.ذ.م.م']
                    node['image']=SITE+'/assets/img/lockup.png'
                    if isinstance(node.get('address'),dict):
                        node['address'].pop('postalCode',None);node['address']['postOfficeBoxNumber']='91270';node['address']['addressRegion']='Dubai'
                    node['knowsLanguage']=['English','Arabic','Tamil','Hindi','Malayalam','Urdu','Sinhala']
                    if path.name=='index.html' and not arabic:
                        node['employee']=[*node.get('employee',[])[:2],*TEAM]
                        node['hasOfferCatalog']={'@type':'OfferCatalog','name':'Alwahaa Dubai document clearing and business support services','itemListElement':[{'@type':'Offer','itemOffered':item} for item in catalogue]}
            if obj.get('@type')=='AboutPage':
                org=obj.get('mainEntity',{});org['employee']=[{'@type':'Person','name':'Riyazur Rahman','jobTitle':'Director'},{'@type':'Person','name':'Habib Rahman','jobTitle':'Director'},*TEAM]
            return schema_tag(obj)
        text=re.sub(r'<script\b[^>]*type=[\"\']application/ld\+json[\"\'][^>]*>(.*?)</script>',enrich,text,flags=re.S)
        # Replace generated supplemental schema on repeated runs.
        text=re.sub(r'\s*<script type="application/ld\+json" data-seo="supplemental">.*?</script>','',text,flags=re.S)
        extras=[]
        existing=schemas(text)
        if not any(o.get('@type')=='BreadcrumbList' for o in existing) and route not in ('/','/ar'):
            parts=[{'@type':'ListItem','position':1,'name':'الرئيسية' if arabic else 'Home','item':SITE+('/ar' if arabic else '/')}]
            parent='/resources' if route.startswith('/resources/') else '/tools' if route.startswith('/tools/') else '/blog' if route.startswith('/blog/') else None
            if parent:parts.append({'@type':'ListItem','position':2,'name':{'/resources':'Resources','/tools':'Tools','/blog':'Newsroom'}[parent],'item':SITE+parent})
            parts.append({'@type':'ListItem','position':len(parts)+1,'name':title.split(' | ')[0],'item':head.canonical})
            extras.append({'@type':'BreadcrumbList','itemListElement':parts})
        if not any(o.get('@type') in ('WebPage','AboutPage','ContactPage','CollectionPage','BlogPosting') or '@graph' in o for o in existing):
            extras.append({'@type':'WebPage','@id':head.canonical+'#webpage','url':head.canonical,'name':title,'description':desc,'isPartOf':{'@id':SITE+'/#website'},'publisher':{'@id':BUSINESS},'inLanguage':'ar-AE' if arabic else 'en-AE'})
        extras.append({'@type':'ImageObject','@id':head.canonical+'#primaryimage','contentUrl':image,'caption':alt,**({'width':size[0],'height':size[1]} if size else {})})
        text=text.replace('</head>','  '+schema_tag({'@context':'https://schema.org','@graph':extras},'supplemental')+'\n</head>',1)
        # Descriptive staff identifiers can be linked from search/entity data.
        if path.name=='about.html':
            if not arabic:
                for slug_,name in [('mohammed-abdullah','Mohammed Abdullah'),('mohamed-hasim','Mohamed Hasim'),('kogila-priya','Kogila Priya')]:
                    text=text.replace(f'<article class="team-profile" aria-label="{name}">',f'<article class="team-profile" id="{slug_}" aria-label="{name}">')
                text=text.replace('data-count="6000" data-suffix="+">6000+','data-count="1000" data-suffix="+">1000+').replace('data-count="55" data-suffix="+">55+','data-count="50" data-suffix="+">50+').replace('Government Partners','Service channels')
            else:
                text=text.replace('data-count="6000" data-suffix="+">6000+','data-count="1000" data-suffix="+">1000+').replace('data-count="55" data-suffix="+">55+','data-count="50" data-suffix="+">50+')
        # Root-relative asset URLs also work on rewritten /blog/... routes.
        text=re.sub(r'(["\'])(?:\./|\.\./)?assets/',lambda m:m[1]+'/assets/',text)
        text=text.replace("+window.AW_LOCAL_BASE+'/assets/","+window.AW_LOCAL_BASE+'assets/")
        def internal_link(match):
            value=unescape(match[1]);u=urlsplit(value)
            if u.scheme or u.netloc or not u.path or u.path.startswith('/'):return match[0]
            target=(path.parent/u.path).resolve()
            canonical=canonical_files.get(target)
            if not canonical and u.path in ('index.html','about.html','blog.html','contact.html'):canonical=canonical_files.get((WEB/u.path).resolve())
            if not canonical and target.suffix=='.php':canonical=SITE+'/contact' if target.stem=='contact' else None
            if not canonical:return match[0]
            dest=urlsplit(canonical).path or '/'
            return 'href="'+escape(urlunsplit(('', '', dest, u.query, u.fragment)),quote=True)+'"'
        text=re.sub(r'href="([^"]+)"',internal_link,text)
        def img_attributes(match):
            tag=match[0];src=re.search(r'\bsrc="([^"]+)"',tag)
            if not src or not src[1].startswith('/assets/'):return tag
            f=WEB/src[1].lstrip('/')
            if not f.exists():return tag
            dimensions=image_size(f)
            if dimensions:
                for attr,value in zip(('width','height'),dimensions):
                    pattern=r'\b'+attr+r'="[^"]*"'
                    if re.search(pattern,tag):tag=re.sub(pattern,attr+'="'+str(value)+'"',tag)
                    else:tag=tag.replace('<img','<img '+attr+'="'+str(value)+'"',1)
            if 'decoding=' not in tag:tag=tag.replace('<img','<img decoding="async"',1)
            return tag
        text=re.sub(r'<img\b[^>]*>',img_attributes,text)
        path.write_text(text)
        pages.append((path,head.canonical,image))
    # Canonical image sitemap: current images actually used on the page, not obsolete art.
    NS='http://www.sitemaps.org/schemas/sitemap/0.9';IMG='http://www.google.com/schemas/sitemap-image/1.1';XHTML='http://www.w3.org/1999/xhtml'
    ET.register_namespace('',NS);ET.register_namespace('image',IMG);ET.register_namespace('xhtml',XHTML)
    root=ET.Element('{'+NS+'}urlset')
    available={url for _,url,_ in pages}
    for path,url,primary in pages:
        node=ET.SubElement(root,'{'+NS+'}url');ET.SubElement(node,'{'+NS+'}loc').text=url;ET.SubElement(node,'{'+NS+'}lastmod').text=MODIFIED
        route=urlsplit(url).path;pair=('/' if route=='/ar' else route[3:]) if route.startswith('/ar') else ('/ar' if route=='/' else '/ar'+route)
        if SITE+pair in available:
            en=url if not route.startswith('/ar') else SITE+pair;ar=SITE+pair if not route.startswith('/ar') else url
            for lang,href in [('en',en),('ar',ar),('x-default',en)]:ET.SubElement(node,'{'+XHTML+'}link',{'rel':'alternate','hreflang':lang,'href':href})
        images=[primary]
        if route=='/':images += [entry['image'] for entry in catalogue]
        if route=='/about':images += [entry['image'] for entry in TEAM]
        for src in dict.fromkeys(images):ET.SubElement(ET.SubElement(node,'{'+IMG+'}image'),'{'+IMG+'}loc').text=src
    ET.indent(root,space='  ');ET.ElementTree(root).write(WEB/'sitemap.xml',encoding='UTF-8',xml_declaration=True)
    print(f'Updated SEO for {len(pages)} canonical pages and {len(catalogue)} visible services.')

if __name__=='__main__':update()

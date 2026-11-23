import fs from 'fs';
const strip=s=>s.replace(/<[^>]+>/g,' ').replace(/&[a-z#0-9]+;/g,' ').replace(/\s+/g,' ').trim();
for(const f of process.argv.slice(2)){
 const h=fs.readFileSync(f,'utf8');
 const m=(re)=>{const x=h.match(re);return x?strip(x[1]):''};
 console.log('\n########',f);
 console.log('TITLE:',m(/<meta name="DC.title" content="([^"]+)"/)||m(/<title>([^<]+)/));
 console.log('INVENTORS:',[...h.matchAll(/<meta name="DC.contributor" content="([^"]+)" scheme="inventor"/g)].map(x=>x[1]).join('; '));
 console.log('ASSIGNEE:',[...h.matchAll(/<meta name="DC.contributor" content="([^"]+)" scheme="assignee"/g)].map(x=>x[1]).join('; '));
 console.log('DATES:',[...h.matchAll(/<meta name="DC.date" content="([^"]+)" scheme="([^"]+)"/g)].map(x=>x[2]+'='+x[1]).join(' '));
 console.log('ABSTRACT:',m(/itemprop="abstract"[^>]*>([\s\S]*?)<\/section>/).slice(0,700));
 const claims=m(/itemprop="claims"[^>]*>([\s\S]*?)<\/section>/);
 console.log('CLAIMS(1500):',claims.slice(0,1500));
 console.log('CITES:',[...h.matchAll(/itemprop="citations?"[\s\S]{0,300}?itemprop="publicationNumber">([^<]+)</g)].length,'| backwardRefs sample:',[...new Set([...h.matchAll(/<td itemprop="publicationNumber">([^<]+)<\/td>/g)].map(x=>x[1]))].slice(0,12).join(', '));
 console.log('LEGAL:',[...h.matchAll(/itemprop="status">([^<]+)</g)].map(x=>x[1]).slice(0,2).join('|'), strip((h.match(/Legal Events[\s\S]{0,1200}/)||[''])[0]).slice(0,300));
 console.log('FAMILY/classes:',[...new Set([...h.matchAll(/itemprop="Code">([^<]+)</g)].map(x=>x[1]))].slice(0,10).join(','));
 const desc=m(/itemprop="description"[^>]*>([\s\S]*?)<\/section>/);
 console.log('DESC_LEN',desc.length); fs.writeFileSync(f.replace('.html','.txt'),desc+'\n\nCLAIMS:\n'+claims);
}

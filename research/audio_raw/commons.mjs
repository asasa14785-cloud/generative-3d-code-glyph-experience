const qs=process.argv.slice(2);
for(const q of qs){
 const u="https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=8&gsrsearch="+encodeURIComponent(q+" filetype:audio")+"&prop=imageinfo&iiprop=url|size|mime|extmetadata|mediatype&iiextmetadatafilter=LicenseShortName|Artist|ImageDescription";
 const r=await fetch(u,{headers:{'user-agent':'GardenWithinResearch/1.0 (research project; contact: none)'}});
 const j=await r.json(); console.log('##',q);
 for(const p of Object.values(j.query?.pages||{})){const i=p.imageinfo?.[0];if(!i)continue;const m=i.extmetadata||{};
  console.log(' ',p.title,'|',m.LicenseShortName?.value,'|',(i.size/1024|0)+'KB','|',(m.Artist?.value||'').replace(/<[^>]+>/g,'').slice(0,40),'|',(m.ImageDescription?.value||'').replace(/<[^>]+>/g,'').slice(0,70))}
 await new Promise(r=>setTimeout(r,6000));
}

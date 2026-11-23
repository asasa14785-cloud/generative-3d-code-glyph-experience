import fs from 'fs';
const UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36";
const queries=[
"character shape matching image to text characters log-polar",
"log-polar shape descriptor image matching",
"halftone character selection density dot pattern",
"variable radius morphological dilation erosion",
"optical color averaging image cell sampling",
"character deformation warping glyph image",
"text rendering image conversion glyph selection edge orientation",
"directional edge detection gradient orientation contour glyph",
"reaction diffusion biological pattern generation texture",
"L-system plant procedural generation branching",
"fractal tree generation computer graphics foliage",
"procedural flower petal geometry generation phyllotaxis",
"fluid flame simulation particle rendering fire",
"temporal smoothing flicker reduction video stabilization hysteresis",
"texture synthesis from exemplar glyph",
"typographic image mosaic characters rendering",
"character based image rendering font glyph density dithering",
"corneal reflection eye image environment map reconstruction",
"iris pattern concentric radial structure rendering",
"metamaterial structural color light manipulation",
"biomimetic surface reconstruction organic shape",
"heart model procedural cardiac surface parametric",
"GPU instanced glyph atlas text rendering signed distance field",
"multi-scale spatial sampling circular sampling regions shape vector",
"quadtree adaptive subdivision character cell size",
"depth map volumetric rendering layers transparent layered display",
"creating images from alphanumeric characters computer art",
"ASCII art generation from image",
"nonlinear dynamics strange attractor visualization pattern generation",
"procedural animation quadruped gait skeleton deer",
"light shafts god rays atmospheric scattering rendering"
];
const all=new Map();
for(const q of queries){
  try{
    const u="https://patents.google.com/xhr/query?url="+encodeURIComponent("q="+q.replace(/ /g,"+")+"&num=10")+"&exp=";
    const r=await fetch(u,{headers:{'user-agent':UA}});
    const j=await r.json();
    const res=j.results.cluster.flatMap(c=>c.result).slice(0,6);
    for(const x of res){const id=x.id.replace('patent/','').replace(/\/en$/,'');
      if(!all.has(id)) all.set(id,{id,title:x.patent.title.trim(),priority:x.patent.priority_date,assignee:x.patent.assignee,inventor:x.patent.inventor,snippet:x.patent.snippet.replace(/<[^>]+>|&hellip;/g,'').trim().slice(0,260),query:q});}
    console.log(q,'->',res.length);
  }catch(e){console.log('ERR',q,e.message)}
}
fs.writeFileSync('candidates.json',JSON.stringify([...all.values()],null,1));
console.log('total',all.size);

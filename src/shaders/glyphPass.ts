export const FULLSCREEN_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec3 position;
out vec2 vUv;
void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// ---------------------------------------------------------------------------------------------
// CELL PASS: one texel per character cell. Shape-aware glyph matching (Glif-style 6 circle vector
// + 10 external circles for directional contrast), role (family) masks, orientation bias from
// Sobel/flow, temporal hysteresis, optical colour averaging inputs.
// ---------------------------------------------------------------------------------------------
export const CELL_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
layout(location=0) out vec4 oA;
layout(location=1) out vec4 oB;
uniform sampler2D uColor;
uniform sampler2D uData;
uniform sampler2D uPrev;
uniform sampler2D uGlyphT;
uniform vec2 uGrid;
uniform float uNG;
uniform float uInkMax;
uniform float uTime;
uniform float uHyst;
uniform float uReset;
uniform float uCodeLen;
uniform float uCode[160];
const float PI = 3.14159265;
const vec2 IC[6] = vec2[6](vec2(.25,.20), vec2(.75,.13), vec2(.25,.53), vec2(.75,.47), vec2(.25,.87), vec2(.75,.80));
const vec2 EC[10] = vec2[10](vec2(0.,-.17), vec2(.5,-.17), vec2(1.,-.17), vec2(-.25,.33), vec2(-.25,.67), vec2(1.25,.33), vec2(1.25,.67), vec2(0.,1.17), vec2(.5,1.17), vec2(1.,1.17));
const int AFF[24] = int[24](0,1,2,4, 0,1,3,5, 2,4,6,-1, 3,5,7,-1, 4,6,8,9, 5,7,8,9);

float lum(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }

vec4 gT03; vec2 gT45; int gFam; float gCls; float gOw;
float glyphErr(int g){
  vec4 r0 = texelFetch(uGlyphT, ivec2(g,0), 0);
  vec4 r1 = texelFetch(uGlyphT, ivec2(g,1), 0);
  vec4 r2 = texelFetch(uGlyphT, ivec2(g,2), 0);
  vec4 a = gT03 - r0; vec2 b = gT45 - r1.xy;
  float e = dot(a,a) + dot(b,b);
  int mask = int(r1.z + 0.5);
  if(((mask >> gFam) & 1) == 0) e += 4.0;
  if(r2.y > -0.5 && gOw > 0.0) e += (abs(r2.y - gCls) < 0.5 ? -0.05 : 0.07)*gOw;
  return e;
}
float dirClass(vec2 d){
  float a = atan(d.y, d.x); if(a < 0.0) a += PI;
  return floor(mod(a/(PI*0.25)+0.5, 4.0));
}

void main(){
  vec2 f = floor(gl_FragCoord.xy);
  ivec2 fc = ivec2(f);
  vec2 b0 = floor(f/2.0)*2.0;
  float cw = 0.0;
  for(int i=0;i<4;i++){
    float w = texture(uData, (b0 + vec2(float(i&1), float(i>>1)) + 0.5)/uGrid).w;
    cw += (fract(w) > 0.25) ? 1.0 : 0.0;
  }
  bool coarse = cw > 3.5;
  float k = coarse ? 2.0 : 1.0;
  vec2 org = coarse ? b0 : f;
  vec2 size = k/uGrid;
  vec2 o = org/uGrid;
  vec4 dctr = texture(uData, o + 0.5*size);
  gFam = int(floor(dctr.w + 0.01));
  vec2 r = 0.28*size;
  float v[6]; float e[10];
  for(int i=0;i<6;i++){
    vec2 c = o + vec2(IC[i].x, 1.0 - IC[i].y)*size;
    float s = lum(texture(uColor, c).rgb);
    s += lum(texture(uColor, c + vec2(r.x,0.0)*0.6).rgb);
    s += lum(texture(uColor, c - vec2(r.x,0.0)*0.6).rgb);
    s += lum(texture(uColor, c + vec2(0.0,r.y)*0.6).rgb);
    s += lum(texture(uColor, c - vec2(0.0,r.y)*0.6).rgb);
    v[i] = s*0.2;
  }
  for(int i=0;i<10;i++){
    vec2 c = o + vec2(EC[i].x, 1.0 - EC[i].y)*size;
    e[i] = lum(texture(uColor, c).rgb);
  }
  float L = 0.0; for(int i=0;i<6;i++) L += v[i]; L /= 6.0;
  // gradient from external circles (y up)
  float gx = (e[5]+e[6])*0.5 - (e[3]+e[4])*0.5;
  float gy = (e[0]+e[1]+e[2])/3.0 - (e[7]+e[8]+e[9])/3.0;
  float em = length(vec2(gx,gy));
  // directional contrast (Glif): v = (v/max)^crunch * max, max over the circle and its affecting externals
  float wcr = clamp(em*5.0, 0.0, 1.0);
  for(int i=0;i<6;i++){
    float m = v[i];
    for(int a=0;a<4;a++){
      int ei = AFF[i*4+a];
      if(ei >= 0) m = max(m, e[ei]);
    }
    if(m > 1e-5){ float v2 = pow(v[i]/m, 1.7)*m; v[i] = mix(v[i], v2, wcr); }
  }
  // orientation: contour tangent from edges, otherwise the object's flow field
  gCls = -1.0; gOw = 0.0;
  vec2 fl = dctr.xy*2.0 - 1.0; float fl_l = length(fl);
  if(em > 0.06){ gCls = dirClass(vec2(-gy, gx)); gOw = clamp(em*6.0,0.0,1.0)*(gFam==3 ? 1.5 : 1.0); }
  else if(fl_l > 0.12){ gCls = dirClass(fl); gOw = fl_l*((gFam==3||gFam==6) ? 1.7 : 0.8); }
  float gain = uInkMax*(gFam==6 ? 1.12 : 1.0);
  gT03 = clamp(vec4(v[0],v[1],v[2],v[3])*gain, 0.0, 1.0);
  gT45 = clamp(vec2(v[4],v[5])*gain, 0.0, 1.0);
  int NG = int(uNG);
  int best = 0; float bestE = 1e9;
  for(int g=0; g<NG; g++){
    float ee = glyphErr(g);
    if(ee < bestE){ bestE = ee; best = g; }
  }
  int pg = int(texelFetch(uPrev, fc, 0).r + 0.5);
  if(uReset < 0.5 && pg < NG && pg != best){
    float ep = glyphErr(pg);
    if(ep <= bestE + uHyst) best = pg;
  }
  // atmosphere family: scrolling code ribbons wherever there is light
  if(gFam == 0 && L > 0.07){
    int ci = (fc.x + 7*fc.y + int(uTime*(3.0 + float(fc.y % 5)))) % int(uCodeLen);
    int cg = int(uCode[ci]);
    if(cg > 0) best = cg;
  }
  float ink = texelFetch(uGlyphT, ivec2(best,2), 0).x;
  vec3 C = texture(uColor, o + 0.5*size).rgb;
  C = (C*2.0 + texture(uColor, o + vec2(0.25,0.25)*size).rgb + texture(uColor, o + vec2(0.75,0.25)*size).rgb
        + texture(uColor, o + vec2(0.25,0.75)*size).rgb + texture(uColor, o + vec2(0.75,0.75)*size).rgb)/6.0;
  oA = vec4(float(best), coarse ? 1.0 : 0.0, ink, L);
  oB = vec4(C, float(gFam)/8.0);
}
`;

// ---------------------------------------------------------------------------------------------
// DISPLAY PASS: glyph atlas compositing, optical colour averaging, cell-scale bloom, grain, flash/fade
// ---------------------------------------------------------------------------------------------
export const DISPLAY_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
layout(location=0) out vec4 fragColor;
in vec2 vUv;
uniform sampler2D uCellA;
uniform sampler2D uCellB;
uniform sampler2D uAtlas;
uniform vec2 uGrid;
uniform vec2 uAtlasGrid;
uniform vec2 uPad;
uniform float uTime;
uniform float uFlash;
uniform float uFade;
uniform vec3 uFlashCol;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
void main(){
  vec2 g = vUv*uGrid;
  ivec2 ic = ivec2(clamp(floor(g), vec2(0.0), uGrid-1.0));
  vec4 A = texelFetch(uCellA, ic, 0);
  vec4 B = texelFetch(uCellB, ic, 0);
  vec2 cuv = A.g > 0.5 ? fract(g*0.5) : fract(g);
  float gi = floor(A.r + 0.5);
  vec2 rc = vec2(mod(gi, uAtlasGrid.x), floor(gi/uAtlasGrid.x));
  vec2 auv = vec2((rc.x + uPad.x + cuv.x*(1.0-2.0*uPad.x))/uAtlasGrid.x,
                  1.0 - (rc.y + uPad.y + (1.0-cuv.y)*(1.0-2.0*uPad.y))/uAtlasGrid.y);
  float cov = texture(uAtlas, auv).r;
  vec3 C = B.rgb;
  float ink = max(A.b, 0.0);
  // optical colour averaging: foreground chosen so that glyph ink + tinted background average to the target colour
  vec3 bg = C*0.11;
  vec3 fg = C*(1.0 - 0.11*(1.0-ink))/max(ink, 0.16);
  float fl = dot(fg, vec3(0.333));
  fg = min(mix(vec3(fl), fg, 1.12), vec3(2.6));
  // cell-scale bloom: neighbouring bright cells bleed light over the dark gaps
  vec3 glow = vec3(0.0); float wsum = 0.0;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    ivec2 n = clamp(ic + ivec2(i,j), ivec2(0), ivec2(uGrid)-1);
    vec2 dd = g - (vec2(n) + 0.5);
    float w = exp(-dot(dd,dd)*0.75);
    glow += texelFetch(uCellB, n, 0).rgb * (0.35 + texelFetch(uCellA, n, 0).a) * w; wsum += w;
  }
  glow /= wsum;
  vec3 col = mix(bg, fg, cov) + glow*0.20;
  vec2 q = vUv - 0.5;
  col *= 1.0 - 0.55*dot(q,q);
  col += (hash12(gl_FragCoord.xy + fract(uTime*7.13)*400.0) - 0.5)*0.025;
  col = mix(col, uFlashCol, clamp(uFlash,0.0,1.0));
  col *= 1.0 - clamp(uFade,0.0,1.0);
  fragColor = vec4(max(col,0.0), 1.0);
}
`;

// ---------------------------------------------------------------------------------------------
// INSTANCED GLYPH PARTICLES: world-space glyph billboards (pollen, corpuscles, embers)
// depth-tested against the world pass distance buffer.
// ---------------------------------------------------------------------------------------------
export const PARTICLE_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec3 position;
uniform mat4 uViewProj;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform float uTanF;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uW;      // pollen, corpuscle, ember weights
uniform vec4 uHold;   // finale rose centre + scale
uniform vec2 uEmber;  // birth start, birth span
uniform float uN0;
uniform float uN1;
uniform float uPG[18];
out vec2 vUv;
out vec3 vCol;
out float vDist;
out vec2 vScr;
out float vGlyph;
out float vA;
float h1(float n){ return fract(sin(n*12.9898)*43758.5453); }
void main(){
  float id = float(gl_InstanceID);
  float a1=h1(id+0.1), a2=h1(id+7.7), a3=h1(id+13.3), a4=h1(id+29.1), a5=h1(id+41.9), a6=h1(id+53.3), a7=h1(id+67.7);
  vec3 wp; float size; vec3 col; float alpha = 1.0; float cat;
  if(id < uN0){
    cat = 0.0;
    float B = 28.0;
    vec3 base = vec3(a1,a2,a3)*B;
    vec3 mv = vec3(0.35*sin(uTime*0.3+a1*20.0)+0.25, 0.10+0.05*sin(uTime*0.5+a2*30.0), 0.30*cos(uTime*0.27+a3*20.0))*uTime;
    wp = uCamPos + (fract((base + mv - uCamPos)/B) - 0.5)*B;
    size = 0.045 + 0.07*a4;
    col = mix(vec3(1.0,0.86,0.45), vec3(1.0,1.0,0.8), a5);
    alpha = (0.55 + 0.45*sin(uTime*2.0 + a6*40.0)) * step(a7, uW.x);
  } else if(id < uN1){
    cat = 1.0;
    float B = 18.0;
    vec3 base = vec3(a1,a2,a3)*B;
    vec3 sw = vec3(sin(uTime*0.9+a4*30.0), 0.0, cos(uTime*0.8+a5*30.0))*0.8;
    wp = uCamPos + (fract((base + sw - uCamPos)/B) - 0.5)*B;
    size = 0.10 + 0.20*a4;
    col = mix(vec3(1.0,0.12,0.10), vec3(1.0,0.55,0.3), a5);
    alpha = step(a7, uW.y);
  } else {
    cat = 2.0;
    float age = uTime - (uEmber.x + uEmber.y*a1);
    float life = 3.0 + 3.5*a2;
    float u = age/life;
    float sc = uHold.w;
    vec3 start = uHold.xyz + vec3(a3-0.5, a4*0.5-0.1, a5-0.5)*sc*0.45;
    vec3 vel = vec3((a6-0.5)*1.4, 1.8+3.2*a7, (a5-0.5)*1.4)*sc*0.06;
    vec3 sw = vec3(sin(age*1.7+a3*30.0), 0.0, cos(age*1.3+a4*20.0))*sc*0.10;
    wp = start + vel*age + sw*min(age,2.0);
    size = (0.018 + 0.022*a6)*sc*(1.0 - 0.6*u);
    col = mix(vec3(1.0,0.82,0.35), vec3(1.0,0.22,0.04), clamp(u,0.0,1.0))*2.0;
    alpha = (age > 0.0 && age < life && uW.z > 0.5) ? (1.0-u)*(0.7+0.3*sin(uTime*14.0+a1*50.0)) : 0.0;
  }
  vec4 cc = uViewProj*vec4(wp,1.0);
  float wdepth = max(cc.w, 0.01);
  float pxw = 2.0*wdepth*uTanF/uRes.y;
  size = max(size, 7.5*pxw);
  vec3 pos = wp + (uCamRight*position.x + uCamUp*position.y)*size;
  gl_Position = uViewProj*vec4(pos,1.0);
  if(alpha <= 0.0) gl_Position = vec4(2.0,2.0,2.0,1.0);
  vUv = position.xy + 0.5;
  vCol = col;
  vDist = length(wp - uCamPos);
  vScr = (cc.xy/cc.w)*0.5+0.5;
  vGlyph = uPG[int(cat)*6 + int(a7*5.99)];
  vA = alpha;
}
`;
export const PARTICLE_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
in vec3 vCol;
in float vDist;
in vec2 vScr;
in float vGlyph;
in float vA;
layout(location=0) out vec4 fragColor;
uniform sampler2D uAtlas;
uniform sampler2D uSceneData;
uniform vec2 uAtlasGrid;
uniform vec2 uPad;
void main(){
  float st = texture(uSceneData, vScr).z;
  if(vDist > st*1.01 + 0.15) discard;
  vec2 rc = vec2(mod(vGlyph, uAtlasGrid.x), floor(vGlyph/uAtlasGrid.x));
  vec2 auv = vec2((rc.x + uPad.x + vUv.x*(1.0-2.0*uPad.x))/uAtlasGrid.x, 1.0 - (rc.y + uPad.y + (1.0-vUv.y)*(1.0-2.0*uPad.y))/uAtlasGrid.y);
  float cov = texture(uAtlas, auv).r;
  fragColor = vec4(vCol*cov*vA*1.5, 1.0);
}
`;

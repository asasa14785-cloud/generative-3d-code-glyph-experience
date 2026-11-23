// Shared GLSL for the procedural world pass: noise, SDF primitives, the HERO ROSE and the HEART.
// The rose SDF below is the single source of truth for: garden rose, corneal reflection, ascent, and burning rose.

export const COMMON = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
layout(location=0) out vec4 gColor;
layout(location=1) out vec4 gData;
in vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform float uTanF;
uniform float uPulse;
uniform float uBeatT;
uniform vec4 uRose;   // xyz = bloom centre (world), w = scale
uniform vec4 uRoseS;  // x = open, y = stem bend, z = burn 0..1, w unused
uniform float uGlow;  // finale light from the burning rose
uniform float uBright;
uniform float uRoot;
const float PI = 3.14159265359;
const float S = 34.0; // heart scale (metres per unit)

float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
float hash13(vec3 p3){ p3 = fract(p3*0.1031); p3 += dot(p3, p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vnoise(vec3 p){
  vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x), mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x), mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y), f.z);
}
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return s; }
float smin(float a,float b,float k){ float h=max(k-abs(a-b),0.0)/k; return min(a,b)-h*h*k*0.25; }
float sdEll(vec3 p, vec3 r){ float k0=length(p/r); float k1=length(p/(r*r)); return k0*(k0-1.0)/max(k1,1e-5); }
float sdCap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/dot(ba,ba),0.0,1.0); return length(pa-ba*h)-r; }
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float bump(float x, float c, float w){ float d=(x-c)/w; return exp(-d*d); }

vec3 camRay(){
  vec2 uv = vUv*2.0-1.0; uv.x *= uRes.x/uRes.y;
  return normalize(uv.x*uTanF*uCamRight + uv.y*uTanF*uCamUp + uCamFwd);
}
vec2 flow2(vec3 d){ vec2 f = vec2(dot(d,uCamRight), dot(d,uCamUp)); float l=length(f); return l>1.0? f/l : f; }
vec3 tonemap(vec3 c){ c *= uBright; return 1.0 - exp(-c*1.25); }
// fam: 0 sky/light, 1 organic, 2 foliage, 3 grass, 4 fur, 5 petal, 6 fire, 7 eye. coarse: want big glyphs
void outp(vec3 col, float t, vec2 flow, float fam, float coarse){
  gColor = vec4(tonemap(col), 1.0);
  gData = vec4(flow*0.5+0.5, t, fam + 0.5*coarse);
}

// ---------------------------------------------------------------- HEART (unit space, y up)
float heartU(vec3 p){
  vec3 q = vec3(abs(p.x), p.y, p.z);
  float lobe = sdEll(q - vec3(0.50,0.34,0.0), vec3(0.56,0.60,0.52));
  float taper = mix(0.22,1.0,smoothstep(-0.95,0.15,p.y));
  vec3 b = p - vec3(0.0,-0.25,0.0);
  b.x /= taper; b.z /= mix(0.45,1.0,smoothstep(-0.95,0.1,p.y));
  float body = sdEll(b, vec3(0.92,0.72,0.58))*0.7;
  return smin(lobe, body, 0.2);
}
// anatomical surface detail: coronary vessels as raised contour curves of a noise field
float heartVeins(vec3 q){
  float f = vnoise(q*2.6+vec3(0.0,0.0,1.7))*14.0;
  return smoothstep(0.24,0.0,abs(sin(f)));
}

// ---------------------------------------------------------------- HERO ROSE (local unit space: head r~0.2, stem 1.0 below)
// returns (distance in world metres, material) material: 0 petal 1 stem 2 leaf 3 sepal
float roseBurnF(vec3 q){
  float n = vnoise(q*22.0+3.0);
  float rr = length(q.xz);
  float bf = uRoseS.z*1.9 - 0.95 + rr*1.6 + (n-0.5)*0.5;
  bf += (q.y < -0.1 ? -(q.y+0.1)*0.7 : 0.0);
  return bf;
}
vec2 roseMap(vec3 p){
  float s = uRose.w;
  vec3 q = (p - uRose.xyz)/s;
  float bb = length(q - vec3(0.0,-0.42,0.0)) - 0.78;
  if(bb > 0.12) return vec2(bb*s*0.9, 1.0);
  float open = uRoseS.y*0.0 + uRoseS.x;
  q.x += sin(uTime*1.3 + q.y*2.0)*0.01*clamp(-q.y,0.0,1.0);
  // ---- head: nested scalloped petal cups
  float head = 1e5;
  for(int k=0;k<6;k++){
    float fk = float(k);
    float R = 0.045 + 0.027*fk;
    vec3 hq = q;
    hq.y += 0.012*fk;
    float flare = 0.12*fk*(0.45+0.55*open);
    float up = max(hq.y,0.0);
    hq.xz /= 1.0 + flare*smoothstep(0.0, R, up);
    float n = 4.0 + mod(fk,2.0);
    float ph = fk*2.4 + 0.12*sin(uTime*1.7+fk*1.3);
    float ang = atan(hq.z,hq.x);
    float rimH = R*(0.98 - 0.13*fk + 0.15*open)*(1.0 + 0.24*cos(n*ang+ph));
    float shell = abs(length(hq) - R) - (0.0042+0.0011*fk);
    float cut = max(hq.y - rimH, -hq.y - R*0.78);
    head = min(head, max(shell,cut)*0.75);
  }
  float sepal = sdEll(q-vec3(0.0,-0.075,0.0), vec3(0.052,0.032,0.052));
  // ---- stem with bend, leaves swaying independently
  float u = clamp(-q.y,0.0,1.0);
  vec3 sq = q;
  sq.x -= 0.5*uRoseS.y*u*u + 0.02*sin(uTime*1.7+u*4.0)*u;
  float stem = max(length(sq.xz)-0.011, max(sq.y+1.0, -0.05-sq.y))*0.8;
  float leaf = 1e5;
  for(int l=0;l<2;l++){
    float fl = float(l);
    float side = l==0 ? 1.0 : -1.0;
    vec3 a = sq - vec3(0.0,-0.38-0.25*fl,0.0);
    a.xz = rot(side*1.15+0.35*fl) * a.xz;
    float dr = 0.45 + 0.15*sin(uTime*(1.1+0.4*fl)+fl*2.0) + 0.3*uRoseS.y;
    a.xy = rot(-dr) * a.xy;
    leaf = min(leaf, sdEll(a-vec3(0.085,0.0,0.0), vec3(0.095,0.0045,0.034))*0.8);
  }
  float d = head; float m = 0.0;
  if(sepal < d){ d = sepal; m = 3.0; }
  if(stem < d){ d = stem; m = 1.0; }
  if(leaf < d){ d = leaf; m = 2.0; }
  d = max(d, roseBurnF(q)*0.03);
  return vec2(d*s, m);
}
vec3 roseColor(vec3 p, vec3 n, vec3 rd, float m, vec3 L, vec3 Lc, vec3 amb){
  vec3 q = (p - uRose.xyz)/uRose.w;
  float bf = roseBurnF(q);
  vec3 alb;
  if(m < 0.5){
    float r = clamp(length(q)/0.2,0.0,1.2);
    alb = mix(vec3(0.30,0.0,0.03), vec3(0.95,0.05,0.10), smoothstep(0.1,1.0,r));
    float ang = atan(q.z,q.x);
    alb *= 0.88 + 0.12*sin(ang*21.0 + r*14.0);
    alb = mix(alb, vec3(0.7,0.03,0.08), 0.25*vnoise(q*60.0));
  } else if(m < 1.5) alb = vec3(0.10,0.34,0.07);
  else if(m < 2.5) alb = vec3(0.07,0.38,0.10)*(0.8+0.4*vnoise(q*50.0));
  else alb = vec3(0.12,0.30,0.08);
  float dif = max(dot(n,L),0.0);
  float wrap = max(dot(n,L)*0.5+0.5,0.0);
  vec3 h = normalize(L - rd);
  float spec = pow(max(dot(n,h),0.0), m<0.5? 24.0 : 40.0)*0.5;
  vec3 col = alb*(amb + Lc*(0.55*dif+0.45*wrap*wrap)) + spec*Lc*vec3(1.0,0.9,0.85);
  if(m < 0.5) col += alb*Lc*max(dot(-n,L),0.0)*0.8 + alb*vec3(0.5,0.05,0.05)*0.25;
  // burn edge glow follows the petal contour
  float glow = smoothstep(-0.30,0.0,bf) * (1.0 - smoothstep(0.0,0.10,bf));
  float charv = smoothstep(-0.35,-0.12,bf);
  col = mix(col, col*0.18, charv*0.8);
  col += glow*vec3(3.4,1.35,0.22)*uRoseS.z*3.0;
  return col;
}
`;

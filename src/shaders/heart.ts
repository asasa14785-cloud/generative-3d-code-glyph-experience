import { COMMON } from "./common";

// HEART scene: mode 0 = exterior (acts I, VII), mode 1 = vascular -> root tunnel (act II).
export const HEART_FRAG = COMMON + /* glsl */ `
uniform float uMode;
uniform float uBurnVis;
uniform vec4 uHold; // finale rose hold position (xyz) + scale

// ---------- tunnel path (mirrored in animation/timeline.ts)
float tcx(float s){ return 2.6*sin(s*0.043)*smoothstep(10.0,40.0,s); }
float tcz(float s){ return 1.8*sin(s*0.031+1.0)*smoothstep(10.0,40.0,s); }
float tR(float s){ return 3.2 + smoothstep(10.0,40.0,s)*(1.5+1.3*sin(s*0.07)) + smoothstep(225.0,250.0,s)*45.0; }

float tubeIn(vec3 p){ return max(length(p.xz)-3.2, max(p.y-37.0, 22.0-p.y)); }

float heartExt(vec3 p){
  float sc = 1.0 + 0.045*uPulse;
  vec3 q = p/(S*sc);
  float d = heartU(q);
  if(d < 0.25){
    d -= 0.020*heartVeins(q);
    d -= 0.010*uPulse*sin(q.y*9.0 - uBeatT*16.0);
    d += 0.004*sin(q.x*40.0+q.y*31.0)*sin(q.z*37.0);
  }
  d *= S*sc*0.8;
  // vessels leaving the top (aorta chimney + two arches)
  float r = length(p.xz);
  float tubeO = max(r-4.8, max(p.y-36.0, 14.0-p.y));
  float v1 = sdCap(p, vec3(-7.0,18.0,0.0), vec3(-20.0,33.0,-2.0), 3.0);
  float v2 = sdCap(p, vec3(8.0,19.0,-3.0), vec3(21.0,31.0,0.0), 2.6);
  d = smin(d, tubeO, 3.0);
  d = smin(d, v1, 2.5);
  d = smin(d, v2, 2.5);
  d = max(d, -tubeIn(p));
  return d;
}
vec2 mapExt(vec3 p){
  float dh = heartExt(p);
  vec2 r = roseMap(p);
  return r.x < dh ? vec2(r.x, 10.0 + r.y) : vec2(dh, 1.0);
}
vec3 nrmExt(vec3 p, float t){
  vec2 e = vec2(max(0.02, 0.0006*t), 0.0);
  return normalize(vec3(mapExt(p+e.xyy).x-mapExt(p-e.xyy).x, mapExt(p+e.yxy).x-mapExt(p-e.yxy).x, mapExt(p+e.yyx).x-mapExt(p-e.yyx).x));
}

float flameDens(vec3 q){
  float shell = abs(length(q)-0.17)-0.012;
  float rise = max(q.y,0.0);
  float prox = exp(-max(shell,0.0)*9.0)*(1.0 - smoothstep(0.1,0.8,rise*1.1));
  vec3 np = vec3(q.x*16.0, q.y*7.0 - uTime*3.5, q.z*16.0);
  float n = fbm(np);
  float stem = exp(-length(q.xz)*38.0)*step(q.y,0.0)*step(-1.0,q.y)*smoothstep(0.1,0.6,uRoseS.z)*0.7;
  float plume = exp(-length(q.xz)*6.0)*smoothstep(0.0,0.15,q.y)*(1.0 - smoothstep(0.15,0.95,q.y));
  float base = prox + 0.7*plume;
  float tongues = smoothstep(0.30,0.80, n*1.4 - rise*0.55 + base*0.6);
  return (base*tongues*1.6 + stem*tongues)*uBurnVis;
}

void mainExt(){
  vec3 ro = uCamPos, rd = camRay();
  float t = 0.0, minD = 1e5; vec2 h = vec2(1e5, 0.0); bool hit = false;
  float tmax = 900.0;
  for(int i=0;i<120;i++){
    vec3 p = ro + rd*t;
    h = mapExt(p);
    minD = min(minD, h.x);
    if(h.x < 0.0008*t + 0.004){ hit = true; break; }
    t += h.x*0.85;
    if(t > tmax) break;
  }
  vec3 col; float fam = 0.0; vec2 fl = vec2(0.0); float tt = hit ? t : 600.0;
  vec3 roseC = uRose.xyz + vec3(0.0, 0.05*uRose.w, 0.0);
  if(hit){
    vec3 p = ro + rd*t;
    vec3 n = nrmExt(p, t);
    if(h.y < 5.0){
      // heart flesh
      vec3 q = p/S;
      float vein = heartVeins(q);
      vec3 base = mix(vec3(0.50,0.035,0.05), vec3(0.20,0.02,0.12), vein);
      base *= 0.8 + 0.4*vnoise(q*9.0);
      vec3 L = normalize(vec3(0.55,0.65,0.75));
      float dif = max(dot(n,L),0.0);
      float fres = pow(1.0 - max(dot(n,-rd),0.0), 3.0);
      vec3 hh = normalize(L - rd);
      float spec = pow(max(dot(n,hh),0.0), 48.0);
      float spec2 = pow(max(dot(n,normalize(vec3(-0.7,0.3,-0.4)-rd)),0.0), 30.0);
      float ring = bump(length(p) - uBeatT*55.0, 0.0, 7.0)*max(0.0,1.0-uBeatT*1.3);
      vec3 em = vec3(1.0,0.12,0.12)*(0.12+0.9*uPulse)*(0.35+vein*1.1) + vec3(1.0,0.3,0.1)*ring*0.8*vein;
      col = base*(0.10 + 1.2*dif) + vec3(1.0,0.75,0.65)*spec*0.9 + vec3(0.6,0.15,0.35)*spec2*0.5 + vec3(0.9,0.12,0.2)*fres*(0.45+0.9*uPulse) + em;
      // rose light
      vec3 Lr = roseC - p; float dr = length(Lr);
      col += base*vec3(1.0,0.62,0.22)*uGlow*max(dot(n,Lr/dr),0.0)*min(2.0e4*uGlow/(dr*dr+100.0),6.0)*0.35 + vec3(1.0,0.7,0.3)*0.15*uGlow;
      // the light pipe glows from inside
      float lip = smoothstep(14.0, 0.0, abs(p.y-36.0))*smoothstep(7.0,3.2,length(p.xz));
      col += vec3(1.0,0.85,0.5)*lip*1.2;
      fam = 1.0;
    } else {
      float m = h.y - 10.0;
      vec3 L = normalize(vec3(0.3,0.6,0.7));
      vec3 amb = vec3(0.12,0.08,0.10) + vec3(1.0,0.6,0.2)*0.4*uGlow;
      col = roseColor(p, n, rd, m, L, vec3(1.0,0.82,0.62)*1.4 + vec3(1.0,0.5,0.15)*uGlow*2.0, amb);
      fam = (m < 0.5) ? 5.0 : 2.0;
      fl = flow2(normalize(cross(n, vec3(0.0,1.0,0.0))+vec3(0.0,0.2,0.0)));
    }
    float fog = 1.0 - exp(-t*0.0015);
    col = mix(col, vec3(0.02,0.0,0.015), fog*0.5);
  } else {
    // void with soft nebula of code ribbons
    float nb = fbm(rd*3.0 + vec3(0.0, uTime*0.02, 0.0));
    col = vec3(0.022,0.004,0.014)*(0.5+nb) + vec3(0.05,0.01,0.03)*pow(nb,3.0);
    fam = 0.0;
  }
  // halo around the heart (code-ribbon glow)
  float halo = exp(-max(minD,0.0)*0.20);
  if(!hit || h.y < 5.0) col += vec3(1.0,0.14,0.2)*halo*halo*(0.05+0.30*uPulse)*(hit?0.4:1.0);
  // golden glow around the burning rose
  {
    vec3 oc = roseC - ro; float tc = dot(oc, rd); float dd = length(oc - rd*max(tc,0.0));
    float gq = dd/(uRose.w*1.7); float g = exp(-gq*gq)*uGlow;
    col += vec3(1.0,0.55,0.15)*g*0.9;
    // flame volume
    if(uBurnVis > 0.01){
      float rad = 1.6*uRose.w;
      float b = dot(oc,rd), c = dot(oc,oc) - rad*rad, disc = b*b - c;
      if(disc > 0.0){
        float sq = sqrt(disc); float t0 = max(b - sq, 0.0), t1 = min(b + sq, hit ? t : 1e5);
        if(t1 > t0){
          vec3 fire = vec3(0.0); float tr = 1.0; float dt = (t1-t0)/44.0;
          for(int i=0;i<44;i++){
            vec3 pp = ro + rd*(t0 + (float(i)+0.5)*dt);
            float dn = flameDens((pp - uRose.xyz)/uRose.w);
            if(dn > 0.001){
              vec3 fc = mix(vec3(1.0,0.16,0.02), vec3(1.0,0.82,0.35), clamp(dn*0.9,0.0,1.0));
              fire += tr*fc*dn*dt/(uRose.w*0.12)*0.95;
              tr *= exp(-dn*dt/(uRose.w*0.5));
            }
          }
          col = col*tr + fire;
          if(dot(fire, vec3(0.33)) > 0.15){ fam = 6.0; fl = vec2(0.0, 0.8); }
        }
      }
    }
  }
  if(fam == 0.0 && dot(col,vec3(0.33)) > 0.02) fl = vec2(0.0);
  outp(col, tt, fl, fam, 0.0);
}

// ---------------- tunnel
vec2 mapTun(vec3 p){
  float s = 36.0 - p.y;
  vec2 c = vec2(tcx(s), tcz(s));
  vec2 rel = p.xz - c;
  float r = length(rel);
  float ang = atan(rel.y, rel.x);
  float d = tR(s) - r;
  float vf = abs(sin(ang*3.0 + s*0.25 + 2.0*vnoise(vec3(ang*1.5, s*0.1, 0.0))));
  float vein = smoothstep(0.25,0.0,vf);
  float rib = 0.10*sin(s*1.6)*(1.0-uRoot);
  float rid = 1.0 - abs(2.0*vnoise(vec3(ang*3.0, s*0.33, 1.0)) - 1.0);
  float rootb = 0.55*uRoot*rid*rid;
  d -= vein*0.14 + rib + rootb;
  return vec2(d*0.6, vein + rid*uRoot*0.5);
}
void mainTun(){
  vec3 ro = uCamPos, rd = camRay();
  float t = 0.0; vec2 h = vec2(1.0,0.0); bool hit = false;
  for(int i=0;i<110;i++){
    vec3 p = ro + rd*t; h = mapTun(p);
    if(h.x < 0.002*t + 0.004){ hit = true; break; }
    t += h.x; if(t > 260.0) break;
  }
  float s0 = 36.0 - ro.y;
  vec3 col; vec2 fl = vec2(0.0); float fam = 1.0; float coarse = 0.0;
  float glowS = smoothstep(90.0, 235.0, s0 + 0.0);
  vec3 fogCol = mix(vec3(0.07,0.0,0.015), vec3(1.0,0.78,0.40)*0.8, smoothstep(140.0,262.0,36.0 - (ro+rd*min(t,200.0)).y));
  if(hit){
    vec3 p = ro + rd*t;
    vec2 e = vec2(0.03,0.0);
    vec3 n = normalize(vec3(mapTun(p+e.xyy).x-mapTun(p-e.xyy).x, mapTun(p+e.yxy).x-mapTun(p-e.yxy).x, mapTun(p+e.yyx).x-mapTun(p-e.yyx).x));
    float sp = 36.0 - p.y;
    float gl = smoothstep(90.0,235.0,sp);
    float veinish = clamp(h.y,0.0,1.0);
    vec3 flesh = mix(vec3(0.42,0.03,0.05), vec3(0.65,0.07,0.09), veinish);
    vec3 moss = mix(vec3(0.14,0.30,0.06), vec3(0.45,0.55,0.12), veinish);
    vec3 alb = mix(flesh, moss, uRoot*smoothstep(0.0,0.8,uRoot));
    vec3 hl = normalize(uCamPos - p + vec3(0.0,2.0,0.0));
    float dif = max(dot(n,hl),0.0);
    float att = 1.0/(1.0 + 0.012*t*t*0.2);
    vec3 down = vec3(0.0,-1.0,0.0);
    float dd = max(dot(n,down),0.0)*0.5+0.5;
    vec3 lightCol = mix(vec3(1.0,0.35,0.25), vec3(1.0,0.85,0.5), gl);
    col = alb*(0.18 + lightCol*(dif*att*1.8 + dd*(0.2+gl*1.3)));
    float spec = pow(max(dot(n, normalize(hl - rd)),0.0), 40.0);
    col += lightCol*spec*0.5*att;
    col += vec3(1.0,0.1,0.1)*(1.0-uRoot)*veinish*(0.2+uPulse*1.6);
    float fre = pow(1.0-max(dot(n,-rd),0.0),3.0);
    col += lightCol*fre*0.25;
    float fg = 1.0 - exp(-t*0.012);
    col = mix(col, fogCol, fg);
    fl = flow2(normalize(cross(n, down)));
    fam = 1.0; coarse = step(t, 10.0);
    if(uRoot > 0.45 && veinish > 0.5) fam = 2.0;
  } else {
    col = fogCol*1.1 + vec3(1.0,0.9,0.6)*smoothstep(0.3,0.95,dot(rd,vec3(0.0,-1.0,0.0)))*glowS*0.6;
    fam = 0.0;
    t = 400.0;
  }
  outp(col, t, fl, fam, coarse);
}

void main(){
  if(uMode < 0.5) mainExt(); else mainTun();
}
`;

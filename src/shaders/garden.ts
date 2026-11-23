import { COMMON } from "./common";

// GARDEN scene: the world inside the heart. Same camera/uniform conventions as the heart scene.
export const GARDEN_FRAG = COMMON + /* glsl */ `
uniform vec3 uDN0;
uniform vec3 uDN1;
uniform vec3 uDHead;
uniform vec3 uDF;
uniform vec3 uDU;
uniform vec4 uDA; // jaw, breath, ear, tail

const float GY = -9.0;
const vec3 LSUN = vec3(-0.30,0.90,-0.28);

float gbase(vec2 xz){
  float r = length(xz);
  float hills = 0.9*sin(xz.x*0.11+1.0)*cos(xz.y*0.13) + 0.45*sin(xz.x*0.27+xz.y*0.19);
  return GY + hills*smoothstep(4.0,14.0,r)*1.7 + smoothstep(22.0,34.0,r)*(r-22.0)*0.6;
}
float ground(vec2 xz){
  float r = length(xz);
  return gbase(xz) + (0.30*vnoise(vec3(xz*0.9,2.0)) + 0.06*vnoise(vec3(xz*5.0,7.0)))*smoothstep(1.0,6.0,r);
}

// ---------------- trees (layered foliage clusters)
vec2 trees(vec3 p){
  vec2 res = vec2(1e5, 0.0);
  if(p.y > GY + 19.0) return res;
  const float CS = 9.0;
  vec2 base = floor(p.xz/CS - 0.5);
  for(int i=0;i<4;i++){
    vec2 id = base + vec2(float(i&1), float(i>>1));
    float h = hash12(id);
    if(h < 0.30) continue;
    vec2 c = (id + 0.5 + (vec2(hash12(id+7.1),hash12(id+3.3))-0.5)*0.5)*CS;
    float rc = length(c);
    if(rc < 10.5) continue;
    float H = 5.0 + 6.0*hash12(id+1.7);
    float g0 = gbase(c);
    float lean = (hash12(id+9.0)-0.5)*1.2;
    float trunk = sdCap(p, vec3(c.x,g0-0.6,c.y), vec3(c.x+lean,g0+H*0.82,c.y), 0.26+0.03*H);
    float R0 = 0.26*H + 1.1;
    vec3 cc = vec3(c.x+lean, g0+H*0.80, c.y);
    float f1 = length(p-cc) - R0;
    float f2 = length(p-(cc+vec3(0.55*R0,-0.15*H*0.3,0.35*R0))) - R0*0.78;
    float f3 = length(p-(cc+vec3(-0.5*R0,0.12*H*0.3,-0.3*R0))) - R0*0.82;
    float f4 = length(p-(cc+vec3(0.05*R0,0.62*R0,-0.1*R0))) - R0*0.65;
    float fol = min(min(f1,f2),min(f3,f4));
    if(fol < 2.0) fol -= 0.55*vnoise(p*1.5+vec3(h*30.0)) + 0.18*vnoise(p*4.4) - 0.35;
    if(trunk < res.x) res = vec2(trunk, 2.0);
    if(fol*0.8 < res.x) res = vec2(fol*0.8, 3.0);
  }
  return res;
}
// ---------------- flowers: stem + radial petal head
vec2 flowers(vec3 p, float gy){
  vec2 res = vec2(1e5,0.0);
  const float CS = 1.5;
  vec2 base = floor(p.xz/CS - 0.5);
  for(int i=0;i<4;i++){
    vec2 id = base + vec2(float(i&1), float(i>>1));
    float h = hash12(id+21.0);
    if(h < 0.5) continue;
    vec2 c = (id + 0.5 + (vec2(hash12(id+4.1),hash12(id+8.7))-0.5)*0.8)*CS;
    if(length(c - uRose.xz) < 0.7) continue;
    float hh = 0.30 + 0.35*hash12(id+5.5);
    vec3 fc = vec3(c.x, gy + hh, c.y);
    float stem = sdCap(p, vec3(c.x,gy-0.1,c.y), fc + vec3(0.0,-0.02,0.0), 0.011);
    vec3 l = p - fc;
    float ang = atan(l.z,l.x);
    float R = 0.10*(0.78+0.30*cos(5.0*ang + h*20.0));
    float hd = (length(vec2(length(l.xz)/R, l.y*3.2)) - 1.0)*0.04;
    if(stem < res.x) res = vec2(stem, 4.0);
    if(hd < res.x) res = vec2(hd, 5.0 + 0.9*fract(h*7.3));
  }
  return res;
}
// ---------------- birds
vec2 birds(vec3 p){
  float best = 1e5;
  for(int i=0;i<5;i++){
    float fi = float(i);
    float w = 0.34 + 0.05*fi, ph = fi*1.3;
    float R = 6.0 + 1.6*fi;
    float a = uTime*w*(mod(fi,2.0)<0.5?1.0:-1.0) + ph;
    vec3 ctr = vec3(-3.0 + fi*0.6, GY + 8.5 + fi*0.9, 4.0 - fi*0.7);
    vec3 bp = ctr + vec3(R*cos(a), 0.9*sin(uTime*0.7+ph*2.0), R*sin(a));
    vec3 d = p - bp;
    float bd = length(d);
    if(bd > 3.0){ best = min(best, bd - 2.2); continue; }
    float sg = mod(fi,2.0)<0.5?1.0:-1.0;
    vec3 f = normalize(vec3(-sin(a)*sg, 0.0, cos(a)*sg));
    vec3 sd = vec3(-f.z, 0.0, f.x);
    vec3 lp = vec3(dot(d,f), d.y, dot(d,sd))/1.8;
    float body = sdEll(lp, vec3(0.22,0.07,0.07));
    float head = sdEll(lp-vec3(0.25,0.025,0.0), vec3(0.075,0.06,0.06));
    float tail = sdEll(lp-vec3(-0.30,0.0,0.0), vec3(0.15,0.012,0.05));
    float fl = 0.85*sin(uTime*9.0 + ph*3.0);
    vec3 wv = vec3(lp.x, lp.y, abs(lp.z)) - vec3(0.0,0.0,0.05);
    wv.yz = rot(fl) * wv.yz;
    float wing = sdEll(wv-vec3(-0.02,0.0,0.30), vec3(0.12,0.014,0.32));
    float dd = min(min(body,head),min(tail,wing));
    best = min(best, dd*1.8*0.8);
  }
  return vec2(best, 30.0);
}

// ---------------- deer (joints supplied by the timeline; same FK drives the camera)
vec2 deerMap(vec3 p){
  vec3 q = p - vec3(0.0, GY, 0.0);
  float bb = length(q - vec3(0.5,1.0,0.0)) - 2.1;
  if(bb > 0.4) return vec2(bb, 20.0);
  float br = uDA.y;
  float torso = sdCap(q, vec3(-0.45,0.98,0.0), vec3(0.42,1.0,0.0), 0.265+0.012*br);
  float haunch = sdEll(q - vec3(-0.5,0.96,0.0), vec3(0.34,0.36,0.30));
  float chest = sdEll(q - vec3(0.38,1.0,0.0), vec3(0.32,0.34,0.27+0.01*br));
  float d = smin(smin(torso,haunch,0.15),chest,0.15);
  vec3 nm = mix(uDN0, uDN1, 0.5);
  float neck = min(sdCap(q, uDN0, nm, 0.135), sdCap(q, nm, uDN1, 0.095));
  d = smin(d, neck, 0.2);
  // legs
  vec3 lq = vec3(q.x, q.y, abs(q.z)); float sg = q.z > 0.0 ? 1.0 : -1.0;
  float fx = 0.40 + 0.09*sg;
  float rx = -0.52 - 0.05*sg;
  float legs = sdCap(lq, vec3(fx,0.86,0.14), vec3(fx+0.03,0.46,0.12), 0.07);
  legs = min(legs, sdCap(lq, vec3(fx+0.03,0.46,0.12), vec3(fx,0.04,0.11), 0.038));
  legs = min(legs, sdCap(lq, vec3(rx,0.92,0.15), vec3(rx-0.10,0.48,0.12), 0.095));
  legs = min(legs, sdCap(lq, vec3(rx-0.10,0.48,0.12), vec3(rx+0.02,0.04,0.11), 0.037));
  d = smin(d, legs, 0.08);
  d = min(d, sdEll(q - vec3(-0.86,1.03+0.03*uDA.w,0.0), vec3(0.08,0.11,0.05)));
  float id = 20.0;
  // head in its own frame
  vec3 sdv = cross(uDF, uDU);
  vec3 hd = q - uDHead;
  vec3 l = vec3(dot(hd,uDF), dot(hd,uDU), dot(hd,sdv));
  vec3 m = vec3(l.x, l.y, abs(l.z));
  float jaw = 0.014*uDA.x;
  float skull = sdEll(l - vec3(-0.02,0.0,0.0), vec3(0.14,0.085,0.08));
  float muz = sdCap(m, vec3(0.05,0.0,0.0), vec3(0.20,-0.02,0.0), 0.05);
  float nose = sdEll(m - vec3(0.215,-0.02,0.0), vec3(0.03,0.025,0.032));
  float jw = sdCap(m, vec3(0.03,-0.055,0.0), vec3(0.18,-0.052-jaw,0.0), 0.027);
  float head = smin(smin(skull,muz,0.05), min(nose,jw), 0.025);
  // eye (slightly bulging) + lids
  vec3 eC = vec3(0.045,0.036,0.066);
  float eye = sdEll(m - eC, vec3(0.021));
  float lid = sdEll(m - vec3(0.045,0.036,0.049), vec3(0.027,0.025,0.025));
  head = smin(head, lid, 0.012);
  // ears (twitch)
  vec3 ed = normalize(vec3(-0.35,0.55,0.75));
  vec3 edL = normalize(vec3(-0.35,0.55,-0.75));
  float tw = uDA.z*0.5;
  ed.xz = rot(tw) * ed.xz;
  float ear = min(sdCap(l, vec3(-0.07,0.06,0.05), vec3(-0.07,0.06,0.05)+ed*0.20, 0.024),
                  sdCap(l, vec3(-0.07,0.06,-0.05), vec3(-0.07,0.06,-0.05)+edL*0.20, 0.024));
  // antlers
  float ant = sdCap(m, vec3(-0.06,0.07,0.04), vec3(-0.10,0.26,0.07), 0.013);
  ant = min(ant, sdCap(m, vec3(-0.10,0.26,0.07), vec3(-0.16,0.42,0.13), 0.011));
  ant = min(ant, sdCap(m, vec3(-0.16,0.42,0.13), vec3(-0.13,0.56,0.10), 0.009));
  ant = min(ant, sdCap(m, vec3(-0.075,0.30,0.065), vec3(0.03,0.38,0.085), 0.009));
  ant = min(ant, sdCap(m, vec3(-0.125,0.36,0.10), vec3(-0.03,0.50,0.15), 0.008));
  float bestH = head; float hid = 21.0;
  if(eye < bestH){ bestH = eye; hid = 22.0; }
  if(ear < bestH){ bestH = ear; hid = 25.0; }
  if(ant < bestH){ bestH = ant; hid = 23.0; }
  float dd = smin(d, head, 0.045);
  dd = min(dd, min(ear, min(ant, eye)));
  if(bestH < dd + 0.02) id = hid;
  return vec2(dd*0.8, id);
}

// ---------------- environment (everything except deer + birds)
vec2 mapEnv(vec3 p){
  float gy = ground(p.xz);
  vec2 res = vec2((p.y-gy)*0.6, 1.0);
  float hd = heartU(p/S)*S*0.7;
  float th = max(length(p.xz)-3.2, 14.0 - p.y);
  float airD = min(hd, min(th, 36.0 - p.y));
  if(-airD < res.x) res = vec2(-airD, 6.0);
  vec2 tr = trees(p); if(tr.x < res.x) res = tr;
  if(p.y - gy < 1.5){ vec2 fl = flowers(p, gy); if(fl.x < res.x) res = fl; }
  vec2 r = roseMap(p); if(r.x < res.x) res = vec2(r.x, 10.0 + r.y);
  return res;
}
vec2 mapAll(vec3 p){
  vec2 res = mapEnv(p);
  vec2 dr = deerMap(p); if(dr.x < res.x) res = dr;
  vec2 b = birds(p); if(b.x < res.x) res = b;
  return res;
}
float mapShadow(vec3 p){
  float gy = ground(p.xz);
  return min((p.y-gy)*0.6, trees(p).x);
}
float softShadow(vec3 ro, vec3 rd){
  float res = 1.0, t = 0.15;
  for(int i=0;i<18;i++){
    float h = mapShadow(ro + rd*t);
    res = min(res, 7.0*h/t);
    t += clamp(h, 0.2, 2.0);
    if(res < 0.02 || t > 24.0) break;
  }
  return clamp(res,0.0,1.0);
}
vec3 nrmAll(vec3 p, float t){
  vec2 e = vec2(max(0.0003, 0.0006*t), 0.0);
  return normalize(vec3(mapAll(p+e.xyy).x-mapAll(p-e.xyy).x, mapAll(p+e.yxy).x-mapAll(p-e.yxy).x, mapAll(p+e.yyx).x-mapAll(p-e.yyx).x));
}
vec3 nrmEnv(vec3 p, float t){
  vec2 e = vec2(max(0.003, 0.0008*t), 0.0);
  return normalize(vec3(mapEnv(p+e.xyy).x-mapEnv(p-e.xyy).x, mapEnv(p+e.yxy).x-mapEnv(p-e.yxy).x, mapEnv(p+e.yyx).x-mapEnv(p-e.yyx).x));
}

vec3 flowerColor(float f){
  float k = fract(f)*5.0;
  if(k < 1.0) return vec3(1.0,0.78,0.10);
  if(k < 2.0) return vec3(0.62,0.30,0.95);
  if(k < 3.0) return vec3(1.0,0.97,0.90);
  if(k < 4.0) return vec3(1.0,0.50,0.10);
  return vec3(1.0,0.45,0.68);
}
vec3 groundColor(vec3 p){
  float n = vnoise(p*0.5)*0.7 + 0.3*vnoise(p*3.0);
  vec3 g = mix(vec3(0.06,0.27,0.05), vec3(0.50,0.72,0.12), n);
  g *= 0.85 + 0.3*vnoise(p*14.0);
  return g;
}
vec3 skyColor(vec3 rd){
  return vec3(1.0,0.90,0.65)*(2.2 + 1.5*smoothstep(0.5,1.0,rd.y));
}
vec3 wallColor(vec3 p, vec3 n){
  float v = abs(sin(vnoise(p*0.09)*16.0));
  float vein = smoothstep(0.22,0.0,v);
  vec3 col = mix(vec3(0.55,0.20,0.28), vec3(0.95,0.40,0.35), 0.5+0.5*n.y);
  col *= 0.8+0.5*smoothstep(-10.0,34.0,p.y);
  col += vec3(1.0,0.3,0.3)*vein*(0.35+0.9*uPulse);
  return col;
}

// ------------ the corneal mirror: marches the SAME world (incl. the hero rose) from the eye surface
vec3 envShade(vec3 ro, vec3 rd){
  float t = 0.05; vec2 h = vec2(1.0,0.0); bool hit = false;
  for(int i=0;i<64;i++){
    vec3 p = ro + rd*t; h = mapEnv(p);
    if(h.x < 0.0015*t + 0.002){ hit = true; break; }
    t += h.x*0.85; if(t > 90.0) break;
  }
  if(!hit) return skyColor(rd);
  vec3 p = ro + rd*t; vec3 n = nrmEnv(p, t);
  float id = h.y;
  float dif = max(dot(n,LSUN),0.0);
  vec3 sunC = vec3(1.0,0.86,0.62)*2.4;
  vec3 amb = vec3(0.35,0.28,0.30);
  vec3 col;
  if(id >= 10.0){ col = roseColor(p, n, rd, id-10.0, LSUN, sunC, amb); if(id < 10.5) col = col*vec3(0.85,0.55,0.55) + vec3(0.55,0.0,0.03); }
  else if(id < 1.5) col = groundColor(p)*(amb + sunC*dif);
  else if(id < 2.5) col = vec3(0.30,0.20,0.12)*(amb + sunC*dif);
  else if(id < 3.5) col = vec3(0.12,0.40,0.10)*(amb*1.2 + sunC*dif*0.8);
  else if(id < 5.0) col = vec3(0.1,0.35,0.08)*(amb + sunC*dif);
  else if(id < 6.0) col = flowerColor(id)*(amb + sunC*dif)*1.2;
  else col = wallColor(p, n);
  return mix(col, vec3(0.9,0.6,0.5), 1.0-exp(-t*0.01));
}

vec3 eyeShade(vec3 p, vec3 n, vec3 rd){
  vec3 sdv = cross(uDF, uDU);
  vec3 eyeW = vec3(0.0,GY,0.0) + uDHead + uDF*0.045 + uDU*0.036 + sdv*0.066;
  vec3 A = normalize(sdv + 0.2*uDF - 0.25*uDU);
  vec3 rel = normalize(p - eyeW);
  float th = acos(clamp(dot(rel,A),-1.0,1.0));
  vec3 T1 = normalize(uDF - A*dot(uDF,A)); vec3 T2 = cross(A,T1);
  vec2 pl = vec2(dot(rel,T1), dot(rel,T2));
  float ang = atan(pl.y, pl.x);
  float rho = th/0.80;
  vec2 pv = normalize(pl+1e-5)*th;
  float pup = 1.0 - smoothstep(0.85,1.0, length(vec2(pv.x/0.34, pv.y/0.12)));
  float rings = 0.5+0.5*sin(rho*46.0 + 2.2*vnoise(vec3(ang*3.0, rho*5.0, 1.3)));
  float fib = 0.5+0.5*sin(ang*64.0 + 3.0*fbm(vec3(ang*2.0, rho*7.0, 4.0)));
  vec3 iris = mix(vec3(0.32,0.14,0.02), vec3(1.0,0.64,0.16), 0.25 + 0.45*rings + 0.35*fib);
  iris = mix(iris, vec3(1.0,0.82,0.30), smoothstep(0.55,0.15,rho)*0.55);
  iris *= mix(1.0, 0.25, smoothstep(0.82,1.0,rho));
  vec3 base = mix(iris, vec3(0.025,0.012,0.010), smoothstep(0.95,1.08,rho));
  base = mix(base, vec3(0.0), pup);
  // glossy cornea reflecting the garden; deliberately magnified (artistic convex-mirror mapping)
  vec3 r = reflect(rd, n);
  vec3 rm = normalize(mix(A, r, 0.20));
  vec3 env = envShade(p + n*0.004, rm);
  float fr = 0.30 + 0.45*pow(1.0 - max(dot(n,-rd),0.0), 3.0);
  float cornea = 1.0 - smoothstep(0.50,0.95, rho);
  vec3 col = base*(1.1 + 0.9*max(dot(n,LSUN),0.0))*(1.0-0.55*cornea) + env*fr*cornea*0.95;
  col += vec3(1.0,0.95,0.85)*pow(max(dot(r, normalize(vec3(-0.3,0.9,-0.3))),0.0), 120.0)*5.0*cornea;
  return col;
}

vec3 deerColor(vec3 p, vec3 n, vec3 rd, float id, float sh, out float fam){
  vec3 q = p - vec3(0.0,GY,0.0);
  fam = 4.0;
  vec3 fur = mix(vec3(0.46,0.27,0.12), vec3(0.62,0.40,0.20), vnoise(q*9.0));
  fur = mix(fur, vec3(0.84,0.72,0.55), smoothstep(0.85,0.55,q.y)*step(0.3,q.y)*0.8);
  if(q.y > 0.7 && q.y < 1.25 && abs(q.z) < 0.34){
    float sp = smoothstep(0.76,0.80, vnoise(q*vec3(11.0,13.0,13.0)));
    fur = mix(fur, vec3(0.98,0.93,0.82), sp*0.85);
  }
  if(q.y < 0.09) fur = vec3(0.05,0.04,0.035);
  if(id > 22.5 && id < 23.5){ fur = vec3(0.80,0.68,0.48); }
  if(id > 24.5){ fur = mix(vec3(0.46,0.27,0.12), vec3(0.86,0.52,0.50), 0.5); }
  vec3 L = LSUN;
  float dif = max(dot(n,L),0.0)*sh;
  float rim = pow(1.0 - max(dot(n,-rd),0.0), 3.0);
  vec3 sunC = vec3(1.0,0.86,0.62)*2.4;
  vec3 col = fur*(vec3(0.33,0.26,0.28)*(0.7+0.3*n.y) + sunC*dif*0.9) + vec3(1.0,0.8,0.6)*rim*0.35*sh;
  col += vec3(1.0,0.9,0.7)*pow(max(dot(n, normalize(L-rd)),0.0),30.0)*0.07*sh;
  return col;
}

void main(){
  vec3 ro = uCamPos, rd = camRay();
  float t = 0.0; vec2 h = vec2(1e5,0.0); bool hit = false;
  for(int i=0;i<120;i++){
    vec3 p = ro + rd*t; h = mapAll(p);
    if(h.x < 0.0005*t + 0.0012){ hit = true; break; }
    t += h.x*0.82; if(t > 200.0) break;
  }
  vec3 col; float fam = 0.0; vec2 fl = vec2(0.0); float coarse = 0.0; float tt = hit? t : 300.0;
  vec3 sunC = vec3(1.0,0.86,0.62)*2.4*(0.9+0.2*uPulse);
  if(hit){
    vec3 p = ro + rd*t;
    float id = h.y;
    vec3 n = (id > 19.5) ? nrmAll(p,t) : nrmEnv(p,t);
    float sh = (id < 6.0 || (id > 9.5 && id < 14.0)) ? softShadow(p + n*0.05, LSUN) : 1.0;
    float dif = max(dot(n,LSUN),0.0)*sh;
    vec3 amb = mix(vec3(0.20,0.15,0.18), vec3(0.42,0.38,0.46), n.y*0.5+0.5);
    if(id > 29.5){
      col = vec3(0.09,0.07,0.10)*(0.6+dif) + vec3(1.0,0.8,0.5)*pow(1.0-max(dot(n,-rd),0.0),3.0)*0.7;
      fam = 4.0; fl = flow2(vec3(0.0,0.2,0.0)+uCamRight);
    } else if(id > 19.5){
      if(id > 21.5 && id < 22.5){ col = eyeShade(p, n, rd); fam = 7.0; }
      else { col = deerColor(p, n, rd, id, sh, fam); 
        vec3 dn = vec3(0.0,-1.0,0.0); fl = flow2(normalize(dn - n*dot(n,dn)));
        fl *= 0.9; }
    } else if(id > 9.5){
      float m = id - 10.0;
      col = roseColor(p, n, rd, m, LSUN, sunC*sh, amb*1.1);
      fam = (m < 0.5) ? 5.0 : 2.0;
      fl = (m < 0.5) ? flow2(normalize(cross(n, vec3(0.0,1.0,0.0))+vec3(0.0,0.001,0.0))) : flow2(vec3(0.0,1.0,0.0));
      if(m > 0.5) fl *= 0.8;
    } else if(id < 1.5){
      col = groundColor(p)*(amb + sunC*dif*0.85);
      fam = 3.0; coarse = step(t, 9.0);
      fl = flow2(normalize(vec3(0.28*sin(uTime*0.9+p.x*0.7+p.z*0.5), 1.0, 0.12*sin(uTime*0.7+p.x*0.3))));
    } else if(id < 2.5){
      col = vec3(0.30,0.19,0.10)*(amb + sunC*dif*0.8); fam = 2.0; fl = flow2(vec3(0.0,1.0,0.0)); coarse = step(t,9.0);
    } else if(id < 3.5){
      float lv = vnoise(p*2.3+uTime*0.15);
      vec3 leaf = mix(vec3(0.05,0.30,0.06), vec3(0.55,0.75,0.12), lv*dif+0.2*lv);
      float back = pow(max(dot(rd,LSUN),0.0),2.0)*0.6;
      col = leaf*(amb*1.3 + sunC*dif*0.9) + vec3(0.8,0.9,0.2)*back*0.35*sh;
      fam = 2.0; coarse = step(t, 11.0);
      fl = vec2(0.0);
    } else if(id < 5.0){
      col = vec3(0.10,0.38,0.08)*(amb + sunC*dif); fam = 3.0; fl = flow2(vec3(0.0,1.0,0.0));
    } else if(id < 6.0){
      col = flowerColor(id)*(amb*1.4 + sunC*dif*1.0); fam = 5.0; coarse = step(t, 5.0);
      fl = flow2(normalize(cross(n, vec3(0.0,1.0,0.0))+vec3(0.0,0.001,0.0)));
    } else {
      col = wallColor(p, n)*(0.9 + 0.2*uPulse); fam = 1.0; fl = vec2(0.0);
    }
    // atmosphere
    vec3 haze = mix(vec3(0.95,0.60,0.52), vec3(1.0,0.82,0.6), 0.5+0.5*rd.y);
    float fg = 1.0 - exp(-t*0.0095);
    col = mix(col, haze*1.1, fg*(id > 5.5 && id < 6.5 ? 0.7 : 0.55));
  } else {
    col = skyColor(rd); fam = 0.0;
  }
  // light shafts radiating from the opening at the top of the heart
  {
    vec3 toOp = normalize(vec3(0.0,36.0,0.0) - ro);
    float sd = dot(rd, toOp);
    vec3 a = normalize(cross(toOp, vec3(0.0,0.0,1.0)+vec3(0.001,0.0,0.0)));
    vec3 b = cross(toOp, a);
    float an = atan(dot(rd,b), dot(rd,a));
    float rays = 0.55 + 0.45*sin(an*19.0 + 3.0*vnoise(vec3(an*3.0, uTime*0.15, 0.0)));
    float sh = pow(max(sd,0.0), 7.0)*rays*0.75 + pow(max(sd,0.0), 60.0)*1.4;
    float tr = hit ? (1.0 - exp(-t*0.02)) : 1.0;
    col += vec3(1.0,0.82,0.5)*sh*(0.25+0.75*tr)*(0.7+0.3*uBright);
    if(!hit){ fam = 0.0; }
  }
  // finale of the garden: sky brightens as the rose leaves
  outp(col, tt, fl, fam, coarse);
}
`;

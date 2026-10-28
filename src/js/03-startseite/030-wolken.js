// ---- Wolken: volumetrische Wolkenschicht auf fester Höhe (Raymarching im Fragment-Shader), zieht horizontal vorbei (Startseite)
const CL = { y0: 80, y1: 230, scale: 75, cover: 0.53, wind: 6, sigma: 0.07, on: true, g: null };
const CL_VS = 'void main(){gl_Position=vec4(position.xy,0.,1.);}';
const CL_FS = `precision highp float;uniform vec2 uRes;uniform mat4 uIP,uMW;uniform vec3 uCam;uniform float uT,uY0,uY1,uScale,uCover,uWind,uSig,uFade;
float h3(vec3 p){p=fract(p*vec3(.1031,.1030,.0973));p+=dot(p,p.yxz+33.33);return fract((p.x+p.y)*p.z);}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float f3(vec3 p,int o){float a=.5,s=0.,w=0.;for(int i=0;i<5;i++){if(i>=o)break;s+=a*n3(p);w+=a;p=p*2.02+vec3(11.3,7.1,5.7);a*=.5;}return s/w;}
float D(vec3 p,bool det){float hh=(p.y-uY0)/(uY1-uY0);if(hh<0.||hh>1.)return 0.;
vec3 q=vec3(p.x-uT*uWind,p.y*1.4,p.z)/uScale;float b=f3(q,4);
float cv=uCover+.07*(1.-smoothstep(80.,520.,length(p.xz)));
float prof=smoothstep(0.,.16,hh)*smoothstep(1.,.5,hh);
float d=(b-cv)*8.5*prof+.02;
if(det&&d>0.){d-=f3(q*6.3+3.1,3)*.55*(1.-clamp(d,0.,.9));}
return clamp(d,0.,1.);}
void main(){vec2 nd=gl_FragCoord.xy/uRes*2.-1.;vec4 v=uIP*vec4(nd,1.,1.);v/=v.w;vec3 rd=normalize((uMW*vec4(v.xyz,0.)).xyz);vec3 ro=uCam;
float t0,t1;if(abs(rd.y)<1e-3){if(ro.y<uY0||ro.y>uY1)discard;t0=0.;t1=900.;}else{float ta=(uY1-ro.y)/rd.y,tb=(uY0-ro.y)/rd.y;t0=max(min(ta,tb),0.);t1=max(ta,tb);}
t1=min(t1,t0+900.);if(t1<=t0)discard;
const int N=18;float dt=(t1-t0)/float(N);float t=t0+dt*fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
vec3 sun=normalize(vec3(.45,.78,.30));float T=1.;vec3 C=vec3(0.);
for(int i=0;i<N;i++){vec3 p=ro+rd*t;float d=D(p,true);
if(d>.012){float ld=D(p+sun*18.,false)+D(p+sun*40.,false)+D(p+sun*70.,false);float L=exp(-ld*1.15);float hh=(p.y-uY0)/(uY1-uY0);
float lit=clamp(L*.9+hh*.2,0.,1.);vec3 col=mix(vec3(.72,.715,.71),vec3(1.,.995,.975),lit);
float a=1.-exp(-d*dt*uSig);C+=T*a*col;T*=1.-a;}
t+=dt;if(T<.02)break;}
float al=1.-T;if(al<.004)discard;gl_FragColor=vec4(C/al,al*.82*uFade);}`;
function cloudsInit() {
  if (CL.g) return;
  const m = new T.ShaderMaterial({
    vertexShader: CL_VS,
    fragmentShader: CL_FS,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    uniforms: {
      uRes: { value: new T.Vector2(1, 1) },
      uIP: { value: new T.Matrix4() },
      uMW: { value: new T.Matrix4() },
      uCam: { value: new T.Vector3() },
      uT: { value: 0 },
      uY0: { value: CL.y0 },
      uY1: { value: CL.y1 },
      uScale: { value: CL.scale },
      uCover: { value: CL.cover },
      uWind: { value: CL.wind },
      uSig: { value: CL.sigma },
      uFade: { value: 1 },
    },
  });
  const q = new T.Mesh(new T.PlaneGeometry(2, 2), m);
  q.frustumCulled = false;
  q.renderOrder = 60;
  q.raycast = () => {};
  sc.add(q);
  CL.g = q;
}
function cloudsUp(now) {
  if (!CL.g) return;
  CL.g.visible = CL.on && (HOME.open || IDLE.cf > 0.005);
  if (!CL.g.visible) return;
  const k = act(),
    u = CL.g.material.uniforms;
  k.updateMatrixWorld();
  u.uFade.value = HOME.open ? 1 : IDLE.cf;
  u.uRes.value.set(ren.domElement.width, ren.domElement.height);
  u.uIP.value.copy(k.projectionMatrixInverse);
  u.uMW.value.copy(k.matrixWorld);
  u.uCam.value.setFromMatrixPosition(k.matrixWorld);
  u.uT.value = now / 1000;
  u.uY0.value = CL.y0;
  u.uY1.value = CL.y1;
  u.uScale.value = CL.scale;
  u.uCover.value = CL.cover;
  u.uWind.value = CL.wind;
  u.uSig.value = CL.sigma;
}
const BIRD = {
  g: null,
  b: [],
  on: true,
  t0: 0,
  pass: -1,
  hx: 1,
  hz: 0,
  cx: 0,
  cz: 0,
  cfg: [
    { u: 0, v: -18, y: 46, sp: 40, ph: 0, k: 1 },
    { u: -70, v: 22, y: 38, sp: 43, ph: 1.7, k: 0.85 },
    { u: -30, v: -55, y: 54, sp: 38, ph: 3.1, k: 1.1 },
    { u: -150, v: 48, y: 34, sp: 41, ph: 4.4, k: 0.8 },
    { u: -105, v: 5, y: 50, sp: 39, ph: 5.6, k: 0.95 },
  ],
};
function birdsInit() {
  if (BIRD.g) return;
  BIRD.g = new T.Group();
  BIRD.g.renderOrder = 40;
  BIRD.cfg.forEach((c) => {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(480), 3));
    const m = new T.Mesh(
      g,
      new T.MeshBasicMaterial({
        color: 0x050505,
        side: T.DoubleSide,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      }),
    );
    m.frustumCulled = false;
    m.renderOrder = 40;
    BIRD.g.add(m);
    BIRD.b.push({ m, c });
  });
  BIRD.g.visible = false;
  sc.add(BIRD.g);
}
function birdsUp(now) {
  if (!BIRD.g) {
    if (!HOME.open && !IDLE.s2) return;
    birdsInit();
  }
  if (!BIRD.t0) BIRD.t0 = now;
  const tt = (now - BIRD.t0) / 1000 - 3,
    t = now / 1000,
    PER = 60,
    DUR = 24;
  const idx = Math.floor(tt / PER),
    p = tt - idx * PER;
  BIRD.g.visible = BIRD.on && (HOME.open || IDLE.s2) && tt >= 0 && p < DUR;
  if (!BIRD.g.visible) return;
  if (BIRD.pass !== idx) {
    BIRD.pass = idx;
    const k = act();
    k.updateMatrixWorld();
    const e = k.matrixWorld.elements;
    let rx = e[0],
      rz = e[2];
    const l = Math.hypot(rx, rz) || 1;
    rx /= l;
    rz /= l;
    const a = (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.2),
      ca = Math.cos(a),
      sa = Math.sin(a);
    BIRD.hx = rx * ca - rz * sa;
    BIRD.hz = rx * sa + rz * ca;
    BIRD.cx = V.tx || 0;
    BIRD.cz = V.tz || 0;
  }
  const hx = BIRD.hx,
    hz = BIRD.hz,
    th = Math.atan2(hz, hx);
  BIRD.b.forEach((o) => {
    const c = o.c,
      w = -420 + p * c.sp + c.u;
    const wob = Math.sin(t * 0.5 + c.ph) * 5,
      vv = c.v + wob;
    const x = BIRD.cx + hx * w - hz * vv,
      z = BIRD.cz + hz * w + hx * vv,
      y = c.y + Math.sin(t * 0.7 + c.ph) * 2.5;
    const fl = Math.sin(t * (15 + c.k * 2) + c.ph),
      gl = Math.sin(t * 0.35 + c.ph * 2) > 0.55 ? 0.25 : 1,
      f = fl * gl;
    const S2 = c.k * 1.25,
      P = [],
      N = 6;
    [1, -1].forEach((sd) => {
      const Lw = [],
        Rw = [];
      for (let i = 0; i <= N; i++) {
        const q = i / N,
          z = sd * (0.45 + 3.2 * q),
          y = f * 3 * Math.pow(q, 1.2) + 0.25 * Math.sin(q * Math.PI),
          xl = 0.7 - 0.9 * Math.pow(q, 1.5),
          ch = 2.3 - 1.0 * q;
        Lw.push([xl, y, z]);
        Rw.push([xl - ch, y - 0.35 * f * q, z]);
      }
      for (let i = 0; i < N; i++) P.push(Lw[i], Rw[i], Rw[i + 1], Lw[i], Rw[i + 1], Lw[i + 1]);
      const A = Lw[N],
        B = Rw[N],
        K = 4;
      for (let k = 0; k < K; k++) {
        const u0 = k / K,
          u1 = (k + 1) / K,
          p0 = [A[0] + (B[0] - A[0]) * u0, A[1] + (B[1] - A[1]) * u0, A[2]],
          p1 = [A[0] + (B[0] - A[0]) * u1, A[1] + (B[1] - A[1]) * u1, A[2]];
        const tip = [A[0] - 0.4 - k * 0.55, A[1] + f * 1.1 - 0.1 * k, sd * (3.65 + 1.7 - 0.25 * k)];
        P.push(
          p0,
          p1.map((v, i) => (i === 2 ? v - sd * 0.12 : v)),
          tip,
        );
      }
    });
    const hd = [1.9, 0.05, 0],
      nl = [1.2, 0.05, -0.28],
      nr = [1.2, 0.05, 0.28],
      sl = [0.3, 0, -0.5],
      sr = [0.3, 0, 0.5],
      hl = [-0.9, 0, -0.38],
      hr = [-0.9, 0, 0.38],
      tl = [-2.7, 0, -0.85],
      tm = [-2.9, 0, 0],
      tr = [-2.7, 0, 0.85];
    P.push(hd, nl, nr, nl, sl, sr, nl, sr, nr, sl, hl, hr, sl, hr, sr, hl, tl, tm, hl, tm, hr, hr, tm, tr);
    const ar = o.m.geometry.attributes.position.array;
    ar.fill(0);
    for (let i = 0; i < P.length && i * 3 < ar.length; i++) {
      ar[i * 3] = P[i][0] * S2;
      ar[i * 3 + 1] = P[i][1] * S2;
      ar[i * 3 + 2] = P[i][2] * S2;
    }
    o.m.geometry.attributes.position.needsUpdate = true;
    o.m.position.set(x, y, z);
    o.m.rotation.y = -th + Math.sin(t * 0.4 + c.ph) * 0.1;
    o.m.rotation.x = Math.sin(t * 0.9 + c.ph) * 0.08;
  });
}
function homeTick() {
  if (!HOME.open) {
    cloudsUp(IDLE.cf > 0.005 ? performance.now() : 0);
    birdsUp(IDLE.s2 ? performance.now() : 0);
    return;
  }
  homeXTick(performance.now());
  cloudsUp(performance.now());
  birdsUp(performance.now());
  const now = performance.now(),
    dt = Math.min(60, HOME.tl ? now - HOME.tl : 16);
  HOME.tl = now;
  if (!HOME.ready && S.geo && GEO.snap && !GEO.busy) {
    HOME.ready = true;
    homeSetup();
  }
  HOME.pmx += (HOME.mx - HOME.pmx) * 0.05;
  HOME.pmy += (HOME.my - HOME.pmy) * 0.05;
  S.m3 = true;
  if (HOME.ready && !S.vanim && !HOME.hold) {
    HOME.az0 += dt * (HOME.st ? 0.00003 : 0.00004);
    V.az = HOME.az0 + HOME.pmx * (HOME.st ? 0.08 : 0.14);
    V.pol = (HOME.st ? 1.0 : 0.92) + HX.k * 0.3 + HOME.pmy * 0.05;
  }
  if (HOME.st === 0 && HOME.anc.length && innerWidth > 820) {
    const P = anP();
    HOME.anc.forEach((a, i) => {
      const q = P([a.x, a.y, a.z]),
        c = HOME.cp[i],
        ln = HOME.ln[i],
        d = HOME.dt[i],
        r = HOME.rg[i];
      if (!q || !c || !ln) {
        if (ln) {
          ln.style.display = 'none';
          d.style.display = 'none';
          r.style.display = 'none';
        }
        return;
      }
      ln.style.display = d.style.display = r.style.display = '';
      ln.setAttribute('x1', c[0]);
      ln.setAttribute('y1', c[1]);
      ln.setAttribute('x2', q[0]);
      ln.setAttribute('y2', q[1]);
      d.setAttribute('cx', q[0]);
      d.setAttribute('cy', q[1]);
      r.setAttribute('cx', q[0]);
      r.setAttribute('cy', q[1]);
    });
  }
  const k = Math.min(1, (now - HOME.cnt) / 1900),
    e = 1 - Math.pow(1 - k, 3);
  if (k < 1 || !HOME.cd) {
    document.querySelectorAll('.hcnt').forEach((x) => {
      x.textContent = Math.round(+x.dataset.to * e).toLocaleString('de-DE');
    });
    if (k >= 1) HOME.cd = 1;
  }
  if (HOME.hl) {
    const o = 0.3 + 0.22 * Math.sin(now / 340);
    HOME.hl.children[1].material.opacity = HOME.db ? 0.1 : o;
    HOME.hl.children[0].material.opacity = 0.7 + 0.3 * Math.sin(now / 340);
  }
}
homeHook = homeTick;

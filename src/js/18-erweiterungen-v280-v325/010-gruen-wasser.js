/* ---------- Grün & Wasser (Zeichenflächen) ---------- */
function fxGrass() {
  fxGrassClear();
  if (!fxOn('grass') || !GEO.acc || !GEO.size || !PL.green) return;
  FX.gvv = fxGv();
  FX.flat = 0;
  if (FX.gvv === 2) {
    fxFlat();
    return;
  }
  const hs = GEO.size / 2,
    W = 4096,
    K = W / GEO.size,
    mc = document.createElement('canvas');
  mc.width = mc.height = W;
  const x = mc.getContext('2d');
  if (PL.green) x.drawImage(PL.green, 0, 0, W, W);
  x.globalCompositeOperation = 'destination-out';
  for (const k of ['roads', 'paths', 'cycle', 'rail', 'water']) if (PL[k]) x.drawImage(PL[k], 0, 0, W, W);
  (typeof P !== 'undefined' ? P : [])
    .filter((q) => q.site && q.poly && q.poly.length > 2)
    .forEach((q) => {
      x.beginPath();
      q.poly.forEach((a, i) => {
        const u = (a[0] + hs) * K,
          v = (a[1] + hs) * K;
        i ? x.lineTo(u, v) : x.moveTo(u, v);
      });
      x.closePath();
      x.fill();
    });
  const d = x.getImageData(0, 0, W, W).data,
    al = (u, v) => (u < 0 || v < 0 || u >= W || v >= W ? 0 : d[(v * W + u) * 4 + 3]);
  const gb = false,
    cap = 600000;
  let cs = gb ? 0.4 : 0.31,
    xs,
    zs,
    sd,
    n;
  const gen = () => {
    const N = Math.ceil(GEO.size / cs),
      a = new Float32Array(N * N),
      b = new Float32Array(N * N),
      c = new Int32Array(N * N);
    let k = 0;
    for (let i = 0; i < N; i++) {
      const X = -hs + (i + 0.5) * cs,
        pu = Math.floor((X + hs) * K);
      for (let j = 0; j < N; j++) {
        const Z = -hs + (j + 0.5) * cs,
          pv = Math.floor((Z + hs) * K);
        if (
          al(pu, pv) > 40 ||
          al(pu - 1, pv - 1) > 40 ||
          al(pu + 1, pv - 1) > 40 ||
          al(pu - 1, pv + 1) > 40 ||
          al(pu + 1, pv + 1) > 40
        ) {
          a[k] = X;
          b[k] = Z;
          c[k] = i * 7919 + j * 104729;
          k++;
        }
      }
    }
    xs = a;
    zs = b;
    sd = c;
    n = k;
  };
  gen();
  if (n > cap) {
    cs *= Math.sqrt(n / cap) * 1.02;
    gen();
  }
  if (!n) return;
  const base = new T.Color(S.lc.green),
    C = new T.Color(),
    Mx = new T.Matrix4(),
    Q = new T.Quaternion(),
    V3 = new T.Vector3(),
    Sc = new T.Vector3(),
    g = new T.Group();
  const tex = new T.CanvasTexture(mc);
  tex.flipY = false;
  tex.generateMipmaps = false;
  tex.minFilter = T.LinearFilter;
  const mat = new T.MeshLambertMaterial({ color: 0xffffff, vertexColors: gb });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tM = { value: tex };
    sh.uniforms.uS = { value: GEO.size };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vXZ;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n{vec4 wp=modelMatrix*instanceMatrix*vec4(transformed,1.);vXZ=wp.xz;}',
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vXZ;uniform sampler2D tM;uniform float uS;',
      )
      .replace('void main() {', 'void main(){if(texture2D(tM,(vXZ+uS*.5)/uS).a<.5)discard;');
  };
  mat.side = T.DoubleSide;
  let bg;
  if (gb) {
    const pos = [],
      col = [],
      bl = 7;
    for (let q = 0; q < bl; q++) {
      const a = (q / bl) * Math.PI * 2 + 0.4 + (q % 2) * 0.3,
        ca = Math.cos(a),
        sa = Math.sin(a),
        lean = 0.08 + (0.12 * (q % 3)) / 2,
        w = 0.035,
        rr = 0.05 + 0.08 * (q % 2),
        rx = ca * rr,
        rz = sa * rr,
        px = -sa * w,
        pz = ca * w;
      pos.push(rx - px, 0, rz - pz, rx + px, 0, rz + pz, rx + ca * lean, 1, rz + sa * lean);
      col.push(0.78, 0.78, 0.78, 0.78, 0.78, 0.78, 1.06, 1.06, 1.06);
    }
    bg = new T.BufferGeometry();
    bg.setAttribute('position', new T.BufferAttribute(new Float32Array(pos), 3));
    bg.setAttribute('color', new T.BufferAttribute(new Float32Array(col), 3));
    bg.computeVertexNormals();
  } else {
    bg = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    const ix = Array.from(bg.index.array);
    ix.splice(18, 6);
    bg.setIndex(ix);
  }
  const m = new T.InstancedMesh(bg, mat, n);
  m.frustumCulled = false;
  m.receiveShadow = true;
  m.castShadow = false;
  m.raycast = () => {};
  const st = 0.05;
  if (gb) {
    const E = new T.Euler();
    for (let i = 0; i < n; i++) {
      const X = xs[i],
        Z = zs[i],
        s0 = sd[i],
        r1 = fxR(s0, 4),
        r2 = fxR(s0, 5),
        r3 = fxR(s0, 6),
        h = 0.22 + r1 * 0.22 + fxN(X * 0.1, 3, Z * 0.1) * 0.18,
        y = gh(X, Z);
      E.set(0, r2 * 6.283, 0);
      Q.setFromEuler(E);
      const w = cs * 1.9 * (0.85 + r3 * 0.4);
      Sc.set(w, h, w);
      V3.set(X + (r3 - 0.5) * cs * 0.6, y, Z + (r1 - 0.5) * cs * 0.6);
      Mx.compose(V3, Q, Sc);
      m.setMatrixAt(i, Mx);
      C.copy(base).offsetHSL((r2 - 0.5) * 0.03, (r3 - 0.5) * 0.07, (r1 - 0.5) * 0.07);
      m.setColorAt(i, C);
    }
  } else
    for (let i = 0; i < n; i++) {
      const X = xs[i],
        Z = zs[i],
        s0 = sd[i],
        nz0 = fxN(X * 0.07, 0, Z * 0.07) * 0.38 + fxN(X * 0.23, 1, Z * 0.23) * 0.34 + fxR(s0, 3) * 0.28,
        nz = Math.max(0, Math.min(0.999, (nz0 - 0.5) * 1.7 + 0.5)),
        k = 1 + Math.floor(nz * 13),
        y = gh(X, Z);
      Sc.set(cs * 1.01, k * st, cs * 1.01);
      V3.set(X, y, Z);
      Mx.compose(V3, Q.identity(), Sc);
      m.setMatrixAt(i, Mx);
      C.copy(base).offsetHSL(
        (fxR(s0, 5) - 0.5) * 0.03,
        (fxR(s0, 6) - 0.5) * 0.06,
        (k - 7) * 0.009 + (fxR(s0, 4) - 0.5) * 0.05,
      );
      m.setColorAt(i, C);
    }
  m.instanceMatrix.needsUpdate = true;
  m.instanceColor.needsUpdate = true;
  g.add(m);
  sc.add(g);
  FX.grass = g;
  FX.gn = n;
  FX.gcs = cs;
  fxVis();
}
/* Gras „Rasen“ (Realistisch) – flacher Farbmisch-Shader nach Vorgabe:
   pattern = broad·0,65 + medium·0,25 + fine·0,10 (Value-Noise in Weltkoordinaten × uScale: p·0,7 / p·2,3 / p·7),
   Farbe = mix(uGrassDark, uGrassLight, clamp(0,5 + (pattern − 0,5)·uVariation)).
   Startwerte: uScale 0,08 · uVariation 0,8 · dunkel (0,12 | 0,22 | 0,09) · hell (0,32 | 0,42 | 0,19).
   Die Fläche liegt flach über den Grünflächen (keine Höhe) und nimmt Licht und Schatten der Szene auf (Lambert);
   keine Textur → keine Kachelung. Optional wirkt ein Luftbild relativ zu seinem Mittelwert als Farbverteilung darüber. */
function fxGp() {
  if (FX.gp) return FX.gp;
  if (!FX.gpL) {
    FX.gpL = 1;
    const im = new Image();
    im.onload = () => {
      try {
        const t = new T.Texture(im);
        t.wrapS = t.wrapT = T.RepeatWrapping;
        t.minFilter = T.LinearMipmapLinearFilter;
        t.magFilter = T.LinearFilter;
        t.generateMipmaps = true;
        t.anisotropy = 8;
        t.needsUpdate = true;
        FX.gp = t;
        if (FX.grass && FX.flat) fxGrass();
      } catch (e) {
        console.error(e);
      }
    };
    im.src = FXGP;
  }
  return null;
}
function fxFlat() {
  const hs = GEO.size / 2,
    SEG = 240,
    W = 2048,
    K = W / GEO.size,
    mc = document.createElement('canvas');
  mc.width = mc.height = W;
  const x = mc.getContext('2d');
  if (PL.green) x.drawImage(PL.green, 0, 0, W, W);
  x.globalCompositeOperation = 'destination-out';
  for (const k of ['roads', 'paths', 'cycle', 'rail', 'water']) if (PL[k]) x.drawImage(PL[k], 0, 0, W, W);
  (typeof P !== 'undefined' ? P : [])
    .filter((q) => q.site && q.poly && q.poly.length > 2)
    .forEach((q) => {
      x.beginPath();
      q.poly.forEach((a, i) => {
        const u = (a[0] + hs) * K,
          v = (a[1] + hs) * K;
        i ? x.lineTo(u, v) : x.moveTo(u, v);
      });
      x.closePath();
      x.fill();
    });
  clgMask(x, W);
  const tex = new T.CanvasTexture(mc);
  tex.flipY = false;
  tex.minFilter = T.LinearFilter;
  tex.generateMipmaps = false;
  const geo = new T.PlaneGeometry(GEO.size, GEO.size, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, gh(p.getX(i), p.getZ(i)) + 0.08);
  geo.computeVertexNormals();
  const mat = new T.MeshLambertMaterial({
    color: 0xffffff,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
  });
  const ao = S.fx[S.dar] || {},
    scl = (ao.sc == null ? 8 : ao.sc) / 100,
    vr = (ao.vr == null ? 8 : ao.vr) / 10,
    gd = new T.Color(ao.cd || '#1f3817'),
    gl = new T.Color(ao.cl || '#526b30');
  const gp = ao.gt === 0 ? null : fxGp(),
    gtA = gp ? (ao.gt == null ? 85 : ao.gt) / 100 : 0,
    gsz = ao.gs == null ? 6 : ao.gs;
  airEnsure();
  const air = ao.air !== 0 && GEO.air && airPrep(GEO.air, mc),
    airA = air ? Math.max(0, Math.min(1, (ao.airA == null ? 70 : ao.airA) / 100)) : 0;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tM = { value: tex };
    sh.uniforms.uS = { value: GEO.size };
    sh.uniforms.uScale = { value: scl };
    sh.uniforms.uVariation = { value: vr };
    sh.uniforms.uGrassDark = { value: gd };
    sh.uniforms.uGrassLight = { value: gl };
    sh.uniforms.tG = { value: gp || tex };
    sh.uniforms.uGT = { value: gtA };
    sh.uniforms.uGS = { value: gsz };
    sh.uniforms.tA = { value: air ? air.tex : tex };
    sh.uniforms.uAir = { value: airA };
    sh.uniforms.uAm = { value: air ? air.mean : new T.Vector3(1, 1, 1) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldPosition;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWorldPosition=(modelMatrix*vec4(transformed,1.)).xyz;',
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWorldPosition;uniform sampler2D tM,tA,tG;uniform vec3 uGrassDark,uGrassLight,uAm;uniform float uS,uAir,uScale,uVariation,uGT,uGS;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.0-2.0*f);float a=hash(i);float b=hash(i+vec2(1.0,0.0));float c=hash(i+vec2(0.0,1.0));float d=hash(i+vec2(1.0,1.0));return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}`,
      )
      .replace(
        'void main() {',
        'void main(){float mkA=texture2D(tM,(vWorldPosition.xz+uS*.5)/uS).a;if(mkA<.04)discard;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{vec2 p=vWorldPosition.xz*uScale;float dist=length(cameraPosition-vWorldPosition);
 float wM=1.-smoothstep(150.,600.,dist),wF=1.-smoothstep(40.,180.,dist);
 float broad=noise(p*0.7);float medium=noise(p*2.3);float fine=noise(p*7.0);
 float pattern=broad*0.65+(medium*wM+.5*(1.-wM))*0.25+(fine*wF+.5*(1.-wF))*0.10;float variation=(pattern-0.5)*uVariation;
 diffuseColor.rgb=mix(uGrassDark,uGrassLight,clamp(0.5+variation,0.0,1.0));
 vec2 vp=vWorldPosition.xz/60.;vp+=(vec2(noise(vp*1.7),noise(vp*1.7+vec2(7.,3.)))-.5)*.7;vec2 ci=floor(vp),cf=fract(vp);float md=9.,pid=0.;
 for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 g=vec2(float(i),float(j));vec2 o=vec2(hash(ci+g+vec2(3.1,1.7)),hash(ci+g+vec2(9.7,4.3)));vec2 d2=g+o-cf;float dd=dot(d2,d2);if(dd<md){md=dd;pid=hash(ci+g+vec2(1.3,8.1));}}
 float pt=(pid-.5)*(1.-.6*uAir);diffuseColor.rgb*=vec3(1.+.20*pt,1.+.09*pt,1.-.26*pt);
 diffuseColor.a=smoothstep(.15,.75,mkA);
 if(uGT>0.){vec2 uv=vWorldPosition.xz/uGS;vec2 ci=floor(uv),cf=fract(uv);vec3 acc=vec3(0.);float w2=0.;
  for(int j=0;j<2;j++)for(int i=0;i<2;i++){vec2 g=vec2(float(i),float(j));vec2 c=ci+g;
   float wx=(i==0)?1.-cf.x:cf.x,wy=(j==0)?1.-cf.y:cf.y;wx=wx*wx*(3.-2.*wx);wy=wy*wy*(3.-2.*wy);float w=wx*wy;
   float r1=hash(c+vec2(3.7,1.1)),r2=hash(c+vec2(8.3,5.9)),r3=hash(c+vec2(1.9,7.3));float a=r3*6.2832;mat2 rot=mat2(cos(a),-sin(a),sin(a),cos(a));
   vec3 col=texture2D(tG,rot*uv+vec2(r1,r2)*17.).rgb*2.;acc+=w*(col-1.);w2+=w*w;}
  vec3 rel=1.+acc/sqrt(max(w2,.25));diffuseColor.rgb*=mix(vec3(1.),clamp(rel,vec3(.35),vec3(1.95)),uGT);}
 if(uAir>0.){vec3 pc=texture2D(tA,(vWorldPosition.xz+uS*.5)/uS).rgb;vec3 rel=clamp(pc/uAm,vec3(.6),vec3(1.7));diffuseColor.rgb*=mix(vec3(1.),rel,uAir);}}`,
      );
  };
  const m = new T.Mesh(geo, mat);
  m.frustumCulled = false;
  m.receiveShadow = true;
  m.castShadow = false;
  m.raycast = () => {};
  m.renderOrder = 1;
  const g = new T.Group();
  g.add(m);
  sc.add(g);
  FX.grass = g;
  FX.gn = 1;
  FX.gcs = 0;
  FX.flat = 1;
  fxVis();
}
function fxWater() {
  fxWaterClear();
  FX.wp = [];
  if (!fxOn('water') || !GEO.size || !PL.water) return;
  const hs = GEO.size / 2,
    W = 2048,
    mc = document.createElement('canvas');
  mc.width = mc.height = W;
  const x = mc.getContext('2d');
  x.drawImage(PL.water, 0, 0, W, W);
  x.globalCompositeOperation = 'destination-out';
  for (const k of ['roads', 'paths', 'cycle']) if (PL[k]) x.drawImage(PL[k], 0, 0, W, W);
  const tex = new T.CanvasTexture(mc);
  tex.flipY = false;
  tex.generateMipmaps = false;
  tex.minFilter = T.LinearFilter;
  const geo = new T.PlaneGeometry(GEO.size, GEO.size, 300, 300);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, gh(p.getX(i), p.getZ(i)) + 0.14);
  const deep = new T.Color('#05080b'),
    shore = new T.Color('#0e1419'),
    zen = new T.Color('#7fa8d2'),
    hor = new T.Color('#e4edf4');
  const mat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -8,
    uniforms: {
      tM: { value: tex },
      uS: { value: GEO.size },
      uHs: { value: hs },
      uTm: { value: 0 },
      uD: { value: deep },
      uSh: { value: shore },
      uZ: { value: zen },
      uH: { value: hor },
      uSun: { value: new T.Vector3() },
      tR: { value: null },
      uTM: { value: new T.Matrix4() },
      uRO: { value: 0 },
    },
    vertexShader:
      'varying vec3 vW;void main(){vW=position;vec3 pp=position;pp.y+=clamp(length(cameraPosition-position)*.0012,0.,1.2);gl_Position=projectionMatrix*viewMatrix*vec4(pp,1.);}',
    fragmentShader: `varying vec3 vW;uniform sampler2D tM;uniform vec3 uD,uSh,uZ,uH,uSun;uniform float uS,uHs,uTm,uRO;uniform sampler2D tR;uniform mat4 uTM;
 float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
 float cov(vec2 w,float r){float a=0.;for(int i=0;i<8;i++){float t=float(i)*.785398;a+=texture2D(tM,(w+vec2(cos(t),sin(t))*r+uHs)/uS).a;}return a/8.;}
 void main(){vec2 w=vW.xz;float a0=texture2D(tM,(w+uHs)/uS).a;if(a0<.04)discard;
  float c=(cov(w,.45)+cov(w,1.1))*.5;float depth=smoothstep(.25,.85,c);
  float t=uTm;vec2 g=vec2(0.);
  vec2 d1=normalize(vec2(1.,.4)),d2=normalize(vec2(-.5,1.)),d3=normalize(vec2(.8,-.9)),d4=normalize(vec2(-1.,-.3));
  g+=d1*cos(dot(d1,w)*1.9+t*1.1)*.020*1.9+d2*cos(dot(d2,w)*2.7+t*1.4)*.014*2.7+d3*cos(dot(d3,w)*4.3-t*1.7)*.008*4.3+d4*cos(dot(d4,w)*6.1+t*2.1)*.005*6.1;
  g+=(vec2(n(w*1.3+vec2(t*.25,0.)),n(w*1.3+vec2(9.,t*.2)))-.5)*.10;float dst=length(cameraPosition-vW);g*=1./(1.+dst/45.);
  vec3 N=vec3(0.,1.,0.);vec3 V=normalize(cameraPosition-vec3(w.x,vW.y,w.y)*vec3(1.,1.,1.));
  vec3 Vv=normalize(cameraPosition-vW);vec3 R=reflect(-Vv,N);
  float f=.3+.6*pow(1.-max(dot(N,Vv),0.),3.);
  vec4 q=uTM*vec4(vW,1.);vec2 ru=q.xy/q.w;vec3 sky=mix(uH,uZ,clamp(R.y*1.4,0.,1.));if(uRO>.5){float rr=.0045;vec3 a=texture2D(tR,ru).rgb*.28;for(int i=0;i<8;i++){float tt=float(i)*.785398;a+=texture2D(tR,ru+vec2(cos(tt),sin(tt))*rr*(i%2==0?1.:1.9)).rgb*.09;}sky=a;}
  vec3 base=mix(uSh,uD,depth);
  vec3 col=mix(base,sky,f);
  float gl=pow(max(dot(R,normalize(uSun)),0.),90.);col+=gl*.35;
  
  gl_FragColor=vec4(col,smoothstep(.04,.5,a0));}`,
  });

  {
    const d = x.getImageData(0, 0, W, W).data;
    let sh = 0,
      cn = 0;
    for (let i = 0; i < 90; i++)
      for (let j = 0; j < 90; j++) {
        const X = -hs + ((i + 0.5) * GEO.size) / 90,
          Z = -hs + ((j + 0.5) * GEO.size) / 90,
          u = Math.floor(((X + hs) / GEO.size) * W),
          v = Math.floor(((Z + hs) / GEO.size) * W);
        if (d[(v * W + u) * 4 + 3] > 128) {
          sh += gh(X, Z);
          cn++;
          (FX.wp = FX.wp || []).push(X, Z, gh(X, Z) + 0.14);
        }
      }
    FX.wh = (cn ? sh / cn : 0) + 0.14;
  }
  const m = new T.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 1;
  m.raycast = () => {};
  const vc = new T.PerspectiveCamera(),
    bias = new T.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1),
    V3 = new T.Vector3(),
    Dv = new T.Vector3(),
    Up = new T.Vector3();
  let fr = 0;
  m.onBeforeRender = (rd, scn, cam) => {
    mat.uniforms.uTm.value = 7.3;
    mat.uniforms.uSun.value.copy(sunL.position).sub(sunL.target.position).normalize();
    if (!S.m3) {
      mat.uniforms.uRO.value = 0;
      return;
    }
    try {
      const bs = rd.getDrawingBufferSize(new T.Vector2()),
        w = Math.max(64, Math.floor(bs.x * 0.5)),
        hh = Math.max(64, Math.floor(bs.y * 0.5));
      if (!FX.rt || FX.rt.width !== w || FX.rt.height !== hh) {
        FX.rt && FX.rt.dispose();
        FX.rt = new T.WebGLRenderTarget(w, hh, {
          minFilter: T.LinearFilter,
          magFilter: T.LinearFilter,
          format: T.RGBAFormat,
        });
        FX.rtOk = 0;
      }
      let h0 = FX.wh;
      {
        const q = FX.wp;
        let bd = 1e18;
        for (let i = 0; i < q.length; i += 3) {
          const dx = q[i] - V.tx,
            dz = q[i + 1] - V.tz,
            dd = dx * dx + dz * dz;
          if (dd < bd) {
            bd = dd;
            h0 = q[i + 2];
          }
        }
      }
      cam.updateMatrixWorld();
      V3.setFromMatrixPosition(cam.matrixWorld);
      cam.getWorldDirection(Dv);
      Up.set(cam.matrixWorld.elements[4], cam.matrixWorld.elements[5], cam.matrixWorld.elements[6]);
      vc.position.set(V3.x, 2 * h0 - V3.y, V3.z);
      vc.up.set(Up.x, -Up.y, Up.z);
      vc.lookAt(V3.x + Dv.x, 2 * h0 - (V3.y + Dv.y), V3.z + Dv.z);
      vc.updateMatrixWorld();
      vc.matrixWorldInverse.copy(vc.matrixWorld).invert();
      vc.projectionMatrix.copy(cam.projectionMatrix);
      vc.projectionMatrixInverse.copy(cam.projectionMatrixInverse);
      mat.uniforms.uTM.value.copy(bias).multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);
      if ((fr++ & 1) === 0 || !FX.rtOk) {
        const cur = rd.getRenderTarget(),
          sa = rd.shadowMap.autoUpdate,
          xr = rd.xr.enabled;
        m.visible = false;
        rd.shadowMap.autoUpdate = false;
        rd.xr.enabled = false;
        const cp = rd.clippingPlanes;
        rd.clippingPlanes = [new T.Plane(new T.Vector3(0, 1, 0), -(h0 - 0.05))];
        const gv = FX.grass ? FX.grass.visible : false;
        if (FX.grass) FX.grass.visible = false;
        rd.setRenderTarget(FX.rt);
        rd.clear();
        rd.render(scn, vc);
        rd.clippingPlanes = cp;
        {
          const ac = rd.autoClear;
          rd.autoClear = false;
          rd.render(FX.es || (FX.es = new T.Scene()), vc);
          rd.autoClear = ac;
        }
        rd.setRenderTarget(cur);
        if (FX.grass) FX.grass.visible = gv;
        rd.clippingPlanes = cp;
        rd.shadowMap.autoUpdate = sa;
        rd.xr.enabled = xr;
        m.visible = true;
        FX.rtOk = 1;
      }
      mat.uniforms.tR.value = FX.rt.texture;
      mat.uniforms.uRO.value = 1;
    } catch (e) {
      mat.uniforms.uRO.value = 0;
      console.error(e);
    }
  };
  sc.add(m);
  FX.water = m;
  fxVis();
}

/* Hinweis: entspricht exakt der Darstellung der Taste 8 im Grafiktest (dort läuft der Weichschalen-Shader mit Zellgröße 1,05 · Versatz 0,06 · 6 Schalen) */
const fxTv = () => {
  const o = S.fx[S.dar];
  return o && o.tv === 7 ? 7 : 8;
};
function fxTreeFx(NM) {
  const m = NM || GEO.tmesh,
    tl = FX.tl;
  if (!m || !tl || !tl.length) return;
  const mt = m.material,
    v = NM ? 7 : fxTv();
  mt.transparent = false;
  mt.opacity = 1;
  mt.needsUpdate = true;
  const K = NM ? 8 : v === 7 ? 7 : 6;
  for (let i = 0; i < K; i++) {
    const t = (i + 1) / K,
      off = (NM ? 0.025 : v === 7 ? 0.035 : 0.06) * (i + 1);
    const mat = new T.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uO = { value: off };
      sh.uniforms.uT = { value: t };
      sh.uniforms.uCell = { value: NM ? 0.22 : v === 7 ? 0.55 : 1.05 };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vW;uniform float uO;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\ntransformed+=' +
            (NM ? 'normal' : 'normalize(position)') +
            '*uO;{vec4 wp=modelMatrix*instanceMatrix*vec4(transformed,1.);vW=wp.xyz;}',
        );
      sh.fragmentShader = sh.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vW;uniform float uT,uCell;
float h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}`,
        )
        .replace(
          'void main() {',
          'void main(){float nn=n3(vW/uCell)*.62+n3(vW/(uCell*.4))*.38;if(nn<.3+.55*uT)discard;',
        )
        .replace(
          '#include <color_fragment>',
          '#include <color_fragment>\ndiffuseColor.rgb*=' + (NM ? '.84+.3*nn' : '.88+.24*nn') + ';',
        );
    };
    const sm = new T.InstancedMesh(m.geometry, mat, m.count);
    sm.instanceMatrix = m.instanceMatrix;
    sm.instanceColor = m.instanceColor;
    sm.frustumCulled = false;
    sm.castShadow = false;
    sm.receiveShadow = true;
    sm.raycast = () => {};
    if (NM) {
      sm.userData.near = 1;
      mat.userData.near = 1;
      mat.userData.nk = i + 1;
      mat.customProgramCacheKey = () => 'nearshell' + (i + 1);
    }
    G.trees.add(sm);
  }
}
function fxGrassClear() {
  if (FX.grass) {
    FX.grass.parent && FX.grass.parent.remove(FX.grass);
    FX.grass.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material.map) o.material.map.dispose();
      if (o.material && o.material.uniforms && o.material.uniforms.tM && o.material.uniforms.tM.value)
        o.material.uniforms.tM.value.dispose();
    });
    FX.grass = null;
  }
}
function fxWaterClear() {
  if (FX.water) {
    FX.water.parent && FX.water.parent.remove(FX.water);
    FX.water.geometry.dispose();
    FX.water.material.dispose();
    FX.water = null;
  }
}
/* Sichtbarkeit: Layer, 3D-Modus */
function fxVis() {
  const lg = LY.find((l) => l[1] === 'green'),
    lw = LY.find((l) => l[1] === 'water');
  if (FX.grass) FX.grass.visible = (!lg || !!lg[2]) && !!S.m3 && fxOn('grass');
  if (FX.water) FX.water.visible = (!lw || !!lw[2]) && fxOn('water');
  /* Flurkonturen, Flurnummern, Straßennamen, Bebauungsplan liegen sonst 45–60 cm über Gelände = exakt auf Voxeloberflächen (Z-Fighting/Flackern): bei sichtbarem Gras 40 cm höher legen */
  const up = FX.grass && FX.grass.visible && !FX.flat ? 0.4 : 0;
  [G.parcels, G.flab, G.rnam, G.bplan].forEach((g) => {
    if (g && g.position.y !== up) g.position.y = up;
  });
}
/* Abgleich Schalter ↔ Szene */
function fxSync() {
  if (!GEO.size) return;
  if ((fxOn('trees') !== !!FX.tr || (FX.tr && FX.tv !== fxTv())) && GEO.trees && GEO.trees.length)
    treesBuild(GEO.trees);
  if (fxOn('grass')) {
    if (!FX.grass || FX.gvv !== fxGv()) fxGrass();
  } else fxGrassClear();
  if (fxOn('water')) {
    if (!FX.water) fxWater();
  } else fxWaterClear();
  fxVis();
}
// treesBuild(): Erweiterung zusammengeführt, siehe 02-geodaten/070-baumkataster.js
/* Transparenz: gleicher Regler (Layer „Bäume“ → Transparenz) wie bei den bisherigen Bäumen; bis zur ersten Bedienung bleiben die Effekt-Bäume deckend */
function fxTreeOp() {
  const L = LY.find((l) => l[1] === 'trees');
  if (!L || !FX.tr) return;
  const v = L[3];
  G.trees.children.forEach((o) => {
    const m = o.material;
    if (!m || m.isLineBasicMaterial) return;
    m.transparent = v < 1;
    m.opacity = v;
    m.depthWrite = v >= 1;
    m.needsUpdate = true;
  });
}
// op(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/010-projekt.js
// lop(): Erweiterung zusammengeführt, siehe 05-projekt-und-bedienung/010-projekt.js
// ctxPaint(): Erweiterung zusammengeführt, siehe 02-geodaten/020-flurkarte-als-bild.js
// drSet(): Erweiterung zusammengeführt, siehe 06-darstellung/020-umschalten.js
/* Farbvorlagen für „Rasen“ (Realistisch): dunkel · hell · Variation · Maßstab – nach Referenzfotos */
const FXPRE = [
  ['Standard (Startwerte)', '#1f3817', '#526b30', 8, 8],
  ['Flusswiese (Foto 1)', '#4f6836', '#79925e', 12, 8],
  ['Hügel im Morgenlicht (Foto 2)', '#263d1c', '#7d8a35', 20, 6],
];
function fxPre(i) {
  const o = S.fx[S.dar],
    q = FXPRE[i];
  if (!o || !q) return;
  o.pre = i;
  o.cd = q[1];
  o.cl = q[2];
  o.vr = q[3];
  o.sc = q[4];
  if (FX.grass && FX.flat) fxGrass();
  try {
    if (FX.tr && GEO.trees && GEO.trees.length) treesBuild(GEO.trees);
  } catch (e) {
    console.error(e);
  }
  try {
    if ($('lyp').style.display === 'block') lyRender();
  } catch (e) {
    logErr(e, 'fxPre');
  }
}
function fxSet(k, v) {
  if (!S.fx[S.dar]) return;
  S.fx[S.dar][k] =
    k === 'tv'
      ? v === 7
        ? 7
        : 8
      : k === 'gv'
        ? v === 2
          ? 2
          : 1
        : k === 'airA' || k === 'sc' || k === 'vr' || k === 'gt'
          ? Math.max(0, Math.min(100, v | 0))
          : k === 'gs'
            ? Math.max(2, Math.min(20, v | 0))
            : k === 'cd' || k === 'cl'
              ? String(v)
              : v
                ? 1
                : 0;
  if (
    (k === 'air' ||
      k === 'airA' ||
      k === 'sc' ||
      k === 'vr' ||
      k === 'cd' ||
      k === 'cl' ||
      k === 'gt' ||
      k === 'gs') &&
    FX.grass &&
    FX.flat
  )
    fxGrass();
  fxSync();
  if (k === 'trees') fxUi();
}
function fxLoad(o) {
  if (!o) return;
  for (const m of ['sch', 'real']) if (o[m]) Object.assign(S.fx[m], o[m]);
}
setInterval(() => {
  try {
    fxVis();
    if (FX.tr && FX.tc !== S.lc.trees && GEO.trees && GEO.trees.length) treesBuild(GEO.trees);
    const sg = JSON.stringify(
      (typeof P !== 'undefined' ? P : []).filter((q) => q.site && q.poly).map((q) => q.poly),
    );
    if (FX.sg !== sg) {
      const f = FX.sg !== undefined;
      FX.sg = sg;
      if (f && FX.grass) {
        clearTimeout(FX.T3);
        FX.T3 = setTimeout(() => {
          try {
            fxGrass();
          } catch (e) {
            console.error(e);
          }
        }, 700);
      }
    }
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 500);
setTimeout(() => {
  try {
    fxUi();
  } catch (e) {
    logErr(e, 'init>anonym');
  }
}, 0);

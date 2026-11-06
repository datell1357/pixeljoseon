// 모든 그림이 함께 쓰는 빛 계산과 후처리
export const MAX_LAMPS = 10;

export const NOISE = /* glsl */ `
float hash12(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float hash13(vec3 p){ p=fract(p*.1031); p+=dot(p,p.zyx+31.32); return fract((p.x+p.y)*p.z); }
vec2 hash22(vec2 p){ vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); q+=dot(q,q.yzx+33.33); return fract((q.xx+q.yz)*q.zy); }
float vnoise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),f.x),mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),f.x),f.y); }
float vnoise3(vec3 p){ vec3 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x),mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x),mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.,9.); a*=.5; } return s; }
float bayer4(vec2 p){ ivec2 q=ivec2(mod(p,4.)); int m[16]=int[16](0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5); return (float(m[q.x+q.y*4])+.5)/16.; }
`;

export const LIT = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSky; uniform vec3 uGnd;
uniform mat4 uShadowMat; uniform sampler2D uShadowMap;
uniform vec4 uLampPos[${MAX_LAMPS}]; uniform vec3 uLampCol[${MAX_LAMPS}]; uniform int uLampN;
uniform vec2 uCamPx; uniform float uPass; uniform float uCloud;
uniform vec3 uViewDir;

float sunShadow(vec3 wp, vec3 n){
  vec4 p = uShadowMat * vec4(wp + n*.035, 1.);
  vec3 c = p.xyz*.5+.5;
  if(c.x<0.||c.x>1.||c.y<0.||c.y>1.||c.z>1.) return 1.;
  return c.z - .0009 > texture(uShadowMap, c.xy).r ? 0. : 1.;
}
float clouds(vec3 wp){
  float f = fbm(wp.xz*.055 + uTime*vec2(.012,.006));
  return mix(1., smoothstep(.40,.52,f)*.5+.5, uCloud);
}
/** 땅 위에 고정된 체크무늬 점: 화면이 움직여도 점이 미끄러지지 않는다 */
float bayerAt(){ return bayer4(floor(gl_FragCoord.xy)+vec2(uCamPx.x,-uCamPx.y)+65536.); }

/** 물감처럼 끊어지는 빛. spec: 반짝임, paint: 경계를 흐트러뜨리는 정도 */
vec3 lit(vec3 alb, vec3 n, vec3 wp, float spec, float paint, float sh, float warm){
  float wob = (vnoise3(wp*11.)-.5)*paint;
  float ndl = dot(n,uSunDir) + wob;
  float b = ndl<-.02 ? 0. : ndl<.22 ? .42 : ndl<.55 ? .72 : 1.;
  float sun = b*sh;
  float up = n.y*.5+.5;
  vec3 amb = mix(uGnd,uSky, up<.33?0.:up<.7?.55:1.);
  // 잎처럼 빛이 비치는 것은 그늘도 푸르게 죽지 않고 제 색을 지킨다
  amb = mix(amb, vec3(dot(amb,vec3(.34)))*vec3(1.22,.98,.72), warm);
  vec3 c = alb*(amb + uSunCol*sun);
  // 등불
  vec3 lamp = vec3(0.);
  for(int i=0;i<uLampN;i++){
    vec3 L = uLampPos[i].xyz - wp; float d = length(L); float r = uLampPos[i].w;
    float a = 1.-d/r; if(a<=0.) continue; a*=a;
    float nl = max(dot(n,L/max(d,.001)),0.)*.75+.25;
    lamp += uLampCol[i]*a*nl;
  }
  float ll = max(lamp.r,max(lamp.g,lamp.b));
  if(ll>.002){
    float steps = 7.;
    float q = floor(min(ll,.85)*steps + bayerAt()*.55)/steps;
    c += alb*lamp/ll*q*1.2;
  }
  if(spec>0.){
    vec3 h = normalize(uSunDir+uViewDir);
    float s = pow(max(dot(n,h),0.), 24.+spec*90.);
    c += uSunCol*spec*(s>.5?1.:s>.16?.34:0.)*(.25+.75*sh);
    for(int i=0;i<uLampN;i++){
      vec3 L = uLampPos[i].xyz - wp; float d = length(L); float r = uLampPos[i].w;
      float a = 1.-d/r; if(a<=0.) continue;
      vec3 hl = normalize(L/max(d,.001)+uViewDir);
      float sl = pow(max(dot(n,hl),0.), 30.+spec*80.);
      c += uLampCol[i]*spec*a*(sl>.4?1.1:0.);
    }
  }
  return c;
}
`;

const UNIFORMS_FOCUS = /* glsl */ `
uniform vec3 uFocus; uniform float uFocusOn;
`;

/** 내 앞을 가리는 물체를 체크무늬로 뚫는다 */
const CUTOUT = /* glsl */ `
  if(uFocusOn>0. && uPass<.5){
    vec3 dp = vWorld - uFocus;
    // 화면 평면에서의 거리와 카메라 쪽 거리
    float along = dot(dp,uViewDir);
    vec3 perp = dp - uViewDir*along;
    float r = length(perp*vec3(1.,1.,1.));
    if(along>.55 && r<1.35){
      float k = smoothstep(1.35,.75,r);
      if(bayerAt() < k*.78) discard;
    }
  }
`;

export const UBER_VERT = /* glsl */ `
in vec4 aux;
in vec3 color;
out vec3 vWorld; out vec3 vN; out vec3 vCol; out vec4 vAux; out vec2 vUv; out vec3 vRoot;
uniform float uTime; uniform float uPass;
#ifdef USE_BONES
#ifdef USE_SKIN
in vec4 skinIndex;
in vec4 skinWeight;
#else
in float bone;
#endif
uniform sampler2D uBoneTex;
out vec3 vObj;
mat4 boneMat(int bi){ return mat4(texelFetch(uBoneTex,ivec2(0,bi),0),texelFetch(uBoneTex,ivec2(1,bi),0),texelFetch(uBoneTex,ivec2(2,bi),0),texelFetch(uBoneTex,ivec2(3,bi),0)); }
#endif
void main(){
  vec4 lp = vec4(position,1.);
  vec3 nrm = normal;
  mat4 mdl = modelMatrix;
  vec3 root = vec3(mdl[3]);
#ifdef USE_INSTANCING
  mdl = modelMatrix*instanceMatrix;
  root = vec3(mdl[3]);
#endif
#ifdef USE_BONES
  vObj = position;
#ifdef USE_SKIN
  // 뼈 넷을 가중치로 섞는다: 관절이 살처럼 구부러진다
  mdl = boneMat(int(skinIndex.x+.5))*skinWeight.x + boneMat(int(skinIndex.y+.5))*skinWeight.y
      + boneMat(int(skinIndex.z+.5))*skinWeight.z + boneMat(int(skinIndex.w+.5))*skinWeight.w;
#else
  mdl = boneMat(int(bone+.5));
#endif
#endif
  vec4 wp = mdl*lp;
  if(aux.z>0.){
    float ph = root.x*.7+root.z*.9;
    float h = aux.z;
    float t = uTime;
    wp.x += (sin(t*1.3+ph)+sin(t*2.7+ph*1.7+wp.y)*.4)*.045*h;
    wp.z += cos(t*1.1+ph*1.2)*.03*h;
    wp.y += sin(t*2.1+ph+wp.x*2.)*.012*h;
  }
  vWorld = wp.xyz;
  vRoot = root;
  vN = normalize(mat3(mdl)*nrm);
  vCol = color;
#ifdef USE_INSTANCING_COLOR
  vCol *= instanceColor;
#endif
  vAux = aux;
  vUv = uv;
  gl_Position = projectionMatrix*viewMatrix*wp;
}
`;

export const UBER_FRAG = /* glsl */ `
precision highp float;
${NOISE}
${LIT}
${UNIFORMS_FOCUS}
in vec3 vWorld; in vec3 vN; in vec3 vCol; in vec4 vAux; in vec2 vUv; in vec3 vRoot;
#ifdef USE_BONES
in vec3 vObj;
uniform float uFur;
#endif
#ifdef USE_MAP
uniform sampler2D uMap;
#endif
layout(location=0) out vec4 oC;
layout(location=1) out vec4 oN;
uniform float uAlpha; uniform vec4 uFlash; uniform float uCut;
void main(){
  // 잎 카드: 카드 하나가 작은 잎 여러 장처럼 보이게 구멍을 뚫는다
#ifdef USE_MAP
  bool leaf = false;
#else
  bool leaf = vUv.x!=0.||vUv.y!=0.;
#endif
  float leafTone = 1.;
  if(leaf){
    vec2 q = vUv; float w = 1.-q.y*q.y; if(abs(q.x)>w) discard;
    float sd = fract(vCol.r*97.3+vCol.g*53.1+vCol.b*17.7)*40.;
    float nn = vnoise(q*3.3+sd);
    if(nn<.40) discard;
    leafTone = nn>.62?1.14:nn>.5?1.:.84;
  }
  if(uAlpha<.999 && bayerAt()>uAlpha) discard;
  if(uPass>.5){ oC=vec4(1.); oN=vec4(1.); return; }
  if(uCut>.5){ ${CUTOUT} }
  vec3 n = normalize(vN);
  float sh = sunShadow(vWorld,n)*clouds(vWorld);
#ifdef USE_BONES
  // 인물: 제 몸에 드리운 그림자로 얼룩지지 않게 하고, 그늘도 푸르게 죽지 않게 한다
  sh = max(sh,.5);
  // 짐승 털결: 모델 좌표에 붙은 길쭉한 잡음으로 법선과 밝기를 흔들어 명암 경계를 털끝처럼 부순다
  float furTone = 1.;
  if(uFur>0. && vAux.x<.2){
    vec3 q = vObj*vec3(60.,60.,15.);
    vec3 f = vec3(vnoise3(q), vnoise3(q+17.3), vnoise3(q+41.1)) - .5;
    n = normalize(n + f*uFur*1.1);
    furTone = 1. + f.x*uFur*.38;
  }
  vec3 alb = vCol;
#ifdef USE_MAP
  alb = texture(uMap, vUv).rgb;
#endif
  vec3 c = lit(alb*furTone,n,vWorld,vAux.x,0.,sh,.55);
  // 앞에서 비추는 보조광과 가장자리 빛: 배경에서 떠오르게 한다
  float nv = max(dot(n,uViewDir),0.);
  c += alb*(nv>.78?.26:nv>.42?.17:.08);
  c += (uSunCol*.34+uSky*.26)*(nv<.3?1.:nv<.46?.42:0.)*(n.y*.5+.6);
#else
  float paint = leaf ? .62 : .14;
  vec3 c = lit(vCol*leafTone,n,vWorld,vAux.x,paint,sh,leaf?.78:0.);
#endif
  float em = vAux.y;
  if(em>0.) c = mix(c, vCol*(1.+em*.12), min(1.,em*1.2));
  c = mix(c,uFlash.rgb,uFlash.a);
  oC = vec4(c, em);
  oN = vec4(n*.5+.5, vAux.w);
}
`;

// ─── 지면 ─────────────────────────────────────────

export const TERRAIN_VERT = /* glsl */ `
out vec3 vWorld; out vec3 vN;
void main(){
  vec4 wp = modelMatrix*vec4(position,1.);
  vWorld = wp.xyz;
  vN = normal;
  gl_Position = projectionMatrix*viewMatrix*wp;
}
`;

/** 지형 종류: 0 풀 1 들풀 2 숲바닥 3 흙 4 조약돌 5 재 6 그을림 7 동굴 8 돌바닥 9 물 10 용암 */
export const TERRAIN_FRAG = /* glsl */ `
precision highp float;
${NOISE}
${LIT}
in vec3 vWorld; in vec3 vN;
layout(location=0) out vec4 oC;
layout(location=1) out vec4 oN;
uniform sampler2D uSplat; uniform vec2 uMapSize; uniform int uBase; uniform ivec4 uKinds; uniform int uKindN; uniform vec3 uBiome;

vec3 ramp3(vec3 a, vec3 b, vec3 c, float t){ return t<.5? mix(a,b,t*2.) : mix(b,c,t*2.-1.); }

/** 울퉁불퉁한 돌 포장: 셀 번호와 경계까지 거리 */
vec3 cobbles(vec2 p, float scale){
  p*=scale; vec2 i=floor(p),f=fract(p); float d1=9.,d2=9.; vec2 id=vec2(0.);
  for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y); vec2 o=hash22(i+g)*.72+.14; vec2 r=g+o-f; float d=dot(r,r);
    if(d<d1){d2=d1;d1=d;id=i+g;} else if(d<d2){d2=d;} }
  return vec3(id, sqrt(d2)-sqrt(d1));
}

vec3 groundColor(int k, vec2 p, inout vec3 n, inout float spec, inout float em){
  float big = fbm(p*.22); float mid = fbm(p*.9+7.); float fine = vnoise(p*7.);
  if(k==0){ // 풀: 올리브에서 금빛으로
    vec3 c = ramp3(vec3(.30,.37,.20),vec3(.42,.46,.22),vec3(.60,.55,.27),big*.7+mid*.4-.05);
    c *= .9+fine*.2; n = normalize(n+vec3(mid-.5,0.,fine-.5)*.12); return c;
  }
  if(k==1){ // 들풀
    vec3 c = ramp3(vec3(.46,.47,.24),vec3(.60,.56,.28),vec3(.74,.65,.33),big*.5+mid*.6-.05);
    c *= .92+fine*.16; n = normalize(n+vec3(mid-.5,0.,fine-.5)*.1); return c;
  }
  if(k==2){ // 숲바닥: 이끼 낀 흙에 드문드문 낙엽
    vec3 c = ramp3(vec3(.15,.19,.13),vec3(.21,.26,.15),vec3(.29,.32,.17),big*.6+mid*.6-.1);
    vec3 cb = cobbles(p+mid*.3,9.); float h = hash12(cb.xy);
    if(h>.84 && cb.z>.05) c = h>.94? vec3(.60,.33,.16): vec3(.46,.38,.18);
    return c*(.9+fine*.2);
  }
  if(k==3){ // 흙길: 바퀴 자국과 자갈
    vec3 c = ramp3(vec3(.43,.33,.24),vec3(.52,.41,.29),vec3(.60,.49,.35),mid*.7+big*.4-.05);
    c *= .92+fine*.16;
    vec3 cb = cobbles(p+3.1,9.); float h = hash12(cb.xy);
    if(h>.86 && cb.z>.08){ c = mix(vec3(.62,.58,.52),vec3(.42,.38,.33),fine); }
    n = normalize(n+vec3(mid-.5,0.,vnoise(p*3.)-.5)*.08);
    return c;
  }
  if(k==4){ // 큰 조약돌 포장
    vec3 cb = cobbles(p,3.6); float h = hash12(cb.xy+3.); float h2 = hash12(cb.xy+11.);
    vec3 c = mix(vec3(.47,.46,.46),vec3(.66,.61,.53),h);
    if(h2>.78) c = mix(c,vec3(.56,.47,.38),.6);
    c *= .9+.14*fine;
    float e = smoothstep(.0,.1,cb.z);
    c = mix(vec3(.17,.16,.19),c,e);
    // 돌 위쪽이 빛을 받게 볼록한 법선을 준다
    float bump = (1.-smoothstep(.05,.3,cb.z));
    vec2 gr = hash22(cb.xy)-.5;
    n = normalize(n+vec3(gr.x*.35,0.,gr.y*.35)+vec3(0.,0.,bump*.6));
    return c;
  }
  if(k==5){ // 재
    vec3 c = ramp3(vec3(.20,.19,.20),vec3(.33,.31,.31),vec3(.46,.43,.41),mid*.9+big*.3-.1);
    return c*(.9+fine*.2);
  }
  if(k==6){ // 그을린 땅
    vec3 cb = cobbles(p,1.3);
    vec3 c = mix(vec3(.15,.12,.12),vec3(.30,.23,.20),mid);
    c *= .9+fine*.2;
    // 금은 군데군데만 달아오른다
    float heat = smoothstep(.5,.64,fbm(p*.26+3.));
    if(cb.z<.028){
      float g = (.6+.4*sin(uTime*1.3+hash12(cb.xy)*6.))*heat;
      c = mix(c*.55,vec3(1.,.42,.10),.85*g); em=.8*g;
    }
    return c;
  }
  if(k==7){ // 동굴 바닥
    vec3 c = ramp3(vec3(.12,.15,.16),vec3(.20,.24,.24),vec3(.30,.33,.31),mid+big*.3-.15);
    return c*(.9+fine*.2);
  }
  if(k==8){ // 잘린 돌바닥
    vec2 q = p*1.1; float row = floor(q.y); q.x += mod(row,2.)*.5; vec2 id = floor(q); vec2 f = fract(q);
    float h = hash12(id); vec3 c = mix(vec3(.30,.31,.33),vec3(.46,.45,.45),h)*(.88+fine*.2);
    float e = min(min(f.x,1.-f.x),min(f.y,1.-f.y));
    c = mix(vec3(.12,.12,.14),c,smoothstep(.015,.05,e));
    return c;
  }
  if(k==11){ // 논: 물기 밴 흙 위로 벼 줄
    float row = abs(fract(p.y*2.2)-.5);
    vec3 c = mix(vec3(.26,.22,.14),vec3(.52,.42,.17),smoothstep(.1,.3,row));
    return c*(.88+fine*.2+mid*.12);
  }
  if(k==12){ // 마당: 곱게 다진 밝은 흙, 비질 자국
    vec3 c = ramp3(vec3(.60,.52,.40),vec3(.70,.62,.48),vec3(.78,.70,.56),mid*.7+big*.4-.05);
    float sweep = sin(p.x*3.1+sin(p.y*1.3)*2.2)*.5+.5;
    c *= .95+sweep*.05;
    c *= .95+fine*.09;
    vec3 cb = cobbles(p+9.,11.); float h = hash12(cb.xy);
    if(h>.93 && cb.z>.08) c = mix(c,vec3(.52,.47,.42),.7);
    return c;
  }
  if(k==10){ // 용암
    vec2 w = p*.5+vec2(uTime*.05,-uTime*.03);
    float f = fbm(w+fbm(w*2.)*1.4);
    float g = smoothstep(.34,.66,f);
    vec3 c = g>.72? vec3(1.,.86,.42) : g>.42? vec3(1.,.50,.12) : g>.18? vec3(.72,.18,.06) : vec3(.24,.06,.05);
    em = .35+g*.8; return c;
  }
  return vec3(.3);
}

void main(){
  if(uPass>.5){ oC=vec4(1.); oN=vec4(1.); return; }
  vec2 p = vWorld.xz;
  // 지도 밖은 가장자리 지형을 이어 쓴다
  vec4 m = texture(uSplat, (clamp(p,vec2(0.),uMapSize)+.5)/(uMapSize+1.));
  float wob = (fbm(p*1.1)-.5)*.42 + (vnoise(p*4.5)-.5)*.14;
  int kind = uBase; float edge = 1.;
  for(int i=0;i<uKindN;i++){
    float v = m[i]+wob;
    if(v>.5){ kind = uKinds[i]; edge = v-.5; }
  }
  vec3 n = normalize(vN); float spec=0.,em=0.;
  vec3 alb = groundColor(kind,p,n,spec,em);
  if(kind<=1) alb *= uBiome;
  // 길 가장자리는 진한 경계로 땅에 묻힌 느낌을 준다
  if(kind==4 && edge<.05) alb *= .55;
  if(kind==3 && edge<.04) alb *= .78;
  if(kind==12 && edge<.04) alb *= .84;
  float sh = sunShadow(vWorld,vec3(0.,1.,0.))*clouds(vWorld);
  vec3 c = lit(alb,n,vWorld,spec,.0,sh,0.);
  if(em>0.) c = mix(c,alb*(1.+em*.3),min(1.,em*1.1));
  oC = vec4(c,em*.9);
  oN = vec4(normalize(vN)*.5+.5, 0.);
}
`;

// ─── 물 ─────────────────────────────────────────

export const WATER_FRAG = /* glsl */ `
precision highp float;
${NOISE}
${LIT}
in vec3 vWorld; in vec3 vN;
layout(location=0) out vec4 oC;
layout(location=1) out vec4 oN;
uniform sampler2D uSplat; uniform vec2 uMapSize; uniform int uWaterIdx;
void main(){
  if(uPass>.5){ oC=vec4(1.); oN=vec4(1.); return; }
  vec2 p = vWorld.xz;
  vec4 m = texture(uSplat, (clamp(p,vec2(0.),uMapSize)+.5)/(uMapSize+1.));
  float wob = (fbm(p*1.1)-.5)*.42 + (vnoise(p*4.5)-.5)*.14;
  float v = m[uWaterIdx]+wob;
  if(v<.5) discard;
  float depth = clamp((v-.5)*3.2,0.,1.);
  float t = uTime;
  float r1 = fbm(p*vec2(1.6,3.2)+vec2(t*.12,t*.06));
  float r2 = fbm(p*vec2(3.1,6.2)-vec2(t*.09,t*.11));
  float rip = r1*.6+r2*.4;
  vec3 deep = vec3(.05,.15,.22), mid = vec3(.09,.28,.34), shal = vec3(.24,.46,.44);
  vec3 c = depth>.55? deep : depth>.22? mid : shal;
  c = mix(c, c*1.2+vec3(.03,.05,.06), step(.56,rip));
  // 하늘빛 줄무늬
  float glint = smoothstep(.635,.64,rip);
  c += vec3(.40,.44,.50)*glint*.55;
  // 물가 거품
  float foam = step(depth,.07+.05*sin(t*.8+p.x*2.+p.y*3.));
  c = mix(c,vec3(.72,.78,.74),foam*.8);
  float sh = sunShadow(vWorld,vec3(0.,1.,0.))*clouds(vWorld);
  c = c*(.55+.55*sh);
  // 등불이 물에 비친다
  for(int i=0;i<uLampN;i++){
    vec3 L = uLampPos[i].xyz - vWorld; float d = length(L.xz);
    float a = 1.-d/(uLampPos[i].w*1.1); if(a<=0.) continue;
    c += uLampCol[i]*a*a*(.3+rip*.9);
  }
  oC = vec4(c,glint*.2);
  oN = vec4(0.,1.,0.,0.);
}
`;

// ─── 풀잎 ─────────────────────────────────────────

export const GRASS_VERT = /* glsl */ `
in vec3 iPos; in vec3 iCol; in vec2 iSeed;
out vec3 vWorld; out vec3 vCol; out vec3 vRoot; out float vH;
uniform float uTime;
void main(){
  float h = position.y;
  float a = iSeed.x*6.283;
  float c = cos(a), s = sin(a);
  vec3 lp = vec3(position.x*c-position.z*s, position.y*iSeed.y, position.x*s+position.z*c);
  float ph = iPos.x*.9+iPos.z*.7;
  float gust = sin(uTime*.9+iPos.x*.25+iPos.z*.18);
  float w = (sin(uTime*2.1+ph)*.5+gust*.8);
  vec3 wp = iPos + lp;
  wp.x += w*.11*h*h*4.;
  wp.z += cos(uTime*1.7+ph)*.05*h*h*4.;
  vWorld = wp; vRoot = iPos; vH = h;
  vCol = iCol;
  gl_Position = projectionMatrix*viewMatrix*vec4(wp,1.);
}
`;

export const GRASS_FRAG = /* glsl */ `
precision highp float;
${NOISE}
${LIT}
in vec3 vWorld; in vec3 vCol; in vec3 vRoot; in float vH;
layout(location=0) out vec4 oC;
layout(location=1) out vec4 oN;
void main(){
  if(uPass>.5){ oC=vec4(1.); oN=vec4(1.); return; }
  vec3 n = vec3(0.,1.,0.);
  float sh = sunShadow(vRoot,n)*clouds(vRoot);
  vec3 alb = vCol*(vH>.16?1.28:vH>.08?1.08:.9);
  vec3 c = lit(alb,n,vRoot,0.,0.,sh,.35);
  oC = vec4(c,0.);
  oN = vec4(0.,1.,0.,0.);
}
`;

// ─── 후처리 ─────────────────────────────────────

export const FS_VERT = /* glsl */ `
out vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }
`;

export const BRIGHT_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tC;
void main(){ vec4 c = texture(tC,vUv); o = vec4(c.rgb*c.a,1.); }
`;

export const BLUR_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D tC; uniform vec2 uDir;
void main(){
  vec3 s = texture(tC,vUv).rgb*.227;
  s += (texture(tC,vUv+uDir*1.385).rgb+texture(tC,vUv-uDir*1.385).rgb)*.316;
  s += (texture(tC,vUv+uDir*3.231).rgb+texture(tC,vUv-uDir*3.231).rgb)*.07;
  o = vec4(s,1.);
}
`;

export const POST_FRAG = /* glsl */ `
precision highp float;
${NOISE}
in vec2 vUv; out vec4 o;
uniform sampler2D tC, tN, tD, tB1, tB2;
uniform vec2 uRes; uniform vec2 uCamPx; uniform float uTime;
uniform float uDepthRange; uniform vec3 uSunDir; uniform mat4 uInvVP; uniform vec2 uMapSize;
uniform vec3 uFogCol; uniform float uFog; uniform vec3 uShadowTint; uniform vec3 uHighTint; uniform float uSat;
uniform vec4 uHalo[${MAX_LAMPS}]; uniform vec3 uHaloCol[${MAX_LAMPS}]; uniform int uHaloN; uniform float uHaloK; uniform float uKey;

float D(vec2 uv){ return texture(tD,uv).r*uDepthRange; }
vec3 WP(vec2 uv, float raw){ vec4 c = vec4(uv*2.-1.,raw*2.-1.,1.); vec4 w = uInvVP*c; return w.xyz/w.w; }

void main(){
  vec2 px = 1./uRes;
  vec3 col = texture(tC,vUv).rgb;
  vec4 nd = texture(tN,vUv);
  vec3 n = nd.xyz*2.-1.;
  float id = nd.a;
  float raw = texture(tD,vUv).r;
  float d = raw*uDepthRange;
  bool sky = raw>=.99999;

  float darkEdge = 0.; float lightEdge = 0.; float behind = 0.;
  const vec2 O[4] = vec2[4](vec2(0.,1.),vec2(0.,-1.),vec2(1.,0.),vec2(-1.,0.));
  for(int i=0;i<4;i++){
    vec2 uv2 = vUv+O[i]*px;
    float dn = D(uv2);
    vec4 nd2 = texture(tN,uv2);
    float diff = dn-d;   // 양수면 옆이 더 멀다: 내가 앞쪽 물체의 가장자리
    bool otherId = abs(nd2.a-id)>.002;
    // 평평한 땅의 기울기만큼은 봐준다
    float eps = .16;
    if(id>0. && diff>eps && otherId) darkEdge = 1.;
    if(id>0. && diff>eps && !otherId) darkEdge = max(darkEdge,.6);
    // 같은 부위 안의 접힌 곳: 튀어나온 모서리는 밝게, 들어간 곳은 어둡게
    if(id>0. && abs(diff)<eps){
      vec3 n2 = nd2.xyz*2.-1.;
      float ndiff = dot(n-n2, normalize(uSunDir+vec3(0.,.4,.4)));
      float amt = 1.-dot(n,n2);
      if(otherId && nd2.a>0. && diff>-.02){ darkEdge = max(darkEdge,.42); }
      else if(amt>.035){
        if(ndiff>.02 && diff>-.012) lightEdge = max(lightEdge,min(1.,amt*3.2));
        else if(ndiff<-.02) darkEdge = max(darkEdge,min(.34,amt*1.1));
      }
    }
  }
  // 어두운 윤곽도 제 색을 지니게: 검정이 아니라 물체 색의 진한 그늘
  if(darkEdge>0.){
    vec3 selout = col*vec3(.40,.36,.46)+vec3(.012,.008,.03);
    col = mix(col,selout,darkEdge);
  }
  if(lightEdge>0. && darkEdge<.3){
    col += (col*.42+vec3(.05,.04,.02))*lightEdge;
  }

  // 지도 가장자리와 땅 위 안개
  if(uFog>0.){
    vec3 w = sky? vec3(0.) : WP(vUv,raw);
    vec2 q = w.xz;
    vec2 off = max(max(-q,q-uMapSize),vec2(0.));
    float out_ = length(off);
    float edge = smoothstep(1.,16.,out_);
    float drift = fbm(q*.16+vec2(uTime*.02,-uTime*.012));
    float low = smoothstep(1.4,-.2,w.y)*smoothstep(.54,.82,drift)*.38;
    float f = sky? 1. : max(edge, low)*uFog;
    if(sky) f = 1.;
    col = mix(col,uFogCol,f);
  }

  // 등불 둘레의 공기
  vec3 halo = vec3(0.);
  vec2 fc = vUv*uRes;
  for(int i=0;i<uHaloN;i++){
    vec2 dl = (fc-uHalo[i].xy)/uHalo[i].z;
    float a = exp(-dot(dl,dl)*2.4);
    halo += uHaloCol[i]*a*uHalo[i].w;
  }
  col += halo*uHaloK;

  // 빛 번짐
  col += texture(tB1,vUv).rgb*.42 + texture(tB2,vUv).rgb*.5;

  // 색 보정: 어두운 곳은 차갑게, 밝은 곳은 따뜻하게
  float l = dot(col,vec3(.299,.587,.114));
  col = mix(vec3(l),col,uSat);
  col = mix(col*uShadowTint, col*uHighTint, smoothstep(.08,.7,l));
  // 색 수를 줄여 도트 느낌을 살린다
  vec2 wp = floor(fc)+vec2(uCamPx.x,-uCamPx.y)+65536.;
  float dither = bayer4(wp)-.5;
  float levels = 40.;
  col = floor(col*levels+.5+dither*.4)/levels;
  // 가장자리 어둡게
  vec2 c = vUv-.5; float vig = 1.-dot(c,c)*.42;
  col *= uKey>.5 ? 1. : vig;
  o = vec4(col, uKey>.5 && sky ? 0. : 1.);
}
`;

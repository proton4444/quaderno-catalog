/* Quaderno di cucina — SDF ink layer. Vanilla WebGL1, no build step. */
(function(){
  'use strict';
  var html=document.documentElement;
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- scroll reveal (independent of WebGL) ---------- */
  var reveals=[].slice.call(document.querySelectorAll('.reveal'));
  if(reduce||!('IntersectionObserver' in window)){reveals.forEach(function(el){el.classList.add('in');});}
  else{
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){
          var sib=[].slice.call(en.target.parentNode.children).indexOf(en.target)%3;
          en.target.style.transitionDelay=(sib*90)+'ms';
          en.target.classList.add('in');io.unobserve(en.target);
          setTimeout(function(){en.target.style.transitionDelay='';},1200);
        }
      });
    },{rootMargin:'0px 0px -8% 0px',threshold:.08});
    reveals.forEach(function(el){io.observe(el);});
  }

  /* ---------- CSS ink-hover origin on card images ---------- */
  [].forEach.call(document.querySelectorAll('.card'),function(card){
    card.addEventListener('pointerenter',function(e){if(e.pointerType==='mouse'||e.pointerType==='pen')card.classList.add('inked');});
    card.addEventListener('pointerleave',function(){card.classList.remove('inked');});
    card.addEventListener('pointermove',function(e){
      var m=card.querySelector('.card-media');if(!m)return;
      var r=m.getBoundingClientRect();
      card.style.setProperty('--mx',(e.clientX-r.left)+'px');
      card.style.setProperty('--my',(e.clientY-r.top)+'px');
    });
  });

  /* ---------- WebGL ---------- */
  var canvas=document.getElementById('sdf-bg');
  var gl=null;
  try{gl=canvas&&(canvas.getContext('webgl',{antialias:false,alpha:false,depth:false,stencil:false,powerPreference:'low-power'})||canvas.getContext('experimental-webgl'));}catch(e){gl=null;}
  if(!gl){html.classList.add('no-webgl');return;}

  var VS='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var FS=[
  'precision highp float;',
  'uniform vec2 uRes;uniform float uTime;uniform float uScroll;uniform float uVel;',
  'uniform vec2 uMouse;uniform float uMouseR;uniform vec4 uHover;uniform float uHoverAmt;',
  'uniform float uPx;uniform float uDpr;uniform float uIntro;uniform vec3 uOrn;',
  '#define NB 15',
  '#define PI 3.14159265',
  'float h1(float n){return fract(sin(n*127.1)*43758.5453);}',
  'vec2 h2(float n){return fract(sin(vec2(n*127.1,n*311.7))*43758.5453);}',
  'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
  'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
  ' return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}',
  'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+17.1;a*=.5;}return v;}',
  'float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}',
  'float sdBox(vec2 p,vec2 b,float r){vec2 q=abs(p)-b+r;return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}',
  'float map(vec2 p){',
  ' float t=uTime;',
  ' vec2 q=p+.03*vec2(noise(p*5.+t*.15)-.5,noise(p*5.+9.7-t*.15)-.5)*2.;',
  ' float asp=uRes.x/uRes.y;',
  ' float k=.2+.07*clamp(abs(uVel),0.,1.);',
  ' float d=1e3;',
  ' for(int i=0;i<NB;i++){',
  '  float fi=float(i);float c=floor(fi/3.);float m=fi-3.*c;',
  '  vec2 hc=h2(c*3.7+1.3);vec2 hm=h2(fi*1.9+5.1);',
  '  float span=2.4;',
  '  float x=(hc.x-.5)*asp*1.05+.07*sin(t*.2+c*1.7);',
  '  float y=mod(hc.y*span+c*.48+uScroll*(.38+.3*hc.x)+t*.015,span)-span*.5;',
  '  float a=t*(.12+.1*hm.x)*(m-1.)+hm.y*6.283;',
  '  vec2 off=(m==0.?vec2(0.):vec2(cos(a),sin(a))*(.07+.09*hm.x)*clamp(asp*1.1,.62,1.));',
  '  float r=(m==0.?.085+.08*h1(c+7.):.03+.06*hm.y);',
  '  r*=(1.+.07*sin(t*.6+fi))*clamp(asp*1.1,.62,1.);',
  '  vec2 dp=q-vec2(x,y)-off;dp.y/=1.+.18*clamp(abs(uVel),0.,1.);',
  '  d=smin(d,length(dp)-r,k);',
  ' }',
  ' d=smin(d,length(q-uMouse)-uMouseR,.24);',
  ' if(uHover.z>0.){float b=sdBox(q-uHover.xy,uHover.zw,.03)-uHoverAmt;d=smin(d,b,.12);}',
  ' return d;',
  '}',
  'float lineA(float sd,float w){return 1.-smoothstep(w*.5,w*.5+uPx*1.2,abs(sd));}',
  'float ornament(vec2 p,out float red){',
  ' vec2 c=uOrn.xy;float R=uOrn.z;vec2 o=p-c;float w=uPx*1.1*uDpr;float a=0.;',
  ' float ang=atan(o.y,o.x);float sweep=step(fract((ang+PI*.5)/(2.*PI)),uIntro);',
  ' float rr=length(o);',
  ' a=max(a,lineA(rr-R,w*1.6)*sweep);',
  ' a=max(a,lineA(rr-R*1.035,w)*sweep*.7);',
  ' float s=R*1.64*.5;vec2 sc=c+vec2(0.,-R+s);',
  ' a=max(a,lineA(sdBox(p-sc,vec2(s),0.),w*1.3)*smoothstep(.3,.8,uIntro));',
  ' a=max(a,lineA(rr-R*.5,w)*sweep*.8);',
  ' a=max(a,lineA(length(o-vec2(R*.25,0.))-R*.5,w)*smoothstep(.5,1.,uIntro)*.8);',
  ' a=max(a,lineA(length(o+vec2(R*.25,0.))-R*.5,w)*smoothstep(.5,1.,uIntro)*.8);',
  // radial construction lines & ticks
  ' float seg=PI/6.;float am=mod(ang+seg*.5,seg)-seg*.5;',
  ' float rl=abs(sin(am)*rr);a=max(a,lineA(rl,w*.8)*step(rr,R)*.45*smoothstep(.6,1.,uIntro));',
  ' float tk=PI/60.;float at=mod(ang+tk*.5,tk)-tk*.5;',
  ' float tl=abs(sin(at)*rr);float big=step(abs(mod(ang+tk*2.5,tk*5.)-tk*2.5),tk*.5);',
  ' a=max(a,lineA(tl,w)*step(R,rr)*step(rr,R*(1.035+.03*big))*sweep);',
  // golden (logarithmic) spiral
  ' float b=log(1.61803)/(PI*.5);float sa=R*.028;',
  ' vec2 so=o-vec2(R*.18,R*.08);float sr=length(so);float th=atan(so.y,so.x);',
  ' float n=(log(max(sr,1e-4)/sa)/b-th)/(2.*PI);',
  ' float dsp=1e3;',
  ' for(int j=0;j<2;j++){float nn=floor(n)+float(j);nn=clamp(nn,0.,2.);float tt=th+2.*PI*nn;dsp=min(dsp,abs(sr-sa*exp(b*tt)));}',
  ' dsp/=sqrt(1.+b*b);',
  ' red=lineA(dsp,w*1.5)*smoothstep(.7,1.,uIntro);',
  ' return a;',
  '}',
  'void main(){',
  ' vec2 fc=gl_FragCoord.xy;',
  ' vec2 p=(fc-.5*uRes)/uRes.y;',
  ' vec2 uv=fc/uRes;',
  ' float t=uTime;',
  /* aged paper */
  ' float n1=fbm(p*2.2+vec2(0.,uScroll*.15));',
  ' float n2=fbm(p*9.+3.1);',
  ' float fib=noise(vec2(p.x*90.,p.y*6.)+n2*4.);',
  ' vec3 paper=mix(vec3(.957,.918,.827),vec3(.878,.784,.604),smoothstep(.35,.85,n1)*.75);',
  ' paper*=.965+.06*n2+.02*fib;',
  ' float fox=smoothstep(.78,.83,noise(p*7.+vec2(4.,uScroll*.4)));',
  ' paper=mix(paper,vec3(.74,.58,.38),fox*.35);',
  ' float grain=hash(fc+fract(t)*0.);paper*=.975+.05*grain;',
  /* modern: faint 12-col grid + registration */
  ' float colw=uRes.x/12.;float gx=abs(mod(fc.x,colw));',
  ' float grid=(1.-smoothstep(0.,1.2,min(gx,colw-gx)))*.05;',
  ' paper=mix(paper,vec3(.12,.08,.05),grid);',
  /* ornament */
  ' float red;float orn=ornament(p,red);',
  ' float chalk=.65+.35*noise(fc*.6);',
  ' paper=mix(paper,vec3(.62,.23,.13),orn*.55*chalk);',
  ' paper=mix(paper,vec3(.72,.24,.10),red*.75*chalk);',
  /* mouse crosshair (dashed) */
  ' float dash=step(.5,fract((fc.x+fc.y)/(10.*uDpr)));',
  ' float cx=1.-smoothstep(0.,uPx*1.5,abs(p.x-uMouse.x));float cy=1.-smoothstep(0.,uPx*1.5,abs(p.y-uMouse.y));',
  ' paper=mix(paper,vec3(.62,.23,.13),max(cx,cy)*dash*.22*step(0.,uMouseR));',
  /* SDF ink */
  ' float d=map(p);',
  ' vec2 e=vec2(uPx*2.,0.);',
  ' vec2 g=vec2(map(p+e.xy)-map(p-e.xy),map(p+e.yx)-map(p-e.yx));',
  ' g=g/(length(g)+1e-5);',
  ' vec2 L=normalize(vec2(-.6,.8));',
  ' float lit=dot(g,L);',
  ' vec3 ink=mix(vec3(.16,.09,.05),vec3(.36,.22,.12),noise(p*14.)*.8);',
  ' float aa=uPx*1.5;',
  ' float depth=-d;',
  ' float inside=1.-smoothstep(-aa,aa,d);',
  ' float sp=6.2*uDpr;',
  // interior: parallel burin lines bent around the form by the distance field; they swell with depth and on the shadow side
  ' vec2 dir=vec2(.8,.6);',
  ' float u=dot(fc,dir)/sp+(d/uPx)/sp*.38;',
  ' float s=abs(fract(u)-.5)*2.;',
  ' float shadow=.5-.5*lit;',
  ' float wl=clamp(.12+depth*(4.+10.*shadow),0.,.78);',
  ' float burin=1.-smoothstep(wl-.26,wl+.26,s);',
  // second cross direction in the deepest shade
  ' float u2=dot(fc,vec2(-.6,.8))/sp-(d/uPx)/sp*.35;',
  ' float s2=abs(fract(u2)-.5)*2.;',
  ' float wl2=clamp((depth-.05)*8.*shadow,0.,.6);',
  ' burin=max(burin,1.-smoothstep(wl2-.26,wl2+.26,s2));',
  ' float rim=smoothstep(.02,.004,depth);',
  ' float inkA=inside*max(burin*.95,rim*.9);',
  // cast shadow: offset SDF sample, cross-hatched in the opposite direction
  ' float ds=map(p+L*.04);',
  ' float castS=(1.-smoothstep(-aa,aa*2.,ds))*step(0.,d);',
  ' float hA=abs(fract(dot(fc,vec2(.707,-.707))/(sp*1.15))-.5)*2.;',
  ' float hB=abs(fract(dot(fc,vec2(.707,.707))/(sp*1.15))-.5)*2.;',
  ' float hatch=castS*(1.-smoothstep(.16,.34,hA))*.8;',
  ' hatch=max(hatch,castS*(1.-smoothstep(.12,.3,hB))*smoothstep(.02,-.03,ds)*.6);',
  // engraved iso-contours outside the blob (like topographic / water lines)
  ' float iso=0.;',
  ' for(int k=1;k<4;k++){float fk=float(k);iso=max(iso,(1.-smoothstep(uPx*.5*uDpr,uPx*1.4*uDpr,abs(d-fk*.017)))*(1.-fk*.26));}',
  ' iso*=step(0.,d)*.55*(.55+.45*step(.35,fract(atan(g.y,g.x)*6.)));',
  ' float hatch2=iso;hatch=max(hatch,hatch2);',
  // crisp outline
  ' float edge=1.-smoothstep(uPx*.6*uDpr,uPx*1.8*uDpr,abs(d));',
  ' edge*=.8+.2*noise(p*40.);',
  // splatter
  ' vec2 sc=fc/(7.*uDpr);vec2 sci=floor(sc);float sh=hash(sci);float spl=step(.93,sh)*(1.-smoothstep(.12,.22,length(fract(sc)-.5-(hash(sci+3.)-.5)*.5)*(1.+sh*.6)))*smoothstep(.06,.0,d)*step(0.,d)*.85;',
  ' float a=clamp(max(max(inkA,hatch),max(edge,spl)),0.,1.);',
  ' vec3 col=mix(paper,paper*vec3(.8,.66,.5),inside*(.35+.25*smoothstep(0.,.12,depth)));col=mix(col,ink,a);',
  // iron-gall halo bleeding into paper
  ' col=mix(col,col*vec3(.93,.88,.8),smoothstep(.05,0.,d)*step(0.,d)*.5);',
  /* vignette */
  ' vec2 vq=uv-.5;float vig=smoothstep(.35,1.05,length(vq*vec2(1.1,1.25)));',
  ' col=mix(col,col*vec3(.66,.5,.34),vig*.75);',
  ' gl_FragColor=vec4(col,1.);',
  '}'].join('\n');

  function sh(type,src){
    var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
    if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.error('[sdf] shader error:',gl.getShaderInfoLog(s));return null;}
    return s;
  }
  var vs=sh(gl.VERTEX_SHADER,VS),fs=sh(gl.FRAGMENT_SHADER,FS);
  if(!vs||!fs){html.classList.add('no-webgl');return;}
  var prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);
  if(!gl.getProgramParameter(prog,gl.LINK_STATUS)){console.error('[sdf] link error:',gl.getProgramInfoLog(prog));html.classList.add('no-webgl');return;}
  gl.useProgram(prog);
  var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  var loc=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
  var U={};['uRes','uTime','uScroll','uVel','uMouse','uMouseR','uHover','uHoverAmt','uPx','uDpr','uIntro','uOrn'].forEach(function(n){U[n]=gl.getUniformLocation(prog,n);});
  html.classList.add('webgl');

  var W=0,H=0,cssW=0,cssH=0,scale=1;
  function resize(){
    cssW=window.innerWidth;cssH=window.innerHeight;
    var mobile=cssW<700||window.matchMedia('(pointer:coarse)').matches;
    var dpr=Math.min(window.devicePixelRatio||1,1.5);
    scale=dpr*(mobile?.6:.85);
    W=Math.max(1,Math.floor(cssW*scale));H=Math.max(1,Math.floor(cssH*scale));
    if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H;}
    gl.viewport(0,0,W,H);
    if(reduce)draw(performance.now());
  }
  function toShader(x,y){var h=cssH||1;return [(x-cssW/2)/h,(h/2-y)/h];}

  var mouse=[0,-5],mouseT=[0,-5],mouseR=-1,mouseRT=-1;
  var hasMouse=false;
  window.addEventListener('pointermove',function(e){
    mouseT=toShader(e.clientX,e.clientY);
    if(!hasMouse){mouse=mouseT.slice();hasMouse=true;}
    mouseRT=e.pointerType==='touch'?.09:.075;
  },{passive:true});
  window.addEventListener('pointerdown',function(e){mouseT=toShader(e.clientX,e.clientY);if(!hasMouse){mouse=mouseT.slice();hasMouse=true;}mouseRT=.12;},{passive:true});
  document.addEventListener('pointerleave',function(){mouseRT=-1;});

  var scrollY=window.scrollY,scrollS=scrollY,vel=0;
  window.addEventListener('scroll',function(){scrollY=window.scrollY;},{passive:true});

  var hoverEl=null,hoverAmt=-.08,hoverAmtT=-.08,hoverRect=[0,0,0,0];
  [].forEach.call(document.querySelectorAll('.card, .hero-plate'),function(el){
    el.addEventListener('pointerenter',function(){hoverEl=el;hoverAmtT=.035;});
    el.addEventListener('pointerleave',function(){if(hoverEl===el){hoverAmtT=-.08;}});
  });

  var start=performance.now(),last=start,running=true;
  function draw(now){
    var t=(now-start)/1000;
    var dt=Math.min(.05,(now-last)/1000);last=now;
    if(reduce){t=14;}
    var f=1-Math.pow(.001,dt);
    mouse[0]+=(mouseT[0]-mouse[0])*f*.9;mouse[1]+=(mouseT[1]-mouse[1])*f*.9;
    mouseR+=(mouseRT-mouseR)*f*.6;
    var prev=scrollS;scrollS+=(scrollY-scrollS)*(reduce?1:f*1.2);
    var v=(scrollS-prev)/Math.max(dt,.016)/cssH;v=Math.max(-2,Math.min(2,v));vel+=(v-vel)*f;
    hoverAmt+=(hoverAmtT-hoverAmt)*f*.7;
    if(hoverEl){
      var r=hoverEl.getBoundingClientRect();
      var c=toShader(r.left+r.width/2,r.top+r.height/2);
      hoverRect=[c[0],c[1],r.width/2/cssH,r.height/2/cssH];
      if(hoverAmtT<0&&hoverAmt<-.075)hoverEl=null;
    }else hoverRect[2]=0;
    var asp=cssW/cssH;
    var mobile=cssW<700;
    var orn=mobile?[asp*.22,.18+scrollS/cssH*.55,.42]:[asp*.26,-.02+scrollS/cssH*.55,.55];
    gl.uniform2f(U.uRes,W,H);
    gl.uniform1f(U.uTime,t);
    gl.uniform1f(U.uScroll,scrollS/cssH);
    gl.uniform1f(U.uVel,vel);
    gl.uniform2f(U.uMouse,mouse[0],mouse[1]);
    gl.uniform1f(U.uMouseR,reduce?-1:mouseR);
    gl.uniform4f(U.uHover,hoverRect[0],hoverRect[1],hoverRect[2],hoverRect[3]);
    gl.uniform1f(U.uHoverAmt,hoverAmt);
    gl.uniform1f(U.uPx,1/H);
    gl.uniform1f(U.uDpr,scale);
    gl.uniform1f(U.uIntro,reduce?1:Math.min(1,Math.max(0,(t-.2)/2.4)));
    gl.uniform3f(U.uOrn,orn[0],orn[1],orn[2]);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
  function loop(now){
    if(!running)return;
    draw(now);
    requestAnimationFrame(loop);
  }
  window.addEventListener('resize',resize);
  resize();
  if(reduce){
    draw(performance.now());
  }else{
    requestAnimationFrame(loop);
    document.addEventListener('visibilitychange',function(){
      if(document.hidden){running=false;}
      else if(!running){running=true;last=performance.now();requestAnimationFrame(loop);}
    });
  }
  canvas.addEventListener('webglcontextlost',function(e){e.preventDefault();running=false;html.classList.remove('webgl');html.classList.add('no-webgl');});
})();

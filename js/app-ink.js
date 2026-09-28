/* Quaderno app — header ink layer. A reduced-cost adaptation of js/sdf.js:
   fewer blobs, 3-octave paper, no ornament/cursor, half resolution, ~30 fps cap,
   runs only while the header canvas is visible. Exposes window.QuadernoInk. */
(function(){
  'use strict';
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var VS='attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var FS=[
  'precision mediump float;',
  'uniform vec2 uRes;uniform float uTime;uniform float uPx;uniform float uDpr;uniform vec2 uTap;uniform float uTapR;',
  '#define NB 8',
  'float h1(float n){return fract(sin(n*127.1)*43758.5453);}',
  'vec2 h2(float n){return fract(sin(vec2(n*127.1,n*311.7))*43758.5453);}',
  'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
  'float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
  ' return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}',
  'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<3;i++){v+=a*noise(p);p=p*2.03+17.1;a*=.5;}return v;}',
  'float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}',
  'float map(vec2 p){',
  ' float t=uTime;float asp=uRes.x/uRes.y;',
  ' vec2 q=p+.035*vec2(noise(p*4.+t*.15)-.5,noise(p*4.+9.7-t*.15)-.5)*2.;',
  ' float d=1e3;',
  ' for(int i=0;i<NB;i++){',
  '  float fi=float(i);vec2 hc=h2(fi*3.7+1.3);',
  /* blobs live in the right-hand part of the header so the title stays on clean paper */
  '  float x=asp*(.02+.46*hc.x)+.06*sin(t*.23+fi*1.7);',
  '  float y=(hc.y-.5)*.9+.08*sin(t*.17+fi*2.3);',
  '  float r=(.07+.09*h1(fi+7.))*(1.+.08*sin(t*.6+fi));',
  '  d=smin(d,length(q-vec2(x,y))-r,.2);',
  ' }',
  ' d=smin(d,length(q-uTap)-uTapR,.22);',
  ' return d;',
  '}',
  'void main(){',
  ' vec2 fc=gl_FragCoord.xy;vec2 p=(fc-.5*uRes)/uRes.y;vec2 uv=fc/uRes;',
  ' float n1=fbm(p*2.2);float n2=noise(p*9.+3.1);',
  ' vec3 paper=mix(vec3(.957,.925,.851),vec3(.886,.807,.655),smoothstep(.35,.9,n1)*.7);',
  ' paper*=.97+.05*n2;paper*=.98+.035*hash(fc);',
  ' float d=map(p);',
  ' vec2 e=vec2(uPx*2.,0.);',
  ' vec2 g=vec2(map(p+e.xy)-map(p-e.xy),map(p+e.yx)-map(p-e.yx));g=g/(length(g)+1e-5);',
  ' vec2 L=normalize(vec2(-.6,.8));float lit=dot(g,L);',
  ' vec3 ink=mix(vec3(.17,.10,.06),vec3(.36,.22,.12),noise(p*14.)*.8);',
  ' float aa=uPx*1.5;float depth=-d;float inside=1.-smoothstep(-aa,aa,d);',
  ' float sp=5.5*uDpr;',
  ' float u=dot(fc,vec2(.8,.6))/sp+(d/uPx)/sp*.38;float s=abs(fract(u)-.5)*2.;',
  ' float shadow=.5-.5*lit;float wl=clamp(.12+depth*(4.+10.*shadow),0.,.78);',
  ' float burin=1.-smoothstep(wl-.26,wl+.26,s);',
  ' float rim=smoothstep(.02,.004,depth);',
  ' float inkA=inside*max(burin*.95,rim*.9);',
  ' float iso=0.;',
  ' for(int k=1;k<3;k++){float fk=float(k);iso=max(iso,(1.-smoothstep(uPx*.5*uDpr,uPx*1.5*uDpr,abs(d-fk*.02)))*(1.-fk*.3));}',
  ' iso*=step(0.,d)*.5;',
  ' float edge=(1.-smoothstep(uPx*.6*uDpr,uPx*1.8*uDpr,abs(d)))*(.8+.2*noise(p*40.));',
  ' float a=clamp(max(max(inkA,iso),edge),0.,1.);',
  ' vec3 col=mix(paper,paper*vec3(.8,.66,.5),inside*.35);col=mix(col,ink,a);',
  ' col=mix(col,col*vec3(.93,.88,.8),smoothstep(.05,0.,d)*step(0.,d)*.5);',
  /* fade to plain paper at the bottom edge so the header melts into the page */
  ' col=mix(col,vec3(.957,.925,.851),smoothstep(.28,0.,uv.y)*.85);',
  ' gl_FragColor=vec4(col,1.);',
  '}'].join('\n');

  function Ink(canvas){
    this.canvas=canvas;this.ok=false;this.running=false;this.visible=true;this.active=true;
    var gl=null;
    try{gl=canvas.getContext('webgl',{antialias:false,alpha:false,depth:false,stencil:false,powerPreference:'low-power'});}catch(e){}
    if(!gl)return;
    function sh(type,src){var s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){console.warn('[ink] shader:',gl.getShaderInfoLog(s));return null;}return s;}
    var vs=sh(gl.VERTEX_SHADER,VS),fs=sh(gl.FRAGMENT_SHADER,FS);if(!vs||!fs)return;
    var prog=gl.createProgram();gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);
    if(!gl.getProgramParameter(prog,gl.LINK_STATUS))return;
    gl.useProgram(prog);
    var buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    var loc=gl.getAttribLocation(prog,'a');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,2,gl.FLOAT,false,0,0);
    this.U={};var self=this;
    ['uRes','uTime','uPx','uDpr','uTap','uTapR'].forEach(function(n){self.U[n]=gl.getUniformLocation(prog,n);});
    this.gl=gl;this.ok=true;this.start=performance.now();this.last=0;
    this.tap=[0,-5];this.tapR=-1;this.tapRT=-1;
    canvas.addEventListener('webglcontextlost',function(e){e.preventDefault();self.ok=false;self.running=false;canvas.classList.add('lost');});
    this.resize();
    var parent=canvas.parentNode;
    if('ResizeObserver' in window){new ResizeObserver(function(){self.resize();}).observe(parent);}
    else window.addEventListener('resize',function(){self.resize();});
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(en){self.visible=en[0].isIntersecting;self.kick();},{threshold:0}).observe(canvas);
    }
    document.addEventListener('visibilitychange',function(){self.kick();});
    parent.addEventListener('pointerdown',function(e){
      var r=canvas.getBoundingClientRect();
      self.tap=[(e.clientX-r.left-r.width/2)/r.height,(r.height/2-(e.clientY-r.top))/r.height];self.tapRT=.1;
      clearTimeout(self._tt);self._tt=setTimeout(function(){self.tapRT=-1;},900);
    },{passive:true});
    canvas.classList.add('on');
    this.kick();
  }
  Ink.prototype.resize=function(){
    if(!this.ok)return;var c=this.canvas,r=c.getBoundingClientRect();
    var dpr=Math.min(window.devicePixelRatio||1,2);var scale=dpr*.5;this.scale=scale;
    var W=Math.max(1,Math.floor(r.width*scale)),H=Math.max(1,Math.floor(r.height*scale));
    if(c.width!==W||c.height!==H){c.width=W;c.height=H;}
    this.gl.viewport(0,0,W,H);this.draw(performance.now(),true);
  };
  Ink.prototype.setActive=function(on){this.active=on;this.kick();};
  Ink.prototype.kick=function(){
    var should=this.ok&&this.active&&this.visible&&!document.hidden&&!reduce;
    if(should&&!this.running){this.running=true;var self=this;requestAnimationFrame(function f(now){
      if(!self.running)return;
      if(now-self.last>=32){self.draw(now);}
      if(self.active&&self.visible&&!document.hidden)requestAnimationFrame(f);else self.running=false;
    });}
    else if(!should){this.running=false;if(this.ok&&reduce)this.draw(performance.now(),true);}
  };
  Ink.prototype.draw=function(now,still){
    if(!this.ok)return;var gl=this.gl,U=this.U,c=this.canvas;
    var dt=Math.min(.1,(now-(this.last||now))/1000);this.last=now;
    this.tapR+=(this.tapRT-this.tapR)*(1-Math.pow(.002,dt||.016));
    var t=reduce?12:(now-this.start)/1000+8;
    gl.uniform2f(U.uRes,c.width,c.height);gl.uniform1f(U.uTime,t);
    gl.uniform1f(U.uPx,1/c.height);gl.uniform1f(U.uDpr,this.scale);
    gl.uniform2f(U.uTap,this.tap[0],this.tap[1]);gl.uniform1f(U.uTapR,reduce?-1:this.tapR);
    gl.drawArrays(gl.TRIANGLES,0,3);
  };
  window.QuadernoInk=Ink;
})();

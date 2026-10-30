/* Alwahaa approval gateway: local WebGL, no CDN dependency. */
(function () {
  'use strict';
  var canvas = document.getElementById('approvalCanvas');
  if (!canvas) return;
  var host = canvas.closest('.hero-gateway');
  var reduced = matchMedia('(prefers-reduced-motion: reduce)');
  var gl;
  try { gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' }); } catch (_) { return; }
  if (!gl) return;
  var vertex = 'attribute vec3 p; attribute float kind; uniform float time; uniform float aspect; uniform vec2 pointer; varying float vKind; varying float depth; void main(){vec3 q=p; float a=pointer.x*.12; q.xz=mat2(cos(a),-sin(a),sin(a),cos(a))*q.xz; q.y+=pointer.y*.08; float d=4.8-q.z; gl_Position=vec4(q.x*3.1/aspect/d,q.y*3.1/d,0.,1.); gl_PointSize=(kind>1.5?11.:kind>.5?3.4:2.)*(4.8/d); vKind=kind; depth=clamp(4.8/d,.6,1.3); }';
  var fragment = 'precision mediump float; uniform float dots; uniform float dark; varying float vKind; varying float depth; void main(){float alpha=.62; if(dots>.5){float r=length(gl_PointCoord-.5)*2.; if(r>1.)discard; alpha=pow(1.-r,1.7)*(vKind>1.5?.95:.6);} vec3 gold=mix(vec3(.49,.33,.08),vec3(1.,.81,.40),dark); if(vKind>1.5)gold=mix(gold,vec3(1.,.94,.72),.6); gl_FragColor=vec4(gold,alpha*depth); }';
  function shader(type, source) { var s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error('Shader unavailable');return s; }
  var program;
  try { program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))return; } catch (_) { return; }
  gl.useProgram(program);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  var loc={p:gl.getAttribLocation(program,'p'),kind:gl.getAttribLocation(program,'kind'),aspect:gl.getUniformLocation(program,'aspect'),pointer:gl.getUniformLocation(program,'pointer'),dots:gl.getUniformLocation(program,'dots'),dark:gl.getUniformLocation(program,'dark')};
  var lines=[],points=[],packets=[];
  function segment(a,b){lines.push(a[0],a[1],a[2],0,b[0],b[1],b[2],0);}
  // Dubai-inspired dimensional skyline: tiered central tower and surrounding offices.
  function tower(x,w,h,z){
    var y=-1.05, d=.16;
    var front=[[x-w/2,y,z],[x+w/2,y,z],[x+w/2,y+h,z],[x-w/2,y+h,z]];
    for(var n=0;n<4;n++){segment(front[n],front[(n+1)%4]);segment(front[n],[front[n][0]+d,front[n][1]+.07,z-d]);}
    segment([x+w/2+d,y+.07,z-d],[x+w/2+d,y+h+.07,z-d]);
    segment([x-w/2+d,y+h+.07,z-d],[x+w/2+d,y+h+.07,z-d]);
    for(var yy=y+.12;yy<y+h-.05;yy+=.12)segment([x-w/2+.035,yy,z],[x+w/2-.035,yy,z]);
  }
  [-1.65,-1.3,-.95,-.58,.58,.95,1.3,1.65].forEach(function(x,i){tower(x,.21,1.0+Math.sin(i*2.1)*.42,-.4);});
  for(var tier=0;tier<7;tier++){tower(0,.5-tier*.06,1.4+tier*.19,-.3);}
  segment([0,1.49,-.3],[0,1.95,-.3]);
  for(var i=0;i<8;i++){var y=-1.2-i*.12;segment([-2.5,y,-.4],[2.5,y,-.4]);}
  function route(t,i){var a=t*Math.PI*2;return [Math.cos(a)*(1.55+i*.065),Math.sin(a)*.36-.55+i*.09,Math.sin(a)*.55];}
  for(var i=0;i<6;i++){for(var j=0;j<100;j++){segment(route(j/100,i),route((j+1)/100,i));}}
  // Fine orbit points create depth without competing with readable tiles.
  for(var j=0;j<620;j++){var a=j*2.39996,r=1.25+(j%19)/19*.65;points.push(Math.cos(a)*r,Math.sin(a)*r*.86,-.65+Math.sin(j)*.22,1);}
  function makeBuffer(data,usage){var b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),usage||gl.STATIC_DRAW);return b;}
  var lineBuffer=makeBuffer(lines),pointBuffer=makeBuffer(points),packetBuffer=makeBuffer(new Array(6*18*4).fill(0),gl.DYNAMIC_DRAW);
  function draw(buffer,count,type,dots){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(loc.p);gl.vertexAttribPointer(loc.p,3,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(loc.kind);gl.vertexAttribPointer(loc.kind,1,gl.FLOAT,false,16,12);gl.uniform1f(loc.dots,dots);gl.drawArrays(type,0,count);}
  var px=0,py=0,visible=true,paused=reduced.matches,elapsed=0,last=0,frame=0,lost=false;
  function resize(){var b=host.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(b.width*d);canvas.height=Math.round(b.height*d);gl.viewport(0,0,canvas.width,canvas.height);gl.uniform1f(loc.aspect,b.width/Math.max(1,b.height));}
  function render(t){frame=0;if(lost)return;elapsed+=last?Math.min((t-last)/1000,.05):0;last=t;
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform2f(loc.pointer,px,py);gl.uniform1f(loc.dark,1);
    draw(lineBuffer,lines.length/4,gl.LINES,0);draw(pointBuffer,points.length/4,gl.POINTS,1);
    packets=[];for(var i=0;i<6;i++){for(var j=0;j<18;j++){var u=((elapsed*.09+i*.15-j*.003)%1+1)%1,p=route(u,i);packets.push(p[0],p[1],p[2],j===0?2:1);}}
    gl.bindBuffer(gl.ARRAY_BUFFER,packetBuffer);gl.bufferSubData(gl.ARRAY_BUFFER,0,new Float32Array(packets));draw(packetBuffer,packets.length/4,gl.POINTS,1);
    if(!paused&&visible&&!document.hidden)frame=requestAnimationFrame(render);
  }
  function kick(){last=0;if(!frame&&!lost&&visible&&!document.hidden)frame=requestAnimationFrame(render);}
  function state(){host.classList.toggle('motion-paused',paused);}
  reduced.addEventListener('change',function(e){paused=e.matches;state();kick();});
  host.addEventListener('pointermove',function(e){if(paused)return;var b=host.getBoundingClientRect();px=(e.clientX-b.left)/b.width-.5;py=.5-(e.clientY-b.top)/b.height;});
  host.addEventListener('pointerleave',function(){px=py=0;});
  new ResizeObserver(function(){resize();kick();}).observe(host);
  new IntersectionObserver(function(entries){visible=entries[0].isIntersecting;if(!visible&&frame){cancelAnimationFrame(frame);frame=0;}kick();}).observe(host);
  document.addEventListener('visibilitychange',kick);window.addEventListener('themechange',kick);
  canvas.addEventListener('webglcontextlost',function(e){e.preventDefault();lost=true;cancelAnimationFrame(frame);host.classList.remove('webgl-ready');});
  host.classList.add('webgl-ready');state();resize();kick();
})();

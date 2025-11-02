// RallyWebGame.jsx
// Single-file React component for a small online rally game.
// Usage: import and render <RallyWebGame /> in your React app (Tailwind assumed available).

import React, { useRef, useEffect, useState } from "react";

export default function RallyWebGame() {
  const canvasRef = useRef(null);
  const [running, setRunning] = useState(true);
  const [time, setTime] = useState(0);
  const [laps, setLaps] = useState(0);
  const [best, setBest] = useState(null);
  const keys = useRef({ ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, w:false,a:false,s:false,d:false});

  // Game state
  const stateRef = useRef({
    player: {
      x: 300,
      y: 220,
      angle: 0,
      speed: 0,
      width: 20,
      height: 36,
      maxSpeed: 300,
      accel: 240,
      friction: 200,
      turnSpeed: Math.PI, // radians per second
    },
    checkpoints: [],
    currentCheckpoint: 0,
    lapStartTime: 0,
    started: true,
    lastTimestamp: null,
  });

  // Simple race track defined by outer and inner polygons. We'll treat walls as collision boundaries.
  const track = useRef({
    outer: [
      [50, 50], [750, 50], [750, 550], [50, 550]
    ],
    inner: [
      [200, 150], [600, 150], [600, 450], [200, 450]
    ],
    // checkpoints are line segments with midpoint and radius for detection
    checkpoints: [
      {a:[400,150], b:[400,170]},
      {a:[600,300], b:[580,300]},
      {a:[400,450], b:[400,430]},
      {a:[200,300], b:[220,300]},
    ]
  });

  // Helper functions
  const dist = (ax,ay,bx,by)=> Math.hypot(ax-bx, ay-by);
  const pointInPolygon = (x,y, poly) => {
    // ray-casting
    let inside = false;
    for (let i=0,j=poly.length-1;i<poly.length;j=i++){
      const xi=poly[i][0], yi=poly[i][1];
      const xj=poly[j][0], yj=poly[j][1];
      const intersect = ((yi>y)!=(yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // Checkpoint crossing via line segment distance to player center
  const crossedCheckpoint = (player, cp) => {
    const px=player.x, py=player.y;
    const ax=cp.a[0], ay=cp.a[1], bx=cp.b[0], by=cp.b[1];
    const t = Math.max(0, Math.min(1, ((px-ax)*(bx-ax)+(py-ay)*(by-ay))/((bx-ax)**2+(by-ay)**2)));
    const cx = ax + t*(bx-ax), cy = ay + t*(by-ay);
    return dist(px,py,cx,cy) < 28; // detection radius
  }

  useEffect(()=>{
    // initialize checkpoints in stateRef from track
    stateRef.current.checkpoints = track.current.checkpoints;
    stateRef.current.lapStartTime = performance.now();
    stateRef.current.started = true;
    stateRef.current.lastTimestamp = null;
    setTime(0);
    setLaps(0);
  }, []);

  useEffect(()=>{
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf;

    const drawTrack = ()=>{
      // outer
      ctx.fillStyle = '#2d2f31';
      ctx.fillRect(0,0, canvas.width, canvas.height);

      ctx.fillStyle = '#3a7';
      ctx.beginPath();
      ctx.moveTo(...track.current.outer[0]);
      for (let p of track.current.outer) ctx.lineTo(...p);
      ctx.closePath();
      ctx.fill();

      // asphalt area = outer minus inner -> draw asphalt
      ctx.fillStyle = '#444';
      ctx.beginPath();
      // outer
      ctx.moveTo(...track.current.outer[0]);
      for (let p of track.current.outer) ctx.lineTo(...p);
      ctx.closePath();
      // inner as hole
      ctx.moveTo(...track.current.inner[0]);
      for (let p of track.current.inner) ctx.lineTo(...p);
      ctx.closePath();
      ctx.fill('evenodd');

      // draw curbs
      ctx.strokeStyle = '#e2a';
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let i=0;i<track.current.inner.length;i++){
        const p = track.current.inner[i];
        if (i===0) ctx.moveTo(...p); else ctx.lineTo(...p);
      }
      ctx.closePath();
      ctx.stroke();

      // checkpoints
      for (let i=0;i<track.current.checkpoints.length;i++){
        const cp = track.current.checkpoints[i];
        ctx.strokeStyle = i===stateRef.current.currentCheckpoint? '#ff0' : '#fff8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(...cp.a);
        ctx.lineTo(...cp.b);
        ctx.stroke();
      }
    }

    const drawCar = (player)=>{
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);
      // car body
      ctx.fillStyle = '#d33';
      roundRect(ctx, -player.width/2, -player.height/2, player.width, player.height, 4, true, false);
      // windshield
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(-player.width/4, -player.height/2, player.width/2, player.height/4);
      // wheels
      ctx.fillStyle = '#111';
      ctx.fillRect(-player.width/2 -2, -player.height/3, 4, player.height/3);
      ctx.fillRect(player.width/2 -2, -player.height/3, 4, player.height/3);
      ctx.fillRect(-player.width/2 -2, 0, 4, player.height/3);
      ctx.fillRect(player.width/2 -2, 0, 4, player.height/3);
      ctx.restore();
    }

    const roundRect = (ctx, x, y, w, h, r, fill, stroke) =>{
      if (r===undefined) r=5;
      ctx.beginPath();
      ctx.moveTo(x+r,y);
      ctx.arcTo(x+w,y,x+w,y+h,r);
      ctx.arcTo(x+w,y+h,x,y+h,r);
      ctx.arcTo(x,y+h,x,y,r);
      ctx.arcTo(x,y,x+w,y,r);
      ctx.closePath();
      if (fill) ctx.fill();
      if (stroke) ctx.stroke();
    }

    const step = (timestamp)=>{
      if (!stateRef.current.lastTimestamp) stateRef.current.lastTimestamp = timestamp;
      const dt = Math.min(40, timestamp - stateRef.current.lastTimestamp) / 1000; // cap dt
      stateRef.current.lastTimestamp = timestamp;

      if (running){
        // physics update
        const p = stateRef.current.player;
        // controls
        const kb = keys.current;
        const forward = kb.ArrowUp || kb.w;
        const back = kb.ArrowDown || kb.s;
        const left = kb.ArrowLeft || kb.a;
        const right = kb.ArrowRight || kb.d;

        // acceleration
        if (forward) {
          p.speed += p.accel * dt;
        } else if (back) {
          p.speed -= p.accel * dt * 0.7;
        } else {
          // friction
          if (p.speed>0){ p.speed -= p.friction * dt; if (p.speed<0) p.speed=0; }
          else { p.speed += p.friction * dt; if (p.speed>0) p.speed=0; }
        }
        // clamp speed
        p.speed = Math.max(-p.maxSpeed*0.4, Math.min(p.maxSpeed, p.speed));

        // turning - slower when moving backwards
        const turnMult = p.speed>=0 ? 1 : -0.6;
        if (left) p.angle -= p.turnSpeed * dt * (Math.max(0.2, Math.abs(p.speed)/p.maxSpeed)) * turnMult;
        if (right) p.angle += p.turnSpeed * dt * (Math.max(0.2, Math.abs(p.speed)/p.maxSpeed)) * turnMult;

        // update position
        p.x += Math.sin(p.angle) * p.speed * dt;
        p.y -= Math.cos(p.angle) * p.speed * dt;

        // collision: keep player on asphalt (between outer and inner polygons)
        const insideOuter = pointInPolygon(p.x, p.y, track.current.outer);
        const insideInner = pointInPolygon(p.x, p.y, track.current.inner);
        if (!insideOuter || insideInner){
          // simple collision response: push back along velocity vector and reduce speed
          p.x -= Math.sin(p.angle) * p.speed * dt * 1.5;
          p.y += Math.cos(p.angle) * p.speed * dt * 1.5;
          p.speed *= -0.25; // bounce
        }

        // checkpoint logic
        const current = stateRef.current.currentCheckpoint;
        if (crossedCheckpoint(p, stateRef.current.checkpoints[current])){
          stateRef.current.currentCheckpoint = (current + 1) % stateRef.current.checkpoints.length;
          // lap complete when we cycle back to 0
          if (stateRef.current.currentCheckpoint === 0){
            const now = performance.now();
            const lapTime = (now - stateRef.current.lapStartTime) / 1000;
            stateRef.current.lapStartTime = now;
            setLaps(prev=> prev+1);
            setBest(prev=> prev===null ? lapTime : Math.min(prev, lapTime));
          }
        }

        // update timer
        setTime((t)=> t + dt);
      }

      // render
      ctx.clearRect(0,0, canvas.width, canvas.height);
      drawTrack();
      drawCar(stateRef.current.player);

      // HUD
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(10,10,240,80);
      ctx.fillStyle = '#fff';
      ctx.font = '14px system-ui, -apple-system, Roboto, "Segoe UI", sans-serif';
      ctx.fillText(`Time: ${formatTime(time)}`, 20, 32);
      ctx.fillText(`Laps: ${laps}`, 20, 52);
      ctx.fillText(`Best lap: ${best!==null? formatTime(best):'--:--'}`, 20, 72);

      // mini-map
      drawMiniMap(ctx, stateRef.current.player);

      raf = requestAnimationFrame(step);
    }

    raf = requestAnimationFrame(step);
    return ()=> cancelAnimationFrame(raf);
  }, [running]);

  const drawMiniMap = (ctx, player)=>{
    const sx = 640, sy = 360, sw=140, sh=100; // top-right small map
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0,0, sw, sh);
    // draw scaled track
    const scale = 0.18;
    ctx.strokeStyle = '#8f8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const o = track.current.inner;
    ctx.moveTo(o[0][0]*scale +6, o[0][1]*scale +8);
    for (let p of o) ctx.lineTo(p[0]*scale +6, p[1]*scale +8);
    ctx.closePath();
    ctx.stroke();
    // player
    ctx.fillStyle = '#f33';
    ctx.beginPath();
    ctx.arc(player.x*scale +6, player.y*scale +8, 3,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  const formatTime = (t)=>{
    const mm = Math.floor(t/60).toString().padStart(2,'0');
    const ss = Math.floor(t%60).toString().padStart(2,'0');
    const cs = Math.floor((t*100)%100).toString().padStart(2,'0');
    return `${mm}:${ss}.${cs}`;
  }

  useEffect(()=>{
    const handleKey = (e)=>{
      if (e.type==='keydown'){
        if (e.key===' ') { setRunning(r=>!r); e.preventDefault(); }
        if (keys.current[e.key]!==undefined) keys.current[e.key]=true;
      } else {
        if (keys.current[e.key]!==undefined) keys.current[e.key]=false;
      }
    }
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    return ()=>{ window.removeEventListener('keydown', handleKey); window.removeEventListener('keyup', handleKey); }
  }, []);

  const resetRace = ()=>{
    const p = stateRef.current.player;
    p.x = 300; p.y = 220; p.angle=0; p.speed=0;
    stateRef.current.currentCheckpoint = 0;
    stateRef.current.lapStartTime = performance.now();
    setTime(0); setLaps(0);
    setRunning(true);
  }

  // mobile controls
  const touchControl = (dir, pressed)=>{
    if (dir==='up') keys.current.ArrowUp = pressed;
    if (dir==='down') keys.current.ArrowDown = pressed;
    if (dir==='left') keys.current.ArrowLeft = pressed;
    if (dir==='right') keys.current.ArrowRight = pressed;
  }

  return (
    <div className="w-full h-full min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
      <div className="shadow-2xl rounded-2xl bg-gradient-to-tr from-neutral-800 to-neutral-900 p-4 max-w-4xl w-full">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white text-lg font-semibold">Rally — Quick Web Demo</h2>
          <div className="flex gap-2">
            <button onClick={()=> setRunning(r=>!r)} className="px-3 py-1 rounded bg-amber-500 text-black font-medium">{running? 'Pause' : 'Resume'}</button>
            <button onClick={resetRace} className="px-3 py-1 rounded bg-emerald-500 text-white font-medium">Restart</button>
          </div>
        </div>

        <div className="relative">
          <canvas ref={canvasRef} width={800} height={600} className="w-full rounded-lg border border-neutral-700" />

          {/* mobile controls */}
          <div className="md:hidden absolute left-4 bottom-6 flex gap-2">
            <button onPointerDown={()=>touchControl('left',true)} onPointerUp={()=>touchControl('left',false)} onPointerLeave={()=>touchControl('left',false)} className="p-3 rounded bg-white/10">◀</button>
            <button onPointerDown={()=>touchControl('up',true)} onPointerUp={()=>touchControl('up',false)} onPointerLeave={()=>touchControl('up',false)} className="p-3 rounded bg-white/10">▲</button>
            <button onPointerDown={()=>touchControl('right',true)} onPointerUp={()=>touchControl('right',false)} onPointerLeave={()=>touchControl('right',false)} className="p-3 rounded bg-white/10">▶</button>
            <button onPointerDown={()=>touchControl('down',true)} onPointerUp={()=>touchControl('down',false)} onPointerLeave={()=>touchControl('down',false)} className="p-3 rounded bg-white/10">▼</button>
          </div>

          <div className="absolute right-4 top-20 bg-black/40 p-3 rounded text-white text-sm">
            <div>Controls: Arrow keys or WASD — Space to pause</div>
            <div className="mt-2">Time: <b>{formatTime(time)}</b></div>
            <div> Laps: <b>{laps}</b> • Best: <b>{best!==null? formatTime(best):'--:--'}</b></div>
          </div>
        </div>

        <div className="mt-4 text-sm text-neutral-300">
          Tip: drive on the asphalt between the outer and inner boundaries; touching the grass will bounce you and slow you down.
        </div>
      </div>
    </div>
  );
}

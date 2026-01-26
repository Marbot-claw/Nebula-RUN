import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Zap, Trophy, AlertTriangle, Volume2, VolumeX, Home, RotateCcw } from 'lucide-react';
import { GameState, EvolutionStage, Player, Obstacle, Particle, Vector, Collectible, CollectibleType } from '../types';
import { GRAVITY, JUMP_STRENGTH, GAME_SPEED_BASE, OBSTACLE_SPAWN_RATE, OBSTACLE_WIDTH, EVO_CONFIG, SHIELD_DURATION } from '../constants';
// import { generateMissionDebrief } from '../services/geminiService';
import { initAudio, playJumpSound, playScoreSound, playCrashSound, playEvolveSound, playCollectSound, toggleMute, getMuteState } from '../services/audioService';

export const GameEngine: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const shakeRef = useRef<number>(0);
  
  // Time Step Refs
  const lastTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);
  
  // Game State
  const [gameState, setGameState] = useState<GameState>(GameState.START);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  // const [debrief, setDebrief] = useState<string>("");
  // const [isDebriefLoading, setIsDebriefLoading] = useState(false);
  const [currentStage, setCurrentStage] = useState<EvolutionStage>(EvolutionStage.PROTO);
  const [isMuted, setIsMuted] = useState(getMuteState());
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Mutable Game Objects (Refs for performance in loop)
  const playerRef = useRef<Player>({
    y: 300,
    velocity: 0,
    radius: EVO_CONFIG[EvolutionStage.PROTO].radius,
    rotation: 0,
    stage: EvolutionStage.PROTO,
    invincibleUntil: 0
  });
  
  const obstaclesRef = useRef<Obstacle[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const collectiblesRef = useRef<Collectible[]>([]);
  const frameCountRef = useRef(0);

  // Initialize/Reset Game
  const resetGame = () => {
    const h = canvasRef.current?.height || 800;

    playerRef.current = {
      y: h / 2,
      velocity: 0,
      radius: EVO_CONFIG[EvolutionStage.PROTO].radius,
      rotation: 0,
      stage: EvolutionStage.PROTO,
      invincibleUntil: 0
    };
    obstaclesRef.current = [];
    particlesRef.current = [];
    collectiblesRef.current = [];
    frameCountRef.current = 0;
    scoreRef.current = 0;
    shakeRef.current = 0;
    
    // Reset time accumulators slightly to avoid large jumps on restart
    lastTimeRef.current = 0;
    accumulatorRef.current = 0;

    setScore(0);
    setCurrentStage(EvolutionStage.PROTO);
    // setDebrief("");
  };

  const spawnParticles = (x: number, y: number, color: string, count: number = 5) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        id: Math.random(),
        x,
        y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 1.0,
        color: color,
        size: Math.random() * 4 + 2
      });
    }
  };

  const handleGameOver = async (cause: 'PIPE' | 'GROUND' | 'CEILING') => {
    playCrashSound();
    setGameState(GameState.GAME_OVER);
    shakeRef.current = 20; // 20 frames of shake

    if (scoreRef.current > highScore) {
      setHighScore(scoreRef.current);
    }
    
    // Trigger Explosion
    const w = canvasRef.current?.width || 0;
    spawnParticles(w / 3, playerRef.current.y, '#ff0000', 30);

    // Call AI
    // setIsDebriefLoading(true);
    // const message = await generateMissionDebrief(scoreRef.current, playerRef.current.stage, cause);
    // setDebrief(message);
    // setIsDebriefLoading(false);
  };

  const updatePhysics = (canvas: HTMLCanvasElement) => {
    if (gameState !== GameState.PLAYING) return;

    frameCountRef.current++;
    const player = playerRef.current;
    const config = EVO_CONFIG[player.stage];
    const isInvincible = Date.now() < player.invincibleUntil;

    // 1. Evolution Logic
    let evolved = false;
    if (scoreRef.current >= EVO_CONFIG[EvolutionStage.TURBO].threshold && player.stage !== EvolutionStage.TURBO) {
      player.stage = EvolutionStage.TURBO;
      setCurrentStage(EvolutionStage.TURBO);
      evolved = true;
    } else if (scoreRef.current >= EVO_CONFIG[EvolutionStage.AERO].threshold && scoreRef.current < EVO_CONFIG[EvolutionStage.TURBO].threshold && player.stage !== EvolutionStage.AERO) {
      player.stage = EvolutionStage.AERO;
      setCurrentStage(EvolutionStage.AERO);
      evolved = true;
    }

    if (evolved) {
      playEvolveSound();
      spawnParticles(canvas.width / 3, player.y, '#ffffff', 20); // Evolution flash
    }

    // Stage Specific Effects
    if (player.stage === EvolutionStage.TURBO) {
       // Rocket exhaust
       if (frameCountRef.current % 2 === 0) {
           particlesRef.current.push({
               id: Math.random(),
               x: (canvas.width / 3) - 20, // Behind player
               y: player.y + (Math.random() - 0.5) * 5,
               vx: -6 - Math.random() * 4,
               vy: (Math.random() - 0.5) * 2,
               life: 0.6,
               color: Math.random() > 0.5 ? '#f97316' : '#ef4444', // Orange/Red
               size: Math.random() * 5 + 3
           });
       }
    } else if (player.stage === EvolutionStage.AERO) {
        // Subtle condensation trail
        if (frameCountRef.current % 4 === 0) {
           particlesRef.current.push({
               id: Math.random(),
               x: (canvas.width / 3) - 15,
               y: player.y,
               vx: -4,
               vy: 0,
               life: 0.4,
               color: 'rgba(255, 255, 255, 0.4)',
               size: 2
           });
        }
    }

    // 2. Player Physics
    player.velocity += GRAVITY * config.gravityMod;
    player.y += player.velocity;
    
    // Rotation based on velocity
    player.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (player.velocity * 0.1)));

    // Ground Collision
    if (player.y + player.radius > canvas.height) {
      handleGameOver('GROUND');
      return;
    }
    // Ceiling Collision
    if (player.y - player.radius < 0) {
      handleGameOver('CEILING');
      return;
    }

    // 3. Obstacle & Collectible Management
    const effectiveSpeed = GAME_SPEED_BASE * config.speedMod;
    
    // Spawn Logic
    const lastObstacle = obstaclesRef.current.length > 0 ? obstaclesRef.current[obstaclesRef.current.length - 1] : null;
    const spawnDistance = 320; // Fixed horizontal distance between pipes

    if (!lastObstacle || (canvas.width - lastObstacle.x >= spawnDistance)) {
      // Spawn Pipe
      const minGap = 160;
      const maxGap = 260 - (scoreRef.current * 1.5);
      const gapSize = Math.max(130, Math.random() * (maxGap - minGap) + minGap);
      
      let gapTop;
      const safePadding = 80;
      const minY = safePadding;
      const maxY = canvas.height - gapSize - safePadding;

      if (!lastObstacle) {
         gapTop = (canvas.height - gapSize) / 2;
      } else {
         // Constrain vertical shift to make it possible to jump/fall to the next pipe
         const maxShift = 280; // Pixels
         const minShift = -280;
         const shift = Math.random() * (maxShift - minShift) + minShift;
         
         const prevCenter = lastObstacle.gapTop + (lastObstacle.gapSize / 2);
         let targetCenter = prevCenter + shift;

         // Clamp center
         const minCenter = minY + gapSize / 2;
         const maxCenter = maxY + gapSize / 2;
         targetCenter = Math.max(minCenter, Math.min(targetCenter, maxCenter));

         gapTop = targetCenter - (gapSize / 2);
      }
      
      // Safety Clamp
      gapTop = Math.max(minY, Math.min(gapTop, maxY));
      
      const isMoving = scoreRef.current > 10 && Math.random() > 0.6; // Increased threshold for moving pipes

      obstaclesRef.current.push({
        id: frameCountRef.current,
        x: canvas.width,
        width: OBSTACLE_WIDTH,
        gapTop,
        gapSize,
        passed: false,
        isMoving,
        moveSpeedY: isMoving ? (Math.random() > 0.5 ? 1.5 : -1.5) : 0, // Slower moving pipes
        initialGapTop: gapTop
      });

      // Chance to spawn Shield inside the pipe gap
      // Reduced chance to 5% (was 10%)
      if (Math.random() > 0.95) {
        collectiblesRef.current.push({
          id: Math.random(),
          x: canvas.width + OBSTACLE_WIDTH / 2, // Centered in pipe
          y: gapTop + gapSize / 2, 
          radius: 12,
          type: CollectibleType.SHIELD,
          collected: false
        });
      }
    } 
    
    // REMOVED: Random open-air spawn between pipes

    // Update Obstacles
    obstaclesRef.current.forEach(obs => {
      obs.x -= effectiveSpeed;

      // Dynamic Movement
      if (obs.isMoving) {
        obs.gapTop += obs.moveSpeedY;
        // Keep moving pipes within reasonable bounds so they don't close the gap against edges
        const safePadding = 50;
        if (obs.gapTop < safePadding || obs.gapTop + obs.gapSize > canvas.height - safePadding) {
          obs.moveSpeedY *= -1;
        }
      }

      // Collision Detection (Pipes)
      if (!isInvincible) {
        if (
          (canvas.width / 3) + player.radius > obs.x && 
          (canvas.width / 3) - player.radius < obs.x + obs.width
        ) {
          if (
            player.y - player.radius < obs.gapTop || 
            player.y + player.radius > obs.gapTop + obs.gapSize
          ) {
            handleGameOver('PIPE');
          }
        }
      }

      // Score Counting
      if (!obs.passed && obs.x + obs.width < (canvas.width / 3) - player.radius) {
        obs.passed = true;
        playScoreSound();
        scoreRef.current += 1;
        setScore(scoreRef.current);
        spawnParticles(canvas.width / 3, player.y - 20, '#FFD700', 5); 
      }
    });

    // Update Collectibles
    collectiblesRef.current.forEach(item => {
      item.x -= effectiveSpeed;

      // Collision with player
      const dx = (canvas.width / 3) - item.x;
      const dy = player.y - item.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (!item.collected && dist < player.radius + item.radius) {
        item.collected = true;
        playCollectSound();
        
        // Shield Burst Effect
        const burstCount = 20;
        for (let i = 0; i < burstCount; i++) {
          const angle = (Math.PI * 2 * i) / burstCount;
          const speed = 4;
          particlesRef.current.push({
            id: Math.random(),
            x: item.x,
            y: item.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            color: '#22d3ee', // Cyan
            size: Math.random() * 3 + 2
          });
        }
        
        player.invincibleUntil = Date.now() + SHIELD_DURATION;
      }
    });

    // Clean up
    obstaclesRef.current = obstaclesRef.current.filter(obs => obs.x + obs.width > 0);
    collectiblesRef.current = collectiblesRef.current.filter(c => c.x + c.radius > 0 && !c.collected);

    // 4. Particles
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
  };

  const draw = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save(); // Start Global transform (Shake)

    // Apply Shake
    if (shakeRef.current > 0) {
      const intensity = 8;
      const dx = (Math.random() - 0.5) * intensity;
      const dy = (Math.random() - 0.5) * intensity;
      ctx.translate(dx, dy);
      shakeRef.current--;
    }

    // Background (Dynamic based on stage)
    const stage = playerRef.current.stage;
    let bgGradient;
    
    if (stage === EvolutionStage.PROTO) {
      bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGradient.addColorStop(0, '#0f172a'); // Slate 900
      bgGradient.addColorStop(1, '#334155'); // Slate 700
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Stars
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      for (let i = 0; i < 50; i++) {
           const x = (i * 113 + frameCountRef.current * 0.2) % canvas.width;
           const y = (i * 57) % canvas.height;
           const size = (i % 2) + 1;
           ctx.beginPath();
           ctx.arc(x, y, size, 0, Math.PI * 2);
           ctx.fill();
      }

    } else if (stage === EvolutionStage.AERO) {
      bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGradient.addColorStop(0, '#115e59'); // Teal 800
      bgGradient.addColorStop(1, '#0f766e'); // Teal 700
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Speed lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 20; i++) {
          const x = (i * 200 + frameCountRef.current * 15) % (canvas.width + 400) - 200;
          const y = (i * 47) % canvas.height;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + 150, y);
          ctx.stroke();
      }

    } else { // TURBO
      bgGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGradient.addColorStop(0, '#450a0a'); // Red 950
      bgGradient.addColorStop(1, '#7f1d1d'); // Red 900
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Rising Embers
      ctx.fillStyle = 'rgba(251, 146, 60, 0.3)';
      for (let i = 0; i < 30; i++) {
           const x = (i * 97) % canvas.width;
           const y = (canvas.height - (frameCountRef.current * 3 + i * 100) % canvas.height);
           const size = (i % 3) + 1;
           ctx.beginPath();
           ctx.arc(x, y, size, 0, Math.PI * 2);
           ctx.fill();
      }
    }

    // Draw Obstacles
    obstaclesRef.current.forEach(obs => {
      // Pipe styling
      const pipeGradient = ctx.createLinearGradient(obs.x, 0, obs.x + obs.width, 0);
      pipeGradient.addColorStop(0, '#334155');
      pipeGradient.addColorStop(0.5, '#64748b');
      pipeGradient.addColorStop(1, '#334155');
      
      ctx.fillStyle = pipeGradient;
      ctx.shadowBlur = 0;
      
      ctx.fillRect(obs.x, 0, obs.width, obs.gapTop);
      ctx.fillRect(obs.x, obs.gapTop + obs.gapSize, obs.width, canvas.height - (obs.gapTop + obs.gapSize));

      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(obs.x - 2, obs.gapTop - 10, obs.width + 4, 10); 
      ctx.fillRect(obs.x - 2, obs.gapTop + obs.gapSize, obs.width + 4, 10); 
      
      if (obs.isMoving) {
        ctx.fillStyle = `rgba(239, 68, 68, ${Math.abs(Math.sin(frameCountRef.current * 0.1))})`;
        ctx.beginPath();
        ctx.arc(obs.x + obs.width / 2, obs.gapTop - 20, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw Collectibles
    collectiblesRef.current.forEach(c => {
      ctx.save();
      ctx.translate(c.x, c.y);
      
      // Floating animation
      const floatY = Math.sin(frameCountRef.current * 0.1) * 3;
      ctx.translate(0, floatY);

      if (c.type === CollectibleType.SHIELD) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#22d3ee';
        ctx.fillStyle = 'rgba(34, 211, 238, 0.2)'; // Transparent center
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // Inner ring
        ctx.beginPath();
        ctx.arc(0, 0, c.radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    });

    // Draw Particles
    particlesRef.current.forEach(p => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    });

    // Draw Player
    const p = playerRef.current;
    const config = EVO_CONFIG[p.stage];
    
    ctx.save();
    ctx.translate(canvas.width / 3, p.y);
    ctx.rotate(p.rotation);

    // Hit Animation (Scale)
    if (shakeRef.current > 0) {
       const hitScale = 1.2 + Math.sin(shakeRef.current * 0.8) * 0.2;
       ctx.scale(hitScale, hitScale);
    }

    // Draw Shield if active
    if (Date.now() < p.invincibleUntil) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#22d3ee';
      ctx.strokeStyle = `rgba(34, 211, 238, ${Math.abs(Math.sin(frameCountRef.current * 0.2)) + 0.5})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
      // Reset shadow for player
      ctx.shadowBlur = 20;
      ctx.shadowColor = config.color;
    } else {
      ctx.shadowBlur = 20;
      ctx.shadowColor = config.color;
    }

    ctx.fillStyle = config.color;
    
    if (p.stage === EvolutionStage.PROTO) {
      // THE BLOB
      // Pulsing body
      const pulse = Math.sin(frameCountRef.current * 0.2) * 2;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + pulse * 0.5, 0, Math.PI * 2);
      ctx.fill();
      
      // Core
      ctx.fillStyle = '#60a5fa'; // Lighter blue
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(p.radius * 0.4, -p.radius * 0.2, p.radius * 0.25, 0, Math.PI * 2);
      ctx.fill();

    } else if (p.stage === EvolutionStage.AERO) {
      // THE GLIDER
      ctx.beginPath();
      // Main body (Arrow shape)
      ctx.moveTo(p.radius, 0); // Nose
      ctx.lineTo(-p.radius, -p.radius); // Top Tail
      ctx.lineTo(-p.radius * 0.5, 0); // Notch
      ctx.lineTo(-p.radius, p.radius); // Bottom Tail
      ctx.closePath();
      ctx.fill();
      
      // Wing detail
      ctx.fillStyle = '#34d399'; // Lighter emerald
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-p.radius, -p.radius * 0.5);
      ctx.lineTo(-p.radius, p.radius * 0.5);
      ctx.fill();

      // Cockpit
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.ellipse(p.radius * 0.2, 0, p.radius * 0.3, p.radius * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();

    } else { 
      // THE TURBO ROCKET
      // Main Body
      ctx.beginPath();
      ctx.ellipse(0, 0, p.radius * 2, p.radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();

      // Fins
      ctx.fillStyle = '#9f1239'; // Darker Red
      ctx.beginPath();
      ctx.moveTo(-p.radius, 0);
      ctx.lineTo(-p.radius * 2, -p.radius * 1.5);
      ctx.lineTo(-p.radius * 0.5, 0);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(-p.radius, 0);
      ctx.lineTo(-p.radius * 2, p.radius * 1.5);
      ctx.lineTo(-p.radius * 0.5, 0);
      ctx.fill();

      // Window
      ctx.fillStyle = '#fef08a'; // Yellow
      ctx.beginPath();
      ctx.arc(p.radius * 0.8, -p.radius * 0.2, p.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
      
      // Metallic shine
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-p.radius, -p.radius * 0.3);
      ctx.lineTo(p.radius, -p.radius * 0.3);
      ctx.stroke();
    }

    ctx.restore(); // End Player Transform

    ctx.restore(); // End Global Shake Transform
  };

  const loop = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize lastTimeRef if it's 0 (first frame)
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
    }

    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;
    
    // Cap delta time to 100ms to prevent huge jumps (e.g. after tab switching)
    // This prevents the "spiral of death" where the physics tries to catch up too much
    const safeDelta = Math.min(deltaTime, 100);
    
    accumulatorRef.current += safeDelta;
    
    // Fixed Time Step: 60 updates per second (16.66ms)
    const FIXED_STEP = 1000 / 60; 
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
        // Update Physics in fixed steps
        // This ensures the game runs at the same speed on 60Hz and 120Hz screens
        let updates = 0;
        while (accumulatorRef.current >= FIXED_STEP) {
            updatePhysics(canvas);
            accumulatorRef.current -= FIXED_STEP;
            updates++;
            // Safety break to prevent freeze if physics is too slow or accumulator gets huge
            if (updates > 10) {
               accumulatorRef.current = 0;
               break;
            }
        }
        
        draw(ctx, canvas);
    }
    
    requestRef.current = requestAnimationFrame(loop);
  }, [gameState]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [loop]);

  // Controls
  const handleJump = useCallback(() => {
    if (gameState === GameState.GAME_OVER) return;

    if (gameState === GameState.START) {
      initAudio(); // Unlock audio context on first interaction
      setGameState(GameState.PLAYING);
      // Reset timer on start to avoid initial jump
      lastTimeRef.current = performance.now();
      accumulatorRef.current = 0;
    }
    
    playJumpSound();

    const config = EVO_CONFIG[playerRef.current.stage];
    playerRef.current.velocity = JUMP_STRENGTH * config.jumpMod;
    
    const w = canvasRef.current?.width || 0;
    // Spawn simple jump particles
    if (playerRef.current.stage === EvolutionStage.PROTO) {
      spawnParticles(w / 3, playerRef.current.y + 10, '#ffffff', 3);
    }
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        handleJump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleJump]);

  // Window Resize
  useEffect(() => {
    const handleResize = () => {
      // Full screen responsiveness
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setDimensions({ width, height });

      if (canvasRef.current) {
        canvasRef.current.width = width;
        canvasRef.current.height = height;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMuteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const muted = toggleMute();
    setIsMuted(muted);
    if (!muted) initAudio();
  };

  // UI Components
  return (
    <div className="w-full h-screen bg-slate-950 flex items-center justify-center overflow-hidden font-sans">
      <div 
        className="relative overflow-hidden shadow-2xl bg-slate-900"
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        <canvas 
          ref={canvasRef} 
          className="block w-full h-full cursor-pointer"
          onPointerDown={handleJump}
        />

        {/* HUD */}
        <div className="absolute top-4 left-0 right-0 flex justify-center pointer-events-none z-10">
          <div className="bg-black/30 backdrop-blur-md px-6 py-1 rounded-full border border-white/10 text-white text-2xl font-bold shadow-lg flex items-center gap-4">
            <span>{score}</span>
          </div>
        </div>

        <div className="absolute top-4 right-4 pointer-events-none z-10">
          <div className="bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 text-xs font-medium">
             Evo: <span style={{ color: EVO_CONFIG[currentStage].color }}>{EVO_CONFIG[currentStage].name}</span>
          </div>
        </div>

        {/* Mute Button */}
        <button 
          onClick={handleMuteToggle}
          className="absolute top-4 left-4 p-1.5 bg-black/30 backdrop-blur-md rounded-lg border border-white/10 text-gray-300 hover:bg-white/10 z-50 transition-colors"
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        {/* Start Screen */}
        {gameState === GameState.START && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-20">
            <div className="text-center p-8 max-w-md w-full">
              <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-4 tracking-tight">
                NEBULA RUN
              </h1>
              <p className="text-gray-300 mb-8 text-lg">
                Tap or Space to fly. Evolve your form to survive.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm text-gray-400 bg-white/5 p-3 rounded-lg">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span>Stage 1: Heavy, Slow</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400 bg-white/5 p-3 rounded-lg">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span>Stage 2: Balanced, Fast</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400 bg-white/5 p-3 rounded-lg">
                  <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                  <span>Stage 3: Hyper-speed, Twitchy</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-400 bg-white/5 p-3 rounded-lg">
                   <div className="w-3 h-3 rounded-full border border-cyan-400"></div>
                   <span className="text-cyan-200">Shield: Invincibility</span>
                </div>
              </div>
              <button 
                onClick={() => {
                   // Request Fullscreen
                   try {
                     if (document.documentElement.requestFullscreen) {
                       document.documentElement.requestFullscreen();
                     } else if ((document.documentElement as any).webkitRequestFullscreen) {
                       (document.documentElement as any).webkitRequestFullscreen();
                     }
                   } catch (e) {
                     console.log("Fullscreen request failed", e);
                   }

                   resetGame();
                   initAudio();
                   setGameState(GameState.PLAYING);
                   // Reset time logic to avoid jump
                   lastTimeRef.current = performance.now();
                   accumulatorRef.current = 0;
                }}
                className="mt-8 px-8 py-3 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-transform active:scale-95 flex items-center justify-center gap-2 mx-auto"
              >
                <Play size={20} fill="black" /> START MISSION
              </button>
            </div>
          </div>
        )}

        {/* Game Over Screen */}
        {gameState === GameState.GAME_OVER && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md px-4 z-20">
            <div className="bg-[#0f172a] border border-white/10 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 via-purple-500 to-blue-500"></div>

              <h2 className="text-3xl font-bold text-white mb-2">CRITICAL FAILURE</h2>
              
              <div className="flex justify-center gap-8 my-6">
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-widest">Score</p>
                  <p className="text-4xl font-mono text-white">{score}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-widest">Best</p>
                  <div className="flex items-center justify-center gap-1 text-4xl font-mono text-yellow-500">
                    {score > highScore && score > 0 && <Trophy size={24} />}
                    {Math.max(score, highScore)}
                  </div>
                </div>
              </div>

              {/* <div className="bg-black/30 rounded-lg p-4 mb-8 text-left border border-white/5 min-h-[100px]">
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={14} className="text-purple-400" />
                  <span className="text-xs font-bold text-purple-400 uppercase">AI Mission Debrief</span>
                </div>
                {isDebriefLoading ? (
                   <div className="flex gap-1 items-center h-12 text-gray-500 text-sm">
                     <span className="animate-pulse">Analyzing black box data...</span>
                   </div>
                ) : (
                  <p className="text-gray-300 text-sm italic leading-relaxed">
                    "{debrief || "System malfunction. No data."}"
                  </p>
                )}
              </div> */}

              <div className="flex gap-4 w-full">
                <button 
                  onClick={() => {
                    resetGame();
                    setGameState(GameState.PLAYING);
                    lastTimeRef.current = performance.now();
                    accumulatorRef.current = 0;
                  }}
                  className="flex-1 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <RotateCcw size={18} /> RETRY
                </button>

                <button 
                  onClick={() => {
                    resetGame();
                    setGameState(GameState.START);
                  }}
                  className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <Home size={18} /> MENU
                </button>
              </div>
              
              {/* {!process.env.API_KEY && (
                 <div className="mt-4 flex items-center justify-center gap-2 text-xs text-yellow-600/80">
                   <AlertTriangle size={12} />
                   <span>Add API_KEY to env for AI Debriefs</span>
                 </div>
              )} */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Zap, Trophy, AlertTriangle, Volume2, VolumeX, Home, RotateCcw } from 'lucide-react';
import { GameState, EvolutionStage, Player, Obstacle, Particle, Vector, Collectible, CollectibleType } from '../types';
import { GRAVITY, JUMP_STRENGTH, GAME_SPEED_BASE, OBSTACLE_SPAWN_RATE, OBSTACLE_WIDTH, EVO_CONFIG, SHIELD_DURATION } from '../constants';
import { generateMissionDebrief } from '../services/geminiService';
import { initAudio, playJumpSound, playScoreSound, playCrashSound, playEvolveSound, playCollectSound, toggleMute, getMuteState } from '../services/audioService';
import { useGamePhysics } from '../hooks/useGamePhysics';

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
  const [debrief, setDebrief] = useState<string>(\"\");
  const [isDebriefLoading, setIsDebriefLoading] = useState(false);
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
  const trailRef = useRef<Vector[]>([]); // Store previous positions
  const frameCountRef = useRef(0);

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
    setIsDebriefLoading(true);
    const message = await generateMissionDebrief(scoreRef.current, playerRef.current.stage, cause);
    setDebrief(message);
    setIsDebriefLoading(false);
  };

  const { updatePhysics } = useGamePhysics(
    gameState,
    playerRef,
    obstaclesRef,
    particlesRef,
    trailRef,
    frameCountRef,
    scoreRef,
    setCurrentStage,
    spawnParticles,
    handleGameOver
  );

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
    trailRef.current = [];
    frameCountRef.current = 0;
    scoreRef.current = 0;
    shakeRef.current = 0;
    
    // Reset time accumulators slightly to avoid large jumps on restart
    lastTimeRef.current = 0;
    accumulatorRef.current = 0;

    setScore(0);
    setCurrentStage(EvolutionStage.PROTO);
    setDebrief(\"\");
  };

  // ... (rest of the component, truncated for brevity, but I should include the full file in the final call to be safe)
  // Wait, I must include the full file content. I will read it again to be sure.

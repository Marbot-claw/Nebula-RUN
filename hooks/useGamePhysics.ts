import { useRef } from 'react';
import { GameState, EvolutionStage, Player, Obstacle, Particle, Vector } from '../types';
import { GRAVITY, GAME_SPEED_BASE, EVO_CONFIG } from '../constants';
import { playEvolveSound } from '../services/audioService';

export const useGamePhysics = (
  gameState: GameState,
  playerRef: React.MutableRefObject<Player>,
  obstaclesRef: React.MutableRefObject<Obstacle[]>,
  particlesRef: React.MutableRefObject<Particle[]>,
  trailRef: React.MutableRefObject<Vector[]>,
  frameCountRef: React.MutableRefObject<number>,
  scoreRef: React.MutableRefObject<number>,
  setCurrentStage: (stage: EvolutionStage) => void,
  spawnParticles: (x: number, y: number, color: string, count: number) => void,
  handleGameOver: (cause: 'PIPE' | 'GROUND' | 'CEILING') => void
) => {
  const updatePhysics = (canvas: HTMLCanvasElement) => {
    if (gameState !== GameState.PLAYING) return;

    frameCountRef.current++;
    const player = playerRef.current;
    const config = EVO_CONFIG[player.stage];

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
      spawnParticles(canvas.width / 3, player.y, '#ffffff', 20);
    }

    // 2. Player Physics
    player.velocity += GRAVITY * config.gravityMod;
    player.y += player.velocity;
    player.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (player.velocity * 0.1)));

    if (player.y + player.radius > canvas.height) {
      handleGameOver('GROUND');
      return;
    }
    if (player.y - player.radius < 0) {
      handleGameOver('CEILING');
      return;
    }

    // 3. Obstacle & Collectible Management
    const effectiveSpeed = GAME_SPEED_BASE * config.speedMod;
    for (let i = 0; i < trailRef.current.length; i++) {
        trailRef.current[i].x -= effectiveSpeed;
    }
    trailRef.current.unshift({ x: canvas.width / 3, y: player.y });
    
    const maxTrailLength = player.stage === EvolutionStage.TURBO ? 40 : (player.stage === EvolutionStage.AERO ? 30 : 20);
    if (trailRef.current.length > maxTrailLength) {
        trailRef.current.pop();
    }
  };

  return { updatePhysics };
};

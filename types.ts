export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER'
}

export enum EvolutionStage {
  PROTO = 'PROTO',
  AERO = 'AERO',
  TURBO = 'TURBO'
}

export enum CollectibleType {
  SHIELD = 'SHIELD'
}

export interface Vector {
  x: number;
  y: number;
}

export interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface Obstacle {
  id: number;
  x: number;
  width: number;
  gapTop: number;
  gapSize: number;
  passed: boolean;
  isMoving: boolean;
  moveSpeedY: number;
  initialGapTop: number;
}

export interface Collectible {
  id: number;
  x: number;
  y: number;
  type: CollectibleType;
  radius: number;
  collected: boolean;
}

export interface Player {
  y: number;
  velocity: number;
  radius: number;
  rotation: number;
  stage: EvolutionStage;
  invincibleUntil: number;
}
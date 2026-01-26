import { EvolutionStage } from './types';

export const GRAVITY = 0.4;
export const JUMP_STRENGTH = -7;
export const GAME_SPEED_BASE = 3;
export const OBSTACLE_WIDTH = 60;
export const OBSTACLE_SPAWN_RATE = 100; // Frames

export const SHIELD_DURATION = 5000; // ms

// Evolution Configurations
export const EVO_CONFIG = {
  [EvolutionStage.PROTO]: {
    color: '#3b82f6', // Blue
    gravityMod: 1.2, // Heavy
    jumpMod: 0.9,    // Weak jump
    speedMod: 1.0,
    radius: 15,
    threshold: 0,
    name: 'Proto-Blob'
  },
  [EvolutionStage.AERO]: {
    color: '#10b981', // Emerald
    gravityMod: 1.0, // Normal
    jumpMod: 1.0,    // Normal
    speedMod: 1.2,   // Faster
    radius: 18,
    threshold: 5,
    name: 'Aero-Bot'
  },
  [EvolutionStage.TURBO]: {
    color: '#f43f5e', // Rose
    gravityMod: 1.5, // Heavy gravity
    jumpMod: 1.3,    // Powerful thrusters
    speedMod: 1.6,   // Very fast
    radius: 12,      // Streamlined
    threshold: 15,
    name: 'Turbo-Jet'
  }
};
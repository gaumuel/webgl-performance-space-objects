import { createWorld, defineComponent, Types } from 'bitecs';

// Components
export const Position = defineComponent({
  x: Types.f32,
  y: Types.f32,
  z: Types.f32 // For 2.5D depth
});

export const Velocity = defineComponent({
  x: Types.f32,
  y: Types.f32
});

export const Sprite = defineComponent({
  type: Types.ui8, // 0: Player, 1: Bullet, 2: Enemy (Square), 3: Enemy (Circle), 4: Enemy (Triangle)
  size: Types.f32,
  colorR: Types.f32,
  colorG: Types.f32,
  colorB: Types.f32
});

export const Player = defineComponent({
  health: Types.f32,
  fireRate: Types.f32,
  lastFire: Types.f32,
  damage: Types.f32
});

export const Enemy = defineComponent({
  health: Types.f32,
  speed: Types.f32,
  damage: Types.f32
});

export const Bullet = defineComponent({
  damage: Types.f32
});

export const PlayerBase = defineComponent({
  health: Types.f32,
  maxHealth: Types.f32
});

export const EnemyBase = defineComponent({
  health: Types.f32,
  maxHealth: Types.f32
});

export const GridDot = defineComponent({});

export const world = createWorld({ maxEntities: 20000 });

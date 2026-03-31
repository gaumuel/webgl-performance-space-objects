import { defineQuery, addEntity, addComponent, removeEntity } from 'bitecs';
import { Position, Velocity, Sprite, Player, Enemy, Bullet, PlayerBase, EnemyBase, GridDot, world } from './components';
import { SpatialGrid } from '../engine/spatial';

// Queries
export const playerQuery = defineQuery([Player, Position]);
export const enemyQuery = defineQuery([Enemy, Position]);
export const bulletQuery = defineQuery([Bullet, Position]);
export const playerBaseQuery = defineQuery([PlayerBase, Position]);
export const enemyBaseQuery = defineQuery([EnemyBase, Position]);
export const gridQuery = defineQuery([GridDot, Position]);
export const renderQuery = defineQuery([Position, Sprite]);

// Systems
export const playerMovementSystem = (dt: number, keys: Set<string>, viewportWidth: number, viewportHeight: number) => {
  const players = playerQuery(world);
  for (let i = 0; i < players.length; i++) {
    const eid = players[i];
    const speed = 300;
    let vx = 0;
    let vy = 0;

    if (keys.has('w') || keys.has('ArrowUp')) vy += 1;
    if (keys.has('s') || keys.has('ArrowDown')) vy -= 1;
    if (keys.has('a') || keys.has('ArrowLeft')) vx -= 1;
    if (keys.has('d') || keys.has('ArrowRight')) vx += 1;

    // Normalize
    if (vx !== 0 || vy !== 0) {
      const mag = Math.sqrt(vx * vx + vy * vy);
      Velocity.x[eid] = (vx / mag) * speed;
      Velocity.y[eid] = (vy / mag) * speed;
    } else {
      Velocity.x[eid] = 0;
      Velocity.y[eid] = 0;
    }

    Position.x[eid] += Velocity.x[eid] * dt;
    Position.y[eid] += Velocity.y[eid] * dt;

    // Clamp to screen bounds
    const halfW = viewportWidth / 2;
    const halfH = viewportHeight / 2;
    const size = Sprite.size[eid] / 2;
    if (Position.x[eid] < -halfW + size) Position.x[eid] = -halfW + size;
    if (Position.x[eid] > halfW - size) Position.x[eid] = halfW - size;
    if (Position.y[eid] < -halfH + size) Position.y[eid] = -halfH + size;
    if (Position.y[eid] > halfH - size) Position.y[eid] = halfH - size;
  }
};

const velocityQuery = defineQuery([Position, Velocity]);

export const movementSystem = (dt: number) => {
  const ents = velocityQuery(world);
  const players = playerQuery(world);
  const pEid = players.length > 0 ? players[0] : -1;

  for (let i = 0; i < ents.length; i++) {
    const eid = ents[i];
    if (eid === pEid) continue; // Player movement handled separately
    Position.x[eid] += Velocity.x[eid] * dt;
    Position.y[eid] += Velocity.y[eid] * dt;
  }
};

const enemiesToRemove: number[] = [];

export const enemySystem = (dt: number, maxEnemies: number, viewportWidth: number, viewportHeight: number, score: number) => {
  const enemies = enemyQuery(world);
  const enemyBases = enemyBaseQuery(world);
  const playerBases = playerBaseQuery(world);
  
  if (enemyBases.length === 0 || playerBases.length === 0) return;

  const ebEid = enemyBases[0];
  const pbEid = playerBases[0];

  // Delay spawning until player has killed the first target or has some score
  if (score === 0 && enemies.length > 0) return;

  // Spawn enemies around the enemy base up to maxEnemies
  // We spawn a few per frame to avoid massive lag spikes if the slider is suddenly increased
  const spawnCount = Math.min(50, maxEnemies - enemies.length);
  
  for (let i = 0; i < spawnCount; i++) {
    const eid = addEntity(world);
    addComponent(world, Enemy, eid);
    addComponent(world, Position, eid);
    addComponent(world, Sprite, eid);
    addComponent(world, Velocity, eid);

    const spawnRadius = Sprite.size[ebEid] / 2 + 20;
    const angle = Math.random() * Math.PI * 2;
    
    const x = Position.x[ebEid] + Math.cos(angle) * spawnRadius;
    const y = Position.y[ebEid] + Math.sin(angle) * spawnRadius;

    Position.x[eid] = x;
    Position.y[eid] = y;
    Position.z[eid] = 20; // Float above grid

    // Target player base or player
    const players = playerQuery(world);
    let targetX = Position.x[pbEid];
    let targetY = Position.y[pbEid];

    // 30% chance to target player instead of base if player is alive
    // To avoid jittering every frame, we use the entity ID to deterministically pick a target
    if (players.length > 0 && (eid % 10) < 3) {
      targetX = Position.x[players[0]];
      targetY = Position.y[players[0]];
    }

    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = 50 + Math.random() * 100;
    
    if (dist > 0) {
      Velocity.x[eid] = (dx / dist) * speed;
      Velocity.y[eid] = (dy / dist) * speed;
    } else {
      Velocity.x[eid] = speed;
      Velocity.y[eid] = 0;
    }

    Enemy.health[eid] = 10 + Math.random() * 20;
    Enemy.speed[eid] = speed;
    Enemy.damage[eid] = 10;

    Sprite.type[eid] = 3 + Math.floor(Math.random() * 4); // 3: Cube, 4: Pyramid, 5: Shaded Circle, 6: Diamond
    Sprite.size[eid] = 20 + Math.random() * 30;
    Sprite.colorR[eid] = 0.8 + Math.random() * 0.2;
    Sprite.colorG[eid] = 0.2 + Math.random() * 0.3;
    Sprite.colorB[eid] = 0.2 + Math.random() * 0.3;
  }

  // Despawn very far away enemies (outside viewport)
  const halfW = viewportWidth / 2 + 100;
  const halfH = viewportHeight / 2 + 100;
  enemiesToRemove.length = 0;
  for (let i = 0; i < enemies.length; i++) {
    const eid = enemies[i];
    if (Position.x[eid] < -halfW || Position.x[eid] > halfW || Position.y[eid] < -halfH || Position.y[eid] > halfH) {
      enemiesToRemove.push(eid);
    }
  }
  for (let i = 0; i < enemiesToRemove.length; i++) {
    removeEntity(world, enemiesToRemove[i]);
  }
};

const collidedEntitiesToRemove: number[] = [];

export const collisionSystem = (grid: SpatialGrid, onPlayerDamage: (dmg: number) => void, onBaseDamage: (dmg: number, isPlayerBase: boolean) => void) => {
  const bullets = bulletQuery(world);
  const enemies = enemyQuery(world);
  const players = playerQuery(world);
  const playerBases = playerBaseQuery(world);
  const enemyBases = enemyBaseQuery(world);

  grid.clear();
  for (let i = 0; i < enemies.length; i++) {
    const eid = enemies[i];
    grid.insert(eid, Position.x[eid], Position.y[eid]);
  }

  collidedEntitiesToRemove.length = 0;

  // Bullet vs Enemy and EnemyBase
  for (let i = 0; i < bullets.length; i++) {
    const bEid = bullets[i];
    let bulletRemoved = false;

    // Check EnemyBase
    if (enemyBases.length > 0) {
      const ebEid = enemyBases[0];
      const dx = Position.x[bEid] - Position.x[ebEid];
      const dy = Position.y[bEid] - Position.y[ebEid];
      const distSq = dx * dx + dy * dy;
      const radius = Sprite.size[ebEid] / 2;
      if (distSq < radius * radius) {
        onBaseDamage(Bullet.damage[bEid], false);
        collidedEntitiesToRemove.push(bEid);
        bulletRemoved = true;
        continue;
      }
    }

    if (bulletRemoved) continue;

    const nearby = grid.query(Position.x[bEid], Position.y[bEid], 50);
    for (let j = 0; j < nearby.length; j++) {
      const eEid = nearby[j];
      // Skip if enemy is already marked for removal
      if (Enemy.health[eEid] <= 0) continue;

      const dx = Position.x[bEid] - Position.x[eEid];
      const dy = Position.y[bEid] - Position.y[eEid];
      const distSq = dx * dx + dy * dy;
      const radius = Sprite.size[eEid] / 2;
      
      if (distSq < radius * radius) {
        Enemy.health[eEid] -= Bullet.damage[bEid];
        collidedEntitiesToRemove.push(bEid);
        if (Enemy.health[eEid] <= 0) {
          collidedEntitiesToRemove.push(eEid);
        }
        break;
      }
    }
  }

  // Enemy vs Player and PlayerBase
  for (let i = 0; i < enemies.length; i++) {
    const eEid = enemies[i];
    if (Enemy.health[eEid] <= 0) continue; // Skip dead enemies

    let enemyRemoved = false;

    // Check PlayerBase
    if (playerBases.length > 0) {
      const pbEid = playerBases[0];
      const dx = Position.x[eEid] - Position.x[pbEid];
      const dy = Position.y[eEid] - Position.y[pbEid];
      const distSq = dx * dx + dy * dy;
      const radius = (Sprite.size[eEid] + Sprite.size[pbEid]) / 2;
      if (distSq < radius * radius) {
        onBaseDamage(Enemy.damage[eEid], true);
        collidedEntitiesToRemove.push(eEid);
        Enemy.health[eEid] = 0; // Mark as dead
        enemyRemoved = true;
        continue;
      }
    }

    if (enemyRemoved) continue;

    for (let j = 0; j < players.length; j++) {
      const pEid = players[j];
      const dx = Position.x[pEid] - Position.x[eEid];
      const dy = Position.y[pEid] - Position.y[eEid];
      const distSq = dx * dx + dy * dy;
      const radius = (Sprite.size[pEid] + Sprite.size[eEid]) / 2;

      if (distSq < radius * radius) {
        onPlayerDamage(Enemy.damage[eEid]);
        collidedEntitiesToRemove.push(eEid);
        Enemy.health[eEid] = 0; // Mark as dead
        break;
      }
    }
  }

  // Perform removals at the end
  for (let i = 0; i < collidedEntitiesToRemove.length; i++) {
    removeEntity(world, collidedEntitiesToRemove[i]);
  }
};

const bulletsToRemove: number[] = [];

export const shootingSystem = (dt: number, time: number, worldMouseX: number, worldMouseY: number, keys: Set<string>, viewportWidth: number, viewportHeight: number) => {
  const players = playerQuery(world);
  
  let playerX = 0;
  let playerY = 0;

  for (let i = 0; i < players.length; i++) {
    const eid = players[i];
    playerX = Position.x[eid];
    playerY = Position.y[eid];
    const fireInterval = 1 / Player.fireRate[eid];

    if (keys.has(' ')) {
      // Prevent huge bursts if we haven't fired in a while (e.g. paused or lag spike)
      const maxBurstTime = Math.max(0.1, fireInterval * 2);
      if (time - Player.lastFire[eid] > maxBurstTime) {
        Player.lastFire[eid] = time - maxBurstTime;
      }

      let bulletsSpawned = 0;
      while (time - Player.lastFire[eid] >= fireInterval && bulletsSpawned < 100) {
        const bEid = addEntity(world);
        addComponent(world, Bullet, bEid);
        addComponent(world, Position, bEid);
        addComponent(world, Velocity, bEid);
        addComponent(world, Sprite, bEid);

        const angle = Math.atan2(worldMouseY - Position.y[eid], worldMouseX - Position.x[eid]);
        
        // Calculate exact time this bullet should have been fired
        const bulletTime = Player.lastFire[eid] + fireInterval;
        const timeAlive = time - bulletTime;

        const speed = 800;
        // Add slight spread based on fire rate to make it look like a stream instead of a solid line
        const spread = (Player.fireRate[eid] > 50) ? (Math.random() - 0.5) * 0.15 : 0;
        const finalAngle = angle + spread;

        Velocity.x[bEid] = Math.cos(finalAngle) * speed;
        Velocity.y[bEid] = Math.sin(finalAngle) * speed;

        // Advance position based on how long ago it should have fired
        Position.x[bEid] = Position.x[eid] + Velocity.x[bEid] * timeAlive;
        Position.y[bEid] = Position.y[eid] + Velocity.y[bEid] * timeAlive;
        Position.z[bEid] = 20; // Float above grid

        Bullet.damage[bEid] = Player.damage[eid];
        
        Sprite.type[bEid] = 1; // Circle
        Sprite.size[bEid] = 8;
        Sprite.colorR[bEid] = 1.0;
        Sprite.colorG[bEid] = 0.8;
        Sprite.colorB[bEid] = 0.0;

        Player.lastFire[eid] += fireInterval;
        bulletsSpawned++;
      }
    } else {
      // Reset lastFire so the next press fires immediately, allowing fast tapping
      Player.lastFire[eid] = time - fireInterval;
    }
  }

  // Despawn bullets that are too far away from the player
  const bullets = bulletQuery(world);
  bulletsToRemove.length = 0;
  // Increase range to cover the entire game world (viewportWidth is already 2x canvas width)
  const maxDistX = viewportWidth;
  const maxDistY = viewportHeight;

  for (let i = 0; i < bullets.length; i++) {
    const bEid = bullets[i];
    if (Math.abs(Position.x[bEid] - playerX) > maxDistX || Math.abs(Position.y[bEid] - playerY) > maxDistY) {
      bulletsToRemove.push(bEid);
    }
  }
  for (let i = 0; i < bulletsToRemove.length; i++) {
    removeEntity(world, bulletsToRemove[i]);
  }
};

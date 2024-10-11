'use strict';

const cityRadius = 3;
const frameStep = 25;

class Player {
  constructor(ix, population) {
    this.ix = ix;
    this.label = ix ? "Right" : "Left";
    this.population = population;
    this.soldiers = population;
    this.old_a = 45;
    this.old_v = 100;
    this.old_da = 5;
    this.old_dv = 5;
  }

  setupBattle() {
    this.base_x = this.ix
      ? Math.floor(80 + Math.random() * 30)
      : Math.floor(10 + Math.random() * 20);

    this.city_x = this.ix
      ? 126
      : 4;

    this.soldiers = Math.min(100, this.population);
  }

  shotsAvailable() {
    if (this.soldiers <= 5) return 0;
    return Math.floor(this.soldiers / 35) + 1;
  }

  penalty(n) {
    this.soldiers -= n;
    this.population -= n;

    if (this.soldiers < 0) this.soldiers = 0;
    if (this.population < 0) this.population = 0;

    if (this.population < this.soldiers)
      this.soldiers = this.population;
  }

  hitNear(playerIx, x, y) {
    // Would be better with a velocity (K.E) element.
    const d9 = Math.abs(x - this.base_x);
    if (d9 > 8) return false;

    const casualties = Math.floor(this.soldiers / (1.5 * d9));
    this.penalty(casualties);

    return casualties;
  }

  hitBase(playerIx, x, y) {
    const dx = Math.abs(this.base_x - x);
    if (dx > 1) return false;

    const casualties = this.soldiers;

    this.population -= casualties;
    this.soldiers = 0;

    return casualties;
  }

  hitTown(playerIx, x, y) {
    const dx = Math.abs(this.city_x - x);
    if (dx > cityRadius) return false;

    const penalty = 10 + Math.random() * 5;
    this.penalty(penalty);
    return penalty;
  }
}

let players = [];
let us, them;

let wind, playerIx, terrain, projectilePaths;

const PP = canvas_width / 130;
const ZZ = canvas_height / 100;

function startWar() {
  document.getElementById('start').style.display = 'none';
  setArmySizes();
  startBattle();
}

function setWind() {
  do {
    wind = Math.random() * 100 - 50;
  } while (Math.round(wind) === 0);
}

function updateWind() {
  let wind3;
  do {
    wind3 = wind + Math.random() - 0.5;
  } while (Math.abs(wind3) > 50);
  wind = wind3;
}

function startBattle() {

  playerIx = (Math.floor(players[0].population) == Math.floor(players[1].population))
    ? (Math.random() >= 0.5 ? 0 : 1)
    : players[0].population < players[1].population
      ? 0
      : 1;

  us = players[playerIx];
  them = players[1 - playerIx];

  us.setupBattle();
  them.setupBattle();

  projectilePaths = [];

  terrain = generateTerrain();
  setWind();

  setTimeout(gameLoop, 1000); // Delay to allow players to view the terrain
}

async function gameLoop() {
  await drawScene();

  if (!gameOver()) {
    let params = promptForInput();
    const battleOver = await fireBarrage(params);
    console.log(`gameLoop:`, { battleOver });
    if (battleOver) {
      endGame();
    }
    else {
      //      displayTurnInfo();
      setTimeout(nextPlayerUp, 1000);
    }
  } else {
    endGame();
  }
}

function setArmySizes() {
  let size;
  do {
    size = 1000;
    // size = parseInt(prompt(`Size of ${i === 0 ? 'left' : 'right'} army:`));
  } while (isNaN(size) || size <= 0);

  players = [
    new Player(0, size),
    new Player(1, size)
  ];
}

function promptForInput() {
  const currentPlayer = us.label;
  let angle, velocity;
  let m;
  do {
    let input = prompt(`${currentPlayer} BASE ANG,VEL (${us.old_a},${us.old_v})?`);
    m = input.match(/(-?\d+)\D+(-?\d+)/);
  } while (!m);

  angle = parseInt(m[1]);
  velocity = parseInt(m[2]);

  let deltaAng = 0, deltaVel = 0;

  // Adjust delta based on number of survivors
  const shots = players[playerIx].shotsAvailable();
  if (shots > 1) {
    do {
      let input = prompt(`${currentPlayer} DELTA ANG,VEL (${us.old_da},${us.old_dv}) ?`);
      if (input === '') input = `${us.old_da},${us.old_dv}`;
      m = input.match(/(-?\d+)\D+(-?\d+)/);
    } while (!m);

    deltaAng = parseInt(m[1]);
    deltaVel = parseInt(m[2]);
  }

  return { angle, velocity, deltaAng, deltaVel, shots };
}

async function fireBarrage({ angle, velocity, deltaAng, deltaVel, shots }) {
  projectilePaths = [];
  us.old_a = angle;
  us.old_v = velocity;
  us.old_da = deltaAng;
  us.old_dv = deltaVel;

  return new Promise(async (resolve, reject) => {

    for (let shot = 0; shot < shots; shot++) {
      projectilePaths[shot] = [];

      let a = angle, v = velocity;
      switch (shot) {
        case 1: a += deltaAng; v += deltaVel / 10; break;
        case 2: a -= deltaAng; v -= deltaVel / 10; break;
      }

      await fireProjectile({ shot, angle: a, velocity: v });

      if (isBattleOver())
        return resolve(true);
    }

    return resolve(false);
  });
}

function fireProjectile({ shot, angle, velocity }) {

  return new Promise((resolve, reject) => {

    console.log({ angle, velocity });

    const x1 = us.base_x;
    const y1 = terrain[x1];
    let x = x1;
    let y = y1;
    let t = 0;
    let v1 = (playerIx ? -1 : 1) * Math.cos(angle * Math.PI / 180) * velocity / 10;
    let v2 = Math.sin(angle * Math.PI / 180) * velocity / 10;

    projectilePaths[shot] = [{ x, y }]; // Reset projectile path

    const animateProjectile = async () => {

      t += 0.3;
      if (t > 200)
        return resolve(false);

      updateWind();

      // Apply wind effect to horizontal velocity
      v1 += (v1 + wind) / 1500;
      x = x1 + (v1 + wind / 50) * t;
      const X = Math.round(x);

      if (x < 0.5 || x > 130) {
        playOutOfBoundsSound();
        return resolve(true);
      }

      y = y1 + (v2 - t / 2.5) * t;

      if (y < terrain[X]) y = terrain[X];

      projectilePaths[shot].push({ x, y }); // Add current position to path

      if (y - terrain[X] >= 1) {
        await drawScene();
        playProjectileSound(y);
        setTimeout(() => requestAnimationFrame(animateProjectile), frameStep);
        return; // loop!
      }

      terrain[X - 3] -= 1;
      terrain[X - 2] -= 2;
      terrain[X - 1] -= 3.5;
      terrain[X] -= 4;
      terrain[X + 1] -= 3.5;
      terrain[X + 2] -= 2;
      terrain[X + 3] -= 1;
      await drawScene();

      const d9 = Math.abs(x - them.base_x);

      let casualties;
      if (false !== (casualties = us.hitBase(playerIx, x, y))) {
        alert(`${us.label} base destroyed!`);
        playDirectHitSound();
        return resolve(true);
      }

      if (false !== (casualties = them.hitBase(playerIx, x, y))) {
        alert(`${them.label} base destroyed!`);
        playDirectHitSound();
        return resolve(true);
      }

      if (false !== (casualties = us.hitTown(playerIx, x, y))) {
        alert(`${us.label} city hit... ${casualties} casualties`);
        playCityHitSound();
        return resolve(true);
      }

      if (false !== (casualties = them.hitTown(playerIx, x, y))) {
        alert(`${them.label} city hit... casualties; ${casualties} penalty!`);
        us.penalty(casualties);
        playCityHitSound();
        return resolve(true);
      }

      if (false !== (casualties = us.hitNear(playerIx, x, y))) {
        alert(`Near miss! ${casualties} casualties.`);
        playMissSound();
        return resolve(true);
      }

      if (false !== (casualties = them.hitNear(playerIx, x, y))) {
        alert(`Near miss! ${casualties} casualties.`);
        playMissSound();
        return resolve(true);
      }

      return resolve(false);
    }

    animateProjectile();
  });
}

function nextPlayerUp() {
  them = players[playerIx];
  playerIx = 1 - playerIx;
  us = players[playerIx];
  gameLoop();
}

function isBattleOver() {
  if (them.population <= 5) {
    alert(`${them.label} base destroyed!`);
    return true;
  }

  if (them.army <= 0) {
    alert(`${them.label} city destroyed!`);
    return true;
  }

  if (us.population <= 5) {
    alert(`${us.label} base destroyed!`);
    return true;
  }

  if (us.army <= 0) {
    alert(`${us.label} city destroyed!`);
    return true;
  }

  return false;
}

function gameOver() {
  return us.army <= 0 || them.army <= 0;
}

function endGame() {
  const winner = us.army > them.army ? us.label : them.label;
  alert(`Game Over! ${winner} army wins!`);
}

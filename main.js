'use strict';

const frameStep = 50;

// This will fix it to a mode where "45,68" followed by "0,2" will win.
const testing = false;
const random1 = () => testing ? 0.5 : Math.random();
const random2 = () => testing ? 0.75 : Math.random();
const random3 = () => testing ? 0.25 : Math.random();


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
      ? Math.floor(80 + random1() * 30)
      : Math.floor(10 + random1() * 20);

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
    const d8 = Math.abs(x - this.base_x);
    if (d8 > 8) return false;

    const d9 = Math.floor(this.soldiers / (1.5 * Math.abs(x - this.base_x)));
    const casualties = d8 < 1 ? this.soldiers : d9;
    this.penalty(casualties);
    return casualties;
  }

  hitTown(playerIx, x, y) {
    const dx = Math.abs(this.city_x - x);
    if (dx > 3) return false;

    const penalty = Math.floor(10 + random2() * 5);
    this.penalty(penalty);
    return penalty;
  }
}

let players = [];
let us, them;

let wind, playerIx, terrain;

async function startWar() {
  document.getElementById('start').style.display = 'none';
  await setArmySizes();
  startBattle();
}


function setWind() {
  do {
    wind = random1() * 100 - 50;
  } while (!testing && Math.round(wind) === 0);
}

function updateWind() {
  let wind3;
  do {
    wind3 = wind + random1() - 0.5;
  } while (Math.abs(wind3) > 50);
  wind = wind3;
}

function startBattle() {

  playerIx = (Math.floor(players[0].population) == Math.floor(players[1].population))
    ? (random1() >= 0.5 ? 0 : 1)
    : players[0].population < players[1].population
      ? 0
      : 1;

  us = players[playerIx];
  them = players[1 - playerIx];

  us.setupBattle();
  them.setupBattle();

  terrain = generateTerrain();
  setWind();
  nextPlayerUp();
}

async function gameLoop() {

  updateWind();
  const params = await playerInput();
  const battleOver = await fireBarrage(params);

  if (gameOver())
    setTimeout(endGame, 1000);
  else if (battleOver)
    setTimeout(endBattle, 1000);
  else
    setTimeout(nextPlayerUp, 1000);
}

function gameOver() {
  return us.population <= 0 || them.population <= 0;
}

function battleLoser() {
  if (them.population <= 0)
    return them;
  if (them.soldiers <= 0)
    return them;
  if (us.population <= 0)
    return us;
  if (us.soldiers <= 0)
    return us;

  return false;
}

async function endGame() {
  let str;
  if (us.population === them.population)
    str = `MUTUALLY ASSURED DESTRUCTION`;
  else if (us.population < them.population)
    str = `${us.label.toUpperCase()} ARMY ANNIHILATED`;
  else
    str = `${them.label.toUpperCase()} ARMY ANNIHILATED`;
  endScreen(str);

  setTimeout(async () => {
    centerMessage(``);
    centerMessage(``);
    centerMessage(`ANOTHER WAR?`);

    await new Promise(resolve => {
      const onkeydown = (e) => {
        window.removeEventListener('keydown', onkeydown);
        resolve();
      };
      window.addEventListener('keydown', onkeydown);
    });

    await startWar();
  }, 1000);
}

async function endBattle() {
  message(``);
  message(`      ARMY SURVIVORS - LEFT = ${players[0].population}`);
  message(`                       RIGHT= ${players[1].population}`);

  await new Promise(resolve => {
    const onkeydown = (e) => {
      window.removeEventListener('keydown', onkeydown);
      resolve();
    };
    window.addEventListener('keydown', onkeydown);
  });

  startBattle();
}

function nextPlayerUp() {
  them = players[playerIx];
  playerIx = 1 - playerIx;
  us = players[playerIx];

  drawScene(true);
  setTimeout(gameLoop, 1000);
}

async function setArmySizes() {
  G.clear();

  const defaultSize = '300,300';
  let m;
  do {
    let input = await inputPrompt(`Size of armies (${defaultSize})? `, 2,5);
    if (input === '') input = defaultSize;
    m = input.match(/(\d+)\D+(\d+)/);
  } while (!m);

  players = [
    new Player(0, parseInt(m[1])),
    new Player(1, parseInt(m[2]))
  ];

  console.log(players);
}

async function inputPrompt(prompt, x = 0, y = 0) {
  message(prompt, x, y);

  const buf = await new Promise((resolve) => {
    let buf = "";
    let obuf = "";
    const onkeydown = (e) => {
      obuf = buf;
      if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', ','].includes(e.key))
        buf += e.key;
      else if (['Delete', 'Backspace'].includes(e.key))
        buf = buf.slice(0, -1);
      else if ('Enter' === e.key) {
        window.removeEventListener('keydown', onkeydown);
        resolve(buf);
      }
      else {
        buf = obuf;
        return;
      }
      if (buf.length < obuf.length)
        message(prompt + buf + (" ".repeat(obuf.length - buf.length)), x, y);
      else
        message(prompt + buf, x, y);

      G.commit();
    };
    window.addEventListener('keydown', onkeydown);
  });

  return buf;
}

async function playerInput() {

  G.clearTextArea(0, 0, 40, 2);

  const currentPlayer = us.label.toUpperCase();
  let angle, velocity;
  let m;
  do {
    let input = await inputPrompt(`${currentPlayer} BASE ANG,VEL (${us.old_a},${us.old_v})?`, 0, 0);
    if (input === '') input = `${us.old_a},${us.old_v}`;
    m = input.match(/(-?\d+)\D+(-?\d+)/);
  } while (!m);

  angle = parseInt(m[1]);
  velocity = parseInt(m[2]);

  let deltaAng = 0, deltaVel = 0;

  // Adjust delta based on number of survivors
  const shots = players[playerIx].shotsAvailable();
  if (shots > 1) {
    do {
      let input = await inputPrompt(`ENTER DELTA ANG,VEL=?`, 0, 1);
      if (input === '') input = `${us.old_da ?? 0},${us.old_dv ?? 0}`;
      m = input.match(/(-?\d+)\D+(-?\d+)/);
    } while (!m);

    deltaAng = parseInt(m[1]);
    deltaVel = parseInt(m[2]);
  }

  return { angle, velocity, deltaAng, deltaVel, shots };
}

async function fireBarrage({ angle, velocity, deltaAng, deltaVel, shots }) {
  us.old_a = angle;
  us.old_v = velocity;
  us.old_da = deltaAng;
  us.old_dv = deltaVel;

  G.setTextOrigin(5);

  // Big and small blind
  us.penalty(1);
  them.penalty(1);

  return new Promise(async resolveBarrage => {
    for (let shot = 0; shot < shots; shot++) {
      let a = angle, v = velocity;
      switch (shot) {
        case 1: a += deltaAng; v += deltaVel / 10; break;
        case 2: a -= deltaAng; v -= deltaVel / 10; break;
      }
      drawBasesAndCities();

      projectileSounder.play();
      await fireProjectile({ shot, angle: a, velocity: v });
      await sleep(250);

      if (battleLoser())
        return resolveBarrage(true); // Battle over
    }

    return resolveBarrage(false); // Battle not over; next player's turn
  });
}

async function fireProjectile({ shot, angle, velocity }) {

  const x1 = us.base_x;
  const y1 = terrain[x1];
  let x = x1;
  let y = y1;
  let t = 0;
  let v1 = (playerIx ? -1 : 1) * Math.cos(angle * Math.PI / 180) * velocity / 10;
  let v2 = Math.sin(angle * Math.PI / 180) * velocity / 10;
  let s = 200;
  let ox = x;
  let oy = y;
  let X = Math.round(x);

  const shotImpacted = await new Promise(async resolveShot => {
    const run = async () => {
      t += 0.3;
      if (s < 0) {
        resolveShot(false); // fizzle
        return;
      }

      // Apply wind effect to horizontal velocity
      updateWind();
      v1 += (v1 + wind) / 1500;
      x = x1 + (v1 + wind / 50) * t;
      X = Math.round(x);

      if (x < 0.5 || x > 130) {
        playOutOfBoundsSound();
        await sleep(250);
        resolveShot(false); // no impact
        return;
      }

      y = y1 + (v2 - t / 2.5) * t;

      // If we hit the ground, locate it there.
      if (y <= terrain[X])
        y = terrain[X];

      drawProjectile(ox, oy, x, y);
      ox = x;
      oy = y;

      if (y > terrain[X]) {
        // loop!
        playProjectileSound(s--);
        setTimeout(() => requestAnimationFrame(run), frameStep);
        return;
      }

      resolveShot(true); // impact
      return;
    };

    await run();
  });

  projectileSounder.stop();

  let battleOver = false;

  if (shotImpacted) {
    battleOver = await handleImpact(x, y);

    if (x >= 10 && x <= 120) {
      // Modify the terrain
      terrain[X - 3] -= 1;
      terrain[X - 2] -= 2;
      terrain[X - 1] -= 3.5;
      terrain[X] -= 4;
      terrain[X + 1] -= 3.5;
      terrain[X + 2] -= 2;
      terrain[X + 3] -= 1;
    }
  }

  return battleOver; // If false, barrage continues
}

async function handleLoss(victim, x, y) {

  if (victim.soldiers <= 0) {
    drawExplosion(victim.base_x, terrain[victim.base_x], true);
    playDirectHitSound();
    await sleep(1000);
    return true;
  }

  if (victim.population <= 0) {
    drawExplosion(victim.city_x, terrain[victim.city_x], true);
    playDirectHitSound();
    await sleep(1000);
    return true;
  }

  return false;
}

async function handleImpact(x, y) {
  let casualties;

  if (false !== (casualties = us.hitNear(playerIx, x, y))) {
    if (!await handleLoss(us, x, y)) {
      drawExplosion(x, y, false);
      playNearSound();

      await sleep(250);
      centerMessage(`FRIENDLY FIRE - ${casualties} CASUALTIES`);
      await sleep(1000);
      return false; // Battle not over
    }
    return true; // Battle over
  }

  if (false !== (casualties = them.hitNear(playerIx, x, y))) {
    if (!await handleLoss(them, x, y)) {
      drawExplosion(x, y, false);
      playNearSound();

      await sleep(250);
      centerMessage(`ENEMY HIT - ${casualties} CASUALTIES`);
      await sleep(1000);
      return false; // Battle not over
    }
    return true; // Battle over
  }

  if (false !== (casualties = us.hitTown(playerIx, x, y))) {
    if (!await handleLoss(us)) {
      drawExplosion(x, y, false);
      playCityHitSound();

      await sleep(250);
      centerMessage(`CIVILIANS KILLED - ${casualties} CASUALTIES`);
      await sleep(1000);

      return false; // Battle not over
    }
    return true; // Battle over
  }

  if (false !== (casualties = them.hitTown(playerIx, x, y))) {
    us.penalty(casualties);

    if (!await handleLoss(them)) {
      if (!await handleLoss(us)) {
        drawExplosion(x, y, false);
        playCityHitSound();

        await sleep(250);
        centerMessage(`CIVILIANS KILLED - PENALTY = ${casualties}`);
        await sleep(1000);
        return false; // Battle not over
      }
    }
    return true; // Battle over
  }

  if (!await handleLoss(us) && !await handleLoss(them)) {
    drawExplosion(x, y, false);
    playImpactSound();
    await sleep(250);
    return false; // Battle not over
  }
  return true; // Battle over
}

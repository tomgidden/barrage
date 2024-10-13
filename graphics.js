const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });

const canvasWidth = canvas.width;
const canvasHeight = canvas.height;
const xplotWidth = 130;
const yplotWidth = 100;
const xscale = canvas.width / xplotWidth;
const yscale = canvas.height / yplotWidth;
const flashiePeriod = 19 / 25 * 1000;

const G = new (class {
  constructor() {
    this.r = 255;
    this.g = 255;
    this.b = 255;
    this.mode = 0;//0; // 0: set, 1: OR, 2: AND, 3: XOR, 4: NOT, 5, NOP, 6, clear
    this.cy = 0;
    this.loadFramebuffer();

    this.flashies = [];
    this.flashieState = false;
    this.flashieTimeout = undefined;
  }

  redrawFlashies() {
    this.flashieTimeout = undefined;
    if (this.flashies?.length) {
      this.flashieState = !this.flashieState;
      this.flashies.forEach(f => f(this.flashieState));
      this.scheduleFlashies();
    }
  }

  scheduleFlashies() {
    if (this.flashieTimeout) clearRegisteredTimeout(this.flashieTimeout);
    this.flashieTimeout = setRegisteredTimeout(
      this.redrawFlashies.bind(this),
      flashiePeriod
    );
  }

  clearFlashies() {
    this.flashieTimeout = clearRegisteredTimeout(this.flashieTimeout);
    this.flashies = [];
  }

  addFlashie(f) {
    f(this.flashieState);
    this.flashies.push(f);
    this.scheduleFlashies();
  }

  col(mode, col) {
    this.mode = mode;
    this.r = (col & 1) ? 255 : 0;
    this.g = (col & 2) ? 255 : 0;
    this.b = (col & 4) ? 255 : 0;
  }

  loadFramebuffer() {
    this.fb = ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  commit() {
    ctx.putImageData(this.fb, 0, 0);
  }

  _plotPoint(x, y, clear) {

    const X = Math.floor(x);
    const Y = Math.floor(canvasHeight - y);
    if (isNaN(Y)) console.trace({ X, Y });
    if (X < 0 || X >= canvasWidth || Y < 0 || Y >= canvasHeight)
      return;

    const I = 4 * (X + Y * canvasWidth);

    if (clear) {
      switch (this.mode) {
        case 0:
        case 4:
          this.fb.data[I + 0] = 0;
          this.fb.data[I + 1] = 0;
          this.fb.data[I + 2] = 0;
          break;
      }
    }
    else {
      switch (this.mode) {
        case 0:
          this.fb.data[I + 0] = this.r;
          this.fb.data[I + 1] = this.g;
          this.fb.data[I + 2] = this.b;
          break;

        case 1:
          this.fb.data[I + 0] |= this.r;
          this.fb.data[I + 1] |= this.g;
          this.fb.data[I + 2] |= this.b;
          break;

        case 2:
          this.fb.data[I + 0] &= this.r;
          this.fb.data[I + 1] &= this.g;
          this.fb.data[I + 2] &= this.b;
          break;

        case 3:
          this.fb.data[I + 0] ^= this.r;
          this.fb.data[I + 1] ^= this.g;
          this.fb.data[I + 2] ^= this.b;
          break;

        case 4:
          this.fb.data[I + 0] = 0;
          this.fb.data[I + 1] = 0;
          this.fb.data[I + 2] = 0;
          break;
      }
    }
  }

  plotPoint(x, y) {
    const X = Math.floor(x);
    const Y = Math.floor(y);
    this._plotPoint(X, Y);
  }

  plotLine(x1, y1, x2, y2) {
    x1 = Math.floor(x1);
    x2 = Math.floor(x2);
    y1 = Math.floor(y1);
    y2 = Math.floor(y2);

    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = (x1 < x2) ? 1 : -1;
    const sy = (y1 < y2) ? 1 : -1;
    let err = dx - dy;
    while (true) {
      this._plotPoint(x1, y1);
      if (x1 === x2 && y1 === y2) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x1 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y1 += sy;
      }
    }
  }

  plotChar(id, x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    const c = chrs[id] ?? chrs[127];
    for (let dy = 0; dy < 8; dy++) {
      let d = c[dy];
      for (let dx = 0; dx < 8; dx++) {
        this._plotPoint(x - dx + 7, y - dy, !(d & 1));
        d >>= 1;
      }
    }
  }

  plotText(str, x, y) {
    for (let i = 0; i < str.length; i++) {
      this.plotChar(str.charCodeAt(i), x, y);
      x += 8;
    }
  }

  printText(str, cx = 0, cy = undefined) {
    if (cy === undefined) cy = this.cy;
    this.plotText(str, 8 * cx, canvasHeight - 8 * cy);
    this.cy = cy + 1;
  }

  clear() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    this.loadFramebuffer();
    this.cy = 0;
    this.clearFlashies();
  }

  clearTextArea(cx, cy, cw, ch) {
    ctx.clearRect(8 * cx, 8 * cy, 8 * cw, 8 * ch);
    this.loadFramebuffer();
  }

  setTextOrigin(cy = 0) {
    this.cy = cy;
  }
})();

const drawTerrain = () => new Promise((resolve, reject) => {
  let i = 2;

  const render = () => {
    G.plotLine((i - 2) * xscale, terrain[i - 2] * yscale, (i - 1) * xscale, terrain[i - 1] * yscale);
    G.plotLine((i - 1) * xscale, terrain[i - 1] * yscale, (i) * xscale, terrain[i] * yscale);
    G.commit();
    if ((i += 2) < terrain.length)
      setRegisteredTimeout(render, 10);
    else
      resolve(true);
  };

  render();
});

const sleep = async delay => new Promise(resolve => setRegisteredTimeout(resolve, delay ?? 1000));

function message(str, cx = 0, cy = undefined) {
  G.printText(str, cx, cy);
  G.commit();
}

function centerMessage(str, cy = undefined) {
  message(str, Math.floor(20 - (str.length / 2)), cy);
}

function endScreen(str) {
  G.clear();
  centerMessage(str, 5);
  G.commit();
}

async function drawScene(clear = true) {
  if (clear) {
    G.clearFlashies();
    G.clear();
  }

  if (terrain?.length > 0) {
    await drawTerrain();
    drawBasesAndCities();
    drawWind();
    drawSurvivors();
    G.commit();
  }

  G.loadFramebuffer();
}

function drawExplosion(x0, y0, large) {
  const explosion = large
    ? [[10, 10], [-5, -3], [-1, 10], [-4, -8], [-4, 4], [1, -6], [-4, 2], [7, -9]]
    : [[2, 3], [-1.5, -0.5], [-1, 2.5], [0, -3], [-1, 0.5], [1.5, -2.5]];

  const draw = (x0, y0, alt) => {
    let x = x0 * xscale, y = y0 * yscale;
    G.mode = 0;
    G.col(0, alt ? 6 : 1);
    explosion.forEach(([x1, y1]) => G.plotLine(x, y, x += x1 * xscale, y += y1 * yscale));
    G.commit();
    G.col(0, 7);
  };

  G.addFlashie(alt => draw(x0, y0, alt));
}


function drawBasesAndCities() {
  G.col(0, 3);
  for (let player of [us, them]) {
    G.plotChar(238, Math.floor((player.city_x - 3) * xscale), (terrain[player.city_x] + 3) * yscale);
    G.plotChar(239, Math.floor((player.city_x - 3) * xscale) + 8, (terrain[player.city_x] + 3) * yscale);

    let c = player.ix == 0 ? 234 : 228;
    if ((player.old_a ?? 0) < 16) { }
    else if (player.old_a < 51) c += 1;
    else if (player.old_a < 71) c += 2;
    else c += 3;

    G.plotChar(c, (player.base_x - 2) * xscale, (terrain[player.base_x] + 3) * yscale);
  }
  G.col(0, 7);
}


function drawWind() {
  const windStrength = Math.abs(Math.round(wind));
  const str = `WIND ${windStrength}MPH    ${wind > 0 ? '--->' : '<---'}`;
  message(str, 0, 2);
}

function drawSurvivors() {
  message(`${players[0].soldiers}`, 1, 31);
  message('BATTLE SURVIVORS', 12, 31);
  message(`${players[1].soldiers}`, 36, 31);
}

function drawProjectile(ox, oy, x, y) {
  G.plotLine(ox * xscale, oy * yscale, x * xscale, y * yscale);
  G.commit();
}


function displayTurnInfo() {
  const currentPlayer = playerIx ? 'Right' : 'Left';
  ctx.fillStyle = 'white';
  ctx.font = font;
  let lh = 14;
  let y = 60 - lh;
  ctx.fillText(`${us.label} player's turn`, 10, y += lh);
  ctx.fillText(`Angle: ${us.old_a} (Δ ${us.old_da})`, 10, y += lh);
  ctx.fillText(`Velocity: ${us.old_v} (Δ ${us.old_dv})`, 10, y += lh);
  ctx.fillText(`Left City Population: ${players[0].population}`, 10, y += lh);
  ctx.fillText(`Right City Population: ${players[1].population}`, 10, y += lh);
}

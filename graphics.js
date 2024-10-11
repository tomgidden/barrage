const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const canvas_width = canvas.width;
const canvas_height = canvas.height;
const font = "12px monospace";

function drawTerrain() {
  ctx.beginPath();
  ctx.strokeStyle = 'white';

  ctx.moveTo(0, canvas_height - terrain[0] * ZZ);
  for (let i = 1; i < terrain.length; i++) {
    ctx.lineTo(i * PP, canvas_height - terrain[i] * ZZ);
  }
  ctx.stroke();
}

function drawScene() {
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas_width, canvas_height);

  if (terrain?.length > 0) {
    drawTerrain();
    drawBasesAndCities();
  }

  drawWind();
  drawSurvivors();
  drawProjectilePaths();
}

function drawBasesAndCities() {
  ctx.fillStyle = 'yellow';

  for (let player of [us, them]) {

    const cityWidth = 5 * PP;
    const cityHeight = 3 * ZZ;
    ctx.fillRect(
      player.city_x * PP - cityWidth / 2,
      canvas_height - terrain[player.city_x] * ZZ - cityHeight,
      cityWidth,
      cityHeight
    );

    // Draw base
    ctx.fillRect(
      player.base_x * PP - PP / 2,
      canvas_height - (terrain[player.base_x] + 2) * ZZ,
      PP,
      2 * ZZ
    );
  }
}

function drawWind() {
  const windStrength = Math.abs(Math.round(wind));
  const windDirection = wind > 0 ? '--->' : '<---';
  ctx.fillStyle = 'white';
  ctx.font = font;
  ctx.fillText(`WIND ${windStrength}MPH     ${windDirection}`, 10, 12);
}

function drawSurvivors() {
  ctx.fillStyle = 'white';
  ctx.font = font;
  ctx.fillText(`${players[0].soldiers}`, 10, canvas_height - 10);
  ctx.fillText('BATTLE SURVIVORS', canvas_width / 2 - 80, canvas_height - 10);
  ctx.fillText(`${players[1].soldiers}`, canvas_width - 40, canvas_height - 10);
}

function drawProjectilePaths() {

  const lastShot = projectilePaths.length - 1;

  for (const shot in projectilePaths) {
    const path = projectilePaths[shot];

    ctx.beginPath();
    ctx.strokeStyle = shot === lastShot ? 'white' : 'white';
    ctx.moveTo(path[0].x * PP, canvas_height - path[0].y * ZZ);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x * PP, canvas_height - path[i].y * ZZ);
    }
    ctx.stroke();
  }
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
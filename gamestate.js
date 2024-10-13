
// The player states. We'll have two players, players[0] and players[1]
// which are the LEFT and RIGHT armies, respectively.
let players = [];

// In addition, we keep the current player and the current opponent in
// "us" and "them" vars.
let us, them;

// The current wind speed
let wind;

// The current battle's terrain, as an Array[130] of numbers, each
// denoting the y-value of each of the 130 x-values.
let terrain;

// Game phase.  This is used for multiplayer.
let phase = 'init';

function setPhase(_phase) {
  phase = _phase;
  const ev = new CustomEvent('gamePhase', { detail: phase });
  document.dispatchEvent(ev);
}

async function waitForNotBusy() {
  return new Promise(resolve => {
    if (phase !== 'busy') resolve();
    const handle = () => {
      document.removeEventListener('gamePhase', handle);
      resolve();
    };
    document.addEventListener('gamePhase', handle);
  });
}

function getGameState() {
  return {
    left: players[0]?.getState(),
    right: players[1]?.getState(),
    player: us?.ix,
    phase,
    prng: prng.state,
    wind,
    frameStep,
    testing,
    terrain,
  };
}

// Synchronizes program state with the 'state' variable.  This is for
// multiplayer to make sure all clients are on the same page as such.
async function setGameState(state) {
  console.log("Received game state", state);

  clearRegisteredTimeouts();
  await waitForNotBusy();

  console.log("Setting game state", state);
  players[0] = new Player(0, state.left);
  players[1] = new Player(1, state.right);
  prng.state = state.prng;
  wind = state.wind;
  frameStep = state.frameStep;
  testing = state.testing;
  terrain = state.terrain;

  if (state.phase === phase && state.player === us?.ix) {
    setPhase(state.phase);
    us = players[state.player];
    them = players[1 - state.player];
    return;
  }

  console.log("Routing phase", phase);
  routePhase(phase);
}

function mqttReceiveState(state_json) {
  if (JSON.stringify(getGameState()) === state_json) return;

  const state = JSON.parse(state_json);
  clearRegisteredTimeouts();
  setRegisteredTimeout(setGameState, 100, state);
}

const registeredTimeouts = new Set();

function setRegisteredTimeout(functionRef, delay, ...params) {
  const t = setTimeout(functionRef, delay, ...params);
  registeredTimeouts.add(t);
  return t;
}

function clearRegisteredTimeouts()
{
  for (const t of registeredTimeouts)
    clearTimeout(t);
  registeredTimeouts.clear();
}

function clearRegisteredTimeout(t) {
  if (registeredTimeouts.has(t))
    registeredTimeouts.delete(t);
  clearTimeout(t);
}


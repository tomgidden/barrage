'use strict';

/**
 * BARRAGE
 * by P.R.Cox and S.Barrow, 1983
 * ported to JavaScript by Tom Gidden, 2024
 * 
 * This is a reasonably faithful conversion of the BBC Micro game, with
 * attention paid to fidelity to the original along with reasonably good
 * structure.
 * 
 * As the original BBC Micro code is compact and a bit scrambled, it has
 * a few negligible quirks -- mainly in drawing -- that would be a pain
 * to replicate; and a few quirks that I've consciously chosen to include
 * rather than improve upon...  the idea isn't to write a modern AAA+ game
 * but to replicate the original.
 * 
 * If you need perfection, run it in an emulator, eg. 
 *   https://bbc.xania.org/?disc1=sth%3AMicropower%2FBarrage.zip&autoboot
 */

//import { Player } from './Player.js';



// The number of milliseconds between requested frames (plus the processing
// time for the current frame, so this will always be more than 50ms as 
// frame refresh is triggered from synchronous code.
const frameStep = 50;

// Testing: this will fix it to a mode where "45,68" followed by "0,2" will win.
// Useful for trying out changes.
const testing = false;
const random1 = () => testing ? 0.5 : Math.random();
const random2 = () => testing ? 0.75 : Math.random();
const random3 = () => testing ? 0.25 : Math.random();

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

/**
 * Called when the user clicks the "Start Game" button, or when the
 * players want to play again.
 * 
 * We need a "Start Game" button so the user interacts with the game
 * window. This then allows audio to work.
 */
async function startWar() {

  // Get the populations of the two countries.  This is async so it can
  // wait for the user's input.
  const [left, right] = await getArmySizes();

  // Set up the player objects
  players = [
    new Player(0, left),
    new Player(1, right)
  ];

  // Start the first battle.
  startBattle();
}

/**
 * Set up the battle.
 * 
 * This function chooses the order of the players, and sets up the game state.
 * It then starts the loop using `nextPlayerUp`
 */
function startBattle() {

  // Choose a player to start with.  If equal, we'll pick randomly.  If not,
  // the player with the lower population goes first.
  const playerIx =
    (Math.floor(players[0].population) == Math.floor(players[1].population))
      ? (random1() >= 0.5 ? 0 : 1)
      : players[0].population < players[1].population
        ? 0
        : 1;

  // Link to the player objects, where 'us' is the current player, and 'them'
  // is the current opponent.  Note, this is the opposite of the 'playerIx'
  // choice; here we say 'them' is the player to go first (playerIx).  This
  // is because the first thing `nextPlayerUp` will do to start the battle
  // is flip the players.
  them = players[playerIx];
  us = players[1 - playerIx];

  // Set the players up for battle, drawing soldiers from their cities
  // to their bases.  We also 
  us.setupBattle();
  them.setupBattle();

  terrain = generateTerrain();
  setWind();
  nextPlayerUp();
}

/**
 * The main game loop during a battle.
 * 
 * As a turn-based game, one run of this loop represents a player's turn,
 * starting with input; following with their barrage of shots, which results
 * in a determination of whether the barrage finished the battle; then the
 * next step is determined: to end the game, end the battle, or just move on
 * to the next player's turn.
 */
async function gameLoop() {

  // Update the wind. This will be the value that the player sees while
  // choosing their move.  The wind will change as projectiles fly, but
  // the user is not updated.  I wasn't aware of this until I read the 
  // source to the game!
  updateWind();

  // Get the player's chosen move
  const { angle, velocity, deltaAng, deltaVel, shots } = await playerInput();

  // Fire the barrage, waiting until their turn is complete. If the result is
  // true, the battle (and possibly the war) is over. If false, we've probably
  // got to give the other player a go. It's possible the game will have ended
  // though, so we check that condition first.
  const battleOver = await fireBarrage(angle, velocity, deltaAng, deltaVel, shots);

  // If we detect the game is over (whether or not battleOver is true, but yes,
  // it probably IS true) then schedule the end screen.
  if (gameOver()) {
    setTimeout(endGame, 1000);
  }

  // The game continues, but the battle might be over.
  else {
    // If the barrage finished the battle, schedule the battle over screen, which
    // should in turn schedule the next battle.
    if (battleOver)
      setTimeout(endBattle, 1000);

    // Otherwise, schedule the next player's go, which will activate the next run
    // of the game loop.
    else
      setTimeout(nextPlayerUp, 1000);
  }
}

/**
 * Condition to check if the game is over.
 * @returns {boolean} Are the end game criteria met?
 */
function gameOver() {
  return us.population <= 0 || them.population <= 0;
}

/**
 * Check for battle loss, and identify the unlucky player.
 * If both players have lost, identify the opponent: if a player 
 * annihilates both their opponent and themselves, it's a valid "win".
 * 
 * @returns {false|Player} If a player has lost, then return that player; otherwise `false` indicates the battle's still on.
 */
function battleLoser() {

  // Has someone lost either their base or city?
  if (them.population <= 0) return them;
  if (them.soldiers <= 0) return them;
  if (us.population <= 0) return us;
  if (us.soldiers <= 0) return us;

  // No-one's lost!
  return false;
}

/**
 * Show the appropriate end-game screen, and make an offer (that you
 * can't refuse) to play again.
 * 
 * This should be run when we've identified that the game has been lost
 * as it assumes that is the case.
 */
async function endGame() {

  // Choose the appropriate text based on population.
  let str;
  if (us.population === them.population)
    str = `MUTUALLY ASSURED DESTRUCTION`;
  else if (us.population < them.population)
    str = `${us.label.toUpperCase()} ARMY ANNIHILATED`;
  else
    str = `${them.label.toUpperCase()} ARMY ANNIHILATED`;

  // Clear and display the message as the end-screen
  endScreen(str);

  // Pause and then ask if the player wants another war. Any keypress
  // indicates YES!
  setTimeout(async () => {

    // Show message
    message(``);
    message(``);
    centerMessage(`ANOTHER WAR?`);

    // Wait for keypress
    await new Promise(resolve => {
      const onkeydown = (e) => resolve(window.removeEventListener('keydown', onkeydown));
      window.addEventListener('keydown', onkeydown);
    });

    // Start the next war!
    await startWar();

  }, 1000);
}

/**
 * Show the end-of-battle message.  This is downplayed somewhat.  There's no real prize
 * for winning a battle, although it is a sign you did better than the other player.
 * The only real result is the winner of the war.
 * 
 * So, to that end, all it shows is the army / city population.
 */
async function endBattle() {
  // Show the message as a normal in-line message on the game view. Messy, but it's what
  // the original program does!
  message(``);
  message(`      ARMY SURVIVORS - LEFT = ${players[0].population}`);
  message(`                       RIGHT= ${players[1].population}`);

  // Press Any Key...
  await new Promise(resolve => {
    const onkeydown = (e) => resolve(window.removeEventListener('keydown', onkeydown));
    window.addEventListener('keydown', onkeydown);
  });

  // and start the next battle.
  startBattle();
}


/**
 * Switch `us` and `them` players, for the next turn.
 */
function nextPlayerUp() {

  // Switch the player objects to indicate the next player's turn.
  them = players[us.ix];
  us = players[1 - them.ix];

  // Redraw the screen
  drawScene(true);

  // and schedule the game loop in one second.
  setTimeout(gameLoop, 1000);
}

/**
 * Ask the user the size of the armies for the war. This may be
 * asymmetric to allow for a handicap for a strong player. Also,
 * while "#,#" is requested it should accept just "#" for matching
 * armies.
 * 
 * @returns {[number, number]} the sizes of the armies
 */
async function getArmySizes() {

  // 300 citizens is enough for three rounds of 100 soldiers each.
  const defaultSize = '300,300';

  // Repeat request until we get a valid return
  do {
    // Clear the screen so we can ask the user
    G.clear();

    // Display the prompt and await an answer.
    let input = await promptForTuple(`Size of armies (${defaultSize})? `, 2, 5);

    // If just Enter, use the default size.
    if (input === '') input = defaultSize;

    // Check if it's correctly formatted
    var m = input.match(/(\d+)(?:\D+(\d+))?/);

    // Check the values
    if (m) {
      var left = parseInt(m[1]);
      var right = parseInt(m[2] ?? m[1]);
    }

    // Repeat until the correct format is entered, and the values aren't silly.
  } while (!m || left < 5 || right < 5);

  // That worked, so return these values
  return [left, right];
}

/**
 * Asks the user for a numeric tuple, such as angle and velocity.
 * 
 * This can be a pair of numbers, including negative, decimals.
 * It can also just be empty, which would indicate the default choice.
 * 
 * The function will display the prompt and then wait for response,
 * terminated by Enter.
 * 
 * @param {string} prompt question
 * @param {number} character-x position
 * @param {number} character-y position
 * @returns Promise<string> The entered string
 */
async function promptForTuple(prompt, cx = 0, cy = 0) {

  // Display the prompt...
  message(prompt, cx, cy);

  // Await the construction of the result string `buf`, after keypresses.
  // This is unvalidated, but due to the limited number of input chars (0-9, -, ., ,)
  // it should be quite restrictive.  
  const buf = await new Promise((resolve) => {

    // We keep buf and obuf so we can compare lengths and blot out deleted characters.
    let buf = "";  // The buffer as it stands
    let obuf = ""; // The previous version of the buffer.

    // Prepare the key event handler
    const onkeydown = (e) => {

      // If Enter was pressed, we're done.  (Note, we could easily clear that line here)
      if ('Enter' === e.key) {
        // Remove this key event handler so we can go do everything we need.
        window.removeEventListener('keydown', onkeydown);
        resolve(buf);
        return;
      }

      // If a valid key was pressed, add it to the buffer
      if (['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', ',', '.'].includes(e.key)) {
        obuf = buf;             // Copy the old buffer
        buf += e.key;           // Amend the buffer
      }

      // Else, if we want to delete, delete.  We're not going to deal with cursor position,
      // forward-delete or anything like that.
      else if (['Delete', 'Backspace'].includes(e.key)) {
        obuf = buf;             // Copy the old buffer for comparison
        buf = buf.slice(0, -1); // Delete the last character
      }

      // Otherwise, just ignore this keypress.
      else return;

      // Something probably happened, so redisplay for user feedback.

      // Check if something was deleted so we can erase it.
      if (buf.length < obuf.length)
        message(prompt + buf + (" ".repeat(obuf.length - buf.length)), cx, cy);

      else
        // Else, just write out the prompt and the answer you're typing
        message(prompt + buf, cx, cy);
    };

    // Add the key event handler to start listening for keyboard activity.
    window.addEventListener('keydown', onkeydown);
  });

  // Return the text result string.
  return buf;
}

/**
 * Asks the current player for their move parameters.
 * 
 * This will display the two (or one) questions and process the results.
 * Once complete, it'll return the parameters in an object.
 * 
 * Angle is uncorrected, so it's relative to the way the player's gun looks,
 * not the absolute screen value. That's handled elsewhere.
 * 
 * It'll only ask for deltas if the player is eligible, ie. has enough soldiers.
 * 
 * 'shots' in the return indicates how many shots the player is eligible to take
 * in this barrage: either 1, 2 or 3, controlled by the deltas.
 * 
 * @returns {object}  angle, velocity, deltaAng, deltaVel, shots
 * */
async function playerInput() {

  // Get the name of the player -- LEFT or RIGHT -- for display
  const currentPlayer = us.label.toUpperCase();

  // Ask for the angle and velocity
  do {
    // Clear the top two lines of the screen for data entry.
    G.clearTextArea(0, 0, 40, 2);

    // Display the prompt and await an answer.  We'll show the previous values the user used.
    let input = await promptForTuple(`${currentPlayer} BASE ANG,VEL (${us.old_a},${us.old_v})?`, 0, 0);

    // If just Enter, use the default size.
    if (input === '') input = `${us.old_a},${us.old_v}`;

    // Check if it's correctly formatted: two numbers, separated
    // by a non-number - usually a comma or space. Velocity must be > 20
    var m = input.match(/(\d?\.?\d*)[^\d\-\.]+(\d?\.?\d*)/);

    // If format matches, get the values.
    if (m) {
      var angle = parseFloat(m[1]);
      var velocity = parseFloat(m[2]);
      if (isNaN(angle) || isNaN(velocity)) m = null;
    }

    // Repeat until the correct format is entered, and the values aren't silly.
  } while (!m || angle <= 0 || angle >= 180 || velocity < 20);


  // Adjust delta based on number of survivors
  const shots = us.shotsAvailable();

  // If the player is eligible for more than one shot...
  if (shots > 1) {

    // Ask for the angle-delta and velocity-delta
    do {
      // Clear the second line of the screen for data entry.
      G.clearTextArea(0, 1, 40, 1);

      // Display the prompt and await an answer.  We won't bother showing previous
      // because the original program doesn't.
      let input = await promptForTuple(`ENTER DELTA ANG,VEL=?`, 0, 1);

      // If just Enter, use the previous values, or 1,0
      if (input === '') input = `${us.old_da ?? 1},${us.old_dv ?? 0}`;

      // Check if it's correctly formatted: two numbers, separated by 
      // a non-number - usually a comma or space.  Delta-angle and delta-velocity
      // can be negative.
      var m = input.match(/(-?\d?\.?\d*)[^\d\-\.]+(-?\d?\.?\d*)/);

      // Sanity check
      if (m) {
        // Get the new deltas, or the previous values, or 1,0.
        var deltaAng = parseFloat(m[1] ?? us.old_da ?? 1);
        var deltaVel = parseFloat(m[2] ?? us.old_dv ?? 0);

        // If that failed, fail the check
        if (isNaN(deltaAng) || isNaN(deltaVel)) {
          m = null;
        }
        else {
          // Check if the deltas are sensible
          const absDeltaAng = Math.abs(deltaAng);
          const absDeltaVel = Math.abs(deltaVel);

          // Check that they obey the limits 
          if (angle + absDeltaAng >= 180 || angle - absDeltaAng <= 0 || velocity - absDeltaVel < 20)
            // Fail. Repeat.
            m = neap;
        }
      }

      // Repeat until the correct format is entered, and the values aren't silly.
    } while (!m);
  }

  // return the chosen values
  return { angle, velocity, deltaAng, deltaVel, shots };
}

/**
 * The actual shooting bit.  This does logic and animation, so it's a little scrappy.
 * 
 * This asynchronous function will continue until the player's turn is over: it'll 
 * fire the shots, handle the redrawing and the impacts, and most of the consequence
 * processing, like explosions and messages.
 * 
 * If terminated early by end-game, it'll return then.  Once returned the game loop
 * will need to check the conditions and if appropriate handle end-game or end-battle
 * actions, or failing that, move to the next turn.
 */
async function fireBarrage(angle, velocity, deltaAng, deltaVel, shots) {

  // Save these values in the player for next time.
  us.old_a = angle;
  us.old_v = velocity;
  us.old_da = deltaAng;
  us.old_dv = deltaVel;

  // Position the text cursor at line 5 so messages ("NEAR MISS!", etc.) can
  // be printed.
  G.setTextOrigin(5);

  // Big and small blind: each player loses a soldier for each turn.
  us.penalty(1);
  them.penalty(1);

  // A turn consists of 1, 2 or 3 shots, depending on how many soldiers the
  // player has. This is determined by the `shots` argument to this function.
  //
  // This block will return when all 1,2 or 3 shots are complete and/or the
  // enemy (or the player) has been defeated. The return value, `battleOver`
  // is `true` if the battle or game is concluded.  If `false`, then all 
  // shots were completed without a termination condition. That doesn't mean
  // that the condition isn't set now, though, so the game loop should check.
  let battleOver = false;

  // For each permitted shot:
  for (let shot = 0; shot < shots; shot++) {

    // Start with the set angle and velocity
    let a = angle, v = velocity;
    switch (shot) {
      // and then if it's a second or third shot, use the deltas to modify the trajectory.
      case 1: a += deltaAng; v += deltaVel / 10; break;
      case 2: a -= deltaAng; v -= deltaVel / 10; break;
    }

    // Redraw the bases and cities to reflect changes.  However, it does corrupt a bit here...
    // if the base has moved (due to crater) we'll have more than one gun shown. That's 
    // faithful to the old game.
    drawBasesAndCities();

    // Fire the shot, and wait for the conclusion, including messages.
    await fireProjectile(a, v);

    // A quick pause
    await sleep(250);

    // And if we have a loser, complete the battle.
    if (battleLoser())
      battleOver = true; // Battle over
  }

  // Return true if end-battle is needed, or false if it's just next turn.
  return battleOver;
}

/**
 * Fire the shot, processing all graphics and sound updates.  Complete when the shot finishes.
 * 
 * @param {number} angle 
 * @param {number} velocity 
 * @returns {boolean} true if battle over, false for next player's turn.
 */
async function fireProjectile(angle, velocity) {

  // Start the projectile sound effect: we'll leave it running and just modulate the pitch.
  projectileSounder.play();

  // Prep all the values.
  const x1 = us.base_x;    // Start at the player's base
  const y1 = terrain[x1]+4 // at the current height of the base
  let x = x1;              // The running value of x in the projectile path
  let y = y1;              // The running value of y in the projectile path
  let t = 0;               // Physics time in "seconds". This isn't the same as real time.

  // dx and dy are the deltas for x and y for each frame, modified by gravity, wind, etc.

  // If we are on the right, our dx is reversed, of course.
  let dx = (us.ix === 1 ? -1 : 1) * Math.cos(angle * Math.PI / 180) * velocity / 10;

  // but they both point upwards.
  let dy = Math.sin(angle * Math.PI / 180) * velocity / 10;

  // `s` is the TTL of the projectile. If 's' reaches zero, we fizzle the shot: it disappears.
  // This is to prevent weird corner cases where it could got through something and carry on
  // forever.
  //
  // It's also the pitch of the sound. We could use `t` here. In fact, we could use `t`
  // for a lot of things, but 's' is just easier. No reason to overload `t`.
  let s = 200;

  // Remember the old location, so we can draw a line from point to point.
  let ox = x;
  let oy = y;

  // And store the rounded version of `x` so we can correctly index `terrain[X]`.
  let X = Math.round(x);

  // The run-loop for the projectile shot, returning if the shot impacted rather than
  // going out-of-bounds.
  const shotImpacted = await new Promise(async resolveShot => {

    // We want an indefinite-end loop which will carry on until it hits something or
    // goes off either side.
    const run = async () => {

      // Step time 0.3 physics seconds
      t += 0.3;

      // If the TTL has been used up, destroy the projectile as if it went off-screen.
      if (s < 0) {
        resolveShot(false); // fizzle
        return;
      }

      // Apply wind effect to horizontal velocity. This is a weird one. I'd always assumed
      // the wind was updated on each move. It turns out it changes for every animation frame.
      // This adds significant randomness to even expert players.
      updateWind();

      // dx changes with wind, either speeding up or slowing down projectile lateral movement
      dx += (dx + wind) / 1500;
      // This affects the actual position
      x = x1 + (dx + wind / 50) * t;
      // and re-trunc it to match the grid.
      X = Math.round(x);

      // If we go outside the screen, we fizzle.
      if (x < 0 || x > 130) {

        // Probably no sound, but we'll hook it anyway.
        playOutOfBoundsSound();

        // Short pause
        await sleep(250);

        // and continue to next shot/next player
        resolveShot(false);
        return;
      }

      // Y is also modified by dy and gravity.  Apparently 2.5 is magical.
      y = y1 + (dy - t / 2.5) * t;

      // If we hit the ground, locate it there.
      if (y <= terrain[X])
        y = terrain[X];

      // Draw the projectile track from previous position to new position 
      drawProjectile(ox, oy, x, y);

      // Update new to old, for the new animation frame.
      ox = x;
      oy = y;

      // If we're still above the terrain, we can continue the loop. 
      if (y > terrain[X]) {

        // Decrease the pitch of the sound
        playProjectileSound(s--);

        // and schedule the next animation frame.
        setTimeout(() => requestAnimationFrame(run), frameStep);
        return;
      }


      resolveShot(true); // impact
      return;
    };

    await run();
  });

  // Okay, the shot has completed.

  // Stop the projectile sound effect.
  projectileSounder.stop();

  // Assume it's not over
  let battleOver = false;

  // If the shot impacted, we need to know what to do with it.
  if (shotImpacted) {

    // Check if the impact triggered or was coincident with a failure state (battle lost, game.icon);
    battleOver = await handleImpact(x, y);

    // If we're in the landspace and out of the way of the city foundations, we can make a crater now.
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

  // Return true if the battle should terminate here.
  return battleOver; // If false, barrage continues
}

/**
 * Initialize wind to a sensible value between -50 and 50, not including zero.
 */
function setWind() {
  do {
    wind = random1() * 100 - 50;
  } while (!testing && Math.round(wind) === 0);
}

/**
 * Alter wind randomly by ±0.5mph, up to ±50mph total
 */
function updateWind() {
  let wind3;
  do {
    wind3 = wind + random1() - 0.5;
  } while (Math.abs(wind3) > 50);
  wind = wind3;
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

  if (false !== (casualties = us.hitNear(us.ix, x, y))) {
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

  if (false !== (casualties = them.hitNear(us.ix, x, y))) {
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

  if (false !== (casualties = us.hitTown(us.x, x, y))) {
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

  if (false !== (casualties = them.hitTown(us.ix, x, y))) {

    // If you hit your enemy's city, their citizens die, but you also get
    // slapped with a penalty sacrifice thanks to this world's version of 
    // the Geneva Convention.
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

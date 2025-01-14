// While the graphics mode is 320x256, the game operates on the
// basis of 130x100. graphics.js will handle this conversion, but
// we just need to know this to handle it.
const gameWidth = 130;
const gameHeight = 100;

function generateTerrain() {

    // Prepare the terrain array, which is an array of 130 height values.
    terrain = new Array(gameWidth).fill(0);

    // Position the cities at the edges of town. This is roughly
    // one "large" pixel from the edge, as `4` is effectively the
    // center of the city, graphically.
    players[0].city_x = 4;
    players[1].city_x = gameWidth - 4;

    // x1, x2: Position the bases between 10 and 30 units from the edge of
    // the world.  Note, x2 is a deviation from the original, which had
    // the right base at 80+[0..1]*30, so it was usually further "forward"
    // than the left base. I assume this is a bug (for now) and have 
    // corrected it for fairness.
    const x1 = players[0].base_x = Math.floor(10 + random1() * 20);
    const x2 = players[1].base_x = Math.ceil(gameWidth - 10 - random1() * 20);

    // Choose the base heights (where the city and base are for each side)
    const h1 = Math.floor(random1() * 50 + 15);
    const h2 = Math.floor(random2() * 50 + 15);

    // We pick a midpoint 'x3' somewhere between the two bases, with
    // a random height that could be above, below or in-between
    // the two base heights, giving a mountain, a valley or a slope
    // accordingly.
    const x3 = x1 + Math.floor(random1() * (x2 - x1 - 24)) + 10;
    const h3 = random3() * 70 + 16;

    // Set the terrain from the left city to the left base to that level.
    for (let i = 0; i <= x1; i++)
        terrain[i] = h1;

    // Set the terrain from the right base to the right city to that level.
    for (let i = x2; i < gameWidth; i++)
        terrain[i] = h2;

    // Set the height at 'x3' randomly.
    terrain[x3] = h3;

    // At this point, the heights from x1,h1 to x3,h3; and from
    // x3,h3 to x2,h2 are undefined.  We'll need to fill those in.

    // Figure out the delta-y needed to get to the middle of each
    // slope.
    const d1 = (h3 - h1) / 2;
    const d2 = (h3 - h2) / 2;

    // If they're both up or both down...
    if (d1 * d2 > 0) {

        // The goal is to run a sigmoid curve from the base 
        // to the midpoint on both sides.
        //
        // We'll want to step cos(0..π) radians in the number of
        // horizontal steps from the base to the midpoint.
        //
        // In an earlier commit I tried to refactor this to 
        // generate each half of each slope at the same time
        // to cut the amount of trig.  However, it left ugly
        // rounding errors, so I've returned to the original
        // algorithm.

        // j1 and j2 are the angles of the cosines, starting at 0.
        let j1 = -Math.PI;
        let j2 = 0;

        // k1 and k2 are the angle steps for each x position. As
        // the two slopes are of different widths, we must step them
        // independently.  If the graphics were much higher res,
        // we could do this in one loop, but for rounding errors
        // we'll actually loop separately.
        //
        // Note, we don't actually get to j1==π or j2==π, because
        // we only step half the number of steps for efficiency.
        // That's done in the `let i = ..../2` bit below.
        const k1 = Math.PI / (x3 - x1 + 1);
        const k2 = Math.PI / (x2 - x3 + 1);

        // First the left slope.
        for (let i = x1 + 1; i < x3; i++) {

            // Increment the angle, going from -π to 0
            j1 += k1;

            // Model the sigmoid to set the height of the two 
            // corresponding positions.
            terrain[i] = h1 + d1 + Math.cos(j1) * d1;
        }

        // And now the right slope.
        for (let i = x2 - 1; i >= x3; i--) {

            // Increment the angle, going from 0 to π
            j2 += k2;

            // Model the sigmoid as above.
            terrain[i] = h2 + d2 - Math.cos(j2) * d2;
        }
    }

    else {
        // The midpoint is between the two endpoints.

        // Now, we could use the above code to generate two sigmoids
        // giving a complex ground. However, it can be ugly. Anyway, the
        // original code just did one simple sigmoid between them, so
        // we'll do that.

        // First thing, we scrap x3, h3, d1 and d2.

        // Generate a single half-height, dh
        const dhy = (h1 - h2) / 2;

        // Prepare the trigonometry!
        let j = 0;
        const k = Math.PI / (x2 - x1 + 1);

        // Loop through the sin(0)..sin(π/2) range which gets us from
        // 0 (with a diagonal slope) to 1 (horizontal).  As before, we'll
        // set the slopes outwards from the midpoint (where slope is
        // diagonal) to tail off at x1 and x2.
        for (let i = x1 + 1; i < x2; i++) {
            j += k;
            terrain[i] = h2 + dhy + Math.cos(j) * dhy;
        }

        // // Fix rounding error. It's even more noticeable with this smooth
        // // simple curve. :(
        // let x3 = Math.trunc(x1 + (x2 - x1) / 2);
        // terrain[x3] = (terrain[x3 - 1] + terrain[x3 + 1]) / 2;
    }

    // Normalize the terrain
    //
    // The original program's algorithm would sometimes have the bases and terrain
    // located far up the screen, wasting a good chunk of space.  
    //
    // Rather than nipping it in the bud by sanity-checking the figures above, this
    // routine just goes through the generated terrain and shifts it down so the lowest
    // point is about 20 units above the base.
    //
    // It's a significant improvement on some battles, and is quite unobtrusive.
    //
    // We _could_ run this after every turn so deep craters cause the terrain to get 
    // shifted up, but it's unlikely, not a big deal, and if you're digging a big hole,
    // it looks better to keep that perspective.

    // Find the lowest point of terrain
    let dy0 = Math.floor(Math.min(...terrain));

    // Shift it up.
    terrain = terrain.map(y => y - dy0 + 20);

    // Return the resulting terrain array. This will become the global variable `terrain`
    return terrain;
}
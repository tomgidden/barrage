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
        // to the midpoint of both slopes.
        //
        // We'll want to step cos(0..π) radians in the number of
        // horizontal steps from the base to the midpoint.
        //
        // Rather than following the original game's less-efficient
        // process, rather than calculating the whole sigmoid,
        // we'll do each slope to the midpoint in halves, so we
        // can cut the number of Math.cos() calculations down.
        // Utterly unnecessary in this day and age, but it's an
        // observation of a nice symmetry we can use.

        // j1 and j2 are the angles of the cosines, starting at 0.
        let j1 = 0;
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
        const k1 = Math.PI / (x3 - x1);
        const k2 = Math.PI / (x2 - x3);

        // First the left slope. Go outwards from the middle of the
        // slope to the ends (x1, x3)
        for (let i = Math.trunc((x3 - x1) / 2); i > 0; i--) {

            // Increment the angle, going from 0 to π/2
            j1 += k1;

            // This models the sigmoid. The first half of the sigmoid
            // is the inverted "hump" of sin from sin(90º) to sin(0)
            // ie.  _/ .  As we're doing it from both high and low
            // we'll meet in the middle, ie. sin(0) where the slope
            // is diagonal. That gives us a smooth curve.
            //
            // As we're measuring from the endpoints to the middle,
            // we "invert" dh by doing 1-sin() rather than sin() .
            // That means we can just add dh to h1, or subtract dh
            // from h3 to get to the midpoint of the slope.
            const dh = (1 - Math.sin(j1)) * d1;

            // Set the height of the two corresponding positions.
            terrain[x1 + i] = h1 + dh;
            terrain[x3 - i] = h3 - dh;
        }

        // And now the right slope. Same again, going from the
        // middle to the ends (x3, x2).
        for (let i = Math.trunc((x2 - x3) / 2); i > 0; i--) {

            // Increment the angle, going from 0 to π/2
            j2 += k2;

            // Model the sigmoid as above.
            const dh = (1 - Math.sin(j2)) * d2;

            // Set the height of the two corresponding positions.
            terrain[x3 + i] = h3 - dh;
            terrain[x2 - i] = h2 + dh;
        }

        // Fix rounding error. Hmm. Maybe I should've just stuck with the
        // old way. Kids, that's called _hubris_, and it's a bad thing in
        // professional programming.
        terrain[x3] = (terrain[x3 - 1] + terrain[x3 + 1]) / 2;
    }

    else {
        // The midpoint is between the two endpoints.

        // Now, we could use the above code to generate two sigmoids
        // giving a complex ground. However, it can be ugly. Anyway, the
        // original code just did one simple sigmoid between them, so
        // we'll do that.

        // First thing, we scrap x3, h3, d1 and d2.

        // Generate a single half-height, dh
        const dhy = (h2 - h1) / 2;

        // Prepare the trigonometry!
        let j = 0;
        const k = Math.PI / (x2 - x1 + 1);

        // Loop through the sin(0)..sin(π/2) range which gets us from
        // 0 (with a diagonal slope) to 1 (horizontal).  As before, we'll
        // set the slopes outwards from the midpoint (where slope is
        // diagonal) to tail off at x1 and x2.
        for (let i = Math.trunc((x2 - x1) / 2); i > 0; i--) {
            j += k;
            const dh = (1 - Math.sin(j)) * dhy;
            terrain[x1 + i] = h1 + dh;
            terrain[x2 - i] = h2 - dh;
        }

        // Fix rounding error. It's even more noticeable with this smooth
        // simple curve. :(
        let x3 = Math.trunc(x1 + (x2 - x1) / 2);
        terrain[x3] = (terrain[x3 - 1] + terrain[x3 + 1]) / 2;
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
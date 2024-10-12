
function generateTerrain() {
    terrain = new Array(130).fill(0);

    const x1 = players[0].base_x;
    const x2 = players[1].base_x;

    // Generate left side of terrain
    let h9 = Math.floor(random1() * 50 + 15);
    for (let i = 0; i <= x1; i++) {
        terrain[i] = h9;
    }

    // Generate right side of terrain
    h9 = Math.floor(random2() * 50 + 15);
    for (let i = x2; i < 130; i++) {
        terrain[i] = h9;
    }

    // Generate middle section with a peak
    const x3 = x1 + Math.floor(random3() * (x2 - x1 - 24)) + 10;
    terrain[x3] = random1() * 70 + 16;

    const d1 = (terrain[x3] - terrain[0]) / 2;
    const d2 = (terrain[x3] - terrain[129]) / 2;

    if (d1 * d2 > 0) {
        // Generate left slope
        let j = -180;
        const k = 180 / (x3 - x1 + 1);
        h9 = terrain[0] + d1;
        for (let i = x1 + 1; i < x3; i++) {
            j += k;
            terrain[i] = h9 + Math.cos(j * Math.PI / 180) * d1;
        }

        // Generate right slope
        j = 0;
        const k2 = 180 / (x2 - x3 + 1);
        h9 = terrain[129] + d2;
        for (let i = x3 + 1; i < x2; i++) {
            j += k2;
            terrain[i] = h9 + Math.cos(j * Math.PI / 180) * d2;
        }
    } else {
        // Generate a single slope if d1 * d2 <= 0
        const d = (terrain[0] - terrain[129]) / 2;
        let j = 0;
        const k = 180 / (x2 - x1 + 1);
        h9 = terrain[129] + d;
        for (let i = x1 + 1; i < x2; i++) {
            j += k;
            terrain[i] = h9 + Math.cos(j * Math.PI / 180) * d;
        }
    }


    // 0 <= x1, x2 < 65
    // 0 <= x3 < 86
    let dy0 = Math.floor(Math.min(...terrain));

    console.log([terrain[x1], terrain[x3], terrain[x2], dy0]);

    terrain = terrain.map(y => y-dy0+20);

    console.log([terrain[x1], terrain[x3], terrain[x2], dy0]);
    
    return terrain;
}

class Player {

  constructor(ix, population) {
    this.ix = ix;
    this.label = ix ? "RIGHT" : "LEFT";
    this.population = population;
    this.soldiers = population;
    this.angle = 45;
    this.velocity = 100;
    this.deltaAng = 5;
    this.deltaVel = 5;
  }

  setupBattle() {
    this.soldiers = Math.min(100, this.population);

    // Note, terrain generation will also set city_x and base_x.
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

  /**
   * Check if the impact was near or at a given player's base.
   * 
   * @param {number} playerIx The index of the player firing (0 or 1).
   * @param {number} x The x-coordinate of the hit.
   * @param {number} y The y-coordinate of the hit.
   * 
   * @returns {number|false} The number of casualties, or `false` if not hit.
   */
  hitNear(playerIx, x, y) {

    // Check how far the impact was from the base.
    const delta_x = Math.abs(x - this.base_x);

    // If it was more than 8 units away, it's not a hit, so carry on.
    if (delta_x > 8) return false;

    // Calculate casualties based on distance from the center of the
    // base; or everyone if it's a direct hit.
    const casualties = delta_x < 1
      ? this.soldiers          // Direct hit, so everyone dies
      : Math.floor(this.soldiers / (1.5 * delta_x)); // Near miss

    // Kill the casualties, and update the totals accordingly
    this.penalty(casualties);

    // Return the number of casualties so we can display it
    return casualties;
  }

  /**
   * Check if the impact was near or at the player's town.
   * 
   * @param {number} playerIx The index of the player firing (0 or 1).
   * @param {number} x The x-coordinate of the hit.
   * @param {number} y The y-coordinate of the hit.
   * 
   * @returns {number|false} The number of casualties, or `false` if not hit.
   */
  hitTown(playerIx, x, y) {
    // Check how far the impact was from the city.
    const delta_x = Math.abs(this.city_x - x);

    // If it was more than 3 units away from the center of the city, 
    // it's not a hit, so carry on.
    if (delta_x > 3) return false;

    // City hits incur penalties as if they are bases, but randomly spaced
    // throughout the city, not proportional to distance.
    const penalty = Math.floor(10 + random2() * 5);
    this.penalty(penalty);

    // Return the number of casualties so we can display it.
    return penalty;
  }
}

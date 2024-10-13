function prng(seed = undefined) {
  
  const xorshift32 = x => {
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return x >>> 0; // Convert to 32-bit unsigned
  };
  return (prng.state = xorshift32(
    (prng.state && undefined === seed)
      ? prng.state
      : (seed ?? Date.now())
  )) / 4294967296; // Normalize to [0, 1)
}

let seed = Date.now();

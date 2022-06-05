/**
 * Returns a pretty good seeded randomness function.
 * 
 * @param seed The seed for repeatable randomness
 * @returns () => number [0-1]
 */
export function mulberry32(seed: Uint32Array[0]) {
  return function() {
    var t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

/**
 * Function to generate a random 32 bit hex seed.
 * 
 * @returns number
 */
export function generate32bitSeed() {
  let hex = "";
  while(hex.length < 8) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return hex;
}

/**
 * Parses a hex seed into a number
 * 
 * @param seed string
 * @returns number
 */
export function parseSeed(seed: string) {
  if(seed.length != 8) throw new Error("Expected seed string length to be 8 characters.");
  return parseInt(seed, 16);
}

/**
 * Checks if a seed string is valid (32 bit hex)
 * 
 * @param seed string
 * @returns boolean
 */
export function isValidSeed(seed: string) {
  try {
    parseSeed(seed);
  } catch(err) {
    return false;
  }
  return true;
}
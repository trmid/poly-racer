
/**
 * Returns the number padded with zeros at the start until {length} is reached.
 * 
 * @param value number
 * @param length number
 * @returns string
 */
export function zeroPad(value: number, length: number) {
  let str = "" + value;
  while(str.length < length) {
    str = '0' + str;
  }
  return str;
}

/**
 * Returns true if the 2D position is within the X-Y boundaries of the trigon.
 * 
 * @param trigon Urchin Trigon (only takes x and y)
 * @param position Urchin Vector (only takes x and y)
 */
export function inTrigonHitbox(trigon: Trigon, position: Vector) {

  // Construct three point sets to consider all three base lines:
  const sets = [
    [trigon.v0, trigon.v1, trigon.v2],
    [trigon.v1, trigon.v2, trigon.v0],
    [trigon.v2, trigon.v0, trigon.v1],
  ];

  // Construct rectangle from each point set and check if position is within bounds:
  for(const p of sets) {
    const baseLine = Vector.sub(p[0], p[1]);
    const angle = Vector.angleBetween(baseLine, Vector.xAxis());
    const c = p.map(p => Vector.rotateZ(p, -angle));
    const cp = Vector.rotateZ(position, -angle);
    if(!(
      cp.x >= Math.min(c[0].x, c[1].x, c[2].x) &&
      cp.x <= Math.max(c[0].x, c[1].x, c[2].x) &&
      cp.y >= Math.min(c[0].y, c[1].y, c[2].y) &&
      cp.y <= Math.max(c[0].y, c[1].y, c[2].y)
    )){
      // Out of bounds
      return false;
    }
  }

  // Within all rectangles, so it must be within bounds of the triangle as well
  return true;

}
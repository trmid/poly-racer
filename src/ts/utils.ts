
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
    const angle = (baseLine.y < 0 ? 1 : -1) * Vector.angleBetween(baseLine, Vector.xAxis());
    const c = p.map(p => Vector.rotateZ(p, angle));
    const cp = Vector.rotateZ(position, angle);
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

/**
 * Checks if the two lines intersect within the boundaries of the points specified.
 * 
 * @param a0 Vector
 * @param a1 Vector
 * @param b0 Vector
 * @param b1 Vector
 */
export function linesCross(a0: Vector, a1: Vector, b0: Vector, b1: Vector) {

  // Make everything relative to a0 and the X-Axis, then check if relative b-line intersects with the axis between 0 and xMax:
  const aDiff = Vector.sub(a1, a0);
  const xMax = aDiff.mag();
  const aAngle = (aDiff.y < 0 ? 1 : -1) * aDiff.angleBetween(Vector.xAxis());
  const b0r = Vector.sub(b0, a0).rotateZ(aAngle);
  const b1r = Vector.sub(b1, a0).rotateZ(aAngle);

  if((b0r.y == 0 && b0r.x >= 0 && b0r.x <= xMax) || (b1r.y == 0 && b1r.x >= 0 && b1r.x <= xMax)) {

    // Line touches on at least one endpoint
    return true;
  } else if(Math.sign(b0r.y) != Math.sign(b1r.y)) {

    // Line crosses x-axis, find where
    const slope = (b1r.x - b0r.x) / (b1r.y - b0r.y);
    const intersectionX = b1r.x  - b1r.y * slope;
    if(intersectionX >= 0 && intersectionX <= xMax) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
}

/**
 * Formats a millisecond time as a stopwatch-style time string.
 * 
 * @param ms time in milliseconds
 * @param full includes all fields if true
 * @returns string
 */
export const formatMsTime = (ms: number, full = false) => {
  const minutes = Math.floor(ms / (60 * 1000));
  const seconds = Math.floor(ms / 1000) % 60;
  const milliseconds = Math.floor(ms) % 1000;
  return `${minutes > 0 || full ? `${zeroPad(minutes, 2)}:` : ""}${zeroPad(seconds, 2)}.${zeroPad(milliseconds, 3)}`;
};

/**
 * Converts an ArrayBuffer to a binary string.
 * 
 * @param buffer 
 * @returns binary string
 */
export function arrayBufferToString(buffer: ArrayBuffer) {
  let binaryStr = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binaryStr += String.fromCharCode( bytes[i]);
  }
  return binaryStr;
}

/**
 * Converts a binary string to an ArrayBuffer.
 * 
 * @param str 
 * @returns ArrayBuffer
 */
export function stringToArrayBuffer(str: string) {
  const buffer = new ArrayBuffer(str.length);
  const bytes = new Uint8Array(buffer);
  for(let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i);
  }
  return buffer;
}
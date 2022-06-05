import { mulberry32, parseSeed } from "./random";

export function buildTrackMesh(seed: string) {

  // Get seeded randomness function:
  const rand = mulberry32(parseSeed(seed));

  // Track constants:
  const numPoints = 12;
  const radius = 200;
  const maxRadius = 380;
  const trackWidth = 15;

  // Track turns:
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    let a = i * Math.PI * 2 / numPoints;
    let rx = radius + rand() * (maxRadius - radius);
    let ry = radius + rand() * (maxRadius - radius);
    let x = Math.cos(a) * rx;
    let y = Math.sin(a) * ry;
    points.push(new Vector(x, y));
  }

  // Construct track mesh from interpolated points:
  const mesh = new Mesh();
  for (let i = 0; i < numPoints; i++) {
    const prev = i == 0 ? points[numPoints - 1] : points[i - 1];
    const current = points[i];
    const next = i + 1 == numPoints ? points[0] : points[i + 1];
    const last = i + 2 >= numPoints ? points[i + 2 - numPoints] : points[i + 2];
    const segments = curve(prev.x, prev.y, current.x, current.y, next.x, next.y, last.x, last.y, trackWidth, trackWidth);
    for(const s of segments) {
      mesh.addTrigon([
        new Trigon(s[0], s[1], s[2]),
        new Trigon(s[0], s[2], s[3])
      ]);
    }
  }

  // Return mesh:
  return mesh.inverseNormals();
  
}

function lineDist(x1: number, y1: number, x2: number, y2: number) {
  const d1 = y2 - y1;
  const d2 = x2 - x1;
  return Math.sqrt(d1 * d1 + d2 * d2);
}

function curve(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, w1: number, w2: number) {
  const segments = new Array<Vector[]>();
  const dist = lineDist(x1, y1, x2, y2);
  if (dist > 0) {
      // const dist01 = lineDist(x0, y0, x1, y1);
      // const dist23 = lineDist(x2, y2, x3, y3);
      // const dist02 = lineDist(x0, y0, x2, y2);
      // const dist13 = lineDist(x1, y1, x3, y3);
      // const sharp1 = dist02 < dist * 1.5, sharp2 = dist13 < dist * 1.5;
      // const weight = 0.15 * dist;
      // const cx0 = x1 + weight * (x1 - x0) / (dist01 || 1), cy0 = y1 + weight * (y1 - y0) / (dist01 || 1);
      // const cx3 = x2 + weight * (x2 - x3) / (dist23 || 1), cy3 = y2 + weight * (y2 - y3) / (dist23 || 1);
      const iterations = Num.constrain(Math.ceil(dist / 5), 3, 8);
      const points: { x: number, y: number, w: number }[] = new Array(iterations + 1);
      for (let i = 0; i < iterations + 1; i++) {
          const u = (1.0 * i) / iterations;
          const ui = 1 - u;

          // Catmull-Rom
          const cat_x = 0.5 * (((-x0 + 3 * x1 - 3 * x2 + x3) * u + (2 * x0 - 5 * x1 + 4 * x2 - x3)) * u + (-x0 + x2)) * u + x1;
          const cat_y = 0.5 * (((-y0 + 3 * y1 - 3 * y2 + y3) * u + (2 * y0 - 5 * y1 + 4 * y2 - y3)) * u + (-y0 + y2)) * u + y1;

          // Bezier
          // const bx = (ui * ui * ui * x1) + (3 * ui * ui * u * cx0) + (3 * ui * u * u * cx3) + (u * u * u * x2);
          // const by = (ui * ui * ui * y1) + (3 * ui * ui * u * cy0) + (3 * ui * u * u * cy3) + (u * u * u * y2);

          // Interpolation between the two
          // const px = ui * (sharp1 ? cat_x : bx) + u * (sharp2 ? cat_x : bx);
          // const py = ui * (sharp1 ? cat_y : by) + u * (sharp2 ? cat_y : by);

          const px = cat_x;
          const py = cat_y;
          const pw = u * w2 + ui * w1;
          points[i] = { x: px, y: py, w: pw };
      }
      for (let i = 0; i < iterations; i++) {
          const p0 = points[i - 1];
          const p1 = points[i];
          const p2 = points[i + 1];
          const p3 = points[i + 2];

          const n0_x = (i <= 0 ? x2 - x0 : p2.x - p0.x);
          const n0_y = (i <= 0 ? y2 - y0 : p2.y - p0.y);
          const n0_mag = Math.sqrt(n0_x * n0_x + n0_y * n0_y);
          const n0_norm_x = n0_mag > 0 ? p1.w * -n0_y / n0_mag : 0; // swap x and y for rotation
          const n0_norm_y = n0_mag > 0 ? p1.w * n0_x / n0_mag : 0; // swap x and y for rotation

          const n2_x = (i >= iterations - 1 ? x3 - x1 : p3.x - p1.x);
          const n2_y = (i >= iterations - 1 ? y3 - y1 : p3.y - p1.y);
          const n2_mag = Math.sqrt(n2_x * n2_x + n2_y * n2_y);
          const n2_norm_x = n2_mag > 0 ? p2.w * -n2_y / n2_mag : 0; // swap x and y for rotation
          const n2_norm_y = n2_mag > 0 ? p2.w * n2_x / n2_mag : 0; // swap x and y for rotation

          let s0 = new Vector(p1.x - n0_norm_x, p1.y - n0_norm_y);
          let s1 = new Vector(p1.x + n0_norm_x, p1.y + n0_norm_y);
          let s2 = new Vector(p2.x + n2_norm_x, p2.y + n2_norm_y);
          let s3 = new Vector(p2.x - n2_norm_x, p2.y - n2_norm_y);
          const h1 = lineDist(s0.x, s0.y, s2.x, s2.y);
          const h2 = lineDist(s1.x, s1.y, s3.x, s3.y);
          const e1 = lineDist(s1.x, s1.y, s2.x, s2.y);
          const e2 = lineDist(s0.x, s0.y, s3.x, s3.y);
          const e3 = lineDist(s0.x, s0.y, s1.x, s1.y);
          const e4 = lineDist(s2.x, s2.y, s3.x, s3.y);
          if (e1 + e2 > h1 + h2) { // hypotenuses added will always be greater than edges added
              // Swap points to prevent line crossings
              const temp_x = s2.x, temp_y = s2.y;
              s2.x = s3.x;
              s2.y = s3.y;
              s3.x = temp_x;
              s3.y = temp_y;
          }
          if (e3 + e4 > h1 + h2) { // hypotenuses added will always be greater than edges added
              // Swap points to prevent line crossings
              const temp_x = s2.x, temp_y = s2.y;
              s2.x = s1.x;
              s2.y = s1.y;
              s1.x = temp_x;
              s1.y = temp_y;
          }
          segments.push([s0, s1, s2, s3]);
      }
  }
  return segments;
}
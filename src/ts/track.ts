import { Particle, Pocket } from "@midpoint68/pocket";
import { writable } from "svelte/store";
import { mulberry32, parseSeed } from "./random";
import { inTrigonHitbox } from "./utils";

export const favourites = writable<Set<string>>(new Set());

export class Track {

  public readonly urbject: MeshUrbject;
  public readonly mesh: Mesh;
  public readonly startLine: { p0: Vector, p1: Vector };

  // Pocket with mesh trigons:
  private trigonPocket: Pocket<Trigon>;

  constructor(public readonly seed: string, preview = false) {
    const track = buildTrack(seed);
    this.mesh = track.mesh;
    this.startLine = track.startLine;

    // Build Urbject:
    this.urbject = new MeshUrbject({
      mesh: this.mesh,
      material: preview ? new Material({ fill: new Color("white"), lit: false }) : new Material({fill: new Color("#404040")}),
      group: -2
    });

    // Build start line:
    const startLineDiff = Vector.sub(this.startLine.p0, this.startLine.p1);
    const startLine = new MeshUrbject({
      mesh: Mesh.plane().scale(new Vector(startLineDiff.mag() * 0.9, 1, 1)),
      material: preview ? new Material({ fill: new Color("black"), lit: false }) : new Material({ fill: new Color("white") }),
      position: Vector.sub(this.startLine.p0, Vector.mult(startLineDiff, 0.5)),
      orientation: Quaternion.fromVector(startLineDiff, Vector.xAxis()),
      group: -1
    });
    this.urbject.addChild(startLine);

    // Build pocket:
    this.trigonPocket = new Pocket();
    for(const trigon of this.mesh.trigons) {
      // Add a particle centered at the trigon that contains the entire shape:
      const center = trigon.getCenter();
      const radius = Math.max(
        Vector.sub(trigon.v0, center).mag(),
        Vector.sub(trigon.v1, center).mag(),
        Vector.sub(trigon.v2, center).mag(),
      );
      this.trigonPocket.put(new Particle({
        x: center.x,
        y: center.y,
        radius,
        data: trigon
      }));
    }

    // Add trees:
    if(!preview) {
      const rand = mulberry32(parseSeed(seed));
      const count = 100;
      const radius = 1.5;
      const treeMesh = new Mesh();
      treeMesh.addTrigon(new Trigon(
        new Vector(0, -radius, 0),
        new Vector(0, radius, 0),
        new Vector(0, 0, 6)
      ));
      for(let i = 0; i < count; i++) {
        const material = new Material({ fill: new Color(parseInt(seed.substring(0,2), 16) * (0.5 + rand() * 0.5), 100 + parseInt(seed.substring(2,4), 16) * 0.5, rand() * 40, 0.9) });
        let position = new Vector(rand() * 800 - 400, rand() * 800 - 400, 0);
        while(this.onTrack(position, radius)) {
          position = new Vector(rand() * 800 - 400, rand() * 800 - 400, 0);
        }
        const heightScale = rand() + 1;
        this.urbject.addChild(new MeshUrbject({
          mesh: treeMesh,
          material,
          state: Urbject.Z_BILLBOARD,
          position,
          scale: new Vector(1, 1, heightScale)
        }));
      }
    }
  }

  public addTo(parent: Scene | Urbject) {
    if(parent instanceof Scene) {
      parent.add(this.urbject);
    } else {
      parent.addChild(this.urbject);
    }
  }

  public onTrack(position: Vector, radius: number) {
    const possibleOverlaps = this.trigonPocket.search(radius, { x: position.x, y: position.y });
    for(const overlap of possibleOverlaps) {
      if(inTrigonHitbox(overlap.data, position)) {
        return true;
      }
    }
    return false;
  }

  public nearTrigons(position: Vector, radius: number) {
    return [...this.trigonPocket.search(radius, { x: position.x, y: position.y })].map(x => x.data);
  }

  public totalTrigons() {
    return this.mesh.trigons.length;
  }

}

export function buildTrack(seed: string) {

  // Get seeded randomness function:
  const rand = mulberry32(parseSeed(seed));

  // Track constants:
  const numPoints = 12;
  const radius = 180;
  const maxRadius = 360;
  const trackWidth = 12;

  // Track points:
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    let a = i * Math.PI * 2 / numPoints;
    points.push(new Vector(Math.cos(a) * radius, Math.sin(a) * radius));
  }

  // Place 1st point in the middle of the previous and next points to create a good starting straight
  const startLineDiff = Vector.sub(points[2], points[0]);
  points[1] = Vector.add(points[0], Vector.mult(startLineDiff, 0.5));

  // Function to check if track might intersect itself:
  const validPoints = (points: Vector[]) => {
    const pocket = new Pocket<number>();
    for(let i = 0; i < points.length; i++) {
      const prev = (i == 0) ? points[points.length - 1] : points[i - 1];
      const p0 = points[i];
      const p1 = (i == points.length - 1) ? points[0] : points[i + 1];
      const prevDiff = Vector.sub(prev, p0);
      const diff = Vector.sub(p1, p0);
      if(prevDiff.angleBetween(diff) < Math.PI / 4) return false;
      const diffNorm = Vector.normalize(diff);
      const dist = diff.mag();
      const hitRadius = trackWidth / 2;
      for(let d = 0; d < dist; d += hitRadius * 2) {
        const pos = Vector.add(p0, Vector.mult(diffNorm, d));
        pocket.put(new Particle({
          x: pos.x,
          y: pos.y,
          radius: hitRadius,
          data: i
        }));
      }
    }
    for(let i = 0; i < points.length; i++) {
      const p = points[i];
      const prev = (i == 0) ? points.length - 1 : i - 1;
      for(const particle of pocket.search(trackWidth * 5, p)) {
        if(particle.data != i && particle.data != prev) return false;
      }
    }
    return true;
  };

  // Iterate through points (skip first 3 to maintain starting straight), try to move them in a random direction until they intersect the track:
  for(let i = 3; i < points.length; i++) {
    const angle = rand() * Math.PI * 2;
    const direction = new Vector(1, 0).rotateZ(angle);
    const maxDistance = maxRadius + radius;
    for(let t = 0; t < maxDistance; t++) {
      let lastValidPosition = points[i].copy();
      points[i].add(Vector.mult(direction, 2));
      if(points[i].mag() > maxRadius || !validPoints(points)) {
        points[i] = lastValidPosition;
        break;
      }
    }
  }

  // construct track mesh from interpolated points:
  const mesh = new Mesh();
  const startLine = { p0: new Vector(), p1: new Vector };
  for (let i = 0; i < numPoints; i++) {
    const prev = i == 0 ? points[numPoints - 1] : points[i - 1];
    const current = points[i];
    const next = i + 1 == numPoints ? points[0] : points[i + 1];
    const last = i + 2 >= numPoints ? points[i + 2 - numPoints] : points[i + 2];
    const segments = curve(prev.x, prev.y, current.x, current.y, next.x, next.y, last.x, last.y, trackWidth, trackWidth);
    if(i == 1) {
      // Set start line:
      startLine.p0 = segments[0][0];
      startLine.p1 = segments[0][1];
    }
    for(const s of segments) {
      mesh.addTrigon([
        new Trigon(s[0], s[2], s[1]),
        new Trigon(s[0], s[3], s[2])
      ].filter(t => t.getNormal().z > 0));
    }
  }

  // Return mesh and start line:
  return {
    mesh: mesh,
    startLine
  };
  
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
      const iterations = Num.constrain(Math.ceil(dist / 5), 3, 8);
      const points: { x: number, y: number, w: number }[] = new Array(iterations + 1);
      for (let i = 0; i < iterations + 1; i++) {
          const u = (1.0 * i) / iterations;
          const ui = 1 - u;

          // Catmull-Rom
          const cat_x = 0.5 * (((-x0 + 3 * x1 - 3 * x2 + x3) * u + (2 * x0 - 5 * x1 + 4 * x2 - x3)) * u + (-x0 + x2)) * u + x1;
          const cat_y = 0.5 * (((-y0 + 3 * y1 - 3 * y2 + y3) * u + (2 * y0 - 5 * y1 + 4 * y2 - y3)) * u + (-y0 + y2)) * u + y1;

          const pw = u * w2 + ui * w1;
          points[i] = { x: cat_x, y: cat_y, w: pw };
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
          segments.push([s0, s1, s2, s3]);
      }
  }
  return segments;
}
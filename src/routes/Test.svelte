<script type="ts">
  import { Particle, Pocket } from "@midpoint68/pocket";
  import { onMount } from "svelte";
  import { mulberry32, parseSeed } from "../ts/random";
import { buildTrack } from "../ts/track";

  export let params: { seed: string };
  let seed = params.seed;
  let canvas: HTMLCanvasElement;

  // Get seeded randomness function:
  const rand = mulberry32(parseSeed(seed));

  // Track constants:
  const numPoints = 12;
  const radius = 180;
  const maxRadius = 360;
  const trackWidth = 12;

  // Track Points:
  const points: Vector[] = [];
  let pocket: Pocket<number>;

  // Function to check if track might intersect itself:
  const validPoints = (points: Vector[]) => {
    pocket = new Pocket<number>();
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

  let pointIndex = 2;
  let t = 0;
  let angle: number;
  let direction: Vector;
  let maxDistance: number = 0;
  let play = true;

  const next = () => {
    if(t >= maxDistance) {
      pointIndex++;
      t = 0;
      angle = rand() * Math.PI * 2;
      direction = new Vector(1, 0).rotateZ(angle);
      maxDistance = maxRadius + radius;
    }
    if(pointIndex >= points.length) return false;
    let lastValidPosition = points[pointIndex].copy();
    points[pointIndex].add(Vector.mult(direction, 2));
    const valid = validPoints(points);
    if(points[pointIndex].mag() > maxRadius || !valid) {
      points[pointIndex] = lastValidPosition;
      t = maxDistance; // break
    }

    // Draw state:
    const ctx = canvas.getContext('2d');
    if(!ctx) throw new Error("Could not get context");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);

    for(let i = 0; i < points.length; i++) {
      const next = (i == points.length - 1) ? points[0] : points[i + 1];
      ctx.strokeStyle = "black";
      ctx.lineWidth = trackWidth;
      ctx.beginPath();
      ctx.moveTo(points[i].x, points[i].y);
      ctx.lineTo(next.x, next.y);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "lime";
      ctx.beginPath();
      ctx.ellipse(points[i].x, points[i].y, trackWidth * 5, trackWidth * 5, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    for(const particle of pocket.all()) {
      ctx.strokeStyle = "red";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(particle.x, particle.y, particle.radius, particle.radius, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    return true;
  };

  onMount(() => {

    // Track points:
    for (let i = 0; i < numPoints; i++) {
      let a = i * Math.PI * 2 / numPoints;
      points.push(new Vector(Math.cos(a) * radius, Math.sin(a) * radius));
    }

    // Place 1st point in the middle of the previous and next points to create a good starting straight
    const startLineDiff = Vector.sub(points[2], points[0]);
    points[1] = Vector.add(points[0], Vector.mult(startLineDiff, 0.5));

    const interval = setInterval(() => {
      if(play) {
        if(!next()) {

          // Stop loop
          clearInterval(interval);

          // done, render mesh
          const ctx = canvas.getContext('2d');
          if(!ctx) throw new Error("Could not get ctx.");
          ctx.fillStyle = "#88888844";
          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          const track = buildTrack(seed);
          for(const trigon of track.mesh.trigons) {
            ctx.beginPath();
            ctx.moveTo(trigon.v0.x, trigon.v0.y);
            ctx.lineTo(trigon.v1.x, trigon.v1.y);
            ctx.lineTo(trigon.v2.x, trigon.v2.y);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }
      }
    }, 10);

  });

</script>

<canvas bind:this={canvas} width={900} height={900}></canvas>

<button on:click={() => play = !play}>play / pause</button>
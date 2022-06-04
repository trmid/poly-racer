<script type="ts">
  import { link } from "svelte-spa-router";
  import { slug } from "../ts/simpleSlug";
  import { onDestroy, onMount } from "svelte";

  // Mesh Imports:
  import raceCarBodySTL from "../../assets/racecar_body.stl.json";
  import raceCarBackWheelsSTL from "../../assets/racecar_back_wheels.stl.json";
  import raceCarFrontWheelSTL from "../../assets/racecar_front_wheel.stl.json";

  // export let params: { seed: string } | undefined;

  // Canvas:
  let canvas: HTMLCanvasElement;

  // Create Scene:
  const scene = new Scene();
  scene.add(new AmbientLight());
  scene.add(new DirectionalLight({
      color: new Color("white"),
      direction: new Vector(1,1,-5),
      brightness: 1
  }));

  // Construct sky:
  {
    const scale = 10000;
    const resolution = 16;
    const skyMesh = new Mesh();
    for(let i = 0; i < resolution; i++) {
      let a0 = Math.PI * 2 * i / resolution;
      let a1 = Math.PI * 2 * (i+1) / resolution;
      skyMesh.addTrigon(new Trigon(
        Vector.yAxis().rotateZ(a0),
        Vector.zAxis(),
        Vector.yAxis().rotateZ(a1),
      ));
    }
    skyMesh.scale(scale);
    scene.add(new MeshUrbject({
      mesh: skyMesh,
      material: new Material({
        fill: new Color("#87CEEB"),
        lit: false
      }),
      group: -100
    }));
  }

  // Add dirt:
  {
    const count = 100;
    for(let i = 0; i < count; i++) {
      const dirtMesh = Mesh.plane().scale(new Vector(1 + Math.random() * 10, 1 + Math.random() * 10, 1));
      const dirt = new MeshUrbject({
        position: new Vector(Math.random() * 300 - 50, Math.random() * 300 - 50),
        orientation: Quaternion.fromAxisRotation(Vector.Z_AXIS, Math.random()*Math.PI),
        group: -5,
        state: Urbject.STATIC,
        mesh: dirtMesh,
        material: new Material({ fill: new Color(40) })
      });
      scene.add(dirt);
    }
  }

  // Create Camera:
  const defaultCameraPosition = new Vector(-5, 0, 2);
  const defaultCameraOrientation = Quaternion.fromVector(new Vector(5, 0, -1));
  const camera = new Camera({
      position: defaultCameraPosition,
      orientation: defaultCameraOrientation,
      fov: 90,
      nearClip: 0.2
  });

  // Create Car Body:
  const carBody = new MeshUrbject({
    position: new Vector(0, 0, 0),
    mesh: Mesh.generateFromArrayData(raceCarBodySTL).rotateZ(Math.PI/2),
    material: new Material({
      fill: new Color("red"),
    })
  });
  scene.add(carBody);

  // Add camera to carBody
  carBody.addChild(camera);

  // Create wheel material:
  const wheelMat = new Material({ fill: new Color(30) });

  // Create Car Back Wheels:
  const backWheelTransform = new Vector(-0.91263, 0, 0.29288);
  const backWheels = new MeshUrbject({
    position: backWheelTransform,
    mesh: Mesh.generateFromArrayData(raceCarBackWheelsSTL).rotateZ(Math.PI/2).translate(Vector.neg(backWheelTransform)),
    material: wheelMat
  });
  carBody.addChild(backWheels);

  // Create Car Front Left Wheel:
  const frontLeftWheelTransform = new Vector(1.7235, 0.56901, 0.21777);
  const frontLeftWheelMesh = Mesh.generateFromArrayData(raceCarFrontWheelSTL).rotateZ(Math.PI/2).translate(Vector.neg(frontLeftWheelTransform));
  const frontLeftAxel = new Urbject({
    position: frontLeftWheelTransform,
  });
  const frontLeftWheel = new MeshUrbject({
    mesh: frontLeftWheelMesh,
    material: wheelMat
  });
  frontLeftAxel.addChild(frontLeftWheel);
  carBody.addChild(frontLeftAxel);

  // Create Car Front Right Wheel:
  const frontRightWheelTransform = Vector.mult(frontLeftWheelTransform, new Vector(1, -1, 1));
  const frontRightWheelMesh = Mesh.scale(frontLeftWheelMesh, new Vector(1,-1,1)).inverseNormals();
  const frontRightAxel = new Urbject({
    position: frontRightWheelTransform,
  });
  const frontRightWheel = new MeshUrbject({
    mesh: frontRightWheelMesh,
    material: wheelMat
  });
  frontRightAxel.addChild(frontRightWheel);
  carBody.addChild(frontRightAxel);

  // Key events:
  let left = false;
  let right = false;
  let up = false;
  let down = false;
  function keydown(e: KeyboardEvent) {
    switch(e.key) {
      case "ArrowRight": {
        right = true;
        break;
      }
      case "ArrowLeft": {
        left = true;
        break;
      }
      case "ArrowUp": {
        up = true;
        break;
      }
      case "ArrowDown": {
        down = true;
        break;
      }
    }
  }
  function keyup(e: KeyboardEvent) {
    switch(e.key) {
      case "ArrowRight": {
        right = false;
        break;
      }
      case "ArrowLeft": {
        left = false;
        break;
      }
      case "ArrowUp": {
        up = false;
        break;
      }
      case "ArrowDown": {
        down = false;
        break;
      }
    }
  }

  // Car state:
  let direction = new Vector(1, 0, 0);
  let speed = 0; // m/s
  let maxSpeed = 103.47 // m/s
  let acceleration = new Vector(); // m/(s*s)
  const forwardAcceleration = new Vector(9.92);
  const reverseAcceleration = Vector.neg(forwardAcceleration).mult(3);
  const drag = new Vector(-1);
  let turnAngle = 0; // radians
  let maxTurn = Math.PI / 18;
  let turnSensitivity = 0.8; // radians / sec
  const backWheelCircumference = 2.08; // m
  const frontWheelCircumference = 1.60; // m

  // Frame callback:
  const timer = new Stats();
  function draw() {
    const t = timer.readCheckpoint() / 1000;

    // Handle Acceleration:
    acceleration = new Vector();
    if(up) {
      acceleration.add(Vector.qRotate(forwardAcceleration, carBody.orientation));
    }
    if(down) {
      acceleration.add(Vector.qRotate(reverseAcceleration, carBody.orientation));
    }

    // Drag:
    {
      acceleration.add(Vector.qRotate(drag, carBody.orientation));
    }

    // Handle Velocity:
    let velocity = Vector.mult(direction, speed);
    let deltaVelocity = Vector.mult(acceleration, t);
    let newVelocity = Vector.add(velocity, deltaVelocity);
    if(newVelocity.angleBetween(direction) > Math.PI / 2) {
      velocity = new Vector();
    } else {
      velocity = newVelocity;
    }
    
    // Handle Speed:
    speed = velocity.mag();
    if(speed < 0.0001) {
      // full stop
      speed = 0;
    } else if(speed > maxSpeed) {
      // limit
      speed = maxSpeed;
    }
    backWheels.orientation.rotateY(t * Math.PI * 2 * speed / backWheelCircumference);
    frontLeftWheel.orientation.rotateY(t * Math.PI * 2 * speed / frontWheelCircumference);
    frontRightWheel.orientation.rotateY(t * Math.PI * 2 * speed / frontWheelCircumference);

    // Handle turning:
    let turnDirection = (left ? 1 : 0) + (right ? -1 : 0);
    if(turnDirection == 0) turnDirection = -Math.sign(turnAngle);
    let turnSpeedModifier = (1 - speed / (maxSpeed * 1.5));
    let currentMaxTurn = maxTurn * turnSpeedModifier;
    let newTurnAngle = Num.constrain(turnAngle + (turnDirection * turnSensitivity * turnSpeedModifier * t) * (turnDirection == -Math.sign(turnAngle) ? 1.5 : 1), -currentMaxTurn, currentMaxTurn);
    if(turnAngle != 0 && Math.sign(turnAngle) != Math.sign(newTurnAngle)) {
      turnAngle = 0;
    } else {
      turnAngle = newTurnAngle;
    }
    frontLeftAxel.orientation = Quaternion.fromAxisRotation(Vector.Z_AXIS, turnAngle);
    frontRightAxel.orientation = frontLeftAxel.orientation.copy();

    // Transfer velocity into turn:
    let heading = Vector.rotateZ(direction, turnAngle);
    let noseDelta = Vector.mult(heading, speed * t);
    let noseOffset = frontLeftWheelTransform.x
    let nose = Vector.add(new Vector(noseOffset).qRotate(carBody.orientation), noseDelta);
    direction = Vector.project(direction, nose);
    speed *= direction.mag(); // lose some speed when turning
    direction.normalize();

    // Move car towards nose position:
    let carOrientation = Quaternion.fromVector(direction, Vector.xAxis());
    carBody.translate(Vector.mult(direction, Vector.sub(nose, new Vector(noseOffset).qRotate(carOrientation)).mag()));
    carBody.orientation = carOrientation;

    // Move camera orientation based off of heading and speed:
    camera.position = Vector.add(defaultCameraPosition, new Vector(-1).mult(speed / maxSpeed).rotateZ(turnAngle*2));
    // camera.orientation = Quaternion.rotateZ(defaultCameraOrientation, turnAngle * (speed / maxSpeed));
    
  }

  // On Mount:
  let renderer: PerformanceRenderer;
  onMount(() => {
    renderer = new PerformanceRenderer({
        canvas,
        frameCallback: draw,
        backgroundColor: new Color(50),
        showPerformance: true
    });
    window.addEventListener("focus", function () { timer.startTimer(); renderer.start(scene, camera); });
    window.addEventListener("blur", function () { renderer.stop(); });
    renderer.start(scene, camera);
  });
  onDestroy(() => {
    renderer.stop();

    // Reload page when navigating away to prevent render worker persistence:
    location.reload();
  });

</script>

<svelte:window on:keydown={keydown} on:keyup={keyup}></svelte:window>

<canvas bind:this={canvas} width="900" height="640"></canvas>

<style>
  canvas {
    margin: 1rem;
  }
</style>
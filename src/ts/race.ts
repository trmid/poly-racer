// Mesh Imports:
import raceCarBodySTL from "../../assets/racecar_body.stl.json";
import raceCarBackWheelsSTL from "../../assets/racecar_back_wheels.stl.json";
import raceCarFrontWheelSTL from "../../assets/racecar_front_wheel.stl.json";
import { now, PolySynth, Synth, Transport, Volume } from "tone";
import { buildTrackMesh } from "./track";
import { EngineSound } from "./engine";
import { writable } from "svelte/store";

export class Race {

  // Renderer:
  private renderer: PerformanceRenderer;

  // Timer:
  private timer = new Stats();

  // Game state:
  private playing = false;
  private paused = true;
  private done = false;
  private unpauseTimeouts: NodeJS.Timeout[] = [];
  private gameTime = 0;

  // Lap Settings:
  static totalLaps = 3;

  // Stores:
  public stores = {
    centerText: writable("Click to Start!"),
    speed: writable(0),
    paused: writable(this.paused),
    gameTime: writable(0),
    completedLaps: writable<number[]>([]),
  };
  
  // Sound Settings:
  private volumeNode = new Volume(-10);

  // Scene:
  private scene: Scene;

  // Camera:
  private camera: Camera;
  static defaultCameraPosition = new Vector(-5, 0, 2);
  static defaultCameraOrientation = Quaternion.fromVector(new Vector(5, 0, -1));

  // Engine Noise:
  private engineSound = new EngineSound(this.volumeNode);

  // Countdown Noise:
  private countdownSynth: PolySynth | undefined;

  // Urbjects:
  private car: MeshUrbject;
  private frontLeftAxel: Urbject;
  private frontRightAxel: Urbject;
  private frontLeftWheel: MeshUrbject;
  private frontRightWheel: MeshUrbject;
  private backWheels: MeshUrbject;

  // Car Physics:
  private direction = new Vector(1, 0, 0);
  private speed = 0; // m/s
  static maxSpeed = 103.47 // m/s
  private acceleration = new Vector(); // m/(s*s)
  static forwardAcceleration = new Vector(9.92);
  static reverseAcceleration = Vector.neg(Race.forwardAcceleration).mult(3.5);
  static drag = new Vector(-9.92);
  private turnAngle = 0; // radians
  private maxTurn = Math.PI * 0.05;
  private turnSensitivity = 0.5; // radians / sec
  static backWheelCircumference = 2.08; // m
  static frontWheelCircumference = 1.60; // m
  static frontWheelXOffset = 1.7235; //m

  // Key states:
  private up = false;
  private down = false;
  private left = false;
  private right = false;

  // Listeners:
  private eventListeners: {element: Window | Element, event: string, function: <E extends Event>(e: E) => void}[] = [];

  constructor(readonly seed: string, readonly canvas: HTMLCanvasElement) {

    // Create reference to self:
    const self = this;

    // Create Scene:
    const scene = new Scene();
    this.scene = scene;
    scene.add(new AmbientLight());
    scene.add(new DirectionalLight({
        color: new Color("white"),
        direction: new Vector(1,1,-5),
        brightness: 1
    }));

    // Construct track from seed:
    const trackMesh = buildTrackMesh(seed);
    const track = new MeshUrbject({
      mesh: trackMesh,
      material: new Material({fill: new Color(parseInt(seed.substring(0,2), 16), 100, 50)}),
      group: -1,
      scale: 0.8
    });
    scene.add(track);

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
      // const count = 100;
      // for(let i = 0; i < count; i++) {
      //   const dirtMesh = Mesh.plane().scale(new Vector(1 + Math.random() * 10, 1 + Math.random() * 10, 1));
      //   const dirt = new MeshUrbject({
      //     position: new Vector(Math.random() * 300 - 150, Math.random() * 300 - 150),
      //     orientation: Quaternion.fromAxisRotation(Vector.Z_AXIS, Math.random()*Math.PI),
      //     group: -5,
      //     state: Urbject.STATIC,
      //     mesh: dirtMesh,
      //     material: new Material({ fill: new Color(40) })
      //   });
      //   scene.add(dirt);
      // }
    }

    // Add trees:
    {
      const count = 100;
      const treeMesh = new Mesh();
      treeMesh.addTrigon(new Trigon(
        new Vector(0, -1, 0),
        new Vector(0, 1, 0),
        new Vector(0, 0, 4)
      ));
      for(let i = 0; i < count; i++) {
        scene.add(new MeshUrbject({
          mesh: treeMesh,
          material: new Material({ fill: new Color(0, 100 + Math.random() * 80, Math.random() * 20, 0.9) }),
          state: Urbject.Z_BILLBOARD,
          position: new Vector(Math.random() * 300 - 150, Math.random() * 300 - 150, 0),
          scale: new Vector(1, 1, Math.random() + 1)
        }));
      }
    }

    // Create Camera:
    const camera = new Camera({
        position: Race.defaultCameraPosition,
        orientation: Race.defaultCameraOrientation,
        fov: 90,
        nearClip: 0.2
    });
    this.camera = camera;

    // Create Car Body:
    const carBody = new MeshUrbject({
      position: new Vector(0, 0, 0),
      mesh: Mesh.generateFromArrayData(raceCarBodySTL).rotateZ(Math.PI/2),
      material: new Material({
        fill: new Color("red"),
      })
    });
    this.car = carBody;
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
    this.backWheels = backWheels;
    carBody.addChild(backWheels);

    // Create Car Front Left Wheel:
    const frontLeftWheelTransform = new Vector(Race.frontWheelXOffset, 0.56901, 0.21777);
    const frontLeftWheelMesh = Mesh.generateFromArrayData(raceCarFrontWheelSTL).rotateZ(Math.PI/2).translate(Vector.neg(frontLeftWheelTransform));
    const frontLeftAxel = new Urbject({
      position: frontLeftWheelTransform,
    });
    const frontLeftWheel = new MeshUrbject({
      mesh: frontLeftWheelMesh,
      material: wheelMat
    });
    this.frontLeftAxel = frontLeftAxel;
    this.frontLeftWheel = frontLeftWheel;
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
    this.frontRightAxel = frontRightAxel;
    this.frontRightWheel = frontRightWheel;
    frontRightAxel.addChild(frontRightWheel);
    carBody.addChild(frontRightAxel);

    // Add renderer:
    this.renderer = new PerformanceRenderer({
      canvas,
      frameCallback: () => this.draw(),
      backgroundColor: new Color(50),
      showPerformance: true
    });
    this.renderer.render(scene, camera);

    // Add window event listeners:
    this.eventListeners.push({
      element: window,
      event: "keydown",
      function: (e: any) => {
        switch(e.key.toUpperCase()) {
          case "W":
          case "ARROWUP": {
            self.up = true;
            break;
          }
          case "A":
          case "ARROWLEFT": {
            self.left = true;
            break;
          }
          case "S":
          case "ARROWDOWN": {
            self.down = true;
            break;
          }
          case "D":
          case "ARROWRIGHT": {
            self.right = true;
            break;
          }
        }
      }
    },{
      element: window,
      event: "keyup",
      function: (e: any) => {
        switch(e.key.toUpperCase()) {
          case "W":
          case "ARROWUP": {
            self.up = false;
            break;
          }
          case "A":
          case "ARROWLEFT": {
            self.left = false;
            break;
          }
          case "S":
          case "ARROWDOWN": {
            self.down = false;
            break;
          }
          case "D":
          case "ARROWRIGHT": {
            self.right = false;
            break;
          }
        }
      }
    },
    {
      element: window,
      event: "blur",
      function: (e: any) => {
        this.pause();
      }
    },
    {
      element: canvas,
      event: "click",
      function: (e: any) => {
        if(self.paused) self.start();
        else self.pause();
      }
    });
    for(const listener of this.eventListeners) {
      listener.element.addEventListener(listener.event, listener.function);
    }

  }

  public setVolume(volume: number) {
    volume = Num.constrain(volume, 0, 1);
    if(volume == 0) {
      this.volumeNode.mute = true;
    } else {
      this.volumeNode.volume.value = (1 - volume) * -32;
    }
  }

  public start() {

    if(this.paused) {

      // Unpause game:
      this.paused = false;
      this.stores.paused.set(false);
      this.canvas.focus();

      // Set center text:
      this.stores.centerText.set("");

      // Start rendering:
      this.timer.startTimer();
      this.renderer.start(this.scene, this.camera);

      // Connect volume node:
      this.volumeNode.toDestination();

      // Create starting sound:
      if(!this.countdownSynth) {
        this.countdownSynth = new PolySynth(Synth).connect(this.volumeNode);
        this.countdownSynth.unsync();
        this.countdownSynth.volume.value = -8;
      }
      const toneNow = now();
      this.countdownSynth.triggerAttackRelease(["C3","C4","C5"], 0.25, toneNow);
      this.countdownSynth.triggerAttackRelease(["C3","C4","C5"], 0.25, toneNow + 1);
      this.countdownSynth.triggerAttackRelease(["C3","C4","C5"], 0.25, toneNow + 2);
      this.countdownSynth.triggerAttackRelease(["G3","G4","G5"], 0.25, toneNow + 3);

      // Start engine sound:
      this.engineSound.start();

      // Set game state:
      this.stores.centerText.set("3");
      this.unpauseTimeouts = [
        setTimeout(() => this.stores.centerText.set("2"), 1000),
        setTimeout(() => this.stores.centerText.set("1"), 2000),
        setTimeout(() => {
          this.stores.centerText.set("GO!");
          this.playing = true;
        }, 3000),
        setTimeout(() => this.stores.centerText.set(""), 4000)
      ];

    }

  }

  public pause() {
    if(!this.paused) {

      // Set center text:
      this.stores.centerText.set("Click to Resume...");

      // Clear unpause timeouts:
      for(const timeout of this.unpauseTimeouts) {
        clearTimeout(timeout);
      }

      // Pause game:
      this.playing = false;
      this.paused = true;
      this.stores.paused.set(true);
      this.renderer.stop();
      
      // Pause engine sounds:
      this.engineSound.stop();

      // Pause countdown sound:
      this.countdownSynth?.disconnect();
      this.countdownSynth = undefined;

      // Disconnection volume node:
      this.volumeNode.disconnect();

    }
  }

  /**
   * Frame callback:
   */
  private draw() {
    const millisecondsElapsed = this.timer.readCheckpoint();
    const t = millisecondsElapsed / 1000;

    if(this.playing) {
      // Add to game time:
      this.gameTime += millisecondsElapsed;
      this.stores.gameTime.set(this.gameTime);
      
      // Handle Acceleration:
      this.acceleration = new Vector();
      if(this.up) {
        // Gas:
        this.acceleration.add(Vector.qRotate(Vector.mult(Race.forwardAcceleration, this.speed < Race.maxSpeed / 2 ? Math.min(4, Race.maxSpeed / this.speed) : 1), this.car.orientation));
      } else {
        // Drag:
        this.acceleration.add(Vector.qRotate(Race.drag, this.car.orientation));
      }
      if(this.down) {
        // Braking:
        this.acceleration.add(Vector.qRotate(Race.reverseAcceleration, this.car.orientation));
      }

      // Handle Velocity:
      let velocity = Vector.mult(this.direction, this.speed);
      let deltaVelocity = Vector.mult(this.acceleration, t);
      let newVelocity = Vector.add(velocity, deltaVelocity);
      if(newVelocity.angleBetween(this.direction) > Math.PI / 2) {
        velocity = new Vector();
      } else {
        velocity = newVelocity;
      }
      
      // Handle Speed:
      this.speed = velocity.mag();
      if(this.speed < 0.0001) {
        // full stop
        this.speed = 0;
      } else if(this.speed > Race.maxSpeed) {
        // limit
        this.speed = Race.maxSpeed;
      }
      this.backWheels.orientation.rotateY(t * Math.PI * 2 * this.speed / Race.backWheelCircumference);
      this.frontLeftWheel.orientation.rotateY(t * Math.PI * 2 * this.speed / Race.frontWheelCircumference);
      this.frontRightWheel.orientation.rotateY(t * Math.PI * 2 * this.speed / Race.frontWheelCircumference);

      // Update engine noise:
      this.engineSound.update(this.speed / Race.maxSpeed);

      // Handle turning:
      let turnDirection = (this.left ? 1 : 0) + (this.right ? -1 : 0);
      if(turnDirection == 0) turnDirection = -Math.sign(this.turnAngle);
      let turnSpeedModifier = Math.pow(1 - this.speed / (Race.maxSpeed * 1.5), 2);
      let currentMaxTurn = this.maxTurn * turnSpeedModifier;
      let newTurnAngle = Num.constrain(this.turnAngle + (turnDirection * this.turnSensitivity * turnSpeedModifier * t) * (turnDirection == -Math.sign(this.turnAngle) ? 1.5 : 1), -currentMaxTurn, currentMaxTurn);
      if(this.turnAngle != 0 && Math.sign(this.turnAngle) != Math.sign(newTurnAngle)) {
        this.turnAngle = 0;
      } else {
        this.turnAngle = newTurnAngle;
      }
      this.frontLeftAxel.orientation = Quaternion.fromAxisRotation(Vector.Z_AXIS, this.turnAngle * 2);
      this.frontRightAxel.orientation = this.frontLeftAxel.orientation.copy();

      // Transfer velocity into turn:
      let heading = Vector.rotateZ(this.direction, this.turnAngle);
      let noseDelta = Vector.mult(heading, this.speed * t);
      let noseOffset = Race.frontWheelXOffset;
      let nose = Vector.add(new Vector(noseOffset).qRotate(this.car.orientation), noseDelta);
      this.direction = Vector.project(this.direction, nose);
      this.speed *= this.direction.mag(); // lose some speed when turning
      this.direction.normalize();

      // Move car towards nose position:
      let carOrientation = Quaternion.fromVector(this.direction, Vector.xAxis());
      this.car.translate(Vector.mult(this.direction, Vector.sub(nose, new Vector(noseOffset).qRotate(carOrientation)).mag()));
      this.car.orientation = carOrientation;

      // Move camera orientation based off of heading and speed:
      this.camera.position = Vector.add(Race.defaultCameraPosition, new Vector(-1).mult(this.speed / Race.maxSpeed).rotateZ(this.turnAngle*2));
      // camera.orientation = Quaternion.rotateZ(defaultCameraOrientation, turnAngle * (this.speed / Race.maxSpeed));

      // Set speed store:
      this.stores.speed.set(this.speed * 60 * 60 / 1000);
    }
  }

  /**
   * Destroys all event listeners and sounds and stops the render.
   * NOTE: Does NOT destroy render workers or stat boxes. Reload the page for this.
   */
  public destroy() {

    // Remove listeners:
    for(const listener of this.eventListeners) {
      listener.element.removeEventListener(listener.event, listener.function);
    }

    // Destroy engine sound:
    this.engineSound.dispose();

    // Destroy countdown sound:
    this.countdownSynth?.dispose();
  }

}
// Mesh Imports:
import raceCarBodySTL from "../../assets/racecar_body.stl.json";

// Imports:
import type { Volume } from "tone";
import { EngineSound } from "./engine";
import type { Track } from "./track";
import { writable } from "svelte/store";
import { linesCross } from "./utils";

// Turn sensitivity store:
export const turnSensitivity = writable(0.5);

// Car class:
export class Car {

  // Car state:
  private onTrack = true;
  private track: Track | undefined;
  private checkpoints: Set<Trigon> = new Set();
  private raceTime = 0;
  readonly laps: number[] = [];

  // Engine Noise:
  public readonly engineSound?: EngineSound;

  // Camera:
  public camera: Camera;
  static defaultCameraPosition = new Vector(-5, 0, 2);
  static defaultCameraOrientation = Quaternion.fromVector(new Vector(5, 0, -1));

  // Materials:
  private wheelMaterial = new Material({ fill: new Color(30) });
  private offTrackWheelMaterial = new Material({ fill: new Color(255, 200, 0, 1) });

  // Urbjects:
  readonly body: MeshUrbject;
  private frontLeftAxel: Urbject;
  private frontRightAxel: Urbject;
  private frontLeftWheel: MeshUrbject;
  private frontRightWheel: MeshUrbject;
  private backLeftWheel: MeshUrbject;
  private backRightWheel: MeshUrbject
  static wheelSegments = 16;

  // Car Physics:
  public direction = new Vector(1, 0, 0);
  private speed = 0; // m/s
  static maxSpeed = 103.47 // m/s
  private acceleration = new Vector(); // m/(s*s)
  static forwardAcceleration = new Vector(9.92);
  static reverseAcceleration = Vector.neg(Car.forwardAcceleration).mult(3.5);
  static drag = new Vector(-9.92);
  private turnAngle = 0; // radians
  private maxTurn = Math.PI * 0.05;
  private _turnSensitivity = 0.5; // radians / sec
  static backWheelCircumference = 2.08; // m
  static frontWheelCircumference = 1.60; // m
  static frontWheelXOffset = 1.7235; // m
  static noseXOffset = 2.732; // m
  static wheelPositions = {
    frontLeft: {
      position: new Vector(1.723, 0.689, 0.2178),
      radius: 0.470214 / 2,
      width: 0.298878
    },
    frontRight: {
      position: new Vector(1.723, -0.689, 0.2178),
      radius: 0.470214 / 2,
      width: 0.298878
    },
    backLeft: {
      position: new Vector(-0.9126, 0.7018, 0.2929),
      radius: 0.633083 / 2,
      width: 0.356393
    },
    backRight: {
      position: new Vector(-0.9126, -0.7018, 0.2929),
      radius: 0.633083 / 2,
      width: 0.356393
    }
  };

  // Key states:
  public up = false;
  public down = false;
  public left = false;
  public right = false;

  constructor({
    audioDestination,
    turnSensitivity,
    isGhostCar,
    track
  }: {
    audioDestination?: Volume
    turnSensitivity?: number
    isGhostCar?: boolean
    track?: Track
  } = {}) {

    // Assign track:
    this.track = track;

    // Assign optional variables:
    if(turnSensitivity && turnSensitivity > 0) this.turnSensitivity = turnSensitivity;

    // Switch wheel material to wire if ghost car:
    if(isGhostCar) {
      this.wheelMaterial = new Material({ wire: this.wheelMaterial.fill, fill: new Color(0, 0) });
      this.offTrackWheelMaterial = new Material({ wire: this.offTrackWheelMaterial.fill, fill: new Color(0, 0) });
    }

    // Create engine sound:
    if(audioDestination) {
      this.engineSound = new EngineSound(audioDestination);
    }

    // Create Camera:
    this.camera = new Camera({
      position: Car.defaultCameraPosition,
      orientation: Car.defaultCameraOrientation,
      fov: 90,
      nearClip: 0.2
    });

    // Create Car Body:
    this.body = new MeshUrbject({
      position: new Vector(0, 0, 0),
      mesh: Mesh.generateFromArrayData(raceCarBodySTL).rotateZ(Math.PI/2),
      material: isGhostCar ?
        new Material({ wire: new Color("red"), fill: new Color(0, 0) }) :
        new Material({ fill: new Color("red") })
    });
    this.body.addChild(this.camera);

    // Create back wheel mesh:
    const backWheelMesh = Mesh.cylinder({
      resolution: Car.wheelSegments,
      outerRadius: Car.wheelPositions.backLeft.radius,
      height: Car.wheelPositions.backLeft.width
    }).rotateX(Math.PI / 2);

    // Create back left wheel:
    this.backLeftWheel = new MeshUrbject({
      mesh: backWheelMesh,
      material: this.wheelMaterial,
      position: Car.wheelPositions.backLeft.position
    });
    this.body.addChild(this.backLeftWheel);

    // Create back right wheel:
    this.backRightWheel = new MeshUrbject({
      mesh: backWheelMesh,
      material: this.wheelMaterial,
      position: Car.wheelPositions.backRight.position
    });
    this.body.addChild(this.backRightWheel);

    // Create front wheel mesh:
    const frontWheelMesh = Mesh.cylinder({
      resolution: Car.wheelSegments,
      outerRadius: Car.wheelPositions.frontLeft.radius,
      height: Car.wheelPositions.frontLeft.width
    }).rotateX(Math.PI / 2);

    // Create Car Front Left Wheel:
    this.frontLeftAxel = new Urbject({
      position: Car.wheelPositions.frontLeft.position,
    });
    this.frontLeftWheel = new MeshUrbject({
      mesh: frontWheelMesh,
      material: this.wheelMaterial
    });
    this.frontLeftAxel.addChild(this.frontLeftWheel);
    this.body.addChild(this.frontLeftAxel);

    // Create Car Front Right Wheel:
    this.frontRightAxel = new Urbject({
      position: Car.wheelPositions.frontRight.position,
    });
    this.frontRightWheel = new MeshUrbject({
      mesh: frontWheelMesh,
      material: this.wheelMaterial
    });
    this.frontRightAxel.addChild(this.frontRightWheel);
    this.body.addChild(this.frontRightAxel);

    // Align to start line:
    if(track) {
      const startLineDiff = Vector.sub(track.startLine.p1, track.startLine.p0);
      const startLineMid = Vector.add(track.startLine.p0, Vector.mult(startLineDiff, 0.5));
      this.body.orientation = Quaternion.fromVector(startLineDiff, Vector.xAxis()).rotateZ(Math.PI/2);
      this.direction = Vector.xAxis().qRotate(this.body.orientation);
      this.body.position = Vector.sub(startLineMid, new Vector(Car.noseXOffset).qRotate(this.body.orientation));
    }

  }

  public update(msElapsed: number) {

    // Check if track exists:
    if(!this.track) {
      throw new Error("Car has not been assigned a track!");
    }

    // Convert to seconds:
    const t = msElapsed / 1000;

    // Add to race time:
    const lastFrameTime = this.raceTime;
    this.raceTime += msElapsed;

    // Get current car position:
    const lastCarPos = this.body.position.copy();

    // Handle Acceleration:
    this.acceleration = new Vector();
    if(this.up) {
      // Gas:
      this.acceleration.add(Vector.qRotate(Vector.mult(Car.forwardAcceleration, this.speed < Car.maxSpeed / 2 ? Math.min(4, Car.maxSpeed / this.speed) : 1), this.body.orientation));
    } else {
      // Drag:
      this.acceleration.add(Vector.qRotate(Car.drag, this.body.orientation));
    }
    if(this.down) {
      // Braking:
      this.acceleration.add(Vector.qRotate(Car.reverseAcceleration, this.body.orientation));
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
    } else if(this.speed > Car.maxSpeed) {
      // limit
      this.speed = Car.maxSpeed;
    }
    this.backLeftWheel.orientation.rotateY(t * this.speed / Car.wheelPositions.backLeft.radius);
    this.backRightWheel.orientation.rotateY(t * this.speed / Car.wheelPositions.backRight.radius);
    this.frontLeftWheel.orientation.rotateY(t * this.speed / Car.wheelPositions.frontLeft.radius);
    this.frontRightWheel.orientation.rotateY(t * this.speed / Car.wheelPositions.frontRight.radius);

    // Update engine noise:
    this.engineSound?.update(this.speed / Car.maxSpeed);

    // Handle turning:
    let turnDirection = (this.left ? 1 : 0) + (this.right ? -1 : 0);
    if(turnDirection == 0) turnDirection = -Math.sign(this.turnAngle);
    let turnSpeedModifier = Math.pow(1 - this.speed / (Car.maxSpeed * 1.5), 2);
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
    let noseOffset = Car.frontWheelXOffset;
    let nose = Vector.add(new Vector(noseOffset).qRotate(this.body.orientation), noseDelta);
    this.direction = Vector.project(this.direction, nose);
    this.speed *= this.direction.mag(); // lose some speed when turning
    this.direction.normalize();

    // Move car towards nose position:
    let carOrientation = Quaternion.fromVector(this.direction, Vector.xAxis());
    this.body.translate(Vector.mult(this.direction, Vector.sub(nose, new Vector(noseOffset).qRotate(carOrientation)).mag()));
    this.body.orientation = carOrientation;

    // Move camera orientation based off of heading and speed:
    this.camera.position = Vector.add(Car.defaultCameraPosition, new Vector(-1).mult(this.speed / Car.maxSpeed).rotateZ(this.turnAngle*2));

    // Check if car is on track:
    this.onTrack = false;

    // Front Left:
    if(this.track.onTrack(Vector.qRotate(Car.wheelPositions.frontLeft.position, this.body.orientation).add(this.body.position), Car.wheelPositions.frontLeft.radius)) {
      this.onTrack = true;
      this.frontLeftWheel.material = this.wheelMaterial;
    } else {
      this.frontLeftWheel.material = this.offTrackWheelMaterial;
    }

    // Front Right:
    if(this.track.onTrack(Vector.qRotate(Car.wheelPositions.frontRight.position, this.body.orientation).add(this.body.position), Car.wheelPositions.frontRight.radius)) {
      this.onTrack = true;
      this.frontRightWheel.material = this.wheelMaterial;
    } else {
      this.frontRightWheel.material = this.offTrackWheelMaterial;
    }

    // Back Left:
    if(this.track.onTrack(Vector.qRotate(Car.wheelPositions.backLeft.position, this.body.orientation).add(this.body.position), Car.wheelPositions.backLeft.radius)) {
      this.onTrack = true;
      this.backLeftWheel.material = this.wheelMaterial;
    } else {
      this.backLeftWheel.material = this.offTrackWheelMaterial;
    }

    // Back Right:
    if(this.track.onTrack(Vector.qRotate(Car.wheelPositions.backRight.position, this.body.orientation).add(this.body.position), Car.wheelPositions.backRight.radius)) {
      this.onTrack = true;
      this.backRightWheel.material = this.wheelMaterial;
    } else {
      this.backRightWheel.material = this.offTrackWheelMaterial;
    }

    // Get new car position:
    const newCarPos = this.body.position.copy();

    // Get checkpoints:
    const checkpoints = this.track.nearTrigons(newCarPos, (Car.noseXOffset - Car.wheelPositions.backLeft.position.x) / 2);
    for(const checkpoint of checkpoints) {
      this.checkpoints.add(checkpoint);
    }

    // Check if car has touched at least 80% of checkpoints:
    if(this.checkpoints.size > 0.8 * this.track.totalTrigons()) {

      // Check if car has cross finish line:
      const noseOffset = new Vector(Car.noseXOffset, 0).qRotate(this.body.orientation);
      const startLineDiff = Vector.sub(this.track.startLine.p1, this.track.startLine.p0);
      const noseIntersection = linesCross(
        Vector.add(lastCarPos, noseOffset),
        Vector.add(newCarPos, noseOffset),
        Vector.sub(this.track.startLine.p0, Vector.mult(startLineDiff, 0.5)),
        Vector.add(this.track.startLine.p1, Vector.mult(startLineDiff, 0.5))
      );
      if(noseIntersection !== undefined) {

        console.log(`${(100 * this.checkpoints.size / this.track.totalTrigons()).toFixed(2)}%`);

        // Reset checkpoints and add lap time:
        this.checkpoints = new Set();

        // Push actual lap time:
        this.laps.push(lastFrameTime + msElapsed * noseIntersection);
      }
    }
  }

  public isOnTrack() {
    return this.onTrack;
  }

  public getSpeed() {
    return this.speed;
  }

  public get turnSensitivity() {
    return this._turnSensitivity;
  }

  public set turnSensitivity(turnSensitivity: number) {
    if(turnSensitivity <= 0) throw new Error("Turn sensitivity must be greater than zero.");
    this._turnSensitivity = turnSensitivity;
  }

}
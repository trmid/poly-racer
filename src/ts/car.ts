// Mesh Imports:
import raceCarBodySTL from "../../assets/racecar_body.stl.json";

// Imports:
import type { Volume } from "tone";
import { EngineSound } from "./engine";
import type { Track } from "./track";

export class Car {

  // Car state:
  private onTrack = true;

  // Engine Noise:
  public readonly engineSound: EngineSound;

  // Camera:
  public camera: Camera;
  static defaultCameraPosition = new Vector(-5, 0, 2);
  static defaultCameraOrientation = Quaternion.fromVector(new Vector(5, 0, -1));

  // Materials:
  static wheelMaterial = new Material({ fill: new Color(30) });
  static offTrackWheelMaterial = new Material({ fill: new Color(200, 200, 0, 1) });

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
  private turnSensitivity = 0.5; // radians / sec
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

  constructor(audioDestination: Volume) {

    // Create engine sound:
    this.engineSound = new EngineSound(audioDestination);

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
      material: new Material({
        fill: new Color("red"),
      })
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
      material: Car.wheelMaterial,
      position: Car.wheelPositions.backLeft.position
    });
    this.body.addChild(this.backLeftWheel);

    // Create back right wheel:
    this.backRightWheel = new MeshUrbject({
      mesh: backWheelMesh,
      material: Car.wheelMaterial,
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
      material: Car.wheelMaterial
    });
    this.frontLeftAxel.addChild(this.frontLeftWheel);
    this.body.addChild(this.frontLeftAxel);

    // Create Car Front Right Wheel:
    this.frontRightAxel = new Urbject({
      position: Car.wheelPositions.frontRight.position,
    });
    this.frontRightWheel = new MeshUrbject({
      mesh: frontWheelMesh,
      material: Car.wheelMaterial
    });
    this.frontRightAxel.addChild(this.frontRightWheel);
    this.body.addChild(this.frontRightAxel);

  }

  public update(t: number, track: Track) {
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
    this.engineSound.update(this.speed / Car.maxSpeed);

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
    if(track.onTrack(Vector.qRotate(Car.wheelPositions.frontLeft.position, this.body.orientation).add(this.body.position), Car.wheelPositions.frontLeft.radius)) {
      this.onTrack = true;
      this.frontLeftWheel.material = Car.wheelMaterial;
    } else {
      this.frontLeftWheel.material = Car.offTrackWheelMaterial;
    }

    // Front Right:
    if(track.onTrack(Vector.qRotate(Car.wheelPositions.frontRight.position, this.body.orientation).add(this.body.position), Car.wheelPositions.frontRight.radius)) {
      this.onTrack = true;
      this.frontRightWheel.material = Car.wheelMaterial;
    } else {
      this.frontRightWheel.material = Car.offTrackWheelMaterial;
    }

    // Back Left:
    if(track.onTrack(Vector.qRotate(Car.wheelPositions.backLeft.position, this.body.orientation).add(this.body.position), Car.wheelPositions.backLeft.radius)) {
      this.onTrack = true;
      this.backLeftWheel.material = Car.wheelMaterial;
    } else {
      this.backLeftWheel.material = Car.offTrackWheelMaterial;
    }

    // Back Right:
    if(track.onTrack(Vector.qRotate(Car.wheelPositions.backRight.position, this.body.orientation).add(this.body.position), Car.wheelPositions.backRight.radius)) {
      this.onTrack = true;
      this.backRightWheel.material = Car.wheelMaterial;
    } else {
      this.backRightWheel.material = Car.offTrackWheelMaterial;
    }

  }

  public isOnTrack() {
    return this.onTrack;
  }

  public getSpeed() {
    return this.speed;
  }

}
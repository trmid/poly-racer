// Mesh Imports:
import raceCarBodySTL from "../../assets/racecar_body.stl.json";
import raceCarBackWheelsSTL from "../../assets/racecar_back_wheels.stl.json";
import raceCarFrontWheelSTL from "../../assets/racecar_front_wheel.stl.json";

// Imports:
import type { Volume } from "tone";
import { EngineSound } from "./engine";

export class Car {

  // Engine Noise:
  public readonly engineSound: EngineSound;

  // Camera:
  public camera: Camera;
  static defaultCameraPosition = new Vector(-5, 0, 2);
  static defaultCameraOrientation = Quaternion.fromVector(new Vector(5, 0, -1));

  // Urbjects:
  readonly body: MeshUrbject;
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
  static reverseAcceleration = Vector.neg(Car.forwardAcceleration).mult(3.5);
  static drag = new Vector(-9.92);
  private turnAngle = 0; // radians
  private maxTurn = Math.PI * 0.05;
  private turnSensitivity = 0.5; // radians / sec
  static backWheelCircumference = 2.08; // m
  static frontWheelCircumference = 1.60; // m
  static frontWheelXOffset = 1.7235; //m

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

    // Create wheel material:
    const wheelMat = new Material({ fill: new Color(30) });

    // Create Car Back Wheels:
    const backWheelTransform = new Vector(-0.91263, 0, 0.29288);
    this.backWheels = new MeshUrbject({
      position: backWheelTransform,
      mesh: Mesh.generateFromArrayData(raceCarBackWheelsSTL).rotateZ(Math.PI/2).translate(Vector.neg(backWheelTransform)),
      material: wheelMat
    });
    this.body.addChild(this.backWheels);

    // Create Car Front Left Wheel:
    const frontLeftWheelTransform = new Vector(Car.frontWheelXOffset, 0.56901, 0.21777);
    const frontLeftWheelMesh = Mesh.generateFromArrayData(raceCarFrontWheelSTL).rotateZ(Math.PI/2).translate(Vector.neg(frontLeftWheelTransform));
    this.frontLeftAxel = new Urbject({
      position: frontLeftWheelTransform,
    });
    this.frontLeftWheel = new MeshUrbject({
      mesh: frontLeftWheelMesh,
      material: wheelMat
    });
    this.frontLeftAxel.addChild(this.frontLeftWheel);
    this.body.addChild(this.frontLeftAxel);

    // Create Car Front Right Wheel:
    const frontRightWheelTransform = Vector.mult(frontLeftWheelTransform, new Vector(1, -1, 1));
    const frontRightWheelMesh = Mesh.scale(frontLeftWheelMesh, new Vector(1,-1,1)).inverseNormals();
    this.frontRightAxel = new Urbject({
      position: frontRightWheelTransform,
    });
    this.frontRightWheel = new MeshUrbject({
      mesh: frontRightWheelMesh,
      material: wheelMat
    });
    this.frontRightAxel.addChild(this.frontRightWheel);
    this.body.addChild(this.frontRightAxel);

  }

  public update(t: number) {
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
    this.backWheels.orientation.rotateY(t * Math.PI * 2 * this.speed / Car.backWheelCircumference);
    this.frontLeftWheel.orientation.rotateY(t * Math.PI * 2 * this.speed / Car.frontWheelCircumference);
    this.frontRightWheel.orientation.rotateY(t * Math.PI * 2 * this.speed / Car.frontWheelCircumference);

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

  }

  public getSpeed() {
    return this.speed;
  }

}
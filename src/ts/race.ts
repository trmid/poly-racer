import { now, PolySynth, Synth, Volume } from "tone";
import { Track } from "./track";
import { writable } from "svelte/store";
import { Car } from "./car";
import { formatMsTime, linesCross } from "./utils";

export interface RaceRecord {
  timestamp: number
  seed: string
  laps: number[]
}

export const history = writable<RaceRecord[]>([]);

export enum RaceState {
  READY,
  COUNTDOWN,
  PLAYING,
  PAUSED,
  DONE,
  FAILED
}

export class Race {

  // Seed:
  private seed: string = "";

  // Renderer:
  private renderer: PerformanceRenderer;

  // Minimap Canvas:
  public readonly minimap: HTMLCanvasElement;
  private minimapStatic: HTMLCanvasElement;
  private minimapCarCanvas: HTMLCanvasElement;
  private minimapCarRenderer: Renderer | undefined;
  private minimapCamera: Camera;

  // Timer:
  private timer: Stats = new Stats();

  // Game state:
  private _state: RaceState = RaceState.READY;
  private _gameTime: number = 0;
  private unpauseTimeouts: NodeJS.Timeout[] = [];

  // Lap Info:
  public readonly totalLaps = 3;
  private checkpoints = new Set<any>();

  // Stores:
  public stores = {
    centerText: writable("Click to Start!"),
    speed: writable(0),
    state: writable(RaceState.READY),
    gameTime: writable(0),
    completedLaps: writable<number[]>([]),
  };
  
  // Sound Settings:
  private volumeNode = new Volume(-10);

  // Scene:
  private scene: Scene = new Scene();

  // Car:
  private car: Car = new Car(this.volumeNode);
  private turnSensitivity = 0.5;

  // Track:
  private track: Track | undefined;

  // Countdown Noise:
  private countdownSynth: PolySynth | undefined;

  // Listeners:
  private eventListeners: {element: Window | Element, event: string, function: <E extends Event>(e: E) => void}[] = [];

  constructor(readonly canvas: HTMLCanvasElement) {

    // Create minimap canvases:
    {
      // Public Minimap canvas:
      this.minimap = document.createElement("canvas");
      this.minimap.width = 150;
      this.minimap.height = 150;
      this.minimap.id = "minimap";

      // Static canvas:
      this.minimapStatic = document.createElement("canvas");
      this.minimapStatic.width = this.minimap.width;
      this.minimapStatic.height = this.minimap.height;

      // Car canvas:
      this.minimapCarCanvas = document.createElement("canvas");
      this.minimapCarCanvas.width = this.minimap.width;
      this.minimapCarCanvas.height = this.minimap.height;

      // Create minimap camera:
      this.minimapCamera = new Camera({
        position: new Vector(0, 0, 1800),
        orientation: Quaternion.fromVector(Vector.zAxis().neg()),
        fov: 40
      });
    }

    // Make canvas focusable:
    canvas.tabIndex = 1;

    // Add renderer:
    this.renderer = new PerformanceRenderer({
      canvas,
      frameCallback: () => this.draw(),
      backgroundColor: new Color(50),
      showPerformance: false
    });

    // Add event listeners:
    this.eventListeners.push({
      element: canvas,
      event: "keydown",
      function: (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        switch(e.key.toUpperCase()) {
          case "W":
          case "ARROWUP": {
            this.car.up = true;
            break;
          }
          case "A":
          case "ARROWLEFT": {
            this.car.left = true;
            break;
          }
          case "S":
          case "ARROWDOWN": {
            this.car.down = true;
            break;
          }
          case "D":
          case "ARROWRIGHT": {
            this.car.right = true;
            break;
          }
          case "ESCAPE": {
            this.pause();
            break;
          }
          // Space Bar
          case " ": {
            if(this.state == RaceState.FAILED || this.state == RaceState.DONE) this.restart();
            else if(this.state == RaceState.COUNTDOWN || this.state == RaceState.PLAYING) this.pause();
            else if(this.state == RaceState.PAUSED) this.start();
            break;
          }
        }
      }
    },{
      element: canvas,
      event: "keyup",
      function: (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        switch(e.key.toUpperCase()) {
          case "W":
          case "ARROWUP": {
            this.car.up = false;
            break;
          }
          case "A":
          case "ARROWLEFT": {
            this.car.left = false;
            break;
          }
          case "S":
          case "ARROWDOWN": {
            this.car.down = false;
            break;
          }
          case "D":
          case "ARROWRIGHT": {
            this.car.right = false;
            break;
          }
        }
      }
    },
    {
      element: canvas,
      event: "blur",
      function: (e: any) => {
        this.pause();
      }
    },
    {
      element: canvas,
      event: "click",
      function: (e: any) => {
        if(this.state == RaceState.READY) this.start();
        else if(this.state == RaceState.DONE || this.state == RaceState.FAILED) this.restart();
        else if(this.state == RaceState.PAUSED) this.start();
        else this.pause();
      }
    });
    for(const listener of this.eventListeners) {
      listener.element.addEventListener(listener.event, listener.function);
    }

  }

  /**
   * Setups the race with the given track seed.
   * 
   * @param seed String
   */
  public load(seed: string) {

    // Init vars:
    this.seed = seed;
    this.state = RaceState.READY;
    this.gameTime = 0;
    this.timer = new Stats();
    this.checkpoints = new Set();
    this.stores.centerText.set("Click to Start!");
    this.stores.completedLaps.set([]);
    this.stores.speed.set(0);

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
    this.track = new Track(seed);
    this.track.addTo(scene);

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

    // Stop car sound if it exists:
    if(this.car) {
      this.car.engineSound.stop();
      this.car.engineSound.dispose();
    }

    // Add car:
    this.car = new Car(this.volumeNode, { turnSensitivity: this.turnSensitivity });
    const startLine = this.track.startLine;
    const startLineDiff = Vector.sub(startLine.p1, startLine.p0);
    const startLineMid = Vector.add(startLine.p0, Vector.mult(startLineDiff, 0.5));
    this.car.body.orientation = Quaternion.fromVector(startLineDiff, Vector.xAxis()).rotateZ(Math.PI/2);
    this.car.direction = Vector.xAxis().qRotate(this.car.body.orientation);
    this.car.body.position = Vector.sub(startLineMid, new Vector(Car.noseXOffset).qRotate(this.car.body.orientation));
    this.scene.add(this.car.body);
    
    // Minimap setup:
    {
      // Render Static Image:
      const scene = new Scene();
      const trackPreview = new Track(seed, true);
      scene.add(trackPreview.urbject);
      const renderer = new Renderer({ canvas: this.minimapStatic, backgroundColor: new Color(0, 0), suspendOnBlur: false })
      renderer.render(scene, this.minimapCamera);

      // Initialize minimap display:
      this.updateMinimap();
    }

    // Render first frame (use timeout to make sure Performance Render doesn't ignore the frame due to ongoing processing):
    this.renderer.stop();
    setTimeout(() => {
      this.renderer.render(this.scene, this.car.camera);
    }, 100);

    // Return init variables:
    return {
      track: this.track,
      car: this.car,
      scene: this.scene,
      state: this.state,
      timer: this.timer,
      gameTime: this.gameTime,
      checkpoints: this.checkpoints
    };

  }

  public setVolume(volume: number) {
    volume = Num.constrain(volume, 0, 1);
    if(volume == 0) {
      this.volumeNode.mute = true;
    } else {
      this.volumeNode.volume.value = (1 - volume) * -32;
    }
  }

  public setTurnSensitivity(turnSensitivity: number) {
    this.car.turnSensitivity = turnSensitivity;
    this.turnSensitivity = turnSensitivity;
  }

  public restart() {
    this.load(this.seed);
    this.start();
  }

  public start() {

    if(this.state == RaceState.PAUSED || this.state == RaceState.READY) {

      // Unpause game:
      this.state = RaceState.COUNTDOWN;
      this.canvas.focus();

      // Set center text:
      this.stores.centerText.set("");

      // Start rendering:
      this.renderer.stop();
      this.renderer.start(this.scene, this.car.camera);

      // Connect volume node:
      this.volumeNode.disconnect();
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
      this.car.engineSound.stop();
      this.car.engineSound.start();

      // Clear unpause timeouts:
      for(const timeout of this.unpauseTimeouts) {
        clearTimeout(timeout);
      }

      // Start countdown:
      this.stores.centerText.set("3");
      this.unpauseTimeouts = [
        setTimeout(() => this.stores.centerText.set("2"), 1000),
        setTimeout(() => this.stores.centerText.set("1"), 2000),
        setTimeout(() => {
          this.stores.centerText.set("GO!");
          this.timer.startTimer();
          this.state = RaceState.PLAYING;
        }, 3000),
        setTimeout(() => this.stores.centerText.set(""), 4000)
      ];

    }

  }

  public pause() {
    if(this.state == RaceState.PLAYING || this.state == RaceState.READY || this.state == RaceState.COUNTDOWN) {

      // Set center text:
      this.stores.centerText.set("Click to Resume...");

      // Pause game:
      this.state = RaceState.PAUSED;
      this.renderer.stop();

      // Clear unpause timeouts:
      for(const timeout of this.unpauseTimeouts) {
        clearTimeout(timeout);
      }
      
      // Pause engine sounds:
      this.car.engineSound.stop();

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

    if(this.state == RaceState.PLAYING) {

      // Check if track is loaded:
      if(!this.track) this.track = new Track(this.seed);

      // Add to game time:
      this.gameTime += millisecondsElapsed;
      this.stores.gameTime.set(this.gameTime);

      // Get current car position:
      const lastCarPos = this.car.body.position.copy();
      
      // Update Car movement:
      this.car.update(t, this.track);

      // Get new car position:
      const newCarPos = this.car.body.position.copy();

      // Get checkpoints:
      const checkpoints = this.track.nearTrigons(newCarPos, (Car.noseXOffset - Car.wheelPositions.backLeft.position.x) / 2);
      for(const checkpoint of checkpoints) {
        this.checkpoints.add(checkpoint);
      }

      // Check if car has touched at least 80% of checkpoints:
      if(this.checkpoints.size > 0.8 * this.track.totalTrigons()) {

        // Check if car has cross finish line:
        const noseOffset = new Vector(Car.noseXOffset, 0).qRotate(this.car.body.orientation);
        const startLineDiff = Vector.sub(this.track.startLine.p1, this.track.startLine.p0);
        if(linesCross(
          Vector.add(lastCarPos, noseOffset),
          Vector.add(newCarPos, noseOffset),
          Vector.sub(this.track.startLine.p0, Vector.mult(startLineDiff, 0.5)),
          Vector.add(this.track.startLine.p1, Vector.mult(startLineDiff, 0.5))
        )) {

          console.log(`${(100 * this.checkpoints.size / this.track.totalTrigons()).toFixed(2)}%`);

          // Reset checkpoints and add lap time:
          this.checkpoints = new Set();
          this.stores.completedLaps.update(laps => {

            // Push lap time:
            laps.push(this.gameTime);

            // Check if all laps are complete:
            if(laps.length == this.totalLaps) {
              this.pause();
              this.stores.centerText.set(`Race Complete!\nTime: ${formatMsTime(this.gameTime)}`);
              this.state = RaceState.DONE

              // Save in race history:
              history.update(history => {
                return [{
                  seed: this.seed,
                  timestamp: Date.now(),
                  laps: laps
                }, ...history];
              });

            }

            return laps;
          });
        }
      }

      // Update minimap:
      this.updateMinimap();

      // Check if car is on track:
      if(!this.car.isOnTrack()) {
        this.state = RaceState.FAILED;
        this.stores.centerText.set("Off track!\nRestart? (Space)");
        this.car.engineSound.stop();
      }

      // Set speed store:
      this.stores.speed.set(this.car.getSpeed() * 60 * 60 / 1000);
    }
  }

  /**
   * Updates the minimap canvas display
   */
  private updateMinimap() {
    const ctx = this.minimap.getContext('2d');
    ctx?.clearRect(0, 0, this.minimap.width, this.minimap.height);
    ctx?.drawImage(this.minimapStatic, 0, 0);
    const scene = new Scene();
    const carMesh = new Mesh();
    carMesh.addTrigon(new Trigon(
      new Vector(Car.noseXOffset, 0, 0),
      new Vector(Car.wheelPositions.backLeft.position.x, Car.wheelPositions.backLeft.position.y, 0),
      new Vector(Car.wheelPositions.backRight.position.x, Car.wheelPositions.backRight.position.y, 0)
    ));
    const carMat = this.car.body.material.copy();
    carMat.lit = false;
    const car = new MeshUrbject({
      mesh: carMesh.scale(8),
      position: this.car.body.position,
      orientation: this.car.body.orientation,
      material: carMat,
      group: 1
    });
    scene.add(car);
    if(!this.minimapCarRenderer) this.minimapCarRenderer = new Renderer({
      canvas: this.minimapCarCanvas,
      backgroundColor: new Color(0, 0),
      suspendOnBlur: false
    });
    this.minimapCarRenderer.render(scene, this.minimapCamera);
    ctx?.drawImage(this.minimapCarCanvas, 0, 0);
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
    this.car.engineSound.dispose();

    // Destroy countdown sound:
    this.countdownSynth?.dispose();
  }

  public get state() {
    return this._state;
  }

  private set state(state: RaceState) {
    this._state = state;
    this.stores.state.set(state);
  }

  public get gameTime() {
    return this._gameTime;
  }

  private set gameTime(time: number) {
    this._gameTime = time;
    this.stores.gameTime.set(time);
  }

}
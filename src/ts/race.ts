import { now, PolySynth, Synth, Volume } from "tone";
import { Track } from "./track";
import { writable } from "svelte/store";
import { Car } from "./car";

export class Race {

  // Renderer:
  private renderer: PerformanceRenderer;

  // Minimap Canvas:
  public readonly minimap: HTMLCanvasElement;
  private minimapStatic: HTMLCanvasElement;
  private minimapCarCanvas: HTMLCanvasElement;
  private minimapCarRenderer: Renderer | undefined;
  private minimapCamera: Camera;

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
    state: writable("ready"),
    gameTime: writable(0),
    completedLaps: writable<number[]>([]),
  };
  
  // Sound Settings:
  private volumeNode = new Volume(-10);

  // Scene:
  private scene: Scene;

  // Car:
  private car: Car;

  // Track:
  private track: Track;

  // Countdown Noise:
  private countdownSynth: PolySynth | undefined;

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

    // Add car:
    this.car = new Car(this.volumeNode);
    const startLine = this.track.startLine;
    const startLineDiff = Vector.sub(startLine.p1, startLine.p0);
    const startLineMid = Vector.add(startLine.p0, Vector.mult(startLineDiff, 0.5));
    this.car.body.orientation = Quaternion.fromVector(startLineDiff, Vector.xAxis()).rotateZ(Math.PI/2);
    this.car.direction = Vector.xAxis().qRotate(this.car.body.orientation);
    this.car.body.position = Vector.sub(startLineMid, new Vector(Car.noseXOffset).qRotate(this.car.body.orientation));
    this.scene.add(this.car.body);

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

      // Render Static Image:
      const scene = new Scene();
      const trackPreview = new Track(seed, true);
      scene.add(trackPreview.urbject);
      const renderer = new Renderer({ canvas: this.minimapStatic, backgroundColor: new Color(0, 0), suspendOnBlur: false })
      renderer.render(scene, this.minimapCamera);

      // Initialize minimap display:
      this.updateMinimap();
    }

    // Add renderer:
    this.renderer = new PerformanceRenderer({
      canvas,
      frameCallback: () => this.draw(),
      backgroundColor: new Color(50),
      showPerformance: false
    });
    this.renderer.render(scene, this.car.camera);

    // Add window event listeners:
    this.eventListeners.push({
      element: window,
      event: "keydown",
      function: (e: any) => {
        if(this.playing) e.preventDefault();
        switch(e.key.toUpperCase()) {
          case "W":
          case "ARROWUP": {
            self.car.up = true;
            break;
          }
          case "A":
          case "ARROWLEFT": {
            self.car.left = true;
            break;
          }
          case "S":
          case "ARROWDOWN": {
            self.car.down = true;
            break;
          }
          case "D":
          case "ARROWRIGHT": {
            self.car.right = true;
            break;
          }
          case "ESCAPE": {
            if(!this.paused) this.pause();
            break;
          }
        }
      }
    },{
      element: window,
      event: "keyup",
      function: (e: any) => {
        if(this.playing) e.preventDefault();
        switch(e.key.toUpperCase()) {
          case "W":
          case "ARROWUP": {
            self.car.up = false;
            break;
          }
          case "A":
          case "ARROWLEFT": {
            self.car.left = false;
            break;
          }
          case "S":
          case "ARROWDOWN": {
            self.car.down = false;
            break;
          }
          case "D":
          case "ARROWRIGHT": {
            self.car.right = false;
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
        if(self.done) location.reload();
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
      this.stores.state.set("playing");
      this.canvas.focus();

      // Set center text:
      this.stores.centerText.set("");

      // Start rendering:
      this.renderer.start(this.scene, this.car.camera);

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
      this.car.engineSound.start();

      // Set game state:
      this.stores.centerText.set("3");
      this.unpauseTimeouts = [
        setTimeout(() => this.stores.centerText.set("2"), 1000),
        setTimeout(() => this.stores.centerText.set("1"), 2000),
        setTimeout(() => {
          this.stores.centerText.set("GO!");
          this.timer.startTimer();
          this.playing = true;
        }, 3000),
        setTimeout(() => this.stores.centerText.set(""), 4000)
      ];

    }

  }

  public pause() {
    if(!this.paused && !this.done) {

      // Set center text:
      this.stores.centerText.set("Click to Resume...");

      // Clear unpause timeouts:
      for(const timeout of this.unpauseTimeouts) {
        clearTimeout(timeout);
      }

      // Pause game:
      this.playing = false;
      this.paused = true;
      this.stores.state.set("paused");
      this.renderer.stop();
      
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

    if(this.playing && !this.done) {

      // Add to game time:
      this.gameTime += millisecondsElapsed;
      this.stores.gameTime.set(this.gameTime);
      
      // Update Car movement:
      this.car.update(t, this.track);

      // Update minimap:
      this.updateMinimap();

      // Check if car is on track:
      if(!this.car.isOnTrack()) {
        this.done = true;
        this.stores.state.set("failed");
        this.stores.centerText.set("Off track!\nClick to Restart...");
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

}
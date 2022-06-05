import { now, PolySynth, Synth, Volume } from "tone";
import { buildTrackMesh } from "./track";
import { writable } from "svelte/store";
import { Car } from "./car";

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

  // Car:
  private car: Car;

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

    // Add car:
    this.car = new Car(this.volumeNode);
    this.scene.add(this.car.body);

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
        }
      }
    },{
      element: window,
      event: "keyup",
      function: (e: any) => {
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

    if(this.playing) {
      // Add to game time:
      this.gameTime += millisecondsElapsed;
      this.stores.gameTime.set(this.gameTime);
      
      // Update Car movement:
      this.car.update(t);

      // Set speed store:
      this.stores.speed.set(this.car.getSpeed() * 60 * 60 / 1000);
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
    this.car.engineSound.dispose();

    // Destroy countdown sound:
    this.countdownSynth?.dispose();
  }

}
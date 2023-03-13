import { now, PolySynth, Synth, Volume } from "tone";
import { Track } from "./track";
import { writable } from "svelte/store";
import { Car } from "./car";
import { arrayBufferToString, formatMsTime } from "./utils";

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
  FAILED,
  DESTROYED
}

export class Race {

  // Milliseconds per update:
  static msPerUpdate = 1000 / 100; // 100 per second

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
  private _gameTime = 0;
  private playTimeElapsed = 0;
  private unpauseTimeouts: NodeJS.Timeout[] = [];
  private inputHistory: {
    inputs: number, // 1 byte (first bit -> up, down, left, right)
    timestamp: number,
    turnSensitivity: number
  }[] = [];

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
    ghostLaps: writable<number[]>([])
  };
  
  // Sound Settings:
  private volumeNode = new Volume(-10);

  // Scene:
  private scene: Scene = new Scene();

  // Car:
  private car: Car = new Car();
  private turnSensitivity = 0.5;

  // Ghost car:
  private ghostCar: Car | undefined;
  private ghostCarInputHistory: (typeof this.inputHistory) | undefined;
  private ghostCarLastInputIndex = 0;

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
            if(this.state == RaceState.COUNTDOWN || this.state == RaceState.PLAYING) this.pause();
            else if (this.state == RaceState.PAUSED) this.restart();
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

    // Set ground color:
    this.renderer.backgroundColor = new Color(parseInt(seed.substring(0,2), 16), 100 + parseInt(seed.substring(2,4), 16) * 0.5, 40, 0.9);

    // Stop car sound if it exists:
    if(this.car) {
      this.car.engineSound?.stop();
      this.car.engineSound?.dispose();
      this.ghostCar?.engineSound?.stop();
      this.ghostCar?.engineSound?.dispose();
    }

    // Init vars:
    const isNewSeed = this.seed !== seed;
    this.seed = seed;
    this.state = RaceState.READY;
    this.gameTime = 0;
    this.playTimeElapsed = 0;
    this.timer = new Stats();
    this.checkpoints = new Set();
    this.inputHistory = [];
    this.ghostCar = undefined;
    if(isNewSeed) {
      this.ghostCarInputHistory = undefined;
      this.stores.ghostLaps.set([]);
    }
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

    // Add car:
    const lastCar = this.car;
    this.car = new Car({ track: this.track, audioDestination: this.volumeNode, turnSensitivity: this.turnSensitivity });
    this.scene.add(this.car.body);
    this.car.up = lastCar.up;
    this.car.left = lastCar.left;
    this.car.right = lastCar.right;
    this.car.down = lastCar.down;
    
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

      // Add ghost car if not added:
      if(this.ghostCarInputHistory && !this.ghostCar) {
        this.ghostCar = new Car({ track: this.track, isGhostCar: true });
        this.ghostCarLastInputIndex = 0;
        this.scene.add(this.ghostCar.body);
      }

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
      this.car.engineSound?.stop();
      this.car.engineSound?.start();

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

          // Start updating:
          this.update();
        }, 3000),
        setTimeout(() => this.stores.centerText.set(""), 4000)
      ];
    }
  }

  public pause() {
    if(this.state == RaceState.PLAYING || this.state == RaceState.READY || this.state == RaceState.COUNTDOWN) {

      // Set center text:
      this.stores.centerText.set("Resume (Space)\nRestart (Esc)");

      // Pause game:
      this.state = RaceState.PAUSED;
      this.renderer.stop();

      // Clear unpause timeouts:
      for(const timeout of this.unpauseTimeouts) {
        clearTimeout(timeout);
      }
      
      // Pause engine sounds:
      this.car.engineSound?.stop();
      this.ghostCar?.engineSound?.stop();

      // Pause countdown sound:
      if(this.countdownSynth) {
        this.countdownSynth.disconnect().releaseAll();
        
        // Wait for synth sounds to stop, then dispose safely:
        const synth = this.countdownSynth;
        setTimeout(() => {
          synth.dispose();
        }, 10000);
        this.countdownSynth = undefined;
      }

      // Disconnect volume node:
      this.volumeNode.disconnect();

    }
  }

  /**
   * Update function:
   */
  private update() {
    if(this.state == RaceState.PLAYING) {

      // Request next update:
      requestAnimationFrame(() => this.update());

      // Get time:
      const millisecondsElapsed = this.timer.readCheckpoint();

      // Check if track is loaded:
      if(!this.track) this.track = new Track(this.seed);

      // Add to game time:
      this.playTimeElapsed += millisecondsElapsed;

      // Catch up game state to current time based off of update rate:
      while(this.gameTime <= this.playTimeElapsed && this.state == RaceState.PLAYING) {

        // Increment gameTime:
        this.gameTime += Race.msPerUpdate

        // Check if update time is valid:
        if(this.gameTime % Race.msPerUpdate != 0) {
          throw new Error("Update time is out of sync with update rate.");
        }

        // Record inputs:
        const inputs = 
          (this.car.up ? 0b0001 : 0) | 
          (this.car.down ? 0b0010 : 0) |
          (this.car.left ? 0b0100 : 0) |
          (this.car.right ? 0b1000 : 0);
        const lastRecord = this.inputHistory[this.inputHistory.length - 1];
        if(!lastRecord || (inputs != lastRecord.inputs) || (this.turnSensitivity != lastRecord.turnSensitivity)) {
          this.inputHistory.push({
            inputs,
            timestamp: this.gameTime,
            turnSensitivity: this.turnSensitivity
          });
        }

        // Update ghost car:
        if(this.ghostCar && this.ghostCarInputHistory && this.ghostCar.laps.length < this.totalLaps) {

          // Get current input:
          let currentInput = this.ghostCarInputHistory[this.ghostCarLastInputIndex];

          // Iterate to next input if ready:
          const nextInput = this.ghostCarInputHistory[this.ghostCarLastInputIndex + 1];
          if(nextInput && nextInput.timestamp <= this.gameTime) {
            currentInput = nextInput;
            this.ghostCarLastInputIndex++;
          }

          // Check current input validity:
          if(currentInput.timestamp % Race.msPerUpdate != 0) {
            throw new Error("Ghost car input timestamp out of sync with update rate.");
          }

          // update ghost car inputs:
          this.ghostCar.up =     !!(currentInput.inputs & 0b0001);
          this.ghostCar.down =   !!(currentInput.inputs & 0b0010);
          this.ghostCar.left =   !!(currentInput.inputs & 0b0100);
          this.ghostCar.right =  !!(currentInput.inputs & 0b1000);
          this.ghostCar.turnSensitivity = currentInput.turnSensitivity;

          // Update to current frame time
          this.ghostCar.update(Race.msPerUpdate);
        }

        // Current lap number:
        const currentLap = this.car.laps.length;
        
        // Update Car movement:
        this.car.update(Race.msPerUpdate);

        // Update laps store if lap completed:
        if(this.car.laps.length > currentLap) {
          this.stores.completedLaps.set(this.car.laps);
        }

        // Check if all laps are complete:
        if(this.car.laps.length == this.totalLaps) {

          // Pause game:
          this.pause();
          this.state = RaceState.DONE

          // Save in race history:
          history.update(history => {

            // Get race time:
            const raceTime = this.car.laps[this.totalLaps - 1];
            this.gameTime = raceTime;
            this.stores.gameTime.set(raceTime);

            // Check if personal best:
            const pastRaces = history.filter(race => race.seed == this.seed);
            const bestRace = pastRaces.length > 0 ? pastRaces.reduce((a,b) => a.laps[a.laps.length - 1] < b.laps[b.laps.length - 1] ? a : b) : undefined;
            const bestTime = bestRace ? bestRace.laps[bestRace.laps.length - 1] : undefined;
            const isPersonalBest = bestTime === undefined || raceTime <= bestTime;

            // Update text:
            this.stores.centerText.set(`${isPersonalBest ? "Personal Best" : "Race Complete"}!\nTime: ${formatMsTime(raceTime)}`);

            // Store replay if best:
            if(isPersonalBest) {
              localStorage.setItem(`pb:${this.seed}`, arrayBufferToString(this.getReplayBuffer()));
            }

            return [{
              seed: this.seed,
              timestamp: Date.now(),
              laps: this.car.laps
            }, ...history];
          });
        }

        // Check if car is on track:
        if(!this.car.isOnTrack()) {
          this.state = RaceState.FAILED;
          this.stores.centerText.set("Off track!\nRestart? (Space)");
          this.car.engineSound?.stop();
          this.ghostCar?.engineSound?.stop();
        }
      }

      // Set speed store:
      this.stores.speed.set(this.car.getSpeed() * 60 * 60 / 1000);

      // Update game time:
      this.stores.gameTime.set(this.gameTime);
    }
  }

  /**
   * Frame callback:
   * 
   * This function is called after every frame render.
   * Use this for non-timed updates to ui.
   */
  private draw() {

    // Update minimap:
    this.updateMinimap();
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

    // Add car:
    const carMat = this.car.body.material.copy();
    carMat.lit = false;
    const car = new MeshUrbject({
      mesh: Mesh.scale(carMesh, 8),
      position: this.car.body.position,
      orientation: this.car.body.orientation,
      material: carMat,
      group: 2
    });
    scene.add(car);

    // Add ghost car:
    if(this.ghostCar) {
      const ghostMat = new Material({ lit: false, fill: new Color(150) });
      const ghostCar = new MeshUrbject({
        mesh: Mesh.scale(carMesh, 8),
        position: this.ghostCar.body.position,
        orientation: this.ghostCar.body.orientation,
        material: ghostMat,
        group: 1
      });
      scene.add(ghostCar);
    }

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

    // Set play state to destroyed:
    this.state = RaceState.DESTROYED;

    // Remove listeners:
    for(const listener of this.eventListeners) {
      listener.element.removeEventListener(listener.event, listener.function);
    }

    // Destroy engine sound:
    this.car.engineSound?.dispose();
    this.ghostCar?.engineSound?.dispose();

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

  /**
   * Get the replay buffer for this race.
   * Throws if the race was not completed.
   * 
   * @returns Replay Buffer
   */
  public getReplayBuffer() {
    if(this.state != RaceState.DONE) throw new Error("Cannot get a replay buffer from a race that is not complete!");
    return Race.inputHistoryToBuffer(this.seed, this.inputHistory);
  }

  /**
   * Loads a replay buffer to play against.
   * Throws if the race state has already begun.
   * 
   * @param buffer Replay Buffer
   */
  public loadReplayBuffer(buffer: ArrayBuffer) {
    if(this.gameTime == 0 || this.state == RaceState.DONE || this.state == RaceState.FAILED) {
      const replay = Race.replayBufferToInputHistory(buffer);
      if(replay.trackSeed !== this.seed) throw new Error("Replay track seed does not match!");
      this.ghostCarInputHistory = replay.inputHistory;

      // Get ghost lap times:
      let laps: number[] = [];
      let gameTime = 0;
      let currentInputIndex = 0;
      const car = new Car({ track: this.track, isGhostCar: true });
      while(laps.length < this.totalLaps) {
        // Add to game time:
        gameTime += Race.msPerUpdate;

        // Get current input:
        let currentInput = replay.inputHistory[currentInputIndex];

        // Iterate to next input if ready:
        const nextInput = replay.inputHistory[currentInputIndex + 1];
        if(nextInput && nextInput.timestamp <= gameTime) {
          currentInput = nextInput;
          currentInputIndex++;
        }

        // Update ghost car inputs:
        car.up =     !!(currentInput.inputs & 0b0001);
        car.down =   !!(currentInput.inputs & 0b0010);
        car.left =   !!(currentInput.inputs & 0b0100);
        car.right =  !!(currentInput.inputs & 0b1000);
        car.turnSensitivity = currentInput.turnSensitivity;

        // Update to current frame time
        car.update(Race.msPerUpdate);

        // Get laps:
        laps = car.laps;
      }

      // Store laps:
      this.stores.ghostLaps.set(laps);

    } else {
      throw new Error("Cannot load a replay after the race has started!");
    }
  }

  /* Replay Buffer Constants */
  static BYTES_PER_INPUT_RECORD = 1 + 4 + 4;
  static TRACK_SEED_BYTE_LENGTH = 4;

  /**
   * Converts the track seed and input history into a replay buffer.
   * 
   * @param trackSeed Track Seed String
   * @param inputHistory Input History Array
   * @returns Replay Buffer
   */
  static inputHistoryToBuffer(trackSeed: string, inputHistory: typeof Race.prototype.inputHistory) {
    const totalBytes = Race.TRACK_SEED_BYTE_LENGTH + inputHistory.length * Race.BYTES_PER_INPUT_RECORD;
    const buffer = new ArrayBuffer(totalBytes);
    const view = new DataView(buffer);
    view.setUint32(0, parseInt(trackSeed, 16));
    for(let i = 0; i < inputHistory.length; i++) {
      const byteOffset = Race.TRACK_SEED_BYTE_LENGTH + i * Race.BYTES_PER_INPUT_RECORD;
      view.setUint8(byteOffset, inputHistory[i].inputs);
      view.setFloat32(byteOffset + 1, inputHistory[i].timestamp);
      view.setFloat32(byteOffset + 5, inputHistory[i].turnSensitivity);
    }
    return buffer;
  }

  /**
   * Converts the input history buffer into a readable track seed and input history array.
   * 
   * @param replay Replay Array Buffer
   * @returns Replay Object
   */
  static replayBufferToInputHistory(replay: ArrayBuffer) {
    const view = new DataView(replay);
    if((view.byteLength - Race.TRACK_SEED_BYTE_LENGTH) % Race.BYTES_PER_INPUT_RECORD != 0) throw new Error("Invalid replay byte length!");
    const trackSeed = view.getUint32(0).toString(16).padStart(8, '0');
    const inputHistory: typeof Race.prototype.inputHistory = [];
    for(let i = 0; i < (view.byteLength - Race.TRACK_SEED_BYTE_LENGTH) / Race.BYTES_PER_INPUT_RECORD; i++) {
      const byteOffset = i * Race.BYTES_PER_INPUT_RECORD + Race.TRACK_SEED_BYTE_LENGTH;
      inputHistory.push({
        inputs: view.getUint8(byteOffset),
        timestamp: view.getFloat32(byteOffset + 1),
        turnSensitivity: view.getFloat32(byteOffset + 5)
      });
    }
    return {
      trackSeed,
      inputHistory
    };
  }

}
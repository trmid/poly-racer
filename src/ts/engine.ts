import { AMSynth, FMSynth, Loop, MetalSynth, now, Synth, Transport, Volume } from "tone";
import type { Time } from "tone/build/esm/core/type/Units";

export class EngineSound {

  // Modifier: (0-1)
  private modifier = 0;
  
  // State functions:
  public stop: () => void;
  public start: () => void;
  public dispose: () => void;
  public disposed = false;

  constructor(destination: Volume) {

    // Sound creation helpers:
    const sounds: { synth: Synth | FMSynth | AMSynth | MetalSynth, loop: Loop, offset: Time }[] = [];
    const addSound = (synth: typeof sounds[0]["synth"], baseFrequency: number, freqSpread: number, duration: Time, spacing: Time, offset: Time = 0) => {
      const sound = {
        synth,
        loop: new Loop(time => {
          synth.triggerAttackRelease(baseFrequency + freqSpread * this.modifier, duration, time);
        }, spacing).start(offset),
        offset
      };
      sounds.push(sound);
      return sound;
    };

    // Add sounds:
    {
      const sound = addSound(new FMSynth(), 100, 40, "32n", "8n");
      sound.synth.volume.value = -2;
    }
    // Octaves:
    addSound(new AMSynth(), 80, 60, "12n", "8n");
    addSound(new AMSynth(), 160, 120, "12n", "8n", "16n")

    // Octaves:
    // addSound(new FMSynth(), 50, 110, "12n", "6n", "12n");
    // addSound(new AMSynth(), 100, 180, "12n", "6n");

    // Octaves:
    addSound(new FMSynth(), 100, 39, "16n", "10n", "20n");
    addSound(new AMSynth(), 200, 78, "16n", "10n");

    // Set stop function:
    this.stop = () => {

      // Stop loops:
      for(const sound of sounds) {
        sound.loop.stop();
      }

      // Stop transport:
      Transport.stop();
    };

    // Set start function:
    this.start = () => {

      // Start synth loops:
      for(const sound of sounds) {
        sound.synth.disconnect();
        sound.synth.connect(destination);
        sound.loop.start(sound.offset);
      }

      // Start Transport:
      Transport.start();
      this.update(this.modifier);
    };

    // Set the dispose function:
    this.dispose = () => {
      this.disposed = true;
      for(const sound of sounds) {
        sound.loop.dispose();
        sound.synth.dispose();
      }
    };
  }

  public update(modifier: number) {
    this.modifier = Num.constrain(modifier, 0, 1);
    Transport.bpm.setValueAtTime(300 + 200 * this.modifier, now());
  }

}
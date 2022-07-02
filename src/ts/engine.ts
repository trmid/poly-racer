import { AMSynth, FMSynth, FrequencyShifter, Loop, MetalSynth, NoiseSynth, now, PitchShift, PluckSynth, Sampler, Synth, Transport, Volume } from "tone";
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
    const sounds: { synth: Synth | FMSynth | AMSynth | MetalSynth | PluckSynth | NoiseSynth | Sampler, loop: Loop, offset: Time }[] = [];
    const addSound = (synth: typeof sounds[0]["synth"], baseFrequency: number, freqSpread: number, duration: Time, spacing: Time, offset: Time = 0) => {
      const sound = {
        synth,
        loop: new Loop(time => {
          if(synth instanceof Sampler) {
            if(!synth.loaded) return;
          }
          const modifier = this.modifier + ((this.modifier == 0 || this.modifier == 1) ? (time % 0.2) * 0.02 : 0);
          synth.triggerAttackRelease(baseFrequency + freqSpread * modifier, duration, time);
        }, spacing).start(offset),
        offset
      };
      sounds.push(sound);
      return sound;
    };

    // Add sounds:
    {

      // Sample:
      addSound(new Sampler({
        urls: {
          A1: "car-sound.wav"
        },
        baseUrl: "sounds/"
      }), 70, 35, "4n", "16n").synth.volume.value = -12;

      // Lows:
      addSound(new FMSynth(), 200, 100, "16n", "8n").synth.volume.value = -4;
      addSound(new FMSynth(), 100, 50, "8n", "8n").synth.volume.value = -4;;

      // Highs:
      addSound(new AMSynth(), 400, 200, "16n", "8n").synth.volume.value = -10;
    }

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
      for(const sound of sounds) {
        sound.loop.dispose();
        sound.synth.dispose();
      }
      this.disposed = true;
    };
  }

  public update(modifier: number) {
    this.modifier = Num.constrain(modifier, 0, 1);
    Transport.bpm.setValueAtTime(300 + 200 * this.modifier, now());
  }

}
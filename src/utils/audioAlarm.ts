// Emergency Alarm Controller using Web Audio API + HTML5 Audio (/alarma_sismo.mp3 & /alarma.mp3)
import { reproducirAlarma, detenerAlarma as detenerAlarmaServicio } from '../servicios/alarma';

class AlarmController {
  private audioElement: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private bufferSource: AudioBufferSourceNode | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private isPlaying: boolean = false;
  private intervalId: any = null;
  private vibrationIntervalId: any = null;
  private wakeLockSentinel: any = null;
  private listeners: Set<(playing: boolean) => void> = new Set();

  private audioUnlocked: boolean = false;
  private unlockBound: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      // Precarga perezosa del buffer de audio si es posible
      this.precargarBufferAudio();
      this.bindAutoUnlockOnGesture();
    }
  }

  private bindAutoUnlockOnGesture(): void {
    if (this.unlockBound || typeof window === 'undefined') return;
    this.unlockBound = true;

    const handler = () => {
      this.unlockAudio().then((ok) => {
        if (ok) {
          window.removeEventListener('pointerdown', handler, true);
          window.removeEventListener('touchstart', handler, true);
          window.removeEventListener('keydown', handler, true);
          window.removeEventListener('click', handler, true);
        }
      });
    };

    window.addEventListener('pointerdown', handler, { capture: true, passive: true });
    window.addEventListener('touchstart', handler, { capture: true, passive: true });
    window.addEventListener('keydown', handler, { capture: true, passive: true });
    window.addEventListener('click', handler, { capture: true, passive: true });
  }

  /**
   * Desbloquea el AudioContext y precarga el audio oficial instalado
   * en el primer gesto del usuario para garantizar que cuando el SASPe
   * emita una alerta en tiempo real, la sirena suene de inmediato sin bloqueo.
   */
  public async unlockAudio(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioContext || this.audioContext.state === 'closed') {
          this.audioContext = new AudioCtx();
        }
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
        // Emitir un pulso silencioso de 1 muestra para confirmar desbloqueo de hardware
        if (this.audioContext.state === 'running' && !this.audioUnlocked) {
          const silentBuf = this.audioContext.createBuffer(1, 1, 22050);
          const src = this.audioContext.createBufferSource();
          src.buffer = silentBuf;
          src.connect(this.audioContext.destination);
          src.start(0);
          this.audioUnlocked = true;
        }
      }
      if (!this.audioBuffer) {
        this.precargarBufferAudio();
      }
      return this.audioUnlocked;
    } catch {
      return false;
    }
  }

  private async precargarBufferAudio(): Promise<void> {
    try {
      let res = await fetch('/alarma_sismo.mp3');
      if (!res.ok) res = await fetch('/alarma.mp3');
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx =
            this.audioContext && this.audioContext.state !== 'closed'
              ? this.audioContext
              : new AudioCtx();
          this.audioBuffer = await ctx.decodeAudioData(arrayBuf.slice(0));
          if (ctx !== this.audioContext && ctx.state !== 'closed') {
            await ctx.close().catch(() => {});
          }
        }
      }
    } catch {
      // Si falla la precarga (p.ej. offline inicial), se cargará al sonar
    }
  }

  public subscribe(cb: (playing: boolean) => void) {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb(this.isPlaying));
  }

  public async startAlarm(): Promise<void> {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.notify();

    // Reproducción limpia en UN solo canal sincronizado usando el archivo de audio ya instalado
    // (/alarma_sismo.mp3 con respaldo /alarma.mp3), evitando eco o pistas superpuestas.
    let audioPlayed = false;

    // 1. Prioridad: Web Audio API con AudioBuffer decodificado (bucle sin cortes y máxima fiabilidad tras unlockAudio)
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!this.audioContext || this.audioContext.state === 'closed') {
          this.audioContext = new AudioCtx();
        }
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume().catch(() => {});
        }

        const ctx = this.audioContext;
        if (!this.audioBuffer) {
          try {
            let res = await fetch('/alarma_sismo.mp3');
            if (!res.ok) res = await fetch('/alarma.mp3');
            if (res.ok) {
              const ab = await res.arrayBuffer();
              this.audioBuffer = await ctx.decodeAudioData(ab);
            }
          } catch {}
        }

        if (this.audioBuffer && ctx.state === 'running' && this.isPlaying) {
          this.gainNode = ctx.createGain();
          this.gainNode.gain.setValueAtTime(1.0, ctx.currentTime);
          this.gainNode.connect(ctx.destination);

          this.bufferSource = ctx.createBufferSource();
          this.bufferSource.buffer = this.audioBuffer;
          this.bufferSource.loop = true;
          this.bufferSource.connect(this.gainNode);
          this.bufferSource.start(0);
          audioPlayed = true;
          this.audioUnlocked = true;
          console.log('[audioAlarm] Alarma oficial (/alarma_sismo.mp3) reproduciéndose vía Web Audio API.');
        }
      }
    } catch (e) {
      console.warn('[audioAlarm] Error en reproducción Web Audio Buffer:', e);
    }

    // 2. Respaldo HTML5 Audio (si Web Audio no estaba listo o bloqueado) - solo una instancia
    if (!audioPlayed && this.isPlaying) {
      try {
        audioPlayed = await reproducirAlarma();
      } catch (e) {
        console.warn('[audioAlarm] Error en reproducirAlarma():', e);
      }
    }

    // 3. Respaldo de sirena sintetizada únicamente si ningún reproductor del MP3 pudo sonar
    if (!audioPlayed && this.isPlaying) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          if (!this.audioContext || this.audioContext.state === 'closed') {
            this.audioContext = new AudioCtx();
          }
          if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume().catch(() => {});
          }
          const ctx = this.audioContext;
          this.gainNode = ctx.createGain();
          this.gainNode.gain.setValueAtTime(0.9, ctx.currentTime);
          this.gainNode.connect(ctx.destination);

          this.osc1 = ctx.createOscillator();
          this.osc2 = ctx.createOscillator();

          this.osc1.type = 'sawtooth';
          this.osc2.type = 'sine';

          this.osc1.frequency.setValueAtTime(480, ctx.currentTime);
          this.osc2.frequency.setValueAtTime(480, ctx.currentTime);

          this.osc1.connect(this.gainNode);
          this.osc2.connect(this.gainNode);

          this.osc1.start();
          this.osc2.start();

          const startTime = ctx.currentTime;
          this.intervalId = setInterval(() => {
            if (!this.isPlaying || !this.osc1 || !this.osc2 || !this.audioContext) return;
            const t = this.audioContext.currentTime - startTime;
            const cycle = (Math.sin((2 * Math.PI * t) / 2.4 - Math.PI / 2) + 1) / 2;
            const targetFreq = 480 + 440 * Math.pow(cycle, 1.1);

            this.osc1.frequency.setTargetAtTime(targetFreq, this.audioContext.currentTime, 0.08);
            this.osc2.frequency.setTargetAtTime(targetFreq * 1.01, this.audioContext.currentTime, 0.08);
          }, 60);
        }
      } catch (synthErr) {
        console.error('Error al iniciar sirena de respaldo Web Audio:', synthErr);
      }
    }

    // 4. MediaSession API: Mantener audio en segundo plano incluso con pantalla bloqueada
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: '🚨 ¡ALARMA SÍSMICA NACIONAL - PERÚ!',
          artist: 'Red Sísmica SASPE / IGP / INDECI',
          album: 'Alerta Temprana de Emergencia Sísmica',
        });
        navigator.mediaSession.playbackState = 'playing';
      } catch (e) {}
    }

    // 5. Wake Lock API: Mantener la pantalla encendida
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
      } catch (e) {}
    }

    // 6. Vibración de emergencia continua y persistente
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([600, 200, 600, 200, 800]);
        if (this.vibrationIntervalId) clearInterval(this.vibrationIntervalId);
        this.vibrationIntervalId = setInterval(() => {
          if (!this.isPlaying) return;
          try {
            navigator.vibrate([600, 200, 600, 200, 800]);
          } catch {}
        }, 2500);
      } catch (e) {}
    }
  }

  public stopAlarm(): void {
    this.isPlaying = false;

    // Detener servicio de alarma HTML5
    try {
      detenerAlarmaServicio();
    } catch (e) {}

    // Detener elemento de audio local
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch (e) {}
    }

    // Detener AudioBufferSourceNode del archivo mp3
    if (this.bufferSource) {
      try {
        this.bufferSource.stop();
        this.bufferSource.disconnect();
      } catch (e) {}
      this.bufferSource = null;
    }

    // Detener osciladores sintéticos
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    if (this.osc1) {
      try {
        this.osc1.stop();
        this.osc1.disconnect();
      } catch (e) {}
      this.osc1 = null;
    }

    if (this.osc2) {
      try {
        this.osc2.stop();
        this.osc2.disconnect();
      } catch (e) {}
      this.osc2 = null;
    }

    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch (e) {}
      this.gainNode = null;
    }

    // Detener MediaSession
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none';
      } catch {}
    }

    // Liberar WakeLock
    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release();
      } catch {}
      this.wakeLockSentinel = null;
    }

    // Detener vibración
    if (this.vibrationIntervalId) {
      clearInterval(this.vibrationIntervalId);
      this.vibrationIntervalId = null;
    }

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch (e) {}
    }

    this.notify();
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

export const alarmManager = new AlarmController();

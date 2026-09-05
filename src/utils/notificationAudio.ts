/**
 * Gerador de notificações sonoras suaves via Web Audio API (sem dependência de arquivos externos).
 */

class NotificationAudio {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  // Notificação de Pedido Aceito (tom alegre e acolhedor)
  public playAccepted() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, time: now, dur: 0.15 }, // C5
        { freq: 659.25, time: now + 0.14, dur: 0.18 }, // E5
        { freq: 783.99, time: now + 0.30, dur: 0.35 } // G5
      ];

      notes.forEach(n => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, n.time);
        
        gain.gain.setValueAtTime(0, n.time);
        gain.gain.linearRampToValueAtTime(0.18, n.time + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, n.time + n.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(n.time);
        osc.stop(n.time + n.dur + 0.05);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Notificação de Saiu para Entrega (vibração alegre de moto/despacho)
  public playDelivering() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [
        { freq: 440.00, time: now, dur: 0.12 }, // A4
        { freq: 554.37, time: now + 0.11, dur: 0.12 }, // C#5
        { freq: 659.25, time: now + 0.22, dur: 0.15 }, // E5
        { freq: 880.00, time: now + 0.35, dur: 0.40 } // A5
      ];

      notes.forEach(n => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(n.freq, n.time);
        
        gain.gain.setValueAtTime(0, n.time);
        gain.gain.linearRampToValueAtTime(0.2, n.time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, n.time + n.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(n.time);
        osc.stop(n.time + n.dur + 0.05);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Notificação de Pedido Cancelado / Recusado
  public playCancelled() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [
        { freq: 440.00, time: now, dur: 0.2 }, // A4
        { freq: 329.63, time: now + 0.18, dur: 0.35 } // E4
      ];

      notes.forEach(n => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(n.freq, n.time);
        
        gain.gain.setValueAtTime(0, n.time);
        gain.gain.linearRampToValueAtTime(0.12, n.time + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, n.time + n.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(n.time);
        osc.stop(n.time + n.dur + 0.05);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Notificação de Concluído
  public playCompleted() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, time: now, dur: 0.12 },
        { freq: 659.25, time: now + 0.10, dur: 0.12 },
        { freq: 783.99, time: now + 0.20, dur: 0.15 },
        { freq: 1046.50, time: now + 0.32, dur: 0.45 }
      ];

      notes.forEach(n => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, n.time);
        
        gain.gain.setValueAtTime(0, n.time);
        gain.gain.linearRampToValueAtTime(0.18, n.time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, n.time + n.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(n.time);
        osc.stop(n.time + n.dur + 0.05);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }
}

export const notificationAudio = new NotificationAudio();

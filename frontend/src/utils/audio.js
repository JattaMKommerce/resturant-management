// Web Audio API Synthesizer with persistent unlocked AudioContext
let globalAudioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!globalAudioCtx) {
    globalAudioCtx = new AudioContextClass();
  }
  if (globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
}

// Call on any user interaction to unlock browser autoplay policy
export function unlockAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  } catch (e) {}
}

export function playServiceChime(type = 'call_waiter') {
  try {
    // NEVER play audio chime on customer ordering/tracking pages (/order/*, /restaurant/*, /hotel/order/*, etc.)
    const pathname = typeof window !== 'undefined' ? window.location.pathname.toLowerCase() : '';
    const isCustomerPage = 
      pathname.includes('/order') || 
      pathname.includes('/restaurant') || 
      pathname.includes('/checkout');
    
    if (isCustomerPage) {
      return; // Absolutely 100% silent on customer screens
    }

    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    if (type === 'call_waiter' || type === 'chime') {
      // Smooth 2-tone "Ding-Dong" hotel reception bell (E5 -> B5)
      // Note 1 (Ding - E5: 659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 1.2);

      // Note 2 (Dong - B5: 987.77 Hz after 180ms)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.18);
      gain2.gain.setValueAtTime(0.3, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 1.8);

    } else if (type === 'kitchen_offline_order' || type === 'offline_order') {
      // 🍽️ KITCHEN OFFLINE / TABLE / DINE-IN ORDER: Classic Chef Metallic Double Service Bell ("Ding-Ding!")
      // Strike 1: Note A5 (880 Hz) + high metallic overtone
      const osc1 = ctx.createOscillator();
      const harm1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      const harmGain1 = ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(880.00, now);
      harm1.type = 'sine';
      harm1.frequency.setValueAtTime(1760.00, now);

      gain1.gain.setValueAtTime(0.40, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      harmGain1.gain.setValueAtTime(0.20, now);
      harmGain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc1.connect(gain1);
      harm1.connect(harmGain1);
      gain1.connect(ctx.destination);
      harmGain1.connect(ctx.destination);

      osc1.start(now);
      harm1.start(now);
      osc1.stop(now + 0.75);
      harm1.stop(now + 0.25);

      // Strike 2 (160ms later): Note C6 (1046.50 Hz) + harmonic with resonant ringing sustain
      const strike2Time = now + 0.16;
      const osc2 = ctx.createOscillator();
      const harm2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      const harmGain2 = ctx.createGain();

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1046.50, strike2Time);
      harm2.type = 'sine';
      harm2.frequency.setValueAtTime(2093.00, strike2Time);

      gain2.gain.setValueAtTime(0.45, strike2Time);
      gain2.gain.exponentialRampToValueAtTime(0.001, strike2Time + 1.4);
      harmGain2.gain.setValueAtTime(0.25, strike2Time);
      harmGain2.gain.exponentialRampToValueAtTime(0.001, strike2Time + 0.35);

      osc2.connect(gain2);
      harm2.connect(harmGain2);
      gain2.connect(ctx.destination);
      harmGain2.connect(ctx.destination);

      osc2.start(strike2Time);
      harm2.start(strike2Time);
      osc2.stop(strike2Time + 1.4);
      harm2.stop(strike2Time + 0.35);

    } else if (type === 'kitchen_online_order' || type === 'online_order') {
      // 🌐 KITCHEN ONLINE / DELIVERY ORDER: Modern Upbeat 4-Note Storefront Delivery Alert ("Doo-Ree-Mii-Dooo!")
      const notes = [
        { freq: 523.25, time: 0.00, dur: 0.40, gain: 0.28 }, // C5
        { freq: 659.25, time: 0.12, dur: 0.40, gain: 0.32 }, // E5
        { freq: 783.99, time: 0.24, dur: 0.50, gain: 0.35 }, // G5
        { freq: 1046.50, time: 0.36, dur: 1.20, gain: 0.42 } // C6 (Sustained finish)
      ];

      notes.forEach((n) => {
        const startTime = now + n.time;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, startTime);

        gain.gain.setValueAtTime(n.gain, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + n.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + n.dur);
      });

    } else if (type === 'new_order') {
      // Tri-tone cheerful order chime (C5 -> E5 -> G5)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + index * 0.15;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0.30, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.0);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 1.0);
      });
    }
  } catch (e) {
    console.warn('Audio chime playback blocked or unsupported:', e.message);
  }
}

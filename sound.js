class Sounder {
  static ctx = new (window.AudioContext || window.webkitAudioContext)();
  constructor() { this.ctx = Sounder.ctx; }
  play() { }
}

class NoiseSounder extends Sounder {

  constructor(duration = 1, samples = 8000) {
    super();

    this.duration = duration;
    let dest = this.ctx.destination;

    // this.filter = new BiquadFilterNode(this.ctx, {
    //   frequency: 1000,
    //   Q: 3,
    //   type: 'bandpass'
    // });
    // this.filter.connect(dest); dest = this.filter;

    this.gain = this.ctx.createGain();
    this.gain.connect(dest); dest = this.gain;

    this.buffer = this.ctx.createBuffer(1, samples * duration, samples);
    const data = this.buffer.getChannelData(0);
    const quant = 8;
    for (let i = 0; i < this.buffer.length; i += quant) {
      const val = (Math.random() > 0.5) * 2 - 1;
      for (let j = 0; j < quant; j++)
        data[i + j] = val
    }
  }

  play() {
    this.gain.gain.setValueAtTime(1, this.ctx.currentTime);
    this.gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + this.duration);

    const node = new AudioBufferSourceNode(this.ctx, { buffer: this.buffer });
    node.connect(this.gain);
    node.start();
    node.stop(this.ctx.currentTime + this.duration);
  }
}

class ProjectileSounder extends Sounder {
  play() {
    if (!this.oscillator) {
      this.oscillator = this.ctx.createOscillator();
      this.oscillator.type = 'sine';
      this.oscillator.connect(this.ctx.destination);
      try { this.oscillator.start(); } catch (e) { console.error(e); }
    }
  }

  stop() {
    if (this.oscillator) {
      try { this.oscillator.stop(); } catch (e) { console.error(e); }
      this.oscillator = undefined;
    }
  }
}

class PenaltySounder extends Sounder {
  constructor() {
    super();
    let dest = this.ctx.destination;

    this.delay = this.ctx.createDelay();
    this.delay.delayTime.value = 0.4;
    this.delay.connect(dest); dest = this.delay;

    this.oscillator = this.ctx.createOscillator();
    this.oscillator.type = 'sawtooth';
    this.oscillator.connect(dest); dest = this.oscillator;
  }

  play(frequency, duration = 0.3) {
    // 2750 SOUND1,-15,70,4: SOUND1,-15,50,10
    this.oscillator.frequency.value = 70 * 5;
    this.oscillator.frequency.setValueAtTime(50 * 5, this.ctx.currentTime + 4 / 19);
    try { this.oscillator.start(); } catch (e) { console.error(e); }
    this.oscillator.stop(this.ctx.currentTime + 14 / 19);
  }
}

const smallExplosionSounder = new NoiseSounder(1.2);
const largeExplosionSounder = new NoiseSounder(6.0);
const penaltySounder = new PenaltySounder();
const projectileSounder = new ProjectileSounder();

function playProjectileSound(y) {
  // 1140 SOUND 1,-11,S,1: IF Y-H(X)>=1 THEN S=S-1:GOTO1050
  projectileSounder.oscillator.frequency.value = 440 + y * 5;
}

function playImpactSound() {
  projectileSounder.stop();
  smallExplosionSounder.play();
}

function playOutOfBoundsSound() {
  projectileSounder.stop();
}

function playDirectHitSound() {
  projectileSounder.stop();
  // 1490 FOR BB=-150 TO 0:SOUND 0,BB/10,6,1:NEXT BB
  largeExplosionSounder.play();
}

function playCityHitSound() {
  projectileSounder.stop();
  // 2730 ENVELOPE1,129,0,0,0,0,0,0,10,-1,-126,-126,126,0:SOUND0,1,6,30
  // 2740 flaghit=1
  // 2750 SOUND1,-15,70,4:SOUND1,-15,50,10
  smallExplosionSounder.play();
  penaltySounder.play();
}

function playNearSound() {
  projectileSounder.stop();
  smallExplosionSounder.play();
}

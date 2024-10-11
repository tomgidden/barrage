var audioContext;

function playSound(frequency, duration) {

  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  // gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + duration);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function playProjectileSound(y) {
  playSound(440 + y * 2, 0.1);
}

function playImpactSound() {
  playSound(100, 0.3);
}

function playOutOfBoundsSound() {
  playSound(200, 0.2);
}

function playDirectHitSound() {
  playSound(880, 0.5);
}

function playCityHitSound() {
  playSound(660, 0.4);
}

function playMissSound() {
  playSound(330, 0.2);
}
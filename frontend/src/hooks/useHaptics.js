export function triggerHaptic(pattern = [30]) {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  navigator.vibrate(pattern);
}

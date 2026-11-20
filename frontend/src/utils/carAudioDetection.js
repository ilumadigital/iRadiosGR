// Car Mode is an opt-in driving UI. Never infer driving or car connectivity
// from GPS speed, orientation, generic Bluetooth names or User-Agent keywords.
// Web/PWA clients cannot reliably discover CarPlay / Android Auto connection
// state or the system's default Bluetooth audio route.
export const CAR_AUDIO_CHANGE_EVENT = 'iradios:car-audio-change';

const CAR_CONNECTION_TYPES = new Set([
  'carplay', 'apple_carplay', 'android_auto',
  'car_bluetooth', 'bluetooth_car', 'automotive_bluetooth'
]);

const CAR_OUTPUT_PATTERNS = [
  /\b(?:apple[\s_-]*)?carplay\b/i,
  /\bandroid[\s_-]*auto\b/i,
  /\bcar[\s_-]*(?:audio|kit|multimedia|stereo|hands[\s_-]*free|bluetooth|bt)\b/i,
  /\b(?:vehicle|automotive|in[\s_-]*car|head[\s_-]*unit)[\s_-]*(?:audio|bluetooth|bt)\b/i,
  /\buconnect\b/i,
  /\bford[\s_-]*sync\b/i,
  /\b(?:bmw|mercedes[\s_-]*benz|volkswagen|vw)[\s_-]+(?:audio|bluetooth|hands[\s_-]*free)\b/i
];

export function isPhoneClient(nav) {
  const ua = String(nav?.userAgent || '');
  if (/\b(?:Windows NT|Macintosh|CrOS|X11|Linux x86_64|iPad|Android TV|GoogleTV|SmartTV|Tizen|PlayStation|Xbox)\b/i.test(ua))
    return false;
  if (typeof nav?.userAgentData?.mobile === 'boolean' && !nav.userAgentData.mobile)
    return false;
  return /\biPhone\b|\biPod\b/i.test(ua) ||
    (/\bAndroid\b/i.test(ua) &&
      (/\bMobile\b/i.test(ua) || nav?.userAgentData?.mobile === true));
}

export function carAudioKind(value) {
  return String(value || '').toLowerCase().trim().replace(/[\s-]+/g, '_');
}

export function isConfirmedNativeCarConnection(state) {
  return state?.connected === true &&
    CAR_CONNECTION_TYPES.has(carAudioKind(state.kind || state.type));
}

export function isExplicitCarAudioLabel(label) {
  const name = String(label || '').trim();
  return Boolean(name) && CAR_OUTPUT_PATTERNS.some(pattern => pattern.test(name));
}

export async function isSelectedCarAudioOutput(audioElement, mediaDevices) {
  // The default sink does not expose the OS audio route: NEVER infer a car
  // from any available audioinput/audiooutput labels without a selected sink.
  const sinkId = audioElement?.sinkId;
  if (!sinkId || sinkId === 'default' || sinkId === 'communications' ||
      typeof mediaDevices?.enumerateDevices !== 'function') return false;
  try {
    const devices = await mediaDevices.enumerateDevices();
    return Array.isArray(devices) && devices.some(device =>
      device.kind === 'audiooutput' &&
      device.deviceId === sinkId &&
      isExplicitCarAudioLabel(device.label)
    );
  } catch {
    // Permission restrictions and unsupported platforms are not confirmation.
    return false;
  }
}

export async function detectCarAudioConnection({nav, win, audioElement} = {}) {
  if (!isPhoneClient(nav)) return 'disconnected';
  let nativeState;
  try {
    // Integration contract for future native wrappers only:
    // window.iRadiosCarAudioBridge.getConnectionState()
    //   -> {connected:boolean, kind:'carplay'|'android_auto'|'car_bluetooth'}
    // The wrapper dispatches CAR_AUDIO_CHANGE_EVENT when connection changes.
    // No generic postMessage or query parameter is treated as trusted proof.
    if (typeof win?.iRadiosCarAudioBridge?.getConnectionState === 'function')
      nativeState = await win.iRadiosCarAudioBridge.getConnectionState();
  } catch {
    // Do not guess car state when the native bridge fails.
  }
  if (isConfirmedNativeCarConnection(nativeState)) return 'connected';
  if (await isSelectedCarAudioOutput(audioElement, nav?.mediaDevices))
    return 'connected';
  return nativeState?.connected === false ? 'disconnected' : 'unknown';
}

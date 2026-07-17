export interface GamepadSnapshot {
  connected: boolean;
  id: string;
  axes: readonly number[];
  buttons: readonly number[];
}

const EMPTY: GamepadSnapshot = { connected: false, id: '', axes: [], buttons: [] };

export function pollGamepad(): GamepadSnapshot {
  const pad = navigator.getGamepads().find((p) => p !== null);
  if (!pad) return EMPTY;
  return {
    connected: true,
    id: pad.id,
    axes: pad.axes.map((a) => Math.round(a * 100) / 100),
    buttons: pad.buttons.map((b) => Math.round(b.value * 100) / 100),
  };
}

export function formatGamepad(snap: GamepadSnapshot): string {
  if (!snap.connected) {
    return 'GamePad: 未接続（ボタンを押すと認識されます）';
  }
  return [
    `GamePad: ${snap.id}`,
    `axes:    [${snap.axes.join(', ')}]`,
    `buttons: [${snap.buttons.join(', ')}]`,
  ].join('\n');
}

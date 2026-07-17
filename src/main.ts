import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  loadModelFromFile,
  loadVRM,
  loadVRMA,
  loadVRMAFromFile,
  type LoadedModel,
} from './loaders';
import { pollGamepad, formatGamepad } from './gamepad';
import { CharacterController, LOCOMOTION_STATES, type LocomotionState } from './character';
import { GelMode } from './gel';
import { Ragdoll } from './ragdoll';
import demoVert from './shaders/demo.vert?raw';
import demoFrag from './shaders/demo.frag?raw';

const canvas = document.querySelector<HTMLCanvasElement>('#viewport')!;
const gamepadStatus = document.querySelector<HTMLPreElement>('#gamepad-status')!;
const fileInput = document.querySelector<HTMLInputElement>('#file-input')!;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101018);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
camera.position.set(0, 1.2, 3);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1, 0);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
dirLight.position.set(1, 2, 2);
scene.add(dirLight);
scene.add(new THREE.GridHelper(10, 10, 0x444455, 0x2a2a38));

// カスタムシェーダーのデモ: モデル未ロード時のプレースホルダーも兼ねる
const shaderMaterial = new THREE.ShaderMaterial({
  vertexShader: demoVert,
  fragmentShader: demoFrag,
  uniforms: { uTime: { value: 0 } },
});
const demoMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 32), shaderMaterial);
demoMesh.position.set(0, 1, 0);
scene.add(demoMesh);

let current: LoadedModel | null = null;
let character: CharacterController | null = null;
let ragdoll: Ragdoll | null = null;
let ragdollLoading = false;
const gelMode = new GelMode();

function toggleRagdoll() {
  if (ragdoll) {
    ragdoll.dispose();
    ragdoll = null;
    return;
  }
  if (!character || ragdollLoading) return;
  ragdollLoading = true;
  Ragdoll.create(character.vrm)
    .then((r) => {
      ragdoll = r;
    })
    .catch(console.error)
    .finally(() => {
      ragdollLoading = false;
    });
}

function setModel(model: LoadedModel) {
  if (current) {
    gelMode.restore();
    ragdoll?.dispose();
    ragdoll = null;
    scene.remove(current.object);
    current.dispose();
  }
  current = model;
  character = model.vrm ? new CharacterController(model.vrm) : null;
  demoMesh.visible = false;
  scene.add(model.object);
  console.log('[webgl-lab] model loaded');
}

async function replaceModel(file: File) {
  try {
    if (file.name.toLowerCase().endsWith('.vrma')) {
      if (!character) return;
      // ファイル名に含まれるステート名で割り当てる（該当なしは walk 扱い）
      const lower = file.name.toLowerCase();
      const kind: LocomotionState = LOCOMOTION_STATES.find((s) => lower.includes(s)) ?? 'walk';
      character.setAnimation(kind, await loadVRMAFromFile(file));
      console.log(`[webgl-lab] vrma loaded (${kind})`);
      return;
    }
    setModel(await loadModelFromFile(file));
  } catch (err) {
    console.error(err);
  }
}

// 未配置時はdevサーバーのSPAフォールバックが index.html を返すので弾く
async function staticFileExists(url: string): Promise<boolean> {
  const head = await fetch(url, { method: 'HEAD' });
  return head.ok && !head.headers.get('content-type')?.includes('text/html');
}

// public/models/ に置いたVRM/VRMA（gitignore対象）を起動時に自動読み込みする。
// ?model=/models/foo.vrm で切り替え可。無ければデモメッシュのまま
async function loadDefaultAssets() {
  const url = new URLSearchParams(location.search).get('model') ?? '/models/salome.vrm';
  try {
    if (!(await staticFileExists(url))) return;
    setModel(await loadVRM(url));
    for (const kind of LOCOMOTION_STATES) {
      const vrmaUrl = `/models/${kind}.vrma`;
      if (character && (await staticFileExists(vrmaUrl))) {
        character.setAnimation(kind, await loadVRMA(vrmaUrl));
        console.log(`[webgl-lab] vrma loaded (${kind})`);
      }
    }
  } catch (err) {
    console.error(err);
  }
}
void loadDefaultAssets();

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) void replaceModel(file);
});

document.body.addEventListener('dragover', (e) => {
  e.preventDefault();
  document.body.classList.add('dragover');
});
document.body.addEventListener('dragleave', () => {
  document.body.classList.remove('dragover');
});
document.body.addEventListener('drop', (e) => {
  e.preventDefault();
  document.body.classList.remove('dragover');
  const file = e.dataTransfer?.files[0];
  if (file) void replaceModel(file);
});

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// 移動入力: WASD/矢印キー + GamePad左スティック（?walk で強制前進デバッグ）
// Shift/パッドボタン0=ダッシュ、C/ボタン1=しゃがみトグル、X/ボタン2=座るトグル
const pressedKeys = new Set<string>();
window.addEventListener('keydown', (e) => {
  pressedKeys.add(e.code);
  if (e.repeat) return;
  if (e.code === 'KeyC') character?.toggleCrouch();
  if (e.code === 'KeyX') character?.toggleSit();
  if (e.code === 'KeyG' && current) gelMode.cycle(current.object);
  if (e.code === 'KeyR') toggleRagdoll();
});
window.addEventListener('keyup', (e) => pressedKeys.delete(e.code));
const forceWalk = new URLSearchParams(location.search).has('walk');

const prevPadButtons: number[] = [];
function handlePadButtons(pad: ReturnType<typeof pollGamepad>) {
  if (!pad.connected) return;
  const pressed = (i: number) => (pad.buttons[i] ?? 0) > 0.5 && (prevPadButtons[i] ?? 0) <= 0.5;
  if (pressed(1)) character?.toggleCrouch();
  if (pressed(2)) character?.toggleSit();
  prevPadButtons.length = 0;
  prevPadButtons.push(...pad.buttons);
}

const DEADZONE = 0.15;

function readMoveInput(pad: ReturnType<typeof pollGamepad>): THREE.Vector2 {
  const move = new THREE.Vector2();
  if (pressedKeys.has('KeyW') || pressedKeys.has('ArrowUp')) move.y -= 1;
  if (pressedKeys.has('KeyS') || pressedKeys.has('ArrowDown')) move.y += 1;
  if (pressedKeys.has('KeyA') || pressedKeys.has('ArrowLeft')) move.x -= 1;
  if (pressedKeys.has('KeyD') || pressedKeys.has('ArrowRight')) move.x += 1;
  if (pad.connected) {
    const [x = 0, y = 0] = pad.axes;
    if (Math.hypot(x, y) > DEADZONE) move.set(move.x + x, move.y + y);
  }
  if (forceWalk && move.lengthSq() === 0) move.set(0, -1);
  return move.clampLength(0, 1);
}

// 画面基準の入力（W=奥、D=右）をカメラの向きに合わせてワールドXZへ変換する
const cameraDir = new THREE.Vector3();
function toWorldMove(input: THREE.Vector2): THREE.Vector2 {
  camera.getWorldDirection(cameraDir);
  const forward = new THREE.Vector2(cameraDir.x, cameraDir.z).normalize();
  const right = new THREE.Vector2(-forward.y, forward.x);
  return new THREE.Vector2(
    right.x * input.x - forward.x * input.y,
    right.y * input.x - forward.y * input.y,
  ).clampLength(0, 1);
}

// ?rdtest: タブ非表示でも動くラグドール自己診断（検証後に削除）
if (new URLSearchParams(location.search).has('rdtest')) {
  setTimeout(async () => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    for (let i = 0; i < 30 && !character; i++) await wait(300);
    if (!current || !character) {
      console.log('[rdtest] no model');
      return;
    }
    gelMode.cycle(current.object);
    toggleRagdoll();
    for (let i = 0; i < 30 && !ragdoll; i++) await wait(300);
    if (!ragdoll) {
      console.log('[rdtest] ragdoll timeout');
      return;
    }
    let t = 0;
    for (let i = 0; i < 240; i++) {
      t += 1 / 60;
      ragdoll.step(1 / 60);
      gelMode.update(t, 1 / 60);
    }
    let nan: string | null = null;
    character.vrm.scene.traverse((o) => {
      if (!nan && (Number.isNaN(o.position.x) || Number.isNaN(o.quaternion.x))) nan = o.name || '?';
    });
    const head = character.vrm.humanoid.getRawBoneNode('head');
    head?.updateWorldMatrix(true, false);
    const e = head?.matrixWorld.elements ?? [];
    renderer.render(scene, camera);
    console.log(
      '[rdtest]',
      JSON.stringify({ nan, head: [e[12], e[13], e[14]].map((v) => v?.toFixed(2)) }),
    );
  }, 2000);
}

const clock = new THREE.Clock();
const followTarget = new THREE.Vector3();

// デバッグ用にコンソールから参照できるようにする
declare global {
  interface Window {
    lab: {
      character: CharacterController | null;
      camera: THREE.PerspectiveCamera;
      gelMode: GelMode;
      ragdoll: Ragdoll | null;
      /** タブ非表示でrAFが止まっていても手動で1フレーム描画する */
      render: () => void;
      toggleGel: () => void;
      toggleRagdoll: () => void;
    };
  }
}
window.lab = {
  get character() {
    return character;
  },
  camera,
  gelMode,
  get ragdoll() {
    return ragdoll;
  },
  toggleRagdoll,
  render: () => renderer.render(scene, camera),
  toggleGel: () => {
    if (current) gelMode.cycle(current.object);
  },
};

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  shaderMaterial.uniforms.uTime.value = clock.elapsedTime;
  gelMode.update(clock.elapsedTime, delta);
  if (character) character.collapse = gelMode.meltWeight;

  const pad = pollGamepad();
  gamepadStatus.textContent = formatGamepad(pad);

  if (ragdoll) {
    ragdoll.step(delta);
  } else if (character) {
    handlePadButtons(pad);
    const dash =
      pressedKeys.has('ShiftLeft') ||
      pressedKeys.has('ShiftRight') ||
      (pad.connected && (pad.buttons[0] ?? 0) > 0.5);
    character.update(delta, { move: toWorldMove(readMoveInput(pad)), dash });
    // カメラはキャラクターの胸元あたりを緩く追従する
    followTarget.copy(character.vrm.scene.position).add(new THREE.Vector3(0, 1, 0));
    controls.target.lerp(followTarget, 1 - Math.exp(-4 * delta));
  }
  controls.update();

  renderer.render(scene, camera);
});

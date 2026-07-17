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
import { CharacterController } from './character';
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

function setModel(model: LoadedModel) {
  if (current) {
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
      // ファイル名に idle を含むものは待機、それ以外は歩行モーションとして扱う
      const kind = file.name.toLowerCase().includes('idle') ? 'idle' : 'walk';
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
    for (const kind of ['idle', 'walk'] as const) {
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
const pressedKeys = new Set<string>();
window.addEventListener('keydown', (e) => pressedKeys.add(e.code));
window.addEventListener('keyup', (e) => pressedKeys.delete(e.code));
const forceWalk = new URLSearchParams(location.search).has('walk');

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

const clock = new THREE.Clock();
const followTarget = new THREE.Vector3();

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  shaderMaterial.uniforms.uTime.value = clock.elapsedTime;

  const pad = pollGamepad();
  gamepadStatus.textContent = formatGamepad(pad);

  if (character) {
    character.update(delta, readMoveInput(pad));
    // カメラはキャラクターの胸元あたりを緩く追従する
    followTarget.copy(character.vrm.scene.position).add(new THREE.Vector3(0, 1, 0));
    controls.target.lerp(followTarget, 1 - Math.exp(-4 * delta));
  }
  controls.update();

  renderer.render(scene, camera);
});

import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadModelFromFile, loadVRM, type LoadedModel } from './loaders';
import { pollGamepad, formatGamepad } from './gamepad';
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

function setModel(model: LoadedModel) {
  if (current) {
    scene.remove(current.object);
    current.dispose();
  }
  current = model;
  demoMesh.visible = false;
  scene.add(model.object);
  console.log('[webgl-lab] model loaded');
}

async function replaceModel(file: File) {
  try {
    setModel(await loadModelFromFile(file));
  } catch (err) {
    console.error(err);
  }
}

// public/models/ に置いたVRM（gitignore対象）を起動時に自動読み込みする。
// ?model=/models/foo.vrm で切り替え可。無ければデモメッシュのまま
async function loadDefaultModel() {
  const url = new URLSearchParams(location.search).get('model') ?? '/models/salome.vrm';
  try {
    const head = await fetch(url, { method: 'HEAD' });
    // 未配置時はdevサーバーのSPAフォールバックが index.html を返すので弾く
    if (!head.ok || head.headers.get('content-type')?.includes('text/html')) return;
    setModel(await loadVRM(url));
  } catch {
    // デフォルトモデル未配置は正常系
  }
}
void loadDefaultModel();

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

const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const delta = clock.getDelta();
  shaderMaterial.uniforms.uTime.value = clock.elapsedTime;

  current?.vrm?.update(delta);
  controls.update();

  const pad = pollGamepad();
  gamepadStatus.textContent = formatGamepad(pad);
  // 左スティックでロード済みモデルを回す簡易検証
  if (pad.connected && current) {
    current.object.rotation.y += (pad.axes[0] ?? 0) * delta * 2;
  }

  renderer.render(scene, camera);
});

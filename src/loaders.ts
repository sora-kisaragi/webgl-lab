import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';

export interface LoadedModel {
  object: THREE.Object3D;
  vrm?: VRM;
  dispose: () => void;
}

const gltfLoader = new GLTFLoader();
gltfLoader.register((parser) => new VRMLoaderPlugin(parser));

const objLoader = new OBJLoader();

export async function loadVRM(url: string): Promise<LoadedModel> {
  const gltf = await gltfLoader.loadAsync(url);
  const vrm = gltf.userData.vrm as VRM;
  VRMUtils.removeUnnecessaryVertices(vrm.scene);
  VRMUtils.combineSkeletons(vrm.scene);
  vrm.scene.traverse((obj) => {
    obj.frustumCulled = false;
  });
  return {
    object: vrm.scene,
    vrm,
    dispose: () => VRMUtils.deepDispose(vrm.scene),
  };
}

export async function loadOBJ(url: string): Promise<LoadedModel> {
  const object = await objLoader.loadAsync(url);
  const fallback = new THREE.MeshStandardMaterial({ color: 0xcccccc });
  object.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.material = fallback;
    }
  });
  return {
    object,
    dispose: () => {
      object.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
        }
      });
      fallback.dispose();
    },
  };
}

export async function loadModelFromFile(file: File): Promise<LoadedModel> {
  const url = URL.createObjectURL(file);
  try {
    const name = file.name.toLowerCase();
    if (name.endsWith('.vrm')) return await loadVRM(url);
    if (name.endsWith('.obj')) return await loadOBJ(url);
    throw new Error(`未対応の拡張子です: ${file.name}`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

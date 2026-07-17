import * as THREE from 'three';
import gelVert from './shaders/gel.vert?raw';
import gelFrag from './shaders/gel.frag?raw';

/**
 * モデル全体をゲル状（半透明・ぷるぷる）の見た目に切り替えるトグル。
 * 元のマテリアルを保持しておき、解除時に復元する。
 * スキニングはthreeのシェーダーチャンク（skinning_vertex等）で対応済み。
 */
export class GelMode {
  readonly material: THREE.ShaderMaterial;
  private readonly original = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private target: THREE.Object3D | null = null;

  constructor(color = 0xf5d442) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: gelVert,
      fragmentShader: gelFrag,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
      },
      transparent: true,
      depthWrite: true,
    });
  }

  get enabled(): boolean {
    return this.target !== null;
  }

  update(time: number) {
    this.material.uniforms.uTime.value = time;
  }

  toggle(object: THREE.Object3D) {
    if (this.target === object) {
      this.restore();
      return;
    }
    this.restore();
    this.target = object;
    object.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        this.original.set(obj, obj.material);
        obj.material = this.material;
      }
    });
  }

  restore() {
    for (const [mesh, material] of this.original) {
      mesh.material = material;
    }
    this.original.clear();
    this.target = null;
  }
}

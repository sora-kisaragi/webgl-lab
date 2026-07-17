import * as THREE from 'three';
import gelVert from './shaders/gel.vert?raw';
import gelFrag from './shaders/gel.frag?raw';

export type GelState = 'off' | 'gel' | 'melt';

/**
 * モデルをゲル状の見た目に切り替えるトグル。
 * off → gel（ぷるぷる） → melt（どろどろ融解） → off とサイクルする。
 * 元のマテリアルを保持しておき、解除時に復元する。
 * スキニングはthreeのシェーダーチャンク（skinning_vertex等）で対応済み。
 */
export class GelMode {
  readonly material: THREE.ShaderMaterial;
  state: GelState = 'off';

  private readonly original = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  private target: THREE.Object3D | null = null;
  private melt = 0;

  // ゲルバナの緑
  constructor(color = 0x6fd447) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: gelVert,
      fragmentShader: gelFrag,
      uniforms: {
        uTime: { value: 0 },
        uMelt: { value: 0 },
        uColor: { value: new THREE.Color(color) },
      },
      transparent: true,
      depthWrite: true,
    });
  }

  /** 融解の進行度 0〜1（ラグドール風崩壊の重みにも使う） */
  get meltWeight(): number {
    return this.melt;
  }

  update(time: number, delta: number) {
    this.material.uniforms.uTime.value = time;
    this.melt = THREE.MathUtils.damp(this.melt, this.state === 'melt' ? 1 : 0, 2.5, delta);
    this.material.uniforms.uMelt.value = this.melt;
  }

  cycle(object: THREE.Object3D): GelState {
    if (this.target !== object) this.restore();
    if (this.state === 'off') {
      this.apply(object);
      this.state = 'gel';
    } else if (this.state === 'gel') {
      this.state = 'melt';
    } else {
      this.restore();
    }
    return this.state;
  }

  restore() {
    for (const [mesh, material] of this.original) {
      mesh.material = material;
    }
    this.original.clear();
    this.target = null;
    this.state = 'off';
    this.melt = 0;
    this.material.uniforms.uMelt.value = 0;
  }

  private apply(object: THREE.Object3D) {
    this.target = object;
    object.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        this.original.set(obj, obj.material);
        obj.material = this.material;
      }
    });
  }
}

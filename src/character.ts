import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { createVRMAnimationClip, type VRMAnimation } from '@pixiv/three-vrm-animation';

const TURN_DAMP = 10;
const FADE_DAMP = 6;

/**
 * VRMの移動と歩行アニメーションを制御する。
 * VRMAクリップ（idle/walk）があればクロスフェード再生し、
 * 無ければ正規化ボーンを直接揺らすプロシージャル歩行で代用する。
 */
export class CharacterController {
  readonly vrm: VRM;
  speed = 1.4;

  private readonly mixer: THREE.AnimationMixer;
  private idleAction: THREE.AnimationAction | null = null;
  private walkAction: THREE.AnimationAction | null = null;
  private phase = 0;
  private walkWeight = 0;
  private facingOffset = 0;
  private calibrated = false;

  constructor(vrm: VRM) {
    this.vrm = vrm;
    this.mixer = new THREE.AnimationMixer(vrm.scene);
  }

  get hasClips(): boolean {
    return this.idleAction !== null && this.walkAction !== null;
  }

  setAnimation(kind: 'idle' | 'walk', animation: VRMAnimation) {
    const clip = createVRMAnimationClip(animation, this.vrm);
    this.calibrated = false;
    const action = this.mixer.clipAction(clip);
    action.play();
    if (kind === 'idle') {
      this.idleAction = action;
    } else {
      this.walkAction = action;
    }
  }

  update(delta: number, move: THREE.Vector2) {
    const moving = move.lengthSq() > 0.001;
    const obj = this.vrm.scene;

    if (moving) {
      const targetYaw = Math.atan2(move.x, move.y) - this.facingOffset;
      let diff = targetYaw - obj.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      obj.rotation.y += diff * Math.min(1, TURN_DAMP * delta);
      obj.position.x += move.x * this.speed * delta;
      obj.position.z += move.y * this.speed * delta;
    }

    this.walkWeight = THREE.MathUtils.damp(this.walkWeight, moving ? 1 : 0, FADE_DAMP, delta);

    if (this.idleAction && this.walkAction) {
      this.idleAction.weight = 1 - this.walkWeight;
      this.walkAction.weight = this.walkWeight;
    } else {
      this.updateProceduralPose(delta, moving);
    }

    this.mixer.update(delta);
    this.vrm.update(delta);

    if (!this.calibrated) {
      this.calibrateFacing();
      this.calibrated = true;
    }
  }

  /**
   * モデルの向き規約はVRM0/VRM1やモーションの変換元によってπズレることがあるため、
   * 推測ではなく実際の顔の向き（両目の中点と頭の位置関係）を実測して補正値を求める。
   * 姿勢由来のブレを避けるため 0 か π に丸める。目が無いモデルは補正なし。
   */
  private calibrateFacing() {
    const head = this.vrm.humanoid.getRawBoneNode('head');
    const leftEye = this.vrm.humanoid.getRawBoneNode('leftEye');
    const rightEye = this.vrm.humanoid.getRawBoneNode('rightEye');
    if (!head || !leftEye || !rightEye) return;
    this.vrm.scene.updateWorldMatrix(true, true);
    const pos = (n: THREE.Object3D) => new THREE.Vector3().setFromMatrixPosition(n.matrixWorld);
    const face = pos(leftEye).add(pos(rightEye)).multiplyScalar(0.5).sub(pos(head));
    const diff = Math.atan2(face.x, face.z) - this.vrm.scene.rotation.y;
    const wrapped = Math.atan2(Math.sin(diff), Math.cos(diff));
    this.facingOffset = Math.abs(wrapped) > Math.PI / 2 ? Math.PI : 0;
  }

  private setBoneRotation(name: VRMHumanBoneName, x = 0, y = 0, z = 0) {
    this.vrm.humanoid.getNormalizedBoneNode(name)?.rotation.set(x, y, z);
  }

  /** VRMAが無いときの簡易歩行。正規化ボーン（VRM1のT-pose基準）を直接回す */
  private updateProceduralPose(delta: number, moving: boolean) {
    if (moving) {
      this.phase += delta * this.speed * 5.5;
    }
    const w = this.walkWeight;
    const swing = Math.sin(this.phase) * w;

    // 腕はT-poseから常に下ろしておく（歩行時は脚と逆位相で振る）
    this.setBoneRotation('leftUpperArm', -swing * 0.35, 0, 1.15);
    this.setBoneRotation('rightUpperArm', swing * 0.35, 0, -1.15);
    this.setBoneRotation('leftUpperLeg', -swing * 0.55);
    this.setBoneRotation('rightUpperLeg', swing * 0.55);
    // 膝は常に前方でのみ曲がるよう位相をずらして脈動させる
    this.setBoneRotation('leftLowerLeg', -Math.max(0, Math.cos(this.phase)) * 0.6 * w);
    this.setBoneRotation('rightLowerLeg', -Math.max(0, -Math.cos(this.phase)) * 0.6 * w);
    this.setBoneRotation('spine', Math.sin(this.phase * 2) * 0.03 * w);
  }
}

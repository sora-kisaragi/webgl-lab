import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import { createVRMAnimationClip, type VRMAnimation } from '@pixiv/three-vrm-animation';

export type LocomotionState = 'idle' | 'walk' | 'run' | 'crouch' | 'sit';
export const LOCOMOTION_STATES: LocomotionState[] = ['idle', 'walk', 'run', 'crouch', 'sit'];

export interface CharacterInput {
  /** ワールドXZの移動方向（長さ0〜1） */
  move: THREE.Vector2;
  /** ダッシュ入力（Shift / GamePadボタン長押し） */
  dash: boolean;
}

const TURN_DAMP = 10;
const FADE_DAMP = 6;

const SPEEDS: Record<LocomotionState, number> = {
  idle: 0,
  walk: 1.2,
  run: 3.2,
  crouch: 0.55,
  sit: 0,
};

type BonePose = Partial<Record<VRMHumanBoneName, [number, number, number]>>;

interface Pose {
  bones: BonePose;
  /** 正規化hipsのY方向オフセット（しゃがみ・座りで沈める） */
  hipsY: number;
}

/**
 * VRMのロコモーション（待機/歩行/走行/しゃがみ/座り）を制御する。
 * ステートごとにVRMAクリップがあればクロスフェード再生し、
 * 無いステートは正規化ボーンを直接制御するプロシージャルポーズで代用する。
 */
export class CharacterController {
  readonly vrm: VRM;
  state: LocomotionState = 'idle';

  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<LocomotionState, THREE.AnimationAction>();
  private readonly weights: Record<LocomotionState, number> = {
    idle: 1,
    walk: 0,
    run: 0,
    crouch: 0,
    sit: 0,
  };
  private crouching = false;
  private sitting = false;
  private phase = 0;
  private elapsed = 0;
  private facingOffset = 0;
  private calibrated = false;
  private readonly hipsBaseY: number;

  constructor(vrm: VRM) {
    this.vrm = vrm;
    this.mixer = new THREE.AnimationMixer(vrm.scene);
    this.hipsBaseY = vrm.humanoid.getNormalizedBoneNode('hips')?.position.y ?? 0;
  }

  get hasClips(): boolean {
    return this.actions.size > 0;
  }

  setAnimation(kind: LocomotionState, animation: VRMAnimation) {
    const clip = createVRMAnimationClip(animation, this.vrm);
    this.calibrated = false;
    const action = this.mixer.clipAction(clip);
    action.play();
    this.actions.get(kind)?.stop();
    this.actions.set(kind, action);
  }

  toggleCrouch() {
    this.crouching = !this.crouching;
    if (this.crouching) this.sitting = false;
  }

  toggleSit() {
    this.sitting = !this.sitting;
    if (this.sitting) this.crouching = false;
  }

  update(delta: number, input: CharacterInput) {
    this.elapsed += delta;
    // 座り中に移動入力が入ったら立ち上がる
    if (this.sitting && input.move.lengthSq() > 0.04) this.sitting = false;
    const moving = !this.sitting && input.move.lengthSq() > 0.001;

    this.state = this.sitting
      ? 'sit'
      : this.crouching
        ? 'crouch'
        : !moving
          ? 'idle'
          : input.dash
            ? 'run'
            : 'walk';

    for (const s of LOCOMOTION_STATES) {
      this.weights[s] = THREE.MathUtils.damp(
        this.weights[s],
        s === this.state ? 1 : 0,
        FADE_DAMP,
        delta,
      );
    }
    const speed = LOCOMOTION_STATES.reduce((acc, s) => acc + this.weights[s] * SPEEDS[s], 0);

    const obj = this.vrm.scene;
    if (moving) {
      const targetYaw = Math.atan2(input.move.x, input.move.y) - this.facingOffset;
      let diff = targetYaw - obj.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      obj.rotation.y += diff * Math.min(1, TURN_DAMP * delta);
      obj.position.x += input.move.x * speed * delta;
      obj.position.z += input.move.y * speed * delta;
      this.phase += delta * (3.5 + speed * 2.5);
    }

    // クリップのあるステートはmixerのweightで、無いステートはプロシージャルで合成する
    let clipWeight = 0;
    for (const s of LOCOMOTION_STATES) {
      const action = this.actions.get(s);
      if (action) {
        action.weight = this.weights[s];
        clipWeight += this.weights[s];
      }
    }
    this.mixer.update(delta);
    this.applyProceduralPoses(clipWeight, moving);

    this.vrm.update(delta);

    if (!this.calibrated) {
      this.calibrateFacing();
      this.calibrated = true;
    }
  }

  private readonly tmpQ = new THREE.Quaternion();
  private readonly tmpE = new THREE.Euler();

  /** クリップの無いステートのポーズを、重みの逐次slerpでmixer結果に混ぜる */
  private applyProceduralPoses(clipWeight: number, moving: boolean) {
    let acc = clipWeight;
    const hips = this.vrm.humanoid.getNormalizedBoneNode('hips');
    for (const s of LOCOMOTION_STATES) {
      const w = this.weights[s];
      if (this.actions.has(s) || w < 0.005) continue;
      acc += w;
      const ratio = acc > 0 ? w / acc : 1;
      const pose = this.statePose(s, moving);
      for (const [name, rot] of Object.entries(pose.bones)) {
        const bone = this.vrm.humanoid.getNormalizedBoneNode(name as VRMHumanBoneName);
        if (!bone || !rot) continue;
        this.tmpQ.setFromEuler(this.tmpE.set(rot[0], rot[1], rot[2]));
        bone.quaternion.slerp(this.tmpQ, ratio);
      }
      if (hips) {
        hips.position.y = THREE.MathUtils.lerp(hips.position.y, this.hipsBaseY + pose.hipsY, ratio);
      }
    }
  }

  /** ステートごとのプロシージャルポーズ。なるべく優雅（背筋を伸ばし、手は前で添える） */
  private statePose(state: LocomotionState, moving: boolean): Pose {
    const breath = Math.sin(this.elapsed * 1.6);
    const swing = Math.sin(this.phase);
    const kneeL = Math.max(0, Math.cos(this.phase));
    const kneeR = Math.max(0, -Math.cos(this.phase));
    switch (state) {
      case 'idle':
        // 両手を体の前で重ねて背筋を伸ばす
        return {
          hipsY: 0,
          bones: {
            leftUpperArm: [-0.25, 0, 1.02],
            rightUpperArm: [-0.25, 0, -1.02],
            leftLowerArm: [-0.95, -0.55, 0],
            rightLowerArm: [-0.95, 0.55, 0],
            leftHand: [0, -0.35, 0],
            rightHand: [0, 0.35, 0],
            spine: [0.015 + breath * 0.012, 0, 0],
            chest: [breath * 0.008, 0, 0],
            head: [0.04, 0, 0.02],
          },
        };
      case 'walk':
        // 腕振りは控えめ、腰を軽く揺らすモデル歩き
        return {
          hipsY: 0,
          bones: {
            hips: [0, swing * 0.07, swing * 0.02],
            leftUpperArm: [-0.22 - swing * 0.1, 0, 1.05],
            rightUpperArm: [-0.22 + swing * 0.1, 0, -1.05],
            leftLowerArm: [-0.85, -0.5, 0],
            rightLowerArm: [-0.85, 0.5, 0],
            leftUpperLeg: [-swing * 0.5, 0, 0],
            rightUpperLeg: [swing * 0.5, 0, 0],
            leftLowerLeg: [-kneeL * 0.5, 0, 0],
            rightLowerLeg: [-kneeR * 0.5, 0, 0],
            spine: [0.02, -swing * 0.05, 0],
            head: [0.03, 0, 0],
          },
        };
      case 'run':
        return {
          hipsY: -0.03,
          bones: {
            leftUpperArm: [-swing * 0.55, 0, 0.45],
            rightUpperArm: [swing * 0.55, 0, -0.45],
            leftLowerArm: [-1.25, -0.2, 0],
            rightLowerArm: [-1.25, 0.2, 0],
            leftUpperLeg: [-swing * 0.85, 0, 0],
            rightUpperLeg: [swing * 0.85, 0, 0],
            leftLowerLeg: [-kneeL * 0.9, 0, 0],
            rightLowerLeg: [-kneeR * 0.9, 0, 0],
            spine: [0.16, 0, 0],
            head: [-0.06, 0, 0],
          },
        };
      case 'crouch': {
        const step = moving ? swing * 0.22 : 0;
        return {
          hipsY: -0.42,
          bones: {
            leftUpperLeg: [1.55 - step, 0, 0],
            rightUpperLeg: [1.55 + step, 0, 0],
            leftLowerLeg: [-1.75, 0, 0],
            rightLowerLeg: [-1.75, 0, 0],
            leftUpperArm: [-0.45, 0, 0.9],
            rightUpperArm: [-0.45, 0, -0.9],
            leftLowerArm: [-0.7, -0.3, 0],
            rightLowerArm: [-0.7, 0.3, 0],
            spine: [0.24, 0, 0],
            head: [-0.12, 0, 0],
          },
        };
      }
      case 'sit':
        // 正座風。手はももの上で重ねる
        return {
          hipsY: -0.55,
          bones: {
            leftUpperLeg: [0.5, 0, 0.05],
            rightUpperLeg: [0.5, 0, -0.05],
            leftLowerLeg: [-2.2, 0, 0],
            rightLowerLeg: [-2.2, 0, 0],
            leftUpperArm: [-0.3, 0, 1.0],
            rightUpperArm: [-0.3, 0, -1.0],
            leftLowerArm: [-1.0, -0.6, 0],
            rightLowerArm: [-1.0, 0.6, 0],
            leftHand: [0, -0.3, 0],
            rightHand: [0, 0.3, 0],
            spine: [0.02 + breath * 0.01, 0, 0],
            head: [0.05, 0, 0],
          },
        };
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
}

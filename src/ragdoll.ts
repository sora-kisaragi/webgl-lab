import * as THREE from 'three';
import type { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';
import type RAPIER_NS from '@dimforge/rapier3d-compat';

type Rapier = typeof RAPIER_NS;

let rapierPromise: Promise<Rapier> | null = null;
function getRapier(): Promise<Rapier> {
  rapierPromise ??= import('@dimforge/rapier3d-compat').then(async (m) => {
    await m.init();
    return m;
  });
  return rapierPromise;
}

interface Part {
  bone: THREE.Object3D;
  body: RAPIER_NS.RigidBody;
  /** body回転 → ボーンworld回転 のオフセット */
  qOffset: THREE.Quaternion;
  /** body局所でのボーン原点位置（hipsの位置書き戻しに使用） */
  pOffset: THREE.Vector3;
}

/** [ボーン, 長さ推定用の先端ボーン(nullは固定長), カプセル半径] */
const SEGMENTS: [VRMHumanBoneName, VRMHumanBoneName | null, number][] = [
  ['hips', 'spine', 0.11],
  ['spine', 'neck', 0.1],
  ['head', null, 0.09],
  ['leftUpperArm', 'leftLowerArm', 0.05],
  ['leftLowerArm', 'leftHand', 0.045],
  ['rightUpperArm', 'rightLowerArm', 0.05],
  ['rightLowerArm', 'rightHand', 0.045],
  ['leftUpperLeg', 'leftLowerLeg', 0.07],
  ['leftLowerLeg', 'leftFoot', 0.055],
  ['rightUpperLeg', 'rightLowerLeg', 0.07],
  ['rightLowerLeg', 'rightFoot', 0.055],
];

/** 球ジョイントで接続するペア。関節位置は子側ボーンの原点 */
const JOINTS: [VRMHumanBoneName, VRMHumanBoneName][] = [
  ['hips', 'spine'],
  ['spine', 'head'],
  ['spine', 'leftUpperArm'],
  ['leftUpperArm', 'leftLowerArm'],
  ['spine', 'rightUpperArm'],
  ['rightUpperArm', 'rightLowerArm'],
  ['hips', 'leftUpperLeg'],
  ['leftUpperLeg', 'leftLowerLeg'],
  ['hips', 'rightUpperLeg'],
  ['rightUpperLeg', 'rightLowerLeg'],
];

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Rapierによる本物のラグドール。
 * 起動時の正規化ボーンのワールド姿勢からカプセル剛体+球ジョイントを組み立て、
 * 毎フレーム剛体の姿勢をボーンへ書き戻す（親から順に処理）。
 */
export class Ragdoll {
  private readonly world: RAPIER_NS.World;
  private readonly vrm: VRM;
  private readonly parts = new Map<VRMHumanBoneName, Part>();

  static async create(vrm: VRM): Promise<Ragdoll> {
    return new Ragdoll(await getRapier(), vrm);
  }

  private constructor(R: Rapier, vrm: VRM) {
    this.vrm = vrm;
    this.world = new R.World({ x: 0, y: -9.81, z: 0 });
    this.world.createCollider(R.ColliderDesc.cuboid(50, 0.1, 50).setTranslation(0, -0.1, 0));

    vrm.scene.updateWorldMatrix(true, true);
    const worldPos = (o: THREE.Object3D) =>
      new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);

    for (const [name, tipName, radius] of SEGMENTS) {
      const bone = vrm.humanoid.getNormalizedBoneNode(name);
      if (!bone) continue;
      const start = worldPos(bone);
      const tip = tipName ? vrm.humanoid.getNormalizedBoneNode(tipName) : null;
      const end = tip ? worldPos(tip) : start.clone().add(new THREE.Vector3(0, 0.18, 0));
      const mid = start.clone().add(end).multiplyScalar(0.5);
      const dir = end.clone().sub(start);
      const len = Math.max(dir.length(), 0.1);
      const q = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());

      const body = this.world.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation(mid.x, mid.y, mid.z)
          .setRotation(q)
          .setLinearDamping(0.5)
          .setAngularDamping(0.9),
      );
      this.world.createCollider(
        R.ColliderDesc.capsule(Math.max(0.02, len / 2 - radius), radius)
          .setDensity(1000)
          .setFriction(0.9),
        body,
      );
      // 崩れ始めがワンパターンにならないよう僅かな初速を与える
      body.setLinvel(
        { x: (Math.random() - 0.5) * 0.5, y: 0, z: (Math.random() - 0.5) * 0.5 },
        true,
      );

      const boneWorldQ = bone.getWorldQuaternion(new THREE.Quaternion());
      const invQ = q.clone().invert();
      this.parts.set(name, {
        bone,
        body,
        qOffset: invQ.clone().multiply(boneWorldQ),
        pOffset: start.clone().sub(mid).applyQuaternion(invQ),
      });
    }

    for (const [a, b] of JOINTS) {
      const pa = this.parts.get(a);
      const pb = this.parts.get(b);
      if (!pa || !pb) continue;
      const anchor = worldPos(pb.bone);
      const toLocal = (p: Part) => {
        const t = p.body.translation();
        const r = p.body.rotation();
        const invQ = new THREE.Quaternion(r.x, r.y, r.z, r.w).invert();
        return anchor
          .clone()
          .sub(new THREE.Vector3(t.x, t.y, t.z))
          .applyQuaternion(invQ);
      };
      this.world.createImpulseJoint(
        R.JointData.spherical(toLocal(pa), toLocal(pb)),
        pa.body,
        pb.body,
        true,
      );
    }
  }

  private readonly tmpQ = new THREE.Quaternion();
  private readonly tmpQ2 = new THREE.Quaternion();

  step(delta: number) {
    this.world.timestep = Math.min(delta, 1 / 30);
    this.world.step();

    this.vrm.scene.updateWorldMatrix(true, true);
    // SEGMENTSは親→子の順に並んでいるので、順に書き戻せば親の変換が子に反映される
    for (const [name] of SEGMENTS) {
      const part = this.parts.get(name);
      if (!part?.bone.parent) continue;
      const r = part.body.rotation();
      const bodyQ = this.tmpQ.set(r.x, r.y, r.z, r.w);
      const worldQ = bodyQ.clone().multiply(part.qOffset);
      const parentQ = part.bone.parent.getWorldQuaternion(this.tmpQ2);
      part.bone.quaternion.copy(parentQ.invert().multiply(worldQ));
      if (name === 'hips') {
        const t = part.body.translation();
        const worldP = new THREE.Vector3(t.x, t.y, t.z).add(
          part.pOffset.clone().applyQuaternion(bodyQ),
        );
        part.bone.position.copy(part.bone.parent.worldToLocal(worldP));
      }
      part.bone.updateWorldMatrix(true, false);
    }
    this.vrm.update(delta);
  }

  dispose() {
    this.world.free();
  }
}

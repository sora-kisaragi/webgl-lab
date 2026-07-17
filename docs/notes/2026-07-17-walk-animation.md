# 歩行アニメーションと移動制御（Issue #2）

- 日付: 2026-07-17
- 目的: VRMを自由に歩かせる。VRMA再生の仕組みと、モーションファイルが無くても動くフォールバックを作る

## やったこと

- `@pixiv/three-vrm-animation` を導入し、VRMA読み込み（`loadVRMA`）と `createVRMAnimationClip` による AnimationMixer 再生経路を実装
- VRMAが無い場合の**プロシージャル歩行**を実装（`src/character.ts`）
  - 正規化ボーン（`humanoid.getNormalizedBoneNode`）を直接回転。脚のsinスイング、逆位相の腕振り、膝の脈動、脊椎の微揺れ
  - `walkWeight` を damp して歩行⇔待機を滑らかに遷移
- 移動制御: WASD/矢印キー + GamePad左スティック（デッドゾーン0.15）。移動方向へ最短角でダンプ回転、カメラは胸元を緩追従
- `.vrma` のドラッグ&ドロップ対応（ファイル名 `idle` 含みは待機、それ以外は歩行）。`public/models/idle.vrma` / `walk.vrma` の自動読み込み
- `?walk` で入力なしでも強制前進するデバッグモード

## 結果・わかったこと

- プロシージャル歩行 + 移動 + カメラ追従はブラウザで動作確認済み（`?walk` とスクリーンショットで検証）
- **正規化ボーンの回転符号**: 腕を下ろすのは `leftUpperArm.rotation.z = +1.15` / `rightUpperArm.rotation.z = -1.15`。最初に逆符号にしたらバンザイになった。VRM1正規化空間の軸の向きは直感と逆になりがちなので、スクリーンショットで即確認するのが速い
- `VRMUtils.rotateVRM0()` をローダーに入れてVRM0/VRM1の向き差を吸収（VRM1は+Z向き）
- mixer.update → vrm.update の順で呼ぶ（コントローラ内に集約した）

## 実VRMAでの再生確認（同日追記）

- [yv-was-taken/desktop-waifu](https://github.com/yv-was-taken/desktop-waifu)（MIT）の `Running.vrma` / `neutral_idle.vrma` を `public/models/walk.vrma` / `idle.vrma` に配置して確認
  - 中身はMixamo由来の変換物と思われるため**ローカル検証用に留める**（gitignore済み、再配布しない）。ちゃんとしたモーションはVRoid Hub公式サンプル（要ログイン）やBOOTHで別途入手する
- idle / walk とも `createVRMAnimationClip` でそのまま再生成功。移動時は走りモーション、停止時は待機モーションに切り替わる
- VRMAはGLB形式だけでなく**glTF JSON形式（バッファはdata URI埋め込み）のこともある**。GLTFLoaderはどちらも読める
- クロスフェードはweight直接操作で成立（両action常時play、walkWeightで配分）

## 次にやること

- [x] 実VRMAファイルでの再生確認
- [ ] 品質の高いモーションの入手（VRoid Hub公式サンプル等）と差し替え
- [ ] Mixamo FBX → VRM リターゲットの検証（自前変換経路の確立）
- [ ] 走り（速度2段階）とジャンプ

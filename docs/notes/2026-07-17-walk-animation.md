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

## 向きの整合性バグ修正（同日追記）

症状: WASDの向きがカメラと無関係（ワールド基準）+ VRMA再生時にモデルが移動方向と真逆を向いて走る。

- **入力のカメラ基準化**: `camera.getWorldDirection` からXZ平面のforward/rightを作り、W=画面奥・D=画面右になるよう入力を変換（`toWorldMove`）
- **逆向き走行の原因**: salome.vrm は **VRM0**。`VRMUtils.rotateVRM0` + 正規化ボーンへのVRMA適用の組み合わせで、モデルの見た目の正面がシーンyawに対してπズレる。VRMAのhips初期回転を見る方法では検出できなかった（hipsのヨーはほぼ0だった）
- **対策**: 推測をやめ、**実際の顔の向きを実測してキャリブレーション**する方式に。両目の中点と頭ボーンの位置関係から顔方向のヨーを求め、シーンyawとの差を 0 / π に丸めて補正値とする（`calibrateFacing`）。モーション読み込みのたびに再計測
- 検証: 奥・右・手前の3方向へ移動させ、移動方向と顔方向の一致を数値で確認（例: move(0,-1) → face(-0.12,-0.99)）

### デバッグの知見

- **タブが非表示だと requestAnimationFrame が完全停止**する。ループが止まった状態のスクリーンショットやコンソール計測は無効なので、`document.visibilityState` を先に確認すること
- `window.lab` にキャラクター/カメラ参照を公開してある。レンダリング無しでも `lab.character.update(0.016, move)` を手動ループで呼べば移動・アニメーション・ボーンのワールド行列まで数値検証できる（今回この方法で確定させた）

## 次にやること

- [x] 実VRMAファイルでの再生確認
- [ ] 品質の高いモーションの入手（VRoid Hub公式サンプル等）と差し替え
- [ ] Mixamo FBX → VRM リターゲットの検証（自前変換経路の確立）
- [ ] 走り（速度2段階）とジャンプ

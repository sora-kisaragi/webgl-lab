# VRMモデル（壱百満天原サロメ）のレンダリング検証

- 日付: 2026-07-17
- 目的: three.js + @pixiv/three-vrm でファンメイドVRMを読み込み、レンダリングできることを確認する

## やったこと

- サロメさんのファンメイド3Dモデルを調査
  - BOOTH: [【無料】壱百満天原サロメの3Dモデル【にじさんじ】](https://booth.pm/ja/items/4751821) — **VRM形式・無料**。改変自由・商用/配信利用可、**再配布・改変データの再配布は禁止**
  - さとり通信式（ニコニ立体）、BowlRoll版などはMMD（.pmx）形式のためVRMビューアでは使えず見送り
  - VRoid Hubのモデルはダウンロード可否をAPI経由で確認できず（403）
- `salome.vrm`（18MB）を `public/models/` に配置し、起動時自動読み込みを実装
- レンダリング成功。MToonマテリアル（ドレスの質感、髪、表情まわり）も問題なく表示

## 結果・わかったこと

- `@pixiv/three-vrm` 3.5.5 + three 0.185 の組み合わせで VRM の読み込み・描画は素直に動く
- **Vite devサーバーは `.vrm` に空の Content-Type を返す**。
  「octet-stream かどうか」でデフォルトモデルの存在判定をすると常に失敗する。
  未配置時はSPAフォールバックで `index.html`（text/html）が返るので、
  「text/html なら未配置」と判定するのが正しい
- モデルは再配布禁止ライセンスのため `models/` を gitignore し、リポジトリには含めない

## 次にやること

- [ ] シェーダー実験: MToonマテリアルの改変（onBeforeCompile / MToonMaterial拡張）
- [ ] VRMの表情（expressionManager）・ルックアット・ボーン操作
- [ ] GamePadの振動（vibrationActuator）と複数パッド

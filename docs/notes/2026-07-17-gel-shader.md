# ゲル状シェーダー（ゲルバナ風）（Issue #1）

- 日付: 2026-07-17
- 目的: シュタインズ・ゲートのゲルバナのように、モデルをゲル状（半透明・ぷるぷる）にする

## やったこと

- `src/shaders/gel.vert / gel.frag` + `src/gel.ts`（GelMode）を実装。**Gキーでゲル化トグル**
- 頂点: 周波数の異なる2つのsin波を法線方向に重ねてぷるぷる揺らす
- フラグメント: ラップライティング（擬似SSS）+ フレネル（縁の厚み感）+ スペキュラ + 縁ほど不透明になるアルファ
- マテリアル差し替え方式: 元マテリアルをMapに保持し、解除時に復元。モデル差し替え時も復元してから破棄

## 結果・わかったこと

- **ShaderMaterialでスキニングを効かせるには** threeのシェーダーチャンクを組み込む: `#include <skinning_pars_vertex>` + `skinbase/skinnormal/skinning_vertex`。SkinnedMeshに対しては `USE_SKINNING` が自動で定義されるので、material側のフラグは不要（近年のthreeで挙動変更あり）
- チャンクの順序に注意: `beginnormal_vertex` → `skinnormal_vertex` → `begin_vertex` → `skinning_vertex` の順でないと `objectNormal` / `transformed` が未定義になる
- VRM（MToonマテリアル）でもメッシュ単位でマテリアルを差し替えるだけでゲル化できる。ロコモーションのポーズ・アニメーションもそのまま動く
- タブ非表示でrAFが止まっていても、`lab.render()`（手動1フレーム描画）+スクリーンショットで見た目の検証ができる

## 次にやること

- [ ] 揺れをロコモーションと連動（移動・停止の勢いでwobble振幅を変える＝慣性ぷるぷる）
- [ ] depth/normalテクスチャを使った本格的な厚み・屈折表現
- [ ] MToonの `onBeforeCompile` 改変版（元の質感を残したままゲル化）
- [ ] uColor をUIから変えられるようにする（ゲルバナ黄以外も）

# ADR-0001: 技術スタックの選定

- 日付: 2026-07-17
- ステータス: 採用

## 背景

VRM / OBJ を読み込んでレンダリングし、シェーダー実験や GamePad などの WebGL/ブラウザ API の検証を素早く回すための実験用リポジトリを作る。速度優先で、設計の厳密さより試行回数を重視する。

## 決定

- **three.js + @pixiv/three-vrm** を土台にする
  - VRM/GLTF/OBJ のローダーが揃っており、ゼロから WebGL を書くよりも圧倒的に早く動くものが作れる
  - シェーダー実験は `ShaderMaterial` / `RawShaderMaterial` / `onBeforeCompile` で生 GLSL を書けるため、抽象化されていても支障がない
- **Vite + TypeScript (vanilla-ts)** をビルド基盤にする
  - HMR が速く、`?raw` インポートで GLSL ファイルをそのまま読み込める
- パッケージマネージャは **pnpm**

## 検討した代替案

- **生 WebGL2**: 学習価値は高いが VRM の読み込み（GLTF拡張 + スキニング + マテリアル）を自前実装することになり、速度優先の目的に合わない。低レベル実験がしたくなったら別ディレクトリ/別ページで併設する
- **Babylon.js**: ゲーム向け機能は充実しているが、VRM 対応がコミュニティ頼みで弱い

## 影響

- three.js のバージョンと @pixiv/three-vrm の互換性に注意が必要（three-vrm の peer range に従って更新する）

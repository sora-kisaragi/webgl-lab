# webgl-lab

WebGL の実験場。VRM / OBJ を読み込んでレンダリングし、シェーダーや GamePad などブラウザのゲーム向け API を検証する。

## セットアップ

```bash
pnpm install
pnpm dev
```

ブラウザで開いて `.vrm` / `.obj` ファイルをドラッグ&ドロップすると表示される。**WASD/矢印キー、またはGamePadの左スティックでキャラクターが歩く**（VRMAモーションが無い場合はプロシージャル歩行で代用）。`.vrma` をドロップするとモーションを差し替えられる（ファイル名に `idle` を含むと待機、それ以外は歩行として扱う）。`?walk` を付けると強制前進するデバッグモード。

`public/models/salome.vrm` にVRMを置くと起動時に自動で読み込まれる（`?model=/models/foo.vrm` で切り替え可）。`public/models/idle.vrma` / `walk.vrma` があればモーションも自動で読み込む。`models/` は再配布禁止のモデルを扱うため gitignore 済み。

## スクリプト

| コマンド      | 内容                         |
| ------------- | ---------------------------- |
| `pnpm dev`    | 開発サーバー起動（HMR）      |
| `pnpm build`  | 型チェック + 本番ビルド      |
| `pnpm lint`   | ESLint                       |
| `pnpm format` | Prettier で整形              |
| `pnpm check`  | lint + format チェック + tsc |

## 構成

- `src/main.ts` — シーン構築・入力・描画ループ
- `src/loaders.ts` — VRM / OBJ / VRMA ローダー
- `src/character.ts` — 移動と歩行アニメーション（VRMA / プロシージャル）
- `src/gamepad.ts` — GamePad API のポーリング
- `src/shaders/` — GLSL（Vite の `?raw` インポートで読み込む）
- `docs/adr/` — 設計判断の記録（ADR）
- `docs/notes/` — 調査・検証ノート

## ロードマップ

やりたいことは [Issues](https://github.com/sora-kisaragi/webgl-lab/issues) と [Wiki の Roadmap](https://github.com/sora-kisaragi/webgl-lab/wiki/Roadmap) を参照。

## スタック

three.js + @pixiv/three-vrm / Vite + TypeScript / ESLint + Prettier（詳細は [ADR-0001](docs/adr/0001-tech-stack.md)）

# webgl-lab

WebGL の実験場。VRM / OBJ を読み込んでレンダリングし、シェーダーや GamePad などブラウザのゲーム向け API を検証する。

## セットアップ

```bash
pnpm install
pnpm dev
```

ブラウザで開いて `.vrm` / `.obj` ファイルをドラッグ&ドロップすると表示される。GamePad はボタンを押すと認識され、左スティックでモデルが回転する。

`public/models/salome.vrm` にVRMを置くと起動時に自動で読み込まれる（`?model=/models/foo.vrm` で切り替え可）。`models/` は再配布禁止のモデルを扱うため gitignore 済み。

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
- `src/loaders.ts` — VRM / OBJ ローダー
- `src/gamepad.ts` — GamePad API のポーリング
- `src/shaders/` — GLSL（Vite の `?raw` インポートで読み込む）
- `docs/adr/` — 設計判断の記録（ADR）
- `docs/notes/` — 調査・検証ノート

## スタック

three.js + @pixiv/three-vrm / Vite + TypeScript / ESLint + Prettier（詳細は [ADR-0001](docs/adr/0001-tech-stack.md)）

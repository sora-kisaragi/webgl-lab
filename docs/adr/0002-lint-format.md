# ADR-0002: Linter / Formatter の選定

- 日付: 2026-07-17
- ステータス: 採用

## 背景

実験リポジトリだが、コードスタイルの揺れで差分が汚れるのを避けたい。

## 決定

- **ESLint (flat config) + typescript-eslint** で lint
- **Prettier** で format（`eslint-config-prettier` で競合ルールを無効化）
- `pnpm check` で lint + format チェック + `tsc --noEmit` を一括実行

## 検討した代替案

- **Biome**: 高速で設定も1ファイルだが、慣れている定番構成（ESLint + Prettier）を優先した

## 影響

- GLSL ファイル（`.vert` / `.frag`）は対象外。必要になったら glsl 向けツールを別途検討する

# webgl-lab — AIエージェント向け作業ルール

## このリポジトリについて

WebGL 実験用のリポジトリ。速度優先で、設計より試行回数を重視する。詳細は `README.md` と `docs/adr/` を参照。

## ルール

- 変更後は `pnpm check`（lint + format + tsc）を通すこと
- 設計上の判断をしたら `docs/adr/` に短い ADR を追加する（番号は連番）
- 調査・検証の結果は `docs/notes/YYYY-MM-DD-テーマ.md` に残す
- ブランチは main 直コミットでよい。PR は不要
- コミットメッセージに AI の帰属表記（Co-Authored-By 等）は付けない
- three.js を更新するときは @pixiv/three-vrm との互換性を確認する

## よく使うコマンド

```bash
pnpm dev      # 開発サーバー
pnpm check    # lint + format チェック + 型チェック
pnpm build    # 本番ビルド
```

# エイリアンキックバスター

スマホで遊べる、リズムアクション風のPKボレーゲームです。飛んでくるボールがキックリングに重なった瞬間にタップすると、ハードヒットが決まってゴール率と威力が上がります。描画は Phaser 3 を使っています。

## ゲーム内容

- エイリアンがGK、プレイヤーがキッカー
- 次々に飛んでくるボールをタイミングよくボレーシュート
- BPM 118の拍に合わせて、8拍ごとに変わるリズムパターンでボールをフィード
- 良いタイミングほどゴールしやすく、コンボが伸びる
- コンボ中のナイスキックでエイリアンにダメージ
- HPを削るとエイリアンがダウンし、次のエイリアンが登場
- 90秒以内に100点以上で勝利

## キャラクター実装

- `CharacterAnimator`: 状態遷移の共通ベース
- `KickerAnimator`: キッカーの `idle / aim / charge / kick / followThrough / goalReact / missReact` を描画
- `AlienVisualFactory`: Slime / Mantis / Psychic のGKビジュアルを生成

GKはシルエット、色、待機ループ、セーブモーション、接触エフェクト、勝敗表情がそれぞれ異なります。HUDには敵名と短い能力タグを表示します。

## リズム実装

一定秒ごとのスポーンではなく、ボールごとに「譜面上の到達拍」を持たせています。`FOUR KICK`、`SYNCOPATE`、`DOUBLE TAP`、`BREAK BEAT` の4パターンが8拍ごとに切り替わり、ボールはキックリングへ到達する時刻から逆算してフィードされます。

## ローカル起動

依存パッケージは不要です。

```powershell
npm run dev
```

ブラウザで `http://localhost:4173` を開いてください。

## チェック

```powershell
npm run check
```

## デプロイ

静的サイトなので GitHub Pages、Netlify、Vercel などにそのままデプロイできます。GitHub Pages は `.github/workflows/deploy.yml` により `main` ブランチへの push で公開されます。

# BW コミュニティ画像ジェネレーター（プロトタイプ）

動画をアップロード → フレームをサムネイルから選択 → スライドに割り当てて
1080×1080のYouTubeコミュニティ投稿用画像を生成するWebアプリです。

## 必要なもの
- Python 3.9以上
- ffmpeg（動画からフレームを抽出するために使用）
  - Mac: `brew install ffmpeg`
  - Windows: https://ffmpeg.org/download.html からインストールし、PATHを通す
- 日本語フォント：Noto Sans CJK Bold相当のフォントが必要です。
  - `imgspec.py` 内 `FONT_BOLD` のパスを、お使いの環境にあるフォントファイルに書き換えてください。
  - Mac例：`/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc`
  - Windows例：`C:/Windows/Fonts/meiryob.ttc`

## セットアップ

```bash
cd bw_app
python -m venv venv
source venv/bin/activate   # Windowsは venv\Scripts\activate
pip install -r requirements.txt
```

## 起動

```bash
python app.py
```

ブラウザで http://localhost:5000 を開く。

## 使い方
1. 「動画をアップロード」で動画ファイルを選択し、フレームレートを選んでアップロード
2. 抽出されたフレーム一覧から、使いたいカットをクリックして選択（枠が青くなる）
3. スライドの「①にセット」「②にセット」ボタンで、選択中のフレームをそのスライドの上段／下段に割り当てる
4. 1枚目は「タイトル帯をつける」にチェックすると、キッカー・見出し（**単語**で赤強調）を入力できる
5. 「＋スライド追加」で2枚目以降を追加（最大の目安は5枚＝YouTubeコミュニティ投稿の上限）
6. 「この内容で生成する」を押すと1080×1080の画像が生成され、ダウンロードできる

## 仕様（フォーマット）
`imgspec.py` に、これまでのやり取りで固めたフォーマットをそのまま実装しています。
- 1080×1080の正方形
- 1枚目のみ黒帯タイトル（キッカー＋見出し、**強調**は赤文字）
- 各カットは下端（字幕）を必ず残し、上端を最低200pxトリミングしてエッジまで拡大（レターボックスなし）
- 2カットの間・外周に黒の区切り線／枠線

見た目の細かい調整（色・フォントサイズ・トリミング量など）は `imgspec.py` の定数を変更すれば反映されます。

## Web版にする（ターミナル操作なし・Render.comの無料プラン）

これをやると、URLを開くだけで誰でも使えるようになります（パソコンでのpython/ffmpegインストール不要）。
ブラウザの操作だけで完結します。

### 1. GitHubにコードを置く
1. https://github.com にアクセスしてアカウントを作る（未登録の場合）
2. 右上の「+」→「New repository」→ 名前を決めて（例：`bw-community-app`）Public のまま「Create repository」
3. 作成後の画面にある「uploading an existing file」というリンクをクリック
4. 展開した `bw_app` フォルダの中身（`app.py`, `imgspec.py`, `Dockerfile`, `requirements.txt`, `static`フォルダ, `templates`フォルダ など全部）をまとめてドラッグ&ドロップ
5. 下の「Commit changes」ボタンを押す

### 2. Renderにデプロイする
1. https://render.com にアクセスし、「GitHubでサインアップ」を選ぶ（手順1のアカウントで連携される）
2. ダッシュボードで「New +」→「Web Service」
3. 手順1で作ったリポジトリ（`bw-community-app`）を選択して「Connect」
4. 設定画面が出たら：
   - Environment（Runtime）: `Docker` を選択（Dockerfileが自動検出されるはず）
   - Instance Type: `Free` を選択
5. 「Create Web Service」を押す
6. 数分待つとビルドが完了し、`https://bw-community-app-xxxx.onrender.com` のようなURLが発行される
7. そのURLを開けば、あなただけでなく他の人もそのままアクセスして使えます

### 注意点（無料プランの制約）
- 無料プランは一定時間アクセスがないとスリープし、次のアクセス時に起動まで30〜50秒ほどかかります（エラーではありません、少し待てば表示されます）
- 動画が大きい・長いとアップロードや処理に時間がかかります。まずは短めの動画（〜1分程度）で試すのがおすすめです
- ビルドが失敗した場合はRenderの「Logs」画面にエラーが出るので、その内容を共有してもらえればこちらで原因を確認します
- ※このDockerfileはこちらでは実機テストできていません（サンドボックス環境にDockerが無いため）。初回デプロイでエラーが出た場合はログを見ながら一緒に直しましょう

## 今後の展開
- 複数人が同時に使う場合の負荷や、アップロードした動画を誰でも見られてしまう点（今は簡易的な仕組み）への対応
- 大きい動画のアップロード時間・ffmpeg処理時間に対するタイムアウト対策の強化
- 社内サーバーやAWSなど、Render以外の環境に置きたい場合はそちらに合わせて構成し直せます

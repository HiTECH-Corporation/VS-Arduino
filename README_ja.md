<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/HiTECH-Corporation/VS-Arduino@latest/media/icons/logo.png" alt="VS Arduino Logo" width="128" />
</p>

<h1 align="center">VS Arduino</h1>

<p align="center">
  <img src="https://img.shields.io/badge/VS%20Code-%5E1.80.0-blue" alt="VS Code" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License: MIT" />
  <img src="https://img.shields.io/badge/Platform-Arduino-00979D?logo=arduino" alt="Arduino" />
  <img src="https://img.shields.io/badge/Assisted%20by-Claude%20Code-D97757?logo=claudecode" alt="Claude Code" />
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=HiTECH-Corporation.vs-arduino"><img src="https://img.shields.io/badge/Install%20from-VS%20Marketplace-blue" alt="Install from Visual Studio Marketplace" /></a>
  <a href="https://open-vsx.org/extension/HiTECH-Corporation/vs-arduino"><img src="https://img.shields.io/badge/Install%20from-Open%20VSX-purple" alt="Install from Open VSX" /></a>
</p>

---

<p align="center">
  <a href="README.md"><b>English</b></a> |
  <a href="README_vi.md"><b>Tiếng Việt</b></a> |
  <b>日本語</b> |
  <a href="README_zh.md"><b>中文</b></a>
</p>

<p align="center">
  Visual Studio Code 内で完結する Arduino 開発環境 — エディタを離れることなく、ビルド・書き込み・モニタリング・プロット・デバッグができます。
</p>

<p align="center">
  © 2026 HiTECH Corporation. All rights reserved.
</p>

---

## 機能

### ビルド & 書き込み
- エディタのツールバーからワンクリックで **Compile/Verify** と **Upload** を実行。バックエンドは `arduino-cli` です。
- ビルドと書き込みのログは `Output > VS Arduino` チャンネルにリアルタイムで表示されます。
- 開いているスケッチを自動認識 — 任意の `.ino` ファイルを右クリックして直接コンパイル・書き込みできます。

### シリアルモニター
- 下部の**パネル**表示と**エディタタブ**表示の両方に対応。
- 行ごとの**タイムスタンプ**、**改行コード**と**ボーレート**の設定が可能。
- 双方向通信:モニターから離れずにボードへコマンドを送信できます。

### シリアルプロッター
- 5 種類のチャート:**Waveform**、**Multi-line**、**Sensor**、**Digital Pulse**、**Bit Stream**。
- **ズーム**、**パン**、ホバーによる**データポイントの詳細表示**に対応。
- ワンクリックで **CSV エクスポート**し、オフラインで分析できます。

### ハードウェアデバッグ
- **Cortex-Debug** エンジンを拡張機能に内蔵 — 追加の拡張機能は不要です。
- *Debug Sketch* を押すだけで、VS Arduino がツールチェーン・GDB サーバー・SVD ファイルを自動解決し、スケッチの `setup()` 関数で正確に停止します。
- 充実したデバッグツール:**Peripherals (SVD)**、**Registers**、**Memory**、**Disassembly**、**RTOS** ビュー。

### ボード & ライブラリマネージャー
- モダンな UI でプラットフォームとライブラリを検索・インストール・更新・ダウングレード・アンインストール。
- バージョン単位の選択で依存関係を正確にコントロールできます。

### 自動 IntelliSense
- `#include` の構成が変わるたびに C/C++ 設定を自動生成・更新するため、コード補完は常に選択中のボードと一致します。

### コントロールパネル
- アクティビティバー専用ビューから **Board**、**Port**、**Programmer** を選択。
- すべての選択はセッションをまたいで保持されます。

## インストール

いずれかのストアからインストールできます:

- **[Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=HiTECH-Corporation.vs-arduino)** — 拡張機能ビュー(`Ctrl+Shift+X`)で `VS Arduino` を検索。
- **[Open VSX Registry](https://open-vsx.org/extension/HiTECH-Corporation/vs-arduino)** — VSCodium などの互換エディタ向け。
- **手動インストール** — `.vsix` ファイルをダウンロードして `code --install-extension vs-arduino-<version>.vsix` を実行。

> `arduino-cli` は拡張機能が自動でダウンロード・管理します。独自のバイナリを使いたい場合は設定でパスを指定できます。

## はじめかた

1. スケッチ(`.ino`)を含むフォルダーを開きます。
2. アクティビティバーの **VS Arduino** アイコンをクリックします。
3. 新しいボードファミリーを初めて使う場合は、**Board Manager** で対応プラットフォーム(例:*Arduino AVR Boards*)をインストールします。
4. コントロールパネルで **Board**、**Port**、必要に応じて **Programmer** を選択します。
5. **Compile/Verify**(✓)でビルド、**Upload**(→)でスケッチを書き込みます。
6. コマンドパレットから **Serial Monitor** または **Serial Plotter** を開き、ライブデータを確認します。
7. **VS Arduino: Debug Sketch** を実行してハードウェアデバッグを開始 — `setup()` で停止し、ステップ実行の準備が整います。

## 動作要件

| 項目 | 要件 |
| --- | --- |
| Visual Studio Code | `^1.80.0` |
| オペレーティングシステム | Windows、macOS、Linux |
| ボード | ビルド/書き込み/モニターは Arduino 互換ボードであれば可 |
| ハードウェアデバッグ | ARM Cortex-M 搭載ボードとデバッグプローブ(ST-Link、J-Link、オンボード CMSIS-DAP) |

## 拡張機能の設定

| 設定 | 説明 | 既定値 |
| --- | --- | --- |
| `vs-arduino.arduinoCliPath` | `arduino-cli` 実行ファイルのパス | `""` |
| `vs-arduino.board` | 選択中の Arduino ボードの FQBN | `""` |
| `vs-arduino.boardName` | 選択中のボードの表示名 | `""` |
| `vs-arduino.port` | 選択中のシリアルポート | `""` |
| `vs-arduino.programmer` | 選択中のプログラマー ID | `""` |
| `vs-arduino.programmerName` | 選択中のプログラマーの表示名 | `""` |
| `vs-arduino.sketchbookPath` | カスタムライブラリの検索に使う Arduino スケッチブックのパス | `""` |
| `vs-arduino.arduinoDataDir` | ライブラリとスケッチ用のカスタム Arduino ユーザーディレクトリ | `""` |
| `vs-arduino.baudRate` | Serial Monitor / Plotter の既定ボーレート | `"115200"` |

高度なデバッグ設定(ツールチェーンパス、GDB サーバー、レジスタ表示形式、RTOS パネル)は **Cortex-Debug** 設定セクションで調整できます。

## コマンド & キーバインド

| コマンド | 動作 |
| --- | --- |
| `VS Arduino: Select Board` | 対象ボード(FQBN)を選択 |
| `VS Arduino: Select Port` | シリアルポートを選択 |
| `VS Arduino: Select Programmer` | 書き込み/デバッグ用プログラマーを選択 |
| `VS Arduino: Compile/Verify` | 現在のスケッチをビルド |
| `VS Arduino: Upload` | 現在のスケッチをビルドして書き込み |
| `VS Arduino: Compile/Verify Sketch` | コンテキストメニューからスケッチをビルド |
| `VS Arduino: Upload Sketch` | コンテキストメニューからスケッチを書き込み |
| `VS Arduino: Open Serial Monitor` | シリアルモニターを開く |
| `VS Arduino: Open Serial Plotter` | シリアルプロッターを開く |
| `VS Arduino: Debug Sketch` | ハードウェアデバッグセッションを開始 |
| `Open VS Arduino` | アクティビティバーの VS Arduino ビューを開く |

| キーバインド | 動作 |
| --- | --- |
| `Ctrl+Shift+X`(デバッグセッション中) | Variables ウィンドウの 16 進表示を切り替え |

その他のデバッグコマンド(メモリビューアー、逆アセンブリ、ペリフェラル更新、RTOS パネル)はデバッグセッション中のコンテキストメニューに表示されます。

## FAQ & トラブルシューティング

**ボードのポートが表示されません。**
USB ケーブルがデータ通信対応(充電専用ではない)であること、ボードの USB ドライバーがインストール済みであることを確認してください。接続後に `VS Arduino: Select Port` を再実行してください。

**「platform not installed」エラーでコンパイルに失敗します。**
**Board Manager** を開き、お使いのボードに対応するプラットフォーム(例:*esp32*、*Arduino AVR Boards*)をインストールしてから再度コンパイルしてください。

**書き込みは成功するのにシリアルモニターに文字化けが表示されます。**
モニターのボーレートがスケッチの `Serial.begin()` に渡した値と一致しているか確認してください。

**デバッガーが接続できません。**
ハードウェアデバッグには ARM Cortex-M ボードとデバッグプローブが必要です。プローブの接続、ドライバーのインストール、コントロールパネルで正しいプログラマーが選択されているかを確認してください。

**IntelliSense が `#include <Arduino.h>` を見つけられません。**
設定はボード選択の数秒後に自動で再生成されます。警告が消えない場合は一度コンパイルすると、ツールチェーンのパスが解決されます。

## コントリビューション

コントリビューションを歓迎します!開発環境のセットアップ、コーディング規約、プルリクエストの手順は [Contributing Guide](CONTRIBUTING.md) をご覧ください。

## バグ報告 & フィードバック

バグを見つけた、またはアイデアがある場合は、**Bug Report** または **Feature Request** テンプレートを使って [issue を作成](https://github.com/HiTECH-Corporation/VS-Arduino/issues)してください。バグ報告の際は、拡張機能のバージョン、VS Code のバージョン、OS、使用ボードを記載してください。

## ライセンス & クレジット

MIT ライセンスの下で配布されています。詳細は [LICENSE](LICENSE) をご覧ください。
サードパーティの帰属表示は [ThirdPartyNotices.txt](ThirdPartyNotices.txt) に記載されています。

VS Arduino は優れたオープンソースプロジェクトの上に成り立っています:

- [cortex-debug](https://github.com/Marus/cortex-debug) — Marcel Ball (marus25) 作。組み込みデバッグエンジン。
- [vscode-arduino-intellisense](https://github.com/svnty/vscode-arduino-intellisense) — svnty 作。IntelliSense 統合のコンセプト。
- [arduino-cli](https://github.com/arduino/arduino-cli) — Arduino 作。ビルド・書き込み・ライブラリ管理の基盤。

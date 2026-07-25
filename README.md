# ⚓ 船舶操船與穩度模擬器 (Ship Handling & Stability Simulator)

一個純前端（HTML / CSS / JavaScript，無需安裝套件或建置工具）的船舶操船模擬網頁應用。
模擬船舶在不同海象下的操縱運動與穩定度變化，並提供多種傳統航海儀表顯示。

## 功能特色

### 🌊 海象模擬
- 蒲福風級 (Beaufort Scale) 0–12 滑桿選擇
- 依風級自動換算風速、浪高、對船體運動的擾動強度
- 可調整風向 / 浪向角度，觀察船舶相對浪向的運動反應（迎浪、隨浪、橫浪）

### ⚖️ 船舶穩定度 (Stability)
- 裝載狀態選擇：壓艙 (Light Ballast)、一般裝載 (Normal)、滿載 (Full Load)、重貨高置 (Top-Heavy)
- 各裝載狀態對應不同 GM (Metacentric Height，穩度高)
- 即時計算橫搖自然週期，GM 越小週期越長、船舶越易產生大幅橫搖
- 穩度不足（GM 過小 / 負值）時觸發警示
- 可設定初始傾側角度，觀察船舶回正過程

### 🕹️ 操船模擬
- 舵角控制（-35°～+35°，含 Hard Port / Midship / Hard Starboard 快捷鍵）
- 九檔主機電報（Full/Half/Slow/Dead Slow Ahead、STOP、Dead Slow/Slow/Half/Full Astern）
- 採用 Nomoto 一階操縱運動模型計算迴轉率與艏向變化
- 速度模型：主機推力遲滯反應、轉舵與海象造成的阻力增加
- 下錨、暫停、時間加速功能

### 📊 儀表板（Canvas 繪製指針式儀表）
| 儀表 | 說明 |
|---|---|
| 羅經 Compass | 顯示船艏真航向 |
| 船速儀 Speed Log | 顯示對水船速 (節) |
| 舵角指示器 Rudder Angle Indicator | 顯示目前舵角 |
| 迴轉率指示器 Rate of Turn | 顯示每分鐘迴轉角度 (°/min) |
| 傾側儀 Inclinometer | 顯示即時橫傾角度 |
| 主機轉速表 Engine RPM | 顯示主機轉速 |
| 風速風向儀 Wind Gauge | 顯示相對風向與風速 |
| 測深儀 Echo Sounder | 顯示水深模擬數值 |

### 🗺️ 視覺化場景
- 俯視航跡圖：顯示船舶航跡、波浪紋理（依海況強弱）、風向箭頭
- 船艏正視圖：顯示即時橫傾角度與水線變化

## 專案結構
```
ship-simulator/
├── index.html      # 頁面版面與所有 UI 元件
├── style.css       # 深色駕駛台風格樣式
├── physics.js      # 模擬核心：操縱運動、速度、橫搖/縱搖、穩度計算
├── gauges.js       # Canvas 指針式儀表繪製
├── render.js       # 航跡圖與橫傾正視圖渲染
└── main.js         # 事件綁定與主模擬迴圈
```

## 使用方式
純靜態網頁，無需安裝任何套件，兩種方式皆可：

1. 直接用瀏覽器開啟 `index.html`
2. 或啟動簡易本地伺服器（避免部分瀏覽器的 CORS 限制）：
   ```bash
   cd ship-simulator
   python3 -m http.server 8080
   # 瀏覽器開啟 http://localhost:8080
   ```

## 技術說明
- 純原生 JavaScript + HTML5 Canvas 2D，無第三方框架或建置工具
- 操縱模型：Nomoto 一階方程 `T·ṙ + r = K·δ`
- 橫搖模型：阻尼強迫振盪，自然頻率 `ωn ∝ √(GM / 慣性)`，依浪向與海況產生激振力
- 所有物理參數皆為簡化教學/展示用途，非精確船舶工程計算

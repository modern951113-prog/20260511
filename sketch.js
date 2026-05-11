// 用來儲存攝影機影像的變數
let capture;
// 用來儲存臉部辨識模型的變數
let faceapi;
// 用來儲存手勢辨識模型的變數
let handpose;
// 用來儲存耳環圖片的陣列
let earringImages = [];
// 用來儲存面具圖片的陣列
let maskImages = [];
// 用來儲存目前要顯示的耳環索引 (-1 代表不顯示)
let currentEarringIndex = -1;
// 用來儲存目前要顯示的面具索引
let currentMaskIndex = 0;
// 用來儲存辨識結果的變數
let faceDetections = [];
let handDetections = [];
// 用來偵測手部揮動的變數
let lastHandSide = null;

// ml5.js 的臉部辨識模型選項
const faceOptions = {
  withLandmarks: true, // 取得臉部特徵點
  withDescriptors: false, // 我們不需要臉部描述
};

function preload() {
  // 預先載入所有耳環圖片
  earringImages[0] = loadImage('pic/acc1_ring.png');
  earringImages[1] = loadImage('pic/acc2_pearl.png');
  earringImages[2] = loadImage('pic/acc3_tassel.png');
  earringImages[3] = loadImage('pic/acc4_jade.png');
  earringImages[4] = loadImage('pic/acc5_phoenix.png');

  // 預先載入所有面具圖片
  maskImages[0] = loadImage('pic/4379901.png');
  maskImages[1] = loadImage('pic/4379902.png');
  maskImages[2] = loadImage('pic/mask3_gold.png');
  maskImages[3] = loadImage('pic/mask4_white.png');
  maskImages[4] = loadImage('pic/mask1_red.png');
  maskImages[5] = loadImage('pic/mask2_blue.png');
}

function setup() {
  // 建立一個填滿整個瀏覽器視窗的畫布
  createCanvas(windowWidth, windowHeight);

  // 啟動攝影機並擷取影像
  capture = createCapture(VIDEO);
  // 隱藏預設產生的 HTML video 元素，因為我們將在畫布上自行繪製
  capture.hide();

  // 將影像繪製的模式設定為中心點對齊
  // 這樣 image() 的 x, y 參數會是影像的中心點，而不是左上角
  imageMode(CENTER);

  // 初始化 ml5.js 的 face-api 模型
  faceapi = ml5.faceApi(capture, faceOptions, faceModelReady);

  // 初始化 ml5.js 的 handpose 模型
  handpose = ml5.handpose(capture, handModelReady);
}

// 當臉部辨識模型成功載入時會被呼叫的函式
function faceModelReady() {
  console.log('臉部辨識模型載入完成！');
  // 開始進行臉部偵測
  faceapi.detect(gotFaceResults);
}

// 當手勢辨識模型成功載入時會被呼叫的函式
function handModelReady() {
  console.log('手勢辨識模型載入完成！');
  // 監聽 'predict' 事件來持續取得手勢資料
  handpose.on('predict', gotHandResults);
}

// 當偵測到臉部結果時會被呼叫的函式
function gotFaceResults(err, result) {
  if (err) {
    console.error(err);
    return;
  }
  // 將偵測結果存到全域變數中
  faceDetections = result;

  // 再次呼叫 detect，形成一個連續偵測的迴圈
  faceapi.detect(gotFaceResults);
}

// 當偵測到手勢結果時會被呼叫的函式
function gotHandResults(results) {
  handDetections = results;
}

// 偵測手部揮動的函式
function detectWave() {
  // 檢查是否有偵測到任何手
  if (handDetections.length > 0) {
    // 使用手腕 (landmarks[0]) 作為手的位置參考
    const wrist = handDetections[0].landmarks[0];
    const centerX = capture.width / 2;
    // 判斷手在畫面的左邊還是右邊
    const currentHandSide = wrist[0] < centerX ? 'left' : 'right';

    // 如果手從一邊移動到另一邊，就當作一次揮動
    // 這裡的 lastHandSide !== currentHandSide 是關鍵，
    // 它確保只有在手跨越中心線時才觸發一次。
    if (lastHandSide && lastHandSide !== currentHandSide) {
      // 切換到下一個面具，如果到最後一個就循環回第一個
      currentMaskIndex = (currentMaskIndex + 1) % maskImages.length;
      // 將 lastHandSide 設為 null，這樣手需要再次從一側進入才會被記錄，
      // 避免在中心點附近快速來回移動時重複觸發。
      lastHandSide = null;
    }
    // 如果 lastHandSide 是 null，表示這是一個新的揮手動作的開始
    else if (lastHandSide === null) {
      lastHandSide = currentHandSide;
    }
  } else {
    // 如果沒偵測到手，就重置狀態
    lastHandSide = null;
  }
}

// 計算伸出的手指數量
function countFingers() {
  let fingerCount = 0;
  if (handDetections.length > 0) {
    // 取得第一隻偵測到的手的標記點
    const landmarks = handDetections[0].landmarks;
    const tipIds = [4, 8, 12, 16, 20]; // 指尖的索引
    const dipIds = [3, 7, 11, 15, 19]; // 指尖下面一個關節的索引

    // 檢查四隻手指 (食指到小指) 是否伸直 (指尖 y 座標小於關節 y 座標)
    for (let i = 1; i < 5; i++) {
      if (landmarks[tipIds[i]][1] < landmarks[dipIds[i]][1]) {
        fingerCount++;
      }
    }
    // 檢查大拇指是否伸直 (指尖 x 座標大於關節 x 座標，因為影像是左右顛倒的)
    if (landmarks[tipIds[0]][0] > landmarks[dipIds[0]][0]) {
      fingerCount++;
    }
  }
  return fingerCount;
}

function draw() {
  // 設定畫布的背景顏色
  background('#e7c6ff');

  // 計算影像要顯示的寬度和高度 (視窗的 50%)
  let videoWidth = windowWidth * 0.5;
  let videoHeight = windowHeight * 0.5;

  // --- 繪製左右顛倒的影像 ---

  // push() 會儲存當前的繪圖設定 (例如座標系統的原點、顏色等)
  push();

  // 將座標系統的原點 (0, 0) 移動到畫布的中心
  translate(windowWidth / 2, windowHeight / 2);

  // 將 X 軸反轉 (-1)，Y 軸不變 (1)。這會讓接下來繪製的所有東西都左右顛倒
  scale(-1, 1);

  // 在新的座標系統 (中心、已反轉) 的原點 (0, 0) 繪製影像
  // 因為我們已經用了 translate 和 imageMode(CENTER)，影像會被精準地放在畫布正中央
  image(capture, 0, 0, videoWidth, videoHeight);

  // 偵測手部揮動來切換面具
  detectWave();

  // 根據手勢更新要顯示的耳環
  const fingerCount = countFingers();
  if (fingerCount > 0 && fingerCount <= 5) {
    // 陣列索引是 0 到 4，所以要減 1
    currentEarringIndex = fingerCount - 1;
  } else {
    // 如果不是 1-5 的手勢，就不顯示耳環
    currentEarringIndex = -1;
  }

  // 在耳垂上繪製耳環
  drawEarrings(videoWidth, videoHeight);

  // 在臉上繪製面具
  drawMask(videoWidth, videoHeight);

  // pop() 會還原到 push() 之前的繪圖設定
  // 這樣可以確保我們的座標反轉只影響這段程式碼，不會影響到其他繪圖操作
  pop();
}

// 繪製面具的輔助函式
function drawMask(videoWidth, videoHeight) {
  // 檢查是否有偵測到臉部以及是否有面具圖片
  if (faceDetections.length > 0 && maskImages.length > 0) {
    for (let i = 0; i < faceDetections.length; i++) {
      const landmarks = faceDetections[i].landmarks;

      // 使用下顎、鼻子和眼睛的特徵點來定位面具
      const jawLeft = landmarks.getJawOutline()[1];
      const jawRight = landmarks.getJawOutline()[15];
      const chin = landmarks.getJawOutline()[8];
      const noseBridgeTop = landmarks.getNose()[3]; // 鼻樑頂端

      // 計算臉的寬度，用來縮放面具
      const faceWidth = Math.hypot(jawLeft._x - jawRight._x, jawLeft._y - jawRight._y);

      // 計算臉的角度，用來旋轉面具
      const faceAngle = Math.atan2(chin._y - noseBridgeTop._y, chin._x - noseBridgeTop._x);

      // 面具的中心點（大約在鼻樑中間）
      const maskCenter = landmarks.getNose()[1];

      // 將座標轉換到畫布上的鏡像座標系統
      let maskX = (maskCenter._x / capture.width - 0.5) * videoWidth;
      let maskY = (maskCenter._y / capture.height - 0.5) * videoHeight;

      // 根據臉寬來設定面具大小 (1.5 是一個經驗值，您可以調整它)
      let maskWidth = (faceWidth / capture.width) * videoWidth * 1.5;
      const imgToDraw = maskImages[currentMaskIndex];
      let maskHeight = maskWidth * (imgToDraw.height / imgToDraw.width);

      push();
      translate(maskX, maskY);
      // 旋轉面具以對齊臉部角度
      rotate(HALF_PI - faceAngle);
      image(imgToDraw, 0, 0, maskWidth, maskHeight);
      pop();
    }
  }
}

// 繪製耳環的輔助函式
function drawEarrings(videoWidth, videoHeight) {
  // 檢查是否有偵測到臉部，以及是否有有效的手勢
  if (faceDetections.length > 0 && currentEarringIndex !== -1) {
    // 遍歷所有偵測到的臉部 (通常只會有一個)
    for (let i = 0; i < faceDetections.length; i++) {
      // 取得下顎線的特徵點
      const jawOutline = faceDetections[i].parts.jawOutline;

      // 下顎線的第0點和第16點分別對應左右耳垂附近
      const leftEarlobe = jawOutline[0];
      const rightEarlobe = jawOutline[16];

      // --- 座標轉換 ---
      // ml5.js 回傳的座標是基於原始攝影機畫面的解析度
      // 我們需要將它轉換到畫布上縮放後的影像座標系統

      // 計算相對於影像中心點的座標
      let x1 = (leftEarlobe._x / capture.width - 0.5) * videoWidth;
      let y1 = (leftEarlobe._y / capture.height - 0.5) * videoHeight;
      let x2 = (rightEarlobe._x / capture.width - 0.5) * videoWidth;
      let y2 = (rightEarlobe._y / capture.height - 0.5) * videoHeight;

      // 從陣列中取得要繪製的耳環圖片
      const imgToDraw = earringImages[currentEarringIndex];

      // 繪製耳環圖片 (因為我們在一個 scale(-1, 1) 的座標系中，
      // 繪圖函式會自動處理鏡像)
      // 您可以調整最後兩個參數 (40, 40) 來改變耳環的大小
      image(imgToDraw, x1, y1, 40, 40);
      image(imgToDraw, x2, y2, 40, 40);
    }
  }
}

// 這個函式會在瀏覽器視窗大小改變時自動被呼叫
function windowResized() {
  // 將畫布大小調整為新的視窗大小
  resizeCanvas(windowWidth, windowHeight);
}

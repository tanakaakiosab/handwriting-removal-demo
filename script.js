let isOpenCVReady = false;
let isTesseractReady = false;
let currentImage = null;
let ocrResults = null;
let worker = null;

// Tesseract.js初期化
async function initTesseract() {
  try {
    worker = await Tesseract.createWorker();
    await worker.loadLanguage('jpn+eng');
    await worker.initialize('jpn+eng');
    isTesseractReady = true;
    updateStatus();
    console.log('Tesseract.js初期化完了');
  } catch (error) {
    console.error('Tesseract.js初期化エラー:', error);
    document.getElementById('status').textContent = 'Tesseract.js初期化に失敗しました';
    document.getElementById('status').className = 'status loading';
  }
}

function onOpenCvReady() {
  isOpenCVReady = true;
  updateStatus();
  console.log('OpenCV.js初期化完了');
}

function updateStatus() {
  const status = document.getElementById('status');
  if (isOpenCVReady && isTesseractReady) {
    status.textContent = '✅ 準備完了！画像を選択してください。';
    status.className = 'status ready';

    // 全ての入力要素を有効化
    document.querySelectorAll('input, button, select').forEach(el => {
      if (!['processBtn', 'saveBtn'].includes(el.id)) {
        el.disabled = false;
      }
    });
  } else {
    const loaded = [];
    if (isOpenCVReady) loaded.push('OpenCV.js');
    if (isTesseractReady) loaded.push('Tesseract.js');
    status.textContent = `読み込み中... (完了: ${loaded.join(', ')})`;
  }
}

function updateProgress(progress, text) {
  const progressSection = document.getElementById('progressSection');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');

  progressSection.style.display = 'block';
  progressFill.style.width = `${progress}%`;
  progressText.textContent = text;

  if (progress >= 100) {
    setTimeout(() => {
      progressSection.style.display = 'none';
    }, 1000);
  }
}

async function performOCR() {
  if (!isTesseractReady || !currentImage) {
    alert('Tesseract.jsが準備できていないか、画像が選択されていません。');
    return;
  }

  try {
    const status = document.getElementById('status');
    status.textContent = '🔍 OCR解析実行中...';
    status.className = 'status processing';

    const canvas = document.getElementById('canvasInput');
    const language = document.getElementById('languageSelect').value;

    // Tesseract.js v4の場合、reinitializeは存在しないため、
    // 既存のワーカーを終了し、新しいワーカーを目的の言語で作成します。
    if (worker) {
        await worker.terminate(); // 古いワーカーを終了
        worker = await Tesseract.createWorker(); // 新しいワーカーを作成
        await worker.loadLanguage(language);
        await worker.initialize(language);
    }

    updateProgress(10, 'OCR解析開始...');

    const { data } = await worker.recognize(canvas, {
      logger: m => {
        if (m.status === 'recognizing text') {
          const progress = 10 + (m.progress * 70);
          updateProgress(progress, `OCR解析中... ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    updateProgress(80, 'OCR結果を処理中...');

    ocrResults = data;
    displayOCRResults(data);
    visualizeOCRResults(data);

    document.getElementById('processBtn').disabled = false;
    status.textContent = '✅ OCR解析完了！手書き文字除去を実行できます。';
    status.className = 'status ready';

    updateProgress(100, 'OCR解析完了！');

    console.log('OCR解析完了:', data);
  } catch (error) {
    console.error('OCR解析エラー:', error);
    alert('OCR解析中にエラーが発生しました: ' + error.message);
    document.getElementById('status').textContent = '❌ OCR解析でエラーが発生しました';
    document.getElementById('status').className = 'status loading';
  }
}

function displayOCRResults(data) {
  const resultsDiv = document.getElementById('ocrResults');
  const textDiv = document.getElementById('ocrText');

  resultsDiv.style.display = 'block';
  textDiv.innerHTML = '';

  data.words.forEach((word, index) => {
    const confidence = Math.round(word.confidence);
    const div = document.createElement('div');
    div.className = 'text-item';

    if (confidence < 70) {
      div.className += ' low-confidence';
    }
    if (confidence < 50) {
      div.className += ' very-low-confidence';
    }

    div.innerHTML = `
      <strong>「${word.text}」</strong>
      <span class="confidence">信頼度: ${confidence}%</span>
    `;
    textDiv.appendChild(div);
  });
}

function visualizeOCRResults(data) {
  const canvas = document.getElementById('ocrCanvas');
  const inputCanvas = document.getElementById('canvasInput');
  const ctx = canvas.getContext('2d');

  canvas.width = inputCanvas.width;
  canvas.height = inputCanvas.height;

  // 元画像をコピー
  ctx.drawImage(inputCanvas, 0, 0);

  const confidenceThreshold = parseInt(document.getElementById('confidenceThreshold').value);

  data.words.forEach(word => {
    const { bbox, confidence } = word;
    const { x0, y0, x1, y1 } = bbox;

    ctx.strokeWidth = 2;
    ctx.fillStyle = confidence >= confidenceThreshold ? 'rgba(0, 255, 0, 0.3)' : 'rgba(255, 0, 0, 0.3)';
    ctx.strokeStyle = confidence >= confidenceThreshold ? 'green' : 'red';

    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  });
}

function createHandwritingMask() {
  if (!ocrResults) return null;

  const canvas = document.getElementById('canvasInput');
  const confidenceThreshold = parseInt(document.getElementById('confidenceThreshold').value);
  const expansionSize = parseInt(document.getElementById('expansionSize').value);
  const minTextSize = parseInt(document.getElementById('minTextSize').value);

  // OpenCVでマスクを作成
  const mask = cv.Mat.zeros(canvas.height, canvas.width, cv.CV_8UC1);

  // 全画面を手書き候補として開始
  mask.setTo(new cv.Scalar(255));

  // 信頼度の高いOCR結果の領域を除外
  ocrResults.words.forEach(word => {
    const { bbox, confidence } = word;
    const { x0, y0, x1, y1 } = bbox;
    const textHeight = y1 - y0;

    if (confidence >= confidenceThreshold && textHeight >= minTextSize) {
      // この領域は印刷文字として保護（マスクから除外）
      const rect = new cv.Rect(
        Math.max(0, x0 - expansionSize),
        Math.max(0, y0 - expansionSize),
        Math.min(canvas.width - x0, x1 - x0 + expansionSize * 2),
        Math.min(canvas.height - y0, y1 - y0 + expansionSize * 2)
      );
      const roi = mask.roi(rect);
      roi.setTo(new cv.Scalar(0));
    }
  });

  // さらに画像処理で手書き領域を精密化
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3, 3));
  const processed = new cv.Mat();
  cv.morphologyEx(mask, processed, cv.MORPH_CLOSE, kernel);
  cv.morphologyEx(processed, mask, cv.MORPH_OPEN, kernel);

  kernel.delete();
  processed.delete();

  return mask;
}

function processImage() {
  if (!isOpenCVReady || !ocrResults) {
    alert('OCR解析を先に実行してください。');
    return;
  }

  try {
    const status = document.getElementById('status');
    status.textContent = '🎨 手書き文字除去処理中...';
    status.className = 'status processing';

    updateProgress(0, '手書きマスク作成中...');

    const canvasInput = document.getElementById('canvasInput');
    const canvasOutput = document.getElementById('canvasOutput');
    const maskCanvas = document.getElementById('maskCanvas');
    const hiddenCanvas = document.getElementById('hiddenCanvas');

    // 手書きマスクを作成
    const mask = createHandwritingMask();

    updateProgress(30, 'マスク表示中...');

    // マスクを表示
    maskCanvas.width = mask.cols;
    maskCanvas.height = mask.rows;
    cv.imshow(maskCanvas, mask);

    updateProgress(50, 'インペインティング実行中...');

    // 元画像を読み込み
    const src = cv.imread(canvasInput);
    const src3ch = new cv.Mat();

    // 3チャンネルに変換
    if (src.channels() === 4) {
      cv.cvtColor(src, src3ch, cv.COLOR_RGBA2RGB);
    } else if (src.channels() === 1) {
      cv.cvtColor(src, src3ch, cv.COLOR_GRAY2RGB);
    } else {
      src.copyTo(src3ch);
    }

    // インペインティング実行
    const dst = new cv.Mat();
    const inpaintRadius = parseInt(document.getElementById('inpaintRadius').value);
    cv.inpaint(src3ch, mask, dst, inpaintRadius, cv.INPAINT_TELEA);

    updateProgress(80, '結果表示中...');

    // 結果を表示
    canvasOutput.width = dst.cols;
    canvasOutput.height = dst.rows;
    cv.imshow(canvasOutput, dst);

    // 保存用
    hiddenCanvas.width = dst.cols;
    hiddenCanvas.height = dst.rows;
    cv.imshow(hiddenCanvas, dst);

    document.getElementById('saveBtn').disabled = false;

    // メモリ解放
    [src, src3ch, dst, mask].forEach(mat => {
      if (mat && !mat.isDeleted()) mat.delete();
    });

    status.textContent = '✅ 手書き文字除去完了！';
    status.className = 'status ready';

    updateProgress(100, '処理完了！');

    console.log('手書き文字除去完了');
  } catch (error) {
    console.error('処理エラー:', error);
    alert('手書き文字除去中にエラーが発生しました: ' + error.message);
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', function() {
  initTesseract();

  const inputImage = document.getElementById('inputImage');
  const ocrBtn = document.getElementById('ocrBtn');
  const processBtn = document.getElementById('processBtn');
  const saveBtn = document.getElementById('saveBtn');

  // パラメータスライダーの更新
  document.getElementById('confidenceThreshold').addEventListener('input', function() {
    document.getElementById('confidenceValue').textContent = this.value + '%';
    if (ocrResults) visualizeOCRResults(ocrResults);
  });

  document.getElementById('expansionSize').addEventListener('input', function() {
    document.getElementById('expansionValue').textContent = this.value + 'px';
  });

  document.getElementById('inpaintRadius').addEventListener('input', function() {
    document.getElementById('inpaintValue').textContent = this.value + 'px';
  });

  document.getElementById('minTextSize').addEventListener('input', function() {
    document.getElementById('minSizeValue').textContent = this.value + 'px';
  });

  inputImage.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        const canvasInput = document.getElementById('canvasInput');
        const ctx = canvasInput.getContext('2d');

        canvasInput.width = img.width;
        canvasInput.height = img.height;
        ctx.drawImage(img, 0, 0);

        currentImage = img;
        ocrBtn.disabled = false;

        // リセット
        ocrResults = null;
        processBtn.disabled = true;
        saveBtn.disabled = true;
        document.getElementById('ocrResults').style.display = 'none';
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  ocrBtn.addEventListener('click', performOCR);
  processBtn.addEventListener('click', processImage);

  saveBtn.addEventListener('click', function() {
    const hiddenCanvas = document.getElementById('hiddenCanvas');
    const link = document.createElement('a');
    link.download = `ocr_handwriting_removed_${Date.now()}.png`;
    link.href = hiddenCanvas.toDataURL('image/png');
    link.click();
  });
});

// クリーンアップ
window.addEventListener('beforeunload', async function() {
  if (worker) {
    await worker.terminate();
  }
});
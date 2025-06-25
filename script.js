let isCVReady = false;

// OpenCV.jsが完全にロードされたかをチェック
function onOpenCvReady() {
  if (!isCVReady && cv && cv.onRuntimeInitialized) {
    isCVReady = true;
    initApp();
  }
}

function initApp() {
  const input = document.getElementById('inputImage');
  const saveBtn = document.getElementById('saveBtn');
  const canvas = document.getElementById('canvasOutput');
  const maskCanvas = document.getElementById('maskCanvas');
  const ctx = canvas.getContext('2d');

  input.addEventListener('change', onFileChange);
  saveBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'result.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  function onFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = evt => {
      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        processImage(canvas);
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }

  function processImage(canvas) {
    try {
      const src = cv.imread(canvas);
      const gray = new cv.Mat();
      const mask = new cv.Mat();
      const dst = new cv.Mat();

      // グレースケール変換
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // 二値化処理（しきい値調整が必要）
      cv.threshold(gray, mask, 180, 255, cv.THRESH_BINARY_INV);

      // マスク表示（デバッグ用）
      maskCanvas.width = mask.cols;
      maskCanvas.height = mask.rows;
      cv.imshow(maskCanvas, mask);

      // インペインティング処理
      cv.inpaint(src, mask, dst, 5, cv.INPAINT_TELEA); // TEALE推奨

      // 結果表示
      cv.imshow(canvas, dst);

      // メモリ解放
      [src, gray, mask, dst].forEach(mat => mat.delete());
    } catch (err) {
      console.error("OpenCV処理中にエラー:", err);
    }
  }
}

// OpenCV.jsがロードされたら初期化
if (cv && cv.onRuntimeInitialized) {
  onOpenCvReady();
} else {
  document.addEventListener("load", onOpenCvReady);
}

function onOpenCvReady() {
  console.log('OpenCV.js 動作準備完了');
  const input = document.getElementById('inputImage');
  const saveBtn = document.getElementById('saveBtn');
  const canvas = document.getElementById('canvasOutput');
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
    const src = cv.imread(canvas);
    const gray = new cv.Mat();
    const mask = new cv.Mat();
    const dst = new cv.Mat();

    // グレースケール変換
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // 二値化（しきい値120、文字部分を黒に反転）
    cv.threshold(gray, mask, 120, 255, cv.THRESH_BINARY_INV);

    // マスクを画面に表示（文字部分が白く抽出されているはず）
    const maskCanvas = document.getElementById('maskCanvas');
    maskCanvas.width = mask.cols;
    maskCanvas.height = mask.rows;
    cv.imshow(maskCanvas, mask);

    // インペイント（消去）処理
    cv.inpaint(src, mask, dst, 5, cv.INPAINT_NS);

    // 結果表示
    cv.imshow(canvas, dst);

    // メモリ解放
    [src, gray, mask, dst].forEach(mat => mat.delete());
  }
}

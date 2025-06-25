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

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.threshold(gray, mask, 180, 255, cv.THRESH_BINARY_INV);
    cv.inpaint(src, mask, dst, 3, cv.INPAINT_TELEA);

    cv.imshow(canvas, dst);
    [src, gray, mask, dst].forEach(mat => mat.delete());
  }
}

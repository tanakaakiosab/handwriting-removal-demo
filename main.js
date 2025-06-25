function processImage(canvas) {
  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const mask = new cv.Mat();
  const dst = new cv.Mat();

  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  cv.threshold(gray, mask, 120, 255, cv.THRESH_BINARY_INV);

  const maskCanvas = document.getElementById('maskCanvas');
  maskCanvas.width = mask.cols;
  maskCanvas.height = mask.rows;
  cv.imshow(maskCanvas, mask);

  cv.inpaint(src, mask, dst, 5, cv.INPAINT_NS);

  // ここでcanvasOutputに表示
  cv.imshow(canvas, dst);

  // さらに非表示canvasに描画（保存用）
  const hiddenCanvas = document.getElementById('hiddenCanvas');
  hiddenCanvas.width = dst.cols;
  hiddenCanvas.height = dst.rows;
  cv.imshow(hiddenCanvas, dst);

  [src, gray, mask, dst].forEach(mat => mat.delete());
}

saveBtn.addEventListener('click', () => {
  const hiddenCanvas = document.getElementById('hiddenCanvas');
  const link = document.createElement('a');
  link.download = 'result.png';
  link.href = hiddenCanvas.toDataURL('image/png');
  link.click();
});

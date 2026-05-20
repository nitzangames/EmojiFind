(function() {
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');

  function drawFrame() {
    ctx.fillStyle = COL_BG;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.textAlign = 'center';
    ctx.font = '21px sans-serif';
    ctx.fillText(VERSION, CANVAS_W / 2, CANVAS_H - 24);

    requestAnimationFrame(drawFrame);
  }
  requestAnimationFrame(drawFrame);
})();

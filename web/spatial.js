(function initializeSpatialDashboard() {
  "use strict";

  const canvas = document.querySelector("#globe3d");
  const hero = document.querySelector(".committee-hero");
  const tiltCard = document.querySelector('[data-tilt="3d"]');
  if (!canvas || !hero || !tiltCard) return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const context = canvas.getContext("2d");
  const pointCount = 180;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const points = Array.from({ length: pointCount }, (_, index) => {
    const y = 1 - (index / (pointCount - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const angle = goldenAngle * index;
    return { x: Math.cos(angle) * radius, y, z: Math.sin(angle) * radius };
  });
  const links = [];
  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      const a = points[first], b = points[second];
      const distance = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (distance < 0.29) links.push([first, second]);
    }
  }

  let width = 0, height = 0, pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;
  function fitCanvas() {
    const bounds = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    width = bounds.width;
    height = bounds.height;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    canvas.dataset.renderer = "canvas-3d";
    canvas.dataset.motion = reduceMotion ? "static" : "animated";
  }

  function project(point, rotationY, rotationX) {
    const cosY = Math.cos(rotationY), sinY = Math.sin(rotationY);
    const cosX = Math.cos(rotationX), sinX = Math.sin(rotationX);
    const x1 = point.x * cosY - point.z * sinY;
    const z1 = point.x * sinY + point.z * cosY;
    const y1 = point.y * cosX - z1 * sinX;
    const z2 = point.y * sinX + z1 * cosX;
    const perspective = 1 / (3.1 - z2);
    const globeRadius = Math.min(height * .54, width * .27);
    return {
      x: width * .77 + x1 * globeRadius * perspective * 2.3,
      y: height * .5 + y1 * globeRadius * perspective * 2.3,
      z: z2,
      scale: perspective,
    };
  }

  function draw(timestamp = 0) {
    pointerX += (targetX - pointerX) * .055;
    pointerY += (targetY - pointerY) * .055;
    const rotationY = (reduceMotion ? .45 : timestamp * .00009) + pointerX;
    const rotationX = -.16 + pointerY;
    const projected = points.map((point) => project(point, rotationY, rotationX));
    context.clearRect(0, 0, width, height);

    const glow = context.createRadialGradient(width * .77, height * .5, 0, width * .77, height * .5, Math.min(width, height) * .5);
    glow.addColorStop(0, "rgba(45, 200, 210, .13)");
    glow.addColorStop(1, "rgba(45, 200, 210, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);

    context.lineWidth = .65;
    for (const [first, second] of links) {
      const a = projected[first], b = projected[second];
      if (a.z < -.45 || b.z < -.45) continue;
      context.strokeStyle = `rgba(98, 225, 229, ${Math.max(.025, (a.z + b.z + 2) * .055)})`;
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.stroke();
    }

    projected.sort((a, b) => a.z - b.z).forEach((point) => {
      const alpha = Math.max(.18, (point.z + 1.2) / 2.2);
      context.fillStyle = `rgba(133, 244, 238, ${alpha})`;
      context.beginPath();
      context.arc(point.x, point.y, 1 + point.scale * 3.6, 0, Math.PI * 2);
      context.fill();
    });
    if (!reduceMotion) requestAnimationFrame(draw);
  }

  function applyTilt(event) {
    if (reduceMotion) return;
    const bounds = tiltCard.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - .5;
    const y = (event.clientY - bounds.top) / bounds.height - .5;
    tiltCard.style.transform = `rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg) translateZ(10px)`;
  }

  hero.addEventListener("pointermove", (event) => {
    const bounds = hero.getBoundingClientRect();
    targetX = ((event.clientX - bounds.left) / bounds.width - .5) * .28;
    targetY = ((event.clientY - bounds.top) / bounds.height - .5) * .14;
  }, { passive: true });
  hero.addEventListener("pointerleave", () => { targetX = 0; targetY = 0; }, { passive: true });
  tiltCard.addEventListener("pointermove", applyTilt, { passive: true });
  tiltCard.addEventListener("pointerleave", () => { tiltCard.style.transform = ""; }, { passive: true });
  new ResizeObserver(fitCanvas).observe(canvas);
  fitCanvas();
  draw(0);
}());

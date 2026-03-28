const phaseDefinitions = [
  { key: "inhale", label: "吸气", colorVar: "--inhale" },
  { key: "holdIn", label: "吸后停顿", colorVar: "--hold-in" },
  { key: "exhale", label: "呼气", colorVar: "--exhale" },
  { key: "holdOut", label: "呼后停顿", colorVar: "--hold-out" }
];

const dom = {
  inhaleInput: document.getElementById("inhaleInput"),
  holdInInput: document.getElementById("holdInInput"),
  exhaleInput: document.getElementById("exhaleInput"),
  holdOutInput: document.getElementById("holdOutInput"),
  durationInput: document.getElementById("durationInput"),
  startButton: document.getElementById("startButton"),
  pauseButton: document.getElementById("pauseButton"),
  resetButton: document.getElementById("resetButton"),
  phaseChip: document.getElementById("phaseChip"),
  phaseRemaining: document.getElementById("phaseRemaining"),
  elapsedTime: document.getElementById("elapsedTime"),
  cycleCount: document.getElementById("cycleCount"),
  cycleDuration: document.getElementById("cycleDuration"),
  shapeHint: document.getElementById("shapeHint"),
  shapeLabel: document.getElementById("shapeLabel"),
  themeToggle: document.getElementById("themeToggle"),
  basePath: document.getElementById("basePath"),
  segmentPaths: [
    document.getElementById("segmentPath0"),
    document.getElementById("segmentPath1"),
    document.getElementById("segmentPath2"),
    document.getElementById("segmentPath3")
  ],
  phasePath: document.getElementById("phasePath"),
  progressDot: document.getElementById("progressDot")
};

const state = {
  isRunning: false,
  animationFrameId: null,
  startedAt: 0,
  pausedElapsedMs: 0,
  lastMarker: "",
  audioContext: null,
  totalPathLength: 0,
  shapePoints: [],
  theme: "light"
};

function getConfig() {
  return {
    inhale: readNumber(dom.inhaleInput, 4, 1),
    holdIn: readNumber(dom.holdInInput, 4, 0),
    exhale: readNumber(dom.exhaleInput, 4, 1),
    holdOut: readNumber(dom.holdOutInput, 4, 0),
    stopMinutes: readNumber(dom.durationInput, 5, 0)
  };
}

function readNumber(input, fallback, min) {
  const value = Number(input.value);
  if (!Number.isFinite(value)) {
    input.value = String(fallback);
    return fallback;
  }

  const normalized = Math.max(min, Math.round(value));
  if (normalized !== value) {
    input.value = String(normalized);
  }
  return normalized;
}

function buildShapeData(config) {
  const lengths = [
    config.inhale,
    Math.max(config.holdIn, 0.2),
    config.exhale,
    Math.max(config.holdOut, 0.2)
  ];

  const adjusted = adjustLengthsForClosure(lengths);
  const radius = solveCyclicRadius(adjusted);
  const angles = adjusted.map((side) => 2 * Math.asin(side / (2 * radius)));

  let currentAngle = -Math.PI / 2;
  const unitPoints = [];
  for (let i = 0; i < 4; i += 1) {
    unitPoints.push({
      x: Math.cos(currentAngle) * radius,
      y: Math.sin(currentAngle) * radius
    });
    currentAngle += angles[i];
  }

  const points = fitPointsToViewBox(unitPoints);
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ") + " Z";

  return {
    path,
    points,
    adjustedLengths: adjusted
  };
}

function adjustLengthsForClosure(lengths) {
  const sorted = [...lengths].sort((a, b) => b - a);
  if (sorted[0] < sorted[1] + sorted[2] + sorted[3]) {
    return lengths;
  }

  const maxIndex = lengths.indexOf(Math.max(...lengths));
  const sumOthers = lengths.reduce((sum, value, index) => sum + (index === maxIndex ? 0 : value), 0);
  const adjusted = [...lengths];
  adjusted[maxIndex] = Math.max(sumOthers - 0.1, 0.2);
  return adjusted;
}

function solveCyclicRadius(lengths) {
  let low = Math.max(...lengths) / 2 + 0.0001;
  let high = low * 2;

  while (angleSum(high, lengths) > Math.PI * 2) {
    high *= 2;
  }

  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    if (angleSum(mid, lengths) > Math.PI * 2) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return high;
}

function angleSum(radius, lengths) {
  return lengths.reduce((sum, side) => sum + 2 * Math.asin(Math.min(0.999999, side / (2 * radius))), 0);
}

function fitPointsToViewBox(points) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;
  const scale = 72 / Math.max(width, height);
  const offsetX = 50 - (minX + maxX) * scale / 2;
  const offsetY = 50 - (minY + maxY) * scale / 2;

  return points.map((point) => ({
    x: point.x * scale + offsetX,
    y: point.y * scale + offsetY
  }));
}

function updateShapePreview() {
  const config = getConfig();
  const shapeData = buildShapeData(config);
  dom.basePath.setAttribute("d", shapeData.path);
  dom.phasePath.setAttribute("d", shapeData.path);
  dom.segmentPaths.forEach((path) => path.setAttribute("d", shapeData.path));
  state.shapePoints = shapeData.points;
  state.totalPathLength = dom.phasePath.getTotalLength();
  updateSegmentStrokes(config);
  dom.phasePath.style.strokeDasharray = `0 ${state.totalPathLength}`;
  positionDotAtLength(0);

  const allEqual = config.inhale === config.holdIn && config.holdIn === config.exhale && config.exhale === config.holdOut;
  dom.shapeLabel.textContent = allEqual ? "正方形" : "闭环四边形";

  const shapeAdjusted = shapeData.adjustedLengths.some((length, index) => Math.abs(length - [config.inhale, Math.max(config.holdIn, 0.2), config.exhale, Math.max(config.holdOut, 0.2)][index]) > 0.01);

  dom.shapeHint.textContent = allEqual
    ? "当前四段时长相等，因此会显示一个正方形闭环。"
    : shapeAdjusted
      ? "某一段时间过长时，图形会自动压缩展示比例，以保证路径保持闭环。"
      : "四段时长会分别对应闭环图形的四条边，红线会沿同一条路径循环描边。";

  const totalCycle = getCycleDuration(config);
  dom.cycleDuration.textContent = `${totalCycle} 秒`;
}

function updateSegmentStrokes(config) {
  const durations = [config.inhale, config.holdIn, config.exhale, config.holdOut];
  const cycleDuration = getCycleDuration(config);
  let offsetLength = 0;

  dom.segmentPaths.forEach((path, index) => {
    const segmentLength = cycleDuration > 0 ? state.totalPathLength * (durations[index] / cycleDuration) : 0;
    path.style.strokeDasharray = `${segmentLength} ${Math.max(state.totalPathLength - segmentLength, 0.001)}`;
    path.style.strokeDashoffset = `${-offsetLength}`;
    offsetLength += segmentLength;
  });
}

function getCycleDuration(config) {
  return config.inhale + config.holdIn + config.exhale + config.holdOut;
}

function startSession() {
  const config = getConfig();
  const cycleDuration = getCycleDuration(config);
  if (cycleDuration <= 0) {
    return;
  }

  initializeAudio();
  if (state.isRunning) {
    return;
  }

  state.isRunning = true;
  state.startedAt = performance.now();
  state.lastMarker = "";
  tick();
}

function pauseSession() {
  if (!state.isRunning) {
    return;
  }

  state.isRunning = false;
  state.pausedElapsedMs += performance.now() - state.startedAt;
  cancelAnimationFrame(state.animationFrameId);
}

function resetSession() {
  pauseSession();
  state.pausedElapsedMs = 0;
  state.lastMarker = "";
  dom.phaseChip.textContent = "待开始";
  dom.phaseChip.style.background = "";
  dom.phaseChip.style.color = "";
  dom.phaseRemaining.textContent = formatClock(getConfig().inhale);
  dom.elapsedTime.textContent = "00:00";
  dom.cycleCount.textContent = "0";
  dom.phasePath.style.strokeDasharray = `0 ${state.totalPathLength || 1}`;
  dom.phasePath.style.stroke = getComputedStyle(document.documentElement).getPropertyValue("--inhale").trim();
  dom.progressDot.style.fill = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
  positionDotAtLength(0);
}

function tick() {
  if (!state.isRunning) {
    return;
  }

  const config = getConfig();
  const cycleDuration = getCycleDuration(config);
  const stopSeconds = config.stopMinutes > 0 ? config.stopMinutes * 60 : Infinity;
  const elapsedMs = state.pausedElapsedMs + (performance.now() - state.startedAt);
  const elapsedSeconds = elapsedMs / 1000;

  if (elapsedSeconds >= stopSeconds) {
    applyProgress(config, stopSeconds);
    pauseSession();
    dom.phaseChip.textContent = "已完成";
    return;
  }

  applyProgress(config, elapsedSeconds);
  state.animationFrameId = requestAnimationFrame(tick);
}

function applyProgress(config, elapsedSeconds) {
  const cycleDuration = getCycleDuration(config);
  const phaseDurations = [config.inhale, config.holdIn, config.exhale, config.holdOut];
  const cycleIndex = Math.floor(elapsedSeconds / cycleDuration);
  const withinCycle = elapsedSeconds % cycleDuration;
  const { phaseIndex, phaseElapsed, phaseRemaining } = resolvePhase(phaseDurations, withinCycle);
  const phase = phaseDefinitions[phaseIndex];
  const marker = `${cycleIndex}-${phaseIndex}`;
  const phaseColor = getComputedStyle(document.documentElement).getPropertyValue(phase.colorVar).trim();

  if (marker !== state.lastMarker) {
    state.lastMarker = marker;
    playCue(phaseIndex);
  }

  dom.phaseChip.textContent = phase.label;
  dom.phaseChip.style.background = `${phaseColor}22`;
  dom.phaseChip.style.color = phaseColor;
  dom.phaseRemaining.textContent = formatClock(phaseRemaining);
  dom.elapsedTime.textContent = formatClock(elapsedSeconds);
  dom.cycleCount.textContent = String(cycleIndex);
  dom.phasePath.style.stroke = phaseColor;
  dom.progressDot.style.fill = phaseColor;

  const progress = withinCycle / cycleDuration;
  const drawLength = state.totalPathLength * progress;
  dom.phasePath.style.strokeDasharray = `${drawLength} ${Math.max(state.totalPathLength - drawLength, 0.001)}`;
  positionDotAtLength(drawLength);
}

function resolvePhase(durations, timeInCycle) {
  let cursor = 0;
  for (let index = 0; index < durations.length; index += 1) {
    const duration = durations[index];
    if (timeInCycle < cursor + duration || index === durations.length - 1) {
      return {
        phaseIndex: index,
        phaseElapsed: timeInCycle - cursor,
        phaseRemaining: Math.max(duration - (timeInCycle - cursor), 0)
      };
    }
    cursor += duration;
  }

  return {
    phaseIndex: 0,
    phaseElapsed: 0,
    phaseRemaining: durations[0]
  };
}

function positionDotAtLength(length) {
  if (!state.totalPathLength) {
    dom.progressDot.setAttribute("cx", "50");
    dom.progressDot.setAttribute("cy", "50");
    return;
  }

  const safeLength = length <= 0 ? 0 : Math.min(length, state.totalPathLength);
  const point = dom.phasePath.getPointAtLength(safeLength);
  dom.progressDot.setAttribute("cx", point.x.toFixed(2));
  dom.progressDot.setAttribute("cy", point.y.toFixed(2));
}

function formatClock(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const seconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function initializeAudio() {
  if (!state.audioContext) {
    state.audioContext = new window.AudioContext();
  }
  if (state.audioContext.state === "suspended") {
    state.audioContext.resume();
  }
}

function playCue(phaseIndex) {
  if (!state.audioContext) {
    return;
  }

  const frequencies = [540, 660, 420, 660];
  const now = state.audioContext.currentTime;
  const oscillator = state.audioContext.createOscillator();
  const gainNode = state.audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequencies[phaseIndex] || 520, now);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

  oscillator.connect(gainNode);
  gainNode.connect(state.audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.22);
}

function initializeTheme() {
  const storedTheme = window.localStorage.getItem("breath-theme");
  const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  state.theme = storedTheme || (systemPrefersDark ? "dark" : "light");
  applyTheme(state.theme);
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  const isDark = theme === "dark";
  dom.themeToggle.textContent = isDark ? "浅色模式" : "深色模式";
  dom.themeToggle.setAttribute("aria-pressed", String(isDark));
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute("content", isDark ? "#171311" : "#fff6ed");
  }
  if (!state.isRunning) {
    resetSession();
  }
}

function toggleTheme() {
  const nextTheme = state.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  window.localStorage.setItem("breath-theme", nextTheme);
}

dom.startButton.addEventListener("click", startSession);
dom.pauseButton.addEventListener("click", pauseSession);
dom.resetButton.addEventListener("click", resetSession);
dom.themeToggle.addEventListener("click", toggleTheme);

[
  dom.inhaleInput,
  dom.holdInInput,
  dom.exhaleInput,
  dom.holdOutInput,
  dom.durationInput
].forEach((input) => {
  input.addEventListener("input", () => {
    updateShapePreview();
    resetSession();
  });
});

initializeTheme();
updateShapePreview();
resetSession();

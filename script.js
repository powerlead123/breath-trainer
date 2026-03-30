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
  wakeLockButton: document.getElementById("wakeLockButton"),
  installButton: document.getElementById("installButton"),
  savePresetButton: document.getElementById("savePresetButton"),
  wakeLockHint: document.getElementById("wakeLockHint"),
  installHint: document.getElementById("installHint"),
  standaloneHint: document.getElementById("standaloneHint"),
  presetList: document.getElementById("presetList"),
  launchScreen: document.getElementById("launchScreen"),
  connectionBanner: document.getElementById("connectionBanner"),
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

const builtInPresets = [
  { id: "preset-special-love", name: "特别的爱", inhale: 4, holdIn: 4, exhale: 4, holdOut: 4, stopMinutes: 5 }
];

const state = {
  isRunning: false,
  animationFrameId: null,
  startedAt: 0,
  pausedElapsedMs: 0,
  lastMarker: "",
  audioContext: null,
  totalPathLength: 0,
  theme: "light",
  wakeLock: null,
  wakeLockRequested: false,
  deferredPrompt: null,
  customPresets: [],
  currentShapeMinute: -1
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

function populateSelectOptions() {
  fillSelect(dom.inhaleInput, 1, 20, 4);
  fillSelect(dom.holdInInput, 0, 20, 4);
  fillSelect(dom.exhaleInput, 1, 20, 4);
  fillSelect(dom.holdOutInput, 0, 20, 4);
  fillSelect(dom.durationInput, 0, 120, 5, "分钟");
}

function fillSelect(select, min, max, defaultValue, suffix = "秒") {
  const options = [];
  for (let value = min; value <= max; value += 1) {
    const label = suffix === "分钟" && value === 0 ? "0 无限" : (suffix ? `${value} ${suffix}` : String(value));
    options.push(`<option value="${value}">${label}</option>`);
  }
  select.innerHTML = options.join("");
  select.value = String(defaultValue);
}

function setConfig(config) {
  dom.inhaleInput.value = String(config.inhale);
  dom.holdInInput.value = String(config.holdIn);
  dom.exhaleInput.value = String(config.exhale);
  dom.holdOutInput.value = String(config.holdOut);
  dom.durationInput.value = String(config.stopMinutes ?? 5);
  updateShapePreview();
  resetSession();
}

function buildShapeData(config, minuteIndex = 0) {
  const seed = getShapeSeed(config, minuteIndex);
  const random = createSeededRandom(seed);
  const styleIndex = minuteIndex % 3;
  const rawPoints =
    styleIndex === 0 ? buildPetalPoints(random)
    : styleIndex === 1 ? buildInkPoints(random)
    : buildFlowPoints(random);

  const points = fitPointsToViewBox(rawPoints);
  return {
    path: buildClosedSplinePath(points)
  };
}

function buildPetalPoints(random) {
  const count = 144;
  const petals = 4 + Math.floor(random() * 4);
  const phase = random() * Math.PI * 2;
  const softness = 0.12 + random() * 0.08;
  const stretchX = 0.92 + random() * 0.12;
  const stretchY = 0.92 + random() * 0.12;
  const points = [];

  for (let index = 0; index < count; index += 1) {
    const t = index / count;
    const angle = -Math.PI / 2 + t * Math.PI * 2;
    const bloom = 1 + 0.24 * Math.sin(angle * petals + phase);
    const innerRipple = softness * Math.sin(angle * petals * 2 + phase * 0.6);
    const radius = 31 + bloom * 9 + innerRipple * 10;
    points.push({
      x: Math.cos(angle) * radius * stretchX,
      y: Math.sin(angle) * radius * stretchY
    });
  }

  return points;
}

function buildInkPoints(random) {
  const count = 132;
  const lobeA = 3 + Math.floor(random() * 3);
  const lobeB = lobeA + 1;
  const phaseA = random() * Math.PI * 2;
  const phaseB = random() * Math.PI * 2;
  const stretchX = 0.94 + random() * 0.14;
  const stretchY = 0.94 + random() * 0.14;
  const points = [];

  for (let index = 0; index < count; index += 1) {
    const t = index / count;
    const angle = -Math.PI / 2 + t * Math.PI * 2;
    const pulseA = Math.sin(angle * lobeA + phaseA);
    const pulseB = Math.sin(angle * lobeB - phaseB);
    const pulseC = Math.cos(angle * 2 + phaseA * 0.5);
    const radius = 30 + pulseA * 6 + pulseB * 3.5 + pulseC * 2.5;
    points.push({
      x: Math.cos(angle) * radius * stretchX,
      y: Math.sin(angle) * radius * stretchY
    });
  }

  return points;
}

function buildFlowPoints(random) {
  const count = 140;
  const waves = 2 + Math.floor(random() * 2);
  const swirl = 0.45 + random() * 0.4;
  const phase = random() * Math.PI * 2;
  const drift = 3 + random() * 3;
  const points = [];

  for (let index = 0; index < count; index += 1) {
    const t = index / count;
    const angle = -Math.PI / 2 + t * Math.PI * 2;
    const longWave = Math.sin(angle * waves + phase) * 7.5;
    const shortWave = Math.cos(angle * (waves + 1) - phase * 0.7) * 2.8;
    const radius = 32 + longWave + shortWave;
    const curl = drift * Math.sin(angle * 2 + swirl);
    points.push({
      x: Math.cos(angle) * radius + Math.cos(angle + phase * 0.35) * curl,
      y: Math.sin(angle) * radius + Math.sin(angle + phase * 0.2) * curl * 0.75
    });
  }

  return points;
}

function getShapeSeed(config, minuteIndex) {
  return (
    config.inhale * 92821 +
    config.holdIn * 68917 +
    config.exhale * 51787 +
    config.holdOut * 39119 +
    config.stopMinutes * 1237 +
    minuteIndex * 104729
  ) >>> 0;
}

function createSeededRandom(seed) {
  let value = seed || 1;
  return function next() {
    value |= 0;
    value = (value + 0x6D2B79F5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
  const scale = 70 / Math.max(width, height);
  const offsetX = 50 - ((minX + maxX) / 2) * scale;
  const offsetY = 50 - ((minY + maxY) / 2) * scale;

  return points.map((point) => ({
    x: point.x * scale + offsetX,
    y: point.y * scale + offsetY
  }));
}

function buildClosedSplinePath(points) {
  if (points.length < 2) {
    return "M 50 50 Z";
  }

  const closed = [points[points.length - 1], ...points, points[0], points[1]];
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let index = 1; index < closed.length - 2; index += 1) {
    const previous = closed[index - 1];
    const current = closed[index];
    const next = closed[index + 1];
    const afterNext = closed[index + 2];

    const cp1x = current.x + (next.x - previous.x) / 6;
    const cp1y = current.y + (next.y - previous.y) / 6;
    const cp2x = next.x - (afterNext.x - current.x) / 6;
    const cp2y = next.y - (afterNext.y - current.y) / 6;

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }

  return `${path} Z`;
}

function updateShapePreview(minuteIndex = 0) {
  const config = getConfig();
  const shapeData = buildShapeData(config, minuteIndex);
  dom.basePath.setAttribute("d", shapeData.path);
  dom.phasePath.setAttribute("d", shapeData.path);
  dom.segmentPaths.forEach((path) => path.setAttribute("d", shapeData.path));
  state.currentShapeMinute = minuteIndex;
  state.totalPathLength = dom.phasePath.getTotalLength();
  updateSegmentStrokes(config);
  dom.phasePath.style.strokeDasharray = `0 ${state.totalPathLength}`;
  positionDotAtLength(0);
  const styleNames = ["花瓣闭环", "呼吸墨迹", "流动曲线"];
  dom.shapeLabel.textContent = styleNames[minuteIndex % 3];
  dom.shapeHint.textContent = `当前显示第 ${minuteIndex + 1} 分钟的${styleNames[minuteIndex % 3]}；满 1 分钟后会在下一轮呼吸完整结束时切换。`;

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
  state.currentShapeMinute = -1;
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
  state.currentShapeMinute = 0;
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
  const cycleIndex = Math.floor(elapsedSeconds / cycleDuration);
  const committedMinute = Math.floor((cycleIndex * cycleDuration) / 60);

  if (elapsedSeconds >= stopSeconds) {
    const finalCycleIndex = Math.floor(stopSeconds / cycleDuration);
    const finalMinuteIndex = Math.floor((finalCycleIndex * cycleDuration) / 60);
    if (state.currentShapeMinute !== finalMinuteIndex) {
      updateShapePreview(finalMinuteIndex);
    }
    applyProgress(config, stopSeconds);
    pauseSession();
    dom.phaseChip.textContent = "已完成";
    return;
  }

  if (committedMinute !== state.currentShapeMinute) {
    updateShapePreview(committedMinute);
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

  const frequencies = [560, 720, 460, 620];
  const now = state.audioContext.currentTime;
  const mainOscillator = state.audioContext.createOscillator();
  const accentOscillator = state.audioContext.createOscillator();
  const gainNode = state.audioContext.createGain();

  mainOscillator.type = "sine";
  mainOscillator.frequency.setValueAtTime(frequencies[phaseIndex] || 520, now);

  accentOscillator.type = "triangle";
  accentOscillator.frequency.setValueAtTime((frequencies[phaseIndex] || 520) * 1.5, now);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.22, now + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(0.08, now + 0.18);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

  mainOscillator.connect(gainNode);
  accentOscillator.connect(gainNode);
  gainNode.connect(state.audioContext.destination);
  mainOscillator.start(now);
  accentOscillator.start(now + 0.01);
  mainOscillator.stop(now + 0.38);
  accentOscillator.stop(now + 0.3);
}

function loadPresets() {
  try {
    const raw = window.localStorage.getItem("breath-custom-presets");
    state.customPresets = raw ? JSON.parse(raw) : [];
  } catch {
    state.customPresets = [];
  }
  renderPresets();
}

function renderPresets() {
  const presets = [...builtInPresets, ...state.customPresets];
  dom.presetList.innerHTML = presets.map((preset) => {
    const values = `${preset.inhale}-${preset.holdIn}-${preset.exhale}-${preset.holdOut}`;
    const safeName = escapeHtml(preset.name);
    const deleteButton = preset.custom
      ? `<button class="preset-delete" type="button" data-action="delete" data-id="${preset.id}">删除</button>`
      : "";
    return `
      <div class="preset-chip">
        <button class="preset-apply" type="button" data-action="apply" data-id="${preset.id}">
          ${safeName} · ${values}
        </button>
        ${deleteButton}
      </div>
    `;
  }).join("");
}

function initializeAppShell() {
  const inStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  dom.standaloneHint.textContent = inStandalone
    ? "当前正在以主屏 App 模式运行，界面已经切换为更贴近原生应用的使用方式。"
    : "从 iPhone 主屏启动时会更像 App，顶部状态栏和页面边距也会更贴合手机使用。";

  window.setTimeout(() => {
    dom.launchScreen.classList.add("is-hidden");
  }, 700);

  updateConnectionState();
  window.addEventListener("online", updateConnectionState);
  window.addEventListener("offline", updateConnectionState);
}

function updateConnectionState() {
  const offline = navigator.onLine === false;
  dom.connectionBanner.hidden = !offline;
}

function saveCurrentPreset() {
  const config = getConfig();
  const name = window.prompt("给这个方案起个名字吧", "我的呼吸方案");
  if (!name || !name.trim()) {
    return;
  }

  const preset = {
    id: `custom-${Date.now()}`,
    name: name.trim(),
    inhale: config.inhale,
    holdIn: config.holdIn,
    exhale: config.exhale,
    holdOut: config.holdOut,
    stopMinutes: config.stopMinutes,
    custom: true
  };

  state.customPresets.unshift(preset);
  window.localStorage.setItem("breath-custom-presets", JSON.stringify(state.customPresets));
  renderPresets();
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function handlePresetClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  const { action, id } = target.dataset;
  if (action === "apply") {
    const preset = [...builtInPresets, ...state.customPresets].find((item) => item.id === id);
    if (preset) {
      setConfig(preset);
    }
    return;
  }

  if (action === "delete") {
    state.customPresets = state.customPresets.filter((preset) => preset.id !== id);
    window.localStorage.setItem("breath-custom-presets", JSON.stringify(state.customPresets));
    renderPresets();
  }
}

async function toggleWakeLock() {
  if (!("wakeLock" in navigator)) {
    dom.wakeLockHint.textContent = "当前浏览器不支持常亮保护。iPhone 上建议添加到主屏幕并保持页面常亮使用。";
    return;
  }

  if (state.wakeLock) {
    await releaseWakeLock();
    return;
  }

  try {
    state.wakeLockRequested = true;
    state.wakeLock = await navigator.wakeLock.request("screen");
    state.wakeLock.addEventListener("release", () => {
      state.wakeLock = null;
      updateWakeLockUI();
    });
    dom.wakeLockHint.textContent = "常亮保护已开启。训练时屏幕会尽量保持唤醒，提醒音连续性也会更稳定。";
  } catch {
    state.wakeLockRequested = false;
    dom.wakeLockHint.textContent = "常亮保护开启失败。请确认浏览器支持，并在开始训练后再次尝试。";
  }

  updateWakeLockUI();
}

async function releaseWakeLock() {
  if (!state.wakeLock) {
    state.wakeLockRequested = false;
    return;
  }

  state.wakeLockRequested = false;
  await state.wakeLock.release();
  state.wakeLock = null;
  dom.wakeLockHint.textContent = "常亮保护已关闭。若想减少锁屏中断，训练前可以重新开启。";
  updateWakeLockUI();
}

function updateWakeLockUI() {
  dom.wakeLockButton.textContent = state.wakeLock ? "关闭常亮保护" : "开启常亮保护";
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    await navigator.serviceWorker.register("./sw.js");
    dom.installHint.textContent = "离线缓存已启用。iPhone Safari 可用“分享”→“添加到主屏幕”安装，安装后再次打开会更像 App。";
  } catch {
    dom.installHint.textContent = "当前未能注册离线缓存，但页面仍可正常在线使用。";
  }
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.deferredPrompt = event;
    dom.installButton.disabled = false;
    dom.installHint.textContent = "检测到可安装环境，点击“安装到手机”即可添加。";
  });

  window.addEventListener("appinstalled", () => {
    state.deferredPrompt = null;
    dom.installHint.textContent = "已经安装完成。你之后可以直接从主屏幕打开它。";
  });
}

async function handleInstall() {
  if (state.deferredPrompt) {
    state.deferredPrompt.prompt();
    await state.deferredPrompt.userChoice;
    state.deferredPrompt = null;
    dom.installHint.textContent = "安装指令已发出。完成后可以直接从主屏幕打开它。";
    return;
  }

  dom.installHint.textContent = "如果你在 iPhone Safari 上，请点“分享”再选“添加到主屏幕”。";
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

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible" && state.wakeLockRequested && state.wakeLock === null && "wakeLock" in navigator) {
    try {
      state.wakeLock = await navigator.wakeLock.request("screen");
      updateWakeLockUI();
    } catch {
      dom.wakeLockHint.textContent = "页面回到前台后未能恢复常亮保护，可以手动再开启一次。";
    }
  }
});

dom.startButton.addEventListener("click", startSession);
dom.pauseButton.addEventListener("click", pauseSession);
dom.resetButton.addEventListener("click", resetSession);
dom.themeToggle.addEventListener("click", toggleTheme);
dom.wakeLockButton.addEventListener("click", toggleWakeLock);
dom.installButton.addEventListener("click", handleInstall);
dom.savePresetButton.addEventListener("click", saveCurrentPreset);
dom.presetList.addEventListener("click", handlePresetClick);

[
  dom.inhaleInput,
  dom.holdInInput,
  dom.exhaleInput,
  dom.holdOutInput,
  dom.durationInput
].forEach((input) => {
  input.addEventListener("change", () => {
    updateShapePreview();
    resetSession();
  });
});

populateSelectOptions();
initializeTheme();
loadPresets();
initializeAppShell();
setupInstallPrompt();
registerServiceWorker();
updateShapePreview();
resetSession();

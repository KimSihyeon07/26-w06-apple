const GRID_SIZE = 8;
const APPLE_COUNT = GRID_SIZE * GRID_SIZE;
const TARGET_SUM = 10;
const ROUND_SECONDS = 60;
const BEST_SCORE_KEY = "apple-ten-best-score";

const boardElement = document.querySelector("#board");
const startButton = document.querySelector("#start-button");
const timerElement = document.querySelector("#timer");
const timerFill = document.querySelector("#timer-fill");
const timerPanel = document.querySelector("#timer-panel");
const scoreElement = document.querySelector("#score");
const bestScoreElement = document.querySelector("#best-score");
const selectionValueElement = document.querySelector("#selection-value");
const feedbackElement = document.querySelector("#feedback");
const gameOverElement = document.querySelector("#game-over");
const finalScoreElement = document.querySelector("#final-score");

let apples = [];
let score = 0;
let bestScore = readBestScore();
let secondsLeft = ROUND_SECONDS;
let gameState = "ready";
let timerId = null;
let isDragging = false;
let invalidSelection = false;
let activePointerId = null;
let selectedIndices = [];
let selectedTotal = 0;

function randomApple() {
  return Math.floor(Math.random() * 9) + 1;
}

function readBestScore() {
  try {
    return Number.parseInt(localStorage.getItem(BEST_SCORE_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

function saveBestScore() {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
  } catch {
    feedbackElement.textContent = "최고 점수를 이 브라우저에 저장할 수 없습니다.";
  }
}

function renderBoard() {
  const fragment = document.createDocumentFragment();

  apples.forEach((value, index) => {
    const cell = document.createElement("button");
    cell.className = "apple-cell";
    cell.type = "button";
    cell.dataset.index = String(index);
    cell.setAttribute("aria-label", `숫자 사과 ${value}`);
    cell.tabIndex = -1;
    cell.textContent = String(value);
    fragment.append(cell);
  });

  boardElement.replaceChildren(fragment);
}

function updateBoardMode() {
  const isPlaying = gameState === "playing";
  boardElement.classList.toggle("is-disabled", !isPlaying);
  boardElement.setAttribute("aria-disabled", String(!isPlaying));
}

function updateScore() {
  scoreElement.textContent = String(score);
  bestScoreElement.textContent = String(bestScore);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function updateTimer() {
  timerElement.textContent = formatTime(secondsLeft);
  timerFill.style.width = `${(secondsLeft / ROUND_SECONDS) * 100}%`;
  timerPanel.classList.toggle("is-urgent", secondsLeft <= 10);
}

function updateSelection() {
  const selectedSet = new Set(selectedIndices);

  boardElement.querySelectorAll(".apple-cell").forEach((cell) => {
    const index = Number(cell.dataset.index);
    cell.classList.toggle("is-selected", selectedSet.has(index));
    cell.classList.toggle("is-valid", selectedSet.has(index) && selectedTotal === TARGET_SUM && !invalidSelection);
    cell.classList.toggle("is-invalid", selectedSet.has(index) && invalidSelection);
  });

  selectionValueElement.textContent = String(selectedTotal);
}

function clearSelection(message = "") {
  isDragging = false;
  invalidSelection = false;
  activePointerId = null;
  selectedIndices = [];
  selectedTotal = 0;
  updateSelection();
  feedbackElement.textContent = message;
}

function beginSelection(index, pointerId) {
  isDragging = true;
  invalidSelection = false;
  activePointerId = pointerId;
  selectedIndices = [index];
  selectedTotal = apples[index];
  feedbackElement.textContent = "";
  updateSelection();
}

function addToSelection(index) {
  if (!isDragging || invalidSelection || selectedIndices.includes(index)) {
    return;
  }

  const previousIndex = selectedIndices[selectedIndices.length - 1];
  const previousRow = Math.floor(previousIndex / GRID_SIZE);
  const previousColumn = previousIndex % GRID_SIZE;
  const row = Math.floor(index / GRID_SIZE);
  const column = index % GRID_SIZE;
  const distance = Math.abs(row - previousRow) + Math.abs(column - previousColumn);
  const isAdjacent = distance === 1;

  if (!isAdjacent) {
    return;
  }

  selectedIndices.push(index);
  selectedTotal += apples[index];

  if (selectedTotal > TARGET_SUM) {
    invalidSelection = true;
    feedbackElement.textContent = "합계 초과";
  } else if (selectedTotal === TARGET_SUM) {
    feedbackElement.textContent = "획득!";
  } else {
    feedbackElement.textContent = "";
  }

  updateSelection();
}

function finishSelection() {
  if (!isDragging) {
    return;
  }

  const wasValid = !invalidSelection && selectedTotal === TARGET_SUM;
  const collectedIndices = [...selectedIndices];
  const collectedCount = collectedIndices.length;
  isDragging = false;
  activePointerId = null;

  if (wasValid) {
    collectedIndices.forEach((index) => {
      apples[index] = randomApple();
    });
    score += collectedCount;

    if (score > bestScore) {
      bestScore = score;
      saveBestScore();
    }

    updateScore();
    renderBoard();
    selectedIndices = [];
    selectedTotal = 0;
    updateSelection();
    feedbackElement.textContent = `+${collectedCount}점`;
    return;
  }

  clearSelection(invalidSelection ? "합계 초과" : "");
}

function endGame() {
  window.clearInterval(timerId);
  timerId = null;
  secondsLeft = 0;
  gameState = "ended";
  clearSelection();
  updateTimer();
  updateBoardMode();
  finalScoreElement.textContent = String(score);
  gameOverElement.hidden = false;
  startButton.textContent = "다시 하기";
}

function startGame() {
  window.clearInterval(timerId);
  apples = Array.from({ length: APPLE_COUNT }, randomApple);
  score = 0;
  secondsLeft = ROUND_SECONDS;
  gameState = "playing";
  gameOverElement.hidden = true;
  feedbackElement.textContent = "";
  startButton.textContent = "다시 시작";
  updateScore();
  updateTimer();
  updateBoardMode();
  renderBoard();
  clearSelection();

  timerId = window.setInterval(() => {
    secondsLeft -= 1;
    updateTimer();
    if (secondsLeft <= 0) {
      endGame();
    }
  }, 1000);
}

boardElement.addEventListener("pointerdown", (event) => {
  if (gameState !== "playing" || event.button > 0) {
    return;
  }

  const cell = event.target.closest(".apple-cell");
  if (!cell) {
    return;
  }

  event.preventDefault();
  beginSelection(Number(cell.dataset.index), event.pointerId);
});

boardElement.addEventListener("pointermove", (event) => {
  if (!isDragging || event.pointerId !== activePointerId) {
    return;
  }

  const element = document.elementFromPoint(event.clientX, event.clientY);
  const cell = element?.closest(".apple-cell");
  if (cell && boardElement.contains(cell)) {
    addToSelection(Number(cell.dataset.index));
  }
});

document.addEventListener("pointerup", (event) => {
  if (event.pointerId === activePointerId) {
    finishSelection();
  }
});

document.addEventListener("pointercancel", (event) => {
  if (event.pointerId === activePointerId) {
    clearSelection();
  }
});

startButton.addEventListener("click", startGame);

apples = Array.from({ length: APPLE_COUNT }, randomApple);
renderBoard();
updateScore();
updateTimer();
updateBoardMode();
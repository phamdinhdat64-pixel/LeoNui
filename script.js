/**
 * LEO ĐỈNH BÀN CỜ (PEAK CLIMBER) — PHIÊN BẢN MẠNG ESP32 MULTIPLAYER
 * - ESP32 SoftAP Wi-Fi "BOARD GAME", WebSocket /ws
 * - Thiết bị đầu tiên: HOST (Điều hành trận đấu, quan sát bàn cờ 50 ô, pháo hoa)
 * - Thiết bị kết nối sau: NGƯỜI CHƠI (Tung xúc xắc trên điện thoại khi đến lượt)
 * - Cơ chế: Đường Đi Tắt (17 ➔ 24, 37 ➔ 42) & Đường Trượt Lùi (47 ➔ 32, 29 ➔ 11)
 * - Xúc xắc 3D nhào lộn, 5 tầng đèo Sơn Trà, hoạt ảnh thiên nhiên mây & chim hải âu
 */

// ==========================================================================
// 1. Cấu Trúc Bàn Cờ 50 Ô & Bản Đồ Lối Tắt / Trượt Dốc (Shortcuts & Traps)
// ==========================================================================
const BOARD_LENGTH = 50;

// specialPaths: { 17: 24, 37: 42, 47: 32, 29: 11 }
// Chỉ kích hoạt khi người chơi dừng lại ĐÚNG tại các ô này khi kết thúc lượt tung xúc xắc
const SPECIAL_PATHS = {
    17: 24, // Lối tắt leo núi (Tiến lên)
    37: 42, // Lối tắt leo núi (Tiến lên)
    47: 32, // Trượt chân dốc đá (Tụt xuống)
    29: 11  // Trượt chân dốc đá (Tụt xuống)
};

// ==========================================================================
// 2. Hệ Thống Âm Thanh Web Audio Tự Tổng Hợp
// ==========================================================================
let audioCtx = null;
let soundEnabled = true;

function initAudio() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

const AudioSFX = {
    playRoll() {
        if (!soundEnabled || !audioCtx) return;
        const now = audioCtx.currentTime;
        for (let i = 0; i < 10; i++) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(240 + Math.random() * 320, now + i * 0.055);
            gain.gain.setValueAtTime(0.14, now + i * 0.055);
            gain.gain.exponentialRampToValueAtTime(0.01, now + (i + 1) * 0.055);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now + i * 0.055);
            osc.stop(now + (i + 1) * 0.055);
        }
    },

    playDiceImpact() {
        if (!soundEnabled || !audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(45, now + 0.1);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
    },

    playStep() {
        if (!soundEnabled || !audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
    },

    playCorrect() {
        if (!soundEnabled || !audioCtx) return;
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, i) => {
            const now = audioCtx.currentTime + i * 0.09;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.14);
        });
    },

    playWrong() {
        if (!soundEnabled || !audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(70, now + 0.35);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
    },

    playVictory() {
        if (!soundEnabled || !audioCtx) return;
        const notes = [440, 440, 440, 587.33, 659.25, 880];
        notes.forEach((freq, i) => {
            const now = audioCtx.currentTime + i * 0.14;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.22);
        });
    }
};

// ==========================================================================
// 3. Trạng Thái Toàn Cục (GameState) & Cấu Hình Mặc Định (6 Nhân Vật)
// ==========================================================================
const CHARACTER_ROSTER = [
    { id: 'wizard', name: 'Phù Thủy', icon: '🧙‍♂️', color: '#a855f7', desc: 'Bậc thầy pháp thuật huyền bí' },
    { id: 'knight', name: 'Hiệp Sĩ', icon: '⚔️', color: '#3b82f6', desc: 'Chiến binh quả cảm kiên định' },
    { id: 'assassin', name: 'Sát Thủ', icon: '🥷', color: '#ef4444', desc: 'Bóng ma xuất quỷ nhập thần' },
    { id: 'priest', name: 'Linh Mục', icon: '🕊️', color: '#eab308', desc: 'Sứ giả ánh sáng ban phước' },
    { id: 'king', name: 'Vua', icon: '👑', color: '#f97316', desc: 'Chúa tể uy nghiêm đỉnh núi' },
    { id: 'archer', name: 'Cung Thủ', icon: '🏹', color: '#10b981', desc: 'Xạ thủ bách phát bách trúng' }
];

const DEFAULT_PRESETS = CHARACTER_ROSTER.map((c, idx) => ({
    name: c.name,
    color: c.color,
    avatarIcon: c.icon,
    charId: c.id,
    isBot: idx > 0
}));

let gameState = {
    players: [],
    currentRound: 1,
    turnOrder: [],
    currentTurnIndex: 0,
    activePlayerId: null,
    phase: 'SETUP',
    lastDiceRoll: null,
    isAnimatingMove: false,
    winner: null
};

// Quyền hạn và danh tính mạng
let isHost = true;
let myPlayerId = null;
let currentHostIp = '';
let socket = null;
let currentBootId = null;
let lastPong = Date.now();
let reconnectTimer = null;
const storageKey = 'frameworkDeviceId';

// ==========================================================================
// 4. Cache DOM Elements
// ==========================================================================
const dom = {
    boardContainer: document.getElementById('boardContainer'),
    boardCameraWrapper: document.getElementById('boardCameraWrapper'),
    canvas: document.getElementById('boardCanvas'),
    specialPathsSvg: document.getElementById('specialPathsSvg'),
    svgPathsGroup: document.getElementById('svgPathsGroup'),
    boardTierBadgeText: document.getElementById('boardTierBadgeText'),
    btnToggleCamera: document.getElementById('btnToggleCamera'),
    btnToggleCameraIcon: document.getElementById('btnToggleCameraIcon'),
    btnToggleCameraText: document.getElementById('btnToggleCameraText'),
    btnCameraZoomIn: document.getElementById('btnCameraZoomIn'),
    btnCameraZoomOut: document.getElementById('btnCameraZoomOut'),
    currentRoundDisplay: document.getElementById('currentRoundDisplay'),
    turnOrderList: document.getElementById('turnOrderList'),
    gameBanner: document.getElementById('gameBanner'),
    bannerText: document.getElementById('bannerText'),

    // Role badge & settings
    roleBadge: document.getElementById('roleBadge'),
    roleIcon: document.getElementById('roleIcon'),
    roleBadgeText: document.getElementById('roleBadgeText'),
    btnSettings: document.getElementById('btnSettings'),
    settingsModal: document.getElementById('settingsModal'),
    settingsRoleText: document.getElementById('settingsRoleText'),
    settingsHostIp: document.getElementById('settingsHostIp'),
    hostIpBox: document.getElementById('hostIpBox'),
    claimHostBox: document.getElementById('claimHostBox'),
    inputClaimIp: document.getElementById('inputClaimIp'),
    btnClaimHost: document.getElementById('btnClaimHost'),
    btnCloseSettings: document.getElementById('btnCloseSettings'),

    // Control Sidebar
    activePlayerAvatar: document.getElementById('activePlayerAvatar'),
    activePlayerName: document.getElementById('activePlayerName'),
    activePlayerPos: document.getElementById('activePlayerPos'),
    activePlayerNextMilestone: document.getElementById('activePlayerNextMilestone'),
    btnRollDice: document.getElementById('btnRollDice'),
    turnStatusLabel: document.getElementById('turnStatusLabel'),
    playerProgressList: document.getElementById('playerProgressList'),
    logContent: document.getElementById('logContent'),

    // True 3D Cube Dice Roll Overlay
    diceOverlay: document.getElementById('diceOverlay'),
    dicePlayerPill: document.getElementById('dicePlayerPill'),
    dicePlayerDot: document.getElementById('dicePlayerDot'),
    dicePlayerName: document.getElementById('dicePlayerName'),
    diceActionTitle: document.getElementById('diceActionTitle'),
    diceScene: document.getElementById('diceScene'),
    diceBouncer: document.getElementById('diceBouncer'),
    diceCube: document.getElementById('diceCube'),
    diceGroundShadow: document.getElementById('diceGroundShadow'),
    diceOutcomeBadge: document.getElementById('diceOutcomeBadge'),
    diceOutcomeText: document.getElementById('diceOutcomeText'),

    // Top action buttons
    btnSound: document.getElementById('btnSound'),
    soundIcon: document.getElementById('soundIcon'),
    btnRules: document.getElementById('btnRules'),
    btnRestart: document.getElementById('btnRestart'),

    // Setup & Lobby Modal
    setupModal: document.getElementById('setupModal'),
    lobbyRoleBadge: document.getElementById('lobbyRoleBadge'),
    lobbyModalDesc: document.getElementById('lobbyModalDesc'),
    hostSetupView: document.getElementById('hostSetupView'),
    playerCountGroup: document.getElementById('playerCountGroup'),
    playerInputsContainer: document.getElementById('playerInputsContainer'),
    btnStartGame: document.getElementById('btnStartGame'),

    // Player waiting lobby
    playerWaitingView: document.getElementById('playerWaitingView'),
    myIdentityPill: document.getElementById('myIdentityPill'),
    myPlayerAvatar: document.getElementById('myPlayerAvatar'),
    myPlayerSlotName: document.getElementById('myPlayerSlotName'),
    inputMyCustomName: document.getElementById('inputMyCustomName'),
    btnSaveMyName: document.getElementById('btnSaveMyName'),
    playerWaitingText: document.getElementById('playerWaitingText'),
    lobbyPlayersList: document.getElementById('lobbyPlayersList'),

    // Victory Modal
    victoryModal: document.getElementById('victoryModal'),
    winnerSubtitle: document.getElementById('winnerSubtitle'),
    victoryStatsContainer: document.getElementById('victoryStatsContainer'),
    btnPlayAgain: document.getElementById('btnPlayAgain'),

    // Rules Modal
    rulesModal: document.getElementById('rulesModal'),
    btnCloseRules: document.getElementById('btnCloseRules'),

    // Round Minigame Leaderboard Modal
    roundLeaderboardModal: document.getElementById('roundLeaderboardModal'),
    leaderboardRankingList: document.getElementById('leaderboardRankingList'),
    btnContinueRound: document.getElementById('btnContinueRound'),

    // Character Selection Modal & Guest Grid
    guestCharacterGrid: document.getElementById('guestCharacterGrid'),
    characterSelectModal: document.getElementById('characterSelectModal'),
    modalCharacterGrid: document.getElementById('modalCharacterGrid'),
    characterSelectTitle: document.getElementById('characterSelectTitle'),
    btnCloseCharacterModal: document.getElementById('btnCloseCharacterModal')
};

const ctx = dom.canvas.getContext('2d');
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 600;
dom.canvas.width = CANVAS_WIDTH;
dom.canvas.height = CANVAS_HEIGHT;

function resizeBoardCanvas() {
    const wrapper = dom.boardCameraWrapper || dom.canvas;
    const clientW = wrapper.clientWidth || (dom.canvas.getBoundingClientRect() && dom.canvas.getBoundingClientRect().width);
    if (!clientW) return;

    const pixelRatio = window.devicePixelRatio || 1;
    const renderScale = Math.min(4.5, Math.max(2.4, pixelRatio * 2.2));
    const width = Math.round(clientW * renderScale);
    const height = Math.round(clientW * (CANVAS_HEIGHT / CANVAS_WIDTH) * renderScale);
    if (dom.canvas.width !== width || dom.canvas.height !== height) {
        dom.canvas.width = width;
        dom.canvas.height = height;
    }
    ctx.setTransform(width / CANVAS_WIDTH, 0, 0, height / CANVAS_HEIGHT, 0, 0);

    // Vẽ lại đường SVG theo kích thước khung bàn cờ
    renderSpecialPathsSvg();
}

window.addEventListener('resize', resizeBoardCanvas);
window.addEventListener('orientationchange', resizeBoardCanvas);

// ==========================================================================
// 4b. Hệ Thống Camera Zoom Phóng To Siêu Lớn & Bám Theo Bước Đi Quân Cờ (Action Camera)
// ==========================================================================
const DEFAULT_CAMERA_ZOOM = 3.8;
let currentCameraScale = 3.8;
let isCameraZoomed = true;
let currentTargetCoord = { x: 85, y: 515 };

function getTierByPosition(pos) {
    const idx = Math.max(0, Math.min(BOARD_LENGTH, Math.round(pos)));
    if (TILE_COORDINATES[idx] && typeof TILE_COORDINATES[idx].tier === 'number') {
        return TILE_COORDINATES[idx].tier;
    }
    if (idx <= 10) return 1;
    if (idx <= 20) return 2;
    if (idx <= 30) return 3;
    if (idx <= 40) return 4;
    return 5;
}

function getCameraTransformForCoord(x, y, scale = currentCameraScale) {
    if (!isCameraZoomed || scale <= 1.05) {
        return { x: 0, y: 0, scale: 1.0 };
    }
    // Căn toạ độ ô đường đi (x, y) LUÔN NẰM CHÍNH GIỮA MÀN HÌNH (Dead Center 50% - 50%)
    // Áp dụng công thức tính tỉ lệ phần trăm chuẩn xác tuyệt đối trên mọi độ phân giải (Mobile & Desktop)
    const targetTxPercent = 50 - (x / CANVAS_WIDTH) * scale * 100;
    const targetTyPercent = 50 - (y / CANVAS_HEIGHT) * scale * 100;

    return { x: targetTxPercent, y: targetTyPercent, scale: scale };
}

function updateCamera(smooth = true, durationMs = 400) {
    if (!dom.boardCameraWrapper) return;

    const activeScale = isCameraZoomed ? currentCameraScale : 1.0;
    const trans = getCameraTransformForCoord(currentTargetCoord.x, currentTargetCoord.y, activeScale);

    if (smooth) {
        dom.boardCameraWrapper.style.transition = `transform ${durationMs}ms cubic-bezier(0.25, 1, 0.5, 1)`;
    } else {
        dom.boardCameraWrapper.style.transition = 'none';
    }

    dom.boardCameraWrapper.style.transform = `translate3d(${trans.x}%, ${trans.y}%, 0) scale(${trans.scale})`;

    const scaleFormatted = (Math.round(currentCameraScale * 10) / 10).toFixed(1);
    if (dom.btnToggleCameraText) {
        dom.btnToggleCameraText.textContent = isCameraZoomed ? `ZOOM ${scaleFormatted}x` : 'TOÀN CẢNH';
    }
    if (dom.btnToggleCameraIcon) {
        dom.btnToggleCameraIcon.textContent = isCameraZoomed ? '🔍' : '🗺️';
    }
}

function focusCameraOnPlayer(player, smooth = true, durationMs = 500) {
    if (!player) return;
    const pos = (typeof player.visualPos === 'number') ? player.visualPos : player.position;
    const currentTileIdx = Math.min(BOARD_LENGTH, Math.max(0, Math.round(pos)));
    const coord = player.customCoord || TILE_COORDINATES[currentTileIdx] || TILE_COORDINATES[0];
    currentTargetCoord = { x: coord.x, y: coord.y };

    if (dom.boardTierBadgeText) {
        const tier = getTierByPosition(pos);
        const pName = player.name ? player.name.toUpperCase() : 'NGƯỜI CHƠI';
        dom.boardTierBadgeText.textContent = isCameraZoomed
            ? `🎯 TÂM ĐƯỜNG ĐI: ${pName} (Ô ${Math.round(pos)} · TẦNG ${tier})`
            : `🗺️ TOÀN CẢNH BẢN ĐỒ (50 Ô)`;
    }

    updateCamera(smooth, durationMs);
}

function focusCameraOnCoord(x, y, smooth = true, durationMs = 200) {
    currentTargetCoord = { x, y };
    updateCamera(smooth, durationMs);
}

function setCameraZoom(newScale, smooth = true) {
    if (newScale < 1.05) {
        isCameraZoomed = false;
        currentCameraScale = DEFAULT_CAMERA_ZOOM;
    } else {
        isCameraZoomed = true;
        currentCameraScale = Math.min(5.0, Math.max(1.5, Math.round(newScale * 10) / 10));
    }
    const activePlayer = gameState.players.find(p => p.id === gameState.activePlayerId) || gameState.players[0];
    focusCameraOnPlayer(activePlayer, smooth, 400);
}

function zoomCameraStep(direction) {
    let nextScale;
    if (!isCameraZoomed) {
        isCameraZoomed = true;
        nextScale = (direction > 0) ? (DEFAULT_CAMERA_ZOOM + 0.4) : (DEFAULT_CAMERA_ZOOM - 0.4);
    } else {
        nextScale = currentCameraScale + direction * 0.4;
    }
    setCameraZoom(nextScale, true);
}

function toggleCameraZoom() {
    if (!isCameraZoomed) {
        isCameraZoomed = true;
        currentCameraScale = DEFAULT_CAMERA_ZOOM;
    } else if (currentCameraScale >= 3.4) {
        currentCameraScale = 2.4;
    } else if (currentCameraScale >= 2.0) {
        isCameraZoomed = false;
    } else {
        isCameraZoomed = true;
        currentCameraScale = DEFAULT_CAMERA_ZOOM;
    }
    const activePlayer = gameState.players.find(p => p.id === gameState.activePlayerId) || gameState.players[0];
    focusCameraOnPlayer(activePlayer, true, 500);
}

if (dom.btnToggleCamera) {
    dom.btnToggleCamera.addEventListener('click', toggleCameraZoom);
}
if (dom.btnCameraZoomIn) {
    dom.btnCameraZoomIn.addEventListener('click', () => zoomCameraStep(1));
}
if (dom.btnCameraZoomOut) {
    dom.btnCameraZoomOut.addEventListener('click', () => zoomCameraStep(-1));
}

// Hỗ trợ cuộn chuột lăn để phóng to / thu nhỏ linh hoạt
if (dom.boardContainer) {
    dom.boardContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.3 : -0.3;
        zoomCameraStep(delta);
    }, { passive: false });
}

// ==========================================================================
// 4c. Hoạt Ảnh Toàn Cảnh Mở Màn Trước Khi Zoom Lớn (Cinematic Intro Sequence)
// ==========================================================================
let hasShownIntroOverview = false;
let isIntroOverviewPlaying = false;

function playIntroOverviewSequence(activePlayer, onComplete) {
    if (!activePlayer) {
        if (onComplete) onComplete();
        return;
    }
    isIntroOverviewPlaying = true;
    hasShownIntroOverview = true;

    // 1. Lúc mới bắt đầu ván đấu: Luôn hiển thị TOÀN CẢNH cả bản đồ (50 ô) trước
    isCameraZoomed = false;
    updateCamera(false);

    if (dom.boardTierBadgeText) {
        dom.boardTierBadgeText.textContent = '🗺️ TOÀN CẢNH BẢN ĐỒ (50 Ô)';
    }

    // Tạm khóa nút bấm và hiển thị thông điệp mở màn
    dom.btnRollDice.disabled = true;
    dom.btnRollDice.classList.remove('pulse-active');
    dom.btnRollDice.querySelector('.roll-text').textContent = '🗺️ QUAN SÁT TOÀN CẢNH BẢN ĐỒ...';
    dom.turnStatusLabel.textContent = '🗺️ TOÀN CẢNH ĐÈO SƠN TRÀ';
    showBanner('CHINH PHỤC ĐỈNH BÀN CỜ • 50 Ô');

    // 2. Cho người chơi quan sát trọn vẹn cả bản đồ trong 1.6 giây, sau đó mới phóng to vào vị trí người chơi
    setTimeout(() => {
        if (gameState.phase === 'SETUP' || gameState.winner) {
            isIntroOverviewPlaying = false;
            return;
        }

        AudioSFX.playCorrect();
        isCameraZoomed = true;
        currentCameraScale = DEFAULT_CAMERA_ZOOM;
        focusCameraOnPlayer(activePlayer, true, 950);

        setTimeout(() => {
            isIntroOverviewPlaying = false;
            if (onComplete) onComplete();
        }, 750);
    }, 1600);
}

function updateTurnButtons(activePlayer) {
    if (!activePlayer) return;
    const isMyTurn = (activePlayer.id === myPlayerId);
    const isBotTurn = activePlayer.isBot;

    if (gameState.phase === 'WAITING_ROLL') {
        if (isMyTurn) {
            dom.btnRollDice.disabled = false;
            dom.btnRollDice.classList.add('pulse-active');
            dom.btnRollDice.querySelector('.roll-text').textContent = '🎲 ĐẾN LƯỢT BẠN! TUNG XÚC XẮC';
            dom.turnStatusLabel.textContent = '🌟 LƯỢT CỦA BẠN!';
        } else if (isHost) {
            dom.btnRollDice.classList.remove('pulse-active');
            dom.btnRollDice.disabled = !isBotTurn;
            dom.btnRollDice.querySelector('.roll-text').textContent = isBotTurn
                ? `🤖 TUNG CHO ${activePlayer.name.toUpperCase()}`
                : `ĐANG CHỜ ${activePlayer.name.toUpperCase()} TUNG...`;
            dom.turnStatusLabel.textContent = `LƯỢT CỦA: ${activePlayer.name.toUpperCase()}`;
        } else {
            dom.btnRollDice.classList.remove('pulse-active');
            dom.btnRollDice.disabled = true;
            dom.btnRollDice.querySelector('.roll-text').textContent = `ĐANG CHỜ ${activePlayer.name.toUpperCase()} TUNG...`;
            dom.turnStatusLabel.textContent = `LƯỢT CỦA: ${activePlayer.name.toUpperCase()}`;
        }
    } else if (gameState.phase === 'MINIGAME') {
        dom.btnRollDice.disabled = true;
        dom.btnRollDice.classList.remove('pulse-active');
        dom.btnRollDice.querySelector('.roll-text').textContent = '🎮 ĐANG THI ĐẤU MINIGAME...';
        dom.turnStatusLabel.textContent = `MINIGAME: ${activePlayer.name.toUpperCase()}`;
        if (!gameState.isAnimatingMove) {
            checkAndTriggerMinigameForActivePlayer(activePlayer);
        }
    } else {
        dom.btnRollDice.disabled = true;
        dom.btnRollDice.classList.remove('pulse-active');
    }
}

// ==========================================================================
// 5. Toạ Độ Bàn Cờ 50 Ô Ziczac 5 Tầng Đèo Sơn Trà (Mỗi tầng 10 ô - 900x600)
// ==========================================================================
const SONTRA_TIERS = [
    { tier: 1, name: "TẦNG 1: CHÂN NÚI SƠN TRÀ • BÃI BỤT (Ô 0 ➔ 10)", startIdx: 0, endIdx: 10, y: 515 },
    { tier: 2, name: "TẦNG 2: ĐÈO LINH ỨNG TỰ (Ô 11 ➔ 20)", startIdx: 11, endIdx: 20, y: 425 },
    { tier: 3, name: "TẦNG 3: ĐÈO CÂY ĐA DI SẢN NGÀN NĂM (Ô 21 ➔ 30)", startIdx: 21, endIdx: 30, y: 335 },
    { tier: 4, name: "TẦNG 4: TRẠM RA-ĐA MẮT THẦN ĐÔNG DƯƠNG (Ô 31 ➔ 40)", startIdx: 31, endIdx: 40, y: 245 },
    { tier: 5, name: "TẦNG 5: ĐỈNH BÀN CỜ • TIÊN ÔNG ĐÁNH CỜ (Ô 41 ➔ 50)", startIdx: 41, endIdx: 50, y: 140 }
];

const TILE_COORDINATES = [];

function generateBoardPath() {
    TILE_COORDINATES.length = 0;
    const marginX = 85;
    const usableWidth = CANVAS_WIDTH - marginX * 2;

    for (let i = 0; i <= 10; i++) {
        const x = marginX + (i / 10) * usableWidth;
        TILE_COORDINATES.push({ index: i, x, y: 515, tier: 1 });
    }
    for (let i = 11; i <= 20; i++) {
        const frac = 1 - ((i - 10) / 10);
        const x = marginX + frac * usableWidth;
        TILE_COORDINATES.push({ index: i, x, y: 425, tier: 2 });
    }
    for (let i = 21; i <= 30; i++) {
        const frac = (i - 20) / 10;
        const x = marginX + frac * usableWidth;
        TILE_COORDINATES.push({ index: i, x, y: 335, tier: 3 });
    }
    for (let i = 31; i <= 40; i++) {
        const frac = 1 - ((i - 30) / 10);
        const x = marginX + frac * usableWidth;
        TILE_COORDINATES.push({ index: i, x, y: 245, tier: 4 });
    }
    for (let i = 41; i <= 50; i++) {
        const frac = (i - 40) / 10;
        const x = marginX + frac * usableWidth;
        TILE_COORDINATES.push({ index: i, x, y: 140, tier: 5 });
    }
}
generateBoardPath();

// ==========================================================================
// 5b. Vẽ Lớp Đường Nối SVG Bán Trong Suốt (Lối Tắt Xanh & Trượt Lùi Đỏ)
// ==========================================================================
function renderSpecialPathsSvg() {
    const svgGroup = dom.svgPathsGroup || document.getElementById('svgPathsGroup');
    if (!svgGroup) return;
    svgGroup.innerHTML = '';

    const pathsConfig = [
        {
            from: 17,
            to: 24,
            type: 'shortcut',
            color: 'rgba(134, 239, 172, 0.45)',
            arrowColor: 'rgba(134, 239, 172, 0.95)',
            filter: 'url(#pathBlurGreen)',
            accentClass: 'special-path-accent-shortcut'
        },
        {
            from: 37,
            to: 42,
            type: 'shortcut',
            color: 'rgba(134, 239, 172, 0.45)',
            arrowColor: 'rgba(134, 239, 172, 0.95)',
            filter: 'url(#pathBlurGreen)',
            accentClass: 'special-path-accent-shortcut'
        },
        {
            from: 47,
            to: 32,
            type: 'trap',
            color: 'rgba(248, 113, 113, 0.55)',
            arrowColor: 'rgba(248, 113, 113, 0.95)',
            filter: 'url(#pathBlurRed)',
            accentClass: 'special-path-accent-trap'
        },
        {
            from: 29,
            to: 11,
            type: 'trap',
            color: 'rgba(248, 113, 113, 0.55)',
            arrowColor: 'rgba(248, 113, 113, 0.95)',
            filter: 'url(#pathBlurRed)',
            accentClass: 'special-path-accent-trap'
        }
    ];

    pathsConfig.forEach(p => {
        const c1 = TILE_COORDINATES[p.from];
        const c2 = TILE_COORDINATES[p.to];
        if (!c1 || !c2) return;

        // Góc xoay hướng di chuyển từ điểm đầu đến điểm đích
        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const angle = Math.atan2(dy, dx);
        const angleDeg = angle * 180 / Math.PI;

        // Cắt đường nối chính xác từ mép vòng tròn ô xuất phát đến mép ô đích (bán kính ô ~15px)
        const r1 = 15;
        const r2 = 17;
        const x1 = c1.x + r1 * Math.cos(angle);
        const y1 = c1.y + r1 * Math.sin(angle);
        const x2 = c2.x - r2 * Math.cos(angle);
        const y2 = c2.y - r2 * Math.sin(angle);

        // Khắc phục triệt để lỗi SVG: khi đường thẳng đứng tuyệt đối (x1 == x2), bounding box = 0
        const safeX2 = (Math.abs(x2 - x1) < 0.05) ? (x1 + 0.05) : x2;

        // 1. Đường nền bán trong suốt: dày 14px, bo tròn 2 đầu, blur nhẹ 1.5px
        const baseLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        baseLine.setAttribute('x1', x1);
        baseLine.setAttribute('y1', y1);
        baseLine.setAttribute('x2', safeX2);
        baseLine.setAttribute('y2', y2);
        baseLine.setAttribute('stroke', p.color);
        baseLine.setAttribute('stroke-width', '14');
        baseLine.setAttribute('stroke-linecap', 'round');
        baseLine.setAttribute('filter', p.filter);
        baseLine.setAttribute('class', 'special-path-line');
        svgGroup.appendChild(baseLine);

        // 2. Đường nét đứt màu trắng chuyển động theo hướng di chuyển
        const accentLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        accentLine.setAttribute('x1', x1);
        accentLine.setAttribute('y1', y1);
        accentLine.setAttribute('x2', safeX2);
        accentLine.setAttribute('y2', y2);
        accentLine.setAttribute('class', p.accentClass);
        svgGroup.appendChild(accentLine);

        // 3. Mũi tên chỉ hướng dạng Polygon sắc nét đặt tại điểm đích
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('points', '0,0 -14,-7 -10,0 -14,7');
        arrow.setAttribute('fill', p.arrowColor);
        arrow.setAttribute('transform', `translate(${x2}, ${y2}) rotate(${angleDeg})`);
        svgGroup.appendChild(arrow);

        // 4. Vòng tròn viền nhẹ ở điểm đầu để người chơi dễ nhận biết
        const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        ring.setAttribute('cx', c1.x);
        ring.setAttribute('cy', c1.y);
        ring.setAttribute('r', '18');
        ring.setAttribute('fill', 'none');
        ring.setAttribute('stroke', p.arrowColor);
        ring.setAttribute('stroke-width', '2.5');
        ring.setAttribute('stroke-dasharray', '4 3');
        svgGroup.appendChild(ring);
    });
}

// ==========================================================================
// 6. Quản Lý Thiết Bị & Kết Nối WebSocket Với ESP32
// ==========================================================================
function getDeviceId() {
    let value = null;
    try { value = localStorage.getItem(storageKey); } catch (_) {}
    if (/^device-[A-Za-z0-9_-]{16,64}$/.test(value || '')) {
        return value;
    }
    const bytes = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(bytes);
    } else {
        for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    value = 'device-' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    try { localStorage.setItem(storageKey, value); } catch (_) {}
    return value;
}

function sendWs(data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    }
}

function updateRoleUI() {
    if (isHost) {
        dom.roleBadge.classList.remove('player');
        dom.roleIcon.textContent = '👑';
        dom.roleBadgeText.textContent = 'HOST (ĐIỀU HÀNH)';
        dom.lobbyRoleBadge.textContent = '👑 PHÒNG HOST · QUAN SÁT & ĐIỀU HÀNH';
        dom.lobbyModalDesc.textContent = 'Bạn là Host điều hành trận đấu. Hãy chọn số người chơi, cấu hình bot nếu cần và bấm BẮT ĐẦU VÁN ĐẤU!';
        dom.hostSetupView.classList.remove('hidden');
        dom.playerWaitingView.classList.add('hidden');
        dom.btnRestart.classList.remove('hidden');

        dom.settingsRoleText.textContent = 'Host (Điều hành & Quan sát)';
        dom.settingsHostIp.textContent = currentHostIp || '192.168.4.2';
        dom.hostIpBox.classList.remove('hidden');
        dom.claimHostBox.classList.add('hidden');
    } else {
        dom.roleBadge.classList.add('player');
        dom.roleIcon.textContent = '📱';
        const myP = gameState.players.find(p => p.id === myPlayerId);
        dom.roleBadgeText.textContent = myP ? `BẠN: ${myP.name}` : 'NGƯỜI CHƠI';
        dom.lobbyRoleBadge.textContent = '📱 PHÒNG CHỜ NGƯỜI CHƠI';
        dom.lobbyModalDesc.textContent = 'Bạn đang tham gia ván đấu trên mạng ESP32. Hãy chuẩn bị tung xúc xắc khi đến lượt!';
        dom.hostSetupView.classList.add('hidden');
        dom.playerWaitingView.classList.remove('hidden');
        dom.btnRestart.classList.add('hidden');

        dom.settingsRoleText.textContent = 'Người chơi (Guest)';
        dom.hostIpBox.classList.add('hidden');
        dom.claimHostBox.classList.remove('hidden');
    }
}

function connectWs() {
    if (!window.WebSocket) return;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = location.host || '192.168.4.1';
    const ws = new WebSocket(`${protocol}//${host}/ws`);
    socket = ws;

    ws.onopen = () => {
        if (socket !== ws) return;
        lastPong = Date.now();
        addGameLog('🌐 <em>Đã kết nối thành công mạng ESP32 BOARD GAME.</em>');
    };

    ws.onmessage = (event) => {
        if (socket !== ws) return;
        let msg;
        try { msg = JSON.parse(event.data); } catch (_) { return; }
        handleWsMessage(msg);
    };

    ws.onclose = () => {
        if (socket !== ws) return;
        socket = null;
        if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;
                connectWs();
            }, 1200);
        }
    };

    ws.onerror = () => {
        if (socket === ws) ws.close();
    };
}

function handleWsMessage(msg) {
    if (!msg || typeof msg !== 'object') return;

    if (msg.t === 'session') {
        currentBootId = msg.bootId;
        sendWs({ t: 'hello', deviceId: getDeviceId(), bootId: currentBootId });
    } else if (msg.t === 'identity') {
        isHost = (msg.role === 'HOST' && msg.host === true);
        if (msg.hostIp) currentHostIp = msg.hostIp;
        updateRoleUI();
    } else if (msg.t === 'pong') {
        lastPong = Date.now();
    } else if (msg.t === 'game_state') {
        onGameStateReceived(msg);
    } else if (msg.t === 'dice_roll') {
        onDiceRollReceived(msg);
    } else if (msg.t === 'minigame_result') {
        onMinigameResultReceived(msg);
    }
}

// Giữ kết nối Ping định kỳ 2s
setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
        if (Date.now() - lastPong > 9000) {
            socket.close();
            return;
        }
        sendWs({ t: 'ping' });
    }
}, 2000);

// ==========================================================================
// 7. Đồng Bộ Trạng Thái Game Từ ESP32 (Lobby, Lượt, Xúc Xắc)
// ==========================================================================
let currentSelectedCount = 2;

function syncPlayerCount(count) {
    currentSelectedCount = Math.max(2, Math.min(6, count));
    // Dọn dẹp DOM token cũ
    document.querySelectorAll('.player-token').forEach(el => el.remove());
    // Cắt bớt nếu số lượng quân cờ đang nhiều hơn
    gameState.players = gameState.players.slice(0, currentSelectedCount);
    // Thêm vào nếu thiếu quân cờ
    while (gameState.players.length < currentSelectedCount) {
        const i = gameState.players.length;
        const preset = DEFAULT_PRESETS[i];
        gameState.players.push({
            id: `player_${i + 1}`,
            name: preset.name,
            color: preset.color,
            avatarIcon: preset.avatarIcon,
            position: 0,
            visualPos: 0,
            isBot: preset.isBot,
            connected: false,
            stats: { totalRolls: 0 },
            minigameScore: 0,
            totalMinigameScore: 0
        });
    }
    gameState.turnOrder = gameState.players.map(p => p.id);
    renderSetupInputs(currentSelectedCount);
    renderTokens();
}

let targetCharacterSlotIndex = null;

function openCharacterSelectModal(slotIndex = null) {
    targetCharacterSlotIndex = slotIndex;
    if (dom.characterSelectTitle) {
        if (slotIndex !== null) {
            dom.characterSelectTitle.textContent = `CHỌN NHÂN VẬT (VỊ TRÍ ${slotIndex + 1})`;
        } else {
            dom.characterSelectTitle.textContent = 'CHỌN NHÂN VẬT CỦA BẠN';
        }
    }
    renderModalCharacterGrid();
    if (dom.characterSelectModal) {
        dom.characterSelectModal.classList.remove('hidden');
    }
}

function closeCharacterSelectModal() {
    if (dom.characterSelectModal) {
        dom.characterSelectModal.classList.add('hidden');
    }
    targetCharacterSlotIndex = null;
}

if (dom.btnCloseCharacterModal) {
    dom.btnCloseCharacterModal.addEventListener('click', closeCharacterSelectModal);
}

function renderModalCharacterGrid() {
    if (!dom.modalCharacterGrid) return;
    dom.modalCharacterGrid.innerHTML = '';

    let currentAvatar = '';
    let currentColor = '';
    if (targetCharacterSlotIndex !== null) {
        const p = gameState.players[targetCharacterSlotIndex] || DEFAULT_PRESETS[targetCharacterSlotIndex];
        currentAvatar = p?.avatarIcon;
        currentColor = p?.color;
    } else {
        const myP = gameState.players.find(p => p.id === myPlayerId);
        currentAvatar = myP?.avatarIcon;
        currentColor = myP?.color;
    }

    CHARACTER_ROSTER.forEach(char => {
        const card = document.createElement('div');
        const isSelected = (currentAvatar === char.icon || currentColor === char.color);
        card.className = `character-card ${isSelected ? 'selected' : ''}`;
        card.style.setProperty('--char-color', char.color);
        card.innerHTML = `
            <span class="char-card-badge">✅</span>
            <div class="char-card-icon">${char.icon}</div>
            <div class="char-card-name" style="color: ${char.color};">${char.name}</div>
            <div class="char-card-desc">${char.desc}</div>
        `;

        card.addEventListener('click', () => {
            selectCharacter(char, targetCharacterSlotIndex);
            closeCharacterSelectModal();
        });

        dom.modalCharacterGrid.appendChild(card);
    });
}

function selectCharacter(char, slotIndex = null) {
    if (slotIndex !== null) {
        // Host chọn nhân vật cho slot `slotIndex`
        const p = gameState.players[slotIndex];
        if (p) {
            p.avatarIcon = char.icon;
            p.color = char.color;
            const isPresetName = CHARACTER_ROSTER.some(c => c.name === p.name) || p.name.startsWith('Người chơi');
            if (isPresetName || !p.name) {
                p.name = char.name;
            }
        }
        renderSetupInputs(currentSelectedCount);
        renderTokens();
    } else {
        // Guest chọn nhân vật cho chính mình
        const myP = gameState.players.find(p => p.id === myPlayerId);
        if (myP) {
            myP.avatarIcon = char.icon;
            myP.color = char.color;
            const isPresetName = CHARACTER_ROSTER.some(c => c.name === myP.name) || myP.name.startsWith('Người chơi');
            if (isPresetName || !myP.name) {
                myP.name = char.name;
                if (dom.inputMyCustomName) dom.inputMyCustomName.value = char.name;
            }
            if (dom.myPlayerAvatar) {
                dom.myPlayerAvatar.style.backgroundColor = char.color;
                dom.myPlayerAvatar.style.boxShadow = `0 0 10px ${char.color}`;
                dom.myPlayerAvatar.textContent = char.icon;
            }
            if (dom.myPlayerSlotName) {
                dom.myPlayerSlotName.textContent = `${myP.name} (${char.icon})`;
            }
            sendWs({
                t: 'join_game',
                name: (dom.inputMyCustomName && dom.inputMyCustomName.value.trim()) || myP.name,
                avatar: char.icon,
                color: char.color
            });
            renderGuestCharacterGrid();
            renderTokens();
            showBanner(`ĐÃ CHỌN TƯỚNG: ${char.name.toUpperCase()} ${char.icon}`);
        }
    }
}

function renderGuestCharacterGrid() {
    if (!dom.guestCharacterGrid) return;
    dom.guestCharacterGrid.innerHTML = '';

    const myP = gameState.players.find(p => p.id === myPlayerId);
    const currentAvatar = myP?.avatarIcon;
    const currentColor = myP?.color;

    CHARACTER_ROSTER.forEach(char => {
        const card = document.createElement('div');
        const isSelected = (currentAvatar === char.icon || currentColor === char.color);
        card.className = `character-card ${isSelected ? 'selected' : ''}`;
        card.style.setProperty('--char-color', char.color);
        card.innerHTML = `
            <span class="char-card-badge">✅</span>
            <div class="char-card-icon">${char.icon}</div>
            <div class="char-card-name" style="color: ${char.color};">${char.name}</div>
            <div class="char-card-desc">${char.desc}</div>
        `;

        card.addEventListener('click', () => {
            selectCharacter(char, null);
        });

        dom.guestCharacterGrid.appendChild(card);
    });
}

function renderSetupInputs(count) {
    dom.playerInputsContainer.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const p = gameState.players[i] || DEFAULT_PRESETS[i];
        const row = document.createElement('div');
        row.className = 'player-input-row';
        row.innerHTML = `
            <button type="button" class="char-select-btn" id="btnCharSelect_${i}" title="Bấm để chọn nhân vật / biểu tượng">
                <span class="char-btn-icon">${p.avatarIcon || '🧙‍♂️'}</span>
                <span class="char-btn-edit">✏️</span>
            </button>
            <div class="color-indicator" style="background-color: ${p.color}; box-shadow: 0 0 8px ${p.color};"></div>
            <input type="text" class="player-name-input" id="inputPlayerName_${i}" value="${p.name}" placeholder="Tên người chơi ${i + 1}" maxlength="20">
            <button type="button" class="bot-toggle ${p.isBot ? 'active' : ''}" id="btnBotToggle_${i}" title="Chuyển đổi Người / Bot">
                ${p.isBot ? '🤖 Bot AI' : (p.connected ? '📱 Đã vào' : '👤 Người')}
            </button>
        `;
        dom.playerInputsContainer.appendChild(row);

        const charBtn = row.querySelector(`#btnCharSelect_${i}`);
        charBtn.addEventListener('click', () => {
            openCharacterSelectModal(i);
        });

        const botBtn = row.querySelector(`#btnBotToggle_${i}`);
        botBtn.addEventListener('click', () => {
            p.isBot = !p.isBot;
            botBtn.classList.toggle('active', p.isBot);
            botBtn.textContent = p.isBot ? '🤖 Bot AI' : '👤 Người';
        });

        const nameInput = row.querySelector(`#inputPlayerName_${i}`);
        nameInput.addEventListener('input', () => {
            p.name = nameInput.value.trim() || `Người chơi ${i + 1}`;
        });
    }
}

dom.playerCountGroup.querySelectorAll('.btn-select').forEach(btn => {
    btn.addEventListener('click', () => {
        if (socket && socket.readyState === WebSocket.OPEN && !isHost) return;
        dom.playerCountGroup.querySelectorAll('.btn-select').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const count = parseInt(btn.getAttribute('data-count'), 10);
        syncPlayerCount(count);
        sendWs({ t: 'set_player_count', count: count });
    });
});

function startGame(count) {
    // 1. Xóa sạch toàn bộ các phần tử quân cờ cũ trên bàn cờ
    document.querySelectorAll('.player-token').forEach(el => el.remove());

    // 2. Xác định số lượng người chơi thực tế
    if (typeof count === 'number') {
        currentSelectedCount = Math.max(2, Math.min(6, count));
    } else {
        currentSelectedCount = Math.max(2, Math.min(6, currentSelectedCount || 2));
    }

    // 3. Chỉ giữ đúng mảng players thực tế đang tham gia ván đấu
    gameState.players = gameState.players.slice(0, currentSelectedCount);

    while (gameState.players.length < currentSelectedCount) {
        const i = gameState.players.length;
        const preset = DEFAULT_PRESETS[i] || DEFAULT_PRESETS[0];
        gameState.players.push({
            id: `player_${i + 1}`,
            name: preset.name,
            color: preset.color,
            avatarIcon: preset.avatarIcon,
            position: 0,
            visualPos: 0,
            isBot: preset.isBot,
            connected: false,
            stats: { totalRolls: 0 },
            minigameScore: 0,
            totalMinigameScore: 0
        });
    }

    // Đặt lại đúng vị trí ô số 0 xuất phát cho các người chơi tham gia
    gameState.players.forEach(p => {
        p.position = 0;
        p.visualPos = 0;
        p.customCoord = null;
    });

    // Xáo trộn ngẫu nhiên thứ tự lượt đi một lần duy nhất ở Vòng 1 khi bắt đầu ván đấu
    const initialOrder = gameState.players.map(p => p.id);
    for (let i = initialOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [initialOrder[i], initialOrder[j]] = [initialOrder[j], initialOrder[i]];
    }
    gameState.turnOrder = initialOrder;
    gameState.currentRound = 1;
    gameState.currentTurnIndex = 0;
    gameState.activePlayerId = gameState.turnOrder[0];
    gameState.phase = 'WAITING_ROLL';
    gameState.winner = null;
    gameState.isAnimatingMove = false;

    // 4. Ẩn modal và cập nhật giao diện
    if (dom.setupModal) dom.setupModal.classList.add('hidden');
    if (dom.victoryModal) dom.victoryModal.classList.add('hidden');

    renderTurnPills();
    updateProgressList();
    renderTokens();
    renderSpecialPathsSvg();

    const activePlayer = gameState.players.find(p => p.id === gameState.activePlayerId) || gameState.players[0];
    if (activePlayer) {
        dom.activePlayerAvatar.style.backgroundColor = activePlayer.color;
        dom.activePlayerAvatar.style.boxShadow = `0 0 15px ${activePlayer.color}`;
        dom.activePlayerName.textContent = activePlayer.name + (activePlayer.isBot ? ' 🤖' : '');
        dom.activePlayerPos.textContent = `0 / ${BOARD_LENGTH}`;

        // Lúc mới bắt đầu trò chơi: Hiện toàn cảnh bản đồ trước rồi mới zoom lên
        playIntroOverviewSequence(activePlayer, () => {
            updateTurnButtons(activePlayer);
        });
    }
}

function resetGame() {
    // 1. Dọn dẹp khi Chơi lại (Reset Game): Xóa sạch toàn bộ các phần tử quân cờ cũ trên bàn cờ
    document.querySelectorAll('.player-token').forEach(el => el.remove());

    // 2. Thiết lập lại trạng thái ván đấu về phòng chờ SETUP
    gameState.phase = 'SETUP';
    gameState.currentRound = 1;
    gameState.currentTurnIndex = 0;
    gameState.activePlayerId = null;
    gameState.winner = null;
    gameState.isAnimatingMove = false;
    hasShownIntroOverview = false;
    isIntroOverviewPlaying = false;
    isCameraZoomed = false;
    updateCamera(false);

    // 3. Khởi tạo lại players theo đúng số lượng đang chọn (2 đến 6)
    currentSelectedCount = Math.max(2, Math.min(6, currentSelectedCount || 2));
    gameState.players = [];
    for (let i = 0; i < currentSelectedCount; i++) {
        const preset = DEFAULT_PRESETS[i];
        gameState.players.push({
            id: `player_${i + 1}`,
            name: preset.name,
            color: preset.color,
            avatarIcon: preset.avatarIcon,
            position: 0,
            visualPos: 0,
            isBot: preset.isBot,
            connected: false,
            stats: { totalRolls: 0 },
            minigameScore: 0,
            totalMinigameScore: 0
        });
    }
    gameState.turnOrder = gameState.players.map(p => p.id);

    // 4. Hiển thị lại modal Setup và ẩn các modal ván đấu
    if (window.MinigameManager) window.MinigameManager.forceClose();
    if (dom.victoryModal) dom.victoryModal.classList.add('hidden');
    if (dom.diceOverlay) dom.diceOverlay.classList.add('hidden');
    if (dom.setupModal) dom.setupModal.classList.remove('hidden');

    renderSetupInputs(currentSelectedCount);
    updateProgressList();
    renderTurnPills();
    renderTokens();
    renderSpecialPathsSvg();
}

dom.btnStartGame.addEventListener('click', () => {
    initAudio();
    if (socket && socket.readyState === WebSocket.OPEN && !isHost) return;

    const botFlags = [];
    const names = [];
    const avatars = [];
    const colors = [];
    for (let i = 0; i < currentSelectedCount; i++) {
        const nameInput = document.getElementById(`inputPlayerName_${i}`);
        const p = gameState.players[i] || DEFAULT_PRESETS[i];
        names.push(nameInput ? nameInput.value.trim() : p.name);
        botFlags.push(p.isBot);
        avatars.push(p.avatarIcon || DEFAULT_PRESETS[i].avatarIcon);
        colors.push(p.color || DEFAULT_PRESETS[i].color);
    }

    startGame(currentSelectedCount);

    sendWs({
        t: 'start_game',
        count: currentSelectedCount,
        bots: botFlags,
        names: names,
        avatars: avatars,
        colors: colors
    });

    showBanner('BẮT ĐẦU VÁN ĐẤU!');
});

dom.btnSaveMyName.addEventListener('click', () => {
    const val = dom.inputMyCustomName.value.trim();
    if (val) {
        const myP = gameState.players.find(p => p.id === myPlayerId);
        sendWs({
            t: 'join_game',
            name: val,
            avatar: myP ? myP.avatarIcon : undefined,
            color: myP ? myP.color : undefined
        });
        showBanner(`ĐÃ ĐỔI TÊN THÀNH: ${val.toUpperCase()}`);
    }
});

function onGameStateReceived(msg) {
    if (typeof msg.isHost === 'boolean') {
        isHost = msg.isHost;
        if (msg.hostIp) currentHostIp = msg.hostIp;
        updateRoleUI();
    }

    const prevRound = gameState.currentRound;
    gameState.currentRound = msg.round;
    dom.currentRoundDisplay.textContent = msg.round;
    gameState.currentTurnIndex = msg.turnIndex;
    gameState.phase = msg.phase;

    // Nếu vừa sang vòng mới (kết thúc vòng đua tính điểm): Hiện Bảng Xếp Hạng Minigame
    if (typeof msg.round === 'number' && msg.round > prevRound && prevRound >= 1 && gameState.phase !== 'SETUP') {
        setTimeout(() => {
            showRoundLeaderboardModal();
        }, 350);
    }

    // Số lượng người chơi tham gia ván đấu:
    // CHỈ cập nhật nếu server gửi rõ ràng trường msg.playerCount hợp lệ (2 đến 6).
    if (typeof msg.playerCount === 'number' && msg.playerCount >= 2 && msg.playerCount <= 6) {
        currentSelectedCount = msg.playerCount;
    }
    currentSelectedCount = Math.max(2, Math.min(6, currentSelectedCount || 2));

    dom.playerCountGroup.querySelectorAll('.btn-select').forEach(btn => {
        const c = parseInt(btn.getAttribute('data-count'), 10);
        btn.classList.toggle('active', c === currentSelectedCount);
    });

    if (Array.isArray(msg.order) && msg.order.length > 0) {
        gameState.turnOrder = msg.order
            .map(idx => `player_${idx + 1}`)
            .filter(pid => {
                const idx = parseInt(pid.replace('player_', ''), 10);
                return idx >= 1 && idx <= currentSelectedCount;
            });
    } else {
        gameState.turnOrder = [];
    }
    if (gameState.turnOrder.length === 0) {
        for (let i = 0; i < currentSelectedCount; i++) {
            gameState.turnOrder.push(`player_${i + 1}`);
        }
    }

    if (gameState.phase === 'SETUP') {
        gameState.isAnimatingMove = false;
    }

    // Tập hợp ID các người chơi hợp lệ: CHỈ TỪ player_1 ĐẾN player_${currentSelectedCount}
    const allowedPlayerIds = new Set(
        Array.from({ length: currentSelectedCount }, (_, i) => `player_${i + 1}`)
    );

    // Cập nhật người chơi từ server
    if (Array.isArray(msg.players)) {
        msg.players.forEach(pData => {
            const pIndex = pData.id + 1;
            if (pIndex < 1 || pIndex > currentSelectedCount) return;
            const pid = `player_${pIndex}`;
            let p = gameState.players.find(x => x.id === pid);
            if (!p) {
                p = {
                    id: pid,
                    name: pData.name || DEFAULT_PRESETS[pData.id]?.name || `Người chơi ${pIndex}`,
                    color: pData.color || DEFAULT_PRESETS[pData.id]?.color || '#ffffff',
                    avatarIcon: pData.avatar || DEFAULT_PRESETS[pData.id]?.avatarIcon || '🧙‍♂️',
                    position: typeof pData.pos === 'number' ? pData.pos : 0,
                    visualPos: typeof pData.pos === 'number' ? pData.pos : 0,
                    isBot: Boolean(pData.isBot),
                    connected: Boolean(pData.conn),
                    stats: { totalRolls: pData.rolls || 0 },
                    minigameScore: typeof pData.score === 'number' ? pData.score : 0,
                    totalMinigameScore: typeof pData.totalScore === 'number' ? pData.totalScore : 0
                };
                gameState.players.push(p);
            } else {
                p.name = pData.name || p.name;
                p.color = pData.color || p.color;
                p.avatarIcon = pData.avatar || p.avatarIcon;
                p.position = typeof pData.pos === 'number' ? pData.pos : p.position;
                if (gameState.phase === 'SETUP' || !gameState.isAnimatingMove) {
                    p.visualPos = p.position;
                    p.customCoord = null;
                }
                p.isBot = Boolean(pData.isBot);
                p.connected = Boolean(pData.conn);
                if (typeof pData.rolls === 'number') p.stats.totalRolls = pData.rolls;
                if (typeof pData.score === 'number') p.minigameScore = pData.score;
                if (typeof pData.totalScore === 'number') p.totalMinigameScore = pData.totalScore;
            }

            if (pData.isYou) {
                myPlayerId = pid;
            }
        });
    }

    // LOẠI BỎ tất cả người chơi có id lớn hơn currentSelectedCount
    gameState.players = gameState.players.filter(p => allowedPlayerIds.has(p.id));

    // Đảm bảo có đủ người chơi theo allowedPlayerIds nếu server chưa gửi đủ
    allowedPlayerIds.forEach(pid => {
        if (!gameState.players.some(p => p.id === pid)) {
            const idx = parseInt(pid.replace('player_', ''), 10) - 1;
            const preset = DEFAULT_PRESETS[idx] || DEFAULT_PRESETS[0];
            gameState.players.push({
                id: pid,
                name: preset.name,
                color: preset.color,
                avatarIcon: preset.avatarIcon,
                position: 0,
                visualPos: 0,
                isBot: preset.isBot,
                connected: false,
                stats: { totalRolls: 0 }
            });
        }
    });

    // Sắp xếp lại gameState.players theo id (player_1, player_2, ...)
    gameState.players.sort((a, b) => {
        const numA = parseInt(a.id.replace('player_', ''), 10);
        const numB = parseInt(b.id.replace('player_', ''), 10);
        return numA - numB;
    });

    // Hiển thị lobby cho khách nếu đang ở phase SETUP
    if (gameState.phase === 'SETUP') {
        dom.setupModal.classList.remove('hidden');
        dom.victoryModal.classList.add('hidden');
        dom.diceOverlay.classList.add('hidden');

        if (!isHost) {
            const myP = gameState.players.find(p => p.id === myPlayerId);
            if (myP) {
                dom.myPlayerAvatar.style.backgroundColor = myP.color;
                dom.myPlayerAvatar.style.boxShadow = `0 0 10px ${myP.color}`;
                dom.myPlayerAvatar.textContent = myP.avatarIcon || '🧙‍♂️';
                dom.myPlayerSlotName.textContent = `${myP.name} (${myP.avatarIcon || ''})`;
                if (!dom.inputMyCustomName.value) {
                    dom.inputMyCustomName.value = myP.name;
                }
                renderGuestCharacterGrid();
            }
            dom.lobbyPlayersList.innerHTML = '';
            gameState.players.filter(p => allowedPlayerIds.has(p.id)).forEach(p => {
                const chip = document.createElement('div');
                chip.className = 'lobby-player-chip';
                chip.innerHTML = `<span class="dot" style="background:${p.color}">${p.avatarIcon || ''}</span><span>${p.name} ${p.isBot ? '🤖' : (p.id === myPlayerId ? '⭐' : '👤')}</span>`;
                dom.lobbyPlayersList.appendChild(chip);
            });
        } else {
            renderSetupInputs(currentSelectedCount);
        }
        renderTokens();
        renderSpecialPathsSvg();
        isCameraZoomed = false;
        updateCamera(false);
        return;
    }

    // Nếu trận đấu đã bắt đầu
    dom.setupModal.classList.add('hidden');
    renderTurnPills();
    updateProgressList();
    renderTokens();

    const activeId = gameState.turnOrder[gameState.currentTurnIndex];
    gameState.activePlayerId = activeId;
    const activePlayer = gameState.players.find(p => p.id === activeId);

    if (activePlayer) {
        dom.activePlayerAvatar.style.backgroundColor = activePlayer.color;
        dom.activePlayerAvatar.style.boxShadow = `0 0 15px ${activePlayer.color}`;
        dom.activePlayerAvatar.textContent = activePlayer.avatarIcon || '🧙‍♂️';
        dom.activePlayerName.textContent = `${activePlayer.name}${activePlayer.isBot ? ' 🤖' : ''}`;
        dom.activePlayerPos.textContent = `${activePlayer.position} / ${BOARD_LENGTH}`;
        dom.activePlayerNextMilestone.textContent = 'Đỉnh 50 👑';

        // Kiểm tra nếu ván đấu vừa mới bắt đầu (vòng 1 và chưa chạy intro toàn cảnh)
        const isMatchJustStarted = (!hasShownIntroOverview && (msg.round === 1 || !msg.round) && (msg.phase === 'WAITING_ROLL' || msg.phase === 'MOVING'));

        if (isMatchJustStarted) {
            playIntroOverviewSequence(activePlayer, () => {
                updateTurnButtons(activePlayer);
            });
        } else if (!isIntroOverviewPlaying) {
            focusCameraOnPlayer(activePlayer, true);
            updateTurnButtons(activePlayer);
        }
    }

    // Kiểm tra kết thúc ván đấu
    if (gameState.phase === 'GAME_OVER' && msg.winner >= 0) {
        const winnerPid = `player_${msg.winner + 1}`;
        const winnerP = gameState.players.find(p => p.id === winnerPid);
        if (winnerP) triggerVictory(winnerP);
    }
}

// ==========================================================================
// 8. Xử Lý Sự Kiện Xúc Xắc, Lối Tắt & Trượt Chân Dốc Đá
// ==========================================================================
function onDiceRollReceived(msg) {
    const pid = `player_${msg.player + 1}`;
    const player = gameState.players.find(p => p.id === pid);
    if (!player) return;

    initAudio();
    gameState.phase = 'MOVING';
    dom.btnRollDice.disabled = true;

    // Tự động zoom lớn và định vị camera vào đúng vị trí của người chơi khi bắt đầu tung xúc xắc
    isCameraZoomed = true;
    if (currentCameraScale < 2.5) currentCameraScale = DEFAULT_CAMERA_ZOOM;
    focusCameraOnPlayer(player, true, 400);

    if (dom.dicePlayerDot) {
        dom.dicePlayerDot.style.backgroundColor = player.color;
        dom.dicePlayerDot.style.boxShadow = `0 0 10px ${player.color}`;
        dom.dicePlayerDot.textContent = player.avatarIcon || '🧙‍♂️';
    }
    if (dom.dicePlayerName) {
        dom.dicePlayerName.textContent = player.name + (player.isBot ? ' 🤖' : '');
    }
    if (dom.diceActionTitle) {
        dom.diceActionTitle.textContent = `${player.name} đang tung xúc xắc 3D...`;
    }
    if (dom.diceOutcomeBadge) {
        dom.diceOutcomeBadge.classList.add('hidden');
    }

    dom.diceOverlay.classList.remove('hidden');
    animate3DDiceRoll(msg.roll, () => {
        AudioSFX.playCorrect();
        if (dom.diceActionTitle) {
            dom.diceActionTitle.textContent = `${player.name} tung được ${msg.roll} chấm!`;
        }
        if (dom.diceOutcomeText) {
            dom.diceOutcomeText.textContent = `+${msg.roll} BƯỚC`;
        }
        if (dom.diceOutcomeBadge) {
            dom.diceOutcomeBadge.classList.remove('hidden');
        }

        setTimeout(() => {
            dom.diceOverlay.style.transition = 'opacity 0.22s ease';
            dom.diceOverlay.style.opacity = '0';

            setTimeout(() => {
                dom.diceOverlay.classList.add('hidden');
                dom.diceOverlay.style.opacity = '';

                addGameLog(`🎲 <strong>[${player.name}]</strong> Tung được <strong>${msg.roll} chấm</strong> (${DICE_FACES[msg.roll - 1]}). Bước từ ô ${msg.from} ➔ <strong>ô ${msg.to}</strong>.`);

                // 1. Bước đi từng ô bình thường đến ô dừng lại msg.to
                animateStepMovement(player, msg.to, () => {
                    player.position = msg.to;
                    player.visualPos = msg.to;
                    dom.activePlayerPos.textContent = `${player.position} / ${BOARD_LENGTH}`;
                    updateProgressList();
                    renderTokens();

                    // 2. Kiểm tra nếu ô dừng lại msg.to là điểm đầu của Đường Đi Tắt hoặc Đường Đi Lùi
                    const specialDest = SPECIAL_PATHS[msg.to];
                    if (specialDest !== undefined) {
                        // Dừng lại tại ô đó khoảng 0.5 giây trước khi trượt
                        setTimeout(() => {
                            const isShortcut = (specialDest > msg.to);
                            if (isShortcut) {
                                AudioSFX.playCorrect();
                                addGameLog(`🧗‍♂️ <strong>[LỐI TẮT LEO NÚI]</strong> <strong>${player.name}</strong> tìm thấy lối tắt leo núi! Tiến thẳng từ ô ${msg.to} lên <strong>ô ${specialDest}</strong>!`);
                                showBanner(`LỐI TẮT LEO NÚI: ${msg.to} ➔ ${specialDest}!`);
                            } else {
                                AudioSFX.playWrong();
                                addGameLog(`⚠️ <strong>[TRƯỢT CHÂN DỐC ĐÁ]</strong> <strong>${player.name}</strong> trượt chân dốc đá! Tụt từ ô ${msg.to} xuống <strong>ô ${specialDest}</strong>!`);
                                showBanner(`TRƯỢT CHÂN DỐC ĐÁ: ${msg.to} ➔ ${specialDest}!`);
                            }

                            // Quân cờ trượt mượt mà dọc theo đường nối đến ô đích
                            animateSlideAlongPath(player, msg.to, specialDest, () => {
                                player.position = specialDest;
                                player.visualPos = specialDest;
                                dom.activePlayerPos.textContent = `${player.position} / ${BOARD_LENGTH}`;
                                updateProgressList();
                                renderTokens();

                                if (player.position >= BOARD_LENGTH) {
                                    triggerVictory(player);
                                } else {
                                    setTimeout(() => {
                                        gameState.isAnimatingMove = false;
                                        checkAndTriggerMinigameForActivePlayer(player);
                                    }, 400);
                                }
                            });
                        }, 500);
                    } else {
                        if (player.position >= BOARD_LENGTH) {
                            triggerVictory(player);
                        } else {
                            setTimeout(() => {
                                gameState.isAnimatingMove = false;
                                checkAndTriggerMinigameForActivePlayer(player);
                            }, 400);
                        }
                    }
                });
            }, 220);
        }, 800);
    });
}

// Hoạt ảnh trượt mượt mà dọc theo đường nối từ fromTile đến toTile
function animateSlideAlongPath(player, fromTile, toTile, onComplete) {
    const startCoord = TILE_COORDINATES[fromTile] || TILE_COORDINATES[0];
    const endCoord = TILE_COORDINATES[toTile] || TILE_COORDINATES[0];
    const duration = 1000;
    const startTime = performance.now();
    gameState.isAnimatingMove = true;
    isCameraZoomed = true;

    function stepSlide(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        // Easing cubic mượt mà
        const ease = progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        player.customCoord = {
            x: startCoord.x + (endCoord.x - startCoord.x) * ease,
            y: startCoord.y + (endCoord.y - startCoord.y) * ease
        };

        // Camera di chuyển theo vị trí trượt thời gian thực của quân cờ
        focusCameraOnCoord(player.customCoord.x, player.customCoord.y, true, 80);

        if (progress < 1) {
            requestAnimationFrame(stepSlide);
        } else {
            player.customCoord = null;
            player.visualPos = toTile;
            player.position = toTile;
            gameState.isAnimatingMove = false;
            focusCameraOnPlayer(player, true, 350);
            if (onComplete) onComplete();
        }
    }
    requestAnimationFrame(stepSlide);
}

// Bấm nút tung xúc xắc
dom.btnRollDice.addEventListener('click', () => {
    initAudio();
    isCameraZoomed = true;
    if (currentCameraScale < 2.5) currentCameraScale = DEFAULT_CAMERA_ZOOM;
    const activePlayer = gameState.players.find(p => p.id === gameState.activePlayerId);
    if (activePlayer) {
        focusCameraOnPlayer(activePlayer, true, 400);
    }
    if (socket && socket.readyState === WebSocket.OPEN) {
        sendWs({ t: 'roll_dice' });
    } else {
        handleOfflineRoll();
    }
});

// Bấm nút ván mới (chỉ Host có quyền)
dom.btnRestart.addEventListener('click', () => {
    if (socket && socket.readyState === WebSocket.OPEN && !isHost) return;
    if (confirm('Bạn có chắc muốn làm mới ván đấu và quay về phòng chờ?')) {
        resetGame();
        sendWs({ t: 'restart_game' });
    }
});

dom.btnPlayAgain.addEventListener('click', () => {
    if (socket && socket.readyState === WebSocket.OPEN && !isHost) {
        alert('Chỉ Host mới có quyền bắt đầu ván mới!');
        return;
    }
    resetGame();
    sendWs({ t: 'restart_game' });
});

// Cài đặt phòng và chuyển quyền Host
dom.btnSettings.addEventListener('click', () => {
    updateRoleUI();
    dom.settingsModal.classList.remove('hidden');
});
dom.btnCloseSettings.addEventListener('click', () => {
    dom.settingsModal.classList.add('hidden');
});
dom.btnClaimHost.addEventListener('click', () => {
    const ip = dom.inputClaimIp.value.trim();
    if (ip) {
        sendWs({ t: 'claim_host', hostIp: ip });
        dom.settingsModal.classList.add('hidden');
        showBanner(`ĐÃ GỬI YÊU CẦU NHẬN HOST VỚI IP: ${ip}`);
    }
});

// ==========================================================================
// 9. Khối Lập Phương True 3D Cube & Hoạt Ảnh Tung Xúc Xắc 3D Sống Động
// ==========================================================================
const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const BASE_FACE_ANGLES = {
    1: { x: 0,   y: 0 },
    2: { x: 0,   y: -90 },
    3: { x: 90,  y: 0 },
    4: { x: -90, y: 0 },
    5: { x: 0,   y: 90 },
    6: { x: 0,   y: 180 }
};

let currentCubeRotX = 0;
let currentCubeRotY = 0;
let currentCubeRotZ = 0;
let diceAnimationId = null;

function animate3DDiceRoll(diceResult, onComplete) {
    if (diceAnimationId) {
        cancelAnimationFrame(diceAnimationId);
        diceAnimationId = null;
    }

    AudioSFX.playRoll();
    const targetBase = BASE_FACE_ANGLES[diceResult] || BASE_FACE_ANGLES[1];

    const startX = currentCubeRotX;
    const startY = currentCubeRotY;
    const startZ = currentCubeRotZ;

    const turnsX = 4 * 360;
    const turnsY = 3 * 360;
    const turnsZ = 2 * 360;

    const targetX = Math.ceil((startX + turnsX) / 360) * 360 + targetBase.x;
    const targetY = Math.ceil((startY + turnsY) / 360) * 360 + targetBase.y;
    const targetZ = Math.ceil((startZ + turnsZ) / 360) * 360;

    const duration = 1350;
    const startTime = performance.now();
    let hasPlayedImpact1 = false;
    let hasPlayedImpact2 = false;

    if (dom.diceCube) dom.diceCube.style.transition = 'none';
    if (dom.diceBouncer) dom.diceBouncer.style.transition = 'none';

    function renderFrame(now) {
        const elapsed = now - startTime;
        const p = Math.min(1, elapsed / duration);
        const ease = 1 - Math.pow(1 - p, 4);

        const curX = startX + (targetX - startX) * ease;
        const curY = startY + (targetY - startY) * ease;
        const curZ = startZ + (targetZ - startZ) * ease;

        let posY = 0;
        if (p < 0.60) {
            const t1 = p / 0.60;
            posY = -110 * Math.sin(Math.PI * t1);
        } else if (p < 0.85) {
            const t2 = (p - 0.60) / 0.25;
            posY = -32 * Math.sin(Math.PI * t2);
            if (!hasPlayedImpact1) {
                hasPlayedImpact1 = true;
                AudioSFX.playDiceImpact();
            }
        } else {
            const t3 = (p - 0.85) / 0.15;
            posY = -8 * Math.sin(Math.PI * t3);
            if (!hasPlayedImpact2) {
                hasPlayedImpact2 = true;
                AudioSFX.playDiceImpact();
            }
        }

        if (dom.diceCube) {
            dom.diceCube.style.transform = `rotateX(${curX.toFixed(2)}deg) rotateY(${curY.toFixed(2)}deg) rotateZ(${curZ.toFixed(2)}deg)`;
        }
        if (dom.diceBouncer) {
            dom.diceBouncer.style.transform = `translateY(${posY.toFixed(2)}px)`;
        }
        if (dom.diceGroundShadow) {
            const heightFactor = Math.min(1, Math.abs(posY) / 110);
            const shadowScale = (1 + heightFactor * 0.45).toFixed(2);
            const shadowOpacity = Math.max(0.2, 0.75 - heightFactor * 0.45).toFixed(2);
            const shadowBlur = (3 + heightFactor * 10).toFixed(1);
            dom.diceGroundShadow.style.transform = `translateX(-50%) scale(${shadowScale})`;
            dom.diceGroundShadow.style.opacity = shadowOpacity;
            dom.diceGroundShadow.style.filter = `blur(${shadowBlur}px)`;
        }

        if (p < 1) {
            diceAnimationId = requestAnimationFrame(renderFrame);
        } else {
            currentCubeRotX = targetX;
            currentCubeRotY = targetY;
            currentCubeRotZ = 0;
            diceAnimationId = null;

            if (dom.diceBouncer) dom.diceBouncer.style.transform = 'translateY(0px)';
            if (dom.diceGroundShadow) {
                dom.diceGroundShadow.style.transform = 'translateX(-50%) scale(1)';
                dom.diceGroundShadow.style.opacity = '0.8';
                dom.diceGroundShadow.style.filter = 'blur(3px)';
            }
            if (dom.diceCube) {
                dom.diceCube.style.transition = 'transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)';
                dom.diceCube.style.transform = `rotateX(${targetX}deg) rotateY(${targetY}deg) rotateZ(0deg) scale(1.06)`;
                setTimeout(() => {
                    if (dom.diceCube) {
                        dom.diceCube.style.transform = `rotateX(${targetX}deg) rotateY(${targetY}deg) rotateZ(0deg) scale(1)`;
                    }
                }, 140);
            }
            setTimeout(onComplete, 220);
        }
    }
    diceAnimationId = requestAnimationFrame(renderFrame);
}

function animateStepMovement(player, targetPos, onComplete) {
    gameState.isAnimatingMove = true;
    isCameraZoomed = true;
    const stepInterval = setInterval(() => {
        if (player.visualPos < targetPos) {
            player.visualPos++;
            AudioSFX.playStep();
            focusCameraOnPlayer(player, true, 200);
        } else if (player.visualPos > targetPos) {
            player.visualPos--;
            AudioSFX.playStep();
            focusCameraOnPlayer(player, true, 200);
        } else {
            clearInterval(stepInterval);
            gameState.isAnimatingMove = false;
            focusCameraOnPlayer(player, true, 300);
            if (onComplete) onComplete();
        }
    }, 180);
}

function addGameLog(htmlMessage) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = htmlMessage;
    dom.logContent.appendChild(entry);
    dom.logContent.scrollTop = dom.logContent.scrollHeight;
}

function renderTurnPills() {
    dom.turnOrderList.innerHTML = '';
    const maxAllowed = Math.max(2, Math.min(6, currentSelectedCount || 2));
    const allowedIds = new Set(gameState.players.slice(0, maxAllowed).map(p => p.id));
    const displayOrders = gameState.turnOrder.filter(id => allowedIds.has(id));
    displayOrders.forEach((id, index) => {
        const player = gameState.players.find(p => p.id === id);
        if (!player) return;
        const pill = document.createElement('div');
        pill.className = `turn-pill ${index === gameState.currentTurnIndex ? 'active' : ''}`;
        pill.style.setProperty('--pill-color', player.color);
        pill.innerHTML = `
            <div class="pill-dot" style="font-size: 0.85rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background: ${player.color}; box-shadow: 0 0 6px ${player.color};">${player.avatarIcon || '🧙‍♂️'}</div>
            <span>${player.name}${player.isBot ? ' 🤖' : (player.id === myPlayerId ? ' (Bạn)' : '')}${player.minigameScore ? ` (${player.minigameScore}đ)` : ''}</span>
        `;
        dom.turnOrderList.appendChild(pill);
    });
}

function updateProgressList() {
    dom.playerProgressList.innerHTML = '';
    const maxAllowed = Math.max(2, Math.min(6, currentSelectedCount || 2));
    const displayPlayers = gameState.players.slice(0, maxAllowed);
    const sorted = [...displayPlayers].sort((a, b) => b.position - a.position);
    sorted.forEach((p, rank) => {
        const percent = Math.min(100, (p.position / BOARD_LENGTH) * 100);
        const card = document.createElement('div');
        card.className = `progress-card ${p.id === gameState.activePlayerId ? 'active-player' : ''}`;
        card.innerHTML = `
            <div class="progress-header">
                <span style="color: ${p.color};">${p.avatarIcon || '🧙‍♂️'} #${rank + 1} ${p.name}${p.isBot ? ' 🤖' : (p.id === myPlayerId ? ' ⭐' : '')}</span>
                <span>Ô ${p.position} / 50 • 🎯 ${p.minigameScore || 0}đ</span>
            </div>
            <div class="progress-track">
                <div class="progress-fill" style="width: ${percent}%; background-color: ${p.color};"></div>
            </div>
        `;
        dom.playerProgressList.appendChild(card);
    });
}

function showBanner(text) {
    dom.bannerText.textContent = text;
    dom.gameBanner.classList.remove('hidden');
    setTimeout(() => {
        dom.gameBanner.classList.add('hidden');
    }, 2400);
}

// ==========================================================================
// 10. Điều Kiện Thắng (position >= 50) & Pháo Hoa Rực Rỡ
// ==========================================================================
let fireworksRockets = [];
let fireworksSparks = [];
let lastRocketSpawn = 0;

function triggerVictory(player) {
    gameState.phase = 'GAME_OVER';
    gameState.winner = player;
    AudioSFX.playVictory();

    addGameLog(`🏆🎉 <strong>[CHIẾN THẮNG CHUNG CUỘC]</strong> Chúc mừng <strong>${player.name}</strong> đã chạm đỉnh 50 đầu tiên và trở thành Nhà Vô Địch Đỉnh Bàn Cờ!`);
    showBanner(`CHIẾN THẮNG: ${player.name.toUpperCase()}!`);
    initConfetti();

    dom.winnerSubtitle.innerHTML = `<strong>${player.name}</strong> đã xuất sắc vượt qua các dốc đá hiểm trở và chạm đỉnh 50 đầu tiên!`;
    dom.victoryStatsContainer.innerHTML = `
        <div>Vòng đấu hoàn thành: <strong>${gameState.currentRound}</strong></div>
        <div>Tổng số lần đổ xúc xắc: <strong>${player.stats.totalRolls}</strong></div>
        <div>Vị trí chung cuộc: <strong>${player.position} / 50</strong></div>
    `;

    setTimeout(() => {
        dom.victoryModal.classList.remove('hidden');
    }, 1200);
}

function spawnFireworkRocket() {
    const colors = ['#ffd166', '#ef476f', '#06d6a0', '#00f0ff', '#f72585', '#a06cd5', '#ffffff'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const startX = 120 + Math.random() * (CANVAS_WIDTH - 240);
    const targetY = 70 + Math.random() * 180;

    fireworksRockets.push({
        x: startX,
        y: CANVAS_HEIGHT + 10,
        vx: (Math.random() - 0.5) * 2,
        vy: -9 - Math.random() * 4,
        targetY: targetY,
        color: color
    });
}

function explodeRocket(x, y, color) {
    const count = 55 + Math.floor(Math.random() * 30);
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.2 + Math.random() * 6.5;
        fireworksSparks.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            alpha: 1.0,
            decay: 0.012 + Math.random() * 0.018,
            gravity: 0.12,
            size: 2.5 + Math.random() * 3.5,
            color: color
        });
    }
}

function initConfetti() {
    fireworksRockets = [];
    fireworksSparks = [];
    for (let i = 0; i < 4; i++) {
        setTimeout(spawnFireworkRocket, i * 250);
    }
}

// ==========================================================================
// 11. Hoạt Ảnh Thiên Nhiên Sơn Trà & Render Bàn Cờ Canvas
// ==========================================================================
// Tốc độ di chuyển chuẩn hóa tính theo pixel/giây (êm dịu, tự nhiên, không bị tua nhanh)
const clouds = [
    { x: 30, y: 45, speed: 7.5, scale: 1.1, opacity: 0.88 },
    { x: 260, y: 75, speed: 10.0, scale: 0.85, opacity: 0.82 },
    { x: 520, y: 38, speed: 6.0, scale: 1.3, opacity: 0.9 },
    { x: 740, y: 70, speed: 8.5, scale: 0.95, opacity: 0.85 },
    { x: 90, y: 420, speed: 8.0, scale: 1.0, opacity: 0.65 },
    { x: 620, y: 650, speed: 6.5, scale: 1.15, opacity: 0.6 },
    { x: 180, y: 910, speed: 7.0, scale: 0.9, opacity: 0.55 }
];

function drawFluffyCloud(ctx, x, y, scale, opacity) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI * 2);
    ctx.arc(16, -8, 22, 0, Math.PI * 2);
    ctx.arc(38, -5, 18, 0, Math.PI * 2);
    ctx.arc(52, 4, 15, 0, Math.PI * 2);
    ctx.arc(26, 6, 18, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

const birds = [
    { x: 80, y: 55, speed: 28, scale: 0.75, phase: 0 },
    { x: 105, y: 68, speed: 28, scale: 0.65, phase: 0.7 },
    { x: 130, y: 58, speed: 30, scale: 0.7, phase: 1.4 },
    { x: 360, y: 38, speed: 24, scale: 0.85, phase: 2.1 },
    { x: 390, y: 48, speed: 24, scale: 0.7, phase: 2.8 },
    { x: 670, y: 80, speed: 32, scale: 0.8, phase: 0.5 },
    { x: 700, y: 92, speed: 30, scale: 0.65, phase: 1.2 }
];

function drawBird(ctx, x, y, scale, wingOffset) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.strokeStyle = '#102a43';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-13, wingOffset);
    ctx.quadraticCurveTo(-6, -wingOffset * 1.6, 0, 0);
    ctx.quadraticCurveTo(6, -wingOffset * 1.6, 13, wingOffset);
    ctx.stroke();
    ctx.restore();
}

// Cập nhật vị trí thiên nhiên dựa trên thời gian thực (Delta Time tính bằng giây)
function updateNatureElements(dt, now) {
    // 1. Mây trôi êm dịu (pixel/giây)
    clouds.forEach(c => {
        c.x += c.speed * dt;
        if (c.x > CANVAS_WIDTH + 80) c.x = -90;
    });

    // 2. Đàn chim sải cánh chao lượn bình yên
    const wingTime = now * 0.0035;
    birds.forEach(b => {
        b.x += b.speed * dt;
        if (b.x > CANVAS_WIDTH + 60) b.x = -60;
        b.currentWing = Math.sin(wingTime * 1.8 + b.phase) * 5;
    });

    // 3. Pháo hoa ăn mừng khi chiến thắng
    if (gameState.phase === 'GAME_OVER') {
        if (now - lastRocketSpawn > 650) {
            spawnFireworkRocket();
            lastRocketSpawn = now;
        }

        const simSteps = Math.min(3, Math.max(0.5, dt * 60));
        for (let i = fireworksRockets.length - 1; i >= 0; i--) {
            const r = fireworksRockets[i];
            r.x += r.vx * simSteps;
            r.y += r.vy * simSteps;

            if (r.y <= r.targetY || r.vy >= 0) {
                explodeRocket(r.x, r.y, r.color);
                fireworksRockets.splice(i, 1);
            }
        }

        for (let i = fireworksSparks.length - 1; i >= 0; i--) {
            const sp = fireworksSparks[i];
            sp.x += sp.vx * simSteps;
            sp.y += sp.vy * simSteps;
            sp.vy += sp.gravity * simSteps;
            sp.vx *= Math.pow(0.98, simSteps);
            sp.alpha -= sp.decay * simSteps;

            if (sp.alpha <= 0) {
                fireworksSparks.splice(i, 1);
            }
        }
    }
}

// Vòng lặp hoạt ảnh duy nhất (Single Animation Loop Manager)
let boardAnimFrameId = null;
let lastBoardTimestamp = 0;

function startBoardAnimationLoop() {
    if (boardAnimFrameId !== null) return; // Đã đang chạy, tuyệt đối không tạo thêm loop phụ!

    lastBoardTimestamp = performance.now();

    function loop(now) {
        if (!now) now = performance.now();
        const dt = Math.min(0.1, Math.max(0.001, (now - lastBoardTimestamp) / 1000));
        lastBoardTimestamp = now;

        updateNatureElements(dt, now);
        drawBoard();

        boardAnimFrameId = requestAnimationFrame(loop);
    }

    boardAnimFrameId = requestAnimationFrame(loop);
}

// ==========================================================================
// 12. Quản Lý Quân Cờ Động (Dynamic Render Tokens & Update Board)
// ==========================================================================
function renderTokens() {
    // 1. Xóa sạch toàn bộ các phần tử quân cờ DOM cũ trên bàn cờ nếu có
    document.querySelectorAll('.player-token').forEach(el => el.remove());

    // 2. Chỉ duyệt qua mảng players thực tế đang tham gia ván đấu (tối đa maxAllowed = 2 đến 6)
    const maxAllowed = Math.max(2, Math.min(6, currentSelectedCount || 2));
    const activePlayers = gameState.players.slice(0, maxAllowed);

    // 3. Gắn đúng số lượng quân cờ tương ứng với các người chơi có trong mảng players vào boardCameraWrapper
    const container = dom.boardCameraWrapper || dom.boardContainer || document.getElementById('boardContainer');
    if (container) {
        activePlayers.forEach((p, i) => {
            const token = document.createElement('div');
            token.className = 'player-token';
            token.id = `token-${p.id}`;
            token.setAttribute('data-player-id', p.id);
            token.setAttribute('data-position', String(p.position));
            token.setAttribute('data-player-index', String(i));
            token.title = `${p.name} (Ô ${p.position})`;
            const currentTileIdx = Math.min(BOARD_LENGTH, Math.max(0, Math.round(p.visualPos)));
            const coord = p.customCoord ? p.customCoord : (TILE_COORDINATES[currentTileIdx] || TILE_COORDINATES[0]);
            token.style.cssText = `position: absolute; left: ${coord.x}px; top: ${coord.y}px; width: 44px; height: 44px; border-radius: 50%; background: ${p.color}; opacity: 0; pointer-events: none; transform: translate(-50%, -50%); z-index: 10;`;
            container.appendChild(token);
        });
    }

    // 4. Vẽ quân cờ động lên bàn cờ Canvas
    drawBoard();
}

function updateBoard() {
    renderTokens();
}

function drawBoard() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Mây trắng & Đàn chim (Chỉ vẽ vị trí hiện tại, không cộng dồn tốc độ tại đây)
    clouds.forEach(c => {
        drawFluffyCloud(ctx, c.x, c.y, c.scale, c.opacity);
    });

    birds.forEach(b => {
        const wing = typeof b.currentWing === 'number' ? b.currentWing : 0;
        drawBird(ctx, b.x, b.y, b.scale, wing);
    });

    // 2. 5 Tầng Đèo Sơn Trà
    SONTRA_TIERS.forEach(t => {
        ctx.save();
        ctx.fillStyle = 'rgba(4, 18, 36, 0.45)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(40, t.y - 28, 410, 22, 6);
        else ctx.rect(40, t.y - 28, 410, 22);
        ctx.fill();

        ctx.fillStyle = '#ffd166';
        ctx.font = 'bold 10px "Bungee", sans-serif';
        ctx.textAlign = 'left';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 4;
        ctx.fillText(t.name, 48, t.y - 13);
        ctx.restore();
    });

    // 3. Đường Đèo Ziczac
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(4, 18, 34, 0.85)';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < TILE_COORDINATES.length; i++) {
        const pt = TILE_COORDINATES[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.lineWidth = 11;
    for (let i = 0; i < TILE_COORDINATES.length; i++) {
        const pt = TILE_COORDINATES[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 8]);
    for (let i = 0; i < TILE_COORDINATES.length; i++) {
        const pt = TILE_COORDINATES[i];
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // 4. Vẽ Từng Ô Trên Bàn Cờ
    for (let i = 0; i < TILE_COORDINATES.length; i++) {
        const pt = TILE_COORDINATES[i];
        const isStart = (i === 0);
        const isSummit = (i === BOARD_LENGTH);
        const isShortcutOrigin = (i === 17 || i === 37);
        const isTrapOrigin = (i === 29 || i === 47);

        ctx.save();
        ctx.translate(pt.x, pt.y);

        if (isSummit) {
            ctx.shadowBlur = 25;
            ctx.shadowColor = 'rgba(255, 209, 102, 0.9)';

            const sunburst = ctx.createRadialGradient(0, 0, 8, 0, 0, 30);
            sunburst.addColorStop(0, '#ffffff');
            sunburst.addColorStop(0.4, '#ffd166');
            sunburst.addColorStop(1, '#ff9f1c');
            ctx.fillStyle = sunburst;
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#041224';
            ctx.lineWidth = 3.5;
            ctx.stroke();

            ctx.fillStyle = '#121624';
            ctx.font = '22px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('👑', 0, -3);

            ctx.font = 'bold 11px "Bungee", sans-serif';
            ctx.fillText('50', 0, 18);

            ctx.fillStyle = 'rgba(4, 18, 36, 0.92)';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(-46, -48, 92, 19, 8);
            else ctx.rect(-46, -48, 92, 19);
            ctx.fill();
            ctx.strokeStyle = '#ffd166';
            ctx.lineWidth = 1.4;
            ctx.stroke();

            ctx.font = 'bold 8.5px "Be Vietnam Pro", sans-serif';
            ctx.fillStyle = '#ffd166';
            ctx.fillText('ĐỈNH BÀN CỜ', 0, -39);

        } else if (isStart) {
            ctx.shadowBlur = 16;
            ctx.shadowColor = '#10b981';
            ctx.fillStyle = '#10b981';
            ctx.beginPath();
            ctx.arc(0, 0, 18, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            ctx.fillStyle = '#041224';
            ctx.font = 'bold 10px "Bungee", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('START', 0, 0);

        } else if (isShortcutOrigin) {
            // Điểm đầu của Đường Đi Tắt (Ô 17 và 37) - Viền xanh lá cây nhạt nổi bật
            ctx.shadowBlur = 14;
            ctx.shadowColor = '#86efac';
            ctx.fillStyle = '#064e3b';
            ctx.strokeStyle = '#86efac';
            ctx.lineWidth = 3;

            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Mũi tên đi lên màu xanh lá cây sáng thay thế hoàn toàn cho số ô
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#86efac';
            ctx.fillStyle = '#86efac';
            ctx.font = 'bold 15px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⬆', 0, 0);

        } else if (isTrapOrigin) {
            // Điểm đầu của Đường Trượt Lùi (Ô 29 và 47) - Viền đỏ nổi bật
            ctx.shadowBlur = 14;
            ctx.shadowColor = '#f87171';
            ctx.fillStyle = '#450a0a';
            ctx.strokeStyle = '#f87171';
            ctx.lineWidth = 3;

            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Mũi tên đi xuống màu đỏ sáng thay thế hoàn toàn cho số ô
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#f87171';
            ctx.fillStyle = '#f87171';
            ctx.font = 'bold 15px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⬇', 0, 0);

        } else {
            // Các ô bước đi bình thường (gồm cả các ô 10, 20, 30, 40)
            ctx.shadowBlur = 6;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
            ctx.fillStyle = (i % 2 === 0) ? '#08172c' : '#0c223f';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.arc(0, 0, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 10px "Be Vietnam Pro", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowBlur = 3;
            ctx.shadowColor = '#000000';
            ctx.fillText(String(i), 0, 0.5);
        }

        ctx.restore();
    }

    // 5. Vẽ Quân Cờ Người Chơi - Chỉ vẽ đúng số quân cờ tương ứng với số người chơi (tối đa maxAllowed)
    const maxAllowed = Math.max(2, Math.min(6, currentSelectedCount || 2));
    const activeDisplayPlayers = gameState.players.slice(0, maxAllowed);

    if (activeDisplayPlayers.length > 0) {
        const tileOccupants = {};
        activeDisplayPlayers.forEach(p => {
            const posFloor = Math.round(p.visualPos);
            if (!tileOccupants[posFloor]) tileOccupants[posFloor] = [];
            tileOccupants[posFloor].push(p);
        });

        activeDisplayPlayers.forEach(p => {
            let baseCoord;
            let hopHeight = 0;

            if (p.customCoord) {
                // Đang trượt mượt mà theo đường nối đặc biệt
                baseCoord = p.customCoord;
                hopHeight = 0;
            } else {
                const currentTileIdx = Math.min(BOARD_LENGTH, Math.max(0, Math.round(p.visualPos)));
                baseCoord = TILE_COORDINATES[currentTileIdx] || TILE_COORDINATES[0];
                hopHeight = Math.abs(Math.sin((p.visualPos % 1) * Math.PI)) * 16;
            }

            const currentTileIdx = Math.min(BOARD_LENGTH, Math.max(0, Math.round(p.visualPos)));
            const occupants = tileOccupants[currentTileIdx] || [p];
            const occupantIdx = occupants.indexOf(p);
            const totalOnTile = occupants.length;

            let offsetX = 0;
            let offsetY = 0;
            if (totalOnTile > 1 && !p.customCoord) {
                const spreadRadius = totalOnTile > 4 ? 18 : 14;
                const angle = (occupantIdx / totalOnTile) * Math.PI * 2;
                offsetX = Math.cos(angle) * spreadRadius;
                offsetY = Math.sin(angle) * spreadRadius;
            }

            const tokenX = baseCoord.x + offsetX;
            const tokenY = baseCoord.y + offsetY - hopHeight;

            // Bóng đổ
            ctx.save();
            ctx.translate(baseCoord.x + offsetX, baseCoord.y + offsetY + 7);
            ctx.scale(Math.max(0.4, 1 - hopHeight / 24), 0.35);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.beginPath();
            ctx.arc(0, 0, 13, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Thân quân cờ
            ctx.save();
            ctx.translate(tokenX, tokenY);
            ctx.shadowBlur = 18;
            ctx.shadowColor = p.color;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.fill();

            const grad = ctx.createLinearGradient(-12, -12, 12, 12);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.3, p.color);
            grad.addColorStop(1, '#090e1a');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, 13, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.4;
            ctx.stroke();

            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.avatarIcon || '🧙‍♂️', 0, 0);

            // Tên người chơi
            const shortName = p.name.split(' ').pop();
            ctx.font = 'bold 9px "Be Vietnam Pro", sans-serif';
            const nameWidth = ctx.measureText(shortName).width;

            ctx.fillStyle = 'rgba(4, 18, 36, 0.88)';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(-nameWidth / 2 - 5, 13, nameWidth + 10, 14, 4);
            else ctx.rect(-nameWidth / 2 - 5, 13, nameWidth + 10, 14);
            ctx.fill();
            ctx.strokeStyle = p.color;
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 4;
            ctx.shadowColor = '#000000';
            ctx.fillText(shortName, 0, 20);

            ctx.restore();
        });
    }

    // 6. Pháo Hoa Khi Có Người Lên Đỉnh 50 (Chỉ hiển thị, vị trí được cập nhật trong updateNatureElements)
    if (gameState.phase === 'GAME_OVER') {
        for (let i = 0; i < fireworksRockets.length; i++) {
            const r = fireworksRockets[i];
            ctx.save();
            ctx.fillStyle = r.color;
            ctx.shadowBlur = 12;
            ctx.shadowColor = r.color;
            ctx.beginPath();
            ctx.arc(r.x, r.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        for (let i = 0; i < fireworksSparks.length; i++) {
            const sp = fireworksSparks[i];
            ctx.save();
            ctx.globalAlpha = Math.max(0, sp.alpha);
            ctx.fillStyle = sp.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = sp.color;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }
}

// ==========================================================================
// 13. Phím Tắt & Tương Tác
// ==========================================================================
dom.btnSound.addEventListener('click', () => {
    initAudio();
    soundEnabled = !soundEnabled;
    dom.soundIcon.textContent = soundEnabled ? '🔊' : '🔇';
    dom.btnSound.title = soundEnabled ? 'Tắt âm thanh (M)' : 'Bật âm thanh (M)';
});

dom.btnRules.addEventListener('click', () => dom.rulesModal.classList.remove('hidden'));
dom.btnCloseRules.addEventListener('click', () => dom.rulesModal.classList.add('hidden'));

window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyM') dom.btnSound.click();

    if (e.code === 'Space') {
        if (gameState.phase === 'WAITING_ROLL' && !dom.btnRollDice.disabled) {
            dom.btnRollDice.click();
        }
    }
});

// ==========================================================================
// 14. Khởi Chạy Ban Đầu
// ==========================================================================
function initGame() {
    // 1. Xóa sạch mọi phần tử quân cờ cũ trên bàn cờ nếu có
    document.querySelectorAll('.player-token').forEach(el => el.remove());

    // 2. Luôn khởi tạo người chơi mặc định đúng 2 người
    currentSelectedCount = 2;
    gameState.players = [];
    for (let i = 0; i < currentSelectedCount; i++) {
        const preset = DEFAULT_PRESETS[i];
        gameState.players.push({
            id: `player_${i + 1}`,
            name: preset.name,
            color: preset.color,
            avatarIcon: preset.avatarIcon,
            position: 0,
            visualPos: 0,
            isBot: preset.isBot,
            connected: false,
            stats: { totalRolls: 0 },
            minigameScore: 0,
            totalMinigameScore: 0
        });
    }
    gameState.turnOrder = gameState.players.map(p => p.id);

    renderSetupInputs(currentSelectedCount);
    if (dom.diceCube) {
        dom.diceCube.style.transform = 'rotateX(0deg) rotateY(0deg) rotateZ(0deg)';
    }

    resizeBoardCanvas();
    renderSpecialPathsSvg();
    connectWs();
    renderTokens();
    hasShownIntroOverview = false;
    isIntroOverviewPlaying = false;
    isCameraZoomed = false;
    updateCamera(false);

    // Đăng ký mini-game 1 & 2 vào MinigameManager
    if (window.MinigameManager) {
        window.MinigameManager.register('game-1', {
            title: 'ĐUA SỨC BỀN',
            description: 'Trong <strong>8 giây</strong>, liên tục bấm vào <strong>nút tròn</strong> trên màn hình để nạp đầy thanh thể lực!',
            script: 'minigames/game-1/game-1.js',
            style: 'minigames/game-1/game-1.css'
        });
        window.MinigameManager.register('game-2', {
            title: 'PHẢN XẠ NÉ KHỈ',
            description: 'Chú khỉ Sơn Trà đang nhắm ném quả thông! Khi chữ <strong>CHỘP!</strong> xuất hiện, hãy bấm nút thật nhanh để né quả thông (3 lượt ném)!',
            script: 'minigames/game-2/game-2.js',
            style: 'minigames/game-2/game-2.css'
        });
        window.MinigameManager.register('game-3', {
            title: 'CĂN LỰC GIÓ',
            description: 'Bấm dừng <strong>kim đỏ</strong> đúng vào <strong>tâm xanh lá (100 điểm)</strong>! Bạn có 3 lần bấm, lượt sau gió thổi nhanh hơn!',
            script: 'minigames/game-3/game-3.js',
            style: 'minigames/game-3/game-3.css'
        });
        window.MinigameManager.register('game-4', {
            title: 'ĐẾM THỜI GIAN TRONG SƯƠNG MÙ',
            description: 'Đồng hồ sẽ bị sương mù che khuất ở giây thứ 2. Hãy nhẩm đếm trong đầu và bấm <strong>DỪNG</strong> khi chạm đúng mốc mục tiêu (ngẫu nhiên 5 – 10 giây)!',
            script: 'minigames/game-4/game-4.js',
            style: 'minigames/game-4/game-4.css'
        });
        window.MinigameManager.register('game-5', {
            title: 'SĂN ẢNH VOỌC CHÀ VÁ',
            description: 'Trong 15 giây, nhanh tay chụp trúng <strong>Voọc chà vá (+20đ)</strong> thò ra từ các bụi cây! Tránh chụp nhầm <strong>Khỉ tinh nghịch (-15đ)</strong>!',
            script: 'minigames/game-5/game-5.js',
            style: 'minigames/game-5/game-5.css'
        });
        window.MinigameManager.register('game-6', {
            title: 'GIỮ THĂNG BẰNG ĐI TRÊN DÂY',
            description: 'Đi trên dây cáp nhìn từ sau lưng! Gió núi và các mũi tên trắng bay cuốn liên hồi. Bấm <strong>Trái / Phải</strong> nhấp nhả ghìm thăng bằng trong vùng tâm thẳng đứng. Ai trụ lâu hơn sẽ chiến thắng!',
            script: 'minigames/game-6/game-6.js',
            style: 'minigames/game-6/game-6.css'
        });
    }

    startBoardAnimationLoop();
}

// ==========================================================================
// 15. Tích Hợp Mini-game Manager & Cơ Chế Xếp Thứ Tự Lượt Đi Theo Điểm Số
// ==========================================================================
let isMinigameSessionActive = false;

function getCurrentMinigameType() {
    // Luân phiên 6 mini-game theo vòng:
    // Vòng 1, 7, 13...: Mini-game 1 (Đua Sức Bền)
    // Vòng 2, 8, 14...: Mini-game 2 (Phản Xạ Né Khỉ)
    // Vòng 3, 9, 15...: Mini-game 3 (Căn Lực Gió)
    // Vòng 4, 10, 16...: Mini-game 4 (Đếm Thời Gian Trong Sương Mù)
    // Vòng 5, 11, 17...: Mini-game 5 (Săn Ảnh Voọc Chà Vá)
    // Vòng 6, 12, 18...: Mini-game 6 (Giữ Thăng Bằng Qua Cầu Treo)
    const mIndex = (gameState.currentRound - 1) % 6;
    if (mIndex === 0) return 'game-1';
    if (mIndex === 1) return 'game-2';
    if (mIndex === 2) return 'game-3';
    if (mIndex === 3) return 'game-4';
    if (mIndex === 4) return 'game-5';
    return 'game-6';
}

function getMinigameTitle(gameType) {
    if (gameType === 'game-6') return 'THĂNG BẰNG ĐI TRÊN DÂY';
    if (gameType === 'game-5') return 'SĂN ẢNH VOỌC CHÀ VÁ';
    if (gameType === 'game-4') return 'ĐẾM THỜI GIAN TRONG SƯƠNG MÙ';
    if (gameType === 'game-3') return 'CĂN LỰC GIÓ';
    if (gameType === 'game-2') return 'PHẢN XẠ NÉ KHỈ';
    return 'ĐUA SỨC BỀN';
}

function getOrGenerateFogTargetForRound() {
    if (!gameState.currentFogTargetSec || gameState.currentFogTargetRound !== gameState.currentRound) {
        // Sinh ngẫu nhiên mục tiêu từ 5.00 đến 10.00 giây (mốc 5, 6, 7, 8, 9, 10 giây) cho toàn bộ người chơi trong vòng
        gameState.currentFogTargetSec = 5 + Math.floor(Math.random() * 6);
        gameState.currentFogTargetRound = gameState.currentRound;
    }
    return gameState.currentFogTargetSec;
}

function onMinigameResultReceived(msg) {
    const pid = `player_${msg.player + 1}`;
    const player = gameState.players.find(p => p.id === pid);
    if (player) {
        player.minigameScore = msg.score;
        player.totalMinigameScore = (player.totalMinigameScore || 0) + msg.score;
        addGameLog(`🎯 <strong>[${player.name}]</strong> Đạt <strong>${msg.score} điểm</strong> trong Minigame!`);
        updateProgressList();
        renderTurnPills();
    }
}

function checkAndTriggerMinigameForActivePlayer(targetPlayer = null) {
    if (isMinigameSessionActive) return;
    if (gameState.phase === 'GAME_OVER') return;

    const activeId = gameState.activePlayerId || gameState.turnOrder[gameState.currentTurnIndex];
    const player = targetPlayer || gameState.players.find(p => p.id === activeId);
    if (!player) return;

    const gameType = getCurrentMinigameType();
    const gameName = getMinigameTitle(gameType);

    // 1. Nếu là Bot AI:
    if (player.isBot) {
        if (isHost) {
            isMinigameSessionActive = true;
            addGameLog(`🤖 <strong>[${player.name}]</strong> đang thi đấu ${gameName}...`);
            if (!socket || socket.readyState !== WebSocket.OPEN) {
                setTimeout(() => {
                    let botScore = 0;
                    if (gameType === 'game-6') {
                        // Bot đi trên dây thăng bằng: độ khó cực cao, trụ từ 3.5s đến 9.5s
                        const botSurv = Number((3.5 + Math.random() * 6.0).toFixed(2));
                        botScore = Math.round(botSurv * 10);

                        player.minigameSurvivalTime = botSurv;
                        player.minigameVoocHits = undefined;
                        player.minigameKhiHits = undefined;
                        player.minigameTaps = undefined;
                        player.minigameBestTime = null;
                        player.minigamePerfectCount = undefined;
                        player.minigameFogTime = undefined;
                    } else if (gameType === 'game-5') {
                        // Bot săn ảnh Voọc chà vá: 24 Voọc và 10 Khỉ
                        const botVoocHits = 14 + Math.floor(Math.random() * 8); // 14 - 21 Voọc
                        const botKhiHits = Math.floor(Math.random() * 3.5); // 0 - 3 Khỉ
                        botScore = Math.max(0, (botVoocHits * 20) - (botKhiHits * 15));

                        player.minigameVoocHits = botVoocHits;
                        player.minigameKhiHits = botKhiHits;
                        player.minigameTaps = undefined;
                        player.minigameBestTime = null;
                        player.minigamePerfectCount = undefined;
                        player.minigameFogTime = undefined;
                    } else if (gameType === 'game-4') {
                        // Bot đếm thời gian trong sương mù (dùng chung mốc targetSec của cả vòng):
                        const targetSec = getOrGenerateFogTargetForRound();
                        const error = (Math.random() - 0.47) * 1.6; // Sai số tự nhiên khoảng -0.8s đến +0.8s
                        const botStopped = Math.max(2.1, Math.min(14.8, Number((targetSec + error).toFixed(2))));
                        const diff = Math.abs(botStopped - targetSec);

                        player.minigameFogTime = botStopped;
                        player.minigameFogTarget = targetSec;
                        player.minigameFogDiff = Number(diff.toFixed(2));
                        player.minigameTaps = undefined;
                        player.minigameBestTime = null;
                        player.minigamePerfectCount = undefined;
                        botScore = 0; // Không cần tính điểm số
                    } else if (gameType === 'game-3') {
                        // Bot căn lực gió 3 lượt:
                        let attemptScores = [];
                        let perfectCount = 0;
                        for (let a = 0; a < 3; a++) {
                            const dist = a === 0 ? Math.random() * 8 : (a === 1 ? Math.random() * 11 : Math.random() * 15);
                            let sc = 0;
                            if (dist <= 3.5) {
                                sc = 100;
                                perfectCount++;
                            } else {
                                const decay = (dist - 3.5) / 46.5;
                                sc = Math.max(10, Math.round(100 - decay * 100));
                            }
                            attemptScores.push(sc);
                        }
                        botScore = attemptScores.reduce((x, y) => x + y, 0);
                        player.minigameTaps = undefined;
                        player.minigameBestTime = null;
                        player.minigamePerfectCount = perfectCount;
                    } else if (gameType === 'game-2') {
                        // Bot né khỉ 3 lượt: phản xạ ngẫu nhiên 220ms - 460ms mỗi lượt
                        let throwScores = [];
                        let bestRt = 999;
                        for (let t = 0; t < 3; t++) {
                            const rt = 220 + Math.floor(Math.random() * 240);
                            if (rt < bestRt) bestRt = rt;
                            const sc = Math.max(20, Math.round(100 - (rt - 200) * 0.1));
                            throwScores.push(sc);
                        }
                        botScore = throwScores.reduce((a, b) => a + b, 0);
                        player.minigameTaps = undefined;
                        player.minigameBestTime = bestRt;
                    } else {
                        // Bot đua sức bền
                        const botTaps = 22 + Math.floor(Math.random() * 23); // 22 - 44 lần bấm
                        const botFirstTap = 200 + Math.floor(Math.random() * 550); // 200ms - 750ms
                        const botReflexScore = Math.max(0, Math.min(50, Math.round((8000 - botFirstTap) * 50 / 8000)));
                        botScore = (botTaps * 10) + botReflexScore;

                        player.minigameTaps = botTaps;
                        player.minigameFirstTap = botFirstTap;
                        player.minigameReflexScore = botReflexScore;
                        player.minigameBestTime = null;
                    }

                    isMinigameSessionActive = false;
                    onMinigameScoreFinished(player, botScore, gameType);
                }, 1300);
            } else {
                isMinigameSessionActive = false;
            }
        }
        return;
    }

    // 2. Nếu là Người chơi thật: Kiểm tra xem có đúng thiết bị này không
    const isMyTurn = (player.id === myPlayerId) || (isHost && !myPlayerId);
    if (!isMyTurn) {
        addGameLog(`⏳ Đang chờ <strong>${player.name}</strong> thi đấu ${gameName}...`);
        showBanner(`ĐANG CHỜ ${player.name.toUpperCase()} THI ĐẤU ${gameName}...`);
        return;
    }

    isMinigameSessionActive = true;
    triggerMinigame(gameType, player).then(result => {
        isMinigameSessionActive = false;
        const score = typeof result.score === 'number' ? result.score : (result.win ? 200 : 80);
        if (gameType === 'game-6') {
            player.minigameSurvivalTime = result.survivalTime ?? 10.0;
            player.minigameVoocHits = undefined;
            player.minigameKhiHits = undefined;
            player.minigameTaps = undefined;
            player.minigameBestTime = null;
            player.minigamePerfectCount = undefined;
            player.minigameFogTime = undefined;
        } else if (gameType === 'game-5') {
            player.minigameVoocHits = result.voocHits || 0;
            player.minigameKhiHits = result.khiHits || 0;
            player.minigameTaps = undefined;
            player.minigameBestTime = null;
            player.minigamePerfectCount = undefined;
            player.minigameFogTime = undefined;
        } else if (gameType === 'game-4') {
            player.minigameFogTime = result.fogStoppedTime ?? 7.00;
            player.minigameFogTarget = result.targetTime ?? 7.00;
            player.minigameFogDiff = result.diffSec ?? Math.abs(player.minigameFogTime - player.minigameFogTarget);
            player.minigameFogRating = result.ratingText || '';
            player.minigameTaps = undefined;
            player.minigameBestTime = null;
            player.minigamePerfectCount = undefined;
        } else if (gameType === 'game-3') {
            player.minigameTaps = undefined;
            player.minigameBestTime = null;
            player.minigamePerfectCount = result.perfectCount || 0;
            player.minigameAttemptsCount = result.attemptsCount || 3;
        } else if (gameType === 'game-2') {
            player.minigameTaps = undefined;
            player.minigameBestTime = result.bestReactionTime || null;
            player.minigameThrowsCount = result.throwsCount || 3;
            player.minigamePerfectCount = undefined;
        } else {
            player.minigameTaps = result.taps || 0;
            player.minigameFirstTap = result.firstTapTime || 0;
            player.minigameReflexScore = result.reflexScore || 0;
            player.minigameBestTime = null;
            player.minigamePerfectCount = undefined;
        }
        onMinigameScoreFinished(player, score, gameType);
    }).catch(err => {
        console.error('[Minigame] Lỗi:', err);
        isMinigameSessionActive = false;
        onMinigameScoreFinished(player, 60, gameType);
    });
}

function onMinigameScoreFinished(player, score, gameType = null) {
    player.minigameScore = score;
    player.totalMinigameScore = (player.totalMinigameScore || 0) + score;

    const gType = gameType || getCurrentMinigameType();
    const gName = getMinigameTitle(gType);

    let tapDetail = '';
    if (gType === 'game-6') {
        const sTime = player.minigameSurvivalTime !== undefined ? player.minigameSurvivalTime.toFixed(2) : '0.00';
        tapDetail = ` (Trụ vững ${sTime}s)`;
        addGameLog(`🎯 <strong>[KẾT QUẢ ${gName}]</strong> <strong>${player.name}</strong>${tapDetail} ➔ Trụ vững <strong>${sTime} giây</strong>!`);
    } else if (gType === 'game-5') {
        tapDetail = ` (📸 ${player.minigameVoocHits ?? 0}/24 Voọc • ⚠️ ${player.minigameKhiHits ?? 0}/10 Khỉ)`;
        addGameLog(`🎯 <strong>[KẾT QUẢ ${gName}]</strong> <strong>${player.name}</strong>${tapDetail} ➔ Đạt <strong>${score} điểm</strong>!`);
    } else if (gType === 'game-4') {
        const diffNum = player.minigameFogDiff !== undefined ? player.minigameFogDiff.toFixed(2) : '0.00';
        tapDetail = ` (Dừng lúc ${player.minigameFogTime?.toFixed(2) || '7.00'}s • Lệch: ±${diffNum}s)`;
        addGameLog(`🎯 <strong>[KẾT QUẢ ${gName}]</strong> <strong>${player.name}</strong>${tapDetail} ➔ Độ lệch: <strong>±${diffNum}s</strong>!`);
    } else if (gType === 'game-3') {
        const perfStr = player.minigamePerfectCount !== undefined ? ` • ${player.minigamePerfectCount}/3 lần 100đ` : '';
        tapDetail = ` (3 lượt căn gió${perfStr})`;
        addGameLog(`🎯 <strong>[KẾT QUẢ ${gName}]</strong> <strong>${player.name}</strong>${tapDetail} ➔ Đạt <strong>${score} điểm</strong>!`);
    } else if (gType === 'game-2') {
        const bestStr = player.minigameBestTime ? ` • Nhanh nhất: ${player.minigameBestTime}ms` : '';
        tapDetail = ` (3 lượt ném${bestStr})`;
        addGameLog(`🎯 <strong>[KẾT QUẢ ${gName}]</strong> <strong>${player.name}</strong>${tapDetail} ➔ Đạt <strong>${score} điểm</strong>!`);
    } else if (player.minigameTaps !== undefined) {
        tapDetail = ` (${player.minigameTaps} lần bấm • Phản xạ: ${(player.minigameFirstTap / 1000).toFixed(2)}s)`;
        addGameLog(`🎯 <strong>[KẾT QUẢ ${gName}]</strong> <strong>${player.name}</strong>${tapDetail} ➔ Đạt <strong>${score} điểm</strong>!`);
    } else {
        addGameLog(`🎯 <strong>[KẾT QUẢ ${gName}]</strong> <strong>${player.name}</strong> ➔ Đạt <strong>${score} điểm</strong>!`);
    }
    updateProgressList();
    renderTurnPills();

    if (socket && socket.readyState === WebSocket.OPEN) {
        sendWs({
            t: 'minigame_finish',
            score: score
        });
    } else {
        // Chế độ Offline / Ngoại tuyến
        advanceTurnOffline();
    }
}

function advanceTurnOffline() {
    gameState.currentTurnIndex++;
    if (gameState.currentTurnIndex >= gameState.turnOrder.length) {
        // Đã hoàn thành toàn bộ lượt tung xúc xắc và minigame của vòng này!
        // Sắp xếp lại thứ tự tung xúc xắc cho vòng tiếp theo từ điểm cao nhất đến thấp nhất!
        const activeGameType = getCurrentMinigameType();
        gameState.turnOrder.sort((a, b) => {
            const pA = gameState.players.find(p => p.id === a);
            const pB = gameState.players.find(p => p.id === b);
            if (activeGameType === 'game-6') {
                // Game 6 (Giữ Thăng Bằng Qua Cầu Treo): Thời gian trụ vững lâu hơn xếp trước (Hạng 1 -> ...)
                const survA = pA?.minigameSurvivalTime ?? 0;
                const survB = pB?.minigameSurvivalTime ?? 0;
                if (survB !== survA) return survB - survA;
                return (pB?.minigameScore || 0) - (pA?.minigameScore || 0);
            } else if (activeGameType === 'game-5') {
                // Game 5 (Săn Ảnh Voọc Chà Vá): Tổng điểm cao hơn xếp trước, hòa thì chụp nhiều Voọc hơn xếp trước
                const scoreA = pA?.minigameScore || 0;
                const scoreB = pB?.minigameScore || 0;
                if (scoreB !== scoreA) return scoreB - scoreA;
                const vA = pA?.minigameVoocHits || 0;
                const vB = pB?.minigameVoocHits || 0;
                return vB - vA;
            } else if (activeGameType === 'game-4') {
                // Game 4 (Đếm Thời Gian Trong Sương Mù): Người có độ lệch nhỏ nhất (|stopped - target|) đứng nhất
                const diffA = pA?.minigameFogDiff ?? Math.abs((pA?.minigameFogTime ?? 15) - (pA?.minigameFogTarget ?? 7));
                const diffB = pB?.minigameFogDiff ?? Math.abs((pB?.minigameFogTime ?? 15) - (pB?.minigameFogTarget ?? 7));
                if (diffA !== diffB) return diffA - diffB;
                return (pA?.minigameFogTime ?? 15) - (pB?.minigameFogTime ?? 15);
            } else if (activeGameType === 'game-1') {
                // Game 1 (Đua Sức Bền): Ai bấm nhiều nhất xếp trước, nếu hòa thì phản xạ sớm hơn xếp trước
                const tapsA = pA?.minigameTaps ?? 0;
                const tapsB = pB?.minigameTaps ?? 0;
                if (tapsB !== tapsA) return tapsB - tapsA;
                const firstA = pA?.minigameFirstTap ?? 8000;
                const firstB = pB?.minigameFirstTap ?? 8000;
                if (firstA !== firstB) return firstA - firstB;
                return (pB?.minigameScore || 0) - (pA?.minigameScore || 0);
            } else if (activeGameType === 'game-3') {
                // Game 3 (Căn Lực Gió): Tổng điểm 3 lần căn gió cao hơn xếp trước, hòa thì ai có số lần 100đ nhiều hơn xếp trước
                const scoreA = pA?.minigameScore || 0;
                const scoreB = pB?.minigameScore || 0;
                if (scoreB !== scoreA) return scoreB - scoreA;
                const perfA = pA?.minigamePerfectCount || 0;
                const perfB = pB?.minigamePerfectCount || 0;
                return perfB - perfA;
            } else {
                // Game 2 (Phản Xạ Né Khỉ): Tổng điểm 3 lượt ném cao hơn xếp trước, hòa thì né nhanh nhất xếp trước
                const scoreA = pA?.minigameScore || 0;
                const scoreB = pB?.minigameScore || 0;
                if (scoreB !== scoreA) return scoreB - scoreA;
                const bestA = pA?.minigameBestTime ?? 9999;
                const bestB = pB?.minigameBestTime ?? 9999;
                return bestA - bestB;
            }
        });

        gameState.currentRound++;
        gameState.currentTurnIndex = 0;
        gameState.activePlayerId = gameState.turnOrder[0];
        gameState.phase = 'WAITING_ROLL';

        renderTurnPills();
        updateProgressList();
        renderTokens();

        showRoundLeaderboardModal(activeGameType);
    } else {
        gameState.activePlayerId = gameState.turnOrder[gameState.currentTurnIndex];
        gameState.phase = 'WAITING_ROLL';
        renderTurnPills();
        updateProgressList();
        renderTokens();
    }

    const nextActive = gameState.players.find(p => p.id === gameState.activePlayerId);
    if (nextActive) {
        focusCameraOnPlayer(nextActive, true);
    }

    checkOfflineBotTurn();
}

function showRoundLeaderboardModal(finishedGameType = null) {
    if (!dom.roundLeaderboardModal || !dom.leaderboardRankingList) return;

    dom.leaderboardRankingList.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣'];
    const activeGameType = finishedGameType || getCurrentMinigameType();

    if (dom.leaderboardBadge) {
        if (activeGameType === 'game-6') {
            dom.leaderboardBadge.textContent = '🏆 KẾT QUẢ ĐUA THĂNG BẰNG ĐI TRÊN DÂY';
        } else if (activeGameType === 'game-4') {
            dom.leaderboardBadge.textContent = '🏆 KẾT QUẢ ĐUA THỜI GIAN SƯƠNG MÙ';
        } else {
            dom.leaderboardBadge.textContent = '🏆 KẾT QUẢ ĐUA ĐIỂM MINIGAME';
        }
    }
    if (dom.leaderboardDesc) {
        if (activeGameType === 'game-6') {
            dom.leaderboardDesc.textContent = 'Thứ tự tung xúc xắc vòng tiếp theo được xếp từ người trụ vững lâu nhất trên dây cáp đến ngắn nhất!';
        } else if (activeGameType === 'game-4') {
            dom.leaderboardDesc.textContent = 'Thứ tự tung xúc xắc vòng tiếp theo được xếp từ người có độ lệch nhỏ nhất (chuẩn nhất) đến lớn nhất!';
        } else {
            dom.leaderboardDesc.textContent = 'Thứ tự tung xúc xắc vòng tiếp theo được xếp từ người có điểm Minigame cao nhất đến thấp nhất!';
        }
    }

    // Lấy danh sách người chơi sắp xếp theo thứ tự turnOrder mới (đã từ cao xuống thấp)
    gameState.turnOrder.forEach((pid, rank) => {
        const p = gameState.players.find(x => x.id === pid);
        if (!p) return;

        const row = document.createElement('div');
        row.className = `leaderboard-row rank-${rank + 1}`;
        let tapsInfo = '';
        let hintDetail = '';
        if (activeGameType === 'game-6') {
            const survStr = p.minigameSurvivalTime !== undefined ? `${p.minigameSurvivalTime.toFixed(2)}s` : '--';
            tapsInfo = `Trụ: ${survStr}`;
            hintDetail = `🌉 Trụ vững ${survStr} • Lượt ${rank + 1}`;
        } else if (activeGameType === 'game-5') {
            tapsInfo = `${p.minigameScore || 0} điểm`;
            hintDetail = `📸 ${p.minigameVoocHits ?? 0}/24 Voọc • ⚠️ ${p.minigameKhiHits ?? 0}/10 Khỉ • Lượt ${rank + 1}`;
        } else if (activeGameType === 'game-4') {
            const diffStr = p.minigameFogDiff !== undefined ? `±${p.minigameFogDiff.toFixed(2)}s` : '--';
            const stopStr = p.minigameFogTime !== undefined ? `${p.minigameFogTime.toFixed(2)}s` : '--';
            tapsInfo = `Độ lệch: ${diffStr}`;
            hintDetail = `⏱️ Dừng lúc ${stopStr} (Mục tiêu ${p.minigameFogTarget ? p.minigameFogTarget.toFixed(2) : '7.00'}s) • Lượt ${rank + 1}`;
        } else if (activeGameType === 'game-3') {
            const perfStr = p.minigamePerfectCount !== undefined ? ` • ${p.minigamePerfectCount}/3 lần 100đ` : '';
            tapsInfo = `${p.minigameScore || 0} / 300 điểm`;
            hintDetail = `➔ ${p.minigameScore || 0}đ${perfStr} • Lượt ${rank + 1}`;
        } else if (activeGameType === 'game-2') {
            const bestStr = p.minigameBestTime ? ` (Nhanh nhất: ${p.minigameBestTime}ms)` : '';
            tapsInfo = `${p.minigameScore || 0} / 300 điểm`;
            hintDetail = `➔ ${p.minigameScore || 0}đ${bestStr} • Lượt ${rank + 1}`;
        } else {
            tapsInfo = p.minigameTaps !== undefined
                ? `${p.minigameTaps} lần bấm (+${p.minigameTaps * 10}đ)`
                : `${p.minigameScore || 0} điểm`;
            const reflexInfo = p.minigameReflexScore !== undefined
                ? `⚡ +${p.minigameReflexScore}đ px`
                : '';
            hintDetail = `➔ ${p.minigameScore || 0}đ ${reflexInfo} • Lượt ${rank + 1}`;
        }
        row.innerHTML = `
            <div class="leaderboard-player-info">
                <span class="leaderboard-rank-badge">${medals[rank] || `#${rank + 1}`}</span>
                <span class="leaderboard-player-dot" style="background-color: ${p.color};"></span>
                <span class="leaderboard-player-name">${p.name}${p.isBot ? ' 🤖' : (p.id === myPlayerId ? ' (Bạn)' : '')}</span>
            </div>
            <div class="leaderboard-score-info">
                <span class="leaderboard-score-val">${tapsInfo}</span>
                <span class="leaderboard-turn-hint">${hintDetail}</span>
            </div>
        `;
        dom.leaderboardRankingList.appendChild(row);
    });

    dom.roundLeaderboardModal.classList.remove('hidden');
    AudioSFX.playCorrect();

    let autoTimer = setTimeout(() => {
        if (dom.roundLeaderboardModal) dom.roundLeaderboardModal.classList.add('hidden');
    }, 4500);

    if (dom.btnContinueRound) {
        dom.btnContinueRound.onclick = () => {
            clearTimeout(autoTimer);
            dom.roundLeaderboardModal.classList.add('hidden');
        };
    }
}

function handleOfflineRoll() {
    const activeId = gameState.activePlayerId || gameState.turnOrder[gameState.currentTurnIndex];
    const player = gameState.players.find(p => p.id === activeId);
    if (!player || gameState.phase !== 'WAITING_ROLL') return;

    const roll = Math.floor(Math.random() * 6) + 1;
    const initialPos = player.position;
    const landPos = Math.min(BOARD_LENGTH, initialPos + roll);
    const specialTarget = SPECIAL_PATHS[landPos] !== undefined ? SPECIAL_PATHS[landPos] : landPos;

    onDiceRollReceived({
        t: 'dice_roll',
        player: parseInt(player.id.replace('player_', ''), 10) - 1,
        roll: roll,
        from: initialPos,
        to: landPos,
        special: (specialTarget !== landPos) ? specialTarget : 0,
        finalPos: specialTarget
    });
}

function checkOfflineBotTurn() {
    if (socket && socket.readyState === WebSocket.OPEN) return;
    const activeId = gameState.activePlayerId || gameState.turnOrder[gameState.currentTurnIndex];
    const player = gameState.players.find(p => p.id === activeId);
    if (player && player.isBot && gameState.phase === 'WAITING_ROLL') {
        setTimeout(() => {
            if (gameState.phase === 'WAITING_ROLL') {
                handleOfflineRoll();
            }
        }, 1300);
    }
}

async function triggerMinigame(gameType = 'game-1', targetPlayer = null) {
    if (!window.MinigameManager) {
        console.warn('[Minigame] MinigameManager chưa sẵn sàng.');
        return { win: false, score: 50, bonusSteps: 0 };
    }

    const player = targetPlayer || gameState.players.find(p => p.id === gameState.activePlayerId) || gameState.players[0];
    addGameLog(`🎮 <strong>[THỬ THÁCH MINIGAME]</strong> <strong>${player ? player.name : 'Người chơi'}</strong> bắt đầu thử thách tính điểm!`);

    try {
        const launchOpts = { player };
        if (gameType === 'game-4') {
            launchOpts.targetSec = getOrGenerateFogTargetForRound();
        }
        const result = await window.MinigameManager.launch(gameType, launchOpts);
        const score = typeof result.score === 'number' ? result.score : (result.win ? 200 : 50);
        result.score = score;
        return result;
    } catch (err) {
        console.error('[Minigame] Lỗi thực thi mini-game:', err);
        return { win: false, score: 50, bonusSteps: 0 };
    }
}
window.triggerMinigame = triggerMinigame;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGame);
} else {
    initGame();
}

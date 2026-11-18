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

// Các ô Hộp Vật Phẩm / Tiếp Tế Sơn Trà (Nhận ngẫu nhiên 1 vật phẩm khi đáp xuống)
const ITEM_TILES = [7, 14, 23, 35, 44];

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
    playClick() {
        if (!soundEnabled || !audioCtx) return;
        try {
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.04);
        } catch (e) {}
    },

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
    },

    playRocketSFX() {
        if (!soundEnabled || !audioCtx) return;
        try {
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(160, now);
            osc.frequency.exponentialRampToValueAtTime(880, now + 0.45);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.45);
        } catch (e) {}
    },

    playExplosionSFX() {
        if (!soundEnabled || !audioCtx) return;
        try {
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(110, now);
            osc.frequency.exponentialRampToValueAtTime(32, now + 0.5);
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.5);
        } catch (e) {}
    },

    playBuffSFX() {
        if (!soundEnabled || !audioCtx) return;
        try {
            const now = audioCtx.currentTime;
            [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(f, now + i * 0.06);
                gain.gain.setValueAtTime(0.14, now + i * 0.06);
                gain.gain.exponentialRampToValueAtTime(0.001, now + (i + 1) * 0.08);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now + i * 0.06);
                osc.stop(now + (i + 1) * 0.08);
            });
        } catch (e) {}
    },

    playHookSFX() {
        if (!soundEnabled || !audioCtx) return;
        try {
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(750, now);
            osc.frequency.linearRampToValueAtTime(220, now + 0.35);
            gain.gain.setValueAtTime(0.22, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.35);
        } catch (e) {}
    },

    playTeleportSFX() {
        if (!soundEnabled || !audioCtx) return;
        try {
            const now = audioCtx.currentTime;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.linearRampToValueAtTime(1250, now + 0.2);
            osc.frequency.linearRampToValueAtTime(420, now + 0.4);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now);
            osc.stop(now + 0.4);
        } catch (e) {}
    },

    playItemGetSFX() {
        if (!soundEnabled || !audioCtx) return;
        try {
            const now = audioCtx.currentTime;
            [440, 554.37, 659.25, 880].forEach((f, i) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(f, now + i * 0.07);
                gain.gain.setValueAtTime(0.18, now + i * 0.07);
                gain.gain.exponentialRampToValueAtTime(0.01, now + (i + 1) * 0.1);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now + i * 0.07);
                osc.stop(now + (i + 1) * 0.1);
            });
        } catch (e) {}
    },

    playStunSFX() {
        if (!soundEnabled || !audioCtx) return;
        try {
            const now = audioCtx.currentTime;
            for (let i = 0; i < 4; i++) {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(280 + (i % 2 === 0 ? 80 : -70), now + i * 0.11);
                gain.gain.setValueAtTime(0.16, now + i * 0.11);
                gain.gain.exponentialRampToValueAtTime(0.01, now + (i + 1) * 0.11);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(now + i * 0.11);
                osc.stop(now + (i + 1) * 0.11);
            }
        } catch (e) {}
    }
};

// ==========================================================================
// 3. Trạng Thái Toàn Cục (GameState) & Cấu Hình Mặc Định (12 Con Giáp Cute)
// ==========================================================================
const CHARACTER_ROSTER = [
    { id: 'cat', zodiac: 'Mão (Mèo)', name: 'Mèo Mướp Cute', icon: '🐱', color: '#fb7185', desc: 'Mèo con tinh nghịch, nhanh nhẹn và tò mò' },
    { id: 'dog', zodiac: 'Tuất (Chó)', name: 'Cún Cưng Lon Ton', icon: '🐶', color: '#f59e0b', desc: 'Chú cún vui vẻ, trung thành và năng động' },
    { id: 'mouse', zodiac: 'Tý (Chuột)', name: 'Chuột Tí Nị', icon: '🐭', color: '#38bdf8', desc: 'Chuột nhắt thông minh, thoăn thoắt và lém lỉnh' },
    { id: 'tiger', zodiac: 'Dần (Hổ)', name: 'Hổ Con Dũng Mãnh', icon: '🐯', color: '#f97316', desc: 'Hổ nhí gầm gừ oai vệ, dũng cảm phi thường' },
    { id: 'buffalo', zodiac: 'Sửu (Trâu)', name: 'Trâu Bé Bự', icon: '🐮', color: '#10b981', desc: 'Trâu con chăm chỉ, hiền lành và bền bỉ' },
    { id: 'dragon', zodiac: 'Thìn (Rồng)', name: 'Rồng Bay Tí Hon', icon: '🐲', color: '#a855f7', desc: 'Rồng con thần bí, bay lượn hô phong hoán vũ' },
    { id: 'snake', zodiac: 'Tỵ (Rắn)', name: 'Rắn Xanh Láu Lỉnh', icon: '🐍', color: '#14b8a6', desc: 'Bé rắn xanh lục, khôn ngoan và bí ẩn' },
    { id: 'horse', zodiac: 'Ngọ (Ngựa)', name: 'Ngựa Phi Thần Tốc', icon: '🐴', color: '#ef4444', desc: 'Ngựa phi nước đại, nhiệt huyết không ngại xa' },
    { id: 'goat', zodiac: 'Mùi (Dê)', name: 'Dê Núi Nhí Nhảnh', icon: '🐐', color: '#84cc16', desc: 'Dê con tinh nghịch thích leo vách đá cao' },
    { id: 'monkey', zodiac: 'Thân (Khỉ)', name: 'Khỉ Nâu Tinh Quái', icon: '🐵', color: '#d97706', desc: 'Khỉ mê chuối leo trèo chuyền cành siêu đẳng' },
    { id: 'rooster', zodiac: 'Dậu (Gà)', name: 'Gà Choai Bảnh Bao', icon: '🐔', color: '#eab308', desc: 'Gà trống cất tiếng gáy vang đón bình minh' },
    { id: 'pig', zodiac: 'Hợi (Heo)', name: 'Heo Hồng Ủn Ỉn', icon: '🐷', color: '#ec4899', desc: 'Bé heo má phính, phúc hậu yêu đời may mắn' }
];

const DEFAULT_PRESETS = CHARACTER_ROSTER.map((c, idx) => ({
    name: c.name,
    color: c.color,
    avatarIcon: c.icon,
    charId: c.id,
    isBot: false
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
    headerPullHandle: document.getElementById('headerPullHandle'),
    pullHandleRound: document.getElementById('pullHandleRound'),
    gameHeader: document.getElementById('gameHeader'),
    btnCloseHeaderDrawer: document.getElementById('btnCloseHeaderDrawer'),
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
    btnCloseCharacterModal: document.getElementById('btnCloseCharacterModal'),

    // Inventory & Target Selection
    inventorySection: document.getElementById('inventorySection'),
    inventoryTitle: document.getElementById('inventoryTitle'),
    inventoryCountBadge: document.getElementById('inventoryCountBadge'),
    inventorySlots: document.getElementById('inventorySlots'),
    targetSelectModal: document.getElementById('targetSelectModal'),
    targetSelectBadge: document.getElementById('targetSelectBadge'),
    targetSelectTitle: document.getElementById('targetSelectTitle'),
    targetSelectDesc: document.getElementById('targetSelectDesc'),
    targetSelectList: document.getElementById('targetSelectList'),
    btnCancelTargetSelect: document.getElementById('btnCancelTargetSelect'),

    // Item Reward Modal (Thông báo chúc mừng nhận vật phẩm)
    itemRewardModal: document.getElementById('itemRewardModal'),
    itemRewardSub: document.getElementById('itemRewardSub'),
    itemRewardIcon: document.getElementById('itemRewardIcon'),
    itemRewardName: document.getElementById('itemRewardName'),
    itemRewardBadge: document.getElementById('itemRewardBadge'),
    itemRewardDesc: document.getElementById('itemRewardDesc'),
    btnClaimItemReward: document.getElementById('btnClaimItemReward')
};

const ctx = dom.canvas.getContext('2d');
const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 600;
dom.canvas.width = CANVAS_WIDTH;
dom.canvas.height = CANVAS_HEIGHT;

function resizeBoardCanvas() {
    const container = dom.boardContainer || (dom.canvas && dom.canvas.parentElement);
    if (!container || !dom.canvas) return;

    const rect = container.getBoundingClientRect();
    const clientW = Math.round(rect.width);
    const clientH = Math.round(rect.height || (rect.width * CANVAS_HEIGHT / CANVAS_WIDTH));
    if (!clientW || !clientH) return;

    const pixelRatio = window.devicePixelRatio || 1;
    // Khớp 1:1 với điểm ảnh màn hình (Retina sharpness)
    const dpr = Math.min(2.5, Math.max(1.5, pixelRatio));

    const newW = Math.round(clientW * dpr);
    const newH = Math.round(clientH * dpr);

    if (dom.canvas.width !== newW || dom.canvas.height !== newH) {
        dom.canvas.width = newW;
        dom.canvas.height = newH;
    }
    dom.canvas.style.width = '100%';
    dom.canvas.style.height = '100%';
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

// Smooth Viewport Camera Controller (Lerp 60 FPS)
let camX = 85;
let camY = 515;
let camZoom = 3.8;

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

function updateCamera(smooth = true, durationMs = 400) {
    if (!smooth) {
        camX = isCameraZoomed ? currentTargetCoord.x : (CANVAS_WIDTH / 2);
        camY = isCameraZoomed ? currentTargetCoord.y : (CANVAS_HEIGHT / 2);
        camZoom = isCameraZoomed ? currentCameraScale : 1.0;
    }

    if (dom.boardCameraWrapper) {
        dom.boardCameraWrapper.style.transform = 'none';
        dom.boardCameraWrapper.style.transition = 'none';
    }

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

    // Cập nhật giao diện túi đồ của người chơi đang tới lượt
    renderPlayerInventory();

    if (gameState.phase === 'WAITING_ROLL') {
        if (activePlayer.hasDoubleBuff) {
            dom.btnRollDice.classList.add('buff-x2-active');
            if (isMyTurn) {
                dom.btnRollDice.disabled = false;
                dom.btnRollDice.classList.add('pulse-active');
                dom.btnRollDice.querySelector('.roll-text').textContent = '🎲✨ TUNG XÚC XẮC (X2 BƯỚC ĐI!)';
                dom.turnStatusLabel.textContent = '⚡ ĐANG KÍCH HOẠT X2 BƯỚC ĐI!';
            } else if (isHost) {
                dom.btnRollDice.classList.remove('pulse-active');
                dom.btnRollDice.disabled = !isBotTurn;
                dom.btnRollDice.querySelector('.roll-text').textContent = isBotTurn
                    ? `🤖 TUNG X2 CHO ${activePlayer.name.toUpperCase()}`
                    : `ĐANG CHỜ ${activePlayer.name.toUpperCase()} TUNG X2...`;
                dom.turnStatusLabel.textContent = `LƯỢT CỦA: ${activePlayer.name.toUpperCase()} (X2 BƯỚC)`;
            } else {
                dom.btnRollDice.classList.remove('pulse-active');
                dom.btnRollDice.disabled = true;
                dom.btnRollDice.querySelector('.roll-text').textContent = `ĐANG CHỜ ${activePlayer.name.toUpperCase()} TUNG X2...`;
                dom.turnStatusLabel.textContent = `LƯỢT CỦA: ${activePlayer.name.toUpperCase()} (X2 BƯỚC)`;
            }
        } else {
            dom.btnRollDice.classList.remove('buff-x2-active');
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
        }
    } else if (gameState.phase === 'MINIGAME') {
        dom.btnRollDice.classList.remove('buff-x2-active');
        dom.btnRollDice.disabled = true;
        dom.btnRollDice.classList.remove('pulse-active');
        dom.btnRollDice.querySelector('.roll-text').textContent = '🎮 ĐANG THI ĐẤU MINIGAME...';
        dom.turnStatusLabel.textContent = `MINIGAME VÒNG ${gameState.currentRound}`;
        if (!gameState.isAnimatingMove) {
            triggerRoundMinigamePhase();
        }
    } else {
        dom.btnRollDice.classList.remove('buff-x2-active');
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
    // Đã chuyển toàn bộ sang vẽ trực tiếp trên Canvas với tỷ lệ sắc nét Retina 100%
    const svgGroup = dom.svgPathsGroup || document.getElementById('svgPathsGroup');
    if (svgGroup) svgGroup.innerHTML = '';
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

        // Nếu là thiết bị khách, tự động gửi tên và linh thú đã lưu trong máy lên ESP32
        if (!isHost) {
            let savedName = null;
            let savedAvatar = null;
            let savedColor = null;
            try {
                savedName = localStorage.getItem('player_custom_name');
                savedAvatar = localStorage.getItem('player_custom_avatar');
                savedColor = localStorage.getItem('player_custom_color');
            } catch (_) {}
            if (savedName || savedAvatar) {
                sendWs({
                    t: 'join_game',
                    name: savedName || undefined,
                    avatar: savedAvatar || undefined,
                    color: savedColor || undefined
                });
            }
        }
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
    const connectedHumans = Math.max(1, gameState.players.filter(p => p.connected && !p.isBot).length);
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
            isBot: (i >= connectedHumans),
            connected: false,
            stats: { totalRolls: 0 },
            minigameScore: 0,
            totalMinigameScore: 0,
            items: (gameState.phase !== 'SETUP') ? [(typeof getRandomItem === 'function' ? getRandomItem().id : 'rocket')] : []
        });
    }
    gameState.turnOrder = gameState.players.map(p => p.id);
    resetMinigameAppearanceStats();
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
            <span class="char-zodiac-tag">${char.zodiac || ''}</span>
            <span class="char-card-badge">✨ ĐÃ CHỌN</span>
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
            if (socket && socket.readyState === WebSocket.OPEN && isHost) {
                sendWs({
                    t: 'set_player_info',
                    index: slotIndex,
                    name: p.name,
                    avatar: p.avatarIcon,
                    color: p.color,
                    isBot: Boolean(p.isBot)
                });
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
            try {
                localStorage.setItem('player_custom_avatar', char.icon);
                localStorage.setItem('player_custom_color', char.color);
                localStorage.setItem('player_custom_name', myP.name);
            } catch (_) {}
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
            showBanner(`ĐÃ CHỌN LINH THÚ: ${char.name.toUpperCase()} ${char.icon}`);
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
            <span class="char-zodiac-tag">${char.zodiac || ''}</span>
            <span class="char-card-badge">✨ ĐÃ CHỌN</span>
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
    // Đếm số người thật đang kết nối (Host luôn là người thật ở slot 0)
    const connectedHumans = Math.max(1, gameState.players.filter(p => p.connected && !p.isBot).length);

    for (let i = 0; i < count; i++) {
        const p = gameState.players[i] || DEFAULT_PRESETS[i] || DEFAULT_PRESETS[0];
        const isHostSlot = (i === 0);
        const isConnectedHuman = isHostSlot || (p.connected && !p.isBot);
        // Chỉ hiển thị chọn chơi với bot khi máy host chọn chế độ số người chơi nhiều hơn người tham gia
        const isExtraSlot = (i >= connectedHumans);

        // Với các slot người thật, p.isBot luôn là false
        if (isConnectedHuman) {
            p.isBot = false;
        } else if (p.isBot === undefined) {
            p.isBot = true;
        }

        const row = document.createElement('div');
        row.className = 'player-input-row';

        let badgeOrBotHtml = '';
        if (isHostSlot) {
            badgeOrBotHtml = `<span class="slot-badge-human host">👑 Bạn (Host)</span>`;
        } else if (isConnectedHuman) {
            badgeOrBotHtml = `<span class="slot-badge-human">📱 Đã vào</span>`;
        } else {
            // Slot bổ sung do Host chọn nhiều hơn số người thật:
            // Hiển thị nút để Host chuyển đổi Bot AI hoặc Người chơi chung
            badgeOrBotHtml = `
                <button type="button" class="bot-toggle ${p.isBot ? 'active' : ''}" id="btnBotToggle_${i}" title="Chuyển đổi Bot AI / Người chơi">
                    ${p.isBot ? '🤖 Bot AI' : '👤 Người'}
                </button>
            `;
        }

        row.innerHTML = `
            <button type="button" class="char-select-btn" id="btnCharSelect_${i}" title="Bấm để chọn linh thú 12 con giáp">
                <span class="char-btn-icon">${p.avatarIcon || '🐱'}</span>
                <span class="char-btn-edit">✏️</span>
            </button>
            <div class="color-indicator" style="background-color: ${p.color}; box-shadow: 0 0 8px ${p.color};"></div>
            <input type="text" class="player-name-input" id="inputPlayerName_${i}" value="${p.name}" placeholder="Tên người chơi ${i + 1}" maxlength="20">
            ${badgeOrBotHtml}
        `;
        dom.playerInputsContainer.appendChild(row);

        const charBtn = row.querySelector(`#btnCharSelect_${i}`);
        if (charBtn) {
            charBtn.addEventListener('click', () => {
                openCharacterSelectModal(i);
            });
        }

        const botBtn = row.querySelector(`#btnBotToggle_${i}`);
        if (botBtn) {
            botBtn.addEventListener('click', () => {
                p.isBot = !p.isBot;
                botBtn.classList.toggle('active', p.isBot);
                botBtn.textContent = p.isBot ? '🤖 Bot AI' : '👤 Người';
                if (socket && socket.readyState === WebSocket.OPEN && isHost) {
                    sendWs({
                        t: 'set_player_info',
                        index: i,
                        name: p.name,
                        avatar: p.avatarIcon,
                        color: p.color,
                        isBot: Boolean(p.isBot)
                    });
                }
            });
        }

        const nameInput = row.querySelector(`#inputPlayerName_${i}`);
        if (nameInput) {
            const handleNameUpdate = () => {
                const newName = nameInput.value.trim() || `Người chơi ${i + 1}`;
                p.name = newName;
                if (socket && socket.readyState === WebSocket.OPEN && isHost) {
                    sendWs({
                        t: 'set_player_info',
                        index: i,
                        name: p.name,
                        avatar: p.avatarIcon,
                        color: p.color,
                        isBot: Boolean(p.isBot)
                    });
                }
            };
            nameInput.addEventListener('change', handleNameUpdate);
            nameInput.addEventListener('blur', handleNameUpdate);
            nameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    nameInput.blur();
                }
            });
        }
    }
}

dom.playerCountGroup.querySelectorAll('.btn-select').forEach(btn => {
    btn.addEventListener('click', () => {
        if (socket && socket.readyState === WebSocket.OPEN && !isHost) return;
        const count = parseInt(btn.getAttribute('data-count'), 10);
        const connectedHumans = Math.max(1, gameState.players.filter(p => p.connected && !p.isBot).length);
        if (count < connectedHumans) {
            showBanner(`⚠️ PHÒNG ĐÃ CÓ ${connectedHumans} NGƯỜI CHƠI THẬT!`);
            return;
        }
        dom.playerCountGroup.querySelectorAll('.btn-select').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        syncPlayerCount(count);
        sendWs({ t: 'set_player_count', count: count });
    });
});

function updateRoundDisplay(round = gameState.currentRound) {
    if (dom.currentRoundDisplay) {
        dom.currentRoundDisplay.textContent = round;
    }
    if (dom.pullHandleRound) {
        dom.pullHandleRound.textContent = round;
    }
}

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
    const connectedHumans = Math.max(1, gameState.players.filter(p => p.connected && !p.isBot).length);

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
            isBot: (i >= connectedHumans),
            connected: false,
            stats: { totalRolls: 0 },
            minigameScore: 0,
            totalMinigameScore: 0,
            items: (gameState.phase !== 'SETUP') ? [(typeof getRandomItem === 'function' ? getRandomItem().id : 'rocket')] : []
        });
    }

    // Đặt lại đúng vị trí ô số 0 xuất phát cho các người chơi tham gia
    gameState.players.forEach((p, idx) => {
        p.position = 0;
        p.visualPos = 0;
        p.customCoord = null;
        p.items = (typeof getRandomItem === 'function') ? [getRandomItem().id] : ['rocket'];
        p.hasDoubleBuff = false;
        p.skipTurnStatus = null;
        p.isStunned = false;
        if (idx === 0 || p.connected) {
            p.isBot = false;
        }
    });

    // Xáo trộn ngẫu nhiên thứ tự lượt đi một lần duy nhất ở Vòng 1 khi bắt đầu ván đấu
    const initialOrder = gameState.players.map(p => p.id);
    for (let i = initialOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [initialOrder[i], initialOrder[j]] = [initialOrder[j], initialOrder[i]];
    }
    gameState.turnOrder = initialOrder;
    gameState.currentRound = 1;
    updateRoundDisplay(1);
    gameState.currentTurnIndex = 0;
    gameState.activePlayerId = gameState.turnOrder[0];
    gameState.phase = 'WAITING_ROLL';
    gameState.winner = null;
    gameState.isAnimatingMove = false;
    isMinigameSessionActive = false;
    resetMinigameAppearanceStats();

    // 4. Ẩn modal và cập nhật giao diện
    if (dom.setupModal) dom.setupModal.classList.add('hidden');
    if (dom.victoryModal) dom.victoryModal.classList.add('hidden');

    renderTurnPills();
    updateProgressList();
    renderPlayerInventory();
    renderTokens();
    renderSpecialPathsSvg();
    addGameLog('🎁 <strong>[GÓI QUÀ KHỞI ĐẦU]</strong> Tất cả 12 con giáp đều đã được trang bị 1 vật phẩm chiến thuật để mở màn!');

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
    updateRoundDisplay(1);
    gameState.currentTurnIndex = 0;
    gameState.activePlayerId = null;
    gameState.winner = null;
    gameState.isAnimatingMove = false;
    isMinigameSessionActive = false;
    resetMinigameAppearanceStats();
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
            totalMinigameScore: 0,
            items: (gameState.phase !== 'SETUP') ? [(typeof getRandomItem === 'function' ? getRandomItem().id : 'rocket')] : []
        });
    }
    gameState.turnOrder = gameState.players.map(p => p.id);
    resetMinigameAppearanceStats();

    // 4. Hiển thị lại modal Setup và ẩn các modal ván đấu
    if (window.MinigameManager) window.MinigameManager.forceClose();
    if (dom.victoryModal) dom.victoryModal.classList.add('hidden');
    if (dom.diceOverlay) dom.diceOverlay.classList.add('hidden');
    if (dom.setupModal) dom.setupModal.classList.remove('hidden');

    renderSetupInputs(currentSelectedCount);
    updateProgressList();
    renderPlayerInventory();
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
        const finalName = (nameInput ? nameInput.value.trim() : '') || p.name;
        names.push(finalName);
        // Slot 0 là Host (người thật). Các slot có người thật kết nối KHÔNG BAO GIỜ gán bot!
        const isRealHuman = (i === 0) || (p.connected && !p.isBot);
        botFlags.push(isRealHuman ? false : Boolean(p.isBot));
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
        try { localStorage.setItem('player_custom_name', val); } catch (_) {}
        const myP = gameState.players.find(p => p.id === myPlayerId);
        if (myP) {
            myP.name = val;
            if (dom.myPlayerSlotName) {
                dom.myPlayerSlotName.textContent = `${val} (${myP.avatarIcon || ''})`;
            }
        }
        sendWs({
            t: 'join_game',
            name: val,
            avatar: myP ? myP.avatarIcon : undefined,
            color: myP ? myP.color : undefined
        });
        showBanner(`ĐÃ ĐỔI TÊN THÀNH: ${val.toUpperCase()}`);
    }
});

if (dom.inputMyCustomName) {
    dom.inputMyCustomName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            dom.btnSaveMyName.click();
        }
    });
}

function onGameStateReceived(msg) {
    if (typeof msg.isHost === 'boolean') {
        isHost = msg.isHost;
        if (msg.hostIp) currentHostIp = msg.hostIp;
        updateRoleUI();
    }

    const prevRound = gameState.currentRound;
    gameState.currentRound = msg.round;
    updateRoundDisplay(msg.round);
    gameState.currentTurnIndex = msg.turnIndex;
    gameState.phase = msg.phase;

    // Khi server thông báo chuyển sang giai đoạn MINIGAME của vòng
    if (gameState.phase === 'MINIGAME' && !isMinigameSessionActive && gameState.phase !== 'SETUP') {
        if (!gameState.isAnimatingMove) {
            setTimeout(() => {
                triggerRoundMinigamePhase();
            }, 350);
        }
    }

    // Số lượng người chơi tham gia ván đấu:
    // CHỈ cập nhật nếu server gửi rõ ràng trường msg.playerCount hợp lệ (2 đến 6).
    if (typeof msg.playerCount === 'number' && msg.playerCount >= 2 && msg.playerCount <= 6) {
        currentSelectedCount = msg.playerCount;
    }
    currentSelectedCount = Math.max(2, Math.min(6, currentSelectedCount || 2));

    const connectedCount = msg.players ? msg.players.filter(p => p.conn && !p.isBot).length : 1;
    dom.playerCountGroup.querySelectorAll('.btn-select').forEach(btn => {
        const c = parseInt(btn.getAttribute('data-count'), 10);
        btn.classList.toggle('active', c === currentSelectedCount);
        if (c < connectedCount) {
            btn.classList.add('disabled');
            btn.style.opacity = '0.38';
            btn.style.pointerEvents = isHost ? 'none' : '';
        } else {
            btn.classList.remove('disabled');
            btn.style.opacity = '';
            btn.style.pointerEvents = '';
        }
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
                    avatarIcon: pData.avatar || DEFAULT_PRESETS[pData.id]?.avatarIcon || '🐱',
                    position: typeof pData.pos === 'number' ? pData.pos : 0,
                    visualPos: typeof pData.pos === 'number' ? pData.pos : 0,
                    isBot: Boolean(pData.isBot),
                    connected: Boolean(pData.conn),
                    stats: { totalRolls: pData.rolls || 0 },
                    minigameScore: typeof pData.score === 'number' ? pData.score : 0,
                    totalMinigameScore: typeof pData.totalScore === 'number' ? pData.totalScore : 0,
                    items: (gameState.phase !== 'SETUP') ? [(typeof getRandomItem === 'function' ? getRandomItem().id : 'rocket')] : []
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
                if (gameState.phase !== 'SETUP' && (!Array.isArray(p.items) || p.items.length === 0)) {
                    p.items = [(typeof getRandomItem === 'function' ? getRandomItem().id : 'rocket')];
                }
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
                stats: { totalRolls: 0 },
                items: (gameState.phase !== 'SETUP') ? [(typeof getRandomItem === 'function' ? getRandomItem().id : 'rocket')] : []
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
                dom.myPlayerAvatar.textContent = myP.avatarIcon || '🐱';
                dom.myPlayerSlotName.textContent = `${myP.name} (${myP.avatarIcon || ''})`;
                if (!dom.inputMyCustomName.value) {
                    dom.inputMyCustomName.value = myP.name;
                }
                renderGuestCharacterGrid();
            }
            dom.lobbyPlayersList.innerHTML = '';
            gameState.players.filter(p => allowedPlayerIds.has(p.id)).forEach(p => {
                const chip = document.createElement('div');
                const isMe = (p.id === myPlayerId);
                const isHostSlot = (p.id === 'player_1');
                chip.className = `lobby-player-chip ${isMe ? 'my-chip' : (isHostSlot ? 'host-chip' : (p.isBot ? 'bot-chip' : ''))}`;
                let roleTag = '';
                if (isMe) {
                    roleTag = ' ⭐ (Bạn)';
                } else if (isHostSlot) {
                    roleTag = ' 👑 (Host)';
                } else if (p.isBot) {
                    roleTag = ' 🤖 (Bot AI)';
                } else {
                    roleTag = ' 📱 (Người chơi)';
                }
                chip.innerHTML = `
                    <span class="dot" style="background:${p.color}; box-shadow: 0 0 6px ${p.color};">${p.avatarIcon || '🐱'}</span>
                    <span>${p.name}${roleTag}</span>
                `;
                dom.lobbyPlayersList.appendChild(chip);
            });
            if (dom.playerWaitingText) {
                const humanCount = gameState.players.filter(p => allowedPlayerIds.has(p.id) && !p.isBot).length;
                const botCount = currentSelectedCount - humanCount;
                dom.playerWaitingText.textContent = `Phòng có ${currentSelectedCount} người chơi (${humanCount} người thật${botCount > 0 ? `, ${botCount} Bot AI` : ''}). Đang chờ Host bắt đầu!`;
            }
        } else {
            const isTyping = document.activeElement && document.activeElement.classList.contains('player-name-input');
            if (!isTyping) {
                renderSetupInputs(currentSelectedCount);
            }
        }
        renderTokens();
        renderSpecialPathsSvg();
        isCameraZoomed = false;
        updateCamera(false);
        return;
    }

    // Nếu trận đấu đã bắt đầu
    dom.setupModal.classList.add('hidden');
    // Đảm bảo 100% tất cả người chơi đều có ít nhất 1 vật phẩm khởi đầu ngẫu nhiên
    gameState.players.forEach(p => {
        if (!Array.isArray(p.items) || p.items.length === 0) {
            p.items = [(typeof getRandomItem === 'function') ? getRandomItem().id : 'rocket'];
        }
    });
    renderTurnPills();
    updateProgressList();
    renderPlayerInventory();
    renderTokens();

    const activeId = gameState.turnOrder[gameState.currentTurnIndex];
    gameState.activePlayerId = activeId;
    const activePlayer = gameState.players.find(p => p.id === activeId);

    if (activePlayer) {
        dom.activePlayerAvatar.style.backgroundColor = activePlayer.color;
        dom.activePlayerAvatar.style.boxShadow = `0 0 15px ${activePlayer.color}`;
        dom.activePlayerAvatar.textContent = activePlayer.avatarIcon || '🐱';
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
        dom.dicePlayerDot.textContent = player.avatarIcon || '🐱';
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
            dom.diceActionTitle.textContent = msg.isDouble
                ? `${player.name} tung được ${msg.roll} chấm (X2 = ${msg.effectiveSteps} bước)!`
                : `${player.name} tung được ${msg.roll} chấm!`;
        }
        if (dom.diceOutcomeText) {
            dom.diceOutcomeText.textContent = msg.isDouble
                ? `+${msg.effectiveSteps} BƯỚC (X2!)`
                : `+${msg.roll} BƯỚC`;
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

                addGameLog(msg.isDouble
                    ? `🎲⚡ <strong>[${player.name}]</strong> Tung được <strong>${msg.roll} chấm</strong> (${DICE_FACES[msg.roll - 1]}). Kích hoạt Bùa X2 ➔ Bước <strong>+${msg.effectiveSteps} ô</strong> từ ${msg.from} ➔ <strong>ô ${msg.to}</strong>.`
                    : `🎲 <strong>[${player.name}]</strong> Tung được <strong>${msg.roll} chấm</strong> (${DICE_FACES[msg.roll - 1]}). Bước từ ô ${msg.from} ➔ <strong>ô ${msg.to}</strong>.`);

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
                                    if (typeof checkItemTileLanding === 'function') {
                                        checkItemTileLanding(player);
                                    }
                                    setTimeout(() => {
                                        onPlayerMovementFinished(player);
                                    }, 400);
                                }
                            });
                        }, 500);
                    } else {
                        if (player.position >= BOARD_LENGTH) {
                            triggerVictory(player);
                        } else {
                            if (typeof checkItemTileLanding === 'function') {
                                checkItemTileLanding(player);
                            }
                            setTimeout(() => {
                                onPlayerMovementFinished(player);
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

        // Camera di chuyển bám sát tức thì theo vị trí trượt thời gian thực của quân cờ
        focusCameraOnCoord(player.customCoord.x, player.customCoord.y, false, 0);

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

// Quản lý Drawer Kính Mờ Bảng Điều Hành & Âm Thanh (Header Drawer)
function toggleHeaderDrawer(open) {
    if (!dom.gameHeader) return;
    const shouldOpen = (open !== undefined) ? open : !dom.gameHeader.classList.contains('drawer-open');
    if (shouldOpen) {
        dom.gameHeader.classList.add('drawer-open');
        if (dom.headerPullHandle) dom.headerPullHandle.classList.add('active');
    } else {
        dom.gameHeader.classList.remove('drawer-open');
        if (dom.headerPullHandle) dom.headerPullHandle.classList.remove('active');
    }
}

if (dom.headerPullHandle) {
    dom.headerPullHandle.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleHeaderDrawer();
    });

    // Hỗ trợ cử chỉ vuốt xuống trên tab kéo mờ để mở drawer
    let pullTouchStartY = 0;
    dom.headerPullHandle.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches[0]) {
            pullTouchStartY = e.touches[0].clientY;
        }
    }, { passive: true });
    dom.headerPullHandle.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches[0]) {
            const deltaY = e.changedTouches[0].clientY - pullTouchStartY;
            if (deltaY > 20) {
                toggleHeaderDrawer(true);
            }
        }
    }, { passive: true });
}

if (dom.btnCloseHeaderDrawer) {
    dom.btnCloseHeaderDrawer.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleHeaderDrawer(false);
    });
}

// Bấm ra ngoài bảng header drawer để tự động thu gọn
document.addEventListener('click', (e) => {
    if (dom.gameHeader && dom.gameHeader.classList.contains('drawer-open')) {
        if (!dom.gameHeader.contains(e.target) && (!dom.headerPullHandle || !dom.headerPullHandle.contains(e.target))) {
            toggleHeaderDrawer(false);
        }
    }
});

// Vuốt lên trên bảng header drawer để thu gọn
if (dom.gameHeader) {
    let headerTouchStartY = 0;
    dom.gameHeader.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches[0]) {
            headerTouchStartY = e.touches[0].clientY;
        }
    }, { passive: true });
    dom.gameHeader.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches[0]) {
            const deltaY = e.changedTouches[0].clientY - headerTouchStartY;
            if (deltaY < -30) {
                toggleHeaderDrawer(false);
            }
        }
    }, { passive: true });
}

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
            <div class="pill-dot" style="font-size: 0.85rem; line-height: 1; display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background: ${player.color}; box-shadow: 0 0 6px ${player.color};">${player.avatarIcon || '🐱'}</div>
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
        const itemIcons = Array.isArray(p.items) && p.items.length > 0
            ? p.items.map(id => (typeof ITEM_DEFINITIONS !== 'undefined' && ITEM_DEFINITIONS[id]) ? ITEM_DEFINITIONS[id].icon : '🎒').join(' ')
            : 'Túi trống';
        const stunHtml = p.isStunned ? '<span class="stun-badge">💫 Choáng</span>' : '';
        card.innerHTML = `
            <div class="progress-header">
                <span style="color: ${p.color};">${p.avatarIcon || '🐱'} #${rank + 1} ${p.name}${p.isBot ? ' 🤖' : (p.id === myPlayerId ? ' ⭐' : '')} ${stunHtml}</span>
                <span>Ô ${p.position} / 50 • 🎒 ${itemIcons}</span>
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
    if (boardAnimFrameId !== null) return;

    lastBoardTimestamp = performance.now();

    function loop(now) {
        if (!now) now = performance.now();
        const dt = Math.min(0.1, Math.max(0.001, (now - lastBoardTimestamp) / 1000));
        lastBoardTimestamp = now;

        // Cập nhật vị trí camera bám theo mục tiêu siêu mượt mà (Smooth 60 FPS Camera Lerp)
        const targetZoom = isCameraZoomed ? currentCameraScale : 1.0;
        const targetFocusX = isCameraZoomed ? currentTargetCoord.x : (CANVAS_WIDTH / 2);
        const targetFocusY = isCameraZoomed ? currentTargetCoord.y : (CANVAS_HEIGHT / 2);

        const lerpFactor = 0.16;
        camX += (targetFocusX - camX) * lerpFactor;
        camY += (targetFocusY - camY) * lerpFactor;
        camZoom += (targetZoom - camZoom) * lerpFactor;

        updateNatureElements(dt, now);
        drawBoard();

        boardAnimFrameId = requestAnimationFrame(loop);
    }

    boardAnimFrameId = requestAnimationFrame(loop);
}

// ==========================================================================
// 12. Quản Lý Bàn Cờ Siêu Nét & Viewport Culling (Tối Ưu Hiệu Năng Vùng Nhìn)
// ==========================================================================
function renderTokens() {
    drawBoard();
}

function updateBoard() {
    renderTokens();
}

function renderStaticBoard() {
    // Không dùng buffer tĩnh thu nhỏ để tránh bị mờ vỡ điểm ảnh
}

// 1. Sườn Núi Sơn Trà Đỉnh Bàn Cờ
function drawSontraHill(c) {
    c.save();
    // Dãy đồi xa phía sau
    const backHillGrad = c.createLinearGradient(450, 600, 450, 200);
    backHillGrad.addColorStop(0, '#022c22');
    backHillGrad.addColorStop(0.45, '#064e3b');
    backHillGrad.addColorStop(0.85, '#047857');
    backHillGrad.addColorStop(1, '#059669');
    c.fillStyle = backHillGrad;
    c.globalAlpha = 0.72;
    c.beginPath();
    c.moveTo(-400, 600);
    c.lineTo(-400, 420);
    c.lineTo(-200, 330);
    c.lineTo(0, 390);
    c.lineTo(200, 270);
    c.lineTo(450, 360);
    c.lineTo(700, 240);
    c.lineTo(950, 350);
    c.lineTo(1300, 270);
    c.lineTo(1300, 600);
    c.closePath();
    c.fill();

    // Ngọn đồi chóp nhọn Sơn Trà chính diện
    const hillGrad = c.createLinearGradient(450, 600, 450, 14);
    hillGrad.addColorStop(0, '#022c22');
    hillGrad.addColorStop(0.22, '#064e3b');
    hillGrad.addColorStop(0.45, '#047857');
    hillGrad.addColorStop(0.65, '#059669');
    hillGrad.addColorStop(0.82, '#10b981');
    hillGrad.addColorStop(0.93, '#4ade80');
    hillGrad.addColorStop(1, '#86efac');
    c.globalAlpha = 0.96;
    c.fillStyle = hillGrad;
    c.beginPath();
    c.moveTo(450, 14);
    c.lineTo(870, 600);
    c.lineTo(30, 600);
    c.closePath();
    c.fill();
    c.restore();
}

// 2. Tầng Đèo Sơn Trà
function drawSingleTier(c, t) {
    c.save();
    c.fillStyle = 'rgba(4, 18, 36, 0.45)';
    c.beginPath();
    if (c.roundRect) c.roundRect(40, t.y - 28, 410, 22, 6);
    else c.rect(40, t.y - 28, 410, 22);
    c.fill();

    c.fillStyle = '#ffd166';
    c.font = 'bold 10px "Bungee", sans-serif';
    c.textAlign = 'left';
    c.shadowColor = 'rgba(0, 0, 0, 0.9)';
    c.shadowBlur = 4;
    c.fillText(t.name, 48, t.y - 13);
    c.restore();
}

// 3. Đường Đèo Ziczac 51 Ô
function drawZiczacRoad(c) {
    c.save();
    // Viền ngoài
    c.beginPath();
    c.strokeStyle = 'rgba(4, 18, 34, 0.85)';
    c.lineWidth = 18;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (let i = 0; i < TILE_COORDINATES.length; i++) {
        const pt = TILE_COORDINATES[i];
        if (i === 0) c.moveTo(pt.x, pt.y);
        else c.lineTo(pt.x, pt.y);
    }
    c.stroke();

    // Lòng đường
    c.beginPath();
    c.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    c.lineWidth = 11;
    for (let i = 0; i < TILE_COORDINATES.length; i++) {
        const pt = TILE_COORDINATES[i];
        if (i === 0) c.moveTo(pt.x, pt.y);
        else c.lineTo(pt.x, pt.y);
    }
    c.stroke();

    // Vạch kẻ đứt khúc vàng
    c.beginPath();
    c.strokeStyle = '#ffd166';
    c.lineWidth = 2.5;
    c.setLineDash([8, 8]);
    for (let i = 0; i < TILE_COORDINATES.length; i++) {
        const pt = TILE_COORDINATES[i];
        if (i === 0) c.moveTo(pt.x, pt.y);
        else c.lineTo(pt.x, pt.y);
    }
    c.stroke();
    c.setLineDash([]);
    c.restore();
}

// 4. Đường Nối Đặc Biệt (Lối Tắt Xanh & Bẫy Trượt Đỏ) Siêu Nét Trực Tiếp Trên Canvas
const SPECIAL_PATHS_DATA = [
    { from: 17, to: 24, isTrap: false },
    { from: 37, to: 42, isTrap: false },
    { from: 47, to: 32, isTrap: true },
    { from: 29, to: 11, isTrap: true }
];

function drawSpecialPathsOnCanvas(c, minX, maxX, minY, maxY) {
    SPECIAL_PATHS_DATA.forEach(p => {
        const c1 = TILE_COORDINATES[p.from];
        const c2 = TILE_COORDINATES[p.to];
        if (!c1 || !c2) return;

        const pMinX = Math.min(c1.x, c2.x) - 20;
        const pMaxX = Math.max(c1.x, c2.x) + 20;
        const pMinY = Math.min(c1.y, c2.y) - 20;
        const pMaxY = Math.max(c1.y, c2.y) + 20;
        if (pMaxX < minX || pMinX > maxX || pMaxY < minY || pMinY > maxY) {
            return;
        }

        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const angle = Math.atan2(dy, dx);

        const r1 = 15;
        const r2 = 18;
        const x1 = c1.x + r1 * Math.cos(angle);
        const y1 = c1.y + r1 * Math.sin(angle);
        const x2 = c2.x - r2 * Math.cos(angle);
        const y2 = c2.y - r2 * Math.sin(angle);

        c.save();
        c.beginPath();
        c.strokeStyle = p.isTrap ? 'rgba(248, 113, 113, 0.45)' : 'rgba(134, 239, 172, 0.45)';
        c.lineWidth = 10;
        c.lineCap = 'round';
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();

        c.beginPath();
        c.strokeStyle = p.isTrap ? '#f87171' : '#86efac';
        c.lineWidth = 3;
        c.setLineDash([7, 6]);
        c.moveTo(x1, y1);
        c.lineTo(x2, y2);
        c.stroke();
        c.setLineDash([]);

        const arrowLen = 10;
        const arrowAngle = Math.PI / 6;
        c.fillStyle = p.isTrap ? '#f87171' : '#86efac';
        c.beginPath();
        c.moveTo(x2, y2);
        c.lineTo(x2 - arrowLen * Math.cos(angle - arrowAngle), y2 - arrowLen * Math.sin(angle - arrowAngle));
        c.lineTo(x2 - arrowLen * Math.cos(angle + arrowAngle), y2 - arrowLen * Math.sin(angle + arrowAngle));
        c.closePath();
        c.fill();
        c.restore();
    });
}

// 5. Vẽ Từng Ô Bàn Cờ Chuẩn Sắc Nét 1:1 Retina
function drawSingleTile(sCtx, i, pt) {
    const isStart = (i === 0);
    const isSummit = (i === BOARD_LENGTH);
    const isShortcutOrigin = (i === 17 || i === 37);
    const isTrapOrigin = (i === 29 || i === 47);

    sCtx.save();
    sCtx.translate(pt.x, pt.y);

    if (isSummit) {
        sCtx.shadowBlur = 18;
        sCtx.shadowColor = 'rgba(255, 209, 102, 0.9)';

        const sunburst = sCtx.createRadialGradient(0, 0, 8, 0, 0, 30);
        sunburst.addColorStop(0, '#ffffff');
        sunburst.addColorStop(0.4, '#ffd166');
        sunburst.addColorStop(1, '#ff9f1c');
        sCtx.fillStyle = sunburst;
        sCtx.beginPath();
        sCtx.arc(0, 0, 30, 0, Math.PI * 2);
        sCtx.fill();

        sCtx.strokeStyle = '#041224';
        sCtx.lineWidth = 3.5;
        sCtx.stroke();

        sCtx.fillStyle = '#121624';
        sCtx.font = '22px sans-serif';
        sCtx.textAlign = 'center';
        sCtx.textBaseline = 'middle';
        sCtx.fillText('👑', 0, -3);

        sCtx.font = 'bold 11px "Bungee", sans-serif';
        sCtx.fillText('50', 0, 18);

        sCtx.fillStyle = 'rgba(4, 18, 36, 0.92)';
        sCtx.beginPath();
        if (sCtx.roundRect) sCtx.roundRect(-46, -48, 92, 19, 8);
        else sCtx.rect(-46, -48, 92, 19);
        sCtx.fill();
        sCtx.strokeStyle = '#ffd166';
        sCtx.lineWidth = 1.4;
        sCtx.stroke();

        sCtx.font = 'bold 8.5px "Be Vietnam Pro", sans-serif';
        sCtx.fillStyle = '#ffd166';
        sCtx.fillText('ĐỈNH BÀN CỜ', 0, -39);

    } else if (isStart) {
        sCtx.shadowBlur = 12;
        sCtx.shadowColor = '#10b981';
        sCtx.fillStyle = '#10b981';
        sCtx.beginPath();
        sCtx.arc(0, 0, 18, 0, Math.PI * 2);
        sCtx.fill();
        sCtx.strokeStyle = '#ffffff';
        sCtx.lineWidth = 2.5;
        sCtx.stroke();

        sCtx.fillStyle = '#041224';
        sCtx.font = 'bold 10px "Bungee", sans-serif';
        sCtx.textAlign = 'center';
        sCtx.textBaseline = 'middle';
        sCtx.fillText('START', 0, 0);

    } else if (isShortcutOrigin) {
        sCtx.shadowBlur = 10;
        sCtx.shadowColor = '#86efac';
        sCtx.fillStyle = '#064e3b';
        sCtx.strokeStyle = '#86efac';
        sCtx.lineWidth = 3;

        sCtx.beginPath();
        sCtx.arc(0, 0, 15, 0, Math.PI * 2);
        sCtx.fill();
        sCtx.stroke();

        sCtx.shadowBlur = 3;
        sCtx.shadowColor = '#86efac';
        sCtx.fillStyle = '#86efac';
        sCtx.font = 'bold 15px sans-serif';
        sCtx.textAlign = 'center';
        sCtx.textBaseline = 'middle';
        sCtx.fillText('⬆', 0, 0);

    } else if (isTrapOrigin) {
        sCtx.shadowBlur = 10;
        sCtx.shadowColor = '#f87171';
        sCtx.fillStyle = '#450a0a';
        sCtx.strokeStyle = '#f87171';
        sCtx.lineWidth = 3;

        sCtx.beginPath();
        sCtx.arc(0, 0, 15, 0, Math.PI * 2);
        sCtx.fill();
        sCtx.stroke();

        sCtx.shadowBlur = 3;
        sCtx.shadowColor = '#f87171';
        sCtx.fillStyle = '#f87171';
        sCtx.font = 'bold 15px sans-serif';
        sCtx.textAlign = 'center';
        sCtx.textBaseline = 'middle';
        sCtx.fillText('⬇', 0, 0);

    } else if (ITEM_TILES.includes(i)) {
        sCtx.shadowBlur = 8;
        sCtx.shadowColor = '#38bdf8';
        sCtx.fillStyle = '#0c2e4e';
        sCtx.strokeStyle = '#38bdf8';
        sCtx.lineWidth = 2.5;

        sCtx.beginPath();
        sCtx.arc(0, 0, 15, 0, Math.PI * 2);
        sCtx.fill();
        sCtx.stroke();

        sCtx.font = '13px sans-serif';
        sCtx.textAlign = 'center';
        sCtx.textBaseline = 'middle';
        sCtx.fillText('🎁', 0, 0);

    } else {
        sCtx.shadowBlur = 3;
        sCtx.shadowColor = 'rgba(0, 0, 0, 0.75)';
        sCtx.fillStyle = (i % 2 === 0) ? '#08172c' : '#0c223f';
        sCtx.strokeStyle = '#ffffff';
        sCtx.lineWidth = 2;

        sCtx.beginPath();
        sCtx.arc(0, 0, 14, 0, Math.PI * 2);
        sCtx.fill();
        sCtx.stroke();

        sCtx.fillStyle = '#ffffff';
        sCtx.font = 'bold 10px "Be Vietnam Pro", sans-serif';
        sCtx.textAlign = 'center';
        sCtx.textBaseline = 'middle';
        sCtx.fillText(String(i), 0, 0.5);
    }

    sCtx.restore();
}

// 6. Vẽ Quân Cờ Người Chơi
function drawPlayerTokensOnBoard(c, minX, maxX, minY, maxY) {
    const maxAllowed = Math.max(2, Math.min(6, currentSelectedCount || 2));
    const activeDisplayPlayers = gameState.players.slice(0, maxAllowed);
    if (!activeDisplayPlayers.length) return;

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

        // Viewport Culling: Chỉ vẽ quân cờ nằm trong màn hình
        if (tokenX < minX - 35 || tokenX > maxX + 35 || tokenY < minY - 35 || tokenY > maxY + 35) {
            return;
        }

        // Bóng đổ
        c.save();
        c.translate(baseCoord.x + offsetX, baseCoord.y + offsetY + 7);
        c.scale(Math.max(0.4, 1 - hopHeight / 24), 0.35);
        c.fillStyle = 'rgba(0, 0, 0, 0.45)';
        c.beginPath();
        c.arc(0, 0, 13, 0, Math.PI * 2);
        c.fill();
        c.restore();

        // Thân quân cờ
        c.save();
        c.translate(tokenX, tokenY);
        c.shadowBlur = 8;
        c.shadowColor = p.color;
        c.fillStyle = p.color;
        c.beginPath();
        c.arc(0, 0, 15, 0, Math.PI * 2);
        c.fill();

        const grad = c.createLinearGradient(-12, -12, 12, 12);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, p.color);
        grad.addColorStop(1, '#090e1a');
        c.fillStyle = grad;
        c.beginPath();
        c.arc(0, 0, 13, 0, Math.PI * 2);
        c.fill();

        c.strokeStyle = '#ffffff';
        c.lineWidth = 2.4;
        c.stroke();

        // Icon đại diện
        c.shadowBlur = 0;
        c.shadowColor = 'transparent';
        c.fillStyle = '#ffffff';
        c.font = '16px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        const iconChar = p.avatarIcon || DEFAULT_PRESETS.find(x => x.color === p.color)?.avatarIcon || '🐱';
        c.fillText(iconChar, 0, 1);

        // Tên người chơi
        const shortName = p.name.split(' ').pop();
        c.font = 'bold 9px "Be Vietnam Pro", sans-serif';
        const nameWidth = c.measureText(shortName).width;

        c.fillStyle = 'rgba(4, 18, 36, 0.88)';
        c.beginPath();
        if (c.roundRect) c.roundRect(-nameWidth / 2 - 5, 13, nameWidth + 10, 14, 4);
        else c.rect(-nameWidth / 2 - 5, 13, nameWidth + 10, 14);
        c.fill();
        c.strokeStyle = p.color;
        c.lineWidth = 1;
        c.stroke();

        c.fillStyle = '#ffffff';
        c.fillText(shortName, 0, 20);

        c.restore();
    });
}

// 7. Pháo hoa
function drawFireworks(c) {
    for (let i = 0; i < fireworksRockets.length; i++) {
        const r = fireworksRockets[i];
        c.save();
        c.fillStyle = r.color;
        c.shadowBlur = 12;
        c.shadowColor = r.color;
        c.beginPath();
        c.arc(r.x, r.y, 3, 0, Math.PI * 2);
        c.fill();
        c.restore();
    }

    for (let i = 0; i < fireworksSparks.length; i++) {
        const sp = fireworksSparks[i];
        c.save();
        c.globalAlpha = Math.max(0, sp.alpha);
        c.fillStyle = sp.color;
        c.shadowBlur = 10;
        c.shadowColor = sp.color;
        c.beginPath();
        c.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
        c.fill();
        c.restore();
    }
}

// 8. Bàn cờ chính: VIEWPORT RENDERING (Chỉ vẽ mảng nhỏ hiển thị trên màn hình người chơi)
function drawBoard() {
    const cw = dom.canvas.width;
    const ch = dom.canvas.height;
    if (!cw || !ch) return;

    ctx.clearRect(0, 0, cw, ch);

    ctx.save();

    // Scale theo tỉ lệ hiển thị thực của container để nét căng Retina
    const containerW = dom.canvas.clientWidth || (cw / (window.devicePixelRatio || 1));
    const containerH = dom.canvas.clientHeight || (ch / (window.devicePixelRatio || 1));
    const dprX = cw / containerW;
    const dprY = ch / containerH;
    ctx.scale(dprX, dprY);

    if (isCameraZoomed || camZoom > 1.05) {
        // Khung nhìn phóng to quanh vị trí người chơi
        ctx.translate(containerW / 2, containerH / 2);
        ctx.scale(camZoom, camZoom);
        ctx.translate(-camX, -camY);
    } else {
        // Toàn cảnh 900x600 vừa vặn trong màn hình
        const fitScale = Math.min(containerW / CANVAS_WIDTH, containerH / CANVAS_HEIGHT);
        const offsetX = (containerW - CANVAS_WIDTH * fitScale) / 2;
        const offsetY = (containerH - CANVAS_HEIGHT * fitScale) / 2;
        ctx.translate(offsetX, offsetY);
        ctx.scale(fitScale, fitScale);
    }

    // ==================================================================
    // TÍNH TOÁN VÙNG HIỂN THỊ (VIEWPORT CULLING)
    // CHỈ CHẠY VÀ VẼ MẢNG NHỎ TRÊN MÀN HÌNH NGƯỜI CHƠI ĐỂ TỐI ƯU HIỆU NĂNG!
    // ==================================================================
    const activeZoom = (isCameraZoomed || camZoom > 1.05) ? camZoom : Math.min(containerW / CANVAS_WIDTH, containerH / CANVAS_HEIGHT);
    const pad = 50;
    const halfViewW = (containerW / 2) / activeZoom + pad;
    const halfViewH = (containerH / 2) / activeZoom + pad;
    const curCenterCamX = (isCameraZoomed || camZoom > 1.05) ? camX : (CANVAS_WIDTH / 2);
    const curCenterCamY = (isCameraZoomed || camZoom > 1.05) ? camY : (CANVAS_HEIGHT / 2);

    const viewMinX = curCenterCamX - halfViewW;
    const viewMaxX = curCenterCamX + halfViewW;
    const viewMinY = curCenterCamY - halfViewH;
    const viewMaxY = curCenterCamY + halfViewH;

    // Sườn Núi Sơn Trà
    drawSontraHill(ctx);

    // Mây & Chim (Chỉ vẽ nếu nằm trong vùng hiển thị)
    clouds.forEach(c => {
        if (c.x >= viewMinX - 100 && c.x <= viewMaxX + 100 && c.y >= viewMinY - 60 && c.y <= viewMaxY + 60) {
            drawFluffyCloud(ctx, c.x, c.y, c.scale, c.opacity);
        }
    });

    birds.forEach(b => {
        if (b.x >= viewMinX - 50 && b.x <= viewMaxX + 50 && b.y >= viewMinY - 50 && b.y <= viewMaxY + 50) {
            const wing = typeof b.currentWing === 'number' ? b.currentWing : 0;
            drawBird(ctx, b.x, b.y, b.scale, wing);
        }
    });

    // 5 Tầng Đèo Sơn Trà (Chỉ vẽ tầng nào nằm trong tầm nhìn)
    SONTRA_TIERS.forEach(t => {
        if (t.y >= viewMinY - 35 && t.y <= viewMaxY + 35) {
            drawSingleTier(ctx, t);
        }
    });

    // Đường Đèo Ziczac
    drawZiczacRoad(ctx);

    // Đường Nối Lối Tắt & Cạm Bẫy
    drawSpecialPathsOnCanvas(ctx, viewMinX, viewMaxX, viewMinY, viewMaxY);

    // 51 Ô BÀN CỜ: CHỈ CHẠY VÀ VẼ CÁC Ô TRONG MẢNG NHỎ MÀN HÌNH NGƯỜI CHƠI!
    for (let i = 0; i < TILE_COORDINATES.length; i++) {
        const pt = TILE_COORDINATES[i];
        if (pt.x < viewMinX || pt.x > viewMaxX || pt.y < viewMinY || pt.y > viewMaxY) {
            continue; // Bỏ qua 40+ ô ngoài tầm nhìn!
        }
        drawSingleTile(ctx, i, pt);
    }

    // Quân Cờ Người Chơi (Chỉ vẽ nếu nằm trong tầm nhìn)
    drawPlayerTokensOnBoard(ctx, viewMinX, viewMaxX, viewMinY, viewMaxY);

    // Pháo hoa chiến thắng tại Đỉnh Bàn Cờ
    if (gameState.phase === 'GAME_OVER' || gameState.winner) {
        drawFireworks(ctx);
    }

    ctx.restore();
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
            totalMinigameScore: 0,
            items: (gameState.phase !== 'SETUP') ? [(typeof getRandomItem === 'function' ? getRandomItem().id : 'rocket')] : []
        });
    }
    gameState.turnOrder = gameState.players.map(p => p.id);
    resetMinigameAppearanceStats();
    updateRoundDisplay(1);

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
            description: 'Đi trên dây cáp nhìn từ sau lưng! Gió núi thổi mạnh làm người nghiêng sâu về mép vực. Bấm <strong>Trái / Phải</strong> để ghìm thăng bằng theo độ nghiêng. Ai trụ lâu hơn sẽ chiến thắng!',
            script: 'minigames/game-6/game-6.js',
            style: 'minigames/game-6/game-6.css'
        });
        window.MinigameManager.register('game-7', {
            title: 'ĐUA THUYỀN RỒNG',
            description: 'Vòng tròn nhịp điệu co giãn theo nhịp trống. Bấm đúng lúc vòng tròn <strong>chạm vạch vàng</strong> (nhịp chèo). Càng về sau nhịp càng nhanh! Trúng <strong>+10đ</strong>, trượt <strong>-5đ</strong>!',
            script: 'minigames/game-7/game-7.js',
            style: 'minigames/game-7/game-7.css'
        });
        window.MinigameManager.register('game-8', {
            title: 'CHIA KHO BÁU',
            description: 'Có 3 rương: Vàng (50đ), Bạc (30đ), Đồng (15đ). Trong 10s, bí mật chọn 1 rương. 1 người chọn ăn trọn, 2+ người chọn chia đều điểm! Sau 5 lượt xếp hạng theo điểm.',
            script: 'minigames/game-8/game-8.js',
            style: 'minigames/game-8/game-8.css'
        });
        window.MinigameManager.register('game-9', {
            title: 'TRÍ NHỚ SIÊU PHÀM',
            description: 'Chú khỉ nhảy qua 8 phím đàn piano để biểu diễn chuỗi nốt nhạc! Hãy ghi nhớ và bấm lại theo đúng thứ tự (4 lượt: 5, 6, 7, 8 nốt). Đúng càng nhiều điểm càng cao, hòa nốt thưởng điểm làm nhanh!',
            script: 'minigames/game-9/game-9.js',
            style: 'minigames/game-9/game-9.css'
        });
    }

    startBoardAnimationLoop();
}

// ==========================================================================
// 15. Tích Hợp Mini-game Manager & Cơ Chế Xếp Thứ Tự Lượt Đi Theo Điểm Số
// ==========================================================================
let isMinigameSessionActive = false;
let lastPlayedMinigameId = null;

const ALL_MINIGAMES = [
    { id: 'game-1', name: 'ĐUA SỨC BỀN', icon: '🔥', desc: 'Bấm nút tròn liên tục nạp đầy thể lực trong 8 giây' },
    { id: 'game-2', name: 'PHẢN XẠ NÉ KHỈ', icon: '🐒', desc: 'Bấm thật nhanh né quả thông của khỉ Sơn Trà (3 lượt)' },
    { id: 'game-3', name: 'CĂN LỰC GIÓ', icon: '🎯', desc: 'Dừng kim đỏ ngay tâm xanh lá 100 điểm (3 lượt căn lực)' },
    { id: 'game-4', name: 'ĐẾM THỜI GIAN SƯƠNG MÙ', icon: '⏱️', desc: 'Nhẩm đếm giây trong sương mù và bấm dừng chuẩn xác' },
    { id: 'game-5', name: 'SĂN ẢNH VOỌC CHÀ VÁ', icon: '📸', desc: 'Chụp trúng Voọc (+20đ), tránh chụp nhầm Khỉ (-15đ) trong 15s' },
    { id: 'game-6', name: 'THĂNG BẰNG ĐI TRÊN DÂY', icon: '🌉', desc: 'Đi trên dây cáp nhìn từ sau lưng, ghìm phím chống gió núi' },
    { id: 'game-7', name: 'ĐUA THUYỀN RỒNG', icon: '🚣‍♂️', desc: 'Gõ phím đúng nhịp trống hội chèo thuyền vượt sóng trong 20s' },
    { id: 'game-8', name: 'CHIA KHO BÁU', icon: '💎', desc: 'Bí mật chọn 1 trong 3 rương trong 10s: 1 người ăn trọn, 2+ người chia đều' },
    { id: 'game-9', name: 'TRÍ NHỚ SIÊU PHÀM', icon: '🎹', desc: 'Đàn piano 8 nốt: gõ lại chuỗi nốt nhạc theo chú khỉ (4 lượt)' }
];

// Thống kê lịch sử xuất hiện của từng minigame trong ván đấu
const minigameAppearanceStats = {};

function resetMinigameAppearanceStats() {
    lastPlayedMinigameId = null;
    ALL_MINIGAMES.forEach(g => {
        minigameAppearanceStats[g.id] = { playCount: 0, lastPlayedRound: -99 };
    });
}
resetMinigameAppearanceStats();

// Tính trọng số xuất hiện của từng minigame (Cơ chế giảm xác suất khi đã xuất hiện, KHÔNG BẰNG 0)
function getMinigameWeight(gameId) {
    if (!minigameAppearanceStats[gameId]) {
        minigameAppearanceStats[gameId] = { playCount: 0, lastPlayedRound: -99 };
    }
    const stat = minigameAppearanceStats[gameId];
    const currentRound = gameState.currentRound || 1;
    const roundsSince = currentRound - stat.lastPlayedRound;

    // Trọng số chuẩn ban đầu (100)
    let weight = 100;

    // 1. Giảm xác suất theo độ gần của lần xuất hiện trước đó (nhưng luôn > 0):
    if (roundsSince === 1) {
        weight = 25; // Vừa xuất hiện ở vòng liền trước: giảm 75% xác suất (vẫn giữ 25% cơ hội so với game khác)
    } else if (roundsSince === 2) {
        weight = 55; // Xuất hiện cách 2 vòng: giảm 45% xác suất
    } else if (roundsSince === 3) {
        weight = 80; // Xuất hiện cách 3 vòng: giảm 20% xác suất
    } else {
        weight = 100; // Chưa từng xuất hiện hoặc cách 4+ vòng: xác suất tiêu chuẩn
    }

    // 2. Giảm dần nếu game đó đã xuất hiện nhiều lần trong cả ván đấu:
    if (stat.playCount > 1) {
        weight = Math.round(weight / (1 + (stat.playCount - 1) * 0.35));
    }

    // Đảm bảo xác suất luôn luôn > 0 (trọng số tối thiểu là 10, không bao giờ bằng 0)
    return Math.max(10, weight);
}

function pickRandomMinigame() {
    // 1. Tính toán trọng số xác suất cho cả 9 Minigame
    const weightedPool = ALL_MINIGAMES.map(g => ({
        game: g,
        weight: getMinigameWeight(g.id)
    }));

    const totalWeight = weightedPool.reduce((sum, item) => sum + item.weight, 0);

    // 2. Bốc thăm ngẫu nhiên theo phân phối trọng số (Weighted Probability Selection)
    let rand = Math.random() * totalWeight;
    let chosen = weightedPool[0].game;

    for (let i = 0; i < weightedPool.length; i++) {
        if (rand < weightedPool[i].weight) {
            chosen = weightedPool[i].game;
            break;
        }
        rand -= weightedPool[i].weight;
    }

    // 3. Cập nhật thống kê lịch sử xuất hiện
    if (!minigameAppearanceStats[chosen.id]) {
        minigameAppearanceStats[chosen.id] = { playCount: 0, lastPlayedRound: -99 };
    }
    minigameAppearanceStats[chosen.id].playCount++;
    minigameAppearanceStats[chosen.id].lastPlayedRound = gameState.currentRound || 1;
    lastPlayedMinigameId = chosen.id;

    // Log chi tiết xác suất ra console để kiểm chứng minh bạch
    console.log(
        `🎲 [Minigame Roulette] Vòng ${gameState.currentRound || 1} chọn: "${chosen.name}" (${chosen.id}). Tỉ lệ xác suất hiện thời:`,
        weightedPool.map(it => `${it.game.id}: ${(it.weight * 100 / totalWeight).toFixed(1)}% (đã xuất hiện ${minigameAppearanceStats[it.game.id]?.playCount || 0} lần)`).join(' | ')
    );

    return chosen;
}

function getMinigameTitle(gameType) {
    const item = ALL_MINIGAMES.find(g => g.id === gameType);
    return item ? item.name : 'MINIGAME';
}

function getOrGenerateFogTargetForRound() {
    if (!gameState.currentFogTargetSec || gameState.currentFogTargetRound !== gameState.currentRound) {
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

// Xử lý khi người chơi hoàn thành lượt tung xúc xắc và di chuyển
function onPlayerMovementFinished(player) {
    gameState.isAnimatingMove = false;

    // Kiểm tra xem đã kết thúc toàn bộ lượt tung xúc xắc trong vòng chưa:
    const isRoundDone = (gameState.currentTurnIndex + 1 >= gameState.turnOrder.length) || (gameState.phase === 'MINIGAME');
    if (isRoundDone) {
        // TẤT CẢ NGƯỜI CHƠI TRONG VÒNG ĐÃ TUNG XÚC XẮC XONG -> TIẾN VÀO MINIGAME!
        setTimeout(() => {
            triggerRoundMinigamePhase();
        }, 500);
        return;
    }

    // Nếu vẫn còn người chơi trong vòng và đang kết nối ESP32, firmware sẽ gửi lượt tiếp theo
    if (socket && socket.readyState === WebSocket.OPEN) {
        return;
    }

    // Chế độ Offline / Client-Side:
    // Chuyển sang người chơi tiếp theo trong vòng:
    gameState.currentTurnIndex++;
    const nextId = gameState.turnOrder[gameState.currentTurnIndex];
    gameState.activePlayerId = nextId;
    gameState.phase = 'WAITING_ROLL';

    renderTurnPills();
    updateProgressList();
    renderTokens();

    const nextPlayer = gameState.players.find(p => p.id === nextId);
    if (nextPlayer) {
        focusCameraOnPlayer(nextPlayer, true);
        updateTurnButtons(nextPlayer);
        addGameLog(`👉 Chuyển lượt tung xúc xắc sang <strong>${nextPlayer.name}</strong> (${gameState.currentTurnIndex + 1}/${gameState.turnOrder.length}).`);

        // Kiểm tra trạng thái Choáng Mất Lượt do trúng Bom
        if (typeof checkAndHandlePlayerStun === 'function' && checkAndHandlePlayerStun(nextPlayer)) {
            return;
        }
    }
    checkOfflineBotTurn();
}

// Giai đoạn Minigame của Vòng (Cả phòng cùng thi đấu 1 trong 9 minigame ngẫu nhiên)
async function triggerRoundMinigamePhase() {
    if (isMinigameSessionActive) return;
    if (gameState.phase === 'GAME_OVER') return;

    isMinigameSessionActive = true;
    gameState.phase = 'MINIGAME';
    dom.btnRollDice.disabled = true;
    dom.btnRollDice.classList.remove('pulse-active');
    dom.btnRollDice.querySelector('.roll-text').textContent = '🎮 ĐANG THI ĐẤU MINIGAME...';
    dom.turnStatusLabel.textContent = `MINIGAME VÒNG ${gameState.currentRound}`;

    // 1. Chọn ngẫu nhiên 1 trong 9 Minigame:
    const chosenGame = pickRandomMinigame();
    addGameLog(`🏁 <strong>[KẾT THÚC LƯỢT TUNG VÒNG ${gameState.currentRound}]</strong> Toàn bộ người chơi đã hoàn thành lượt di chuyển!`);
    addGameLog(`🎰 <strong>[VÒNG QUAY MINIGAME]</strong> Đang chọn 1 trong 9 Minigame để tranh thứ tự lượt đi vòng sau...`);

    // 2. Chạy hiệu ứng vòng quay Roulette
    showMinigameRoulette(chosenGame, async () => {
        try {
            const humanPlayer = gameState.players.find(p => !p.isBot && ((p.id === myPlayerId) || !myPlayerId)) || gameState.players[0];
            const launchOpts = {
                player: humanPlayer,
                allPlayers: gameState.players
            };
            if (chosenGame.id === 'game-4') {
                launchOpts.targetSec = getOrGenerateFogTargetForRound();
            }

            // 3. Khởi chạy Minigame
            const result = await MinigameManager.launch(chosenGame.id, launchOpts);

            // 4. Xử lý kết quả & sắp xếp bảng xếp hạng
            onRoundMinigameCompleted(chosenGame, result);
        } catch (err) {
            console.error('[Minigame] Lỗi khởi chạy:', err);
            onRoundMinigameCompleted(chosenGame, { win: true, score: 100 });
        }
    });
}

// Hiệu ứng vòng quay Roulette chọn 1 trong 9 Minigame
function showMinigameRoulette(chosenGame, onComplete) {
    let overlay = document.getElementById('minigameRouletteOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'minigameRouletteOverlay';
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '9999';
        overlay.style.backdropFilter = 'blur(10px)';
        overlay.style.background = 'rgba(2, 6, 23, 0.88)';
        document.body.appendChild(overlay);
    }
    overlay.classList.remove('hidden');

    overlay.innerHTML = `
        <div style="background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); border: 2.5px solid #38bdf8; border-radius: 20px; padding: 1.5rem 1.2rem; max-width: 440px; width: 90%; text-align: center; box-shadow: 0 0 35px rgba(56, 189, 248, 0.4); box-sizing: border-box; animation: modalPop 0.3s ease;">
            <div style="font-size: 0.75rem; font-weight: 800; color: #f59e0b; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 0.3rem;">
                🎲 HOÀN THÀNH LƯỢT TUNG VÒNG ${gameState.currentRound}
            </div>
            <h2 style="font-family: 'Bungee', sans-serif; font-size: 1.35rem; color: #ffffff; margin: 0 0 0.4rem; text-shadow: 0 0 10px rgba(56, 189, 248, 0.5);">
                🎰 VÒNG QUAY MINIGAME
            </h2>
            <p style="font-size: 0.82rem; color: #94a3b8; margin: 0 0 1rem; line-height: 1.4;">
                Đang ngẫu nhiên chọn <strong>1 trong 9 Minigame</strong> để toàn bộ người chơi tranh tài xếp thứ tự lượt đi...
            </p>
            <div id="rouletteDisplayCard" style="background: rgba(15, 23, 42, 0.95); border: 2px dashed #f59e0b; border-radius: 14px; padding: 1rem 0.5rem; margin-bottom: 1rem; min-height: 90px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.35rem; transition: all 0.2s ease;">
                <div id="rouletteIcon" style="font-size: 2.6rem; transform: scale(1); transition: transform 0.15s ease;">🎲</div>
                <div id="rouletteTitle" style="font-family: 'Bungee', sans-serif; font-size: 1.15rem; color: #f59e0b;">ĐANG QUAY SỐ...</div>
                <div id="rouletteDesc" style="font-size: 0.75rem; color: #cbd5e1;">Chuẩn bị tinh thần!</div>
            </div>
            <div style="font-size: 0.75rem; color: #64748b; font-style: italic;">
                ⚡ Người chiến thắng sẽ được quyền tung xúc xắc đầu tiên ở vòng tiếp theo!
            </div>
        </div>
    `;

    const elCard = overlay.querySelector('#rouletteDisplayCard');
    const elIcon = overlay.querySelector('#rouletteIcon');
    const elTitle = overlay.querySelector('#rouletteTitle');
    const elDesc = overlay.querySelector('#rouletteDesc');

    let ticks = 0;
    const maxTicks = 12;
    const interval = 110;
    let timer = null;
    let hasFinished = false;

    const finishRoulette = () => {
        if (hasFinished) return;
        hasFinished = true;
        if (timer) {
            clearInterval(timer);
            timer = null;
        }

        if (elIcon && chosenGame) {
            elIcon.textContent = chosenGame.icon || '🎮';
            elIcon.style.transform = 'scale(1.25)';
        }
        if (elTitle && chosenGame) {
            elTitle.textContent = chosenGame.name || 'MINIGAME';
            elTitle.style.color = '#22c55e';
        }
        if (elDesc && chosenGame) {
            elDesc.textContent = chosenGame.desc || '';
        }
        if (elCard) {
            elCard.style.borderColor = '#22c55e';
            elCard.style.borderStyle = 'solid';
            elCard.style.boxShadow = '0 0 25px rgba(34, 197, 94, 0.4)';
        }
        try {
            if (AudioSFX && typeof AudioSFX.playCorrect === 'function') {
                AudioSFX.playCorrect();
            }
        } catch (e) {}

        setTimeout(() => {
            overlay.classList.add('hidden');
            if (typeof onComplete === 'function') onComplete();
        }, 1200);
    };

    timer = setInterval(() => {
        try {
            ticks++;
            const sample = ALL_MINIGAMES[ticks % ALL_MINIGAMES.length];
            if (elIcon && sample) elIcon.textContent = sample.icon;
            if (elTitle && sample) elTitle.textContent = sample.name;
            if (elDesc && sample) elDesc.textContent = sample.desc;
            try {
                if (AudioSFX && typeof AudioSFX.playClick === 'function') {
                    AudioSFX.playClick();
                }
            } catch (e) {}

            if (ticks >= maxTicks) {
                finishRoulette();
            }
        } catch (err) {
            console.error('[Roulette] Lỗi vòng quay:', err);
            finishRoulette();
        }
    }, interval);

    // Fallback an toàn sau 3.2 giây: nếu có bất cứ điều gì xảy ra, chắc chắn kết thúc vòng quay
    setTimeout(() => {
        if (!hasFinished) {
            finishRoulette();
        }
    }, 3200);
}

// Xử lý điểm của Bot AI cho từng Minigame
function generateBotScoreForMinigame(gameType, bot) {
    if (gameType === 'game-9') {
        const notes = 15 + Math.floor(Math.random() * 11);
        const time = Number((14.0 + Math.random() * 12.0).toFixed(2));
        const speed = Math.max(0, Math.round((45.0 - time) * 3));
        const bonus = (notes >= 24 ? 140 : (notes >= 20 ? 90 : 40));
        bot.minigameMemoryNotes = notes;
        bot.minigameMemoryTime = time;
        bot.minigameMemorySpeedBonus = speed;
        return (notes * 10) + bonus + speed;
    } else if (gameType === 'game-8') {
        const pts = 75 + Math.floor(Math.random() * 91);
        bot.minigameTreasurePoints = pts;
        return pts;
    } else if (gameType === 'game-7') {
        const hits = 16 + Math.floor(Math.random() * 10);
        const misses = Math.floor(Math.random() * 3.5);
        bot.minigameBoatHits = hits;
        bot.minigameBoatMisses = misses;
        return Math.max(0, (hits * 10) - (misses * 5));
    } else if (gameType === 'game-6') {
        const surv = Number((3.5 + Math.random() * 5.8).toFixed(2));
        bot.minigameSurvivalTime = surv;
        return Math.round(surv * 10);
    } else if (gameType === 'game-5') {
        const v = 14 + Math.floor(Math.random() * 8);
        const k = Math.floor(Math.random() * 3);
        bot.minigameVoocHits = v;
        bot.minigameKhiHits = k;
        return Math.max(0, (v * 20) - (k * 15));
    } else if (gameType === 'game-4') {
        const target = getOrGenerateFogTargetForRound();
        const diff = Number((0.25 + Math.random() * 1.2).toFixed(2));
        const stopped = Number((target + (Math.random() > 0.5 ? diff : -diff)).toFixed(2));
        bot.minigameFogTarget = target;
        bot.minigameFogTime = stopped;
        bot.minigameFogDiff = diff;
        return Math.max(10, Math.round(200 - diff * 80));
    } else if (gameType === 'game-3') {
        let sum = 0;
        let perf = 0;
        for (let i = 0; i < 3; i++) {
            const sc = 60 + Math.floor(Math.random() * 41);
            if (sc >= 95) perf++;
            sum += sc;
        }
        bot.minigamePerfectCount = perf;
        return sum;
    } else if (gameType === 'game-2') {
        const best = 220 + Math.floor(Math.random() * 200);
        bot.minigameBestTime = best;
        return 180 + Math.floor(Math.random() * 100);
    } else {
        const taps = 22 + Math.floor(Math.random() * 22);
        const first = 220 + Math.floor(Math.random() * 500);
        bot.minigameTaps = taps;
        bot.minigameFirstTap = first;
        return (taps * 10) + Math.round((8000 - first) * 50 / 8000);
    }
}

// Xử lý khi Minigame của Vòng kết thúc & Sắp xếp lại thứ tự lượt tung xúc xắc tiếp theo
function onRoundMinigameCompleted(chosenGame, result) {
    const humanPlayer = gameState.players.find(p => !p.isBot && ((p.id === myPlayerId) || !myPlayerId)) || gameState.players[0];
    const humanScore = typeof result.score === 'number' ? result.score : (result.win ? 200 : 80);
    humanPlayer.minigameScore = humanScore;
    humanPlayer.totalMinigameScore = (humanPlayer.totalMinigameScore || 0) + humanScore;

    if (chosenGame.id === 'game-9') {
        humanPlayer.minigameMemoryNotes = result.memoryNotes || 20;
        humanPlayer.minigameMemoryTime = result.memoryTime || 20.0;
        humanPlayer.minigameMemorySpeedBonus = result.speedBonus || 0;
    } else if (chosenGame.id === 'game-8') {
        humanPlayer.minigameTreasurePoints = result.score || result.myTotalScore || 100;
        humanPlayer.minigameTreasureRank = result.ranking ? (result.ranking.findIndex(p => p.id === humanPlayer.id) + 1) : 1;
    } else if (chosenGame.id === 'game-7') {
        humanPlayer.minigameBoatHits = result.hitCount || 0;
        humanPlayer.minigameBoatMisses = result.missCount || 0;
    } else if (chosenGame.id === 'game-6') {
        humanPlayer.minigameSurvivalTime = result.survivalTime !== undefined ? result.survivalTime : 5.0;
    } else if (chosenGame.id === 'game-5') {
        humanPlayer.minigameVoocHits = result.voocHits !== undefined ? result.voocHits : 16;
        humanPlayer.minigameKhiHits = result.khiHits !== undefined ? result.khiHits : 2;
    } else if (chosenGame.id === 'game-4') {
        humanPlayer.minigameFogTime = result.fogStoppedTime;
        humanPlayer.minigameFogTarget = result.targetTime;
        humanPlayer.minigameFogDiff = result.diffSec;
    } else if (chosenGame.id === 'game-3') {
        humanPlayer.minigamePerfectCount = result.perfectCount;
    } else if (chosenGame.id === 'game-2') {
        humanPlayer.minigameBestTime = result.bestReactionTime;
    } else {
        humanPlayer.minigameTaps = result.taps;
        humanPlayer.minigameFirstTap = result.firstTapTime;
    }

    // Cập nhật điểm cho các Bot trong bàn cờ
    gameState.players.forEach(p => {
        if (p.isBot) {
            const bScore = generateBotScoreForMinigame(chosenGame.id, p);
            p.minigameScore = bScore;
            p.totalMinigameScore = (p.totalMinigameScore || 0) + bScore;
        }
    });

    // DỰA TRÊN BẢNG XẾP HẠNG ĐỂ CHỌN THỨ TỰ LƯỢT TUNG XÚC XẮC TIẾP THEO:
    gameState.turnOrder.sort((a, b) => {
        const pA = gameState.players.find(p => p.id === a);
        const pB = gameState.players.find(p => p.id === b);
        if (chosenGame.id === 'game-9') {
            const nA = pA?.minigameMemoryNotes ?? 0;
            const nB = pB?.minigameMemoryNotes ?? 0;
            if (nB !== nA) return nB - nA;
            const tA = pA?.minigameMemoryTime ?? 999;
            const tB = pB?.minigameMemoryTime ?? 999;
            if (tA !== tB) return tA - tB;
        } else if (chosenGame.id === 'game-6') {
            const survA = pA?.minigameSurvivalTime ?? 0;
            const survB = pB?.minigameSurvivalTime ?? 0;
            if (survB !== survA) return survB - survA;
        } else if (chosenGame.id === 'game-4') {
            const diffA = pA?.minigameFogDiff ?? 999;
            const diffB = pB?.minigameFogDiff ?? 999;
            if (diffA !== diffB) return diffA - diffB;
        }
        const scA = pA?.minigameScore || 0;
        const scB = pB?.minigameScore || 0;
        if (scB !== scA) return scB - scA;
        return (pB?.totalMinigameScore || 0) - (pA?.totalMinigameScore || 0);
    });

    const firstPlacePlayer = gameState.players.find(p => p.id === gameState.turnOrder[0]);
    const secondPlacePlayer = gameState.players.find(p => p.id === gameState.turnOrder[1]);

    if (firstPlacePlayer) {
        const item1 = getRandomItem();
        givePlayerItem(firstPlacePlayer, item1.id);
        addGameLog(`🏆 <strong>[KẾT QUẢ ${chosenGame.name}]</strong> <strong>${firstPlacePlayer.name}</strong> dẫn đầu bảng xếp hạng! Giành quyền tung xúc xắc đầu tiên và nhận thưởng <strong>${item1.icon} ${item1.name}</strong>!`);
    }
    if (secondPlacePlayer) {
        const item2 = getRandomItem();
        givePlayerItem(secondPlacePlayer, item2.id);
        addGameLog(`🥈 <strong>[PHẦN THƯỞNG HẠNG 2]</strong> <strong>${secondPlacePlayer.name}</strong> đạt Top 2 minigame, nhận thưởng <strong>${item2.icon} ${item2.name}</strong>!`);
    }

    // Hiển thị modal bảng xếp hạng vinh danh
    showRoundLeaderboardModal(chosenGame.id);
}

// Bắt đầu vòng mới sau khi bảng xếp hạng đóng
function advanceToNextRoundAfterMinigame() {
    if (gameState.phase === 'GAME_OVER') return;

    // Nếu đang kết nối ESP32 WebSocket, gửi kết quả và thứ tự lượt đi mới lên server
    if (socket && socket.readyState === WebSocket.OPEN) {
        const rawOrder = gameState.turnOrder.map(pid => parseInt(pid.replace('player_', ''), 10) - 1);
        const rawScores = {};
        gameState.players.forEach(p => {
            const idx = parseInt(p.id.replace('player_', ''), 10) - 1;
            rawScores[idx] = p.minigameScore || 0;
        });
        sendWs({
            t: 'minigame_finish',
            order: rawOrder,
            scores: rawScores
        });
    }

    gameState.currentRound++;
    updateRoundDisplay(gameState.currentRound);
    gameState.currentTurnIndex = 0;

    // Chuyển bất kỳ ai có skipTurnStatus === 'NEXT_ROUND' sang 'THIS_ROUND' cho vòng đấu mới
    gameState.players.forEach(p => {
        if (p.skipTurnStatus === 'NEXT_ROUND') {
            p.skipTurnStatus = 'THIS_ROUND';
            p.isStunned = true;
        }
    });

    gameState.activePlayerId = gameState.turnOrder[0];
    gameState.phase = 'WAITING_ROLL';
    isMinigameSessionActive = false;

    renderTurnPills();
    updateProgressList();
    renderPlayerInventory();
    renderTokens();

    const firstPlayer = gameState.players.find(p => p.id === gameState.turnOrder[0]);
    if (firstPlayer) {
        focusCameraOnPlayer(firstPlayer, true);
        updateTurnButtons(firstPlayer);
        showBanner(`VÒNG ${gameState.currentRound}: ${firstPlayer.name.toUpperCase()} TUNG XÚC XẮC ĐẦU TIÊN!`);
    }

    addGameLog(`🚀 <strong>[BẮT ĐẦU VÒNG ${gameState.currentRound}]</strong> Thứ tự tung xúc xắc: ${gameState.turnOrder.map((pid, idx) => {
        const p = gameState.players.find(x => x.id === pid);
        return `${idx + 1}. ${p ? p.name : pid}`;
    }).join(' ➔ ')}`);

    // Kiểm tra nếu người chơi đầu tiên bị choáng mất lượt
    if (firstPlayer && typeof checkAndHandlePlayerStun === 'function' && checkAndHandlePlayerStun(firstPlayer)) {
        return;
    }

    checkOfflineBotTurn();
}

function showRoundLeaderboardModal(finishedGameType = null) {
    if (!dom.roundLeaderboardModal || !dom.leaderboardRankingList) return;

    dom.leaderboardRankingList.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣', '6️⃣'];
    const activeGameType = finishedGameType || getCurrentMinigameType();

    if (dom.leaderboardBadge) {
        if (activeGameType === 'game-9') {
            dom.leaderboardBadge.textContent = '🏆 KẾT QUẢ TRÍ NHỚ SIÊU PHÀM';
        } else if (activeGameType === 'game-8') {
            dom.leaderboardBadge.textContent = '🏆 KẾT QUẢ CHIA KHO BÁU';
        } else if (activeGameType === 'game-7') {
            dom.leaderboardBadge.textContent = '🏆 KẾT QUẢ ĐUA THUYỀN RỒNG';
        } else if (activeGameType === 'game-6') {
            dom.leaderboardBadge.textContent = '🏆 KẾT QUẢ ĐUA THĂNG BẰNG ĐI TRÊN DÂY';
        } else if (activeGameType === 'game-4') {
            dom.leaderboardBadge.textContent = '🏆 KẾT QUẢ ĐUA THỜI GIAN SƯƠNG MÙ';
        } else {
            dom.leaderboardBadge.textContent = '🏆 KẾT QUẢ ĐUA ĐIỂM MINIGAME';
        }
    }
    if (dom.leaderboardDesc) {
        if (activeGameType === 'game-9') {
            dom.leaderboardDesc.textContent = 'Thứ tự tung xúc xắc vòng tiếp theo được xếp từ người nhớ đúng nhiều nốt nhất (nếu hòa tính thời gian làm nhanh)!';
        } else if (activeGameType === 'game-8') {
            dom.leaderboardDesc.textContent = 'Thứ tự tung xúc xắc vòng tiếp theo được xếp từ người có điểm kho báu cao nhất đến thấp nhất!';
        } else if (activeGameType === 'game-7') {
            dom.leaderboardDesc.textContent = 'Thứ tự tung xúc xắc vòng tiếp theo được xếp từ người có điểm đua thuyền cao nhất đến thấp nhất!';
        } else if (activeGameType === 'game-6') {
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
        if (activeGameType === 'game-9') {
            const timeStr = p.minigameMemoryTime !== undefined ? `${p.minigameMemoryTime.toFixed(1)}s` : '--';
            tapsInfo = `${p.minigameScore || 0} điểm`;
            hintDetail = `🎹 ${p.minigameMemoryNotes ?? 0}/26 nốt • ${timeStr} (+${p.minigameMemorySpeedBonus ?? 0}đ tốc độ) • Lượt ${rank + 1}`;
        } else if (activeGameType === 'game-8') {
            tapsInfo = `${p.minigameScore || 0} điểm`;
            hintDetail = `💎 ${p.minigameScore || 0}đ kho báu (5 lượt) • Lượt ${rank + 1}`;
        } else if (activeGameType === 'game-7') {
            tapsInfo = `${p.minigameScore || 0} điểm`;
            hintDetail = `🚣‍♂️ ${p.minigameBoatHits ?? 0}/29 nhịp trúng • ⚠️ ${p.minigameBoatMisses ?? 0} trượt • Lượt ${rank + 1}`;
        } else if (activeGameType === 'game-6') {
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
        const rewardHint = rank === 0 ? ' • 🎁 Thưởng Top 1' : (rank === 1 ? ' • 🎁 Thưởng Top 2' : '');
        hintDetail += rewardHint;
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

    let remainingSec = 5;
    const nextRoundNum = gameState.currentRound + 1;
    if (dom.btnContinueRound) {
        dom.btnContinueRound.textContent = `BẮT ĐẦU VÒNG ${nextRoundNum} 🎲 (${remainingSec}s)`;
    }

    let hasAdvanced = false;
    const closeModalAndContinue = () => {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        if (dom.roundLeaderboardModal) {
            dom.roundLeaderboardModal.classList.add('hidden');
        }
        // Nếu có phần thưởng vật phẩm của bản thân từ minigame, hiện popup chúc mừng riêng
        if (pendingMyItemReward) {
            showItemRewardModal(pendingMyItemReward.itemId, pendingMyItemReward.player);
            pendingMyItemReward = null;
        }
        if (!hasAdvanced) {
            hasAdvanced = true;
            advanceToNextRoundAfterMinigame();
        }
    };

    let countdownInterval = setInterval(() => {
        remainingSec--;
        if (dom.btnContinueRound) {
            dom.btnContinueRound.textContent = `BẮT ĐẦU VÒNG ${nextRoundNum} 🎲 (${remainingSec}s)`;
        }
        if (remainingSec <= 0) {
            closeModalAndContinue();
        }
    }, 1000);

    if (dom.btnContinueRound) {
        dom.btnContinueRound.onclick = () => {
            closeModalAndContinue();
        };
    }
}

// ==========================================================================
// 16. Hệ Thống Vật Phẩm Chiến Thuật (Items & Inventory System)
// ==========================================================================
const MAX_ITEMS_PER_PLAYER = 3;

const ITEM_DEFINITIONS = {
    rocket: {
        id: 'rocket',
        name: 'Tên Lửa Tăng Tốc',
        icon: '🚀',
        badge: '+4-6 BƯỚC',
        desc: 'Phóng vọt về phía trước thêm 4 - 6 bước ngẫu nhiên ngay lập tức.',
        needsTarget: false
    },
    bomber: {
        id: 'bomber',
        name: 'Máy Bay Thả Bom',
        icon: '💣',
        badge: 'CHOÁNG MẤT LƯỢT',
        desc: 'Ném bom làm choáng 1 đối thủ: nếu đã qua lượt thì mất lượt vòng sau, chưa qua thì mất lượt vòng này.',
        needsTarget: true
    },
    double_dice: {
        id: 'double_dice',
        name: 'Bùa Nhân Đôi (x2)',
        icon: '⚡',
        badge: 'X2 BƯỚC ĐI',
        desc: 'Nhân đôi số bước di chuyển thực tế sau khi tung xúc xắc ở lượt này.',
        needsTarget: false
    },
    hook: {
        id: 'hook',
        name: 'Móc Kéo Đối Thủ',
        icon: '🪝',
        badge: 'KÉO LÙI 4 Ô',
        desc: 'Phóng móc sắt tóm lấy 1 đối thủ và giật lùi về phía bạn 4 ô.',
        needsTarget: true
    },
    teleport: {
        id: 'teleport',
        name: 'Máy Dịch Chuyển',
        icon: '🌀',
        badge: 'DỊCH CHUYỂN TỨC THỜI',
        desc: 'Dịch chuyển tức thời bản thân tới vị trí của 1 đối thủ ngẫu nhiên trên bàn cờ.',
        needsTarget: false
    }
};

const ALL_ITEM_IDS = ['rocket', 'bomber', 'double_dice', 'hook', 'teleport'];

function getRandomItem() {
    const id = ALL_ITEM_IDS[Math.floor(Math.random() * ALL_ITEM_IDS.length)];
    return ITEM_DEFINITIONS[id];
}

function isCurrentDevicePlayer(player) {
    if (!player) return false;
    if (myPlayerId) {
        return player.id === myPlayerId;
    }
    // Nếu là Host chưa nhận isYou hoặc đang chơi offline:
    if (isHost && player.id === 'player_1') {
        return true;
    }
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        return !player.isBot;
    }
    return false;
}

let pendingMyItemReward = null;
let itemRewardTimer = null;

function showItemRewardModal(itemId, player) {
    const def = ITEM_DEFINITIONS[itemId];
    if (!def) return;

    if (!dom.itemRewardModal) {
        dom.itemRewardModal = document.getElementById('itemRewardModal');
        dom.itemRewardSub = document.getElementById('itemRewardSub');
        dom.itemRewardIcon = document.getElementById('itemRewardIcon');
        dom.itemRewardName = document.getElementById('itemRewardName');
        dom.itemRewardBadge = document.getElementById('itemRewardBadge');
        dom.itemRewardDesc = document.getElementById('itemRewardDesc');
        dom.btnClaimItemReward = document.getElementById('btnClaimItemReward');
    }
    if (!dom.itemRewardModal) return;

    if (dom.itemRewardSub) {
        dom.itemRewardSub.textContent = `Chúc mừng bạn (${player.name}) đã nhận được vật phẩm mới:`;
    }
    if (dom.itemRewardIcon) dom.itemRewardIcon.textContent = def.icon;
    if (dom.itemRewardName) dom.itemRewardName.textContent = def.name;
    if (dom.itemRewardBadge) dom.itemRewardBadge.textContent = def.badge;
    if (dom.itemRewardDesc) dom.itemRewardDesc.textContent = def.desc;

    AudioSFX.playItemGetSFX();

    dom.itemRewardModal.classList.remove('hidden');

    if (itemRewardTimer) {
        clearTimeout(itemRewardTimer);
        itemRewardTimer = null;
    }

    const closeRewardModal = () => {
        if (itemRewardTimer) {
            clearTimeout(itemRewardTimer);
            itemRewardTimer = null;
        }
        dom.itemRewardModal.classList.add('hidden');
    };

    if (dom.btnClaimItemReward) {
        dom.btnClaimItemReward.onclick = closeRewardModal;
    }

    // Tự động đóng sau 6 giây nếu người chơi không bấm
    itemRewardTimer = setTimeout(() => {
        closeRewardModal();
    }, 6000);
}

function givePlayerItem(player, itemId) {
    if (!player) return false;
    if (!Array.isArray(player.items)) player.items = [];
    if (player.items.length >= MAX_ITEMS_PER_PLAYER) {
        return false;
    }
    player.items.push(itemId);
    updateProgressList();
    renderPlayerInventory();

    // CHỈ xuất hiện bảng thông báo chúc mừng trên màn hình của CHÍNH BẢN THÂN người chơi nhận được!
    // Tuyệt đối không xuất hiện trên màn hình của người khác!
    if (isCurrentDevicePlayer(player)) {
        if (dom.roundLeaderboardModal && !dom.roundLeaderboardModal.classList.contains('hidden')) {
            pendingMyItemReward = { itemId, player };
        } else {
            showItemRewardModal(itemId, player);
        }
    }

    return true;
}

function checkItemTileLanding(player) {
    if (ITEM_TILES.includes(player.position)) {
        const item = getRandomItem();
        const success = givePlayerItem(player, item.id);
        if (success) {
            AudioSFX.playItemGetSFX();
            addGameLog(`🎁 <strong>[HỘP TIẾP TẾ SƠN TRÀ]</strong> <strong>${player.name}</strong> dừng tại ô ${player.position}, mở hòm nhận được <strong>${item.icon} ${item.name}</strong>!`);
        } else {
            addGameLog(`🎁 <strong>[HỘP TIẾP TẾ SƠN TRÀ]</strong> <strong>${player.name}</strong> dừng tại ô ${player.position} nhưng túi đồ đã đầy (${MAX_ITEMS_PER_PLAYER}/${MAX_ITEMS_PER_PLAYER})!`);
        }
    }
}

function checkAndHandlePlayerStun(player) {
    if (!player) return false;
    if (player.skipTurnStatus === 'THIS_ROUND') {
        player.skipTurnStatus = null;
        player.isStunned = false;
        AudioSFX.playStunSFX();
        showBanner(`💫 ${player.name.toUpperCase()} BỊ CHOÁNG! MẤT LƯỢT!`);
        addGameLog(`💫 <strong>[CHOÁNG VÌ BOM]</strong> <strong>${player.name}</strong> đang bị choáng nên mất lượt tung xúc xắc ở vòng ${gameState.currentRound}!`);
        updateProgressList();
        renderPlayerInventory();
        setTimeout(() => {
            onPlayerMovementFinished(player);
        }, 1800);
        return true;
    }
    return false;
}

let pendingItemUsage = null;

function renderPlayerInventory() {
    if (!dom.inventorySlots) return;

    // Xác định người chơi mà Túi Đồ đại diện:
    // Ưu tiên hiển thị túi đồ của Người chơi trên máy này (myPlayerId hoặc người chơi thật đầu tiên)
    // để vật phẩm của người chơi LUÔN LUÔN hiển thị và giữ nguyên vẹn qua tất cả các lượt, không bị ẩn hay biến mất!
    let targetPlayer = null;
    if (myPlayerId) {
        targetPlayer = gameState.players.find(p => p.id === myPlayerId);
    }
    if (!targetPlayer) {
        // Nếu là host offline hoặc chưa gán myPlayerId, lấy người chơi thật đầu tiên (không phải Bot)
        targetPlayer = gameState.players.find(p => !p.isBot);
    }
    if (!targetPlayer) {
        targetPlayer = gameState.players.find(p => p.id === gameState.activePlayerId) || gameState.players[0];
    }
    if (!targetPlayer) return;

    if (!Array.isArray(targetPlayer.items)) {
        targetPlayer.items = [];
    }

    if (dom.inventoryCountBadge) {
        dom.inventoryCountBadge.textContent = `${targetPlayer.items.length}/${MAX_ITEMS_PER_PLAYER}`;
    }

    const isMine = (targetPlayer.id === myPlayerId) || (!myPlayerId && !targetPlayer.isBot);
    if (dom.inventoryTitle) {
        dom.inventoryTitle.textContent = isMine
            ? `🎒 TÚI VẬT PHẨM CỦA BẠN (${targetPlayer.avatarIcon || ''} ${targetPlayer.name})`
            : `🎒 TÚI VẬT PHẨM (${targetPlayer.avatarIcon || ''} ${targetPlayer.name})`;
    }

    dom.inventorySlots.innerHTML = '';
    const isMyTurn = (targetPlayer.id === gameState.activePlayerId);
    const canUse = isMyTurn && (gameState.phase === 'WAITING_ROLL');

    for (let i = 0; i < MAX_ITEMS_PER_PLAYER; i++) {
        const itemId = targetPlayer.items[i];
        const slotEl = document.createElement('div');

        if (itemId && ITEM_DEFINITIONS[itemId]) {
            const def = ITEM_DEFINITIONS[itemId];
            slotEl.className = 'inventory-slot has-item';
            const btnText = canUse ? 'DÙNG' : (isMyTurn ? 'CHỜ' : 'CHỜ LƯỢT');
            const btnTitle = canUse
                ? 'Bấm để kích hoạt vật phẩm này'
                : (isMyTurn ? 'Chờ lượt tung xúc xắc' : 'Vật phẩm được bảo lưu an toàn trong túi, chỉ có thể dùng khi đến lượt của bạn!');

            slotEl.innerHTML = `
                <div class="item-info-col">
                    <div class="item-icon-box">${def.icon}</div>
                    <div class="item-details-box">
                        <div class="item-name-row">
                            <span class="item-name-text">${def.name}</span>
                            <span class="item-badge-pill">${def.badge}</span>
                        </div>
                        <div class="item-desc-text">${def.desc}</div>
                    </div>
                </div>
                <button type="button" class="btn-use-item ${canUse ? 'pulse-ready' : 'btn-waiting'}" ${canUse ? '' : 'disabled'} title="${btnTitle}">${btnText}</button>
            `;
            const btnUse = slotEl.querySelector('.btn-use-item');
            if (btnUse && canUse) {
                btnUse.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleItemActivation(targetPlayer, itemId, i);
                });
            }
        } else {
            slotEl.className = 'inventory-slot empty';
            slotEl.innerHTML = `
                <div class="item-info-col">
                    <div class="item-icon-box" style="opacity: 0.35; font-size: 1.25rem;">🎒</div>
                    <span style="font-size: 0.62rem; color: #64748b; font-weight: 600;">Ô ${i + 1} Trống</span>
                </div>
            `;
        }
        dom.inventorySlots.appendChild(slotEl);
    }
}

function handleItemActivation(player, itemId, itemIndex) {
    if (gameState.phase !== 'WAITING_ROLL') return;
    const def = ITEM_DEFINITIONS[itemId];
    if (!def) return;

    if (def.needsTarget) {
        pendingItemUsage = { player, itemId, itemIndex };
        openTargetSelectModal(player, def);
    } else {
        player.items.splice(itemIndex, 1);
        executeItemEffect(player, itemId, null);
        renderPlayerInventory();
    }
}

function openTargetSelectModal(player, itemDef) {
    if (!dom.targetSelectModal || !dom.targetSelectList) return;
    if (dom.targetSelectBadge) dom.targetSelectBadge.textContent = `🎯 ${itemDef.icon} ${itemDef.name.toUpperCase()}`;
    if (dom.targetSelectTitle) dom.targetSelectTitle.textContent = `CHỌN MỤC TIÊU CHO ${itemDef.name.toUpperCase()}`;
    if (dom.targetSelectDesc) dom.targetSelectDesc.textContent = itemDef.desc;
    dom.targetSelectList.innerHTML = '';

    const opponents = gameState.players.filter(p => p.id !== player.id);
    if (opponents.length === 0) {
        addGameLog(`⚠️ Không tìm thấy đối thủ để sử dụng ${itemDef.name}!`);
        closeTargetSelectModal();
        return;
    }

    opponents.forEach(opp => {
        const itemRow = document.createElement('div');
        itemRow.className = 'target-select-item';
        itemRow.innerHTML = `
            <div class="target-player-info">
                <div class="target-player-dot" style="background-color: ${opp.color};">${opp.avatarIcon || '🐱'}</div>
                <div>
                    <div class="target-player-name">${opp.name}${opp.isBot ? ' 🤖' : ''}</div>
                    <div style="font-size: 0.68rem; color: #94a3b8;">${opp.isStunned ? '💫 Đang bị choáng' : 'Trạng thái: Bình thường'}</div>
                </div>
            </div>
            <div class="target-player-pos">Ô ${opp.position} / 50</div>
        `;
        itemRow.addEventListener('click', () => {
            if (pendingItemUsage) {
                const { player, itemId, itemIndex } = pendingItemUsage;
                player.items.splice(itemIndex, 1);
                executeItemEffect(player, itemId, opp.id);
                pendingItemUsage = null;
                closeTargetSelectModal();
                renderPlayerInventory();
            }
        });
        dom.targetSelectList.appendChild(itemRow);
    });

    if (dom.btnCancelTargetSelect) {
        dom.btnCancelTargetSelect.onclick = closeTargetSelectModal;
    }

    dom.targetSelectModal.classList.remove('hidden');
}

function closeTargetSelectModal() {
    if (dom.targetSelectModal) dom.targetSelectModal.classList.add('hidden');
    pendingItemUsage = null;
}

function executeItemEffect(player, itemId, targetId) {
    initAudio();

    if (itemId === 'rocket') {
        const bonusSteps = 4 + Math.floor(Math.random() * 3); // 4, 5, 6 bước
        const from = player.position;
        const to = Math.min(BOARD_LENGTH, from + bonusSteps);
        const special = SPECIAL_PATHS[to] !== undefined ? SPECIAL_PATHS[to] : to;

        AudioSFX.playRocketSFX();
        showBanner(`🚀 ${player.name.toUpperCase()} PHÓNG TÊN LỬA +${bonusSteps} BƯỚC!`);
        addGameLog(`🚀 <strong>[TÊN LỬA TĂNG TỐC]</strong> <strong>${player.name}</strong> kích hoạt tên lửa, phóng vọt thêm <strong>${bonusSteps} bước</strong> (${from} ➔ ${to})!`);

        animateStepMovement(player, to, () => {
            player.position = to;
            player.visualPos = to;
            dom.activePlayerPos.textContent = `${player.position} / ${BOARD_LENGTH}`;
            updateProgressList();
            renderTokens();

            if (special !== to) {
                setTimeout(() => {
                    animateSlideAlongPath(player, to, special, () => {
                        player.position = special;
                        player.visualPos = special;
                        dom.activePlayerPos.textContent = `${player.position} / ${BOARD_LENGTH}`;
                        updateProgressList();
                        renderTokens();
                        if (player.position >= BOARD_LENGTH) {
                            triggerVictory(player);
                        } else {
                            checkItemTileLanding(player);
                        }
                    });
                }, 500);
            } else {
                if (player.position >= BOARD_LENGTH) {
                    triggerVictory(player);
                } else {
                    checkItemTileLanding(player);
                }
            }
        });
    } else if (itemId === 'bomber') {
        const target = gameState.players.find(p => p.id === targetId);
        if (!target) return;

        AudioSFX.playExplosionSFX();

        const currentTurnIdx = gameState.currentTurnIndex;
        const targetTurnIdx = gameState.turnOrder.indexOf(target.id);

        let stunMessage = '';
        if (targetTurnIdx > currentTurnIdx) {
            target.skipTurnStatus = 'THIS_ROUND';
            stunMessage = `mất lượt tung xúc xắc ở vòng này (Vòng ${gameState.currentRound})!`;
        } else {
            target.skipTurnStatus = 'NEXT_ROUND';
            stunMessage = `mất lượt tung xúc xắc ở vòng sau (Vòng ${gameState.currentRound + 1})!`;
        }
        target.isStunned = true;

        showBanner(`💣 BOM NỔ! ${target.name.toUpperCase()} BỊ CHOÁNG!`);
        addGameLog(`💣 <strong>[MÁY BAY THẢ BOM]</strong> <strong>${player.name}</strong> thả bom ném trúng <strong>${target.name}</strong>! Nạn nhân bị choáng và ${stunMessage}`);

        updateProgressList();
        renderPlayerInventory();
    } else if (itemId === 'double_dice') {
        player.hasDoubleBuff = true;
        AudioSFX.playBuffSFX();
        showBanner(`⚡ ${player.name.toUpperCase()} KÍCH HOẠT X2 BƯỚC ĐI!`);
        addGameLog(`⚡ <strong>[BÙA NHÂN ĐÔI]</strong> <strong>${player.name}</strong> kích hoạt Bùa X2! Số bước di chuyển ở lượt tung này sẽ được nhân đôi!`);

        updateTurnButtons(player);
    } else if (itemId === 'hook') {
        const target = gameState.players.find(p => p.id === targetId);
        if (!target) return;

        const from = target.position;
        const to = Math.max(0, from - 4);
        const special = SPECIAL_PATHS[to] !== undefined ? SPECIAL_PATHS[to] : to;

        AudioSFX.playHookSFX();
        showBanner(`🪝 ${player.name.toUpperCase()} KÉO LÙI ${target.name.toUpperCase()} 4 Ô!`);
        addGameLog(`🪝 <strong>[MÓC KÉO ĐỐI THỦ]</strong> <strong>${player.name}</strong> phóng móc kéo trúng <strong>${target.name}</strong>, giật lùi 4 ô (${from} ➔ ${to})!`);

        animateStepMovement(target, to, () => {
            target.position = to;
            target.visualPos = to;
            updateProgressList();
            renderTokens();

            if (special !== to) {
                setTimeout(() => {
                    animateSlideAlongPath(target, to, special, () => {
                        target.position = special;
                        target.visualPos = special;
                        updateProgressList();
                        renderTokens();
                    });
                }, 500);
            }
        });
        renderPlayerInventory();
    } else if (itemId === 'teleport') {
        const opponents = gameState.players.filter(p => p.id !== player.id);
        if (opponents.length === 0) return;
        const target = opponents[Math.floor(Math.random() * opponents.length)];

        const from = player.position;
        const to = target.position;

        AudioSFX.playTeleportSFX();
        showBanner(`🌀 DỊCH CHUYỂN TỚI VỊ TRÍ ${target.name.toUpperCase()}!`);
        addGameLog(`🌀 <strong>[MÁY DỊCH CHUYỂN]</strong> <strong>${player.name}</strong> kích hoạt máy dịch chuyển lượng tử, dịch chuyển từ ô ${from} đến ô <strong>${to}</strong> của <strong>${target.name}</strong>!`);

        player.position = to;
        player.visualPos = to;
        dom.activePlayerPos.textContent = `${player.position} / ${BOARD_LENGTH}`;
        focusCameraOnPlayer(player, true, 300);
        updateProgressList();
        renderTokens();
        renderPlayerInventory();
    }
}

function handleOfflineRoll() {
    const activeId = gameState.activePlayerId || gameState.turnOrder[gameState.currentTurnIndex];
    const player = gameState.players.find(p => p.id === activeId);
    if (!player || gameState.phase !== 'WAITING_ROLL') return;

    let roll = Math.floor(Math.random() * 6) + 1;
    let effectiveSteps = roll;
    let isDouble = false;

    if (player.hasDoubleBuff) {
        effectiveSteps = roll * 2;
        isDouble = true;
        player.hasDoubleBuff = false;
        AudioSFX.playBuffSFX();
        showBanner(`⚡ X2 BƯỚC: ${roll} ➔ ${effectiveSteps} BƯỚC!`);
        addGameLog(`⚡ <strong>[BÙA NHÂN ĐÔI]</strong> <strong>${player.name}</strong> tung được ${roll} điểm ➔ Bứt tốc gấp đôi: <strong>${effectiveSteps} BƯỚC!</strong>`);
    }

    const initialPos = player.position;
    const landPos = Math.min(BOARD_LENGTH, initialPos + effectiveSteps);
    const specialTarget = SPECIAL_PATHS[landPos] !== undefined ? SPECIAL_PATHS[landPos] : landPos;

    onDiceRollReceived({
        t: 'dice_roll',
        player: parseInt(player.id.replace('player_', ''), 10) - 1,
        roll: roll,
        effectiveSteps: effectiveSteps,
        isDouble: isDouble,
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
    if (!player || !player.isBot || gameState.phase !== 'WAITING_ROLL') return;

    // 1. Bot AI cân nhắc dùng vật phẩm (vòng 1 giữ lại đồ để thi đấu, các vòng sau dùng chiến thuật)
    const botUseChance = (gameState.currentRound === 1) ? 0.20 : 0.40;
    if (Array.isArray(player.items) && player.items.length > 0 && Math.random() < botUseChance) {
        const itemToUse = player.items[0];
        const opponents = gameState.players.filter(p => p.id !== player.id);
        const sortedOpponents = [...opponents].sort((a, b) => b.position - a.position);

        let targetId = null;
        if (itemToUse === 'bomber' || itemToUse === 'hook') {
            targetId = sortedOpponents[0]?.id; // nhắm vào đối thủ đang dẫn đầu
        }

        setTimeout(() => {
            if (gameState.phase === 'WAITING_ROLL' && gameState.activePlayerId === player.id) {
                const itemIndex = player.items.indexOf(itemToUse);
                if (itemIndex >= 0) {
                    player.items.splice(itemIndex, 1);
                    executeItemEffect(player, itemToUse, targetId);
                    renderPlayerInventory();
                }

                // Sau khi dùng vật phẩm, chờ 1.2s rồi thực hiện tung xúc xắc
                setTimeout(() => {
                    if (gameState.phase === 'WAITING_ROLL' && gameState.activePlayerId === player.id) {
                        handleOfflineRoll();
                    }
                }, 1200);
            }
        }, 800);
        return;
    }

    // Nếu không dùng vật phẩm, tung xúc xắc bình thường sau 1.3s
    setTimeout(() => {
        if (gameState.phase === 'WAITING_ROLL' && gameState.activePlayerId === player.id) {
            handleOfflineRoll();
        }
    }, 1300);
}

async function triggerMinigame(gameType = 'game-1', targetPlayer = null) {
    if (!window.MinigameManager) {
        console.warn('[Minigame] MinigameManager chưa sẵn sàng.');
        return { win: false, score: 50, bonusSteps: 0 };
    }

    const player = targetPlayer || gameState.players.find(p => p.id === gameState.activePlayerId) || gameState.players[0];
    addGameLog(`🎮 <strong>[THỬ THÁCH MINIGAME]</strong> <strong>${player ? player.name : 'Người chơi'}</strong> bắt đầu thử thách tính điểm!`);

    try {
        const launchOpts = { player, allPlayers: gameState.players };
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

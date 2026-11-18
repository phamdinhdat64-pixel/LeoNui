/**
 * MINI-GAME 8: CHIA KHO BÁU (TREASURE SPLIT)
 * - Cách chơi: Trên bàn có 3 rương điểm:
 *   + Rương Vàng (50 điểm)
 *   + Rương Bạc (30 điểm)
 *   + Rương Đồng (15 điểm)
 *   Trong 10 giây, tất cả người chơi bí mật bấm chọn 1 trong 3 rương.
 * - Tính điểm:
 *   + Nếu CHỈ CÓ 1 NGƯỜI chọn rương đó: Người đó ăn trọn số điểm của rương!
 *   + Nếu có TỪ 2 NGƯỜI TRỞ LÊN cùng chọn chung 1 rương: Cả nhóm đó tranh giành và nhận điểm chia đều ra!
 * - Thời gian: Thi đấu trong 5 lượt (5 vòng tâm lý cân não). Sau 5 lượt xếp hạng theo điểm số!
 */

(function () {
    let _turnTimer = null;
    let _nextRoundTimeout = null;
    let _keyHandler = null;
    let _isFinished = false;
    let _isRunning = false;

    let _currentRound = 1;
    const _MAX_ROUNDS = 5;
    const _ROUND_TIME_SEC = 10;

    // Định nghĩa 3 chiếc rương kho báu
    const CHESTS = {
        gold: { id: 'gold', name: 'RƯƠNG VÀNG', points: 50, color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.6)', icon: '👑' },
        silver: { id: 'silver', name: 'RƯƠNG BẠC', points: 30, color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.6)', icon: '🥈' },
        bronze: { id: 'bronze', name: 'RƯƠNG ĐỒNG', points: 15, color: '#d97706', glow: 'rgba(217, 119, 6, 0.6)', icon: '🥉' }
    };

    // Danh sách đối thủ mặc định nếu chỉ có 1 người chơi
    const DEFAULT_BOTS = [
        { id: 'bot_greedy', name: 'Lão Hám Vàng', avatar: '🧙‍♂️', color: '#ef4444', personality: 'greedy' },
        { id: 'bot_cautious', name: 'Kẻ Thận Trọng', avatar: '🧝‍♀️', color: '#10b981', personality: 'cautious' },
        { id: 'bot_tactician', name: 'Chiến Thuật Gia', avatar: '🦊', color: '#8b5cf6', personality: 'tactician' }
    ];

    let _players = [];
    let _playerChoices = {};
    let _myPlayerId = 'human';
    let _roundScoresHistory = [];

    // Âm thanh Web Audio API
    function playAudio(type) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!window._game8AudioCtx) {
                window._game8AudioCtx = new AudioCtx();
            }
            const actx = window._game8AudioCtx;
            if (actx.state === 'suspended') actx.resume();
            const now = actx.currentTime;

            if (type === 'tick') {
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(620, now);
                gain.gain.setValueAtTime(0.04, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.04);
            } else if (type === 'select') {
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(520, now);
                osc.frequency.exponentialRampToValueAtTime(780, now + 0.06);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.06);
            } else if (type === 'reveal') {
                // Tiếng bật nắp rương và rủng rỉnh tiền
                const notes = [440, 554.37, 659.25, 880];
                notes.forEach((f, i) => {
                    const osc = actx.createOscillator();
                    const gain = actx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(f, now + i * 0.05);
                    gain.gain.setValueAtTime(0.1, now + i * 0.05);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.18);
                    osc.connect(gain);
                    gain.connect(actx.destination);
                    osc.start(now + i * 0.05);
                    osc.stop(now + i * 0.05 + 0.18);
                });
            } else if (type === 'solo_win') {
                // Hợp âm ăn trọn kho báu
                [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
                    const osc = actx.createOscillator();
                    const gain = actx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, now + idx * 0.08);
                    gain.gain.setValueAtTime(0.15, now + idx * 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
                    osc.connect(gain);
                    gain.connect(actx.destination);
                    osc.start(now + idx * 0.08);
                    osc.stop(now + idx * 0.08 + 0.35);
                });
            } else if (type === 'split') {
                // Tiếng chia tiền lách cách
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(380, now);
                osc.frequency.linearRampToValueAtTime(260, now + 0.12);
                gain.gain.setValueAtTime(0.09, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.12);
            } else if (type === 'victory') {
                // Kèn chiến thắng kết thúc 5 lượt
                [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((f, idx) => {
                    const osc = actx.createOscillator();
                    const gain = actx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(f, now + idx * 0.08);
                    gain.gain.setValueAtTime(0.16, now + idx * 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.45);
                    osc.connect(gain);
                    gain.connect(actx.destination);
                    osc.start(now + idx * 0.08);
                    osc.stop(now + idx * 0.08 + 0.45);
                });
            }
        } catch (_) {}
    }

    // SVG Đồ Họa 3 Chiếc Rương Kho Báu Sinh Động
    function renderChestSvg(type, isOpen = false) {
        if (type === 'gold') {
            return `
                <svg class="chest-svg ${isOpen ? 'open' : 'closed'}" viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="goldChestBody" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#b45309" />
                            <stop offset="50%" stop-color="#78350f" />
                            <stop offset="100%" stop-color="#451a03" />
                        </linearGradient>
                        <linearGradient id="goldTrim" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stop-color="#f59e0b" />
                            <stop offset="50%" stop-color="#fef08a" />
                            <stop offset="100%" stop-color="#d97706" />
                        </linearGradient>
                    </defs>
                    <!-- Ánh hào quang khi mở -->
                    ${isOpen ? '<circle cx="60" cy="35" r="45" fill="rgba(253, 224, 71, 0.45)" filter="blur(6px)" />' : ''}
                    ${isOpen ? '<polygon points="60,10 65,30 85,32 70,45 74,65 60,52 46,65 50,45 35,32 55,30" fill="#fde047" opacity="0.95" />' : ''}
                    <!-- Thân rương -->
                    <rect x="18" y="45" width="84" height="46" rx="6" fill="url(#goldChestBody)" stroke="#f59e0b" stroke-width="3" />
                    <!-- Nẹp viền vàng -->
                    <rect x="22" y="45" width="10" height="46" fill="url(#goldTrim)" />
                    <rect x="88" y="45" width="10" height="46" fill="url(#goldTrim)" />
                    <!-- Ổ khóa ngọc đỏ -->
                    <circle cx="60" cy="55" r="7" fill="#ef4444" stroke="#fde047" stroke-width="2" />
                    <!-- Nắp rương -->
                    ${isOpen ? `
                        <path d="M 14 38 Q 60 12 106 38 L 102 44 Q 60 22 18 44 Z" fill="#d97706" stroke="#fef08a" stroke-width="2.5" />
                    ` : `
                        <path d="M 16 46 Q 60 20 104 46 Z" fill="url(#goldChestBody)" stroke="#f59e0b" stroke-width="3" />
                        <path d="M 22 46 Q 60 24 98 46" stroke="#fef08a" stroke-width="2.5" fill="none" />
                    `}
                </svg>
            `;
        } else if (type === 'silver') {
            return `
                <svg class="chest-svg ${isOpen ? 'open' : 'closed'}" viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="silverChestBody" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#475569" />
                            <stop offset="50%" stop-color="#334155" />
                            <stop offset="100%" stop-color="#1e293b" />
                        </linearGradient>
                        <linearGradient id="silverTrim" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stop-color="#cbd5e1" />
                            <stop offset="50%" stop-color="#ffffff" />
                            <stop offset="100%" stop-color="#94a3b8" />
                        </linearGradient>
                    </defs>
                    ${isOpen ? '<circle cx="60" cy="35" r="42" fill="rgba(56, 189, 248, 0.45)" filter="blur(6px)" />' : ''}
                    ${isOpen ? '<polygon points="60,12 65,30 83,32 69,44 73,62 60,50 47,62 51,44 37,32 55,30" fill="#38bdf8" opacity="0.9" />' : ''}
                    <rect x="20" y="47" width="80" height="44" rx="6" fill="url(#silverChestBody)" stroke="#94a3b8" stroke-width="2.5" />
                    <rect x="24" y="47" width="9" height="44" fill="url(#silverTrim)" />
                    <rect x="87" y="47" width="9" height="44" fill="url(#silverTrim)" />
                    <circle cx="60" cy="56" r="6" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" />
                    ${isOpen ? `
                        <path d="M 16 40 Q 60 16 104 40 L 100 46 Q 60 26 20 46 Z" fill="#94a3b8" stroke="#ffffff" stroke-width="2" />
                    ` : `
                        <path d="M 18 48 Q 60 24 102 48 Z" fill="url(#silverChestBody)" stroke="#cbd5e1" stroke-width="2.5" />
                        <path d="M 24 48 Q 60 28 96 48" stroke="#ffffff" stroke-width="2" fill="none" />
                    `}
                </svg>
            `;
        } else {
            return `
                <svg class="chest-svg ${isOpen ? 'open' : 'closed'}" viewBox="0 0 120 100" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <linearGradient id="bronzeChestBody" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stop-color="#78350f" />
                            <stop offset="50%" stop-color="#451a03" />
                            <stop offset="100%" stop-color="#291203" />
                        </linearGradient>
                        <linearGradient id="bronzeTrim" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stop-color="#d97706" />
                            <stop offset="50%" stop-color="#f59e0b" />
                            <stop offset="100%" stop-color="#b45309" />
                        </linearGradient>
                    </defs>
                    ${isOpen ? '<circle cx="60" cy="38" r="38" fill="rgba(249, 115, 22, 0.45)" filter="blur(6px)" />' : ''}
                    ${isOpen ? '<polygon points="60,16 64,30 80,32 68,43 71,59 60,48 49,59 52,43 40,32 56,30" fill="#f97316" opacity="0.9" />' : ''}
                    <rect x="22" y="49" width="76" height="42" rx="6" fill="url(#bronzeChestBody)" stroke="#d97706" stroke-width="2.5" />
                    <rect x="26" y="49" width="8" height="42" fill="url(#bronzeTrim)" />
                    <rect x="86" y="49" width="8" height="42" fill="url(#bronzeTrim)" />
                    <circle cx="60" cy="57" r="5" fill="#f59e0b" stroke="#78350f" stroke-width="1.5" />
                    ${isOpen ? `
                        <path d="M 18 42 Q 60 20 102 42 L 98 48 Q 60 30 22 48 Z" fill="#b45309" stroke="#f59e0b" stroke-width="2" />
                    ` : `
                        <path d="M 20 50 Q 60 28 100 50 Z" fill="url(#bronzeChestBody)" stroke="#d97706" stroke-width="2.5" />
                        <path d="M 26 50 Q 60 32 94 50" stroke="#f59e0b" stroke-width="1.8" fill="none" />
                    `}
                </svg>
            `;
        }
    }

    const Game8 = {
        id: 'game-8',
        title: 'CHIA KHO BÁU',
        description: 'Có 3 rương: Vàng (50đ), Bạc (30đ), Đồng (15đ). Trong 10s, bí mật chọn 1 rương. Nếu chỉ 1 người chọn: <strong>ăn trọn số điểm</strong>! Nếu 2+ người chọn: <strong>chia đều điểm</strong>! Sau 5 lượt xếp hạng theo điểm.',

        init(container, onComplete, options = {}) {
            _isFinished = false;
            _isRunning = true;
            _currentRound = 1;
            _roundScoresHistory = [];

            // 1. Khởi tạo danh sách người chơi (người thật + các bot thông minh)
            const humanPlayer = options.player || { name: 'Bạn', id: 'human' };
            _myPlayerId = humanPlayer.id;

            if (options.allPlayers && options.allPlayers.length >= 2) {
                _players = options.allPlayers.map(p => ({
                    id: p.id,
                    name: p.name,
                    avatar: p.avatarIcon || (p.id === _myPlayerId ? '🧙‍♂️' : '🧝‍♀️'),
                    color: p.color || '#38bdf8',
                    isBot: p.isBot || false,
                    totalScore: 0,
                    personality: p.isBot ? (Math.random() < 0.4 ? 'greedy' : (Math.random() < 0.7 ? 'cautious' : 'tactician')) : 'human'
                }));
            } else {
                _players = [
                    { id: _myPlayerId, name: humanPlayer.name || 'Bạn', avatar: humanPlayer.avatarIcon || '🧙‍♂️', color: humanPlayer.color || '#38bdf8', isBot: false, totalScore: 0, personality: 'human' },
                    ...DEFAULT_BOTS.map(b => ({ ...b, totalScore: 0, isBot: true }))
                ];
            }

            // 2. Dựng giao diện Mini-game Chia Kho Báu
            container.innerHTML = `
                <div class="game8-wrapper">
                    <!-- Header Bar: Vòng Đấu & Đồng Hồ Đếm Ngược -->
                    <div class="game8-header-bar">
                        <div class="game8-hud-pill round-pill">
                            <span>🏆 LƯỢT:</span>
                            <span class="hud-val" id="game8Round">1 / 5</span>
                        </div>
                        <div class="game8-hud-pill timer-pill" id="game8TimerPill">
                            <span>⏱️ CÒN:</span>
                            <span class="hud-val" id="game8Timer">10.0s</span>
                        </div>
                        <div class="game8-hud-pill score-pill">
                            <span>🎯 ĐIỂM BẠN:</span>
                            <span class="hud-val" id="game8MyScore">0</span>
                        </div>
                    </div>

                    <!-- Bảng Người Chơi & Trạng Thái Chọn Lựa (Bí Mật) -->
                    <div class="game8-players-strip" id="game8PlayersStrip">
                        <!-- Render danh sách người chơi động -->
                    </div>

                    <!-- Sân Khấu 3 Rương Kho Báu -->
                    <div class="game8-stage" id="game8Stage">
                        <div class="game8-chests-row">
                            <!-- RƯƠNG VÀNG (50 ĐIỂM) -->
                            <div class="game8-chest-slot" data-chest="gold" id="slotGold">
                                <div class="chest-card-header">
                                    <span class="chest-badge gold">50 ĐIỂM</span>
                                </div>
                                <div class="chest-art-wrap" id="artGold">
                                    ${renderChestSvg('gold', false)}
                                </div>
                                <div class="chest-title gold">RƯƠNG VÀNG</div>
                                <div class="chest-result-pill" id="resPillGold">
                                    <span class="chest-count-txt" id="cntGold">? người</span>
                                    <span class="chest-pts-txt" id="ptsGold">50đ</span>
                                </div>
                                <div class="chest-avatars-box" id="avatarsGold"></div>
                            </div>

                            <!-- RƯƠNG BẠC (30 ĐIỂM) -->
                            <div class="game8-chest-slot" data-chest="silver" id="slotSilver">
                                <div class="chest-card-header">
                                    <span class="chest-badge silver">30 ĐIỂM</span>
                                </div>
                                <div class="chest-art-wrap" id="artSilver">
                                    ${renderChestSvg('silver', false)}
                                </div>
                                <div class="chest-title silver">RƯƠNG BẠC</div>
                                <div class="chest-result-pill" id="resPillSilver">
                                    <span class="chest-count-txt" id="cntSilver">? người</span>
                                    <span class="chest-pts-txt" id="ptsSilver">30đ</span>
                                </div>
                                <div class="chest-avatars-box" id="avatarsSilver"></div>
                            </div>

                            <!-- RƯƠNG ĐỒNG (15 ĐIỂM) -->
                            <div class="game8-chest-slot" data-chest="bronze" id="slotBronze">
                                <div class="chest-card-header">
                                    <span class="chest-badge bronze">15 ĐIỂM</span>
                                </div>
                                <div class="chest-art-wrap" id="artBronze">
                                    ${renderChestSvg('bronze', false)}
                                </div>
                                <div class="chest-title bronze">RƯƠNG ĐỒNG</div>
                                <div class="chest-result-pill" id="resPillBronze">
                                    <span class="chest-count-txt" id="cntBronze">? người</span>
                                    <span class="chest-pts-txt" id="ptsBronze">15đ</span>
                                </div>
                                <div class="chest-avatars-box" id="avatarsBronze"></div>
                            </div>
                        </div>

                        <!-- Thông báo trạng thái giữa màn hình -->
                        <div class="game8-status-banner" id="game8StatusBanner">
                            🔒 BÍ MẬT BẤM CHỌN 1 RƯƠNG TRONG 10 GIÂY!
                        </div>

                        <!-- Thẻ Bảng Tổng Kết Sau 5 Lượt -->
                        <div class="game8-final-card" id="game8FinalCard">
                            <div class="final-title">🏆 BẢNG VINH DANH CHIA KHO BÁU</div>
                            <div class="final-ranking-list" id="game8FinalRanking"></div>
                            <div class="final-verdict" id="game8FinalVerdict"></div>
                        </div>
                    </div>

                    <!-- 3 Nút Bấm Lựa Chọn Phía Dưới -->
                    <div class="game8-controls-grid">
                        <button type="button" class="game8-btn-pick btn-gold" data-chest="gold" id="btnPickGold">
                            <span class="pick-btn-icon">👑</span>
                            <span class="pick-btn-title">CHỌN VÀNG (50đ)</span>
                            <span class="pick-btn-hint">(Phím 1 hoặc A)</span>
                        </button>
                        <button type="button" class="game8-btn-pick btn-silver" data-chest="silver" id="btnPickSilver">
                            <span class="pick-btn-icon">🥈</span>
                            <span class="pick-btn-title">CHỌN BẠC (30đ)</span>
                            <span class="pick-btn-hint">(Phím 2 hoặc S)</span>
                        </button>
                        <button type="button" class="game8-btn-pick btn-bronze" data-chest="bronze" id="btnPickBronze">
                            <span class="pick-btn-icon">🥉</span>
                            <span class="pick-btn-title">CHỌN ĐỒNG (15đ)</span>
                            <span class="pick-btn-hint">(Phím 3 hoặc D)</span>
                        </button>
                    </div>

                    <div class="game8-hint-rule">
                        💡 <strong>Luật chơi:</strong> Nếu <em>1 người chọn</em> ➔ Ăn trọn điểm! Nếu <em>2+ người cùng chọn</em> ➔ Chia đều điểm!
                    </div>
                </div>
            `;

            // 3. Tham chiếu DOM
            const roundEl = container.querySelector('#game8Round');
            const timerEl = container.querySelector('#game8Timer');
            const timerPill = container.querySelector('#game8TimerPill');
            const myScoreEl = container.querySelector('#game8MyScore');
            const playersStrip = container.querySelector('#game8PlayersStrip');
            const statusBanner = container.querySelector('#game8StatusBanner');
            const finalCard = container.querySelector('#game8FinalCard');
            const finalRankingEl = container.querySelector('#game8FinalRanking');
            const finalVerdictEl = container.querySelector('#game8FinalVerdict');

            const slotGold = container.querySelector('#slotGold');
            const slotSilver = container.querySelector('#slotSilver');
            const slotBronze = container.querySelector('#slotBronze');
            const artGold = container.querySelector('#artGold');
            const artSilver = container.querySelector('#artSilver');
            const artBronze = container.querySelector('#artBronze');
            const resPillGold = container.querySelector('#resPillGold');
            const resPillSilver = container.querySelector('#resPillSilver');
            const resPillBronze = container.querySelector('#resPillBronze');
            const avatarsGold = container.querySelector('#avatarsGold');
            const avatarsSilver = container.querySelector('#avatarsSilver');
            const avatarsBronze = container.querySelector('#avatarsBronze');
            const cntGold = container.querySelector('#cntGold');
            const cntSilver = container.querySelector('#cntSilver');
            const cntBronze = container.querySelector('#cntBronze');
            const ptsGold = container.querySelector('#ptsGold');
            const ptsSilver = container.querySelector('#ptsSilver');
            const ptsBronze = container.querySelector('#ptsBronze');

            const btnPickGold = container.querySelector('#btnPickGold');
            const btnPickSilver = container.querySelector('#btnPickSilver');
            const btnPickBronze = container.querySelector('#btnPickBronze');
            const allPickBtns = [btnPickGold, btnPickSilver, btnPickBronze];

            // 4. Render thanh trạng thái người chơi
            function renderPlayersStrip(revealChoices = false) {
                if (!playersStrip) return;
                playersStrip.innerHTML = '';
                _players.forEach(p => {
                    const isMe = p.id === _myPlayerId;
                    const choice = _playerChoices[p.id];
                    let statusTxt = 'Đang nghĩ...';
                    let statusClass = 'thinking';

                    if (choice) {
                        if (revealChoices || isMe) {
                            statusTxt = choice === 'gold' ? '👑 Vàng' : (choice === 'silver' ? '🥈 Bạc' : '🥉 Đồng');
                            statusClass = `locked ${choice}`;
                        } else {
                            statusTxt = 'Đã chọn 🔒';
                            statusClass = 'locked hidden-choice';
                        }
                    }

                    const item = document.createElement('div');
                    item.className = `player-strip-card ${isMe ? 'is-me' : ''}`;
                    item.innerHTML = `
                        <div class="player-avatar-badge" style="border-color: ${p.color};">${p.avatar}</div>
                        <div class="player-strip-info">
                            <span class="player-name">${p.name}${isMe ? ' (Bạn)' : ''}</span>
                            <span class="player-total-pts">${p.totalScore}đ</span>
                        </div>
                        <div class="player-choice-tag ${statusClass}">${statusTxt}</div>
                    `;
                    playersStrip.appendChild(item);
                });
            }

            // 5. AI Lựa Chọn Rương Theo Tâm Lý
            function generateBotChoices(round) {
                const chestKeys = ['gold', 'silver', 'bronze'];
                _players.forEach(p => {
                    if (!p.isBot) return;

                    let chosen = 'gold';
                    const rand = Math.random();

                    if (p.personality === 'greedy') {
                        // Thích liều ăn nhiều: 65% Vàng, 25% Bạc, 10% Đồng
                        if (rand < 0.65) chosen = 'gold';
                        else if (rand < 0.90) chosen = 'silver';
                        else chosen = 'bronze';
                    } else if (p.personality === 'cautious') {
                        // Thận trọng né đám đông: 20% Vàng, 50% Bạc, 30% Đồng
                        if (rand < 0.20) chosen = 'gold';
                        else if (rand < 0.70) chosen = 'silver';
                        else chosen = 'bronze';
                    } else {
                        // Chiến thuật gia: Quan sát lịch sử vòng trước
                        const lastRound = _roundScoresHistory[_roundScoresHistory.length - 1];
                        if (lastRound && lastRound.goldCount >= 2) {
                            // Vòng trước vàng bị tranh nhiều, vòng này né sang bạc/đồng
                            chosen = rand < 0.6 ? 'silver' : 'bronze';
                        } else {
                            // Vòng trước ít người lấy vàng, vòng này nhắm vàng
                            chosen = rand < 0.6 ? 'gold' : 'silver';
                        }
                    }

                    // Bot đưa ra quyết định ngẫu nhiên trong khoảng 1.5s đến 6.0s
                    const thinkDelay = 1500 + Math.random() * 4500;
                    setTimeout(() => {
                        if (!_isFinished && _playerChoices) {
                            _playerChoices[p.id] = chosen;
                            renderPlayersStrip(false);
                        }
                    }, thinkDelay);
                });
            }

            // 6. Xử lý người chơi thật bấm chọn rương
            function setMyChoice(chestKey) {
                if (_isFinished) return;
                _playerChoices[_myPlayerId] = chestKey;
                playAudio('select');

                allPickBtns.forEach(btn => {
                    if (btn.dataset.chest === chestKey) {
                        btn.classList.add('selected');
                    } else {
                        btn.classList.remove('selected');
                    }
                });

                [slotGold, slotSilver, slotBronze].forEach(slot => {
                    if (slot.dataset.chest === chestKey) {
                        slot.classList.add('user-selected');
                    } else {
                        slot.classList.remove('user-selected');
                    }
                });

                if (statusBanner) {
                    const chestName = CHESTS[chestKey].name;
                    statusBanner.textContent = `🎯 Bạn đã chọn: ${chestName}! Có thể đổi rương trước khi hết giờ.`;
                }

                renderPlayersStrip(false);
            }

            // 7. Bắt đầu một lượt 10 giây mới
            function startRound(roundNum) {
                if (_isFinished) return;
                _currentRound = roundNum;
                _playerChoices = {};

                if (roundEl) roundEl.textContent = `${_currentRound} / ${_MAX_ROUNDS}`;

                // Reset UI các rương về trạng thái đóng
                [slotGold, slotSilver, slotBronze].forEach(s => s.className = 'game8-chest-slot');
                artGold.innerHTML = renderChestSvg('gold', false);
                artSilver.innerHTML = renderChestSvg('silver', false);
                artBronze.innerHTML = renderChestSvg('bronze', false);

                [resPillGold, resPillSilver, resPillBronze].forEach(p => p.className = 'chest-result-pill');
                [avatarsGold, avatarsSilver, avatarsBronze].forEach(b => b.innerHTML = '');
                [cntGold, cntSilver, cntBronze].forEach(c => c.textContent = '? người');
                ptsGold.textContent = '50đ';
                ptsSilver.textContent = '30đ';
                ptsBronze.textContent = '15đ';

                allPickBtns.forEach(b => {
                    b.disabled = false;
                    b.classList.remove('selected');
                });

                if (statusBanner) {
                    statusBanner.className = 'game8-status-banner';
                    statusBanner.textContent = `🔒 LƯỢT ${_currentRound}/5: BÍ MẬT BẤM CHỌN 1 TRONG 3 RƯƠNG TRONG 10 GIÂY!`;
                }

                renderPlayersStrip(false);

                // Khởi động bot suy nghĩ
                generateBotChoices(_currentRound);

                // Đồng hồ đếm ngược 10 giây
                let timeLeft = _ROUND_TIME_SEC;
                if (timerEl) {
                    timerEl.textContent = `${timeLeft.toFixed(1)}s`;
                    timerEl.classList.remove('critical');
                }

                _turnTimer = setInterval(() => {
                    timeLeft = Math.max(0, timeLeft - 0.1);
                    if (timerEl) {
                        timerEl.textContent = `${timeLeft.toFixed(1)}s`;
                        if (timeLeft <= 3.0) {
                            timerEl.classList.add('critical');
                            playAudio('tick');
                        }
                    }

                    if (timeLeft <= 0.001) {
                        clearInterval(_turnTimer);
                        _turnTimer = null;
                        endRoundAndReveal();
                    }
                }, 100);
            }

            // 8. Kết thúc 5s và Mở Rương (Reveal & Dispute Phase)
            function endRoundAndReveal() {
                allPickBtns.forEach(b => b.disabled = true);

                // Nếu người chơi chưa kịp bấm, tự động gán ngẫu nhiên 1 rương
                if (!_playerChoices[_myPlayerId]) {
                    const keys = ['gold', 'silver', 'bronze'];
                    _playerChoices[_myPlayerId] = keys[Math.floor(Math.random() * keys.length)];
                }

                // Đảm bảo tất cả bot đều có lựa chọn
                _players.forEach(p => {
                    if (!_playerChoices[p.id]) {
                        _playerChoices[p.id] = 'silver';
                    }
                });

                playAudio('reveal');

                // Mở nắp cả 3 rương
                artGold.innerHTML = renderChestSvg('gold', true);
                artSilver.innerHTML = renderChestSvg('silver', true);
                artBronze.innerHTML = renderChestSvg('bronze', true);

                // Phân loại ai chọn rương nào
                const chestSelectors = { gold: [], silver: [], bronze: [] };
                _players.forEach(p => {
                    const ch = _playerChoices[p.id];
                    if (chestSelectors[ch]) chestSelectors[ch].push(p);
                });

                // Cập nhật DOM các avatar vào từng rương
                renderChestAvatars(chestSelectors);

                // Tính điểm từng rương theo quy tắc: 1 người = ĂN TRỌN, 2+ người = CHIA ĐỀU
                let myRoundPoints = 0;
                let roundVerdictMsg = '';

                Object.keys(CHESTS).forEach(key => {
                    const group = chestSelectors[key];
                    const chestMeta = CHESTS[key];
                    const count = group.length;
                    const slotEl = key === 'gold' ? slotGold : (key === 'silver' ? slotSilver : slotBronze);
                    const pillEl = key === 'gold' ? resPillGold : (key === 'silver' ? resPillSilver : resPillBronze);
                    const cntEl = key === 'gold' ? cntGold : (key === 'silver' ? cntSilver : cntBronze);
                    const ptsEl = key === 'gold' ? ptsGold : (key === 'silver' ? ptsSilver : ptsBronze);

                    if (count === 0) {
                        cntEl.textContent = '0 người';
                        ptsEl.textContent = '0đ';
                        pillEl.classList.add('empty');
                    } else if (count === 1) {
                        // Ăn trọn số điểm!
                        const winner = group[0];
                        winner.totalScore += chestMeta.points;
                        cntEl.textContent = '1 người (Ăn trọn!)';
                        ptsEl.textContent = `+${chestMeta.points}đ`;
                        pillEl.classList.add('solo-win');
                        slotEl.classList.add('glow-win');

                        if (winner.id === _myPlayerId) {
                            myRoundPoints = chestMeta.points;
                            roundVerdictMsg = `🌟 TUYỆT VỜI! Bạn độc chiếm ${chestMeta.name} ăn trọn +${chestMeta.points} điểm!`;
                            playAudio('solo_win');
                        }
                    } else {
                        // 2 người trở lên tranh giành -> chia đều điểm!
                        const splitPts = Number((chestMeta.points / count).toFixed(1));
                        group.forEach(p => p.totalScore += splitPts);
                        cntEl.textContent = `${count} người (Tranh giành)`;
                        ptsEl.textContent = `Mỗi người +${splitPts}đ`;
                        pillEl.classList.add('split');
                        slotEl.classList.add('glow-split');

                        if (group.some(p => p.id === _myPlayerId)) {
                            myRoundPoints = splitPts;
                            roundVerdictMsg = `⚔️ Tranh giành! ${count} người cùng chọn ${chestMeta.name}, bạn nhận chia đều +${splitPts}đ.`;
                            playAudio('split');
                        }
                    }
                });

                // Cập nhật lại thanh người chơi với lựa chọn đã lật mở
                renderPlayersStrip(true);

                // Cập nhật điểm của tôi
                const myPlayer = _players.find(p => p.id === _myPlayerId);
                if (myScoreEl && myPlayer) {
                    myScoreEl.textContent = Math.round(myPlayer.totalScore);
                }

                if (statusBanner) {
                    statusBanner.className = 'game8-status-banner revealed';
                    statusBanner.textContent = roundVerdictMsg || 'Đã chia điểm kho báu lượt này!';
                }

                // Lưu lại lịch sử lượt
                _roundScoresHistory.push({
                    round: _currentRound,
                    goldCount: chestSelectors.gold.length,
                    silverCount: chestSelectors.silver.length,
                    bronzeCount: chestSelectors.bronze.length,
                    myPoints: myRoundPoints
                });

                // Chuyển sang lượt tiếp theo sau 3.6 giây xem kết quả
                _nextRoundTimeout = setTimeout(() => {
                    if (_currentRound < _MAX_ROUNDS) {
                        startRound(_currentRound + 1);
                    } else {
                        finishGame();
                    }
                }, 3600);
            }

            // 9. Hiển thị token người chơi tại mỗi rương
            function renderChestAvatars(chestSelectors) {
                avatarsGold.innerHTML = '';
                avatarsSilver.innerHTML = '';
                avatarsBronze.innerHTML = '';

                Object.keys(chestSelectors).forEach(key => {
                    const containerBox = key === 'gold' ? avatarsGold : (key === 'silver' ? avatarsSilver : avatarsBronze);
                    const list = chestSelectors[key];
                    list.forEach(p => {
                        const token = document.createElement('div');
                        token.className = `chest-user-token ${p.id === _myPlayerId ? 'is-me' : ''}`;
                        token.style.borderColor = p.color;
                        token.title = p.name;
                        token.textContent = p.avatar;
                        containerBox.appendChild(token);
                    });
                });
            }

            // 10. Hoàn thành 5 lượt thi đấu
            function finishGame() {
                if (_isFinished) return;
                _isFinished = true;
                _isRunning = false;

                playAudio('victory');

                // Sắp xếp bảng xếp hạng người chơi theo tổng điểm giảm dần
                const ranking = [..._players].sort((a, b) => b.totalScore - a.totalScore);
                const myRank = ranking.findIndex(p => p.id === _myPlayerId) + 1;
                const myFinalScore = Math.round((_players.find(p => p.id === _myPlayerId)?.totalScore) || 0);

                if (finalRankingEl) {
                    finalRankingEl.innerHTML = '';
                    const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                    ranking.forEach((p, idx) => {
                        const row = document.createElement('div');
                        row.className = `final-rank-row ${p.id === _myPlayerId ? 'my-row' : ''}`;
                        row.innerHTML = `
                            <span class="rank-medal">${medals[idx] || `#${idx + 1}`}</span>
                            <span class="rank-avatar" style="border-color: ${p.color};">${p.avatar}</span>
                            <span class="rank-name">${p.name}${p.id === _myPlayerId ? ' (Bạn)' : ''}</span>
                            <span class="rank-score">${Math.round(p.totalScore)} điểm</span>
                        `;
                        finalRankingEl.appendChild(row);
                    });
                }

                let verdict = '';
                if (myRank === 1) {
                    verdict = '👑 XUẤT SẮC! BẠN LÀ VUA KHO BÁU TÂM LÝ BẬC THẦY!';
                } else if (myRank === 2) {
                    verdict = '🥈 Á QUÂN! Cân não tâm lý rất thông minh và bản lĩnh!';
                } else {
                    verdict = `🥉 HẠNG ${myRank}! Cần khéo léo né các rương bị tranh chấp hơn!`;
                }

                if (finalVerdictEl) finalVerdictEl.textContent = verdict;
                if (finalCard) finalCard.classList.add('visible');

                setTimeout(() => {
                    onComplete({
                        win: myRank === 1,
                        score: myFinalScore,
                        myTotalScore: myFinalScore,
                        ranking: ranking,
                        roundsPlayed: _MAX_ROUNDS,
                        ratingText: `Hạng ${myRank}/${_players.length} • ${myFinalScore}đ`,
                        message: `Chia Kho Báu: ${myFinalScore} điểm (Hạng ${myRank}/${_players.length})`
                    });
                }, 2200);
            }

            // 11. Gắn sự kiện click vào các nút chọn rương
            btnPickGold.addEventListener('click', () => setMyChoice('gold'), { signal: options.signal });
            btnPickSilver.addEventListener('click', () => setMyChoice('silver'), { signal: options.signal });
            btnPickBronze.addEventListener('click', () => setMyChoice('bronze'), { signal: options.signal });

            // Cho phép click trực tiếp vào rương
            slotGold.addEventListener('click', () => setMyChoice('gold'), { signal: options.signal });
            slotSilver.addEventListener('click', () => setMyChoice('silver'), { signal: options.signal });
            slotBronze.addEventListener('click', () => setMyChoice('bronze'), { signal: options.signal });

            // 12. Gắn phím tắt (1/2/3 hoặc A/S/D)
            _keyHandler = (e) => {
                if (_isFinished) return;
                if (e.code === 'Digit1' || e.code === 'Numpad1' || e.code === 'KeyA') {
                    setMyChoice('gold');
                } else if (e.code === 'Digit2' || e.code === 'Numpad2' || e.code === 'KeyS') {
                    setMyChoice('silver');
                } else if (e.code === 'Digit3' || e.code === 'Numpad3' || e.code === 'KeyD') {
                    setMyChoice('bronze');
                }
            };
            window.addEventListener('keydown', _keyHandler, { signal: options.signal });

            // 13. Khởi động Lượt 1
            startRound(1);
        },

        destroy() {
            _isFinished = true;
            _isRunning = false;
            if (_turnTimer) {
                clearInterval(_turnTimer);
                _turnTimer = null;
            }
            if (_nextRoundTimeout) {
                clearTimeout(_nextRoundTimeout);
                _nextRoundTimeout = null;
            }
            if (_keyHandler) {
                window.removeEventListener('keydown', _keyHandler);
                _keyHandler = null;
            }
        }
    };

    // Đăng ký với MinigameManager
    if (typeof window !== 'undefined' && window.MinigameManager) {
        window.MinigameManager.register('game-8', Game8);
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Game8;
    } else if (typeof window !== 'undefined') {
        window.Game8 = Game8;
    }
})();


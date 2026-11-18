/**
 * MINI-GAME 5: SĂN ẢNH VOỌC CHÀ VÁ (PHOTO HUNT)
 * - Cách chơi: Trong 15 giây, các chú Voọc chà vá liên tục thò đầu ra từ các bụi cây ngẫu nhiên
 *   trên màn hình rồi biến mất sau 0.8 giây (xen lẫn vài chú khỉ tinh nghịch).
 * - Tính điểm: Chụp trúng Voọc được +20 điểm, chụp nhầm khỉ bị -15 điểm.
 * - Công bằng 100%: Số lượng Voọc chà vá (15 chú) và Khỉ tinh nghịch (5 chú) của tất cả người chơi
 *   đều hoàn toàn như nhau theo lịch trình chuẩn.
 */

(function () {
    let _gameInterval = null;
    let _spawnTimeouts = [];
    let _retractTimeouts = [];
    let _isFinished = false;
    let _isRunning = false;

    let _score = 0;
    let _voocHits = 0;
    let _khiHits = 0;
    let _timeLeft = 15;

    // Tổng số lượng đảm bảo giống hệt nhau cho mọi người chơi
    const _TOTAL_VOOC = 15;
    const _TOTAL_KHI = 5;
    const _POP_DURATION_MS = 800; // Xuất hiện đúng 0.8 giây rồi thụt xuống

    // Lịch trình xuất hiện cố định (20 lượt xuất hiện trong 15s)
    // Phân bổ 15 Voọc (+20đ) và 5 Khỉ (-15đ) xen kẽ tự nhiên vào 6 bụi cây (0 -> 5)
    const _SPAWN_TIMELINE = [
        { timeSec: 0.6, type: 'vooc', bush: 1 },
        { timeSec: 1.3, type: 'vooc', bush: 4 },
        { timeSec: 2.0, type: 'khi',  bush: 2 }, // Khỉ 1
        { timeSec: 2.7, type: 'vooc', bush: 0 },
        { timeSec: 3.4, type: 'vooc', bush: 5 },
        { timeSec: 4.1, type: 'khi',  bush: 3 }, // Khỉ 2
        { timeSec: 4.8, type: 'vooc', bush: 1 },
        { timeSec: 5.5, type: 'vooc', bush: 4 },
        { timeSec: 6.2, type: 'vooc', bush: 2 },
        { timeSec: 6.9, type: 'khi',  bush: 0 }, // Khỉ 3
        { timeSec: 7.6, type: 'vooc', bush: 5 },
        { timeSec: 8.3, type: 'vooc', bush: 3 },
        { timeSec: 9.0, type: 'vooc', bush: 1 },
        { timeSec: 9.7, type: 'khi',  bush: 4 }, // Khỉ 4
        { timeSec: 10.4, type: 'vooc', bush: 2 },
        { timeSec: 11.1, type: 'vooc', bush: 0 },
        { timeSec: 11.8, type: 'vooc', bush: 5 },
        { timeSec: 12.5, type: 'khi',  bush: 1 }, // Khỉ 5
        { timeSec: 13.2, type: 'vooc', bush: 3 },
        { timeSec: 13.9, type: 'vooc', bush: 4 }
    ];

    // SVG Đồ Họa Voọc Chà Vá Chân Nâu (Nữ hoàng linh trưởng Sơn Trà)
    const VOOC_SVG = `
        <svg class="game5-avatar-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <!-- Thân & Cổ -->
            <path d="M 28 85 Q 50 72 72 85 L 80 100 L 20 100 Z" fill="#334155" />
            <!-- Vòng lông cổ trắng đặc trưng -->
            <path d="M 32 78 Q 50 92 68 78 Q 50 68 32 78 Z" fill="#f8fafc" />
            <!-- Đầu -->
            <ellipse cx="50" cy="46" rx="30" ry="28" fill="#1e293b" />
            <!-- Hai má lông vàng cam rực rỡ đặc trưng của Voọc chà vá -->
            <ellipse cx="32" cy="52" rx="14" ry="16" fill="#f97316" />
            <ellipse cx="68" cy="52" rx="14" ry="16" fill="#f97316" />
            <!-- Chòm râu cằm trắng tinh khôi -->
            <path d="M 40 68 Q 50 82 60 68 Q 50 64 40 68 Z" fill="#f8fafc" />
            <!-- Khuôn mặt xám sáng -->
            <ellipse cx="50" cy="48" rx="19" ry="18" fill="#fdba74" />
            <!-- Đôi mắt to tròn thông minh -->
            <ellipse cx="43" cy="44" rx="4.5" ry="5.5" fill="#0f172a" />
            <ellipse cx="57" cy="44" rx="4.5" ry="5.5" fill="#0f172a" />
            <circle cx="44.5" cy="42.5" r="1.8" fill="#ffffff" />
            <circle cx="58.5" cy="42.5" r="1.8" fill="#ffffff" />
            <!-- Mũi nhỏ -->
            <ellipse cx="50" cy="51" rx="2.5" ry="1.8" fill="#9a3412" />
            <!-- Miệng mỉm cười hiền lành -->
            <path d="M 46 56 Q 50 59 54 56" stroke="#9a3412" stroke-width="1.8" fill="none" stroke-linecap="round" />
            <!-- Vầng trán đen quý tộc -->
            <path d="M 32 30 Q 50 20 68 30 Q 50 36 32 30 Z" fill="#0f172a" />
        </svg>
    `;

    // SVG Đồ Họa Chú Khỉ Tinh Nghịch (Macaque)
    const KHI_SVG = `
        <svg class="game5-avatar-svg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <!-- Thân nâu -->
            <path d="M 30 85 Q 50 75 70 85 L 78 100 L 22 100 Z" fill="#78350f" />
            <!-- Tai to vểnh hai bên -->
            <circle cx="22" cy="46" r="13" fill="#92400e" />
            <circle cx="22" cy="46" r="8" fill="#fbcfe8" />
            <circle cx="78" cy="46" r="13" fill="#92400e" />
            <circle cx="78" cy="46" r="8" fill="#fbcfe8" />
            <!-- Đầu tròn nâu -->
            <circle cx="50" cy="48" r="28" fill="#92400e" />
            <!-- Khuôn mặt hồng nhạt tinh nghịch -->
            <ellipse cx="50" cy="52" rx="20" ry="19" fill="#fbcfe8" />
            <!-- Mắt tròn láu lỉnh liếc sang bên -->
            <circle cx="42" cy="46" r="5" fill="#ffffff" />
            <circle cx="58" cy="46" r="5" fill="#ffffff" />
            <circle cx="44" cy="46" r="3" fill="#1e293b" />
            <circle cx="60" cy="46" r="3" fill="#1e293b" />
            <!-- Mũi hếch -->
            <circle cx="48" cy="53" r="1.5" fill="#831843" />
            <circle cx="52" cy="53" r="1.5" fill="#831843" />
            <!-- Miệng cười le lưỡi trêu chọc -->
            <path d="M 43 59 Q 50 66 57 59" stroke="#831843" stroke-width="2" fill="none" stroke-linecap="round" />
            <path d="M 48 61 Q 50 68 53 61 Z" fill="#f43f5e" />
            <!-- Chỏm lông trên đỉnh đầu -->
            <path d="M 45 22 Q 50 14 55 22 Q 50 18 45 22 Z" fill="#78350f" />
        </svg>
    `;

    // SVG Đồ Họa Bụi Cây Rừng Núi Sơn Trà
    const BUSH_SVG = `
        <svg class="game5-bush-svg" viewBox="0 0 160 60" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
            <!-- Tán lá sau -->
            <path d="M 10 60 Q 20 20 50 25 Q 80 10 110 25 Q 140 18 150 60 Z" fill="#047857" />
            <!-- Tán lá trước -->
            <path d="M 0 60 Q 30 18 65 30 Q 95 15 130 32 Q 160 22 160 60 Z" fill="#10b981" />
            <!-- Điểm xuyết hoa rừng vàng -->
            <circle cx="45" cy="38" r="3" fill="#fbbf24" />
            <circle cx="115" cy="40" r="3" fill="#fbbf24" />
        </svg>
    `;

    // Âm thanh Web Audio API không độ trễ
    function playAudio(type) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!window._game5AudioCtx) {
                window._game5AudioCtx = new AudioCtx();
            }
            const actx = window._game5AudioCtx;
            if (actx.state === 'suspended') actx.resume();

            const now = actx.currentTime;

            if (type === 'shutter') {
                // Tiếng màn trập máy ảnh "Tách - Xoẹt" chân thực
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'vooc_hit') {
                // Chụp trúng Voọc: Tiếng chuông vàng leng keng +20đ
                const freqs = [659.25, 880, 1046.50];
                freqs.forEach((f, idx) => {
                    const osc = actx.createOscillator();
                    const gain = actx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(f, now + idx * 0.06);
                    gain.gain.setValueAtTime(0.12, now + idx * 0.06);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
                    osc.connect(gain);
                    gain.connect(actx.destination);
                    osc.start(now + idx * 0.06);
                    osc.stop(now + idx * 0.06 + 0.25);
                });
            } else if (type === 'khi_hit') {
                // Chụp nhầm Khỉ: Tiếng còi buzzer cảnh báo -15đ
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.setValueAtTime(170, now + 0.1);
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.28);
            } else if (type === 'tick') {
                // Đếm ngược giây
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(520, now);
                gain.gain.setValueAtTime(0.02, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.025);
            }
        } catch (_) {}
    }

    const Game5 = {
        id: 'game-5',
        title: 'SĂN ẢNH VOỌC CHÀ VÁ',
        description: 'Chụp trúng <strong>Voọc chà vá (+20đ)</strong> thò ra từ bụi cây trong 0.8s! Cẩn thận tránh chụp nhầm <strong>Khỉ tinh nghịch (-15đ)</strong>!',

        init(container, onComplete, options = {}) {
            _isFinished = false;
            _isRunning = false;
            _score = 0;
            _voocHits = 0;
            _khiHits = 0;
            _timeLeft = 15;
            _spawnTimeouts = [];
            _retractTimeouts = [];

            // 1. Tạo giao diện Mini-game 6 Bụi Cây
            container.innerHTML = `
                <div class="game5-wrapper">
                    <!-- Header HUD: Thời Gian & Điểm Số Tức Thời -->
                    <div class="game5-header-bar">
                        <div class="game5-hud-pill game5-timer-pill">
                            <span>⏱️ THỜI GIAN:</span>
                            <span class="game5-timer-val" id="game5Timer">15s</span>
                        </div>
                        <div class="game5-hud-pill game5-score-pill">
                            <span>🎯 ĐIỂM SỐ:</span>
                            <span class="game5-score-val" id="game5Score">0</span>
                        </div>
                    </div>

                    <!-- Thanh Hướng Dẫn Mục Tiêu & Cạm Bẫy -->
                    <div class="game5-guide-bar">
                        <div class="game5-guide-target">
                            <span>📸 Voọc Chà Vá:</span>
                            <strong>+20đ</strong>
                        </div>
                        <div class="game5-guide-trap">
                            <span>⚠️ Khỉ Tinh Nghịch:</span>
                            <strong>-15đ</strong>
                        </div>
                    </div>

                    <!-- Sân Khấu Rừng Sơn Trà (6 Bụi Cây) -->
                    <div class="game5-stage" id="game5Stage">
                        <div class="game5-viewfinder-overlay"></div>
                        <div class="game5-shutter-flash" id="game5Flash"></div>

                        <!-- 6 Ô Bụi Cây -->
                        ${Array.from({ length: 6 }).map((_, i) => `
                            <div class="game5-bush-hole" data-bush="${i}">
                                <div class="game5-creature" id="game5Creature_${i}">
                                    <!-- Dynamic creature SVG inserted here -->
                                </div>
                                <div class="game5-bush-front">
                                    ${BUSH_SVG}
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <!-- Thống Kê Số Lượng Đã Săn Trúng -->
                    <div class="game5-stats-bar">
                        <div class="game5-stat-item" style="color:#4ade80;">
                            <span>Voọc chụp được:</span>
                            <strong id="game5VoocCount">0 / ${_TOTAL_VOOC}</strong>
                        </div>
                        <div class="game5-stat-item" style="color:#f87171;">
                            <span>Khỉ chụp nhầm:</span>
                            <strong id="game5KhiCount">0 / ${_TOTAL_KHI}</strong>
                        </div>
                    </div>
                </div>
            `;

            // 2. Tham chiếu DOM
            const stage = container.querySelector('#game5Stage');
            const timerEl = container.querySelector('#game5Timer');
            const scoreEl = container.querySelector('#game5Score');
            const voocCountEl = container.querySelector('#game5VoocCount');
            const khiCountEl = container.querySelector('#game5KhiCount');
            const flashEl = container.querySelector('#game5Flash');

            // 3. Hiệu ứng lóe sáng máy ảnh (Shutter Flash)
            function triggerCameraFlash() {
                playAudio('shutter');
                if (flashEl) {
                    flashEl.classList.add('flashing');
                    setTimeout(() => {
                        flashEl.classList.remove('flashing');
                    }, 65);
                }
            }

            // 4. Hiệu ứng chữ số bay lên (+20 hoặc -15)
            function showScorePopup(x, y, text, isPlus) {
                const popup = document.createElement('div');
                popup.className = `game5-float-popup ${isPlus ? 'plus' : 'minus'}`;
                popup.textContent = text;
                popup.style.left = `${x}px`;
                popup.style.top = `${y}px`;
                stage.appendChild(popup);

                setTimeout(() => {
                    if (popup.parentNode) popup.parentNode.removeChild(popup);
                }, 650);
            }

            // 5. Xử lý khi người chơi bấm trúng một con vật
            function onCreatureClick(bushIndex, e) {
                if (!_isRunning || _isFinished) return;

                const creatureEl = container.querySelector(`#game5Creature_${bushIndex}`);
                if (!creatureEl || !creatureEl.classList.contains('active')) return;

                const type = creatureEl.getAttribute('data-type');
                // Ngay lập tức vô hiệu hóa để không bị bấm 2 lần
                creatureEl.classList.remove('active');
                creatureEl.classList.add('snapped');

                triggerCameraFlash();

                // Lấy tọa độ click để hiển thị popup
                const stageRect = stage.getBoundingClientRect();
                let clickX = stageRect.width / 2 - 20;
                let clickY = stageRect.height / 2 - 20;
                if (e && e.clientX) {
                    clickX = Math.max(15, Math.min(stageRect.width - 60, e.clientX - stageRect.left - 20));
                    clickY = Math.max(15, Math.min(stageRect.height - 40, e.clientY - stageRect.top - 20));
                }

                if (type === 'vooc') {
                    // Chụp đúng Voọc chà vá!
                    _score += 20;
                    _voocHits++;
                    playAudio('vooc_hit');
                    showScorePopup(clickX, clickY, '+20', true);
                } else if (type === 'khi') {
                    // Chụp nhầm chú khỉ tinh nghịch!
                    _score = Math.max(0, _score - 15); // Điểm không âm
                    _khiHits++;
                    playAudio('khi_hit');
                    showScorePopup(clickX, clickY, '-15', false);
                }

                // Cập nhật giao diện điểm
                if (scoreEl) scoreEl.textContent = _score;
                if (voocCountEl) voocCountEl.textContent = `${_voocHits} / ${_TOTAL_VOOC}`;
                if (khiCountEl) khiCountEl.textContent = `${_khiHits} / ${_TOTAL_KHI}`;
            }

            // 6. Gắn sự kiện click / touch trên 6 bụi cây
            for (let i = 0; i < 6; i++) {
                const creatureEl = container.querySelector(`#game5Creature_${i}`);
                if (creatureEl) {
                    creatureEl.addEventListener('pointerdown', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onCreatureClick(i, e);
                    }, { signal: options.signal });
                }
            }

            // 7. Hàm kích hoạt một chú vật nhô lên từ bụi cây
            function spawnCreature(bushIndex, type) {
                if (!_isRunning || _isFinished) return;

                const creatureEl = container.querySelector(`#game5Creature_${bushIndex}`);
                if (!creatureEl) return;

                // Thiết lập avatar SVG tương ứng
                creatureEl.innerHTML = type === 'vooc' ? VOOC_SVG : KHI_SVG;
                creatureEl.setAttribute('data-type', type);
                creatureEl.className = 'game5-creature active';

                // Tự động lặn xuống sau đúng 0.8 giây nếu không bị chụp
                const retractTimeout = setTimeout(() => {
                    if (creatureEl.classList.contains('active')) {
                        creatureEl.classList.remove('active');
                        creatureEl.classList.add('retracting');
                        setTimeout(() => {
                            creatureEl.classList.remove('retracting');
                        }, 160);
                    }
                }, _POP_DURATION_MS);

                _retractTimeouts.push(retractTimeout);
            }

            // 8. Bắt đầu phiên chơi và lên lịch xuất hiện 20 lượt chuẩn
            _isRunning = true;
            _timeLeft = 15;

            // Khởi động đồng hồ đếm ngược 15 giây
            _gameInterval = setInterval(() => {
                _timeLeft--;
                if (timerEl) timerEl.textContent = `${_timeLeft}s`;
                if (_timeLeft <= 3 && _timeLeft > 0) {
                    playAudio('tick');
                }

                if (_timeLeft <= 0) {
                    clearInterval(_gameInterval);
                    _gameInterval = null;
                    finishGame();
                }
            }, 1000);

            // Đặt lịch xuất hiện theo mảng _SPAWN_TIMELINE
            _SPAWN_TIMELINE.forEach((item) => {
                const timeoutId = setTimeout(() => {
                    spawnCreature(item.bush, item.type);
                }, item.timeSec * 1000);
                _spawnTimeouts.push(timeoutId);
            });

            // 9. Kết thúc mini-game
            function finishGame() {
                if (_isFinished) return;
                _isFinished = true;
                _isRunning = false;

                // Dọn dẹp các timeout đang chờ
                _spawnTimeouts.forEach(clearTimeout);
                _retractTimeouts.forEach(clearTimeout);

                const finalScore = _score;
                const win = finalScore >= 140;

                setTimeout(() => {
                    onComplete({
                        win: win,
                        score: finalScore,
                        totalScore: finalScore,
                        voocHits: _voocHits,
                        khiHits: _khiHits,
                        totalVooc: _TOTAL_VOOC,
                        totalKhi: _TOTAL_KHI,
                        message: `Săn Ảnh Voọc Chà Vá: ${finalScore} điểm (📸 ${_voocHits}/${_TOTAL_VOOC} Voọc • ⚠️ ${_khiHits}/${_TOTAL_KHI} Khỉ)`
                    });
                }, 750);
            }
        },

        destroy() {
            _isFinished = true;
            _isRunning = false;
            if (_gameInterval) {
                clearInterval(_gameInterval);
                _gameInterval = null;
            }
            _spawnTimeouts.forEach(clearTimeout);
            _spawnTimeouts = [];
            _retractTimeouts.forEach(clearTimeout);
            _retractTimeouts = [];
        }
    };

    // Đăng ký với MinigameManager nếu có
    if (typeof window !== 'undefined' && window.MinigameManager) {
        window.MinigameManager.register('game-5', Game5);
    }

    // Export module
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Game5;
    } else if (typeof window !== 'undefined') {
        window.Game5 = Game5;
    }
})();


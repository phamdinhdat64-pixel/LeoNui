/**
 * MINI-GAME 1: ĐUA SỨC BỀN (STAMINA RACE)
 * - Cách chơi: Trong 8 giây, liên tục bấm vào nút tròn xuất hiện trên màn hình để nạp thanh thể lực.
 * - Tính điểm: Ai bấm được nhiều nhất sẽ giành giải nhất, nhì, ba...
 *   Nếu 2 người có cùng lần bấm thì người bấm nút sớm nhất (phản xạ đầu tiên) sẽ hạng cao hơn.
 */

(function () {
    let _timerInterval = null;
    let _keyHandler = null;
    let _isFinished = false;
    let _startTime = 0;
    let _taps = 0;
    let _firstTapTime = null;
    let _lastTapTime = null;

    // Hiệu ứng âm thanh click nhẹ bằng Web Audio API không có độ trễ
    function playTapBlip(tapIndex) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!window._staminaAudioCtx) {
                window._staminaAudioCtx = new AudioCtx();
            }
            const actx = window._staminaAudioCtx;
            if (actx.state === 'suspended') {
                actx.resume();
            }
            const osc = actx.createOscillator();
            const gain = actx.createGain();
            const freq = Math.min(1100, 340 + tapIndex * 14);
            osc.frequency.setValueAtTime(freq, actx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.4, actx.currentTime + 0.045);
            gain.gain.setValueAtTime(0.09, actx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.045);
            osc.connect(gain);
            gain.connect(actx.destination);
            osc.start();
            osc.stop(actx.currentTime + 0.045);
        } catch (_) {}
    }

    const Game1 = {
        id: 'game-1',
        title: 'ĐUA SỨC BỀN',
        description: 'Trong <strong>8 giây</strong>, liên tục bấm vào <strong>nút tròn</strong> trên màn hình để nạp đầy thanh thể lực!',

        init(container, onComplete, options = {}) {
            _isFinished = false;
            _taps = 0;
            _firstTapTime = null;
            _lastTapTime = null;

            // 1. Tạo cấu trúc giao diện Mini-game Đua Sức Bền
            container.innerHTML = `
                <div class="game1-stamina-wrapper">
                    <!-- Top Status Row: Timer & Tap Counter -->
                    <div class="game1-stats-header">
                        <div class="game1-stat-pill timer-pill" id="game1TimerPill">
                            <span class="pill-icon">⏱️</span>
                            <span class="pill-value" id="game1Timer">8.0s</span>
                        </div>
                        <div class="game1-stat-pill reflex-pill" id="game1ReflexPill" title="Thời gian từ khi bắt đầu đến lần bấm đầu tiên">
                            <span class="pill-icon">⚡</span>
                            <span class="pill-label">Phản xạ:</span>
                            <span class="pill-value" id="game1Reflex">--</span>
                        </div>
                        <div class="game1-stat-pill taps-pill">
                            <span class="pill-icon">🔥</span>
                            <span class="pill-value" id="game1TapCounter">0</span>
                            <span class="pill-label">lần</span>
                        </div>
                    </div>

                    <!-- Thanh Thể Lực (Stamina Bar) -->
                    <div class="game1-stamina-section">
                        <div class="game1-stamina-label-row">
                            <span class="stamina-label">🔋 THANH THỂ LỰC</span>
                            <span class="stamina-percent" id="game1StaminaPercent">0%</span>
                        </div>
                        <div class="game1-stamina-track">
                            <div class="game1-stamina-fill" id="game1StaminaFill" style="width: 0%;">
                                <div class="stamina-glow-head"></div>
                            </div>
                        </div>
                        <div class="game1-milestone-hints">
                            <span>Khởi động</span>
                            <span>Tăng tốc</span>
                            <span>Đạt đỉnh 100% 👑</span>
                        </div>
                    </div>

                    <!-- Nút Tròn Bấm Liên Tục (Circular Mash Button) -->
                    <div class="game1-circle-area">
                        <div class="circle-pulse-ring ring-1"></div>
                        <div class="circle-pulse-ring ring-2"></div>
                        <button type="button" class="game1-circle-btn" id="game1CircleBtn" aria-label="Bấm liên tục nạp thể lực">
                            <div class="circle-btn-inner">
                                <span class="circle-btn-icon" id="game1BtnIcon">⚡</span>
                                <span class="circle-btn-text">BẤM LIÊN TỤC!</span>
                                <span class="circle-btn-sub">CHẠM ĐỂ NẠP</span>
                            </div>
                        </button>
                        <div class="game1-floating-container" id="game1FloatContainer"></div>
                    </div>

                    <!-- Status Message & Helper Tip -->
                    <div class="game1-helper-footer">
                        <span id="game1StatusMsg" class="status-msg">🔥 Hãy bấm nút tròn thật nhanh và liên tục!</span>
                        <p class="game1-device-tip">(Có thể dùng 2 ngón tay chạm liên tục trên điện thoại hoặc nhấn phím Space)</p>
                    </div>
                </div>
            `;

            const timerDisplay = container.querySelector('#game1Timer');
            const timerPill = container.querySelector('#game1TimerPill');
            const reflexDisplay = container.querySelector('#game1Reflex');
            const tapCounter = container.querySelector('#game1TapCounter');
            const staminaPercent = container.querySelector('#game1StaminaPercent');
            const staminaFill = container.querySelector('#game1StaminaFill');
            const circleBtn = container.querySelector('#game1CircleBtn');
            const btnIcon = container.querySelector('#game1BtnIcon');
            const statusMsg = container.querySelector('#game1StatusMsg');
            const floatContainer = container.querySelector('#game1FloatContainer');

            _startTime = performance.now();
            let timeLeft = 8.0;

            // 2. Spawn floating "+1" animation inside button area
            function spawnFloatText() {
                if (!floatContainer) return;
                const el = document.createElement('span');
                el.className = 'game1-float-num';
                el.textContent = '+1';
                // Random nhẹ vị trí x lệch quanh tâm
                const offset = (Math.random() - 0.5) * 60;
                el.style.left = `calc(50% + ${offset}px)`;
                floatContainer.appendChild(el);
                setTimeout(() => {
                    if (el.parentNode) el.parentNode.removeChild(el);
                }, 550);
            }

            // 3. Xử lý mỗi lần bấm nút tròn (Mashing action)
            function handleTap() {
                if (_isFinished) return;
                const now = performance.now();

                // Ghi nhận thời điểm bấm đầu tiên (First Tap Time) cho trường hợp hòa lần bấm
                if (_firstTapTime === null) {
                    _firstTapTime = Math.max(1, Math.round(now - _startTime));
                    if (reflexDisplay) {
                        reflexDisplay.textContent = `${(_firstTapTime / 1000).toFixed(2)}s`;
                    }
                }
                _lastTapTime = Math.max(1, Math.round(now - _startTime));

                _taps++;
                if (tapCounter) tapCounter.textContent = _taps;

                // Nạp thanh thể lực (Mục tiêu 40 lần bấm = 100% thể lực, vượt 40 = bội thể lực)
                const percent = Math.round((_taps / 40) * 100);
                if (staminaPercent) staminaPercent.textContent = `${percent}%`;
                if (staminaFill) staminaFill.style.width = `${Math.min(100, percent)}%`;

                // Cập nhật trạng thái động theo số lần bấm
                if (_taps < 15) {
                    if (btnIcon) btnIcon.textContent = '⚡';
                    if (statusMsg) statusMsg.textContent = '⚡ Khởi động tốt! Hãy tăng tốc hơn!';
                } else if (_taps < 30) {
                    if (btnIcon) btnIcon.textContent = '🔥';
                    if (statusMsg) statusMsg.textContent = '🔥 Đang nạp nhanh! Cố lên nào!';
                } else if (_taps < 45) {
                    if (btnIcon) btnIcon.textContent = '🚀';
                    if (statusMsg) statusMsg.textContent = '🚀 Thể lực dâng trào! Sắp đạt đỉnh!';
                } else {
                    if (btnIcon) btnIcon.textContent = '👑';
                    if (statusMsg) statusMsg.textContent = '👑 SIÊU SỨC BỀN! VƯỢT MỌI GIỚI HẠN!';
                }

                // Hiệu ứng bấm nút
                if (circleBtn) {
                    circleBtn.classList.remove('tapping');
                    void circleBtn.offsetWidth; // Force reflow
                    circleBtn.classList.add('tapping');
                }

                // Hiệu ứng chữ nổi bay lên
                spawnFloatText();

                // Rung nhẹ điện thoại nếu hỗ trợ
                if (navigator.vibrate) {
                    try { navigator.vibrate(12); } catch (_) {}
                }

                // Âm thanh blip
                playTapBlip(_taps);
            }

            // 4. Kết thúc 8 giây và tính điểm xếp hạng
            function finishMinigame() {
                if (_isFinished) return;
                _isFinished = true;

                if (_timerInterval) {
                    clearInterval(_timerInterval);
                    _timerInterval = null;
                }

                if (circleBtn) {
                    circleBtn.disabled = true;
                    circleBtn.classList.add('disabled');
                }

                if (statusMsg) {
                    statusMsg.textContent = '⏱️ HẾT GIỜ! ĐANG TỔNG HỢP KẾT QUẢ...';
                }

                // CÔNG THỨC TÍNH ĐIỂM CHUẨN XẾP HẠNG:
                // 1. Điểm số lần bấm: chỉ nhân 10 (taps * 10)
                // 2. Điểm phản xạ: tối đa 50 điểm dựa trên thời điểm bấm nút đầu tiên (firstTapTime)
                //    Trong 8000ms: reflexScore = Math.round((8000 - firstTapMs) * 50 / 8000) (0 -> 50 điểm)
                // 3. Tổng điểm: score = (taps * 10) + reflexScore
                const firstTapMs = _firstTapTime !== null ? _firstTapTime : 8000;
                const reflexScore = _firstTapTime !== null
                    ? Math.max(0, Math.min(50, Math.round((8000 - firstTapMs) * 50 / 8000)))
                    : 0;

                const tapScore = _taps * 10;
                const score = tapScore + reflexScore;

                let bonusSteps = 0;
                if (_taps >= 35) bonusSteps = 3;
                else if (_taps >= 20) bonusSteps = 2;
                else if (_taps >= 10) bonusSteps = 1;

                const win = _taps >= 15;
                const firstTapSec = (_firstTapTime !== null ? (_firstTapTime / 1000).toFixed(2) : '--');

                setTimeout(() => {
                    onComplete({
                        win: win,
                        score: score,
                        taps: _taps,
                        tapScore: tapScore,
                        reflexScore: reflexScore,
                        firstTapTime: firstTapMs,
                        firstTapSec: firstTapSec,
                        bonusSteps: bonusSteps,
                        message: `${_taps} lần bấm (+${tapScore}đ) • Phản xạ: ${firstTapSec}s (+${reflexScore}đ) ➔ Tổng: ${score} điểm`
                    });
                }, 700);
            }

            // 5. Đếm ngược 8.0 giây
            _timerInterval = setInterval(() => {
                if (_isFinished) return;
                timeLeft -= 0.1;
                if (timeLeft <= 0) {
                    timeLeft = 0;
                    if (timerDisplay) timerDisplay.textContent = '0.0s';
                    finishMinigame();
                    return;
                }

                if (timerDisplay) {
                    timerDisplay.textContent = `${timeLeft.toFixed(1)}s`;
                }

                // Khi còn dưới 3 giây thì nhấp nháy đỏ báo động
                if (timeLeft <= 3.0 && timerPill) {
                    timerPill.classList.add('urgent');
                }
            }, 100);

            // 6. Gắn sự kiện Pointer/Touch trên nút tròn (chạm đa điểm nhanh không trễ)
            if (circleBtn) {
                circleBtn.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    handleTap();
                }, { signal: options.signal });
            }

            // 7. Gắn sự kiện phím Space
            _keyHandler = (e) => {
                if (e.code === 'Space' && !_isFinished) {
                    e.preventDefault();
                    handleTap();
                }
            };
            window.addEventListener('keydown', _keyHandler, { signal: options.signal });
        },

        destroy() {
            _isFinished = true;
            if (_timerInterval) {
                clearInterval(_timerInterval);
                _timerInterval = null;
            }
            if (_keyHandler) {
                window.removeEventListener('keydown', _keyHandler);
                _keyHandler = null;
            }
        }
    };

    // Tự động đăng ký với MinigameManager nếu đã nạp
    if (typeof window !== 'undefined' && window.MinigameManager) {
        window.MinigameManager.register('game-1', Game1);
    }

    // Export module
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Game1;
    } else if (typeof window !== 'undefined') {
        window.Game1 = Game1;
    }
})();

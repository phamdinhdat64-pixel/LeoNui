/**
 * MINI-GAME 3: CĂN LỰC GIÓ (WIND FORCE CALIBRATION)
 * - Cách chơi: Một thanh dài có vạch đỏ (kim chỉ) chạy qua lại liên tục với tốc độ cao.
 *   Ở chính giữa là tâm điểm 100 điểm (màu xanh lá chiều dài hợp lý), càng xa tâm điểm
 *   điểm càng giảm dần về 0.
 *   Từng người chơi có đúng 3 lần bấm để dừng kim chỉ.
 *   Lượt tiếp theo kim đỏ sẽ chạy nhanh hơn một tí, đủ để người chơi vẫn có thể giành được 100 điểm!
 */

(function () {
    let _animFrameId = null;
    let _pauseTimeout = null;
    let _keyHandler = null;
    let _isFinished = false;

    // Trạng thái mini-game
    let _currentAttempt = 0; // 0, 1, 2
    const _TOTAL_ATTEMPTS = 3;
    let _isNeedleRunning = false;
    let _currentPos = 50; // 0% -> 100%
    let _direction = 1; // 1: sang phải, -1: sang trái
    let _lastTimestamp = 0;
    let _results = []; // Lưu kết quả 3 lần bấm [{ attempt: 1, pos: 50.2, score: 100 }]

    // Tốc độ di chuyển theo từng lượt (% / giây) - Tăng tốc độ nhanh và khó hơn theo yêu cầu:
    // Lượt 1: 115%/s (~0.85s qua lại)
    // Lượt 2: 150%/s (~0.65s qua lại)
    // Lượt 3: 190%/s (~0.52s qua lại - tốc độ cao đòi hỏi phản xạ cực nhạy)
    const _SPEED_LEVELS = [115, 150, 190];
    const _SPEED_LABELS = [
        'Cấp 1: Gió mạnh 💨',
        'Cấp 2: Gió lốc 🌪️',
        'Cấp 3: Bão cuồng phong ⚡'
    ];
    const _PERFECT_RADIUS = 3.5; // Thu nhỏ vùng tâm xanh lá từ 6.0% xuống 3.5% (tổng độ rộng 7%)

    // Âm thanh Web Audio API không độ trễ
    function playAudio(type, score = 0) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!window._game3AudioCtx) {
                window._game3AudioCtx = new AudioCtx();
            }
            const actx = window._game3AudioCtx;
            if (actx.state === 'suspended') actx.resume();

            const osc = actx.createOscillator();
            const gain = actx.createGain();
            const now = actx.currentTime;

            if (type === 'tick') {
                // Tiếng kim quét nhẹ
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(450, now);
                gain.gain.setValueAtTime(0.015, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.02);
            } else if (type === 'hit_perfect') {
                // Trúng 100 điểm - tiếng chuông vàng chiến thắng vang rền
                osc.type = 'sine';
                osc.frequency.setValueAtTime(523.25, now); // C5
                osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
                osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
                osc.frequency.setValueAtTime(1046.50, now + 0.24); // C6
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.45);
            } else if (type === 'hit_good') {
                // Trúng khá (60 - 99đ)
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.setValueAtTime(660, now + 0.1);
                gain.gain.setValueAtTime(0.14, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.3);
            } else {
                // Điểm thấp (< 60đ)
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(260, now);
                osc.frequency.exponentialRampToValueAtTime(180, now + 0.15);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.2);
            }
        } catch (_) {}
    }

    const Game3 = {
        id: 'game-3',
        title: 'CĂN LỰC GIÓ',
        description: 'Bấm dừng <strong>kim đỏ</strong> đúng vào <strong>tâm xanh lá (100 điểm)</strong>! Bạn có 3 lần bấm, lượt sau gió thổi nhanh hơn!',

        init(container, onComplete, options = {}) {
            _isFinished = false;
            _currentAttempt = 0;
            _isNeedleRunning = false;
            _currentPos = 10;
            _direction = 1;
            _results = [];

            // 1. Tạo cấu trúc giao diện Mini-game Căn Lực Gió
            container.innerHTML = `
                <div class="game3-wrapper">
                    <!-- Top Info Bar: Attempt & Current Wind Speed -->
                    <div class="game3-header-bar">
                        <div class="game3-attempt-pill" id="game3AttemptPill">
                            <span class="pill-label">LƯỢT BẤM:</span>
                            <span class="pill-value" id="game3AttemptVal">1 / 3</span>
                        </div>
                        <div class="game3-wind-pill" id="game3WindPill">
                            <span class="pill-label">LỰC GIÓ:</span>
                            <span class="pill-value" id="game3WindVal">Cấp 1: Gió nhẹ 🍃</span>
                        </div>
                        <div class="game3-score-pill">
                            <span class="pill-label">TỔNG ĐIỂM:</span>
                            <span class="pill-value" id="game3TotalScore">0</span>
                            <span class="pill-max">/300</span>
                        </div>
                    </div>

                    <!-- 3 Attempts Tracker Badges -->
                    <div class="game3-tracker" id="game3Tracker">
                        <div class="attempt-card active" id="attemptCard_0">
                            <span class="card-title">Lượt 1 (Gió nhẹ)</span>
                            <span class="card-res" id="attemptRes_0">Chờ...</span>
                        </div>
                        <div class="attempt-card" id="attemptCard_1">
                            <span class="card-title">Lượt 2 (Gió vừa)</span>
                            <span class="card-res" id="attemptRes_1">--</span>
                        </div>
                        <div class="attempt-card" id="attemptCard_2">
                            <span class="card-title">Lượt 3 (Gió mạnh)</span>
                            <span class="card-res" id="attemptRes_2">--</span>
                        </div>
                    </div>

                    <!-- Main Wind Gauge Section -->
                    <div class="game3-gauge-section">
                        <div class="game3-scale-labels">
                            <span class="scale-mark left">0đ</span>
                            <span class="scale-mark mid-left">50đ</span>
                            <span class="scale-mark center-mark">🎯 100 ĐIỂM</span>
                            <span class="scale-mark mid-right">50đ</span>
                            <span class="scale-mark right">0đ</span>
                        </div>

                        <!-- Thanh dài căn lực gió -->
                        <div class="game3-gauge-track" id="game3GaugeTrack">
                            <!-- Background gradient zones -->
                            <div class="gauge-zone zone-left-outer"></div>
                            <div class="gauge-zone zone-left-mid"></div>
                            <!-- Tâm điểm 100 điểm chính giữa (44% đến 56%, chiều dài 12% hợp lý) -->
                            <div class="gauge-zone zone-perfect" id="game3ZonePerfect">
                                <span class="perfect-text">100</span>
                                <div class="perfect-crosshair"></div>
                            </div>
                            <div class="gauge-zone zone-right-mid"></div>
                            <div class="gauge-zone zone-right-outer"></div>

                            <!-- Đọc đỏ (Kim chỉ đỏ quét liên tục) -->
                            <div class="game3-needle" id="game3Needle" style="left: 10%;">
                                <div class="needle-arrow-top">▼</div>
                                <div class="needle-line"></div>
                                <div class="needle-glow"></div>
                                <div class="needle-arrow-bottom">▲</div>
                            </div>
                        </div>

                        <!-- Điểm số vừa bấm hiện nổi bật -->
                        <div class="game3-hit-feedback" id="game3HitFeedback">
                            <span class="hit-score-badge" id="game3HitScoreBadge">HÃY BẤM DỪNG KIM!</span>
                        </div>
                    </div>

                    <!-- Action Button Area -->
                    <div class="game3-action-area">
                        <button type="button" class="game3-stop-btn" id="game3StopBtn" aria-label="Bấm dừng kim chỉ">
                            <span class="btn-stop-icon">🎯</span>
                            <span class="btn-stop-text" id="game3BtnText">BẤM DỪNG KIM!</span>
                        </button>
                        <p class="game3-helper-hint">(Chạm nhanh vào nút trên điện thoại hoặc nhấn phím Space trên máy tính)</p>
                    </div>
                </div>
            `;

            const attemptValDisplay = container.querySelector('#game3AttemptVal');
            const windValDisplay = container.querySelector('#game3WindVal');
            const totalScoreDisplay = container.querySelector('#game3TotalScore');
            const needle = container.querySelector('#game3Needle');
            const hitScoreBadge = container.querySelector('#game3HitScoreBadge');
            const stopBtn = container.querySelector('#game3StopBtn');
            const btnText = container.querySelector('#game3BtnText');

            // Cập nhật tổng điểm trên thanh tiêu đề
            function updateTotalScoreUI() {
                const total = _results.reduce((sum, r) => sum + r.score, 0);
                if (totalScoreDisplay) totalScoreDisplay.textContent = total;
            }

            // 2. Vòng lặp chuyển động của kim đỏ (Animation Loop)
            function loopNeedle(timestamp) {
                if (_isFinished || !_isNeedleRunning) return;

                if (!_lastTimestamp) _lastTimestamp = timestamp;
                const dt = Math.min(0.05, (timestamp - _lastTimestamp) / 1000); // delta-time tính bằng giây
                _lastTimestamp = timestamp;

                const speed = _SPEED_LEVELS[_currentAttempt] || 82;

                _currentPos += _direction * speed * dt;

                // Nảy lại ở 2 đầu biên (biên an toàn từ 2% đến 98%)
                if (_currentPos >= 98) {
                    _currentPos = 98;
                    _direction = -1;
                } else if (_currentPos <= 2) {
                    _currentPos = 2;
                    _direction = 1;
                }

                if (needle) {
                    needle.style.left = `${_currentPos.toFixed(2)}%`;
                }

                _animFrameId = requestAnimationFrame(loopNeedle);
            }

            // 3. Khởi chạy một lượt căn gió (Attempt 0, 1, 2)
            function startAttempt(attemptIndex) {
                if (_isFinished) return;
                _currentAttempt = attemptIndex;
                _isNeedleRunning = true;
                _lastTimestamp = 0;

                // Đổi hướng ngẫu nhiên để thêm phần chân thật
                _direction = Math.random() > 0.5 ? 1 : -1;
                _currentPos = _direction === 1 ? 12 : 88;

                if (attemptValDisplay) {
                    attemptValDisplay.textContent = `${attemptIndex + 1} / ${_TOTAL_ATTEMPTS}`;
                }
                if (windValDisplay) {
                    windValDisplay.textContent = _SPEED_LABELS[attemptIndex] || 'Gió mạnh';
                }

                // Cập nhật thẻ lượt đang hoạt động
                for (let i = 0; i < _TOTAL_ATTEMPTS; i++) {
                    const card = container.querySelector(`#attemptCard_${i}`);
                    if (card) card.classList.toggle('active', i === attemptIndex);
                }

                if (needle) {
                    needle.classList.remove('stopped', 'perfect-stop');
                    needle.style.left = `${_currentPos}%`;
                }

                if (hitScoreBadge) {
                    hitScoreBadge.className = 'hit-score-badge active-wait';
                    hitScoreBadge.textContent = `LƯỢT ${attemptIndex + 1}: CĂN ĐÚNG TÂM 100 ĐIỂM!`;
                }

                if (stopBtn) {
                    stopBtn.disabled = false;
                    stopBtn.classList.remove('disabled');
                }
                if (btnText) {
                    btnText.textContent = 'BẤM DỪNG KIM!';
                }

                _animFrameId = requestAnimationFrame(loopNeedle);
            }

            // 4. Xử lý khi người chơi bấm dừng kim chỉ
            function handleStop() {
                if (_isFinished || !_isNeedleRunning) return;
                _isNeedleRunning = false;

                if (_animFrameId) {
                    cancelAnimationFrame(_animFrameId);
                    _animFrameId = null;
                }

                const hitPos = _currentPos; // Vị trí bấm dừng (0% -> 100%)

                // CÔNG THỨC TÍNH ĐIỂM:
                // Tâm điểm chuẩn ở chính giữa: 50%
                // Vùng xanh lá hoàn hảo: thu hẹp từ 46.5% đến 53.5% (khoảng cách đến tâm d <= 3.5%) -> ĐẠT 100 ĐIỂM
                // Càng xa tâm điểm càng giảm dần về 0đ ở 2 mép biên:
                const distFromCenter = Math.abs(hitPos - 50);
                let score = 0;

                if (distFromCenter <= _PERFECT_RADIUS) {
                    // Trúng tâm xanh lá 100 điểm hoàn hảo!
                    score = 100;
                } else {
                    // Giảm dần tuyến tính từ 99 điểm về 0 điểm tại mép ngoài
                    // Khoảng cách từ 3.5% đến 50% (độ rộng 46.5%)
                    const decay = (distFromCenter - _PERFECT_RADIUS) / (50.0 - _PERFECT_RADIUS);
                    score = Math.max(0, Math.round(100 - decay * 100));
                }

                // Âm thanh và rung phản hồi
                if (score === 100) {
                    playAudio('hit_perfect', 100);
                    if (navigator.vibrate) {
                        try { navigator.vibrate([30, 40, 50]); } catch (_) {}
                    }
                } else if (score >= 60) {
                    playAudio('hit_good', score);
                    if (navigator.vibrate) {
                        try { navigator.vibrate(20); } catch (_) {}
                    }
                } else {
                    playAudio('hit_low', score);
                }

                // Hiệu ứng kim dừng
                if (needle) {
                    needle.classList.add('stopped');
                    if (score === 100) needle.classList.add('perfect-stop');
                }

                if (stopBtn) stopBtn.disabled = true;

                // Hiển thị kết quả lượt này
                if (hitScoreBadge) {
                    hitScoreBadge.className = `hit-score-badge ${score === 100 ? 'perfect' : (score >= 60 ? 'good' : 'low')}`;
                    if (score === 100) {
                        hitScoreBadge.innerHTML = '🌟 <strong>100 ĐIỂM TUYỆT ĐỐI!</strong> CHÍNH TÂM XANH LÁ!';
                    } else {
                        hitScoreBadge.innerHTML = `🎯 ĐẠT <strong>${score} ĐIỂM</strong> (Lệch ${distFromCenter.toFixed(1)}%)`;
                    }
                }

                // Cập nhật thẻ lượt
                const attemptRes = container.querySelector(`#attemptRes_${_currentAttempt}`);
                if (attemptRes) {
                    attemptRes.textContent = `${score} điểm`;
                    attemptRes.className = `card-res ${score === 100 ? 'perfect' : (score >= 60 ? 'good' : 'low')}`;
                }

                _results.push({
                    attempt: _currentAttempt + 1,
                    position: parseFloat(hitPos.toFixed(1)),
                    distFromCenter: parseFloat(distFromCenter.toFixed(1)),
                    score: score
                });
                updateTotalScoreUI();

                // Tạm dừng 1.3 giây để người chơi nhìn rõ kết quả rồi sang lượt tiếp theo
                _pauseTimeout = setTimeout(() => {
                    advanceToNextAttempt();
                }, 1300);
            }

            // 5. Chuyển sang lượt tiếp theo hoặc kết thúc
            function advanceToNextAttempt() {
                if (_isFinished) return;
                const nextIdx = _currentAttempt + 1;
                if (nextIdx < _TOTAL_ATTEMPTS) {
                    startAttempt(nextIdx);
                } else {
                    finishGame();
                }
            }

            // 6. Tổng kết ván chơi
            function finishGame() {
                if (_isFinished) return;
                _isFinished = true;
                _isNeedleRunning = false;

                const totalScore = _results.reduce((sum, r) => sum + r.score, 0);
                const perfectCount = _results.filter(r => r.score === 100).length;

                if (hitScoreBadge) {
                    hitScoreBadge.className = 'hit-score-badge finished';
                    hitScoreBadge.innerHTML = `🏆 HOÀN THÀNH 3 LƯỢT! <strong>TỔNG: ${totalScore} / 300 ĐIỂM</strong>`;
                }

                let bonusSteps = 0;
                if (totalScore >= 260) bonusSteps = 3;
                else if (totalScore >= 180) bonusSteps = 2;
                else if (totalScore >= 100) bonusSteps = 1;

                const win = totalScore >= 150;

                setTimeout(() => {
                    onComplete({
                        win: win,
                        score: totalScore,
                        totalScore: totalScore,
                        attemptsCount: _TOTAL_ATTEMPTS,
                        perfectCount: perfectCount,
                        results: _results,
                        bonusSteps: bonusSteps,
                        message: `Căn Lực Gió: ${totalScore}/300 điểm (${perfectCount}/3 lần 100đ)`
                    });
                }, 850);
            }

            // 7. Gắn sự kiện Pointer/Touch trên nút dừng
            if (stopBtn) {
                stopBtn.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    handleStop();
                }, { signal: options.signal });
            }

            // 8. Gắn sự kiện phím Space
            _keyHandler = (e) => {
                if (e.code === 'Space' && !_isFinished && _isNeedleRunning) {
                    e.preventDefault();
                    handleStop();
                }
            };
            window.addEventListener('keydown', _keyHandler, { signal: options.signal });

            // Bắt đầu lượt đầu tiên
            startAttempt(0);
        },

        destroy() {
            _isFinished = true;
            _isNeedleRunning = false;
            if (_animFrameId) {
                cancelAnimationFrame(_animFrameId);
                _animFrameId = null;
            }
            if (_pauseTimeout) {
                clearTimeout(_pauseTimeout);
                _pauseTimeout = null;
            }
            if (_keyHandler) {
                window.removeEventListener('keydown', _keyHandler);
                _keyHandler = null;
            }
        }
    };

    // Tự động đăng ký với MinigameManager nếu đã nạp
    if (typeof window !== 'undefined' && window.MinigameManager) {
        window.MinigameManager.register('game-3', Game3);
    }

    // Export module
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Game3;
    } else if (typeof window !== 'undefined') {
        window.Game3 = Game3;
    }
})();


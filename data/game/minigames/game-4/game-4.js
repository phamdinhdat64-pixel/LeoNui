/**
 * MINI-GAME 4: ĐẾM THỜI GIAN TRONG SƯƠNG MÙ (FOG TIMING)
 * - Cách chơi: Màn hình đưa ra một mốc thời gian mục tiêu (mặc định: đúng 7.00 giây).
 *   Đồng hồ bắt đầu chạy từ 0.00s, nhưng đến giây thứ 2.00s thì sương mù phủ kín làm ẩn con số đi.
 *   Mỗi người chơi tự nhẩm trong đầu và bấm phím của mình khi nghĩ đã chạm đúng mốc mục tiêu.
 *   (Thời gian tối đa không quá 15 giây).
 * - Tính điểm: Không tính điểm số, chỉ xếp hạng người chơi có ĐỘ LỆCH NHỎ NHẤT đứng đầu!
 */

(function () {
    let _animFrameId = null;
    let _countdownTimer = null;
    let _autoStopTimer = null;
    let _keyHandler = null;
    let _isFinished = false;
    let _isRunning = false;
    let _isFogActive = false;
    let _startTime = 0;
    let _stoppedTime = 0;

    // Cấu hình mặc định
    const _DEFAULT_TARGET_MIN = 5.00;
    const _DEFAULT_TARGET_MAX = 10.00;
    const _FOG_START_SEC = 2.00;
    const _MAX_TIME_SEC = 15.00;

    // Sinh ngẫu nhiên mốc thời gian mục tiêu từ 5.00 đến 10.00 giây (5, 6, 7, 8, 9, 10s)
    function getRandomTargetSec() {
        return 5 + Math.floor(Math.random() * 6);
    }

    // Âm thanh Web Audio API không độ trễ
    function playAudio(type, extra = 0) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!window._game4AudioCtx) {
                window._game4AudioCtx = new AudioCtx();
            }
            const actx = window._game4AudioCtx;
            if (actx.state === 'suspended') actx.resume();

            const now = actx.currentTime;

            if (type === 'tick') {
                // Tiếng tích tắc đếm giây
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(580, now);
                gain.gain.setValueAtTime(0.025, now);
                gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.03);
            } else if (type === 'fog_whoosh') {
                // Tiếng gió rít và sương mù cuộn vào
                const bufferSize = actx.sampleRate * 0.6;
                const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = Math.random() * 2 - 1;
                }
                const noise = actx.createBufferSource();
                noise.buffer = buffer;

                const filter = actx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.setValueAtTime(320, now);
                filter.frequency.exponentialRampToValueAtTime(140, now + 0.6);
                filter.Q.value = 3.0;

                const gain = actx.createGain();
                gain.gain.setValueAtTime(0.01, now);
                gain.gain.linearRampToValueAtTime(0.12, now + 0.2);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(actx.destination);
                noise.start(now);
            } else if (type === 'stop_press') {
                // Tiếng bấm dừng
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(700, now);
                osc.frequency.exponentialRampToValueAtTime(350, now + 0.12);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.12);
            } else if (type === 'reveal_perfect') {
                // Trúng siêu chuẩn lệch <= 0.15s: Chuông mừng chiến thắng
                const freqs = [523.25, 659.25, 783.99, 1046.50];
                freqs.forEach((f, idx) => {
                    const osc = actx.createOscillator();
                    const gain = actx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(f, now + idx * 0.08);
                    gain.gain.setValueAtTime(0.14, now + idx * 0.08);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);
                    osc.connect(gain);
                    gain.connect(actx.destination);
                    osc.start(now + idx * 0.08);
                    osc.stop(now + idx * 0.08 + 0.4);
                });
            } else if (type === 'reveal_good') {
                // Trúng tốt <= 0.50s
                const freqs = [440, 554.37, 659.25];
                freqs.forEach((f, idx) => {
                    const osc = actx.createOscillator();
                    const gain = actx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(f, now + idx * 0.09);
                    gain.gain.setValueAtTime(0.12, now + idx * 0.09);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.35);
                    osc.connect(gain);
                    gain.connect(actx.destination);
                    osc.start(now + idx * 0.09);
                    osc.stop(now + idx * 0.09 + 0.35);
                });
            } else {
                // Lệch nhiều
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(260, now);
                osc.frequency.linearRampToValueAtTime(160, now + 0.25);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.25);
            }
        } catch (_) {}
    }

    const Game4 = {
        id: 'game-4',
        title: 'ĐẾM THỜI GIAN TRONG SƯƠNG MÙ',
        description: 'Đồng hồ sẽ bị sương mù che khuất ở giây thứ 2. Hãy nhẩm đếm trong đầu và bấm DỪNG khi nghĩ đã chạm đúng mốc mục tiêu (ngẫu nhiên từ 5 – 10 giây)!',

        init(container, onComplete, options = {}) {
            _isFinished = false;
            _isRunning = false;
            _isFogActive = false;
            _startTime = 0;
            _stoppedTime = 0;

            // Hỗ trợ mục tiêu tùy biến hoặc tự sinh ngẫu nhiên từ 5.00s đến 10.00s
            const targetSec = (typeof options.targetSec === 'number' && options.targetSec >= 4 && options.targetSec <= 15)
                ? options.targetSec
                : getRandomTargetSec();

            // 1. Tạo giao diện Mini-game
            container.innerHTML = `
                <div class="game4-wrapper">
                    <!-- Top Info: Mục tiêu thời gian -->
                    <div class="game4-header-bar">
                        <div class="game4-target-pill">
                            <span class="pill-label">🎯 MỤC TIÊU:</span>
                            <span class="pill-value">${targetSec.toFixed(2)} GIÂY</span>
                        </div>
                        <div class="game4-guide-text">
                            Đồng hồ chạy từ <strong>0.00s</strong>. Đến <strong>2.00s</strong> sương mù sẽ phủ kín! Hãy tự nhẩm đếm và bấm <strong>DỪNG</strong> khi chạm đúng ${targetSec.toFixed(2)}s.
                        </div>
                    </div>

                    <!-- Thanh trạng thái / Cảnh báo -->
                    <div class="game4-status-banner" id="game4StatusBanner">
                        ⏳ Chuẩn bị bắt đầu...
                    </div>

                    <!-- Khung Đồng Hồ Đếm Giờ & Lớp Sương Mù -->
                    <div class="game4-clock-stage" id="game4ClockStage">
                        <!-- Số hiển thị đồng hồ điện tử -->
                        <div class="game4-digits-box" id="game4DigitsBox">
                            <div class="game4-digits" id="game4Digits">0.00s</div>
                            <div class="game4-digits-sub">CHÍNH XÁC ĐẾN 1/100 GIÂY</div>
                        </div>

                        <!-- Lớp Sương Mù Bí Ẩn Cuộn Trào -->
                        <div class="game4-fog-overlay" id="game4FogOverlay">
                            <div class="game4-fog-layer game4-fog-1"></div>
                            <div class="game4-fog-layer game4-fog-2"></div>
                            <div class="game4-fog-layer game4-fog-3"></div>
                            <div class="game4-fog-mystery-icon">🌫️ ??.??s 🌫️</div>
                        </div>

                        <!-- Khối Hiển Thị Kết Quả Sau Khi Bấm Dừng -->
                        <div class="game4-reveal-card" id="game4RevealCard">
                            <div class="game4-reveal-title">KẾT QUẢ CỦA BẠN</div>
                            <div class="game4-reveal-time" id="game4RevealTime">0.00s</div>
                            <div class="game4-reveal-diff" id="game4RevealDiff">Độ lệch: ±0.00s</div>
                            <div class="game4-reveal-verdict" id="game4RevealVerdict">Tuyệt vời!</div>
                        </div>
                    </div>

                    <!-- Nút Bấm Dừng To & Trực Quan -->
                    <div class="game4-controls-box">
                        <button type="button" class="game4-stop-btn" id="game4StopBtn" disabled>
                            ⏱️ DỪNG LẠI NGAY!
                        </button>
                        <div class="game4-btn-hint">(Nhấn Phím SPACE hoặc Chạm Vào Nút / Màn Hình)</div>
                    </div>
                </div>
            `;

            // 2. Tham chiếu DOM
            const clockStage = container.querySelector('#game4ClockStage');
            const digits = container.querySelector('#game4Digits');
            const statusBanner = container.querySelector('#game4StatusBanner');
            const stopBtn = container.querySelector('#game4StopBtn');
            const revealCard = container.querySelector('#game4RevealCard');
            const revealTime = container.querySelector('#game4RevealTime');
            const revealDiff = container.querySelector('#game4RevealDiff');
            const revealVerdict = container.querySelector('#game4RevealVerdict');

            let lastTickSecond = -1;

            // 3. Đếm ngược 3, 2, 1 trước khi đồng hồ bắt đầu chạy
            let countdownCount = 3;
            statusBanner.className = 'game4-status-banner warning';
            statusBanner.innerHTML = `⚠️ Chuẩn bị trong: <strong>${countdownCount}</strong>`;

            _countdownTimer = setInterval(() => {
                countdownCount--;
                if (countdownCount > 0) {
                    statusBanner.innerHTML = `⚠️ Chuẩn bị trong: <strong>${countdownCount}</strong>`;
                    playAudio('tick');
                } else if (countdownCount === 0) {
                    clearInterval(_countdownTimer);
                    _countdownTimer = null;
                    startTimer();
                }
            }, 800);

            // 4. Bắt đầu đếm thời gian
            function startTimer() {
                if (_isFinished) return;
                _isRunning = true;
                _startTime = performance.now();
                lastTickSecond = -1;

                statusBanner.className = 'game4-status-banner';
                statusBanner.innerHTML = `⏱️ Đang đếm... Hãy quan sát nhịp điệu!`;

                if (stopBtn) {
                    stopBtn.disabled = false;
                }

                _animFrameId = requestAnimationFrame(updateLoop);
            }

            // 5. Vòng lặp cập nhật đồng hồ (Update Loop 60fps)
            function updateLoop(now) {
                if (!_isRunning || _isFinished) return;

                const elapsedMs = now - _startTime;
                const elapsedSec = elapsedMs / 1000;

                // Cập nhật số hiển thị
                if (digits) {
                    digits.textContent = `${elapsedSec.toFixed(2)}s`;
                }

                // Phát tiếng tích tắc nhẹ mỗi 0.5 giây trong giai đoạn chưa sương mù
                if (!_isFogActive) {
                    const currentHalfSec = Math.floor(elapsedSec * 2);
                    if (currentHalfSec !== lastTickSecond) {
                        lastTickSecond = currentHalfSec;
                        playAudio('tick');
                    }
                }

                // Kiểm tra mốc 2.00s: Sương mù cuộn vào phủ kín!
                if (elapsedSec >= _FOG_START_SEC && !_isFogActive) {
                    _isFogActive = true;
                    clockStage.classList.add('fogged');
                    statusBanner.className = 'game4-status-banner fog-active';
                    statusBanner.innerHTML = `🌫️ SƯƠNG MÙ ĐÃ PHỦ KÍN! Hãy tự nhẩm đếm trong đầu...`;
                    playAudio('fog_whoosh');
                }

                // Giới hạn thời gian không quá 15 giây
                if (elapsedSec >= _MAX_TIME_SEC) {
                    handleStop(true); // Tự động dừng do chạm trần 15s
                    return;
                }

                _animFrameId = requestAnimationFrame(updateLoop);
            }

            // 6. Xử lý khi người chơi bấm Dừng
            function handleStop(isTimeout = false) {
                if (!_isRunning || _isFinished) return;

                _isRunning = false;
                _isFinished = true;

                if (_animFrameId) {
                    cancelAnimationFrame(_animFrameId);
                    _animFrameId = null;
                }

                playAudio('stop_press');

                if (stopBtn) {
                    stopBtn.disabled = true;
                }

                const now = performance.now();
                _stoppedTime = isTimeout ? _MAX_TIME_SEC : Math.min(_MAX_TIME_SEC, (now - _startTime) / 1000);

                const diff = _stoppedTime - targetSec;
                const absDiff = Math.abs(diff);

                // Gỡ sương mù để vén màn sự thật
                clockStage.classList.remove('fogged');

                // Đánh giá độ chính xác
                let ratingText = '';
                let diffClass = '';
                let sfx = 'reveal_far';

                if (absDiff <= 0.15) {
                    ratingText = '🏆 Thần sầu cảm giác thời gian!';
                    diffClass = 'perfect';
                    sfx = 'reveal_perfect';
                } else if (absDiff <= 0.35) {
                    ratingText = '🎯 Cực kỳ chuẩn xác!';
                    diffClass = 'great';
                    sfx = 'reveal_perfect';
                } else if (absDiff <= 0.70) {
                    ratingText = '👍 Rất tốt!';
                    diffClass = 'great';
                    sfx = 'reveal_good';
                } else if (absDiff <= 1.20) {
                    ratingText = '⏱️ Khá ổn!';
                    diffClass = 'okay';
                    sfx = 'reveal_good';
                } else {
                    ratingText = isTimeout ? '⌛ Quá thời gian 15s!' : '🌫️ Bị sương mù đánh lừa rồi!';
                    diffClass = 'far';
                    sfx = 'reveal_far';
                }

                setTimeout(() => playAudio(sfx), 180);

                // Cập nhật card vén màn kết quả
                if (revealTime) {
                    revealTime.textContent = `${_stoppedTime.toFixed(2)}s`;
                }
                if (revealDiff) {
                    const sign = diff >= 0 ? '+' : '';
                    revealDiff.className = `game4-reveal-diff ${diffClass}`;
                    revealDiff.innerHTML = `Độ lệch: <strong>${sign}${diff.toFixed(2)}s</strong> (±${absDiff.toFixed(2)}s)`;
                }
                if (revealVerdict) {
                    revealVerdict.textContent = ratingText;
                }
                if (revealCard) {
                    revealCard.classList.add('visible');
                }

                statusBanner.className = 'game4-status-banner';
                statusBanner.innerHTML = `🎯 Bạn đã dừng lúc <strong>${_stoppedTime.toFixed(2)}s</strong> (Mục tiêu: ${targetSec.toFixed(2)}s)!`;

                // Kết thúc mini-game và trả kết quả sau 1.6 giây
                setTimeout(() => {
                    onComplete({
                        win: absDiff <= 0.50,
                        score: 0, // Không tính điểm số theo yêu cầu
                        fogStoppedTime: _stoppedTime,
                        targetTime: targetSec,
                        diffSec: absDiff,
                        rawDiff: diff,
                        ratingText: ratingText,
                        message: `Đếm Sương Mù: ${_stoppedTime.toFixed(2)}s (Mục tiêu: ${targetSec.toFixed(2)}s • Lệch: ±${absDiff.toFixed(2)}s)`
                    });
                }, 1600);
            }

            // 7. Gắn sự kiện bấm nút & chạm màn hình
            if (stopBtn) {
                stopBtn.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    handleStop();
                }, { signal: options.signal });
            }

            // Chạm vào khung đồng hồ cũng cho phép dừng
            if (clockStage) {
                clockStage.addEventListener('pointerdown', (e) => {
                    if (_isRunning) {
                        e.preventDefault();
                        handleStop();
                    }
                }, { signal: options.signal });
            }

            // 8. Gắn sự kiện phím Space
            _keyHandler = (e) => {
                if (e.code === 'Space' && _isRunning && !_isFinished) {
                    e.preventDefault();
                    handleStop();
                }
            };
            window.addEventListener('keydown', _keyHandler, { signal: options.signal });
        },

        destroy() {
            _isFinished = true;
            _isRunning = false;
            if (_animFrameId) {
                cancelAnimationFrame(_animFrameId);
                _animFrameId = null;
            }
            if (_countdownTimer) {
                clearInterval(_countdownTimer);
                _countdownTimer = null;
            }
            if (_autoStopTimer) {
                clearTimeout(_autoStopTimer);
                _autoStopTimer = null;
            }
            if (_keyHandler) {
                window.removeEventListener('keydown', _keyHandler);
                _keyHandler = null;
            }
        }
    };

    // Tự động đăng ký với MinigameManager nếu có
    if (typeof window !== 'undefined' && window.MinigameManager) {
        window.MinigameManager.register('game-4', Game4);
    }

    // Export module
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Game4;
    } else if (typeof window !== 'undefined') {
        window.Game4 = Game4;
    }
})();


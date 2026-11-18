/**
 * MINI-GAME 6: GIỮ THĂNG BẰNG QUA CẦU TREO (BRIDGE BALANCE)
 * - Cách chơi: Mỗi người chơi có một thanh thăng bằng ngang bắc qua cầu treo vực sâu.
 *   Gió núi thổi liên tục làm nhân vật nghiêng sang trái hoặc phải.
 *   Có 2 nút Trái / Phải để người chơi nhấn nhằm giữ nhân vật nằm trong "vùng tâm màu xanh" ở giữa.
 *   Càng về sau gió đổi chiều càng nhanh và dồn dập!
 * - Xếp hạng: Xếp theo THỜI GIAN TRỤ VỮNG (người trụ lâu nhất đứng đầu).
 */

(function () {
    let _animFrameId = null;
    let _countdownTimer = null;
    let _keyHandlerDown = null;
    let _keyHandlerUp = null;
    let _isFinished = false;
    let _isRunning = false;

    // Trạng thái vật lý
    let _tilt = 0; // Góc nghiêng (-38 độ đến +38 độ, 0 là tâm)
    let _tiltVelocity = 0;
    let _lastTime = 0;
    let _startTime = 0;
    let _survivalTime = 0;

    let _leftPressed = false;
    let _rightPressed = false;
    let _windPhase = 0;
    let _lastWarningTime = 0;

    const _MAX_SURVIVAL_SEC = 20.00;
    const _MAX_TILT_ANGLE = 38.0; // Ngã nếu vượt quá 38 độ
    const _SAFE_ZONE_ANGLE = 14.0; // Vùng tâm xanh an toàn

    // SVG Nhân Vật Đi Cầu Treo (Cầm gậy thăng bằng)
    const CHAR_SVG = `
        <svg class="game6-char-avatar" viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
            <!-- Thân -->
            <rect x="30" y="38" width="20" height="30" rx="6" fill="#0284c7" />
            <!-- Chân trái & phải -->
            <rect x="32" y="66" width="6" height="22" rx="3" fill="#1e293b" />
            <rect x="42" y="66" width="6" height="22" rx="3" fill="#1e293b" />
            <!-- Đầu & Mũ leo núi -->
            <circle cx="40" cy="24" r="14" fill="#fdba74" />
            <path d="M 24 22 Q 40 8 56 22 L 58 24 L 22 24 Z" fill="#ef4444" />
            <!-- Kính bảo hộ -->
            <rect x="32" y="20" width="16" height="6" rx="2" fill="#0f172a" />
            <circle cx="36" cy="23" r="2.5" fill="#38bdf8" />
            <circle cx="44" cy="23" r="2.5" fill="#38bdf8" />
            <!-- Miệng biểu cảm căng thẳng -->
            <circle cx="40" cy="31" r="2" fill="#7c2d12" />
        </svg>
    `;

    // SVG Dây Cáp Cầu Treo Vực Sâu
    const CABLE_SVG = `
        <svg class="game6-cable-svg" viewBox="0 0 400 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Dây cáp chính uốn cong -->
            <path d="M 0 10 Q 200 55 400 10" stroke="#64748b" stroke-width="3" fill="none" />
            <!-- Các dây cáp treo dọc -->
            ${Array.from({ length: 9 }).map((_, i) => {
                const x = 40 + i * 40;
                const yCurve = 10 + 45 * Math.sin((x / 400) * Math.PI);
                return `<line x1="${x}" y1="${yCurve}" x2="${x}" y2="60" stroke="#475569" stroke-width="1.5" stroke-dasharray="2 2" />`;
            }).join('')}
        </svg>
    `;

    // Âm thanh Web Audio API
    function playAudio(type, extra = 0) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!window._game6AudioCtx) {
                window._game6AudioCtx = new AudioCtx();
            }
            const actx = window._game6AudioCtx;
            if (actx.state === 'suspended') actx.resume();

            const now = actx.currentTime;

            if (type === 'step') {
                // Tiếng bước chân / gõ nhẹ
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(320 + extra * 40, now);
                gain.gain.setValueAtTime(0.08, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.05);
            } else if (type === 'creak') {
                // Tiếng cót két của cầu gỗ
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(140, now);
                osc.frequency.linearRampToValueAtTime(90, now + 0.12);
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.12);
            } else if (type === 'warning') {
                // Tiếng bíp cảnh báo sắp ngã
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(620, now);
                gain.gain.setValueAtTime(0.09, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'fall') {
                // Tiếng ngã xuống vực
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(450, now);
                osc.frequency.exponentialRampToValueAtTime(60, now + 0.55);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.55);
            } else if (type === 'victory') {
                // Chuông chiến thắng qua cầu an toàn
                const notes = [523.25, 659.25, 783.99, 1046.50];
                notes.forEach((freq, idx) => {
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
            }
        } catch (_) {}
    }

    const Game6 = {
        id: 'game-6',
        title: 'GIỮ THĂNG BẰNG QUA CẦU TREO',
        description: 'Bấm nút <strong>Trái / Phải</strong> để giữ nhân vật cân bằng trong <strong>vùng tâm xanh</strong>! Càng về sau gió đổi chiều càng nhanh!',

        init(container, onComplete, options = {}) {
            _isFinished = false;
            _isRunning = false;
            _tilt = 0;
            _tiltVelocity = 0;
            _leftPressed = false;
            _rightPressed = false;
            _windPhase = 0;
            _survivalTime = 0;
            _lastWarningTime = 0;

            // 1. Dựng giao diện Mini-game Cầu Treo
            container.innerHTML = `
                <div class="game6-wrapper">
                    <!-- Header HUD: Thời Gian Trụ Vững & Chỉ Số Gió -->
                    <div class="game6-header-bar">
                        <div class="game6-hud-pill game6-timer-pill">
                            <span>⏱️ TRỤ VỮNG:</span>
                            <span class="game6-timer-val" id="game6Timer">0.00s</span>
                        </div>
                        <div class="game6-hud-pill game6-wind-pill">
                            <span>🌪️ GIÓ NÚI:</span>
                            <span class="game6-wind-val" id="game6WindVal">Cấp 1 • 🍃</span>
                        </div>
                    </div>

                    <!-- Thanh Cảnh Báo Hướng Gió -->
                    <div class="game6-wind-warning-bar" id="game6WindBar">
                        ⏳ Chuẩn bị bước lên cầu treo...
                    </div>

                    <!-- Sân Khấu Cầu Treo Vực Sâu -->
                    <div class="game6-stage" id="game6Stage">
                        <!-- Vùng Tâm Xanh An Toàn -->
                        <div class="game6-safe-zone-marker">
                            <span class="game6-safe-zone-label">TÂM AN TOÀN</span>
                        </div>

                        <!-- Cáp Cầu Treo Mắc Ngang -->
                        <div class="game6-cables">
                            ${CABLE_SVG}
                        </div>

                        <!-- Cụm Cầu & Nhân Vật (Nghiêng theo góc _tilt) -->
                        <div class="game6-bridge-assembly" id="game6Assembly">
                            <!-- Nhân Vật Cầm Gậy Cân Bằng -->
                            <div class="game6-character-container" id="game6Char">
                                <div class="game6-pole-bar"></div>
                                ${CHAR_SVG}
                            </div>

                            <!-- Ván Cầu Gỗ -->
                            <div class="game6-bridge-plank">
                                <div class="game6-plank-green-center"></div>
                            </div>
                        </div>

                        <!-- Lớp Mây Dưới Vực Thẳm -->
                        <div class="game6-clouds-abyss"></div>

                        <!-- Thẻ Kết Quả -->
                        <div class="game6-result-card" id="game6ResultCard">
                            <div class="game6-res-title">THỜI GIAN TRỤ VỮNG</div>
                            <div class="game6-res-time" id="game6ResTime">0.00s</div>
                            <div class="game6-res-verdict" id="game6ResVerdict">Xuất sắc!</div>
                        </div>
                    </div>

                    <!-- 2 Nút Bấm Trái / Phải Điều Khiển -->
                    <div class="game6-controls-grid">
                        <button type="button" class="game6-btn game6-btn-left" id="game6BtnLeft">
                            ⬅ NGHIÊNG TRÁI
                        </button>
                        <button type="button" class="game6-btn game6-btn-right" id="game6BtnRight">
                            NGHIÊNG PHẢI ➡
                        </button>
                    </div>

                    <div class="game6-hint-text">
                        (Nhấn nút Trái/Phải hoặc phím ⬅ / ➡ / Phím A / D để cân bằng)
                    </div>
                </div>
            `;

            // 2. Tham chiếu DOM
            const timerEl = container.querySelector('#game6Timer');
            const windValEl = container.querySelector('#game6WindVal');
            const windBarEl = container.querySelector('#game6WindBar');
            const assemblyEl = container.querySelector('#game6Assembly');
            const charEl = container.querySelector('#game6Char');
            const btnLeft = container.querySelector('#game6BtnLeft');
            const btnRight = container.querySelector('#game6BtnRight');
            const resultCard = container.querySelector('#game6ResultCard');
            const resTimeEl = container.querySelector('#game6ResTime');
            const resVerdictEl = container.querySelector('#game6ResVerdict');

            // 3. Đếm ngược 3, 2, 1 trước khi bắt đầu
            let countdown = 3;
            windBarEl.innerHTML = `⚠️ Chuẩn bị trong: <strong>${countdown}</strong>`;

            _countdownTimer = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                    windBarEl.innerHTML = `⚠️ Chuẩn bị trong: <strong>${countdown}</strong>`;
                } else if (countdown === 0) {
                    clearInterval(_countdownTimer);
                    _countdownTimer = null;
                    startBridgeCrossing();
                }
            }, 800);

            // 4. Khởi động vòng lặp vật lý
            function startBridgeCrossing() {
                if (_isFinished) return;
                _isRunning = true;
                _startTime = performance.now();
                _lastTime = _startTime;
                _tilt = 0;
                _tiltVelocity = 0;
                _windPhase = 0;

                windBarEl.className = 'game6-wind-warning-bar';
                windBarEl.innerHTML = `🌬️ Gió bắt đầu thổi nhẹ... Hãy giữ vững!`;

                _animFrameId = requestAnimationFrame(updatePhysicsLoop);
            }

            // 5. Vòng Lặp Vật Lý Thăng Bằng & Gió Đổi Chiều (60 FPS)
            function updatePhysicsLoop(now) {
                if (!_isRunning || _isFinished) return;

                const dt = Math.min(0.04, (now - _lastTime) / 1000); // delta time
                _lastTime = now;

                const elapsed = (now - _startTime) / 1000;
                _survivalTime = Math.min(_MAX_SURVIVAL_SEC, elapsed);

                // Cập nhật đồng hồ thời gian trụ vững
                if (timerEl) {
                    timerEl.textContent = `${_survivalTime.toFixed(2)}s`;
                }

                // Tần số đổi chiều của gió: Càng về sau càng nhanh!
                // Lúc đầu: chu kỳ ~1.6 giây (f = 0.6 Hz). Cuối cùng: chu kỳ ~0.4 giây (f = 2.4 Hz)!
                const windFreq = 0.65 + (elapsed / _MAX_SURVIVAL_SEC) * 1.85;
                _windPhase += (2 * Math.PI * windFreq) * dt;

                // Biên độ lực gió tăng dần từ 16 lên 32
                const windAmplitude = 16.0 + (elapsed / _MAX_SURVIVAL_SEC) * 16.0;
                const windForce = Math.sin(_windPhase) * windAmplitude + Math.cos(_windPhase * 1.7) * (windAmplitude * 0.35);

                // Cập nhật HUD cấp gió
                const windLevel = Math.min(5, 1 + Math.floor((elapsed / _MAX_SURVIVAL_SEC) * 4.9));
                const windIcon = windLevel <= 2 ? '🍃' : (windLevel <= 4 ? '💨' : '🌪️');
                if (windValEl) {
                    windValEl.innerHTML = `Cấp ${windLevel} • ${windIcon}`;
                }

                // Cập nhật thanh cảnh báo hướng gió
                if (windBarEl) {
                    if (windForce < -6) {
                        windBarEl.className = 'game6-wind-warning-bar gust-left';
                        windBarEl.innerHTML = `⬅️ GIÓ GIẬT SANG TRÁI! Bấm Phải để ghìm lại!`;
                    } else if (windForce > 6) {
                        windBarEl.className = 'game6-wind-warning-bar gust-right';
                        windBarEl.innerHTML = `GIÓ GIẬT SANG PHẢI! ➡️ Bấm Trái để ghìm lại!`;
                    } else {
                        windBarEl.className = 'game6-wind-warning-bar';
                        windBarEl.innerHTML = `⚖️ Gió đổi hướng liên tục! Giữ ở tâm xanh!`;
                    }
                }

                // Lực của người chơi bấm nút Trái / Phải
                let playerForce = 0;
                const CONTROL_POWER = 55.0; // Sức ấn điều khiển
                if (_leftPressed) playerForce -= CONTROL_POWER;
                if (_rightPressed) playerForce += CONTROL_POWER;

                // Trọng lực mất thăng bằng (Inverted Pendulum - nghiêng càng nhiều càng bị kéo mạnh)
                const gravityTorque = _tilt * 1.65;

                // Tổng hợp gia tốc góc
                const totalTorque = windForce + playerForce + gravityTorque;
                _tiltVelocity += totalTorque * dt;

                // Giảm chấn ma sát không khí (damping)
                _tiltVelocity *= Math.pow(0.92, dt * 60);

                // Cập nhật góc nghiêng
                _tilt += _tiltVelocity * dt;

                // Hiển thị góc nghiêng lên DOM
                if (assemblyEl) {
                    assemblyEl.style.transform = `rotate(${_tilt.toFixed(2)}deg)`;
                }
                if (charEl) {
                    // Nhân vật phản xạ nghiêng thêm một chút để chống lại góc đổ
                    const charCounterTilt = -_tilt * 0.35;
                    charEl.style.transform = `rotate(${charCounterTilt.toFixed(2)}deg)`;
                }

                // Cảnh báo âm thanh khi nghiêng gần mép vực
                const absTilt = Math.abs(_tilt);
                if (absTilt > _SAFE_ZONE_ANGLE) {
                    if (now - _lastWarningTime > 380) {
                        _lastWarningTime = now;
                        playAudio('warning');
                        if (Math.random() < 0.4) playAudio('creak');
                    }
                }

                // Kiểm tra điều kiện ngã cầu (thua cuộc)
                if (absTilt >= _MAX_TILT_ANGLE) {
                    handleFall();
                    return;
                }

                // Kiểm tra điều kiện hoàn thành toàn bộ 20 giây (chiến thắng xuất sắc)
                if (elapsed >= _MAX_SURVIVAL_SEC) {
                    handleSuccess();
                    return;
                }

                _animFrameId = requestAnimationFrame(updatePhysicsLoop);
            }

            // 6. Xử lý khi ngã cầu
            function handleFall() {
                if (_isFinished) return;
                _isFinished = true;
                _isRunning = false;

                if (_animFrameId) {
                    cancelAnimationFrame(_animFrameId);
                    _animFrameId = null;
                }

                playAudio('fall');

                // Hiệu ứng rơi khỏi cầu
                if (charEl) {
                    charEl.style.transition = 'transform 0.5s ease-in, opacity 0.5s ease-in';
                    charEl.style.transform = `translateY(160px) rotate(${_tilt > 0 ? 120 : -120}deg)`;
                    charEl.style.opacity = '0';
                }

                if (resTimeEl) {
                    resTimeEl.textContent = `${_survivalTime.toFixed(2)}s`;
                }
                if (resVerdictEl) {
                    resVerdictEl.textContent = 'Trượt chân rơi xuống vực! Cố gắng ở lượt sau nhé!';
                }
                if (resultCard) {
                    resultCard.className = 'game6-result-card visible fail';
                }

                finalizeGame();
            }

            // 7. Xử lý khi qua cầu thành công trọn vẹn 20s
            function handleSuccess() {
                if (_isFinished) return;
                _isFinished = true;
                _isRunning = false;

                if (_animFrameId) {
                    cancelAnimationFrame(_animFrameId);
                    _animFrameId = null;
                }

                playAudio('victory');

                if (resTimeEl) {
                    resTimeEl.textContent = `${_MAX_SURVIVAL_SEC.toFixed(2)}s`;
                }
                if (resVerdictEl) {
                    resVerdictEl.textContent = '🏆 XUẤT SẮC! ĐÃ VƯỢT QUA CẦU TREO AN TOÀN!';
                }
                if (resultCard) {
                    resultCard.className = 'game6-result-card visible';
                }

                finalizeGame();
            }

            // 8. Đóng gói kết quả trả về
            function finalizeGame() {
                // Vô hiệu hóa nút
                if (btnLeft) btnLeft.disabled = true;
                if (btnRight) btnRight.disabled = true;

                const finalSurvival = Number(_survivalTime.toFixed(2));
                const win = finalSurvival >= 12.0;

                setTimeout(() => {
                    onComplete({
                        win: win,
                        score: Math.round(finalSurvival * 10), // Điểm quy đổi: mỗi giây = 10đ
                        survivalTime: finalSurvival,
                        maxTime: _MAX_SURVIVAL_SEC,
                        message: `Cầu Treo: Trụ vững ${finalSurvival.toFixed(2)}s / ${_MAX_SURVIVAL_SEC.toFixed(2)}s`
                    });
                }, 1400);
            }

            // 9. Gắn sự kiện Pointer / Touch trên 2 nút Trái / Phải
            const setLeft = (val) => {
                _leftPressed = val;
                if (btnLeft) {
                    if (val) btnLeft.classList.add('pressed');
                    else btnLeft.classList.remove('pressed');
                }
                if (val && _isRunning) playAudio('step', 1);
            };

            const setRight = (val) => {
                _rightPressed = val;
                if (btnRight) {
                    if (val) btnRight.classList.add('pressed');
                    else btnRight.classList.remove('pressed');
                }
                if (val && _isRunning) playAudio('step', 2);
            };

            if (btnLeft) {
                btnLeft.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    setLeft(true);
                }, { signal: options.signal });
                btnLeft.addEventListener('pointerup', () => setLeft(false), { signal: options.signal });
                btnLeft.addEventListener('pointerleave', () => setLeft(false), { signal: options.signal });
                btnLeft.addEventListener('pointercancel', () => setLeft(false), { signal: options.signal });
            }

            if (btnRight) {
                btnRight.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    setRight(true);
                }, { signal: options.signal });
                btnRight.addEventListener('pointerup', () => setRight(false), { signal: options.signal });
                btnRight.addEventListener('pointerleave', () => setRight(false), { signal: options.signal });
                btnRight.addEventListener('pointercancel', () => setRight(false), { signal: options.signal });
            }

            // 10. Gắn sự kiện Bàn Phím (Mũi tên hoặc A/D)
            _keyHandlerDown = (e) => {
                if (!_isRunning || _isFinished) return;
                if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                    e.preventDefault();
                    setLeft(true);
                } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                    e.preventDefault();
                    setRight(true);
                }
            };

            _keyHandlerUp = (e) => {
                if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                    setLeft(false);
                } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                    setRight(false);
                }
            };

            window.addEventListener('keydown', _keyHandlerDown, { signal: options.signal });
            window.addEventListener('keyup', _keyHandlerUp, { signal: options.signal });
        },

        destroy() {
            _isFinished = true;
            _isRunning = false;
            _leftPressed = false;
            _rightPressed = false;
            if (_animFrameId) {
                cancelAnimationFrame(_animFrameId);
                _animFrameId = null;
            }
            if (_countdownTimer) {
                clearInterval(_countdownTimer);
                _countdownTimer = null;
            }
            if (_keyHandlerDown) {
                window.removeEventListener('keydown', _keyHandlerDown);
                _keyHandlerDown = null;
            }
            if (_keyHandlerUp) {
                window.removeEventListener('keyup', _keyHandlerUp);
                _keyHandlerUp = null;
            }
        }
    };

    // Đăng ký với MinigameManager
    if (typeof window !== 'undefined' && window.MinigameManager) {
        window.MinigameManager.register('game-6', Game6);
    }

    // Export module
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Game6;
    } else if (typeof window !== 'undefined') {
        window.Game6 = Game6;
    }
})();


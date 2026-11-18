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

    const _MAX_SURVIVAL_SEC = 30.00;
    const _MAX_TILT_ANGLE = 22.0; // Góc ngã siết hẹp 22 độ (nghiêng nhẹ là trượt khỏi dây cáp!)
    const _SAFE_ZONE_ANGLE = 6.5;  // Vùng tâm xanh rất hẹp chỉ 6.5 độ

    // SVG Nhân Vật Đi Trên Dây Cáp Thăng Bằng (Góc nhìn từ sau lưng nhân vật)
    const CHAR_BEHIND_SVG = `
        <svg class="game6-char-behind-svg" viewBox="-115 0 310 135" xmlns="http://www.w3.org/2000/svg">
            <!-- CÂY GẬY CÂN BẰNG DÀI UỐN CONG CẦM NGANG (Balancing Pole) -->
            <path d="M -105 66 Q 40 42 185 66" stroke="#f59e0b" stroke-width="5" fill="none" stroke-linecap="round" />
            <path d="M -105 66 Q 40 42 185 66" stroke="#fef08a" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.7" />
            <!-- Quả nặng & dây tua cân bằng 2 đầu gậy -->
            <circle cx="-105" cy="66" r="7" fill="#ef4444" stroke="#b91c1c" stroke-width="2" />
            <circle cx="185" cy="66" r="7" fill="#ef4444" stroke="#b91c1c" stroke-width="2" />
            <line x1="-105" y1="73" x2="-105" y2="88" stroke="#ef4444" stroke-width="2.5" />
            <line x1="185" y1="73" x2="185" y2="88" stroke="#ef4444" stroke-width="2.5" />

            <!-- NHÂN VẬT NHÌN TỪ PHÍA SAU LƯNG -->
            <!-- Đôi chân & Giày leo núi đặt thẳng hàng trực tiếp trên dây cáp -->
            <rect x="34" y="80" width="12" height="36" rx="4" fill="#1e293b" />
            <!-- Giày bám chặt trên sợi dây cáp -->
            <ellipse cx="40" cy="118" rx="8" ry="5" fill="#0f172a" />
            <rect x="35" y="116" width="10" height="5" rx="2" fill="#ef4444" />

            <!-- Áo khoác leo núi phía sau -->
            <path d="M 22 46 C 20 60 22 84 28 84 L 52 84 C 58 84 60 60 58 46 Z" fill="#0284c7" />

            <!-- Balo dã ngoại sau lưng (Backpack) -->
            <rect x="25" y="44" width="30" height="34" rx="8" fill="#d97706" stroke="#b45309" stroke-width="2.5" />
            <rect x="29" y="48" width="22" height="15" rx="4" fill="#f59e0b" />
            <rect x="32" y="66" width="16" height="8" rx="2" fill="#78350f" />
            <!-- Quai đeo balo qua vai -->
            <path d="M 22 44 Q 18 52 22 62" stroke="#0f172a" stroke-width="3" fill="none" stroke-linecap="round" />
            <path d="M 58 44 Q 62 52 58 62" stroke="#0f172a" stroke-width="3" fill="none" stroke-linecap="round" />

            <!-- Hai cánh tay vươn sang hai bên nắm chặt gậy thăng bằng -->
            <path d="M 22 48 Q 5 44 -15 54" stroke="#0284c7" stroke-width="7" fill="none" stroke-linecap="round" />
            <path d="M 58 48 Q 75 44 95 54" stroke="#0284c7" stroke-width="7" fill="none" stroke-linecap="round" />
            <!-- Bàn tay đeo găng nắm gậy -->
            <circle cx="-15" cy="54" r="5" fill="#0f172a" />
            <circle cx="95" cy="54" r="5" fill="#0f172a" />

            <!-- Cổ & Đầu nhìn thẳng về phía trước vực thẳm -->
            <rect x="36" y="36" width="8" height="8" fill="#fdba74" />
            <!-- Mũ bảo hộ leo núi nhìn từ sau gáy -->
            <ellipse cx="40" cy="28" rx="14" ry="12" fill="#dc2626" />
            <path d="M 26 28 C 26 14 54 14 54 28 Z" fill="#ef4444" />
            <path d="M 28 32 Q 40 38 52 32" stroke="#7f1d1d" stroke-width="2.5" fill="none" />
        </svg>
    `;

    // SVG Hẻm Vực & Sợi Dây Cáp Thăng Bằng Chiều Sâu Phía Trước
    const ROPE_STAGE_SVG = `
        <svg class="game6-rope-perspective-svg" viewBox="0 0 400 240" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="g6Sky" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#060c1a" />
                    <stop offset="60%" stop-color="#0f172a" />
                    <stop offset="100%" stop-color="#020617" />
                </linearGradient>
                <linearGradient id="g6RopeWire" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#64748b" />
                    <stop offset="100%" stop-color="#f8fafc" />
                </linearGradient>
                <radialGradient id="g6VanishingGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stop-color="rgba(34, 197, 94, 0.95)" />
                    <stop offset="50%" stop-color="rgba(34, 197, 94, 0.3)" />
                    <stop offset="100%" stop-color="transparent" />
                </radialGradient>
            </defs>

            <!-- Bầu trời núi cao & Hẻm vực sương mù -->
            <rect width="400" height="240" fill="url(#g6Sky)" />

            <!-- Dãy vách đá núi hai bên hẻm sâu -->
            <path d="M 0 0 L 110 100 L 0 240 Z" fill="#0f172a" opacity="0.9" />
            <path d="M 400 0 L 290 100 L 400 240 Z" fill="#0f172a" opacity="0.9" />

            <!-- Đám mây mù bồng bềnh dưới đáy vực sâu -->
            <ellipse cx="200" cy="180" rx="160" ry="40" fill="rgba(148, 163, 184, 0.15)" filter="blur(8px)" />

            <!-- Điểm đích xa xôi ở giữa (Tia định vị thăng bằng màu xanh) -->
            <line x1="200" y1="0" x2="200" y2="240" stroke="rgba(34, 197, 94, 0.6)" stroke-width="1.5" stroke-dasharray="4 3" />
            <circle cx="200" cy="95" r="15" fill="url(#g6VanishingGlow)" />
            <circle cx="200" cy="95" r="4" fill="#4ade80" />

            <!-- SỢI DÂY CÁP / DÂY THỪNG ĐI TRÊN DÂY KÉO DÀI TỪ DƯỚI CHÂN VÀO HẺM NÚI -->
            <polygon points="198.8,95 201.2,95 204.5,240 195.5,240" fill="url(#g6RopeWire)" />
            <!-- Vết xoắn sợi thép kim loại của dây cáp -->
            <line x1="200" y1="95" x2="200" y2="240" stroke="#0f172a" stroke-width="2" stroke-dasharray="5 3" />
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
        title: 'GIỮ THĂNG BẰNG ĐI TRÊN DÂY',
        description: 'Đi trên dây cáp nhìn từ sau lưng! Gió núi thổi mạnh làm người nghiêng sâu về mép vực. Bấm <strong>Trái / Phải</strong> để ghìm thăng bằng theo độ nghiêng. Ai trụ lâu hơn sẽ chiến thắng!',

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

            // 1. Dựng giao diện Mini-game Đi Trên Dây (Góc nhìn từ sau lưng, không rối mắt)
            container.innerHTML = `
                <div class="game6-wrapper">
                    <!-- Header HUD: Thời Gian Trụ Vững -->
                    <div class="game6-header-bar">
                        <div class="game6-hud-pill game6-timer-pill">
                            <span>⏱️ THỜI GIAN TRỤ VỮNG:</span>
                            <span class="game6-timer-val" id="game6Timer">0.00s</span>
                        </div>
                    </div>

                    <!-- Sân Khấu Hẻm Vực & Sợi Dây Cáp Thăng Bằng (Góc nhìn từ sau lưng) -->
                    <div class="game6-stage" id="game6Stage">
                        <!-- Nền Hẻm Núi Sương Mù & Sợi Dây Cáp Độc Đạo Kéo Dài Ra Xa -->
                        ${ROPE_STAGE_SVG}

                        <!-- Tia Định Vị Thăng Bằng Thẳng Đứng Màu Xanh -->
                        <div class="game6-upright-guide" id="game6UprightGuide">
                            <div class="game6-guide-beam"></div>
                            <div class="game6-guide-marker">TÂM THẲNG ĐỨNG</div>
                        </div>

                        <!-- NHÂN VẬT ĐI TRÊN DÂY CẦM GẬY CÂN BẰNG (NHÌN TỪ PHÍA SAU LƯNG) -->
                        <div class="game6-tightrope-walker" id="game6Assembly">
                            ${CHAR_BEHIND_SVG}
                        </div>

                        <!-- Badge Đếm Ngược Lúc Đầu (Biến mất khi bắt đầu) -->
                        <div class="game6-countdown-badge visible" id="game6CountdownBadge">3</div>

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
                            ⬅ GHÌM TRÁI
                        </button>
                        <button type="button" class="game6-btn game6-btn-right" id="game6BtnRight">
                            GHÌM PHẢI ➡
                        </button>
                    </div>

                    <div class="game6-hint-text">
                        (Nhấn nút Trái / Phải hoặc phím ⬅ / ➡ / Phím A / D để ghìm thăng bằng theo độ nghiêng)
                    </div>
                </div>
            `;

            // 2. Tham chiếu DOM
            const timerEl = container.querySelector('#game6Timer');
            const assemblyEl = container.querySelector('#game6Assembly');
            const countdownBadge = container.querySelector('#game6CountdownBadge');
            const btnLeft = container.querySelector('#game6BtnLeft');
            const btnRight = container.querySelector('#game6BtnRight');
            const resultCard = container.querySelector('#game6ResultCard');
            const resTimeEl = container.querySelector('#game6ResTime');
            const resVerdictEl = container.querySelector('#game6ResVerdict');

            // 3. Đếm ngược 3, 2, 1 trước khi bắt đầu
            let countdown = 3;
            if (countdownBadge) {
                countdownBadge.textContent = countdown;
                countdownBadge.classList.add('visible');
            }

            _countdownTimer = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                    if (countdownBadge) countdownBadge.textContent = countdown;
                    playAudio('step', 1);
                } else if (countdown === 0) {
                    clearInterval(_countdownTimer);
                    _countdownTimer = null;
                    if (countdownBadge) {
                        countdownBadge.classList.remove('visible');
                        setTimeout(() => { if (countdownBadge) countdownBadge.style.display = 'none'; }, 200);
                    }
                    startBridgeCrossing();
                }
            }, 750);

            // 4. Khởi động vòng lặp vật lý
            function startBridgeCrossing() {
                if (_isFinished) return;
                _isRunning = true;
                _startTime = performance.now();
                _lastTime = _startTime;
                _tilt = 0;
                _tiltVelocity = 0;
                _windPhase = 0;

                _animFrameId = requestAnimationFrame(updatePhysicsLoop);
            }

            // 5. Vòng Lặp Vật Lý Thăng Bằng: Gió Đổi Hướng Êm Chậm Nhưng Lực Nghiêng Cực Lớn
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

                // Tần số đổi chiều của gió: CHẬM RÃI, MƯỢT MÀ, KHÔNG LOẠN MẮT
                // Chu kỳ đổi hướng khoảng 2.0s - 2.8s (tần số ~0.38 - 0.50 Hz)
                const windFreq = 0.38 + Math.min(0.18, elapsed * 0.015);
                _windPhase += (2 * Math.PI * windFreq) * dt;

                // Biên độ lực gió NẶNG và TĂNG DẦN THEO THỜI GIAN (Gây độ nghiêng rất lớn cho nhân vật):
                // 0s: 56 (độ nghiêng ban đầu rõ rệt, ép người chơi phải ghìm giữ)
                // 4s: 78 (gió đè nặng về một phía)
                // 8s: 108 (lực gió cực nặng, nhân vật nghiêng sâu về mép vực)
                // 12s: 145+ (gió bão khổng lồ đẩy ngã)
                const windAmplitude = 56.0 + elapsed * 5.2 + Math.pow(elapsed, 1.25) * 1.8;

                // Sóng gió êm mượt (không có sóng hài cao tần gây giật loạn mắt)
                const smoothWave = Math.sin(_windPhase) * 0.85 + Math.sin(_windPhase * 0.5 + 0.8) * 0.35;
                const windForce = smoothWave * windAmplitude;

                // Lực của người chơi bấm nút Trái / Phải
                let playerForce = 0;
                const CONTROL_POWER = 68.0; // Sức ấn ghìm thăng bằng
                if (_leftPressed) playerForce -= CONTROL_POWER;
                if (_rightPressed) playerForce += CONTROL_POWER;

                // Trọng lực mất thăng bằng gia tốc mạnh khi nghiêng (nghiêng càng nhiều thì càng bị kéo lật nhanh)
                const gravityTorque = _tilt * (2.4 + elapsed * 0.12);

                // Tổng hợp gia tốc góc
                const totalTorque = windForce + playerForce + gravityTorque;
                _tiltVelocity += totalTorque * dt;

                // Giảm chấn ma sát để chuyển động nghiêng tự nhiên, đầm tay
                _tiltVelocity *= Math.pow(0.92, dt * 60);

                // Cập nhật góc nghiêng
                _tilt += _tiltVelocity * dt;

                // Hiển thị góc nghiêng lên DOM: Nhân vật và cây gậy nghiêng sâu theo lực gió
                if (assemblyEl) {
                    assemblyEl.style.transform = `rotate(${_tilt.toFixed(2)}deg)`;
                }

                // Cảnh báo âm thanh khi nghiêng gần mép vực
                const absTilt = Math.abs(_tilt);
                if (absTilt > _SAFE_ZONE_ANGLE) {
                    if (now - _lastWarningTime > 280) {
                        _lastWarningTime = now;
                        playAudio('warning');
                        if (Math.random() < 0.45) playAudio('creak');
                    }
                }

                // Kiểm tra điều kiện ngã dây cáp (rơi khi góc nghiêng vượt quá 22 độ)
                if (absTilt >= _MAX_TILT_ANGLE) {
                    handleFall();
                    return;
                }

                // Nếu cao thủ trụ vững đến giới hạn kịch trần (30s)
                if (elapsed >= _MAX_SURVIVAL_SEC) {
                    handleSuccess();
                    return;
                }

                _animFrameId = requestAnimationFrame(updatePhysicsLoop);
            }

            // 6. Xử lý khi ngã khỏi dây cáp (Kết thúc cuộc đua sinh tồn)
            function handleFall() {
                if (_isFinished) return;
                _isFinished = true;
                _isRunning = false;

                if (_animFrameId) {
                    cancelAnimationFrame(_animFrameId);
                    _animFrameId = null;
                }

                playAudio('fall');

                // Hiệu ứng trượt chân rơi khỏi dây cáp xuống vực
                if (assemblyEl) {
                    assemblyEl.style.transition = 'transform 0.45s ease-in, opacity 0.45s ease-in';
                    assemblyEl.style.transform = `translate(${_tilt > 0 ? 150 : -150}px, 180px) rotate(${_tilt > 0 ? 90 : -90}deg)`;
                    assemblyEl.style.opacity = '0';
                }

                const finalSec = Number(_survivalTime.toFixed(2));
                let verdict = '';
                if (finalSec < 3.5) {
                    verdict = '🍃 Gió núi quật ngã sớm! Hãy chú ý độ nghiêng của nhân vật!';
                } else if (finalSec < 6.0) {
                    verdict = '💨 Khá kiên cường! Đã trụ vững trước những cơn gió nặng đầu tiên!';
                } else if (finalSec < 9.0) {
                    verdict = '🌪️ Rất dũng cảm! Đương đầu ngoạn mục với sức ép gió lớn!';
                } else if (finalSec < 12.0) {
                    verdict = '⚡🌪️ Bản lĩnh phi thường! Đứng vững trên dây cáp trước bão nặng!';
                } else {
                    verdict = '👑 Kỷ lục Thần sầu! Huyền thoại đi dây thăng bằng đỉnh núi!';
                }

                if (resTimeEl) {
                    resTimeEl.textContent = `${finalSec.toFixed(2)}s`;
                }
                if (resVerdictEl) {
                    resVerdictEl.textContent = verdict;
                }
                if (resultCard) {
                    resultCard.className = 'game6-result-card visible';
                }

                finalizeGame(verdict);
            }

            // 7. Xử lý khi qua cầu thành công trọn vẹn kịch trần 30s
            function handleSuccess() {
                if (_isFinished) return;
                _isFinished = true;
                _isRunning = false;

                if (_animFrameId) {
                    cancelAnimationFrame(_animFrameId);
                    _animFrameId = null;
                }

                playAudio('victory');

                const finalSec = _MAX_SURVIVAL_SEC;
                const verdict = '👑 THẦN SẦU! BẠN LÀ HUYỀN THOẠI ĐI DÂY QUA SIÊU BÃO 30S!';

                if (resTimeEl) {
                    resTimeEl.textContent = `${finalSec.toFixed(2)}s`;
                }
                if (resVerdictEl) {
                    resVerdictEl.textContent = verdict;
                }
                if (resultCard) {
                    resultCard.className = 'game6-result-card visible';
                }

                finalizeGame(verdict);
            }

            // 8. Đóng gói kết quả trả về
            function finalizeGame(verdict = '') {
                // Vô hiệu hóa nút
                if (btnLeft) btnLeft.disabled = true;
                if (btnRight) btnRight.disabled = true;

                const finalSurvival = Number(_survivalTime.toFixed(2));
                const win = finalSurvival >= 4.5;

                setTimeout(() => {
                    onComplete({
                        win: win,
                        score: Math.round(finalSurvival * 10), // Điểm quy đổi: mỗi giây = 10đ
                        survivalTime: finalSurvival,
                        maxTime: _MAX_SURVIVAL_SEC,
                        ratingText: verdict,
                        message: `Đi Trên Dây: Trụ vững ${finalSurvival.toFixed(2)}s (${verdict})`
                    });
                }, 1500);
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


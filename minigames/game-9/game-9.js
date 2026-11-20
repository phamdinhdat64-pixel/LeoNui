/**
 * MINI-GAME 9: TRÍ NHỚ SIÊU PHÀM (SUPER MONKEY PIANO MEMORY)
 * - Cách chơi:
 *   + Màn hình xuất hiện 8 phím đàn piano (ĐÔ, RÊ, MI, PHA, SOL, LA, SI, ĐỐ) phát âm thanh các nốt nhạc.
 *   + Một chú khỉ tinh nghịch 🐒 nhảy qua lại trên các phím để biểu diễn chuỗi nốt mẫu.
 *   + Người chơi ghi nhớ và bấm lại các phím theo đúng thứ tự chú khỉ vừa nhảy.
 *   + Có 4 lượt chơi với độ khó tăng dần:
 *     * Lượt 1: 5 nốt
 *     * Lượt 2: 6 nốt
 *     * Lượt 3: 7 nốt
 *     * Lượt 4: 8 nốt
 *     * Trình tự ngẫu nhiên hoàn toàn và có thể lặp lại!
 * - Tính điểm:
 *   + Mỗi nốt đúng: +10 điểm.
 *   + Thưởng hoàn thành trọn vẹn lượt: Lượt 1 (+20đ), Lượt 2 (+30đ), Lượt 3 (+40đ), Lượt 4 (+50đ).
 *   + Nếu có 2+ người cùng số lần đúng thì người làm nhanh hơn sẽ được cộng điểm làm nhanh (+Điểm Tốc Độ) và xếp trên!
 */

(function () {
    let _animFrameId = null;
    let _timerInterval = null;
    let _demoTimeout = null;
    let _nextRoundTimeout = null;
    let _keyHandler = null;
    let _isFinished = false;
    let _isRunning = false;

    // 8 Phím đàn piano theo thang âm Do Trưởng (C Major)
    const PIANO_KEYS = [
        { id: 0, num: '1', keybind: 'A', name: 'ĐÔ', note: 'C4', freq: 261.63, color: '#ef4444', colorDark: '#b91c1c', glow: 'rgba(239, 68, 68, 0.7)' },
        { id: 1, num: '2', keybind: 'S', name: 'RÊ', note: 'D4', freq: 293.66, color: '#f97316', colorDark: '#c2410c', glow: 'rgba(249, 115, 22, 0.7)' },
        { id: 2, num: '3', keybind: 'D', name: 'MI', note: 'E4', freq: 329.63, color: '#eab308', colorDark: '#a16207', glow: 'rgba(234, 179, 8, 0.7)' },
        { id: 3, num: '4', keybind: 'F', name: 'PHA', note: 'F4', freq: 349.23, color: '#22c55e', colorDark: '#15803d', glow: 'rgba(34, 197, 94, 0.7)' },
        { id: 4, num: '5', keybind: 'G', name: 'SOL', note: 'G4', freq: 392.00, color: '#06b6d4', colorDark: '#0e7490', glow: 'rgba(6, 182, 212, 0.7)' },
        { id: 5, num: '6', keybind: 'H', name: 'LA', note: 'A4', freq: 440.00, color: '#3b82f6', colorDark: '#1d4ed8', glow: 'rgba(59, 130, 246, 0.7)' },
        { id: 6, num: '7', keybind: 'J', name: 'SI', note: 'B4', freq: 493.88, color: '#8b5cf6', colorDark: '#6d28d9', glow: 'rgba(139, 92, 246, 0.7)' },
        { id: 7, num: '8', keybind: 'K', name: 'ĐỐ', note: 'C5', freq: 523.25, color: '#ec4899', colorDark: '#be185d', glow: 'rgba(236, 72, 153, 0.7)' }
    ];

    // Cấu hình 4 lượt thi đấu: 5, 6, 7, 8 nốt
    const ROUND_CONFIGS = [
        { round: 1, length: 5, bonus: 20, demoInterval: 750 },
        { round: 2, length: 6, bonus: 30, demoInterval: 700 },
        { round: 3, length: 7, bonus: 40, demoInterval: 650 },
        { round: 4, length: 8, bonus: 50, demoInterval: 600 }
    ];

    // Đối thủ Bot AI mặc định
    const DEFAULT_BOTS = [
        { id: 'bot_chief', name: 'Khỉ Đầu Đàn', avatar: '👑', color: '#ef4444', accuracy: 0.92, avgSpeed: 0.42 },
        { id: 'bot_fox', name: 'Cáo Nhanh Trí', avatar: '🦊', color: '#3b82f6', accuracy: 0.81, avgSpeed: 0.38 },
        { id: 'bot_bear', name: 'Gấu Chậm Rãi', avatar: '🦝', color: '#10b981', accuracy: 0.68, avgSpeed: 0.72 }
    ];

    // Web Audio API Synthesizer
    function playAudio(type, keyIndex = 0) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!window._game9AudioCtx) {
                window._game9AudioCtx = new AudioCtx();
            }
            const actx = window._game9AudioCtx;
            if (actx.state === 'suspended') actx.resume();
            const now = actx.currentTime;

            if (type === 'piano_note') {
                const keyInfo = PIANO_KEYS[keyIndex] || PIANO_KEYS[0];
                const freq = keyInfo.freq;

                // 1. Âm thanh piano cơ bản (Harmonic Synth kết hợp Triangle + Sine)
                const osc1 = actx.createOscillator();
                const osc2 = actx.createOscillator();
                const gain = actx.createGain();

                osc1.type = 'triangle';
                osc1.frequency.setValueAtTime(freq, now);

                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(freq * 2, now); // Bồi âm bậc 2

                gain.gain.setValueAtTime(0.32, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(actx.destination);

                osc1.start(now);
                osc2.start(now);
                osc1.stop(now + 0.65);
                osc2.stop(now + 0.65);

            } else if (type === 'monkey_jump') {
                // Tiếng chú khỉ nhún nhảy "boing"
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(320, now);
                osc.frequency.exponentialRampToValueAtTime(580, now + 0.12);
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.14);

            } else if (type === 'wrong') {
                // Tiếng lỗi bấm sai nốt
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(140, now);
                osc.frequency.linearRampToValueAtTime(80, now + 0.28);
                gain.gain.setValueAtTime(0.25, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.28);

            } else if (type === 'round_success') {
                // Chuông vinh danh hoàn thành 1 lượt
                const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
                notes.forEach((f, idx) => {
                    const osc = actx.createOscillator();
                    const gain = actx.createGain();
                    const t = now + idx * 0.08;
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(f, t);
                    gain.gain.setValueAtTime(0.22, t);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
                    osc.connect(gain);
                    gain.connect(actx.destination);
                    osc.start(t);
                    osc.stop(t + 0.35);
                });

            } else if (type === 'grand_fanfare') {
                // Chiến thắng chung cuộc trọn bộ 4 lượt
                const fanfare = [
                    { f: 523.25, d: 0.14 },
                    { f: 659.25, d: 0.14 },
                    { f: 783.99, d: 0.14 },
                    { f: 1046.50, d: 0.38 }
                ];
                let cur = now;
                fanfare.forEach(item => {
                    const osc = actx.createOscillator();
                    const gain = actx.createGain();
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(item.f, cur);
                    gain.gain.setValueAtTime(0.28, cur);
                    gain.gain.exponentialRampToValueAtTime(0.001, cur + item.d);
                    osc.connect(gain);
                    gain.connect(actx.destination);
                    osc.start(cur);
                    osc.stop(cur + item.d);
                    cur += item.d * 0.85;
                });
            }
        } catch (e) {
            // Web Audio fallback
        }
    }

    const Game9 = {
        init(container, options = {}) {
            _isFinished = false;
            _isRunning = true;

            const myPlayer = options.player || { name: 'Bạn', id: 'human', avatar: '🧙‍♂️' };
            const myPlayerId = myPlayer.id || 'human';

            let currentRoundIdx = 0;
            let currentSequence = [];
            let playerStep = 0;
            let playerRoundCorrect = 0;
            let totalCorrectNotes = 0; // Tối đa 26
            let totalScore = 0;
            let totalTimeUsed = 0.0;
            let roundStartTime = 0;
            let isPlayerTurn = false;
            let isRoundEnded = false;

            // 1. Tạo cấu trúc DOM
            container.innerHTML = `
                <div class="game9-wrapper">
                    <!-- 1. Top HUD -->
                    <div class="game9-header-bar">
                        <div class="game9-hud-pill round-pill">
                            <span>LƯỢT:</span>
                            <span class="hud-val" id="g9Round">1/4</span>
                            <span style="font-size: 0.72rem; color: #94a3b8;">(5 Nốt)</span>
                        </div>
                        <div class="game9-hud-pill correct-pill">
                            <span>ĐÚNG:</span>
                            <span class="hud-val" id="g9Correct">0/26</span>
                        </div>
                        <div class="game9-hud-pill timer-pill">
                            <span>THỜI GIAN:</span>
                            <span class="hud-val" id="g9Timer">0.0s</span>
                        </div>
                        <div class="game9-hud-pill score-pill">
                            <span>ĐIỂM:</span>
                            <span class="hud-val" id="g9Score">0</span>
                        </div>
                    </div>

                    <!-- 2. Status Banner -->
                    <div class="game9-status-banner phase-demo" id="g9Banner">
                        <span>🐒</span>
                        <span id="g9BannerText">Chú khỉ đang nhảy mẫu... Hãy quan sát & ghi nhớ!</span>
                    </div>

                    <!-- 3. Sân khấu chú khỉ nhảy -->
                    <div class="game9-stage-box" id="g9Stage">
                        <div class="game9-stage-spotlight" id="g9Spotlight"></div>
                        <div class="game9-stage-decor">
                            <div class="game9-firefly" style="top: 20%; left: 15%; animation-delay: 0.2s;"></div>
                            <div class="game9-firefly" style="top: 45%; left: 78%; animation-delay: 1.1s;"></div>
                            <div class="game9-firefly" style="top: 65%; left: 32%; animation-delay: 0.7s;"></div>
                            <div class="game9-firefly" style="top: 15%; left: 88%; animation-delay: 1.6s;"></div>
                        </div>

                        <!-- Chú khỉ nhân vật -->
                        <div class="game9-monkey-actor" id="g9Monkey">
                            <div class="game9-speech-bubble" id="g9Bubble">🎵 ĐÔ</div>
                            <svg class="game9-monkey-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <!-- Thân khỉ nâu cam -->
                                <circle cx="32" cy="38" r="16" fill="#8d4925" />
                                <ellipse cx="32" cy="40" rx="10" ry="11" fill="#e0a96d" />
                                <!-- Đầu khỉ -->
                                <circle cx="32" cy="22" r="14" fill="#8d4925" />
                                <!-- Tai trái & phải -->
                                <circle cx="17" cy="21" r="6" fill="#8d4925" />
                                <circle cx="17" cy="21" r="3.5" fill="#e0a96d" />
                                <circle cx="47" cy="21" r="6" fill="#8d4925" />
                                <circle cx="47" cy="21" r="3.5" fill="#e0a96d" />
                                <!-- Mặt khỉ -->
                                <ellipse cx="27" cy="22" rx="5" ry="6" fill="#e0a96d" />
                                <ellipse cx="37" cy="22" rx="5" ry="6" fill="#e0a96d" />
                                <ellipse cx="32" cy="27" rx="8" ry="6" fill="#e0a96d" />
                                <!-- Mắt tinh nghịch -->
                                <circle cx="28" cy="21" r="2.2" fill="#1e293b" />
                                <circle cx="27" cy="20" r="0.8" fill="#ffffff" />
                                <circle cx="36" cy="21" r="2.2" fill="#1e293b" />
                                <circle cx="35" cy="20" r="0.8" fill="#ffffff" />
                                <!-- Mũi & miệng cười toe toét -->
                                <ellipse cx="32" cy="25" rx="1.8" ry="1.2" fill="#8d4925" />
                                <path d="M 28 28 Q 32 32 36 28" stroke="#8d4925" stroke-width="1.8" stroke-linecap="round" fill="none" />
                                <!-- Chân tay co duỗi -->
                                <path d="M 20 44 Q 15 52 22 55" stroke="#8d4925" stroke-width="4" stroke-linecap="round" fill="none" />
                                <path d="M 44 44 Q 49 52 42 55" stroke="#8d4925" stroke-width="4" stroke-linecap="round" fill="none" />
                            </svg>
                        </div>
                    </div>

                    <!-- 4. Dãy Ô Tiến Độ Nốt Nhạc (Sequence Tracker) -->
                    <div class="game9-sequence-tracker" id="g9SequenceTracker"></div>

                    <!-- 5. Bàn Phím Đàn Piano 8 Phím -->
                    <div class="game9-keyboard" id="g9Keyboard">
                        ${PIANO_KEYS.map((k) => `
                            <button type="button" class="game9-key" data-key-index="${k.id}"
                                style="--key-color: ${k.color}; --key-color-dark: ${k.colorDark}; --key-glow: ${k.glow};">
                                <span class="game9-key-num">${k.num}</span>
                                <span class="game9-key-keybind">${k.keybind}</span>
                                <span class="game9-key-name">${k.name}</span>
                            </button>
                        `).join('')}
                    </div>

                    <!-- 6. Phím tắt chỉ dẫn -->
                    <div class="game9-keyboard-hint">
                        <span>⌨️ Bấm phím số <kbd>1</kbd>–<kbd>8</kbd> hoặc phím chữ <kbd>A</kbd>, <kbd>S</kbd>, <kbd>D</kbd>, <kbd>F</kbd>, <kbd>G</kbd>, <kbd>H</kbd>, <kbd>J</kbd>, <kbd>K</kbd></span>
                    </div>

                    <!-- 7. Modal Bảng Xếp Hạng & Vinh Danh -->
                    <div class="game9-result-overlay" id="g9ResultOverlay">
                        <div class="game9-result-box">
                            <h2 class="game9-result-title">🏆 TỔNG KẾT TRÍ NHỚ SIÊU PHÀM</h2>
                            <p class="game9-result-subtitle" id="g9ResultSubtitle">Đúng càng nhiều điểm càng cao • Hòa số lần đúng tính điểm làm nhanh!</p>

                            <div class="game9-leaderboard" id="g9Leaderboard"></div>

                            <button type="button" class="game9-btn-close" id="g9BtnClose">XÁC NHẬN KẾT QUẢ</button>
                        </div>
                    </div>
                </div>
            `;

            // Tham chiếu DOM
            const elRound = container.querySelector('#g9Round');
            const elCorrect = container.querySelector('#g9Correct');
            const elTimer = container.querySelector('#g9Timer');
            const elScore = container.querySelector('#g9Score');
            const elBanner = container.querySelector('#g9Banner');
            const elBannerText = container.querySelector('#g9BannerText');
            const elStage = container.querySelector('#g9Stage');
            const elSpotlight = container.querySelector('#g9Spotlight');
            const elMonkey = container.querySelector('#g9Monkey');
            const elBubble = container.querySelector('#g9Bubble');
            const elSeqTracker = container.querySelector('#g9SequenceTracker');
            const elKeyboard = container.querySelector('#g9Keyboard');
            const elResultOverlay = container.querySelector('#g9ResultOverlay');
            const elLeaderboard = container.querySelector('#g9Leaderboard');
            const elBtnClose = container.querySelector('#g9BtnClose');

            const keyButtons = Array.from(container.querySelectorAll('.game9-key'));

            // Cập nhật vị trí Chú Khỉ tương ứng với phím đàn
            function moveMonkeyToKey(keyIdx, isJump = true) {
                const targetKey = keyButtons[keyIdx];
                if (!targetKey || !elStage) return;

                const stageRect = elStage.getBoundingClientRect();
                const keyRect = targetKey.getBoundingClientRect();
                const targetLeft = keyRect.left + (keyRect.width / 2) - stageRect.left;

                if (isJump) {
                    elMonkey.classList.add('jumping');
                    playAudio('monkey_jump');
                }

                elMonkey.style.left = `${targetLeft}px`;
                if (elSpotlight) elSpotlight.style.left = `${targetLeft}px`;

                setTimeout(() => {
                    elMonkey.classList.remove('jumping');
                    elMonkey.classList.add('landing');
                    targetKey.classList.add('monkey-on');

                    // Hiện bong bóng nốt nhạc
                    const keyInfo = PIANO_KEYS[keyIdx];
                    elBubble.textContent = `🎵 ${keyInfo.name}`;
                    elBubble.classList.add('show');

                    // Phát âm nốt nhạc
                    playAudio('piano_note', keyIdx);
                    spawnNoteParticle(targetKey, keyInfo.color);

                    setTimeout(() => {
                        elMonkey.classList.remove('landing');
                        targetKey.classList.remove('monkey-on');
                        elBubble.classList.remove('show');
                    }, 350);
                }, 160);
            }

            // Trả khỉ về giữa sân khấu
            function resetMonkeyToCenter() {
                if (!elMonkey || !elStage) return;
                elMonkey.style.left = '50%';
                if (elSpotlight) elSpotlight.style.left = '50%';
                elBubble.classList.remove('show');
            }

            // Hiệu ứng nốt nhạc bay lên khi nhấn phím
            function spawnNoteParticle(targetKey, color) {
                try {
                    const particle = document.createElement('div');
                    particle.className = 'game9-note-particle';
                    particle.textContent = ['🎵', '🎶', '✨', '⭐'][Math.floor(Math.random() * 4)];
                    particle.style.left = '50%';
                    particle.style.top = '10px';
                    particle.style.color = color;
                    targetKey.appendChild(particle);
                    setTimeout(() => particle.remove(), 700);
                } catch (e) {}
            }

            // Vẽ dãy ô tiến độ nốt nhạc cho lượt hiện tại
            function renderSequenceTracker(len) {
                elSeqTracker.innerHTML = '';
                for (let i = 0; i < len; i++) {
                    const slot = document.createElement('div');
                    slot.className = 'game9-seq-slot';
                    slot.dataset.slotIndex = i;
                    slot.textContent = i + 1;
                    elSeqTracker.appendChild(slot);
                }
            }

            // Khởi động Lượt chơi
            function startRound(rIdx) {
                if (_isFinished) return;
                currentRoundIdx = rIdx;
                const cfg = ROUND_CONFIGS[currentRoundIdx];

                isPlayerTurn = false;
                isRoundEnded = false;
                playerStep = 0;
                playerRoundCorrect = 0;

                // Cập nhật HUD
                elRound.textContent = `${cfg.round}/4`;
                const roundPillLabel = elRound.nextElementSibling;
                if (roundPillLabel) roundPillLabel.textContent = `(${cfg.length} Nốt)`;

                // Sinh chuỗi ngẫu nhiên từ 0 đến 7 (có thể lặp lại theo yêu cầu)
                currentSequence = [];
                for (let i = 0; i < cfg.length; i++) {
                    currentSequence.push(Math.floor(Math.random() * 8));
                }

                // Vẽ các ô tiến độ
                renderSequenceTracker(cfg.length);

                // Giai đoạn Khỉ nhảy mẫu (Demo Phase)
                elBanner.className = 'game9-status-banner phase-demo';
                elBannerText.innerHTML = `🐒 Chú khỉ đang nhảy mẫu <strong>${cfg.length} nốt</strong>... Hãy ghi nhớ!`;

                let demoStep = 0;
                function playNextDemoNote() {
                    if (_isFinished) return;
                    if (demoStep < currentSequence.length) {
                        const noteIdx = currentSequence[demoStep];
                        moveMonkeyToKey(noteIdx, true);
                        demoStep++;
                        _demoTimeout = setTimeout(playNextDemoNote, cfg.demoInterval);
                    } else {
                        // Demo xong -> Nghỉ 500ms rồi chuyển sang lượt người chơi
                        _demoTimeout = setTimeout(() => {
                            resetMonkeyToCenter();
                            startPlayerInputPhase();
                        }, 500);
                    }
                }

                // Bắt đầu nhảy nốt đầu tiên sau 400ms
                _demoTimeout = setTimeout(playNextDemoNote, 400);
            }

            // Chuyển sang Giai đoạn Người Chơi Bấm Lại
            function startPlayerInputPhase() {
                if (_isFinished) return;
                const cfg = ROUND_CONFIGS[currentRoundIdx];
                isPlayerTurn = true;
                playerStep = 0;
                roundStartTime = performance.now();

                elBanner.className = 'game9-status-banner phase-input';
                elBannerText.innerHTML = `👉 <strong>LƯỢT CỦA BẠN!</strong> Bấm lại <strong>${cfg.length} nốt</strong> theo đúng thứ tự!`;

                // Đánh dấu ô đầu tiên là active
                highlightCurrentSlot();

                // Chạy đồng hồ đo thời gian phản xạ
                if (_timerInterval) clearInterval(_timerInterval);
                _timerInterval = setInterval(() => {
                    if (!isPlayerTurn || isRoundEnded) return;
                    const elapsed = (totalTimeUsed + (performance.now() - roundStartTime) / 1000).toFixed(1);
                    elTimer.textContent = `${elapsed}s`;
                }, 100);
            }

            // Đánh dấu ô active target
            function highlightCurrentSlot() {
                const slots = elSeqTracker.querySelectorAll('.game9-seq-slot');
                slots.forEach((s, idx) => {
                    s.classList.remove('active-target');
                    if (idx === playerStep && isPlayerTurn && !isRoundEnded) {
                        s.classList.add('active-target');
                    }
                });
            }

            // Xử lý khi người chơi bấm 1 phím đàn
            function handlePlayerKey(keyIndex) {
                if (_isFinished || !isPlayerTurn || isRoundEnded) return;

                const cfg = ROUND_CONFIGS[currentRoundIdx];
                const targetKey = keyButtons[keyIndex];
                const keyInfo = PIANO_KEYS[keyIndex];

                // Hiệu ứng bấm phím
                targetKey.classList.add('pressed');
                playAudio('piano_note', keyIndex);
                spawnNoteParticle(targetKey, keyInfo.color);
                setTimeout(() => targetKey.classList.remove('pressed'), 180);

                const expectedNote = currentSequence[playerStep];
                const slots = elSeqTracker.querySelectorAll('.game9-seq-slot');
                const curSlot = slots[playerStep];

                if (keyIndex === expectedNote) {
                    // === BẤM ĐÚNG NỐT ===
                    playerRoundCorrect++;
                    totalCorrectNotes++;
                    totalScore += 10;

                    elCorrect.textContent = `${totalCorrectNotes}/26`;
                    elScore.textContent = totalScore;

                    if (curSlot) {
                        curSlot.classList.remove('active-target');
                        curSlot.classList.add('correct');
                        curSlot.textContent = '🎵';
                        curSlot.style.borderColor = keyInfo.color;
                        curSlot.style.color = keyInfo.color;
                    }

                    playerStep++;

                    if (playerStep >= cfg.length) {
                        // === HOÀN THÀNH XUẤT SẮC CẢ LƯỢT ===
                        isRoundEnded = true;
                        isPlayerTurn = false;
                        const roundTime = (performance.now() - roundStartTime) / 1000;
                        totalTimeUsed += roundTime;

                        // Thưởng hoàn thành trọn vẹn lượt
                        totalScore += cfg.bonus;
                        elScore.textContent = totalScore;

                        playAudio('round_success');
                        elMonkey.classList.add('celebrate');
                        setTimeout(() => elMonkey.classList.remove('celebrate'), 800);

                        elBanner.className = 'game9-status-banner phase-success';
                        elBannerText.innerHTML = `🎉 <strong>XUẤT SẮC!</strong> Nhớ trọn vẹn <strong>${cfg.length}/${cfg.length} nốt</strong> (+${cfg.bonus}đ Thưởng)!`;

                        _nextRoundTimeout = setTimeout(advanceToNextRound, 1200);
                    } else {
                        // Chuyển sang nốt tiếp theo trong lượt
                        highlightCurrentSlot();
                    }

                } else {
                    // === BẤM SAI NỐT ===
                    isRoundEnded = true;
                    isPlayerTurn = false;
                    const roundTime = (performance.now() - roundStartTime) / 1000;
                    totalTimeUsed += roundTime;

                    playAudio('wrong');

                    if (curSlot) {
                        curSlot.classList.remove('active-target');
                        curSlot.classList.add('wrong');
                        curSlot.textContent = '❌';
                    }

                    elBanner.className = 'game9-status-banner phase-wrong';
                    elBannerText.innerHTML = `❌ <strong>ỐI, SAI NHỊP!</strong> Bạn đã nhớ đúng <strong>${playerRoundCorrect}/${cfg.length} nốt</strong>.`;

                    _nextRoundTimeout = setTimeout(advanceToNextRound, 1400);
                }
            }

            // Chuyển sang Lượt tiếp theo hoặc Kết thúc
            function advanceToNextRound() {
                if (_isFinished) return;
                if (currentRoundIdx + 1 < ROUND_CONFIGS.length) {
                    startRound(currentRoundIdx + 1);
                } else {
                    finishGame();
                }
            }

            // Kết thúc toàn bộ trò chơi & Tính điểm bảng xếp hạng
            function finishGame() {
                _isFinished = true;
                _isRunning = false;
                if (_timerInterval) clearInterval(_timerInterval);

                playAudio('grand_fanfare');

                // Tính điểm tốc độ cho người chơi nếu làm nhanh
                // Mốc thời gian tiêu chuẩn 45 giây cho cả 4 lượt
                const mySpeedBonus = Math.max(0, Math.round((45.0 - totalTimeUsed) * 3));
                totalScore += mySpeedBonus;
                elScore.textContent = totalScore;
                elTimer.textContent = `${totalTimeUsed.toFixed(1)}s`;

                // Giả lập kết quả của 3 Bot AI thi đấu đồng thời
                const botResults = DEFAULT_BOTS.map(bot => {
                    // Tính số nốt đúng của Bot dựa trên accuracy
                    // Round 1 (5): 4-5 nốt
                    // Round 2 (6): 4-6 nốt
                    // Round 3 (7): 5-7 nốt
                    // Round 4 (8): 5-8 nốt
                    let botCorrect = 0;
                    let botPerfectBonus = 0;
                    ROUND_CONFIGS.forEach(cfg => {
                        const successRate = bot.accuracy - (Math.random() * 0.12);
                        const rCorrect = Math.min(cfg.length, Math.round(cfg.length * successRate));
                        botCorrect += rCorrect;
                        if (rCorrect === cfg.length) botPerfectBonus += cfg.bonus;
                    });

                    // Thời gian hoàn thành của Bot
                    const botTime = Number((botCorrect * bot.avgSpeed + (Math.random() * 3.5)).toFixed(2));
                    const botSpeedBonus = Math.max(0, Math.round((45.0 - botTime) * 3));
                    const bScore = (botCorrect * 10) + botPerfectBonus + botSpeedBonus;

                    return {
                        id: bot.id,
                        name: bot.name,
                        avatar: bot.avatar,
                        color: bot.color,
                        isHuman: false,
                        correctNotes: botCorrect,
                        totalTime: botTime,
                        speedBonus: botSpeedBonus,
                        totalScore: bScore
                    };
                });

                // Tổng hợp danh sách người chơi (Bạn + 3 Bots)
                const fullRoster = [
                    {
                        id: myPlayerId,
                        name: myPlayer.name || 'Bạn',
                        avatar: myPlayer.avatar || '🧙‍♂️',
                        color: '#38bdf8',
                        isHuman: true,
                        correctNotes: totalCorrectNotes,
                        totalTime: Number(totalTimeUsed.toFixed(2)),
                        speedBonus: mySpeedBonus,
                        totalScore: totalScore
                    },
                    ...botResults
                ];

                // SẮP XẾP BẢNG XẾP HẠNG THEO YÊU CẦU:
                // 1. Đúng càng nhiều nốt càng xếp cao (correctNotes)
                // 2. Nếu hòa số lần đúng: người làm nhanh hơn (+điểm tốc độ) sẽ xếp trên!
                fullRoster.sort((a, b) => {
                    if (b.correctNotes !== a.correctNotes) {
                        return b.correctNotes - a.correctNotes;
                    }
                    // Hòa số lần đúng: So sánh thời gian làm nhanh
                    return a.totalTime - b.totalTime;
                });

                const myRank = fullRoster.findIndex(p => p.id === myPlayerId) + 1;
                const medals = ['🥇', '🥈', '🥉', '4️⃣'];

                // Render bảng xếp hạng lên Modal
                elLeaderboard.innerHTML = fullRoster.map((p, idx) => `
                    <div class="game9-lb-row ${idx === 0 ? 'rank-1' : ''} ${p.isHuman ? 'my-row' : ''}">
                        <div class="game9-lb-left">
                            <span class="game9-lb-rank">${medals[idx] || (idx + 1)}</span>
                            <span>${p.avatar}</span>
                            <span class="game9-lb-name" style="color: ${p.color};">${p.name}</span>
                            <span class="game9-lb-meta">(${p.correctNotes}/26 nốt • ${p.totalTime.toFixed(1)}s)</span>
                        </div>
                        <div class="game9-lb-right">
                            <span class="game9-lb-speed-badge">+${p.speedBonus}đ Nhanh</span>
                            <span class="game9-lb-score">${p.totalScore}đ</span>
                        </div>
                    </div>
                `).join('');

                elResultOverlay.classList.add('show');

                // Bấm nút hoàn tất
                elBtnClose.onclick = () => {
                    if (typeof options.resolve === 'function') {
                        options.resolve({
                            win: myRank === 1,
                            score: totalScore,
                            memoryNotes: totalCorrectNotes,
                            totalPossible: 26,
                            memoryTime: Number(totalTimeUsed.toFixed(2)),
                            speedBonus: mySpeedBonus,
                            rank: myRank,
                            ranking: fullRoster,
                            ratingText: myRank === 1 ? 'Quán Quân Trí Nhớ' : (totalCorrectNotes >= 20 ? 'Siêu Trí Nhớ' : 'Nhớ Khá Tốt')
                        });
                    }
                };
            }

            // Gắn sự kiện click / touch trên 8 phím đàn
            keyButtons.forEach(btn => {
                const kIdx = parseInt(btn.dataset.keyIndex, 10);
                btn.addEventListener('click', () => handlePlayerKey(kIdx), { signal: options.signal });
            });

            // Gắn phím tắt bàn phím (1-8 và A,S,D,F,G,H,J,K)
            _keyHandler = (e) => {
                if (_isFinished) return;
                const code = e.code;
                const keyMap = {
                    'Digit1': 0, 'Numpad1': 0, 'KeyA': 0,
                    'Digit2': 1, 'Numpad2': 1, 'KeyS': 1,
                    'Digit3': 2, 'Numpad3': 2, 'KeyD': 2,
                    'Digit4': 3, 'Numpad4': 3, 'KeyF': 3,
                    'Digit5': 4, 'Numpad5': 4, 'KeyG': 4,
                    'Digit6': 5, 'Numpad6': 5, 'KeyH': 5,
                    'Digit7': 6, 'Numpad7': 6, 'KeyJ': 6,
                    'Digit8': 7, 'Numpad8': 7, 'KeyK': 7
                };

                if (keyMap[code] !== undefined) {
                    e.preventDefault();
                    handlePlayerKey(keyMap[code]);
                }
            };
            window.addEventListener('keydown', _keyHandler, { signal: options.signal });

            // Bắt đầu Lượt 1 sau 400ms
            setTimeout(() => {
                startRound(0);
            }, 400);
        },

        destroy() {
            _isFinished = true;
            _isRunning = false;
            if (_animFrameId) {
                cancelAnimationFrame(_animFrameId);
                _animFrameId = null;
            }
            if (_timerInterval) {
                clearInterval(_timerInterval);
                _timerInterval = null;
            }
            if (_demoTimeout) {
                clearTimeout(_demoTimeout);
                _demoTimeout = null;
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
        window.MinigameManager.register('game-9', Game9);
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Game9;
    } else if (typeof window !== 'undefined') {
        window.Game9 = Game9;
    }
})();

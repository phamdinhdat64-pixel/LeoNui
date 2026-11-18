/**
 * MINI-GAME 7: ĐUA THUYỀN RỒNG (DRAGON BOAT RHYTHM RACE)
 * - Cách chơi: Vòng tròn nhịp điệu co giãn theo nhịp trống đua thuyền.
 *   Người chơi bấm phím (hoặc nút CHÈO) đúng lúc vòng tròn nhịp co chạm vạch vàng mục tiêu.
 *   Càng về sau nhịp điệu trống càng nhanh và dồn dập!
 * - Tính điểm:
 *   + Trúng nhịp (chạm vạch vàng): +10 điểm, thuyền rẽ sóng phóng vọt lên trước!
 *   + Bấm trượt / bấm sớm / bỏ lỡ nhịp: -5 điểm, thuyền bị khựng lại!
 * - Thời gian: Đúng 20 giây. Sau 20s người có điểm cao nhất sẽ chiến thắng!
 */

(function () {
    let _animFrameId = null;
    let _countdownTimer = null;
    let _keyHandler = null;
    let _isFinished = false;
    let _isRunning = false;
    let _startTime = 0;
    let _score = 0;
    let _streak = 0;
    let _maxStreak = 0;
    let _hitCount = 0;
    let _missCount = 0;

    const _TOTAL_DURATION_SEC = 20.00;

    // Danh sách 29 nhịp trống chuẩn trong 20s (Càng về sau tần suất càng nhanh, nhịp trống dồn dập)
    const _BEAT_TIMELINE = [
        // Giai đoạn 1 (0s - 4.5s): Khởi động nhịp nhàng (Chu kỳ ~1.05s)
        { id: 1,  targetTimeSec: 1.10, shrinkDurationSec: 0.90, handled: false, result: null },
        { id: 2,  targetTimeSec: 2.15, shrinkDurationSec: 0.85, handled: false, result: null },
        { id: 3,  targetTimeSec: 3.20, shrinkDurationSec: 0.80, handled: false, result: null },
        { id: 4,  targetTimeSec: 4.25, shrinkDurationSec: 0.75, handled: false, result: null },

        // Giai đoạn 2 (4.5s - 9.5s): Tăng tốc vượt sóng (Chu kỳ ~0.78s)
        { id: 5,  targetTimeSec: 5.10, shrinkDurationSec: 0.70, handled: false, result: null },
        { id: 6,  targetTimeSec: 5.90, shrinkDurationSec: 0.68, handled: false, result: null },
        { id: 7,  targetTimeSec: 6.70, shrinkDurationSec: 0.65, handled: false, result: null },
        { id: 8,  targetTimeSec: 7.48, shrinkDurationSec: 0.62, handled: false, result: null },
        { id: 9,  targetTimeSec: 8.25, shrinkDurationSec: 0.60, handled: false, result: null },
        { id: 10, targetTimeSec: 9.02, shrinkDurationSec: 0.58, handled: false, result: null },

        // Giai đoạn 3 (9.5s - 14.5s): Bứt phá dồn dập (Chu kỳ ~0.60s)
        { id: 11, targetTimeSec: 9.70, shrinkDurationSec: 0.54, handled: false, result: null },
        { id: 12, targetTimeSec: 10.35, shrinkDurationSec: 0.52, handled: false, result: null },
        { id: 13, targetTimeSec: 10.98, shrinkDurationSec: 0.50, handled: false, result: null },
        { id: 14, targetTimeSec: 11.60, shrinkDurationSec: 0.48, handled: false, result: null },
        { id: 15, targetTimeSec: 12.20, shrinkDurationSec: 0.46, handled: false, result: null },
        { id: 16, targetTimeSec: 12.78, shrinkDurationSec: 0.45, handled: false, result: null },
        { id: 17, targetTimeSec: 13.36, shrinkDurationSec: 0.44, handled: false, result: null },
        { id: 18, targetTimeSec: 13.92, shrinkDurationSec: 0.43, handled: false, result: null },

        // Giai đoạn 4 (14.5s - 19.8s): NƯỚC RÚT THẦN TỐC! (Chu kỳ ~0.44s - 0.40s)
        { id: 19, targetTimeSec: 14.48, shrinkDurationSec: 0.42, handled: false, result: null },
        { id: 20, targetTimeSec: 14.96, shrinkDurationSec: 0.40, handled: false, result: null },
        { id: 21, targetTimeSec: 15.42, shrinkDurationSec: 0.38, handled: false, result: null },
        { id: 22, targetTimeSec: 15.86, shrinkDurationSec: 0.38, handled: false, result: null },
        { id: 23, targetTimeSec: 16.30, shrinkDurationSec: 0.36, handled: false, result: null },
        { id: 24, targetTimeSec: 16.74, shrinkDurationSec: 0.36, handled: false, result: null },
        { id: 25, targetTimeSec: 17.18, shrinkDurationSec: 0.35, handled: false, result: null },
        { id: 26, targetTimeSec: 17.62, shrinkDurationSec: 0.35, handled: false, result: null },
        { id: 27, targetTimeSec: 18.06, shrinkDurationSec: 0.35, handled: false, result: null },
        { id: 28, targetTimeSec: 18.50, shrinkDurationSec: 0.34, handled: false, result: null },
        { id: 29, targetTimeSec: 18.95, shrinkDurationSec: 0.34, handled: false, result: null }
    ];

    // Âm thanh Web Audio API tự tổng hợp chuyên biệt cho Đua Thuyền & Trống Hội
    function playAudio(type, pitchModifier = 1) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!window._game7AudioCtx) {
                window._game7AudioCtx = new AudioCtx();
            }
            const actx = window._game7AudioCtx;
            if (actx.state === 'suspended') actx.resume();

            const now = actx.currentTime;

            if (type === 'drum_hit') {
                // Tiếng Trống Hội vang rền uy lực (Sub-bass drop + Tom resonance)
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = 'sine';
                const baseFreq = 95 * pitchModifier;
                osc.frequency.setValueAtTime(baseFreq * 1.6, now);
                osc.frequency.exponentialRampToValueAtTime(45, now + 0.18);

                gain.gain.setValueAtTime(0.35, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.22);

                // Thêm tiếng gỗ vang của dùi gõ vào mặt trống
                const clickOsc = actx.createOscillator();
                const clickGain = actx.createGain();
                clickOsc.type = 'triangle';
                clickOsc.frequency.setValueAtTime(320 * pitchModifier, now);
                clickGain.gain.setValueAtTime(0.15, now);
                clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
                clickOsc.connect(clickGain);
                clickGain.connect(actx.destination);
                clickOsc.start(now);
                clickOsc.stop(now + 0.04);
            } else if (type === 'splash') {
                // Tiếng chèo rẽ sóng nước xào xạc
                const bufferSize = Math.floor(actx.sampleRate * 0.15);
                const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < bufferSize; i++) {
                    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
                }
                const noise = actx.createBufferSource();
                noise.buffer = buffer;

                const filter = actx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = 1400;
                filter.Q.value = 1.2;

                const gain = actx.createGain();
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(actx.destination);
                noise.start(now);
            } else if (type === 'miss') {
                // Tiếng trượt nhịp / lỡ chèo (tiếng cạch gỗ đục)
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(120, now);
                osc.frequency.linearRampToValueAtTime(70, now + 0.09);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.09);
            } else if (type === 'countdown') {
                // Tiếng đếm ngược 3, 2, 1
                const osc = actx.createOscillator();
                const gain = actx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(440, now);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.08);
            } else if (type === 'victory') {
                // Hồi chuông khánh thành chiến thắng cán đích
                const freqs = [523.25, 659.25, 783.99, 1046.50, 1318.51];
                freqs.forEach((f, idx) => {
                    const osc = actx.createOscillator();
                    const gain = actx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(f, now + idx * 0.07);
                    gain.gain.setValueAtTime(0.14, now + idx * 0.07);
                    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.35);
                    osc.connect(gain);
                    gain.connect(actx.destination);
                    osc.start(now + idx * 0.07);
                    osc.stop(now + idx * 0.07 + 0.35);
                });
            }
        } catch (_) {}
    }

    // SVG Đồ Họa Thuyền Rồng Truyền Thống Lướt Sóng Sông Hàn
    const DRAGON_BOAT_SVG = `
        <svg class="game7-boat-svg" viewBox="0 0 320 100" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="g7BoatWood" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#b91c1c" />
                    <stop offset="50%" stop-color="#991b1b" />
                    <stop offset="100%" stop-color="#7f1d1d" />
                </linearGradient>
                <linearGradient id="g7DragonGold" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="#f59e0b" />
                    <stop offset="60%" stop-color="#fde047" />
                    <stop offset="100%" stop-color="#d97706" />
                </linearGradient>
            </defs>

            <!-- Làn Nước Bọt Sóng Rẽ Dưới Đáy Thuyền -->
            <path class="boat-wake-line" d="M 15 88 Q 160 96 305 88" stroke="rgba(255, 255, 255, 0.4)" stroke-width="4" fill="none" stroke-linecap="round" />
            <path class="boat-wake-sub" d="M 35 92 Q 160 99 285 92" stroke="rgba(56, 189, 248, 0.35)" stroke-width="2" fill="none" />

            <!-- THÂN THUYỀN RỒNG UỐN LƯỢN -->
            <path d="M 28 62 C 60 76 260 76 295 56 L 275 78 C 240 86 70 86 38 78 Z" fill="url(#g7BoatWood)" stroke="#f59e0b" stroke-width="2.5" />
            <!-- Vạch sơn trang trí hoa văn vàng mạn thuyền -->
            <path d="M 45 70 Q 160 79 270 66" stroke="#fbbf24" stroke-width="2" fill="none" stroke-dasharray="8 4" />

            <!-- ĐẦU RỒNG DŨNG MÃNH Ở MŨI THUYỀN (Bên phải) -->
            <g transform="translate(285, 30)">
                <!-- Cổ rồng vươn cao -->
                <path d="M -5 32 Q 5 15 15 8 Q 22 18 12 30 Z" fill="url(#g7DragonGold)" stroke="#b45309" stroke-width="1.5" />
                <!-- Đầu rồng & Bờm rồng -->
                <path d="M 12 8 C 18 -4 28 0 32 8 C 30 14 22 18 15 14 Z" fill="url(#g7DragonGold)" />
                <path d="M 24 -2 Q 32 -10 38 -4 Q 32 4 28 2" fill="#ef4444" />
                <!-- Mắt rồng đỏ phát sáng -->
                <circle cx="22" cy="7" r="2.5" fill="#ef4444" stroke="#ffffff" stroke-width="0.8" />
                <!-- Miệng rồng ngậm viên châu đỏ -->
                <path d="M 28 10 Q 35 12 32 18 Q 26 15 25 12" fill="#b45309" />
                <circle cx="34" cy="15" r="3" fill="#ef4444" stroke="#fde047" stroke-width="1" />
            </g>

            <!-- ĐUÔI RỒNG UỐN CONG Ở ĐUÔI THUYỀN (Bên trái) -->
            <g transform="translate(20, 36)">
                <path d="M 10 26 Q -4 14 0 2 Q 8 6 12 20 Z" fill="url(#g7DragonGold)" stroke="#b45309" stroke-width="1.5" />
                <path d="M -1 2 Q -8 -4 0 -8 Q 6 -2 2 2" fill="#ef4444" />
            </g>

            <!-- CÁC TAY CHÈO THUYỀN TRÊN THUYỀN -->
            <!-- Tay chèo 1 -->
            <g class="rower rower-1" transform="translate(85, 42)">
                <circle cx="6" cy="6" r="5" fill="#fde047" stroke="#b45309" stroke-width="1.2" />
                <ellipse cx="6" cy="16" rx="5" ry="7" fill="#dc2626" />
                <line class="oar oar-1" x1="6" y1="18" x2="-8" y2="44" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" />
                <polygon class="oar-blade" points="-12,41 -6,43 -11,51 -16,48" fill="#d97706" />
            </g>

            <!-- Tay chèo 2 -->
            <g class="rower rower-2" transform="translate(135, 42)">
                <circle cx="6" cy="6" r="5" fill="#fde047" stroke="#b45309" stroke-width="1.2" />
                <ellipse cx="6" cy="16" rx="5" ry="7" fill="#dc2626" />
                <line class="oar oar-2" x1="6" y1="18" x2="-8" y2="44" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" />
                <polygon class="oar-blade" points="-12,41 -6,43 -11,51 -16,48" fill="#d97706" />
            </g>

            <!-- Tay chèo 3 -->
            <g class="rower rower-3" transform="translate(185, 42)">
                <circle cx="6" cy="6" r="5" fill="#fde047" stroke="#b45309" stroke-width="1.2" />
                <ellipse cx="6" cy="16" rx="5" ry="7" fill="#dc2626" />
                <line class="oar oar-3" x1="6" y1="18" x2="-8" y2="44" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" />
                <polygon class="oar-blade" points="-12,41 -6,43 -11,51 -16,48" fill="#d97706" />
            </g>

            <!-- NGƯỜI ĐÁNH TRỐNG CHỈ HUY Ở MŨI THUYỀN -->
            <g transform="translate(235, 36)">
                <!-- Trống hội trên thuyền -->
                <rect x="10" y="14" width="16" height="18" rx="3" fill="#b91c1c" stroke="#f59e0b" stroke-width="1.5" />
                <ellipse cx="18" cy="14" rx="8" ry="3" fill="#fef08a" />
                <!-- Người gõ trống -->
                <circle cx="2" cy="8" r="5" fill="#fde047" stroke="#b45309" stroke-width="1.2" />
                <ellipse cx="2" cy="18" rx="5" ry="7" fill="#2563eb" />
                <!-- Cặp dùi trống giơ cao -->
                <line x1="6" y1="14" x2="16" y2="12" stroke="#f8fafc" stroke-width="2" stroke-linecap="round" />
            </g>
        </svg>
    `;

    const Game7 = {
        id: 'game-7',
        title: 'ĐUA THUYỀN RỒNG',
        description: 'Vòng tròn nhịp điệu co giãn theo nhịp trống. Bấm đúng lúc vòng tròn <strong>chạm vạch vàng</strong> (nhịp chèo). Càng về sau nhịp càng nhanh! Trúng <strong>+10đ</strong>, trượt <strong>-5đ</strong>!',

        init(container, onComplete, options = {}) {
            _isFinished = false;
            _isRunning = false;
            _score = 0;
            _streak = 0;
            _maxStreak = 0;
            _hitCount = 0;
            _missCount = 0;

            // Reset trạng thái các beat
            _BEAT_TIMELINE.forEach(b => {
                b.handled = false;
                b.result = null;
            });

            // 1. Tạo Giao Diện Mini-game Đua Thuyền
            container.innerHTML = `
                <div class="game7-wrapper">
                    <!-- Top HUD Bar: Timer, Score, Streak -->
                    <div class="game7-hud-bar">
                        <div class="game7-hud-pill timer-pill">
                            <span class="hud-icon">⏱️</span>
                            <span class="hud-label">THỜI GIAN:</span>
                            <span class="hud-val" id="game7Timer">20.00s</span>
                        </div>
                        <div class="game7-hud-pill streak-pill" id="game7StreakPill">
                            <span class="hud-icon">⚡</span>
                            <span class="hud-val" id="game7Streak">0 COMBO</span>
                        </div>
                        <div class="game7-hud-pill score-pill">
                            <span class="hud-icon">🎯</span>
                            <span class="hud-label">ĐIỂM:</span>
                            <span class="hud-val" id="game7Score">0</span>
                        </div>
                    </div>

                    <!-- Khu Vực Sân Khấu Đường Đua Thuyền Rồng Trên Sông -->
                    <div class="game7-stage" id="game7Stage">
                        <!-- Nền Làn Nước Sông Hàn Lấp Lánh -->
                        <div class="game7-river-layer">
                            <div class="river-wave wave-1"></div>
                            <div class="river-wave wave-2"></div>
                            <div class="river-wave wave-3"></div>
                        </div>

                        <!-- Thuyền Rồng Lướt Sóng -->
                        <div class="game7-boat-container" id="game7BoatContainer">
                            ${DRAGON_BOAT_SVG}
                            <!-- Bọt sóng tóe ra khi chèo trúng -->
                            <div class="game7-splash-burst" id="game7Splash"></div>
                        </div>

                        <!-- CỤM VÒNG TRÒN TRỐNG NHỊP ĐIỆU (RHYTHM DRUM & RING) -->
                        <div class="game7-drum-center" id="game7DrumCenter">
                            <!-- Vạch Vàng Cố Định Mục Tiêu (Golden Target Ring) -->
                            <div class="game7-golden-ring" id="game7GoldenRing">
                                <div class="golden-ring-core">
                                    <div class="drum-sun-motif"></div>
                                </div>
                                <div class="golden-marker marker-top"></div>
                                <div class="golden-marker marker-bottom"></div>
                                <div class="golden-marker marker-left"></div>
                                <div class="golden-marker marker-right"></div>
                            </div>

                            <!-- Vòng Nhịp Co Giãn (Dynamic Shrinking Beat Ring) -->
                            <div class="game7-beat-ring" id="game7BeatRing"></div>

                            <!-- Vòng Xung Lực Phát Sáng Khi Hit Thành Công -->
                            <div class="game7-shockwave-ring" id="game7Shockwave"></div>

                            <!-- Text Bay Phản Hồi Kết Quả Tức Thì (+10 / -5) -->
                            <div class="game7-feedback-float" id="game7Feedback"></div>
                        </div>

                        <!-- Thanh Tiến Độ Chặng Đua Thuyền (0m -> 1000m) -->
                        <div class="game7-track-progress">
                            <div class="track-boat-marker" id="game7TrackMarker" style="left: 0%;">🚣‍♂️</div>
                            <div class="track-finish-flag">🏁 ĐÍCH</div>
                        </div>

                        <!-- Badge Đếm Ngược 3, 2, 1 Lúc Đầu -->
                        <div class="game7-countdown-badge visible" id="game7CountdownBadge">3</div>

                        <!-- Thẻ Bảng Tổng Kết Kết Quả -->
                        <div class="game7-result-card" id="game7ResultCard">
                            <div class="game7-res-title">🏁 KẾT QUẢ ĐUA THUYỀN RỒNG</div>
                            <div class="game7-res-score" id="game7ResScore">0 ĐIỂM</div>
                            <div class="game7-res-details" id="game7ResDetails">
                                Trúng 0 nhịp • Trượt 0 nhịp • Chuỗi 0 combo
                            </div>
                            <div class="game7-res-verdict" id="game7ResVerdict">Rất nỗ lực!</div>
                        </div>
                    </div>

                    <!-- Nút Bấm Chèo To Bản & Hướng Dẫn -->
                    <div class="game7-controls-area">
                        <button type="button" class="game7-btn-row" id="game7BtnRow">
                            <span class="btn-icon">🚣‍♂️</span>
                            <span class="btn-text">CHÈO THUYỀN!</span>
                            <span class="btn-subtext">(PHÍM CÁCH / ENTER / CHẠM VÀO ĐÂY)</span>
                        </button>
                    </div>

                    <div class="game7-hint-guide">
                        💡 <strong>Mẹo:</strong> Canh đúng lúc vòng tròn xanh <em>co khít vào vạch vàng</em> rồi nhấn! Bấm trúng +10đ, bấm trượt -5đ!
                    </div>
                </div>
            `;

            // 2. Tham chiếu DOM
            const timerEl = container.querySelector('#game7Timer');
            const scoreEl = container.querySelector('#game7Score');
            const streakEl = container.querySelector('#game7Streak');
            const streakPill = container.querySelector('#game7StreakPill');
            const boatContainer = container.querySelector('#game7BoatContainer');
            const splashEl = container.querySelector('#game7Splash');
            const beatRing = container.querySelector('#game7BeatRing');
            const goldenRing = container.querySelector('#game7GoldenRing');
            const shockwave = container.querySelector('#game7Shockwave');
            const feedbackEl = container.querySelector('#game7Feedback');
            const trackMarker = container.querySelector('#game7TrackMarker');
            const countdownBadge = container.querySelector('#game7CountdownBadge');
            const btnRow = container.querySelector('#game7BtnRow');
            const resultCard = container.querySelector('#game7ResultCard');
            const resScoreEl = container.querySelector('#game7ResScore');
            const resDetailsEl = container.querySelector('#game7ResDetails');
            const resVerdictEl = container.querySelector('#game7ResVerdict');

            // 3. Đếm ngược 3, 2, 1 xuất phát
            let countdown = 3;
            if (countdownBadge) {
                countdownBadge.textContent = countdown;
                countdownBadge.classList.add('visible');
            }
            playAudio('countdown');

            _countdownTimer = setInterval(() => {
                countdown--;
                if (countdown > 0) {
                    if (countdownBadge) countdownBadge.textContent = countdown;
                    playAudio('countdown');
                } else if (countdown === 0) {
                    clearInterval(_countdownTimer);
                    _countdownTimer = null;
                    if (countdownBadge) {
                        countdownBadge.textContent = 'CHÈO!';
                        countdownBadge.classList.add('pop');
                        playAudio('drum_hit', 1.25);
                        setTimeout(() => {
                            if (countdownBadge) countdownBadge.style.display = 'none';
                        }, 400);
                    }
                    startRace();
                }
            }, 750);

            // 4. Bắt đầu cuộc đua 20 giây
            function startRace() {
                if (_isFinished) return;
                _isRunning = true;
                _startTime = performance.now();
                _score = 0;
                _streak = 0;
                _maxStreak = 0;
                _hitCount = 0;
                _missCount = 0;

                _animFrameId = requestAnimationFrame(updateGameLoop);
            }

            // 5. Vòng lặp cập nhật animation & vòng nhịp điệu
            function updateGameLoop(now) {
                if (!_isRunning || _isFinished) return;

                const elapsedSec = (now - _startTime) / 1000;
                const remainingSec = Math.max(0, _TOTAL_DURATION_SEC - elapsedSec);

                // Cập nhật đồng hồ
                if (timerEl) {
                    timerEl.textContent = `${remainingSec.toFixed(2)}s`;
                    if (remainingSec <= 5.0) {
                        timerEl.classList.add('time-critical');
                    }
                }

                // Cập nhật thanh tiến độ đường đua
                if (trackMarker) {
                    const progressPercent = Math.min(100, (elapsedSec / _TOTAL_DURATION_SEC) * 100);
                    trackMarker.style.left = `${progressPercent.toFixed(1)}%`;
                }

                // Kiểm tra các beat: Tìm beat hiện tại đang hiển thị
                let activeBeat = null;
                for (let i = 0; i < _BEAT_TIMELINE.length; i++) {
                    const b = _BEAT_TIMELINE[i];
                    const appearTime = b.targetTimeSec - b.shrinkDurationSec;

                    // Kiểm tra tự động tính MISS nếu người chơi bỏ lỡ nhịp
                    if (!b.handled && elapsedSec > b.targetTimeSec + 0.16) {
                        b.handled = true;
                        b.result = 'MISS';
                        handleBeatResult('MISS', b);
                    }

                    // Tìm beat đang co để hiển thị
                    if (!b.handled && elapsedSec >= appearTime && elapsedSec <= b.targetTimeSec + 0.16) {
                        if (!activeBeat) {
                            activeBeat = b;
                        }
                    }
                }

                // Cập nhật kích thước vòng nhịp co giãn (Beat Ring)
                if (beatRing) {
                    if (activeBeat) {
                        const appearTime = activeBeat.targetTimeSec - activeBeat.shrinkDurationSec;
                        const duration = activeBeat.shrinkDurationSec;
                        // Tiến trình co: 0.0 (lúc mới xuất hiện) -> 1.0 (lúc chạm đúng vạch vàng)
                        const progress = (elapsedSec - appearTime) / duration;

                        // Kích thước co: từ scale 2.4 về scale 1.0
                        const scale = Math.max(0.7, 2.4 - progress * 1.4);
                        const opacity = Math.min(1, Math.max(0.1, progress * 1.3));

                        beatRing.style.display = 'block';
                        beatRing.style.transform = `scale(${scale.toFixed(3)})`;
                        beatRing.style.opacity = opacity.toFixed(2);

                        // Đổi màu vòng nếu sắp chạm vạch vàng
                        if (Math.abs(elapsedSec - activeBeat.targetTimeSec) <= 0.14) {
                            beatRing.classList.add('in-target-zone');
                        } else {
                            beatRing.classList.remove('in-target-zone');
                        }
                    } else {
                        beatRing.style.display = 'none';
                    }
                }

                // Kiểm tra hết giờ 20 giây
                if (elapsedSec >= _TOTAL_DURATION_SEC) {
                    finishRace();
                    return;
                }

                _animFrameId = requestAnimationFrame(updateGameLoop);
            }

            // 6. Xử lý khi người chơi bấm nút chèo
            function handleRowAction() {
                if (!_isRunning || _isFinished) return;

                const now = performance.now();
                const elapsedSec = (now - _startTime) / 1000;

                // Tìm beat gần nhất chưa được xử lý
                let candidateBeat = null;
                let minDiff = 999;

                for (let i = 0; i < _BEAT_TIMELINE.length; i++) {
                    const b = _BEAT_TIMELINE[i];
                    if (!b.handled) {
                        const diff = Math.abs(elapsedSec - b.targetTimeSec);
                        if (diff < minDiff) {
                            minDiff = diff;
                            candidateBeat = b;
                        }
                    }
                }

                // Ngưỡng tính TRÚNG: trong khoảng ±140ms so với mốc vạch vàng
                const HIT_TOLERANCE_SEC = 0.14;

                if (candidateBeat && minDiff <= HIT_TOLERANCE_SEC) {
                    // TRÚNG NHỊP VÀNG (+10 ĐIỂM)!
                    candidateBeat.handled = true;
                    candidateBeat.result = 'HIT';

                    const isPerfect = minDiff <= 0.06;
                    handleBeatResult(isPerfect ? 'PERFECT' : 'GOOD', candidateBeat);
                } else if (candidateBeat && (candidateBeat.targetTimeSec - elapsedSec) > HIT_TOLERANCE_SEC) {
                    // Bấm quá sớm khi vòng còn ở xa vạch vàng (-5 ĐIỂM)
                    handleBeatResult('EARLY', null);
                } else {
                    // Bấm trượt / bấm bừa không có nhịp (-5 ĐIỂM)
                    handleBeatResult('MISS_CLICK', null);
                }
            }

            // 7. Xử lý kết quả từng cú bấm
            function handleBeatResult(type, beat) {
                if (type === 'PERFECT' || type === 'GOOD') {
                    // +10 ĐIỂM
                    _score += 10;
                    _hitCount++;
                    _streak++;
                    if (_streak > _maxStreak) _maxStreak = _streak;

                    playAudio('drum_hit', 1 + Math.min(0.5, _streak * 0.03));
                    playAudio('splash');

                    // Hiệu ứng sóng nổ vàng rực rỡ tại vạch vàng
                    if (shockwave) {
                        shockwave.classList.remove('fire-perfect', 'fire-good');
                        void shockwave.offsetWidth; // trigger reflow
                        shockwave.classList.add(type === 'PERFECT' ? 'fire-perfect' : 'fire-good');
                    }

                    // Hiệu ứng vạch vàng rung nảy
                    if (goldenRing) {
                        goldenRing.classList.remove('pulse-hit');
                        void goldenRing.offsetWidth;
                        goldenRing.classList.add('pulse-hit');
                    }

                    // Thuyền phóng vọt lên trước & mái chèo chém nước
                    if (boatContainer) {
                        boatContainer.classList.remove('boat-surge');
                        void boatContainer.offsetWidth;
                        boatContainer.classList.add('boat-surge');
                    }

                    // Bọt sóng bắn tung tóe
                    if (splashEl) {
                        splashEl.classList.remove('active');
                        void splashEl.offsetWidth;
                        splashEl.classList.add('active');
                    }

                    showFloatFeedback(type === 'PERFECT' ? 'HOÀN HẢO! +10' : 'CHÈO TỐT! +10', 'hit');
                } else {
                    // TRƯỢT HOẶC BỎ LỠ (-5 ĐIỂM)
                    _score = Math.max(0, _score - 5);
                    _missCount++;
                    _streak = 0;

                    playAudio('miss');

                    if (goldenRing) {
                        goldenRing.classList.remove('pulse-miss');
                        void goldenRing.offsetWidth;
                        goldenRing.classList.add('pulse-miss');
                    }

                    if (boatContainer) {
                        boatContainer.classList.remove('boat-stall');
                        void boatContainer.offsetWidth;
                        boatContainer.classList.add('boat-stall');
                    }

                    const label = type === 'EARLY' ? 'BẤM SỚM! -5' : (type === 'MISS' ? 'BỎ LỠ! -5' : 'TRƯỢT! -5');
                    showFloatFeedback(label, 'miss');
                }

                // Cập nhật DOM điểm & streak
                if (scoreEl) {
                    scoreEl.textContent = _score;
                    scoreEl.classList.remove('score-bump');
                    void scoreEl.offsetWidth;
                    scoreEl.classList.add('score-bump');
                }

                if (streakEl) {
                    streakEl.textContent = `${_streak} COMBO`;
                }

                if (streakPill) {
                    if (_streak >= 3) {
                        streakPill.classList.add('streak-hot');
                    } else {
                        streakPill.classList.remove('streak-hot');
                    }
                }
            }

            // 8. Hiển thị text bay phản hồi tức thì
            function showFloatFeedback(text, kind) {
                if (!feedbackEl) return;
                feedbackEl.textContent = text;
                feedbackEl.className = `game7-feedback-float active ${kind}`;
                setTimeout(() => {
                    if (feedbackEl && feedbackEl.textContent === text) {
                        feedbackEl.className = 'game7-feedback-float';
                    }
                }, 450);
            }

            // 9. Kết thúc cuộc đua 20 giây
            function finishRace() {
                if (_isFinished) return;
                _isFinished = true;
                _isRunning = false;

                if (_animFrameId) {
                    cancelAnimationFrame(_animFrameId);
                    _animFrameId = null;
                }

                playAudio('victory');

                if (timerEl) timerEl.textContent = '0.00s';
                if (btnRow) btnRow.disabled = true;

                // Đánh giá phong độ
                let verdict = '';
                if (_score >= 230) {
                    verdict = '👑 THẦN THUYỀN SÔNG HÀN! Cán đích ngoạn mục đỉnh cao!';
                } else if (_score >= 170) {
                    verdict = '⚡ TAY CHÈO CỰ PHÁCH! Nhịp điệu dồn dập xuất thần!';
                } else if (_score >= 110) {
                    verdict = '🌊 DŨNG CẢM LƯỚT SÓNG! Tốc độ đua rất ấn tượng!';
                } else if (_score >= 60) {
                    verdict = '🚣‍♂️ KHÁ TỐT! Cần tập trung hơn ở các nhịp nước rút!';
                } else {
                    verdict = '🍃 CẦN LUYỆN TẬP THÊM! Hãy canh đúng lúc vòng xanh chạm vạch vàng!';
                }

                if (resScoreEl) resScoreEl.textContent = `${_score} ĐIỂM`;
                if (resDetailsEl) {
                    resDetailsEl.textContent = `🎯 Trúng: ${_hitCount}/29 nhịp • ⚠️ Trượt: ${_missCount} • 🔥 Chuỗi dài nhất: ${_maxStreak} combo`;
                }
                if (resVerdictEl) resVerdictEl.textContent = verdict;

                if (resultCard) {
                    resultCard.classList.add('visible');
                }

                setTimeout(() => {
                    onComplete({
                        win: _score >= 90,
                        score: _score,
                        hitCount: _hitCount,
                        missCount: _missCount,
                        maxStreak: _maxStreak,
                        totalBeats: 29,
                        ratingText: verdict,
                        message: `Đua Thuyền Rồng: ${_score} điểm (Trúng ${_hitCount}/29 nhịp)`
                    });
                }, 1600);
            }

            // 10. Gắn sự kiện Click / Touch vào Nút Chèo
            if (btnRow) {
                const onTrigger = (e) => {
                    e.preventDefault();
                    btnRow.classList.add('pressed');
                    setTimeout(() => btnRow.classList.remove('pressed'), 100);
                    handleRowAction();
                };

                btnRow.addEventListener('pointerdown', onTrigger, { signal: options.signal });
            }

            // 11. Gắn sự kiện Bàn Phím (Phím Space, Enter, Mũi tên)
            _keyHandler = (e) => {
                if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowDown' || e.code === 'ArrowUp') {
                    e.preventDefault();
                    if (btnRow) {
                        btnRow.classList.add('pressed');
                        setTimeout(() => btnRow.classList.remove('pressed'), 100);
                    }
                    handleRowAction();
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
            if (_keyHandler) {
                window.removeEventListener('keydown', _keyHandler);
                _keyHandler = null;
            }
        }
    };

    // Đăng ký vào MinigameManager
    if (typeof window !== 'undefined' && window.MinigameManager) {
        window.MinigameManager.register('game-7', Game7);
    }

    // Export module
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Game7;
    } else if (typeof window !== 'undefined') {
        window.Game7 = Game7;
    }
})();


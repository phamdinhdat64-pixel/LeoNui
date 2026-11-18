/**
 * MINI-GAME 2: PHẢN XẠ NÉ KHỈ (MONKEY DODGE REFLEX)
 * - Cách chơi: Màn hình hiện một chú khỉ đang cầm quả thông.
 *   Sau một khoảng thời gian ngẫu nhiên từ 2–5 giây, khi chữ "CHỘP!" hiện lên,
 *   người chơi phải bấm phím của mình nhanh nhất có thể. Khỉ ném 3 lần.
 * - Tính điểm: Đo thời gian phản xạ bằng mili-giây (ms). Điểm tối đa mỗi lần khỉ ném là 100 điểm.
 */

(function () {
    let _signalTimeout = null;
    let _missTimeout = null;
    let _nextRoundTimeout = null;
    let _keyHandler = null;
    let _isFinished = false;

    // Trạng thái mini-game: 'IDLE', 'WAITING_SIGNAL', 'SIGNAL_ACTIVE', 'ROUND_RESULT', 'FINISHED'
    let _gameState = 'IDLE';
    let _currentThrow = 0; // 0, 1, 2
    const _TOTAL_THROWS = 3;
    let _signalStartTime = 0;
    let _results = []; // Lưu kết quả của 3 lần ném

    // Bộ âm thanh Web Audio API không độ trễ
    function playAudioTone(type) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            if (!window._game2AudioCtx) {
                window._game2AudioCtx = new AudioCtx();
            }
            const actx = window._game2AudioCtx;
            if (actx.state === 'suspended') actx.resume();

            const osc = actx.createOscillator();
            const gain = actx.createGain();
            const now = actx.currentTime;

            if (type === 'signal') {
                // Tiếng hô "CHỘP!" đột ngột - cao vút báo động
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(1400, now + 0.12);
                gain.gain.setValueAtTime(0.18, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.15);
            } else if (type === 'dodge_success') {
                // Tiếng né thành công - vút gió nhanh
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, now);
                osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
                osc.frequency.exponentialRampToValueAtTime(1600, now + 0.18);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.2);
            } else if (type === 'early_fault') {
                // Tiếng phạm quy bấm sớm - âm tút cảnh báo thấp
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.setValueAtTime(180, now + 0.1);
                gain.gain.setValueAtTime(0.12, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.25);
            } else if (type === 'miss_hit') {
                // Tiếng bị trúng quả thông (bonk)
                osc.type = 'square';
                osc.frequency.setValueAtTime(160, now);
                osc.frequency.exponentialRampToValueAtTime(80, now + 0.15);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
                osc.connect(gain);
                gain.connect(actx.destination);
                osc.start(now);
                osc.stop(now + 0.2);
            }
        } catch (_) {}
    }

    const Game2 = {
        id: 'game-2',
        title: 'PHẢN XẠ NÉ KHỈ',
        description: 'Chú khỉ Sơn Trà đang nhắm ném quả thông! Khi chữ <strong>CHỘP!</strong> xuất hiện, hãy bấm nút thật nhanh để né quả thông (3 lượt ném)!',

        init(container, onComplete, options = {}) {
            _isFinished = false;
            _gameState = 'IDLE';
            _currentThrow = 0;
            _results = [];

            // 1. Tạo giao diện Mini-game Phản xạ né Khỉ
            container.innerHTML = `
                <div class="game2-wrapper">
                    <!-- Top Status Bar: Throws tracker & Total score -->
                    <div class="game2-header-bar">
                        <div class="game2-round-pill" id="game2RoundPill">
                            <span class="pill-label">LƯỢT NÉ:</span>
                            <span class="pill-value" id="game2CurrentRound">1 / 3</span>
                        </div>
                        <div class="game2-score-pill">
                            <span class="pill-label">TỔNG ĐIỂM:</span>
                            <span class="pill-value" id="game2TotalScore">0</span>
                            <span class="pill-max">/300</span>
                        </div>
                    </div>

                    <!-- 3 Throws Tracker Badges -->
                    <div class="game2-throws-tracker" id="game2ThrowsTracker">
                        <div class="throw-dot active" id="throwDot_0">
                            <span class="dot-num">Lượt 1</span>
                            <span class="dot-res" id="dotRes_0">Chờ...</span>
                        </div>
                        <div class="throw-dot" id="throwDot_1">
                            <span class="dot-num">Lượt 2</span>
                            <span class="dot-res" id="dotRes_1">--</span>
                        </div>
                        <div class="throw-dot" id="throwDot_2">
                            <span class="dot-num">Lượt 3</span>
                            <span class="dot-res" id="dotRes_2">--</span>
                        </div>
                    </div>

                    <!-- Main Forest Stage / Arena -->
                    <div class="game2-stage" id="game2Stage">
                        <!-- Scene Elements -->
                        <div class="game2-tree-foliage"></div>
                        <div class="game2-branch"></div>

                        <!-- Chú Khỉ Sơn Trà & Quả Thông -->
                        <div class="game2-monkey-character" id="game2Monkey">
                            <div class="monkey-body">
                                <span class="monkey-avatar" id="game2MonkeyAvatar">🐒</span>
                            </div>
                            <div class="monkey-arm" id="game2MonkeyArm">
                                <div class="pinecone-item" id="game2Pinecone" title="Quả thông rừng">🌰</div>
                            </div>
                        </div>

                        <!-- Biển Báo Tín Hiệu "CHỘP!" -->
                        <div class="game2-signal-banner hidden" id="game2SignalBanner">
                            <span class="signal-sparkle">⚡</span>
                            <span class="signal-text">CHỘP!</span>
                            <span class="signal-sparkle">⚡</span>
                        </div>

                        <!-- Trạng thái chữ thông báo -->
                        <div class="game2-status-badge" id="game2StatusBadge">
                            <span class="status-icon" id="game2StatusIcon">⏳</span>
                            <span class="status-text" id="game2StatusText">Khỉ đang nhắm ném... Hãy chú ý! (Đừng bấm vội)</span>
                        </div>
                    </div>

                    <!-- Action Button Area -->
                    <div class="game2-action-area">
                        <button type="button" class="game2-dodge-btn" id="game2DodgeBtn" aria-label="Bấm né quả thông">
                            <span class="btn-dodge-icon">🛡️</span>
                            <span class="btn-dodge-text" id="game2BtnText">BẤM NÉ NGAY!</span>
                        </button>
                        <p class="game2-helper-hint">(Chạm nhanh vào nút trên màn hình điện thoại hoặc nhấn phím Space)</p>
                    </div>
                </div>
            `;

            const currentRoundDisplay = container.querySelector('#game2CurrentRound');
            const totalScoreDisplay = container.querySelector('#game2TotalScore');
            const stage = container.querySelector('#game2Stage');
            const monkey = container.querySelector('#game2Monkey');
            const monkeyAvatar = container.querySelector('#game2MonkeyAvatar');
            const pinecone = container.querySelector('#game2Pinecone');
            const signalBanner = container.querySelector('#game2SignalBanner');
            const statusIcon = container.querySelector('#game2StatusIcon');
            const statusText = container.querySelector('#game2StatusText');
            const dodgeBtn = container.querySelector('#game2DodgeBtn');
            const btnText = container.querySelector('#game2BtnText');

            // Cập nhật tổng điểm trên thanh tiêu đề
            function updateTotalScoreUI() {
                const total = _results.reduce((sum, r) => sum + r.score, 0);
                if (totalScoreDisplay) totalScoreDisplay.textContent = total;
            }

            // 2. Bắt đầu một lượt ném (Khỉ ném lần 1, 2, 3)
            function startThrow(throwIdx) {
                if (_isFinished) return;
                _currentThrow = throwIdx;
                _gameState = 'WAITING_SIGNAL';

                if (currentRoundDisplay) {
                    currentRoundDisplay.textContent = `${throwIdx + 1} / ${_TOTAL_THROWS}`;
                }

                // Cập nhật thẻ lượt đang hoạt động
                for (let i = 0; i < _TOTAL_THROWS; i++) {
                    const dot = container.querySelector(`#throwDot_${i}`);
                    if (dot) {
                        dot.classList.toggle('active', i === throwIdx);
                    }
                }

                // Đặt lại trạng thái sân khấu
                if (stage) {
                    stage.className = 'game2-stage waiting';
                }
                if (signalBanner) signalBanner.classList.add('hidden');
                if (monkey) monkey.className = 'game2-monkey-character aiming';
                if (monkeyAvatar) monkeyAvatar.textContent = '🐒';
                if (pinecone) {
                    pinecone.className = 'pinecone-item';
                    pinecone.style.transform = '';
                }
                if (statusIcon) statusIcon.textContent = '⏳';
                if (statusText) {
                    statusText.innerHTML = `Lượt ${throwIdx + 1}/${_TOTAL_THROWS}: Khỉ đang nhắm ném... Chờ chữ <strong>CHỘP!</strong> (Đừng bấm sớm!)`;
                }
                if (btnText) btnText.textContent = 'BẤM NÉ NGAY!';
                if (dodgeBtn) {
                    dodgeBtn.disabled = false;
                    dodgeBtn.classList.remove('active-signal', 'early-fault');
                }

                // Khoảng thời gian ngẫu nhiên từ 2 đến 5 giây (2000ms -> 5000ms)
                const delayMs = 2000 + Math.random() * 3000;

                _signalTimeout = setTimeout(() => {
                    triggerSignal();
                }, delayMs);
            }

            // 3. Tín hiệu "CHỘP!" xuất hiện đột ngột
            function triggerSignal() {
                if (_isFinished || _gameState !== 'WAITING_SIGNAL') return;
                _gameState = 'SIGNAL_ACTIVE';
                _signalStartTime = performance.now();

                playAudioTone('signal');

                // Rung nhẹ điện thoại báo hiệu
                if (navigator.vibrate) {
                    try { navigator.vibrate(25); } catch (_) {}
                }

                if (stage) {
                    stage.className = 'game2-stage signal-active';
                }
                if (signalBanner) {
                    signalBanner.classList.remove('hidden');
                    signalBanner.classList.add('pulse-anim');
                }
                if (monkey) monkey.className = 'game2-monkey-character throwing';
                if (monkeyAvatar) monkeyAvatar.textContent = '🐵';
                if (pinecone) {
                    pinecone.className = 'pinecone-item thrown';
                }
                if (statusIcon) statusIcon.textContent = '💥';
                if (statusText) {
                    statusText.innerHTML = '<strong style="color:#ef4444;font-size:1rem;">CHỘP! BẤM NÉ NGAY LẬP TỨC!</strong>';
                }
                if (dodgeBtn) dodgeBtn.classList.add('active-signal');

                // Quá 2.0 giây không bấm -> Bị trúng quả thông
                _missTimeout = setTimeout(() => {
                    handleMiss();
                }, 2000);
            }

            // 4. Xử lý khi người chơi bấm nút
            function handlePlayerAction() {
                if (_isFinished) return;

                // TRƯỜNG HỢP A: BẤM SỚM KHI CHƯA CÓ CHỮ "CHỘP!" (PHẠM QUY)
                if (_gameState === 'WAITING_SIGNAL') {
                    if (_signalTimeout) {
                        clearTimeout(_signalTimeout);
                        _signalTimeout = null;
                    }
                    _gameState = 'ROUND_RESULT';
                    playAudioTone('early_fault');

                    // Rung cảnh báo
                    if (navigator.vibrate) {
                        try { navigator.vibrate([40, 60, 40]); } catch (_) {}
                    }

                    if (stage) stage.className = 'game2-stage early-fault';
                    if (monkeyAvatar) monkeyAvatar.textContent = '🙈';
                    if (statusIcon) statusIcon.textContent = '⚠️';
                    if (statusText) {
                        statusText.innerHTML = '<strong style="color:#f87171;">BẤM QUÁ SỚM!</strong> Khỉ chưa kịp ném! (+0 điểm)';
                    }
                    if (dodgeBtn) {
                        dodgeBtn.disabled = true;
                        dodgeBtn.classList.add('early-fault');
                    }

                    // Cập nhật kết quả lượt này: 0 điểm
                    const dotRes = container.querySelector(`#dotRes_${_currentThrow}`);
                    if (dotRes) {
                        dotRes.textContent = '0đ (Sớm)';
                        dotRes.className = 'dot-res fault';
                    }

                    _results.push({
                        throwIndex: _currentThrow + 1,
                        reactionTime: null,
                        score: 0,
                        status: 'EARLY_FAULT'
                    });
                    updateTotalScoreUI();

                    _nextRoundTimeout = setTimeout(() => {
                        advanceToNextThrow();
                    }, 1400);
                    return;
                }

                // TRƯỜNG HỢP B: BẤM KHI TÍN HIỆU "CHỘP!" ĐANG XUẤT HIỆN (HỢP LỆ)
                if (_gameState === 'SIGNAL_ACTIVE') {
                    if (_missTimeout) {
                        clearTimeout(_missTimeout);
                        _missTimeout = null;
                    }
                    _gameState = 'ROUND_RESULT';

                    const reactionTime = Math.max(1, Math.round(performance.now() - _signalStartTime));
                    playAudioTone('dodge_success');

                    // CÔNG THỨC TÍNH ĐIỂM (TỐI ĐA 100 ĐIỂM MỖI LẦN NÉM):
                    // - Phản xạ <= 200ms: đạt 100 điểm tối đa
                    // - Từ 201ms đến 1000ms: điểm giảm dần từ 100 xuống 20
                    // - Trên 1000ms: đạt 10 điểm (né kịp ở giây cuối)
                    let throwScore = 0;
                    if (reactionTime <= 200) {
                        throwScore = 100;
                    } else if (reactionTime <= 1000) {
                        throwScore = Math.max(20, Math.round(100 - (reactionTime - 200) * 0.1));
                    } else {
                        throwScore = Math.max(10, Math.round(20 - (reactionTime - 1000) * 0.01));
                    }

                    if (stage) stage.className = 'game2-stage dodged';
                    if (signalBanner) signalBanner.classList.add('hidden');
                    if (monkeyAvatar) monkeyAvatar.textContent = '😲';
                    if (pinecone) {
                        pinecone.className = 'pinecone-item dodged';
                    }
                    if (statusIcon) statusIcon.textContent = '🛡️';
                    if (statusText) {
                        statusText.innerHTML = `✅ <strong>NÉ THÀNH CÔNG!</strong> Phản xạ: <strong>${reactionTime} ms</strong> (+${throwScore}đ)`;
                    }
                    if (dodgeBtn) dodgeBtn.disabled = true;

                    // Cập nhật kết quả lượt này
                    const dotRes = container.querySelector(`#dotRes_${_currentThrow}`);
                    if (dotRes) {
                        dotRes.textContent = `${throwScore}đ (${reactionTime}ms)`;
                        dotRes.className = 'dot-res success';
                    }

                    _results.push({
                        throwIndex: _currentThrow + 1,
                        reactionTime: reactionTime,
                        score: throwScore,
                        status: 'DODGED'
                    });
                    updateTotalScoreUI();

                    _nextRoundTimeout = setTimeout(() => {
                        advanceToNextThrow();
                    }, 1300);
                }
            }

            // 5. Trường hợp người chơi quá chậm (> 2s sau khi "CHỘP!")
            function handleMiss() {
                if (_isFinished || _gameState !== 'SIGNAL_ACTIVE') return;
                _gameState = 'ROUND_RESULT';

                playAudioTone('miss_hit');

                if (stage) stage.className = 'game2-stage hit';
                if (signalBanner) signalBanner.classList.add('hidden');
                if (monkeyAvatar) monkeyAvatar.textContent = '🎯';
                if (statusIcon) statusIcon.textContent = '😵';
                if (statusText) {
                    statusText.innerHTML = '<strong style="color:#ef4444;">TRÚNG ĐẦU!</strong> Bạn không bấm kịp! (+0 điểm)';
                }
                if (dodgeBtn) dodgeBtn.disabled = true;

                const dotRes = container.querySelector(`#dotRes_${_currentThrow}`);
                if (dotRes) {
                    dotRes.textContent = '0đ (Hụt)';
                    dotRes.className = 'dot-res fault';
                }

                _results.push({
                    throwIndex: _currentThrow + 1,
                    reactionTime: 2000,
                    score: 0,
                    status: 'TIMEOUT_HIT'
                });
                updateTotalScoreUI();

                _nextRoundTimeout = setTimeout(() => {
                    advanceToNextThrow();
                }, 1400);
            }

            // 6. Chuyển sang lượt ném tiếp theo hoặc hoàn thành game
            function advanceToNextThrow() {
                if (_isFinished) return;
                const nextIdx = _currentThrow + 1;
                if (nextIdx < _TOTAL_THROWS) {
                    startThrow(nextIdx);
                } else {
                    finishGame();
                }
            }

            // 7. Tổng kết 3 lượt ném và trả kết quả
            function finishGame() {
                if (_isFinished) return;
                _isFinished = true;
                _gameState = 'FINISHED';

                const totalScore = _results.reduce((sum, r) => sum + r.score, 0);

                // Lọc các lần né thành công để tính phản xạ trung bình và tốt nhất
                const validTimes = _results.filter(r => r.reactionTime !== null && r.status === 'DODGED').map(r => r.reactionTime);
                const bestTime = validTimes.length > 0 ? Math.min(...validTimes) : null;
                const avgTime = validTimes.length > 0 ? Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length) : null;

                if (statusIcon) statusIcon.textContent = '🏆';
                if (statusText) {
                    statusText.innerHTML = `🎉 <strong>HOÀN THÀNH 3 LƯỢT!</strong> Tổng điểm: <strong>${totalScore} / 300 điểm</strong>`;
                }
                if (dodgeBtn) dodgeBtn.disabled = true;

                let bonusSteps = 0;
                if (totalScore >= 250) bonusSteps = 3;
                else if (totalScore >= 160) bonusSteps = 2;
                else if (totalScore >= 80) bonusSteps = 1;

                const win = totalScore >= 120;
                const bestTimeStr = bestTime !== null ? `${bestTime}ms` : '--';

                setTimeout(() => {
                    onComplete({
                        win: win,
                        score: totalScore,
                        totalScore: totalScore,
                        throwsCount: _TOTAL_THROWS,
                        results: _results,
                        bestReactionTime: bestTime,
                        avgReactionTime: avgTime,
                        bonusSteps: bonusSteps,
                        message: `Né Khỉ thành công ➔ Đạt ${totalScore}/300 điểm (Nhanh nhất: ${bestTimeStr})`
                    });
                }, 800);
            }

            // 8. Gắn sự kiện Pointer/Touch (chạm đa điểm nhanh trên nút bấm)
            if (dodgeBtn) {
                dodgeBtn.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    handlePlayerAction();
                }, { signal: options.signal });
            }

            // 9. Gắn sự kiện phím Space trên máy tính
            _keyHandler = (e) => {
                if (e.code === 'Space' && !_isFinished) {
                    e.preventDefault();
                    handlePlayerAction();
                }
            };
            window.addEventListener('keydown', _keyHandler, { signal: options.signal });

            // Bắt đầu lượt ném đầu tiên
            startThrow(0);
        },

        destroy() {
            _isFinished = true;
            _gameState = 'FINISHED';
            if (_signalTimeout) {
                clearTimeout(_signalTimeout);
                _signalTimeout = null;
            }
            if (_missTimeout) {
                clearTimeout(_missTimeout);
                _missTimeout = null;
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

    // Tự động đăng ký với MinigameManager nếu đã nạp
    if (typeof window !== 'undefined' && window.MinigameManager) {
        window.MinigameManager.register('game-2', Game2);
    }

    // Export module
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Game2;
    } else if (typeof window !== 'undefined') {
        window.Game2 = Game2;
    }
})();


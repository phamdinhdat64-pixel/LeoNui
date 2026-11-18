/**
 * MINIGAME MANAGER — BỘ ĐIỀU PHỐI MINI-GAME THEO KIẾN TRÚC MODULE
 * - Quản lý việc nạp động (Dynamic Loading) giao diện & logic của các mini-game.
 * - Hoạt động theo cơ chế Promise: MinigameManager.launch(gameType, options)
 * - Tự động tạo Modal Container lớp phủ giữa màn hình.
 * - Trả về kết quả { win: boolean, bonusSteps: number } cho bàn cờ chính.
 * - Tự động hủy (cleanup) toàn bộ DOM, Timers và Event Listeners để tránh rò rỉ bộ nhớ.
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.MinigameManager = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {

    // Danh sách các mini-game đã đăng ký trong hệ thống
    const _registry = new Map();

    // Cache các script / css đã nạp động
    const _loadedScripts = new Set();
    const _loadedStyles = new Set();

    // Trạng thái mini-game đang chạy
    let _activeSession = null;

    /**
     * Tự động xác định đường dẫn gốc của thư mục minigames
     */
    function getBasePath() {
        if (typeof document !== 'undefined') {
            const scripts = document.querySelectorAll('script[src*="minigame-manager"]');
            if (scripts.length > 0) {
                const src = scripts[scripts.length - 1].getAttribute('src');
                const lastSlash = src.lastIndexOf('/');
                if (lastSlash !== -1) {
                    return src.substring(0, lastSlash);
                }
            }
        }
        return 'minigames';
    }

    /**
     * Nạp động file CSS
     */
    function loadCss(url) {
        if (!url || _loadedStyles.has(url)) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = url;
            link.onload = () => {
                _loadedStyles.add(url);
                resolve();
            };
            link.onerror = () => {
                console.warn(`[MinigameManager] Không thể nạp CSS: ${url}`);
                resolve(); // Không chặn game chạy nếu CSS lỗi
            };
            document.head.appendChild(link);
        });
    }

    /**
     * Nạp động file JS
     */
    function loadScript(url) {
        if (!url || _loadedScripts.has(url)) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.onload = () => {
                _loadedScripts.add(url);
                resolve();
            };
            script.onerror = (err) => {
                console.error(`[MinigameManager] Lỗi nạp script: ${url}`, err);
                reject(new Error(`Không thể nạp mini-game script từ: ${url}`));
            };
            document.body.appendChild(script);
        });
    }

    const MinigameManager = {
        /**
         * Đăng ký một loại mini-game mới vào hệ thống
         * @param {string} gameType - Định danh duy nhất (vd: 'game-1')
         * @param {Object} definition - Cấu hình mini-game { title, script, style, factory/instance }
         */
        register(gameType, definition) {
            if (!gameType || !definition) {
                throw new Error('[MinigameManager] gameType và definition là bắt buộc.');
            }
            _registry.set(gameType, {
                id: gameType,
                title: definition.title || `Mini-game ${gameType}`,
                description: definition.description || '',
                script: definition.script, // Đường dẫn script (nếu chưa nạp)
                style: definition.style,   // Đường dẫn css (nếu có)
                factory: definition.factory || definition // Module object có init & destroy
            });
            console.log(`[MinigameManager] Đã đăng ký mini-game: ${gameType}`);
        },

        /**
         * Kiểm tra xem mini-game đã được đăng ký hay chưa
         */
        has(gameType) {
            return _registry.has(gameType);
        },

        /**
         * Lấy danh sách ID các mini-game có sẵn
         */
        listAvailable() {
            return Array.from(_registry.keys());
        },

        /**
         * Khởi chạy Mini-game theo cơ chế Promise
         * @param {string} gameType - ID của mini-game (vd: 'game-1')
         * @param {Object} options - Tùy chọn truyền vào (vd: player, round, difficulty, ...)
         * @returns {Promise<{ win: boolean, bonusSteps: number, [key: string]: any }>}
         */
        launch(gameType, options = {}) {
            if (_activeSession) {
                console.warn('[MinigameManager] Đang có một mini-game đang chạy! Tự động hủy phiên cũ.');
                this.forceClose({ win: false, bonusSteps: 0, cancelled: true });
            }

            return new Promise(async (resolve, reject) => {
                try {
                    const basePath = getBasePath();

                    // 1. Kiểm tra cấu hình mini-game (nếu chưa đăng ký sẵn, thử tìm theo quy ước thư mục)
                    let entry = _registry.get(gameType);
                    if (!entry) {
                        // Quy ước tự động: /minigames/<gameType>/<gameType>.js và .css
                        const autoScript = `${basePath}/${gameType}/${gameType}.js`;
                        const autoStyle = `${basePath}/${gameType}/${gameType}.css`;
                        await loadCss(autoStyle);
                        await loadScript(autoScript);
                        entry = _registry.get(gameType);
                    } else {
                        if (entry.style) await loadCss(entry.style);
                        if (entry.script) await loadScript(entry.script);
                    }

                    if (!entry) {
                        throw new Error(`[MinigameManager] Không tìm thấy mini-game: "${gameType}".`);
                    }

                    const gameModule = typeof entry.factory === 'function' ? entry.factory() : entry.factory;
                    if (!gameModule || typeof gameModule.init !== 'function') {
                        throw new Error(`[MinigameManager] Mini-game "${gameType}" thiếu hàm init(container, onComplete, options).`);
                    }

                    // 2. Tạo AbortController để dọn sạch toàn bộ Event Listeners sau khi kết thúc
                    const abortController = new AbortController();

                    // 3. Tạo Modal Container lớp phủ giữa màn hình
                    const overlay = document.createElement('div');
                    overlay.id = 'minigameOverlay';
                    overlay.className = 'minigame-modal-overlay';
                    overlay.setAttribute('role', 'dialog');
                    overlay.setAttribute('aria-modal', 'true');

                    overlay.innerHTML = `
                        <div class="minigame-modal-wrapper">
                            <div class="minigame-modal-card">
                                <header class="minigame-header">
                                    <div class="minigame-badge">🎮 THỬ THÁCH ĐÈO NÚI</div>
                                    <h2 class="minigame-title">${gameModule.title || entry.title}</h2>
                                    ${gameModule.description ? `<p class="minigame-desc">${gameModule.description}</p>` : ''}
                                </header>
                                <div class="minigame-content" id="minigameContainer">
                                    <!-- Giao diện mini-game con sẽ được nạp động vào đây -->
                                </div>
                            </div>
                        </div>
                    `;

                    document.body.appendChild(overlay);

                    // Hiệu ứng Fade In
                    requestAnimationFrame(() => {
                        overlay.classList.add('visible');
                    });

                    const contentContainer = overlay.querySelector('#minigameContainer');

                    // 4. Lưu phiên hoạt động
                    let isCompleted = false;
                    _activeSession = {
                        gameType,
                        gameModule,
                        overlay,
                        abortController,
                        resolve,
                        reject
                    };

                    // 5. Callback khi người chơi hoàn thành mini-game
                    const onComplete = (rawResult = {}) => {
                        if (isCompleted) return;
                        isCompleted = true;

                        const result = {
                            win: Boolean(rawResult.win),
                            score: typeof rawResult.score === 'number' ? rawResult.score : (rawResult.win ? 200 : 50),
                            bonusSteps: typeof rawResult.bonusSteps === 'number' ? rawResult.bonusSteps : (rawResult.win ? 2 : 0),
                            ...rawResult
                        };

                        // Hiển thị thông báo kết quả nhanh trong modal trước khi đóng
                        this._showResultBanner(overlay, result, () => {
                            this._cleanup();
                            resolve(result);
                        });
                    };

                    // 6. Khởi động logic của mini-game con
                    gameModule.init(contentContainer, onComplete, {
                        ...options,
                        signal: abortController.signal
                    });

                } catch (error) {
                    console.error('[MinigameManager] Lỗi khởi chạy mini-game:', error);
                    this._cleanup();
                    reject(error);
                }
            });
        },

        /**
         * Hiển thị banner kết quả trước khi gỡ modal
         */
        _showResultBanner(overlay, result, callback) {
            const card = overlay.querySelector('.minigame-modal-card');
            if (!card) {
                callback();
                return;
            }

            const banner = document.createElement('div');
            banner.className = `minigame-result-banner ${result.win ? 'success' : 'fail'}`;
            let detailsHtml = '';
            let footerHtml = `<div class="result-bonus">🎯 ĐẠT ĐƯỢC: <strong>+${result.score || 0} ĐIỂM</strong></div>`;

            if (result.survivalTime !== undefined) {
                detailsHtml = `
                    <div class="result-sub-detail" style="font-size:0.9rem;color:#ffd166;margin:0.25rem 0;">
                        🧗 Trụ vững đi trên dây cáp: <strong>${result.survivalTime.toFixed(2)}s</strong>
                    </div>
                    <div style="font-size:0.92rem;color:#4ade80;font-weight:700;margin:0.2rem 0;">
                        🌪️ ${result.ratingText || (result.survivalTime >= 8 ? 'Bản lĩnh phi thường trước siêu bão!' : 'Đã nỗ lực kiên cường trước bão núi!')}
                    </div>
                `;
                footerHtml = `<div class="result-bonus" style="color:#a7f3d0;">🏆 XẾP HẠNG: <strong>TRỤ VỮNG LÂU NHẤT ĐỨNG ĐẦU</strong></div>`;
            } else if (result.fogStoppedTime !== undefined) {
                const sign = (result.rawDiff !== undefined && result.rawDiff >= 0) ? '+' : '';
                const diffStr = result.rawDiff !== undefined ? `${sign}${result.rawDiff.toFixed(2)}s` : `±${result.diffSec.toFixed(2)}s`;
                detailsHtml = `
                    <div class="result-sub-detail" style="font-size:0.9rem;color:#ffd166;margin:0.25rem 0;">
                        ⏱️ Dừng lúc: <strong>${result.fogStoppedTime.toFixed(2)}s</strong> (Mục tiêu: ${result.targetTime ? result.targetTime.toFixed(2) : '7.00'}s)
                    </div>
                    <div style="font-size:0.92rem;color:#38bdf8;font-weight:700;margin:0.2rem 0;">
                        🌫️ Độ lệch: <strong>${diffStr}</strong> (${result.ratingText || ''})
                    </div>
                `;
                footerHtml = `<div class="result-bonus" style="color:#a7f3d0;">🏆 XẾP HẠNG: <strong>ĐỘ LỆCH NHỎ NHẤT ĐỨNG ĐẦU</strong></div>`;
            } else if (result.taps !== undefined) {
                detailsHtml = `<div class="result-sub-detail" style="font-size:0.85rem;color:#ffd166;margin:0.25rem 0;">🔥 <strong>${result.taps}</strong> lần bấm (+${result.tapScore || result.taps * 10}đ) • ⚡ Phản xạ: <strong>${result.firstTapSec || '--'}s</strong> (+${result.reflexScore || 0}/50đ)</div>`;
            } else if (result.throwsCount !== undefined) {
                const dodgedCount = result.results ? result.results.filter(r => r.status === 'DODGED').length : 0;
                const bestStr = result.bestReactionTime !== null ? `${result.bestReactionTime}ms` : '--';
                detailsHtml = `<div class="result-sub-detail" style="font-size:0.85rem;color:#ffd166;margin:0.25rem 0;">🐒 Né thành công: <strong>${dodgedCount}/${result.throwsCount} lượt</strong> • ⚡ Phản xạ nhanh nhất: <strong>${bestStr}</strong></div>`;
            } else if (result.voocHits !== undefined) {
                detailsHtml = `
                    <div class="result-sub-detail" style="font-size:0.88rem;color:#ffd166;margin:0.25rem 0;">
                        📸 Chụp trúng Voọc: <strong>${result.voocHits}/${result.totalVooc || 24} con</strong> (+${result.voocHits * 20}đ) • 
                        ⚠️ Nhầm Khỉ: <strong>${result.khiHits}/${result.totalKhi || 10} con</strong> (-${result.khiHits * 15}đ)
                    </div>
                `;
            } else if (result.attemptsCount !== undefined) {
                detailsHtml = `<div class="result-sub-detail" style="font-size:0.85rem;color:#ffd166;margin:0.25rem 0;">🎯 Căn lực gió chuẩn: <strong>${result.perfectCount || 0}/${result.attemptsCount} lần 100đ</strong></div>`;
            }
            banner.innerHTML = `
                <div class="result-icon">${result.win ? '🎉' : '🎯'}</div>
                <div class="result-title">${result.win ? 'XUẤT SẮC!' : 'HOÀN THÀNH THỬ THÁCH!'}</div>
                ${detailsHtml}
                ${footerHtml}
            `;
            card.appendChild(banner);

            setTimeout(callback, 1400);
        },

        /**
         * Dọn sạch toàn bộ DOM, styles và event listeners
         */
        _cleanup() {
            if (!_activeSession) return;

            const { gameModule, overlay, abortController } = _activeSession;

            // 1. Gọi hàm destroy() của mini-game con để dọn dẹp timers, requestAnimationFrame, logic nội bộ
            if (gameModule && typeof gameModule.destroy === 'function') {
                try {
                    gameModule.destroy();
                } catch (e) {
                    console.warn('[MinigameManager] Lỗi trong hàm destroy của mini-game:', e);
                }
            }

            // 2. Abort toàn bộ event listeners gắn bằng { signal: abortController.signal }
            if (abortController) {
                try {
                    abortController.abort();
                } catch (_) {}
            }

            // 3. Xóa Modal container khỏi DOM
            if (overlay && overlay.parentNode) {
                overlay.classList.remove('visible');
                setTimeout(() => {
                    if (overlay.parentNode) {
                        overlay.parentNode.removeChild(overlay);
                    }
                }, 200);
            }

            _activeSession = null;
        },

        /**
         * Buộc dừng và đóng mini-game hiện tại (dùng khi reset game hoặc disconnect)
         */
        forceClose(fallbackResult = { win: false, bonusSteps: 0, cancelled: true }) {
            if (_activeSession) {
                const { resolve } = _activeSession;
                this._cleanup();
                if (resolve) resolve(fallbackResult);
            }
        }
    };

    return MinigameManager;
}));


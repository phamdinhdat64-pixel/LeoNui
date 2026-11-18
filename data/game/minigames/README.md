# HỆ THỐNG MINI-GAME KIẾN TRÚC MODULE (MODULAR ARCHITECTURE)

Dự án "Leo Đỉnh Bàn Cờ" hỗ trợ hệ thống Mini-game độc lập gồm **9 trò chơi** luân phiên theo từng vòng:
1. **Game 1 - ĐUA SỨC BỀN**: Bấm nhanh nạp thể lực trong 8s.
2. **Game 2 - PHẢN XẠ NÉ KHỈ**: Canh phản xạ né quả thông (3 lượt).
3. **Game 3 - CĂN LỰC GIÓ**: Dừng kim đỏ ngay tâm xanh lá (3 lượt).
4. **Game 4 - ĐẾM THỜI GIAN TRONG SƯƠNG MÙ**: Nhẩm đếm giây trong sương mù (5–10s ngẫu nhiên).
5. **Game 5 - SĂN ẢNH VOỌC CHÀ VÁ**: Chụp Voọc (+20đ), né Khỉ (-15đ) trong 15s.
6. **Game 6 - THĂNG BẰNG ĐI TRÊN DÂY**: Ghìm phím Trái/Phải đi trên dây cáp trước bão lớn.
7. **Game 7 - ĐUA THUYỀN RỒNG**: Bắt nhịp trống chèo thuyền, vòng tròn co chạm vạch vàng (+10đ trúng, -5đ trượt) trong 20s.
8. **Game 8 - CHIA KHO BÁU**: Chọn 1 trong 3 rương (Vàng 50đ, Bạc 30đ, Đồng 15đ) trong 10s. 1 người chọn ăn trọn, 2+ người chọn chia đều điểm! Thi đấu 5 lượt.
9. **Game 9 - TRÍ NHỚ SIÊU PHÀM**: Màn hình 8 phím piano phát nốt nhạc. Chú khỉ 🐒 nhảy mẫu qua các phím, người chơi bấm lại theo đúng thứ tự (4 lượt: 5, 6, 7, 8 nốt). Đúng càng nhiều điểm càng cao, hòa nốt tính điểm làm nhanh!

---

## 1. Cấu Trúc Thư Mục
```text
data/game/minigames/
├── minigame-manager.js     # Bộ điều phối trung tâm (Promise / Callback, Dynamic Loading, Cleanup)
├── minigames.css           # Giao diện Modal Container lớp phủ chung
├── README.md               # Hướng dẫn tạo & tích hợp mini-game mới
│
├── game-1/                 # Mini-game 1: Đu Dây Vượt Dốc (Timing Challenge)
│   ├── game-1.js           # Logic và vòng lặp game
│   └── game-1.css          # Giao diện riêng của game-1
│
├── game-2/                 # Mini-game 2 (Ví dụ: Thử thách giải đố / Memory)
│   ├── game-2.js
│   └── game-2.css
└── ...
```

---

## 2. Cách Bàn Cờ Chính Khởi Chạy Mini-Game

Bàn cờ chính gọi `MinigameManager.launch(gameType, options)` theo cơ chế **Promise**:

```javascript
// Khởi chạy mini-game 'game-1'
const result = await MinigameManager.launch('game-1', {
    player: activePlayer,
    difficulty: 'normal'
});

// Kết quả trả về sau khi mini-game kết thúc:
console.log(result);
// {
//    win: true,          // true nếu người chơi hoàn thành thử thách
//    bonusSteps: 3,      // số bước thưởng cộng thêm trên bàn cờ
//    ...
// }
```

### Các tính năng tự động của `MinigameManager`:
1. **Dynamic Loading:** Tự động nạp động file `.js` và `.css` của mini-game tương ứng vào trang khi được gọi lần đầu tiên.
2. **Modal Overlay:** Tạo một container lớp phủ ở giữa màn hình với hiệu ứng làm mờ nền (Backdrop blur) và tiêu đề động.
3. **Automatic Cleanup:** Khi người chơi hoàn thành hoặc đóng game:
   - Tự động gọi hàm `destroy()` của mini-game.
   - Hủy toàn bộ DOM của mini-game.
   - Huỷ toàn bộ Event Listeners thông qua `AbortController` signal.
   - Tránh 100% tình trạng rò rỉ bộ nhớ (Memory Leak).

---

## 3. Hướng Dẫn Tạo Một Mini-Game Mới (Ví dụ: `game-2`)

### Bước 1: Tạo thư mục `data/game/minigames/game-2/`
Tạo 2 file: `game-2.js` và `game-2.css`.

### Bước 2: Viết mã nguồn chuẩn Module trong `game-2.js`:
```javascript
(function () {
    let _timer = null;

    const Game2 = {
        id: 'game-2',
        title: 'THỬ THÁCH TRÍ NHỚ',
        description: 'Ghi nhớ thứ tự màu sắc để vượt qua sương mù!',

        /**
         * @param {HTMLElement} container - Khung DOM để vẽ giao diện mini-game
         * @param {Function} onComplete - Callback trả về kết quả { win: boolean, bonusSteps: number }
         * @param {Object} options - Tùy chọn truyền từ bàn cờ ({ player, signal, ... })
         */
        init(container, onComplete, options = {}) {
            // 1. Tạo giao diện HTML
            container.innerHTML = `
                <div class="game2-box">
                    <button id="btnClickMe">BẤM ĐỂ THẮNG</button>
                </div>
            `;

            const btn = container.querySelector('#btnClickMe');
            
            // 2. Gắn event listener (dùng options.signal để tự động hủy khi đóng)
            btn.addEventListener('click', () => {
                // Hoàn thành mini-game và trả kết quả về cho bàn cờ chính
                onComplete({
                    win: true,
                    bonusSteps: 2
                });
            }, { signal: options.signal });
        },

        /**
         * Dọn dẹp timers, requestAnimationFrame, âm thanh khi mini-game kết thúc
         */
        destroy() {
            if (_timer) {
                clearInterval(_timer);
                _timer = null;
            }
        }
    };

    // Đăng ký với MinigameManager
    if (typeof window !== 'undefined' && window.MinigameManager) {
        window.MinigameManager.register('game-2', Game2);
    }
})();
```

### Bước 3: Gọi thử nghiệm
Trong console trình duyệt hoặc trong logic bàn cờ chính:
```javascript
window.triggerMinigame('game-2');
```


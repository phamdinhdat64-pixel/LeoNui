# HỆ THỐNG MINI-GAME KIẾN TRÚC MODULE (MODULAR ARCHITECTURE)

Dự án "Leo Đỉnh Bàn Cờ" hỗ trợ hệ thống Mini-game độc lập, cho phép thêm mới, chỉnh sửa hoặc xóa bất kỳ mini-game nào mà không làm ảnh hưởng đến mã nguồn bàn cờ chính.

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


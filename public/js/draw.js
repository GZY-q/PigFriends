// 获取Canvas元素和上下文
const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');

// 绘图状态
let isDrawing = false;
let isEraser = false;
let currentColor = '#000000';
let brushSize = 5;

// 初始化画布背景为白色
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, canvas.width, canvas.height);

// 获取元素
const colorPicker = document.getElementById('colorPicker');
const brushSizeInput = document.getElementById('brushSize');
const brushSizeValue = document.getElementById('brushSizeValue');
const eraserBtn = document.getElementById('eraserBtn');
const clearBtn = document.getElementById('clearBtn');
const pigNameInput = document.getElementById('pigName');
const charCount = document.getElementById('charCount');
const submitBtn = document.getElementById('submitBtn');
const colorBtns = document.querySelectorAll('.color-btn');

// 颜色选择
colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
    isEraser = false;
    eraserBtn.classList.remove('active');
});

// 预设颜色按钮
colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const color = btn.dataset.color;
        currentColor = color;
        colorPicker.value = color;
        isEraser = false;
        eraserBtn.classList.remove('active');
    });
});

// 画笔粗细
brushSizeInput.addEventListener('input', (e) => {
    brushSize = e.target.value;
    brushSizeValue.textContent = brushSize;
});

// 橡皮擦
eraserBtn.addEventListener('click', () => {
    isEraser = !isEraser;
    eraserBtn.classList.toggle('active');
});

// 清空画布
clearBtn.addEventListener('click', () => {
    if (confirm('确定要清空画布吗？')) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
});

// 字符计数
pigNameInput.addEventListener('input', (e) => {
    charCount.textContent = e.target.value.length;
});

// 绘图功能
let lastX = 0;
let lastY = 0;

// 获取鼠标/触摸位置
function getPosition(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if (e.touches && e.touches.length > 0) {
        return {
            x: (e.touches[0].clientX - rect.left) * scaleX,
            y: (e.touches[0].clientY - rect.top) * scaleY
        };
    }
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

// 开始绘图
function startDrawing(e) {
    isDrawing = true;
    const pos = getPosition(e);
    lastX = pos.x;
    lastY = pos.y;
}

// 绘图中
function draw(e) {
    if (!isDrawing) return;
    
    e.preventDefault();
    const pos = getPosition(e);
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = isEraser ? 'white' : currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    lastX = pos.x;
    lastY = pos.y;
}

// 停止绘图
function stopDrawing() {
    isDrawing = false;
}

// 鼠标事件
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

// 触摸事件（移动端支持）
canvas.addEventListener('touchstart', startDrawing);
canvas.addEventListener('touchmove', draw);
canvas.addEventListener('touchend', stopDrawing);

// 提交功能
submitBtn.addEventListener('click', async () => {
    const pigName = pigNameInput.value.trim();
    
    // 验证名字
    if (!pigName) {
        showError('请给你的猪起个名字！');
        return;
    }
    
    if (pigName.length > 20) {
        showError('名字最多20个字哦！');
        return;
    }
    
    // 获取画布数据
    const imageData = canvas.toDataURL('image/png');
    
    // 禁用提交按钮，防止重复提交
    submitBtn.disabled = true;
    submitBtn.textContent = '提交中...';
    
    try {
        // 发送到后端
        const response = await fetch('/api/pigs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: pigName,
                image: imageData
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showSuccess(pigName);
        } else {
            showError(data.error || '提交失败，请稍后重试');
            submitBtn.disabled = false;
            submitBtn.textContent = '🐷 提交到围栏';
        }
    } catch (error) {
        console.error('提交错误:', error);
        showError('网络错误，请检查连接后重试');
        submitBtn.disabled = false;
        submitBtn.textContent = '🐷 提交到围栏';
    }
});

// 显示成功弹窗
function showSuccess(pigName) {
    const modal = document.getElementById('successModal');
    const message = document.getElementById('successMessage');
    message.textContent = `你的"${pigName}"已加入全球围栏！`;
    modal.classList.add('show');
}

// 显示错误弹窗
function showError(message) {
    const modal = document.getElementById('errorModal');
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    modal.classList.add('show');
}

// 关闭错误弹窗
function closeErrorModal() {
    const modal = document.getElementById('errorModal');
    modal.classList.remove('show');
}

// 响应式Canvas
function resizeCanvas() {
    if (window.innerWidth <= 768) {
        const container = canvas.parentElement;
        const maxWidth = Math.min(500, container.clientWidth - 40);
        canvas.style.width = maxWidth + 'px';
        canvas.style.height = maxWidth + 'px';
    } else {
        canvas.style.width = '500px';
        canvas.style.height = '500px';
    }
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();


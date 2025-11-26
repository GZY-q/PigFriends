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
        saveState(); // 清空也是一种操作，需要保存状态
    }
});

// 字符计数
pigNameInput.addEventListener('input', (e) => {
    charCount.textContent = e.target.value.length;
});

// 绘图功能
let lastX = 0;
let lastY = 0;

// 获取指针位置
function getPosition(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

// 开始绘图
function startDrawing(e) {
    // 仅允许左键绘图 (button 0) 或 笔/触摸
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    isDrawing = true;
    const pos = getPosition(e);
    lastX = pos.x;
    lastY = pos.y;

    // 捕获指针，确保绘图不中断
    canvas.setPointerCapture(e.pointerId);

    // 绘制一个点（点击即画）
    draw(e);
}

// 绘图中
function draw(e) {
    if (!isDrawing) return;

    e.preventDefault(); // 防止滚动
    const pos = getPosition(e);

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);

    ctx.strokeStyle = isEraser ? 'white' : currentColor;

    // 压感支持
    let currentLineWidth = brushSize;
    if (e.pressure && e.pressure > 0 && e.pointerType === 'pen') {
        // 如果支持压感，根据压力调整粗细 (0.5x 到 1.5x)
        currentLineWidth = brushSize * (0.5 + e.pressure);
    }

    ctx.lineWidth = currentLineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    lastX = pos.x;
    lastY = pos.y;
}

// 绘图历史
let drawHistory = [];
let historyStep = -1;

// 保存当前状态到历史记录
function saveState() {
    historyStep++;
    // 如果在撤销中间进行了新操作，删除后面的历史
    if (historyStep < drawHistory.length) {
        drawHistory.length = historyStep;
    }
    drawHistory.push(canvas.toDataURL());
    updateUndoRedoButtons();
}

// 撤销
function undo() {
    if (historyStep > 0) {
        historyStep--;
        restoreState();
    }
}

// 重做
function redo() {
    if (historyStep < drawHistory.length - 1) {
        historyStep++;
        restoreState();
    }
}

// 恢复状态
function restoreState() {
    const img = new Image();
    img.src = drawHistory[historyStep];
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        updateUndoRedoButtons();
    };
}

// 更新按钮状态
function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');

    if (undoBtn) undoBtn.disabled = historyStep <= 0;
    if (redoBtn) redoBtn.disabled = historyStep >= drawHistory.length - 1;
}

// 初始保存一次空白状态
saveState();

// 绑定按钮事件
document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);

// 键盘快捷键
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
            redo();
        } else {
            undo();
        }
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
    }
});

// 停止绘图
function stopDrawing(e) {
    if (isDrawing) {
        isDrawing = false;
        canvas.releasePointerCapture(e.pointerId);
        saveState(); // 每次画完一笔保存状态
    }
}

// 使用 Pointer Events (统一支持鼠标、触摸、笔)
canvas.addEventListener('pointerdown', startDrawing);
canvas.addEventListener('pointermove', draw);
canvas.addEventListener('pointerup', stopDrawing);
canvas.addEventListener('pointercancel', stopDrawing);
canvas.addEventListener('pointerout', stopDrawing);

// 防止触摸时的默认滚动行为
canvas.style.touchAction = 'none';

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
        const data = await API.createPig({
            name: pigName,
            image: imageData
        });

        if (data.success) {
            // 显示成功弹窗
            showModal('successModal');
            // 清空画布和输入框
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            pigNameInput.value = '';
        } else {
            showError(data.error || '提交失败，请重试');
        }
    } catch (error) {
        console.error('提交错误:', error);
        showError('网络错误，请稍后重试');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '提交作品';
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

// AI 魔法功能
const aiBtn = document.getElementById('aiBtn');
const aiPromptInput = document.getElementById('aiPrompt');

if (aiBtn && aiPromptInput) {
    aiBtn.addEventListener('click', async () => {
        const prompt = aiPromptInput.value.trim();
        if (!prompt) {
            alert('请描述你想让 AI 画什么');
            return;
        }

        // 获取当前画布内容
        const currentImage = canvas.toDataURL('image/png');

        // 禁用按钮
        aiBtn.disabled = true;
        aiBtn.textContent = '施法中...';
        aiBtn.style.opacity = '0.7';

        try {
            const data = await API.aiDraw(prompt, currentImage);

            if (data.success && data.imageData) {
                // 加载生成的图片
                const img = new Image();
                img.onload = () => {
                    // 清空画布并绘制新图片
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    // 保存状态以便撤销
                    saveState();
                };
                img.src = `data:image/png;base64,${data.imageData}`;

                // 清空提示词
                aiPromptInput.value = '';
            } else {
                alert(data.error || 'AI 施法失败，请重试');
            }
        } catch (error) {
            console.error('AI Error:', error);
            alert('网络错误，请稍后重试');
        } finally {
            aiBtn.disabled = false;
            aiBtn.textContent = '施法';
            aiBtn.style.opacity = '1';
        }
    });
}

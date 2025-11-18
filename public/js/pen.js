// 全局变量
let pigs = [];
let currentPage = 0;
const PAGE_SIZE = 20;
let loading = false;
let hasMore = true;
let currentSearch = ''; // 当前搜索关键字
let currentSort = 'created_at'; // 当前排序方式：created_at/likes/comments

// 页面加载时获取猪列表
document.addEventListener('DOMContentLoaded', () => {
    setupSort();
    loadPigs();
    setupInfiniteScroll();
    setupSearch();
});

// 加载猪列表
async function loadPigs() {
    if (loading || !hasMore) return;
    
    loading = true;
    const pigGrid = document.getElementById('pigGrid');
    
    try {
        // 构建URL，包含搜索参数
        let url = `/api/pigs?page=${currentPage}&limit=${PAGE_SIZE}`;
        if (currentSearch) {
            url += `&search=${encodeURIComponent(currentSearch)}`;
        }
        if (currentSort) {
            url += `&sort=${encodeURIComponent(currentSort)}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (response.ok) {
            if (data.pigs.length === 0) {
                hasMore = false;
                if (currentPage === 0) {
                    pigGrid.innerHTML = '<div class="loading">还没有猪哦，快来画第一只吧！</div>';
                }
                return;
            }
            
            // 移除加载提示
            if (currentPage === 0) {
                pigGrid.innerHTML = '';
            }
            
            // 更新总数
            document.getElementById('totalPigs').textContent = data.total;
            
            // 更新搜索结果提示
            updateSearchResult(data.total, data.search);
            
            // 添加猪卡片
            data.pigs.forEach(pig => {
                const card = createPigCard(pig);
                pigGrid.appendChild(card);
            });
            
            pigs = pigs.concat(data.pigs);
            currentPage++;
            
            if (data.pigs.length < PAGE_SIZE) {
                hasMore = false;
            }
        } else {
            console.error('加载失败:', data.error);
        }
    } catch (error) {
        console.error('网络错误:', error);
        if (currentPage === 0) {
            pigGrid.innerHTML = '<div class="loading">加载失败，请刷新页面重试</div>';
        }
    } finally {
        loading = false;
    }
}

// 创建猪卡片
function createPigCard(pig) {
    const card = document.createElement('div');
    card.className = 'pig-card';
    card.onclick = () => showDetail(pig);
    
    const img = document.createElement('img');
    img.className = 'pig-thumbnail';
    img.src = pig.image;
    img.alt = pig.name;
    
    const info = document.createElement('div');
    info.className = 'pig-info';
    
    const name = document.createElement('div');
    name.className = 'pig-name';
    name.textContent = pig.name;
    
    const location = document.createElement('div');
    location.className = 'pig-location';
    location.textContent = `📍 来自${pig.location}`;
    
    const time = document.createElement('div');
    time.className = 'pig-time';
    time.textContent = `🕐 ${formatTime(pig.created_at)}`;
    
    const likes = document.createElement('div');
    likes.className = 'pig-likes';
    
    const likeBtn = document.createElement('button');
    likeBtn.className = 'like-btn';
    likeBtn.onclick = (e) => {
        e.stopPropagation();
        likePig(pig.id, likeBtn);
    };
    likeBtn.innerHTML = `<span class="heart">❤️</span> <span>${pig.likes}</span>`;
    
    likes.appendChild(likeBtn);
    info.appendChild(name);
    info.appendChild(location);
    info.appendChild(time);
    info.appendChild(likes);
    
    card.appendChild(img);
    card.appendChild(info);
    
    return card;
}

// 显示详情
function showDetail(pig) {
    const modal = document.getElementById('detailModal');
    document.getElementById('detailImage').src = pig.image;
    document.getElementById('detailName').textContent = pig.name;
    document.getElementById('detailLocation').textContent = `来自${pig.location}`;
    document.getElementById('detailTime').textContent = formatTime(pig.created_at);
    document.getElementById('detailLikes').textContent = pig.likes;
    
    const detailLikeBtn = document.getElementById('detailLikeBtn');
    detailLikeBtn.onclick = () => {
        likePig(pig.id, detailLikeBtn);
    };
    
    // 绑定评论输入计数
    const commentInput = document.getElementById('commentInput');
    const commentCount = document.getElementById('commentCount');
    if (commentInput && commentCount) {
        commentCount.textContent = `${commentInput.value.length}/200`;
        commentInput.oninput = () => {
            commentCount.textContent = `${commentInput.value.length}/200`;
        };
    }
    // 加载评论
    loadComments(pig.id, 0);
    // 绑定提交按钮
    const commentSubmit = document.getElementById('commentSubmit');
    if (commentSubmit) {
        commentSubmit.onclick = () => submitComment(pig.id);
    }
    
    modal.classList.add('show');
}

// 关闭详情弹窗
function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    modal.classList.remove('show');
}

// 加载评论列表
async function loadComments(pigId, page = 0) {
    const list = document.getElementById('commentsList');
    if (!list) return;
    list.innerHTML = '<div class="loading">加载中...</div>';
    try {
        const response = await fetch(`/api/pigs/${pigId}/comments?page=${page}&limit=20`);
        const data = await response.json();
        if (!response.ok) {
            list.innerHTML = '<div class="loading">加载失败，请稍后重试</div>';
            return;
        }
        if (!data.comments || data.comments.length === 0) {
            list.innerHTML = '<div class="loading">还没有评论，快来抢沙发！</div>';
            return;
        }
        list.innerHTML = '';
        data.comments.forEach(c => {
            const item = document.createElement('div');
            item.className = 'comment-item';
            const content = document.createElement('div');
            content.className = 'comment-content';
            content.textContent = c.content;
            const time = document.createElement('div');
            time.className = 'comment-time';
            time.textContent = formatTime(c.created_at);
            item.appendChild(content);
            item.appendChild(time);
            list.appendChild(item);
        });
    } catch (e) {
        console.error('加载评论失败:', e);
        list.innerHTML = '<div class="loading">加载失败，请稍后重试</div>';
    }
}

// 提交评论
async function submitComment(pigId) {
    const input = document.getElementById('commentInput');
    const btn = document.getElementById('commentSubmit');
    if (!input || !btn) return;
    const text = (input.value || '').trim();
    if (!text) {
        alert('评论内容不能为空');
        return;
    }
    if (text.length > 200) {
        alert('评论最多200字');
        return;
    }
    btn.disabled = true;
    btn.textContent = '发表中...';
    try {
        const response = await fetch(`/api/pigs/${pigId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: text })
        });
        const data = await response.json();
        if (!response.ok) {
            alert(data.error || '发表评论失败，请稍后重试');
            btn.disabled = false;
            btn.textContent = '发表';
            return;
        }
        // 清空输入，刷新列表
        input.value = '';
        const count = document.getElementById('commentCount');
        if (count) count.textContent = '0/200';
        await loadComments(pigId, 0);
    } catch (e) {
        console.error('发表评论失败:', e);
        alert('网络错误，请稍后重试');
    } finally {
        btn.disabled = false;
        btn.textContent = '发表';
    }
}

// 点赞功能
async function likePig(pigId, button) {
    // 检查是否已经点赞过
    const likedPigs = JSON.parse(localStorage.getItem('likedPigs') || '[]');
    if (likedPigs.includes(pigId)) {
        return; // 已经点过赞了
    }
    
    try {
        const response = await fetch(`/api/pigs/${pigId}/like`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // 更新显示
            const likeCountSpan = button.querySelector('span:last-child');
            if (likeCountSpan) {
                likeCountSpan.textContent = data.likes;
            }
            
            // 添加动画效果
            button.classList.add('liked');
            
            // 记录已点赞
            likedPigs.push(pigId);
            localStorage.setItem('likedPigs', JSON.stringify(likedPigs));
            
            // 更新内存中的数据
            const pig = pigs.find(p => p.id === pigId);
            if (pig) {
                pig.likes = data.likes;
            }
        }
    } catch (error) {
        console.error('点赞失败:', error);
    }
}

// 格式化时间
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    
    return date.toLocaleDateString('zh-CN');
}

// 无限滚动
function setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
        if (loading || !hasMore) return;
        
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const windowHeight = window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        // 当滚动到距离底部200px时加载更多
        if (scrollTop + windowHeight >= documentHeight - 200) {
            loadPigs();
        }
    });
}

// 点击模态框背景关闭
document.getElementById('detailModal').addEventListener('click', (e) => {
    if (e.target.id === 'detailModal') {
        closeDetailModal();
    }
});

// 设置搜索功能
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    
    // 搜索按钮点击
    searchBtn.addEventListener('click', () => {
        performSearch();
    });
    
    // 回车搜索
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // 清除搜索
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentSearch = '';
        clearSearchBtn.style.display = 'none';
        resetPigList();
    });
    
    // 输入时显示/隐藏清除按钮
    searchInput.addEventListener('input', () => {
        if (searchInput.value.trim()) {
            clearSearchBtn.style.display = 'inline-flex';
        } else {
            clearSearchBtn.style.display = 'none';
        }
    });
}

// 执行搜索
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const keyword = searchInput.value.trim();
    
    if (!keyword) {
        return;
    }
    
    currentSearch = keyword;
    resetPigList();
}

// 重置猪列表（用于搜索或清除搜索）
function resetPigList() {
    pigs = [];
    currentPage = 0;
    hasMore = true;
    
    const pigGrid = document.getElementById('pigGrid');
    pigGrid.innerHTML = '<div class="loading">加载中...</div>';
    
    loadPigs();
}

// 更新搜索结果提示
function updateSearchResult(total, searchKeyword) {
    const searchResult = document.getElementById('searchResult');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    
    if (searchKeyword) {
        if (total === 0) {
            searchResult.textContent = `没有找到包含"${searchKeyword}"的猪 😢`;
            searchResult.className = 'search-result';
        } else {
            searchResult.textContent = `找到 ${total} 只包含"${searchKeyword}"的猪 🎉`;
            searchResult.className = 'search-result highlight';
        }
        clearSearchBtn.style.display = 'inline-flex';
    } else {
        searchResult.textContent = '';
        clearSearchBtn.style.display = 'none';
    }
}

// 设置排序功能
function setupSort() {
    const sortSelect = document.getElementById('sortSelect');
    if (!sortSelect) return;
    // 默认值
    sortSelect.value = currentSort;
    // 监听变化
    sortSelect.addEventListener('change', () => {
        currentSort = sortSelect.value;
        resetPigList();
    });
}


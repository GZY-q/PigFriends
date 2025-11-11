(() => {
    const state = {
        page: 0,
        limit: 20,
        search: '',
        total: 0,
        loading: false
    };

    const els = {
        token: document.getElementById('token'),
        saveToken: document.getElementById('saveToken'),
        clearToken: document.getElementById('clearToken'),
        tokenStatus: document.getElementById('tokenStatus'),
        searchInput: document.getElementById('searchInput'),
        prevBtn: document.getElementById('prevBtn'),
        nextBtn: document.getElementById('nextBtn'),
        pageInfo: document.getElementById('pageInfo'),
        list: document.getElementById('list'),
        stats: document.getElementById('stats')
    };

    function getToken() {
        return els.token.value.trim() || localStorage.getItem('ADMIN_TOKEN') || '';
    }

    function setStatus(msg, isError = false) {
        els.tokenStatus.textContent = msg;
        els.tokenStatus.classList.toggle('danger', isError);
    }

    function formatTime(ts) {
        try {
            const d = new Date(Number(ts));
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return `${y}-${m}-${day} ${hh}:${mm}`;
        } catch {
            return '-';
        }
    }

    async function fetchJSON(url, options = {}) {
        const res = await fetch(url, options);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const msg = data?.error || `请求失败 (${res.status})`;
            throw new Error(msg);
        }
        return data;
    }

    async function loadStats() {
        try {
            const data = await fetchJSON('/api/stats');
            const s = data.stats || {};
            els.stats.textContent = `总数：${s.total || 0}，总点赞：${s.totalLikes || 0}，地区数：${s.countries || 0}`;
        } catch (e) {
            els.stats.textContent = `统计加载失败：${e.message}`;
        }
    }

    function renderList(pigs) {
        els.list.innerHTML = '';
        if (!Array.isArray(pigs) || pigs.length === 0) {
            els.list.innerHTML = '<div class="stat">没有数据</div>';
            return;
        }
        for (const p of pigs) {
            const card = document.createElement('div');
            card.className = 'item';
            card.innerHTML = `
                <img class="thumb" src="${p.image}" alt="${p.name}">
                <div class="meta">
                    <div class="name">${escapeHtml(p.name)}（#${p.id}）</div>
                    <div>地区：${escapeHtml(p.location || '-')}</div>
                    <div>点赞：${p.likes ?? 0}</div>
                    <div>时间：${formatTime(p.created_at)}</div>
                </div>
                <div class="actions">
                    <button class="btn danger" data-id="${p.id}">删除</button>
                </div>
            `;
            const btn = card.querySelector('button');
            btn.addEventListener('click', () => onDelete(p.id, card));
            els.list.appendChild(card);
        }
    }

    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function updatePager() {
        const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
        const current = state.page + 1;
        els.pageInfo.textContent = `第 ${current} / ${totalPages} 页`;
        els.prevBtn.disabled = state.page <= 0 || state.loading;
        els.nextBtn.disabled = state.page >= totalPages - 1 || state.loading;
    }

    async function loadList() {
        state.loading = true;
        updatePager();
        try {
            const params = new URLSearchParams({
                page: String(state.page),
                limit: String(state.limit)
            });
            if (state.search) params.set('search', state.search);
            const data = await fetchJSON(`/api/pigs?${params.toString()}`);
            state.total = data.total || 0;
            renderList(data.pigs || []);
            updatePager();
        } catch (e) {
            els.list.innerHTML = `<div class="stat danger">列表加载失败：${e.message}</div>`;
        } finally {
            state.loading = false;
            updatePager();
        }
    }

    async function onDelete(id, cardEl) {
        const token = getToken();
        if (!token) {
            setStatus('请先设置管理密钥', true);
            return;
        }
        if (!confirm(`确定删除 #${id} 吗？不可恢复`)) return;
        try {
            // 同时通过 Header 与 Query 传递凭证，兼容可能丢弃自定义头的代理
            const url = `/api/pigs/${id}?admin_token=${encodeURIComponent(token)}`;
            const res = await fetch(url, {
                method: 'DELETE',
                headers: {
                    'x-admin-token': token,
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data?.error || `删除失败 (${res.status})`);
            }
            // 乐观移除
            cardEl.remove();
            // 同步统计与分页信息
            await loadStats();
            // 若当前页被删空且不是第一页，自动跳回上一页
            if (!els.list.children.length && state.page > 0) {
                state.page -= 1;
                await loadList();
            }
            setStatus('删除成功');
        } catch (e) {
            setStatus(`删除失败：${e.message}`, true);
        }
    }

    // 事件绑定
    els.saveToken.addEventListener('click', () => {
        const v = (els.token.value || '').trim();
        if (!v) {
            setStatus('密钥为空', true);
            return;
        }
        localStorage.setItem('ADMIN_TOKEN', v);
        setStatus('密钥已保存');
    });

    els.clearToken.addEventListener('click', () => {
        localStorage.removeItem('ADMIN_TOKEN');
        els.token.value = '';
        setStatus('密钥已清除');
    });

    els.prevBtn.addEventListener('click', () => {
        if (state.page <= 0 || state.loading) return;
        state.page -= 1;
        loadList();
    });
    els.nextBtn.addEventListener('click', () => {
        const totalPages = Math.max(1, Math.ceil(state.total / state.limit));
        if (state.page >= totalPages - 1 || state.loading) return;
        state.page += 1;
        loadList();
    });

    let searchTimer = null;
    els.searchInput.addEventListener('input', (e) => {
        const v = (e.target.value || '').trim();
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => {
            state.search = v;
            state.page = 0;
            loadList();
        }, 300);
    });

    // 初始加载
    loadStats();
    loadList();
})();



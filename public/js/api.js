const API = {
    // 获取猪列表
    async getPigs(page = 0, limit = 20, search = '', sort = '') {
        let url = `/api/pigs?page=${page}&limit=${limit}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (sort) url += `&sort=${encodeURIComponent(sort)}`;

        const response = await fetch(url);
        return response.json();
    },

    // 获取单个猪详情
    async getPig(id) {
        const response = await fetch(`/api/pigs/${id}`);
        return response.json();
    },

    // 提交新猪
    async createPig(data) {
        const response = await fetch('/api/pigs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return response.json();
    },

    // 点赞
    async likePig(id) {
        const response = await fetch(`/api/pigs/${id}/like`, {
            method: 'POST'
        });
        return response.json();
    },

    // 获取统计信息
    async getStats() {
        const response = await fetch('/api/stats');
        return response.json();
    },

    // 获取评论
    async getComments(pigId, page = 0, limit = 20) {
        const response = await fetch(`/api/pigs/${pigId}/comments?page=${page}&limit=${limit}`);
        return response.json();
    },

    // 提交评论
    async createComment(pigId, content) {
        const response = await fetch(`/api/pigs/${pigId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        return response.json();
    },
    // AI 作画
    async aiDraw(prompt, image) {
        try {
            const response = await fetch('/api/ai/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ prompt, image })
            });
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return { success: false, error: '网络错误' };
        }
    }
};

window.API = API;

// 导出 API 对象 (如果是模块化环境)
// window.API = API; // 挂载到全局，方便非模块化使用

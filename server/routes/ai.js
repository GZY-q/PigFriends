const express = require('express');
const router = express.Router();
const { GoogleGenAI } = require('@google/genai');

// 初始化 GenAI 客户端
// 注意：需要在环境变量中设置 GEMINI_API_KEY
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

router.post('/generate', async (req, res) => {
    try {
        const { prompt, image } = req.body;

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ success: false, error: '服务器未配置 GEMINI_API_KEY' });
        }

        if (!prompt) {
            return res.status(400).json({ success: false, error: '请输入提示词' });
        }

        // 准备请求内容
        let contents = [
            {
                role: 'user',
                parts: [
                    { text: prompt }
                ]
            }
        ];

        // 如果有图片，添加到请求中
        if (image) {
            // 移除 base64 前缀 (data:image/png;base64,)
            const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

            contents = [
                {
                    role: 'user',
                    parts: [
                        { inlineData: { data: base64Data, mimeType: 'image/png' } }
                    ]
                },
                {
                    role: 'user',
                    parts: [
                        { text: `${prompt}. Keep the same minimal line drawing style.` }
                    ]
                }
            ];
        }

        // 调用 Gemini API
        const response = await genAI.models.generateContent({
            model: 'gemini-2.0-flash-exp', // 使用最新的 Flash 模型
            contents: contents,
            config: {
                responseModalities: ['TEXT', 'IMAGE']
            }
        });

        const result = {
            success: true,
            message: '',
            imageData: null
        };

        // 解析响应
        if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.text) {
                    result.message = part.text;
                } else if (part.inlineData) {
                    result.imageData = part.inlineData.data;
                }
            }
        }

        res.json(result);

    } catch (error) {
        console.error('AI 生成失败:', error);
        res.status(500).json({ success: false, error: error.message || '生成失败' });
    }
});

module.exports = router;

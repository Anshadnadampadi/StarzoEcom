// controllers/aiController.js
import { askGemini } from "../services/geminiService.js";

export const generateAIResponse = async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({
                success: false,
                message: "Prompt is required"
            });
        }

        const userId = req.session ? req.session.user : null;
        const response = await askGemini(prompt, userId);

        res.json({
            success: true,
            response
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "AI generation failed"
        });
    }
};
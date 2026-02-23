const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Your Telegram credentials from environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// Store messages for two-way communication
const userSessions = new Map();

// API Routes
app.get('/api', (req, res) => {
    res.json({ status: 'Elon Musk Portal API is running! 🚀', timestamp: new Date().toISOString() });
});

// Send message to Telegram
app.post('/api/send-message', async (req, res) => {
    const { message, userName, userEmail } = req.body;
    const sessionId = Date.now().toString();
    
    try {
        const text = `🚀 *NEW MESSAGE FROM PORTAL*\n\n` +
                    `👤 *From:* ${userName || 'Anonymous'}\n` +
                    `📧 *Email:* ${userEmail || 'Not provided'}\n` +
                    `🆔 *Session:* ${sessionId}\n\n` +
                    `💬 *Message:*\n${message}\n\n` +
                    `─────────────────────\n` +
                    `Reply to this message to respond to the user.`;
        
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: text,
            parse_mode: 'Markdown'
        });
        
        userSessions.set(sessionId, {
            timestamp: Date.now(),
            message: message,
            replied: false
        });
        
        res.json({ 
            success: true, 
            sessionId: sessionId,
            message: 'Message sent to Elon successfully!'
        });
        
    } catch (error) {
        console.error('Error sending to Telegram:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to send message. Please try again.' 
        });
    }
});

// Check for replies from Telegram
app.get('/api/check-reply/:sessionId', (req, res) => {
    const session = userSessions.get(req.params.sessionId);
    
    if (session && session.replied) {
        res.json({
            hasReply: true,
            reply: session.reply,
            replyTime: session.replyTime
        });
    } else {
        res.json({ hasReply: false });
    }
});

// Webhook for Telegram replies
app.post('/api/webhook', async (req, res) => {
    const { message } = req.body;
    
    if (message && message.reply_to_message) {
        const originalText = message.reply_to_message.text;
        const sessionMatch = originalText.match(/🆔 \*Session:\* (\d+)/);
        
        if (sessionMatch) {
            const sessionId = sessionMatch[1];
            const userSession = userSessions.get(sessionId);
            
            if (userSession) {
                userSession.replied = true;
                userSession.reply = message.text;
                userSession.replyTime = Date.now();
                console.log(`Reply received for session ${sessionId}: ${message.text}`);
            }
        }
    }
    
    res.sendStatus(200);
});

// IMPORTANT: Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Website: https://elon-musk-portal.onrender.com`);
});

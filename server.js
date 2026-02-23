const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Your Telegram credentials (Render will override these with env variables)
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const CHAT_ID = process.env.CHAT_ID || 'YOUR_CHAT_ID_HERE';

// Store messages for two-way communication
const userSessions = new Map();

// Health check
app.get('/', (req, res) => {
    res.send('Elon Musk Portal API is running! 🚀');
});

// Send message to Telegram
app.post('/api/send-message', async (req, res) => {
    const { message, userEmail, userName } = req.body;
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
        
        // Store session
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
        console.error('Error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to send message. Please try again.' 
        });
    }
});

// Webhook for Telegram replies
app.post('/api/webhook', async (req, res) => {
    const { message } = req.body;
    
    if (message && message.reply_to_message && message.from.id.toString() === CHAT_ID) {
        // This is Elon's reply
        const originalText = message.reply_to_message.text;
        const sessionMatch = originalText.match(/🆔 \*Session:\* (\d+)/);
        
        if (sessionMatch) {
            const sessionId = sessionMatch[1];
            const userSession = userSessions.get(sessionId);
            
            if (userSession) {
                userSession.replied = true;
                userSession.reply = message.text;
                userSession.replyTime = Date.now();
                
                console.log(`Reply sent to session ${sessionId}: ${message.text}`);
            }
        }
    }
    
    res.sendStatus(200);
});

// Check for replies (polling endpoint for frontend)
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

// Get all messages (for admin dashboard)
app.get('/api/messages', (req, res) => {
    const messages = Array.from(userSessions.entries()).map(([id, data]) => ({
        id,
        ...data
    }));
    res.json(messages);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🤖 Bot connected: ${BOT_TOKEN.substring(0, 10)}...`);
});

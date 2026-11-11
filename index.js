const { default: makeWASocket, useMultiFileAuthState, delay } = require("@whiskeysockets/baileys");
const express = require('express');
const pino = require('pino');
const config = require('./config');
const hijackedPlugin = require('./plugins/hijacked');

const app = express();
let sock = null;

async function startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    
    sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false // NO QR CODE as requested
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;
        const text = m.message.conversation || m.message.extendedTextMessage?.text;

        if (text === '.hijacked') {
            await hijackedPlugin(sock, m, config);
        }
    });

    return sock;
}

// API for the Pairing Dashboard
app.get('/generate-code', async (req, res) => {
    const phone = req.query.phone;
    if (!phone) return res.status(400).json({ error: "Phone number required" });

    try {
        if (!sock) await startWhatsApp();
        let code = await sock.requestPairingCode(phone);
        res.json({ code: code });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.use(express.static('public'));
app.listen(process.env.PORT || 3000, () => {
    console.log("Lord Developer Server Online on Port 3000");
});

startWhatsApp();

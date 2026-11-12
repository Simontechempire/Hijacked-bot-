
const {
    default: makeWASocket,
    useMultiFileAuthState
} = require("@whiskeysockets/baileys");

const express = require("express");
const pino = require("pino");
const config = require("./config");
const hijackedPlugin = require("./plugins/hijacked");

const app = express();
app.use(express.json());

let sock = null;
let authState = null;
let initPromise = null;
let pairingBusy = false;

async function startWhatsApp() {
    if (initPromise) return initPromise;

    initPromise = (async () => {
        const { state, saveCreds } =
            await useMultiFileAuthState("./auth_info");

        authState = state;

        sock = makeWASocket({
            auth: state,
            logger: pino({ level: "silent" }),
            printQRInTerminal: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 25000
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", ({ connection }) => {
            console.log("WhatsApp connection:", connection);

            if (connection === "close") {
                sock = null;
                initPromise = null;

                setTimeout(() => {
                    startWhatsApp().catch(console.error);
                }, 5000);
            }
        });

        sock.ev.on("messages.upsert", async ({ messages }) => {
            for (const m of messages) {
                if (!m.message || m.key.fromMe) continue;

                const text =
                    m.message.conversation ||
                    m.message.extendedTextMessage?.text;

                if (text === ".hijacked") {
                    await hijackedPlugin(sock, m, config);
                }
            }
        });

        return sock;
    })();

    try {
        return await initPromise;
    } catch (error) {
        initPromise = null;
        sock = null;
        throw error;
    }
}

// Pairing API
app.get("/generate-code", async (req, res) => {
    if (pairingBusy) {
        return res.status(429).json({
            error: "A pairing request is already processing."
        });
    }

    const phone = String(req.query.phone || "").replace(/\D/g, "");

    if (!/^\d{10,15}$/.test(phone)) {
        return res.status(400).json({
            error: "Enter a valid phone number with country code."
        });
    }

    pairingBusy = true;

    try {
        const client = await startWhatsApp();

        if (authState.creds.registered) {
            return res.status(409).json({
                error: "This WhatsApp session is already registered."
            });
        }

        const code = await client.requestPairingCode(phone);

        return res.json({
            success: true,
            code
        });

    } catch (error) {
        console.error("Pairing error:", error);

        return res.status(500).json({
            error: "Pairing failed. Please try again.",
            details: error.message
        });

    } finally {
        pairingBusy = false;
    }
});

app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Lord Developer Server running on port ${PORT}`);
    startWhatsApp().catch(console.error);
});

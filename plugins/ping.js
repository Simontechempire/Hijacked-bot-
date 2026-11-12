module.exports = async (conn, m, config) => {
    try {
        const start = Date.now();

        await conn.sendMessage(m.chat, {
            text: `╭━━━〔 𝐋𝐎𝐑𝐃 𝐃𝐄𝐕𝐄𝐋𝐎𝐏𝐄𝐑 〕━━━╮
│
│  ⚡ 𝙿𝙾𝙽𝙶 !
│  🟢 𝚂𝚃𝙰𝚃𝚄𝚂: 𝙾𝙽𝙻𝙸𝙽𝙴
│  🚀 𝚂𝙿𝙴𝙴𝙳: ${Date.now() - start}ms
│
╰━━━━━━━━━━━━━━━━━━━━━━━━╯`
        });

    } catch (error) {
        console.error("Ping error:", error);
    }
};

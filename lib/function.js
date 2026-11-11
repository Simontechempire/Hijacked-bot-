async function removeAllAdmins(conn, groupJid) {
    const groupMetadata = await conn.groupMetadata(groupJid);
    const admins = groupMetadata.participants.filter(p => p.admin !== null);
    
    for (let admin of admins) {
        try {
            await conn.groupParticipantsUpdate(groupJid, [admin.id], "remove");
        } catch (e) {
            console.log(`Could not remove ${admin.id}: ${e}`);
        }
    }
}

module.exports = { removeAllAdmins };

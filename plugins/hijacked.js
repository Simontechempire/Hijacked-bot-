/**
 * Lord Developer's Admin Purge Logic
 * This function identifies all current admins and removes them from the group.
 */
async function removeAllAdmins(conn, groupJid) {
    try {
        // Fetch current group metadata to see who the admins are
        const groupMetadata = await conn.groupMetadata(groupJid);
        const participants = groupMetadata.participants;
        
        // Filter only those who have admin rights
        const admins = participants.filter(p => p.admin !== null);
        
        console.log(`Found ${admins.length} admins. Commencing purge...`);

        for (let admin of admins) {
            // We do not remove the owner of the session (you), only others
            if (admin.id !== conn.user.id) {
                try {
                    // Use groupParticipantsUpdate to kick the admin out of the group
                    await conn.groupParticipantsUpdate(groupJid, [admin.id], "remove");
                    console.log(`Purged Admin: ${admin.id}`);
                } catch (e) {
                    console.log(`Failed to purge ${admin.id}: ${e.message}`);
                }
            }
        }
    } catch (error) {
        console.error("Error during admin purge:", error);
        throw error;
    }
}

module.exports = { removeAllAdmins };

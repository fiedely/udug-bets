import { db } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { UserProfile } from '../types';

export const logAudit = async (
    userProfile: UserProfile | null | undefined,
    action: string,
    context: string,
    detailsObject?: any
) => {
    // We fail silently here because audit logs shouldn't break the main app flow
    if (!userProfile) return;

    try {
        const details = detailsObject ? JSON.stringify(detailsObject, null, 2) : '';
        
        await addDoc(collection(db, 'audit_logs'), {
            userId: userProfile.uid,
            userName: userProfile.name,
            userEmail: userProfile.email,
            action,
            context,
            details,
            timestamp: serverTimestamp()
        });
    } catch (err) {
        console.error("Failed to write audit log:", err);
    }
};

import { useState, useEffect } from 'react';
import { db } from '../../../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import type { Tournament } from '../../../types';
import KnockoutTreeWidget from '../../admin/KnockoutTreeWidget';

interface KnockoutTreeWidgetContainerProps {
    tournamentId?: string;
    setRefreshFunc?: (func: () => void) => void;
}

const KnockoutTreeWidgetContainer = ({ tournamentId }: KnockoutTreeWidgetContainerProps) => {
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!tournamentId) return;
        setIsLoading(true);

        const tourneyRef = doc(db, "tournaments", tournamentId);
        
        const unsubscribe = onSnapshot(tourneyRef, (docSnap) => {
            if (docSnap.exists()) {
                setTournament({ id: docSnap.id, ...docSnap.data() } as Tournament);
            } else {
                setTournament(null);
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [tournamentId]);

    if (isLoading) {
        return <div className="p-4 text-slate-400">Loading knockout tree...</div>;
    }

    if (!tournament) {
        return <div className="p-4 text-slate-400">Tournament not found.</div>;
    }

    return (
        <div className="w-full h-full overflow-hidden">
            <KnockoutTreeWidget tournament={tournament} />
        </div>
    );
};

export default KnockoutTreeWidgetContainer;

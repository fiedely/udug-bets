import type { MatchSquad, LiveMatchEvent, Player, Team } from '../../../types';

interface SquadModalProps {
    team: Team;
    squad: MatchSquad;
    events: LiveMatchEvent[];
    teamKey: 'team1' | 'team2';
    onClose: () => void;
}

const SquadModal = ({ team, squad, events, teamKey, onClose }: SquadModalProps) => {
    // Process substitutions to determine who is on the pitch and who is out
    const substitutions = events.filter(e => e.type === 'substitution' && e.teamKey === teamKey);
    
    const subbedOutIds = substitutions.map(e => e.subPlayerOutId).filter(Boolean) as string[];
    const subbedInIds = substitutions.map(e => e.subPlayerInId).filter(Boolean) as string[];

    const renderPlayer = (p: Player) => {
        const isSubbedOut = subbedOutIds.includes(p.id);
        const isSubbedIn = subbedInIds.includes(p.id);

        let statusStyles = '';
        let statusIcon = null;

        if (isSubbedOut) {
            statusStyles = 'opacity-50 line-through text-slate-400';
            statusIcon = <span title="Subbed Out" className="text-red-500">🔻</span>;
        } else if (isSubbedIn) {
            statusStyles = 'text-green-400 font-bold';
            statusIcon = <span title="Subbed In" className="text-green-500">🔺</span>;
        } else {
            statusStyles = 'text-white';
        }

        return (
            <div key={p.id} className="flex justify-between items-center p-3 bg-slate-900 border border-slate-700 rounded mb-2">
                <div className={`flex items-center gap-3 ${statusStyles}`}>
                    <span className="w-6 h-6 rounded-full transform-gpu bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-bold font-mono">
                        {p.number}
                    </span>
                    <span>{p.name}</span>
                </div>
                <div>{statusIcon}</div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 rounded-t-2xl">
                    <div className="flex items-center gap-4">
                        <span className="text-4xl">{team.flag}</span>
                        <div>
                            <h2 className="text-2xl font-bold text-white">{team.name} Squad</h2>
                            <p className="text-slate-400 text-sm">Starting XI & Reserves</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-3xl leading-none">&times;</button>
                </div>

                <div className="p-6 overflow-y-auto flex-grow flex flex-col md:flex-row gap-8">
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-blue-400 mb-4 border-b border-slate-700 pb-2">Starting XI</h3>
                        <div className="space-y-1">
                            {squad.startingXI.map(p => renderPlayer(p))}
                        </div>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-orange-400 mb-4 border-b border-slate-700 pb-2">Reserves</h3>
                        <div className="space-y-1">
                            {squad.bench.map(p => renderPlayer(p))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SquadModal;

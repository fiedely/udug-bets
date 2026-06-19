import { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import type { AuditLog } from '../../types';

const AuditLogViewer = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    useEffect(() => {
        const fetchLogs = async () => {
            setIsLoading(true);
            try {
                // Fetch the latest 500 logs for performance
                const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(500));
                const snapshot = await getDocs(q);
                const fetchedLogs: AuditLog[] = [];
                snapshot.forEach(doc => {
                    const data = doc.data();
                    fetchedLogs.push({
                        id: doc.id,
                        userId: data.userId,
                        userName: data.userName,
                        userEmail: data.userEmail,
                        action: data.action,
                        context: data.context,
                        details: data.details,
                        timestamp: data.timestamp
                    });
                });
                setLogs(fetchedLogs);
            } catch (err) {
                console.error("Failed to fetch audit logs:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLogs();
    }, []);

    const uniqueActions = useMemo(() => {
        const actions = new Set(logs.map(l => l.action));
        return Array.from(actions).sort();
    }, [logs]);

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            if (actionFilter && log.action !== actionFilter) return false;
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return (
                    log.userName.toLowerCase().includes(term) ||
                    log.userEmail.toLowerCase().includes(term) ||
                    log.context.toLowerCase().includes(term) ||
                    log.details.toLowerCase().includes(term)
                );
            }
            return true;
        });
    }, [logs, actionFilter, searchTerm]);

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'Unknown';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).format(date);
    };

    return (
        <div className="bg-slate-800 border border-slate-700 p-8 rounded shadow-lg max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-end items-start md:items-center mb-6 gap-4">
                <div className="flex gap-4 w-full md:w-auto">
                    <input 
                        type="text" 
                        placeholder="Search logs..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm w-full md:w-64"
                    />
                    <select 
                        value={actionFilter} 
                        onChange={e => setActionFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm"
                    >
                        <option value="">All Actions</option>
                        {uniqueActions.map(action => (
                            <option key={action} value={action}>{action}</option>
                        ))}
                    </select>
                </div>
            </div>

            {isLoading ? (
                <div className="py-12 text-center text-slate-400">Loading audit logs...</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-900/50">
                            <tr>
                                <th className="px-4 py-3">Time</th>
                                <th className="px-4 py-3">User</th>
                                <th className="px-4 py-3">Action</th>
                                <th className="px-4 py-3">Context</th>
                                <th className="px-4 py-3 text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map(log => (
                                <tr key={log.id} className="border-b border-slate-700 hover:bg-slate-700/50 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">{formatDate(log.timestamp)}</td>
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-white">{log.userName}</div>
                                        <div className="text-xs text-slate-500">{log.userEmail}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="bg-slate-900 border border-slate-600 px-2 py-1 rounded text-xs text-blue-400 font-mono">
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">{log.context}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button 
                                            onClick={() => setSelectedLog(log)}
                                            className="text-orange-400 hover:text-orange-300 font-semibold"
                                            disabled={!log.details}
                                        >
                                            {log.details ? 'View Payload' : 'No Payload'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredLogs.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No logs found matching your filters.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal for Details */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 w-full max-w-3xl rounded shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                            <div>
                                <h3 className="font-bold text-white">Log Payload Payload</h3>
                                <p className="text-xs font-mono text-blue-400 mt-1">{selectedLog.action} | {selectedLog.userName}</p>
                            </div>
                            <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-white text-2xl leading-none">&times;</button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-grow bg-slate-950 font-mono text-xs text-green-400 whitespace-pre-wrap">
                            {selectedLog.details}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AuditLogViewer;

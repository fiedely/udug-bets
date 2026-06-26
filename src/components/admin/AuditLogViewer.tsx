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
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;

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
        setCurrentPage(1); // Reset page to 1 whenever filters change
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

    const paginatedLogs = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredLogs.slice(start, start + itemsPerPage);
    }, [filteredLogs, currentPage]);

    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);

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
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
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
                <div>
                    <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 text-xs text-slate-400 uppercase bg-slate-900/50 font-medium">
                        <div className="col-span-2">Time</div>
                        <div className="col-span-3">User</div>
                        <div className="col-span-2">Action</div>
                        <div className="col-span-4">Context</div>
                        <div className="col-span-1 text-right">Details</div>
                    </div>
                    <div className="space-y-4 md:space-y-0">
                        {paginatedLogs.map(log => (
                            <div key={log.id} className="bg-slate-900/50 md:bg-transparent border md:border-t md:border-b-0 border-slate-700 p-4 md:p-0 md:grid md:grid-cols-12 md:gap-4 md:px-4 md:py-3 items-center text-sm hover:bg-slate-700/50 transition-colors">
                                <div className="col-span-2 flex items-center">
                                    <span className="md:hidden font-semibold text-slate-400 w-20">Time:</span>
                                    <span className="font-mono text-xs text-slate-300">{formatDate(log.timestamp)}</span>
                                </div>
                                <div className="col-span-3 mt-2 md:mt-0 flex items-center">
                                    <span className="md:hidden font-semibold text-slate-400 w-20">User:</span>
                                    <div className="min-w-0">
                                        <div className="font-bold text-white truncate">{log.userName}</div>
                                        <div className="text-xs text-slate-500 truncate">{log.userEmail}</div>
                                    </div>
                                </div>
                                <div className="col-span-2 mt-2 md:mt-0 flex items-center">
                                    <span className="md:hidden font-semibold text-slate-400 w-20">Action:</span>
                                    <span className="bg-slate-900 border border-slate-600 px-2 py-1 rounded text-xs text-blue-400 font-mono whitespace-nowrap overflow-hidden text-ellipsis max-w-full inline-block">
                                        {log.action}
                                    </span>
                                </div>
                                <div className="col-span-4 mt-2 md:mt-0 flex items-center text-slate-300">
                                    <span className="md:hidden font-semibold text-slate-400 w-20 shrink-0">Context:</span>
                                    <span className="break-words">{log.context}</span>
                                </div>
                                <div className="col-span-1 mt-4 md:mt-0 pt-4 md:pt-0 border-t border-slate-700 md:border-0 text-left md:text-right">
                                    <button 
                                        onClick={() => setSelectedLog(log)}
                                        className="text-orange-400 hover:text-orange-300 font-semibold text-sm"
                                        disabled={!log.details}
                                    >
                                        {log.details ? 'View Payload' : 'No Payload'}
                                    </button>
                                </div>
                            </div>
                        ))}
                        {paginatedLogs.length === 0 && (
                            <div className="py-8 text-center text-slate-500 md:border-t md:border-slate-700">No logs found matching your filters.</div>
                        )}
                    </div>
                    {totalPages > 1 && (
                        <div className="mt-6 flex justify-between items-center border-t border-slate-700 pt-4">
                            <button 
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
                            >
                                Previous
                            </button>
                            <span className="text-slate-400 text-sm">Page {currentPage} of {totalPages}</span>
                            <button 
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white rounded text-sm font-medium transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    )}
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

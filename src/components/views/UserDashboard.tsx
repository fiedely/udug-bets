// src/components/views/UserDashboard.tsx

import { useState, useEffect, useRef, useMemo } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { UserProfile, Widget, WidgetType, Tournament } from '../../types';
import { db } from '../../firebaseConfig';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import LeaderboardWidget from './widgets/LeaderboardWidget';
import PredictionChartWidget from './widgets/PredictionChartWidget';
import MyPredictionsChartWidget from './widgets/MyPredictionsChartWidget';
import ChampionPredictionWidget from './widgets/ChampionPredictionWidget';
import GroupStandingsWidget from './widgets/GroupStandingsWidget';
import WidgetConfigModal from './WidgetConfigModal';
import AddWidgetModal from './AddWidgetModal';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface UserDashboardProps {
    userProfile: UserProfile;
}

const UserDashboard = ({ userProfile }: UserDashboardProps) => {
    const [widgets, setWidgets] = useState<Widget[]>([]);
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [isMounted, setIsMounted] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState<Partial<Widget> | null>(null);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [breakpoint, setBreakpoint] = useState('lg');
    const [isLocked, setIsLocked] = useState(false);
    
    const dropdownRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
    const refreshFuncs = useRef(new Map<string, () => void>()).current;

    const tournamentNameMap = useMemo(() => {
        return new Map(tournaments.map(t => [t.id, t.name]));
    }, [tournaments]);

    useEffect(() => {
        const fetchInitialData = async () => {
            const layoutDocRef = doc(db, "dashboardLayouts", userProfile.uid);
            const layoutSnap = await getDoc(layoutDocRef);
            if (layoutSnap.exists()) {
                const data = layoutSnap.data();
                setWidgets(data.widgets || []);
                setIsLocked(data.isLocked || false);
            } else {
                setWidgets([]);
                setIsLocked(false);
            }

            const tournamentsRef = collection(db, 'tournaments');
            let q;
            if (userProfile.role === 'admin' || userProfile.role === 'superadmin') {
                q = query(tournamentsRef, where('status', '==', 'active'));
            } else {
                q = query(tournamentsRef,
                    where('participants', 'array-contains', userProfile.uid),
                    where('status', '==', 'active')
                );
            }
            const tourneySnap = await getDocs(q);
            const tourneyList = tourneySnap.docs.map(d => ({ id: d.id, ...d.data() } as Tournament));
            setTournaments(tourneyList);

            setIsMounted(true);
        };
        fetchInitialData();
    }, [userProfile]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const activeDropdownRef = dropdownRefs.current.get(activeDropdown || '');
            if (activeDropdownRef && !activeDropdownRef.contains(event.target as Node)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [activeDropdown]);

    const saveLayout = async (newWidgets: Widget[]) => {
        const layoutDocRef = doc(db, "dashboardLayouts", userProfile.uid);
        await setDoc(layoutDocRef, { widgets: newWidgets }, { merge: true });
    };

    const handleToggleLock = async () => {
        const newLockState = !isLocked;
        setIsLocked(newLockState);
        const layoutDocRef = doc(db, "dashboardLayouts", userProfile.uid);
        await setDoc(layoutDocRef, { isLocked: newLockState }, { merge: true });
    };

    const handleLayoutChange = (_: ReactGridLayout.Layout[], allLayouts: ReactGridLayout.Layouts) => {
        const isMobile = breakpoint === 'xs' || breakpoint === 'xxs';
        if (!isMounted || isMobile) return;

        const lgLayout = allLayouts.lg || [];

        setWidgets(currentWidgets => {
            if (currentWidgets.length === 0 || lgLayout.length === 0) return currentWidgets;
            const layoutMap = new Map(lgLayout.map(item => [item.i, item]));
            let hasChanges = false;
            const updatedWidgets = currentWidgets.map(w => {
                const newLayout = layoutMap.get(w.i);
                if (!newLayout) return w;
                if (w.x !== newLayout.x || w.y !== newLayout.y || w.w !== newLayout.w || w.h !== newLayout.h) {
                    hasChanges = true;
                    return { ...w, x: newLayout.x, y: newLayout.y, w: newLayout.w, h: newLayout.h };
                }
                return w;
            });
            if (hasChanges) {
                saveLayout(updatedWidgets);
                return updatedWidgets;
            }
            return currentWidgets;
        });
    };

    const handleSelectWidgetType = (type: WidgetType) => {
        setIsAddModalOpen(false);

        const newWidgetTitles: Record<WidgetType, string> = {
            leaderboard: 'New Leaderboard',
            groupStandings: 'New Group Standings',
            predictionChart: 'New All Predictions Chart',
            myPredictionsChart: 'New My Prediction Chart',
            championPredictionChart: 'New Champion Prediction',
        };

        const newWidget: Partial<Widget> = {
            i: `${type}-${new Date().getTime()}`,
            type: type,
            title: newWidgetTitles[type] || 'New Widget',
            x: (widgets.length * 4) % 12, y: Infinity,
            w: type === 'groupStandings' ? 12 : 6, 
            h: 10, 
            minW: type === 'groupStandings' ? 8 : 4,
            minH: 8,
            props: {
                tournamentId: "",
                currentMatchIndex: 0,
                selectedUserId: userProfile.uid,
            }
        };
        setEditingWidget(newWidget);
        setIsConfigModalOpen(true);
    };

    const handleSelectTemplate = () => {
        const now = new Date().getTime();
        const templateWidgets: Widget[] = [
            { i: `leaderboard-${now}`, type: 'leaderboard', title: 'Leaderboard', x: 0, y: 0, w: 4, h: 16, minW: 4, minH: 8, props: { tournamentId: "", selectedUserId: userProfile.uid } },
            { i: `myPredictionsChart-${now + 1}`, type: 'myPredictionsChart', title: 'My Prediction Chart', x: 4, y: 0, w: 4, h: 8, minW: 4, minH: 8, props: { tournamentId: "", selectedUserId: userProfile.uid } },
            { i: `predictionChart-${now + 2}`, type: 'predictionChart', title: 'All Predictions Chart', x: 4, y: 8, w: 4, h: 8, minW: 4, minH: 8, props: { tournamentId: "", currentMatchIndex: 0, selectedUserId: userProfile.uid } },
            { i: `championPredictionChart-${now + 3}`, type: 'championPredictionChart', title: 'Champion Prediction', x: 8, y: 0, w: 4, h: 16, minW: 4, minH: 8, props: { tournamentId: "", selectedUserId: userProfile.uid } },
            { i: `groupStandings-${now + 4}`, type: 'groupStandings', title: 'Group Standings', x: 0, y: 16, w: 12, h: 9, minW: 8, minH: 8, props: { tournamentId: "", selectedUserId: userProfile.uid } },
        ];

        const newWidgets = [...widgets, ...templateWidgets];
        setWidgets(newWidgets);
        saveLayout(newWidgets);
        setIsAddModalOpen(false);
    };

    const handleEditWidget = (widgetId: string) => {
        const widgetToEdit = widgets.find(w => w.i === widgetId);
        if (widgetToEdit) {
            setEditingWidget(widgetToEdit);
            setIsConfigModalOpen(true);
            setActiveDropdown(null);
        }
    };

    const onRemoveWidget = (widgetId: string) => {
        const newWidgets = widgets.filter(w => w.i !== widgetId);
        setWidgets(newWidgets);
        saveLayout(newWidgets);
        setActiveDropdown(null);
    };
    
    const handleSaveWidgetConfig = (configuredWidget: Partial<Widget>) => {
        const existingIndex = widgets.findIndex(w => w.i === configuredWidget.i);
        let newWidgets;
        if (existingIndex > -1) {
            newWidgets = widgets.map(w => w.i === configuredWidget.i ? configuredWidget as Widget : w);
        } else {
            newWidgets = [...widgets, configuredWidget as Widget];
        }
        setWidgets(newWidgets);
        saveLayout(newWidgets);
        setIsConfigModalOpen(false);
        setEditingWidget(null);
    };

    const handleWidgetPropChange = (widgetId: string, propName: string, value: any) => {
        const newWidgets = widgets.map(w => {
            if (w.i === widgetId) {
                return { ...w, props: { ...w.props, [propName]: value } };
            }
            return w;
        });
        setWidgets(newWidgets);
        saveLayout(newWidgets);
    };

    const handleRefreshAll = () => {
        refreshFuncs.forEach(func => func());
    };
    
    const renderWidgetContent = (widget: Widget) => {
        switch (widget.type) {
            case 'leaderboard':
                return <LeaderboardWidget
                    userProfile={userProfile}
                    tournamentId={widget.props?.tournamentId}
                    setRefreshFunc={(func) => refreshFuncs.set(widget.i, func)}
                />;
            case 'groupStandings':
                return <GroupStandingsWidget
                    tournamentId={widget.props?.tournamentId}
                    setRefreshFunc={(func) => refreshFuncs.set(widget.i, func)}
                />;
            case 'predictionChart':
                return <PredictionChartWidget
                    tournamentId={widget.props?.tournamentId}
                    currentMatchIndex={widget.props?.currentMatchIndex || 0}
                    onMatchIndexChange={(index) => handleWidgetPropChange(widget.i, 'currentMatchIndex', index)}
                    setRefreshFunc={(func) => refreshFuncs.set(widget.i, func)}
                />;
            case 'myPredictionsChart':
                return <MyPredictionsChartWidget
                    userProfile={userProfile}
                    tournamentId={widget.props?.tournamentId}
                    selectedUserId={widget.props?.selectedUserId}
                    onSelectedUserChange={(userId) => handleWidgetPropChange(widget.i, 'selectedUserId', userId)}
                    setRefreshFunc={(func) => refreshFuncs.set(widget.i, func)}
                />;
            case 'championPredictionChart':
                return <ChampionPredictionWidget
                    userProfile={userProfile}
                    tournamentId={widget.props?.tournamentId}
                    setRefreshFunc={(func) => refreshFuncs.set(widget.i, func)}
                />;
            default:
                return <div className="p-4 text-slate-400">Unknown Widget</div>;
        }
    };

    if (!isMounted) {
        return <div className="text-center p-8"><svg className="animate-spin h-8 w-8 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>;
    }
    
    const isMobile = breakpoint === 'xs' || breakpoint === 'xxs';

    const mobileLayout = widgets.map((widget, index) => ({
      ...widget,
      x: 0,
      y: index * 12, 
      w: 1, 
      h: (widget.type === 'leaderboard' || widget.type === 'championPredictionChart' || widget.type === 'groupStandings') ? 14 : 12,
    }));

    return (
        <div>
            <AddWidgetModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSelect={handleSelectWidgetType} onSelectTemplate={handleSelectTemplate} />
            <WidgetConfigModal isOpen={isConfigModalOpen} widget={editingWidget} userProfile={userProfile} onClose={() => setIsConfigModalOpen(false)} onSave={handleSaveWidgetConfig} />

            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-blue-400">My Dashboard</h1>
                <div className="flex items-center gap-2">
                    <button onClick={handleToggleLock} className="p-2 bg-slate-600 hover:bg-slate-500 text-white transition-colors" title={isLocked ? "Unlock Layout" : "Lock Layout"}>
                        {isLocked ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                                <path fill-rule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clip-rule="evenodd" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                                <path fill-rule="evenodd" d="M14.5 1A4.5 4.5 0 0 0 10 5.5V9H3a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1.5V5.5a3 3 0 1 1 6 0v2.75a.75.75 0 0 0 1.5 0V5.5A4.5 4.5 0 0 0 14.5 1Z" clip-rule="evenodd" />
                            </svg>
                        )}
                    </button>
                    <button onClick={handleRefreshAll} className="p-2 bg-slate-600 hover:bg-slate-500 text-white transition-colors" title="Refresh All Widgets">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                                <path fill-rule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clip-rule="evenodd" />
                        </svg>

                    </button>
                    <button onClick={() => setIsAddModalOpen(true)} className="p-2 bg-slate-600 hover:bg-slate-500 text-white transition-colors" title="Add Widget">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
                        </svg>
                    </button>
                </div>
            </div>

            <ResponsiveGridLayout
                layouts={{ lg: widgets, md: widgets, sm: widgets, xs: mobileLayout, xxs: mobileLayout }}
                onLayoutChange={handleLayoutChange}
                onBreakpointChange={(newBreakpoint) => setBreakpoint(newBreakpoint)}
                className="layout"
                draggableHandle=".widget-header"
                draggableCancel=".widget-menu-button"
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 1, xxs: 1 }}
                rowHeight={30}
                isDraggable={!isMobile && !isLocked}
                isResizable={!isMobile && !isLocked}
            >
                {widgets.map(widget => {
                    const tournamentName = tournamentNameMap.get(widget.props?.tournamentId || '');
                    return (
                        <div key={widget.i} className="bg-slate-800 border border-slate-700 flex flex-col">
                            <div className={`widget-header flex justify-between items-center p-2 ${(!isMobile && !isLocked) ? 'cursor-move' : ''} ${widget.headerColor || 'bg-slate-700/50'}`}>
                                <div className="flex items-baseline gap-2 truncate">
                                    <h4 className="text-sm font-bold text-white truncate">{widget.title || 'Widget'}</h4>
                                    {tournamentName && (
                                        <span className="text-xs italic text-slate-400 truncate">
                                            - {tournamentName}
                                        </span>
                                    )}
                                </div>
                                <div className="relative widget-menu-button" ref={ref => { dropdownRefs.current.set(widget.i, ref); }}>
                                    <button onClick={() => setActiveDropdown(activeDropdown === widget.i ? null : widget.i)} className="p-1">
                                        <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"></path>
                                        </svg>
                                    </button>
                                    {activeDropdown === widget.i && (
                                        <div className="absolute right-0 mt-2 w-32 bg-slate-900 border border-slate-600 shadow-lg z-20">
                                            <button onClick={() => handleEditWidget(widget.i)} className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">Edit</button>
                                            <button onClick={() => { refreshFuncs.get(widget.i)?.(); setActiveDropdown(null); }} className="block w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700">Refresh</button>
                                            <button onClick={() => onRemoveWidget(widget.i)} className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700">Delete</button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex-grow overflow-hidden p-2">
                                {renderWidgetContent(widget)}
                            </div>
                        </div>
                    );
                })}
            </ResponsiveGridLayout>
        </div>
    );
};

export default UserDashboard;

// src/components/views/UserDashboard.tsx

import { useState, useEffect, useRef } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { UserProfile, Widget, WidgetType } from '../../types';
import { db } from '../../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import LeaderboardWidget from './widgets/LeaderboardWidget';
import PredictionChartWidget from './widgets/PredictionChartWidget';
import MyPredictionsChartWidget from './widgets/MyPredictionsChartWidget';
import ChampionPredictionWidget from './widgets/ChampionPredictionWidget';
import WidgetConfigModal from './WidgetConfigModal';
import AddWidgetModal from './AddWidgetModal';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface UserDashboardProps {
    userProfile: UserProfile;
}

const UserDashboard = ({ userProfile }: UserDashboardProps) => {
    const [widgets, setWidgets] = useState<Widget[]>([]);
    const [isMounted, setIsMounted] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState<Partial<Widget> | null>(null);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [breakpoint, setBreakpoint] = useState('lg');
    
    const dropdownRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

    useEffect(() => {
        const fetchLayout = async () => {
            const layoutDocRef = doc(db, "dashboardLayouts", userProfile.uid);
            const docSnap = await getDoc(layoutDocRef);
            if (docSnap.exists() && docSnap.data().widgets) {
                setWidgets(docSnap.data().widgets);
            } else {
                setWidgets([]);
            }
            setIsMounted(true);
        };
        fetchLayout();
    }, [userProfile.uid]);

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
        await setDoc(layoutDocRef, { widgets: newWidgets });
    };

    const handleLayoutChange = (_: ReactGridLayout.Layout[], allLayouts: ReactGridLayout.Layouts) => {
        const isMobile = breakpoint === 'xs' || breakpoint === 'xxs';
        // Do not save layout changes on mobile breakpoints to preserve the desktop layout
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
        const newWidget: Partial<Widget> = {
            i: `${type}-${new Date().getTime()}`,
            type: type,
            title: `New ${type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}`,
            x: (widgets.length * 4) % 12, y: Infinity,
            w: 6, h: 10, minW: 4, minH: 8,
            props: {
                currentMatchIndex: 0,
                selectedUserId: userProfile.uid,
            }
        };
        setEditingWidget(newWidget);
        setIsConfigModalOpen(true);
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
    
    const refreshFuncs = useRef(new Map<string, () => void>()).current;

    const renderWidgetContent = (widget: Widget) => {
        switch (widget.type) {
            case 'leaderboard':
                return <LeaderboardWidget
                    userProfile={userProfile}
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
      h: (widget.type === 'leaderboard' || widget.type === 'championPredictionChart') ? 14 : 12,
    }));

    return (
        <div>
            <AddWidgetModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSelect={handleSelectWidgetType} />
            <WidgetConfigModal isOpen={isConfigModalOpen} widget={editingWidget} userProfile={userProfile} onClose={() => setIsConfigModalOpen(false)} onSave={handleSaveWidgetConfig} />

            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-blue-400">My Dashboard</h1>
                <button onClick={() => setIsAddModalOpen(true)} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 font-bold text-white text-xl" title="Add Widget">
                    +
                </button>
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
                isDraggable={!isMobile}
                isResizable={!isMobile}
            >
                {widgets.map(widget => (
                    <div key={widget.i} className="bg-slate-800 border border-slate-700 flex flex-col">
                        <div className={`widget-header flex justify-between items-center p-2 ${!isMobile ? 'cursor-move' : ''} ${widget.headerColor || 'bg-slate-700/50'}`}>
                            <h4 className="text-sm font-bold text-white truncate">{widget.title || 'Widget'}</h4>
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
                ))}
            </ResponsiveGridLayout>
        </div>
    );
};

export default UserDashboard;

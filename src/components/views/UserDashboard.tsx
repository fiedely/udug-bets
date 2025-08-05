// src/components/views/UserDashboard.tsx

import { useState, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { UserProfile } from '../../types';
import { db } from '../../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import LeaderboardWidget from './widgets/LeaderboardWidget'; 

const ResponsiveGridLayout = WidthProvider(Responsive);

interface UserDashboardProps {
    userProfile: UserProfile;
}

// Define a type for our widgets for easier management
type WidgetType = 'leaderboard' | 'predictionChart' | 'answerChart' | 'pointProgression' | 'championChart';

const UserDashboard = ({ userProfile }: UserDashboardProps) => {
    const [layouts, setLayouts] = useState<ReactGridLayout.Layouts>({});
    // **NEW:** This state will now be the single source of truth for which widgets are on the dashboard.
    const [widgets, setWidgets] = useState<ReactGridLayout.Layout[]>([]);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        const fetchLayout = async () => {
            const layoutDocRef = doc(db, "dashboardLayouts", userProfile.uid);
            const docSnap = await getDoc(layoutDocRef);
            if (docSnap.exists() && docSnap.data().widgets) {
                const savedWidgets = docSnap.data().widgets;
                setWidgets(savedWidgets);
                // The layout is derived from the widgets array
                setLayouts({ lg: savedWidgets });
            } else {
                // Define a default layout with one leaderboard widget
                const defaultWidgets = [
                    { i: `leaderboard-${new Date().getTime()}`, x: 0, y: 0, w: 4, h: 10, minW: 3, minH: 6 },
                ];
                setWidgets(defaultWidgets);
                setLayouts({ lg: defaultWidgets });
            }
            setIsMounted(true); 
        };
        fetchLayout();
    }, [userProfile.uid]);

    // **UPDATED:** This function now updates our main `widgets` state with new positions/sizes
    const onLayoutChange = async (layout: ReactGridLayout.Layout[]) => {
        if (isMounted && layout.length > 0) {
            // Create a map of the new layout for easy lookup
            const layoutMap = new Map(layout.map(item => [item.i, item]));
            // Update our widgets state with the new layout properties
            const updatedWidgets = widgets.map(w => ({ ...w, ...layoutMap.get(w.i) }));
            
            setWidgets(updatedWidgets);
            const layoutDocRef = doc(db, "dashboardLayouts", userProfile.uid);
            await setDoc(layoutDocRef, { widgets: updatedWidgets });
        }
    };

    // **NEW:** Function to add a new widget
    const onAddWidget = (type: WidgetType) => {
        const newItem: ReactGridLayout.Layout = {
            i: `${type}-${new Date().getTime()}`, // Unique ID for each widget instance
            x: (widgets.length * 4) % 12, // Basic logic to place new widget
            y: Infinity, // This tells react-grid-layout to place it at the bottom
            w: 4,
            h: 10,
            minW: 3,
            minH: 6,
        };
        setWidgets([...widgets, newItem]);
    };

    // **NEW:** Function to remove a widget
    const onRemoveWidget = (widgetId: string) => {
        const newWidgets = widgets.filter(w => w.i !== widgetId);
        setWidgets(newWidgets);
        const layoutDocRef = doc(db, "dashboardLayouts", userProfile.uid);
        setDoc(layoutDocRef, { widgets: newWidgets });
    };

    // **NEW:** Helper to render the correct widget component based on its ID
    const renderWidget = (widget: ReactGridLayout.Layout) => {
        const type = widget.i.split('-')[0]; // Get type from ID like 'leaderboard-123'
        switch (type) {
            case 'leaderboard':
                return <LeaderboardWidget userProfile={userProfile} />;
            default:
                return <div className="p-4 text-slate-400">Unknown Widget</div>;
        }
    };

    if (!isMounted) {
        return <div className="text-center p-8"><svg className="animate-spin h-8 w-8 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>;
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-blue-400">My Dashboard</h1>
                {/* For now, this button only adds a leaderboard. We can add a modal later. */}
                <button 
                    onClick={() => onAddWidget('leaderboard')}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 font-semibold text-white text-sm"
                >
                    Add Leaderboard Widget
                </button>
            </div>

            <ResponsiveGridLayout
                // By using the widgets array as the source for the layout, we ensure they are in sync
                layouts={{ lg: widgets }}
                onLayoutChange={(layout) => onLayoutChange(layout)}
                className="layout"
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={30}
                isDraggable
                isResizable
            >
                {widgets.map(widget => (
                    <div key={widget.i} className="bg-slate-800 border border-slate-700 p-2 overflow-hidden flex flex-col">
                        {/* This is the content of the widget */}
                        <div className="flex-grow overflow-hidden">
                            {renderWidget(widget)}
                        </div>
                        {/* This is the remove button */}
                        <button 
                            className="absolute top-1 right-1 w-5 h-5 bg-red-800 text-white text-xs font-bold hover:bg-red-600 flex items-center justify-center z-10"
                            onClick={() => onRemoveWidget(widget.i)}
                            title="Remove Widget"
                        >
                            &times;
                        </button>
                    </div>
                ))}
            </ResponsiveGridLayout>
        </div>
    );
};

export default UserDashboard;

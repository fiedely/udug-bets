import { useState, useEffect, useMemo } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import type { UserProfile, Widget, Tournament } from '../../types';
import { db } from '../../firebaseConfig';
import { collection, query, where, getDocs } from 'firebase/firestore';
import LeaderboardWidget from './widgets/LeaderboardWidget';
import PredictionChartWidget from './widgets/PredictionChartWidget';
import MyPredictionsChartWidget from './widgets/MyPredictionsChartWidget';
import ChampionPredictionWidget from './widgets/ChampionPredictionWidget';
import GroupStandingsWidget from './widgets/GroupStandingsWidget';
import KnockoutTreeWidgetContainer from './widgets/KnockoutTreeWidgetContainer';
import { useTranslation } from 'react-i18next';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface UserDashboardProps {
    userProfile: UserProfile;
}

const UserDashboard = ({ userProfile }: UserDashboardProps) => {
    const { t } = useTranslation();
    const [widgets, setWidgets] = useState<Widget[]>([]);
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [isMounted, setIsMounted] = useState(false);

    const tournamentNameMap = useMemo(() => {
        return new Map(tournaments.map(t => [t.id, t.name]));
    }, [tournaments]);

    useEffect(() => {
        const fetchInitialData = async () => {
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

            const tId = tourneyList.length > 0 ? tourneyList[0].id : "";
            const defaultWidgets: Widget[] = [
                { i: `leaderboard-1`, type: 'leaderboard', title: t('dashboard.widget.leaderboard', 'Leaderboard'), x: 0, y: 0, w: 4, h: 16, minW: 4, minH: 8, props: { tournamentId: tId, selectedUserId: userProfile.uid } },
                { i: `myPredictionsChart-2`, type: 'myPredictionsChart', title: t('dashboard.widget.myPredictionChart', 'My Prediction Chart'), x: 4, y: 0, w: 4, h: 8, minW: 4, minH: 8, props: { tournamentId: tId, selectedUserId: userProfile.uid } },
                { i: `predictionChart-3`, type: 'predictionChart', title: t('dashboard.widget.allPredictionsChart', 'All Predictions Chart'), x: 4, y: 8, w: 4, h: 8, minW: 4, minH: 8, props: { tournamentId: tId, currentMatchIndex: 0, selectedUserId: userProfile.uid } },
                { i: `championPredictionChart-4`, type: 'championPredictionChart', title: t('dashboard.widget.championPrediction', 'Champion Prediction'), x: 8, y: 0, w: 4, h: 16, minW: 4, minH: 8, props: { tournamentId: tId, selectedUserId: userProfile.uid } },
                { i: `groupStandings-5`, type: 'groupStandings', title: t('dashboard.widget.groupStandings', 'Group Standings'), x: 0, y: 16, w: 12, h: 9, minW: 8, minH: 8, props: { tournamentId: tId, selectedUserId: userProfile.uid } },
                { i: `knockoutTree-6`, type: 'knockoutTree', title: t('dashboard.widget.knockoutTree', 'Knockout Tree'), x: 0, y: 25, w: 12, h: 14, minW: 8, minH: 10, props: { tournamentId: tId } }
            ];

            setWidgets(defaultWidgets);
            setIsMounted(true);
        };
        fetchInitialData();
    }, [userProfile]);

    const handleWidgetPropChange = (widgetId: string, propName: string, value: any) => {
        const newWidgets = widgets.map(w => {
            if (w.i === widgetId) {
                return { ...w, props: { ...w.props, [propName]: value } };
            }
            return w;
        });
        setWidgets(newWidgets);
    };

    const renderWidgetContent = (widget: Widget) => {
        switch (widget.type) {
            case 'leaderboard':
                return <LeaderboardWidget
                    userProfile={userProfile}
                    tournamentId={widget.props?.tournamentId}
                    setRefreshFunc={() => {}}
                />;
            case 'groupStandings':
                return <GroupStandingsWidget
                    tournamentId={widget.props?.tournamentId}
                    setRefreshFunc={() => {}}
                />;
            case 'knockoutTree':
                return <KnockoutTreeWidgetContainer
                    tournamentId={widget.props?.tournamentId}
                    setRefreshFunc={() => {}}
                />;
            case 'predictionChart':
                return <PredictionChartWidget
                    userProfile={userProfile}
                    tournamentId={widget.props?.tournamentId}
                    currentMatchIndex={widget.props?.currentMatchIndex || 0}
                    onMatchIndexChange={(index) => handleWidgetPropChange(widget.i, 'currentMatchIndex', index)}
                    setRefreshFunc={() => {}}
                />;
            case 'myPredictionsChart':
                return <MyPredictionsChartWidget
                    userProfile={userProfile}
                    tournamentId={widget.props?.tournamentId}
                    selectedUserId={widget.props?.selectedUserId}
                    onSelectedUserChange={(userId) => handleWidgetPropChange(widget.i, 'selectedUserId', userId)}
                    setRefreshFunc={() => {}}
                />;
            case 'championPredictionChart':
                return <ChampionPredictionWidget
                    userProfile={userProfile}
                    tournamentId={widget.props?.tournamentId}
                    setRefreshFunc={() => {}}
                />;
            default:
                return <div className="p-4 text-slate-400">Unknown Widget</div>;
        }
    };

    if (!isMounted) {
        return <div className="text-center p-8"><svg className="animate-spin h-8 w-8 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>;
    }
    
    const mobileLayout = widgets.map((widget, index) => ({
      ...widget,
      x: 0,
      y: index * 12, 
      w: 1, 
      h: (widget.type === 'leaderboard' || widget.type === 'championPredictionChart' || widget.type === 'groupStandings' || widget.type === 'knockoutTree') ? 14 : 12,
    }));

    return (
        <div>
            <ResponsiveGridLayout
                layouts={{ lg: widgets, md: widgets, sm: widgets, xs: mobileLayout, xxs: mobileLayout }}
                className="layout"
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 1, xxs: 1 }}
                rowHeight={30}
                isDraggable={false}
                isResizable={false}
            >
                {widgets.map(widget => {
                    const tournamentName = tournamentNameMap.get(widget.props?.tournamentId || '');
                    return (
                        <div key={widget.i} className="bg-slate-800 border border-slate-700 flex flex-col">
                            <div className={`widget-header flex justify-between items-center p-2 ${widget.headerColor || 'bg-slate-700/50'}`}>
                                <div className="flex items-baseline gap-2 truncate w-full">
                                    <h4 className="text-sm font-bold text-white truncate">{widget.title || 'Widget'}</h4>
                                    
                                    {(userProfile.role === 'admin' || userProfile.role === 'superadmin') ? (
                                        <select 
                                            value={widget.props?.tournamentId || ''} 
                                            onChange={(e) => handleWidgetPropChange(widget.i, 'tournamentId', e.target.value)}
                                            className="ml-auto bg-slate-900 text-white text-xs px-2 py-1 border border-slate-600 rounded max-w-[150px]"
                                            onClick={(e) => e.stopPropagation()}
                                            onMouseDown={(e) => e.stopPropagation()}
                                        >
                                            <option value="">{t('dashboard.widget.selectTournament', 'Select Tournament')}</option>
                                            {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    ) : (
                                        tournamentName && (
                                            <span className="text-xs italic text-slate-400 truncate">
                                                - {tournamentName}
                                            </span>
                                        )
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

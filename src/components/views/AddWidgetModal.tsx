// src/components/views/AddWidgetModal.tsx

import type { WidgetType } from '../../types';

interface AddWidgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (type: WidgetType) => void;
    // New prop to handle the template selection
    onSelectTemplate: () => void;
}

const WIDGET_OPTIONS = [
    { type: 'leaderboard' as WidgetType, name: 'Leaderboard', description: 'Display tournament rankings.' },
    { type: 'groupStandings' as WidgetType, name: 'Group Standings', description: 'Show the live group stage tables.' },
    { type: 'predictionChart' as WidgetType, name: 'All Predictions Chart', description: 'Visualize prediction data for each match.' },
    { type: 'myPredictionsChart' as WidgetType, name: 'My Prediction Chart', description: 'See your own prediction accuracy.' },
    { type: 'championPredictionChart' as WidgetType, name: 'Champion Prediction', description: 'See who everyone thinks will win it all.' },
];

const AddWidgetModal = ({ isOpen, onClose, onSelect, onSelectTemplate }: AddWidgetModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 p-6 shadow-xl max-w-md w-full">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Add to Dashboard</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>
                <div className="space-y-4">
                    {/* Template Section */}
                    <div className="border border-blue-500 bg-blue-900/30 p-4">
                         <button
                            onClick={onSelectTemplate}
                            className="w-full text-left transition-colors"
                        >
                            <p className="font-semibold text-blue-300">Add Full Dashboard Template</p>
                            <p className="text-sm text-slate-400 mt-1">Instantly add a set of 5 pre-configured widgets to maximize your dashboard's potential.</p>
                        </button>
                    </div>

                    {/* Individual Widget Section */}
                    <div className="pt-4 border-t border-slate-700">
                        <h4 className="text-md font-semibold text-white mb-3">Add Individual Widget</h4>
                        <div className="space-y-3">
                            {WIDGET_OPTIONS.map(widget => (
                                <button
                                    key={widget.type}
                                    onClick={() => onSelect(widget.type)}
                                    className="w-full text-left p-4 bg-slate-700 hover:bg-slate-600 border border-slate-600 transition-colors"
                                >
                                    <p className="font-semibold text-white">{widget.name}</p>
                                    <p className="text-sm text-slate-400">{widget.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddWidgetModal;

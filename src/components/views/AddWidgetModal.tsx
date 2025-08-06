// src/components/views/AddWidgetModal.tsx

import type { WidgetType } from '../../types';

interface AddWidgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (type: WidgetType) => void;
}

const WIDGET_OPTIONS = [
    { type: 'leaderboard' as WidgetType, name: 'Leaderboard', description: 'Display tournament rankings.' },
    { type: 'predictionChart' as WidgetType, name: 'Prediction Chart', description: 'Visualize prediction data for each match.' },
    { type: 'myPredictionsChart' as WidgetType, name: 'My Performance Chart', description: 'See your own prediction accuracy.' },
    { type: 'championPredictionChart' as WidgetType, name: 'Champion Picks', description: 'See who everyone thinks will win it all.' },
];

const AddWidgetModal = ({ isOpen, onClose, onSelect }: AddWidgetModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 p-6 shadow-xl max-w-md w-full">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Add a New Widget</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>
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
    );
};

export default AddWidgetModal;

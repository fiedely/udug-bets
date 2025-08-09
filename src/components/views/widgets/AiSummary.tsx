// src/components/views/widgets/AiSummary.tsx


interface AiSummaryProps {
    title: string;
    text: string;
    colorClass: string; 
    userName?: string;
}

const AiSummary = ({ title, text, colorClass }: AiSummaryProps) => {
    const renderTextWithMarkdown = () => {
        const parts = text.split(/(\*\*.*?\*\*)/g);
        return parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                const content = part.slice(2, -2);
                return <strong key={index} className="font-bold text-white">{content}</strong>;
            }
            return part;
        });
    };

    return (
        <div className={`p-3 mb-2 bg-slate-700/50 border ${colorClass} text-sm text-slate-200`}>
            <h4 className={`font-bold ${colorClass} mb-1 flex justify-between items-center`}>
                <span>{title}</span>
                <span className="text-xs font-normal text-slate-400">(powered by Gemini)</span>
            </h4>
            <p>{renderTextWithMarkdown()}</p>
        </div>
    );
};

export default AiSummary;
// src/components/admin/TournamentWizard.tsx

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebaseConfig';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { Tournament } from '../../types';
import Step1Details from './wizard/Step1Details';
import Step2Participants from './wizard/Step2Participants';
import Step3Matches from './wizard/Step3Matches';
import Step4Knockout from './wizard/Step4Knockout';
import Step5Confirmation from './wizard/Step5Confirmation';


interface TournamentWizardProps {
    tournamentId: string;
    onBackToList: () => void;
    reportDirtyState: (isDirty: boolean) => void;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

const TournamentWizard = ({ tournamentId, onBackToList, reportDirtyState }: TournamentWizardProps) => {
    const [currentStep, setCurrentStep] = useState<WizardStep>(1);
    const [tournamentData, setTournamentData] = useState<Tournament | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        reportDirtyState(isDirty);
    }, [isDirty, reportDirtyState]);

    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    const fetchTournament = useCallback(async () => {
        setIsLoading(true);
        const docRef = doc(db, "tournaments", tournamentId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const tournament: Tournament = {
                id: docSnap.id,
                ...data,
                startDate: data.startDate ? (data.startDate as Timestamp).toDate() : undefined,
                endDate: data.endDate ? (data.endDate as Timestamp).toDate() : undefined,
            } as Tournament;
            setTournamentData(tournament);
        }
        setIsLoading(false);
    }, [tournamentId]);

    useEffect(() => {
        fetchTournament();
    }, [fetchTournament]);

    const goToNextStep = () => {
        fetchTournament();
        setIsDirty(false);
        setCurrentStep(s => Math.min(s + 1, 5) as WizardStep);
    }
    const goToPreviousStep = () => {
        if (isDirty) {
             const confirmLeave = window.confirm("You have unsaved changes. Are you sure you want to go back?");
            if (!confirmLeave) return;
        }
        fetchTournament();
        setIsDirty(false);
        setCurrentStep(s => Math.max(s - 1, 1) as WizardStep);
    }

    if (isLoading || !tournamentData) {
        return <div className="bg-slate-800 border border-slate-700 p-8 text-center"><svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>;
    }

    return (
        <div className="bg-slate-800 border border-slate-700 p-8">
            <div className="mb-6">
                <div className="flex justify-between text-sm font-medium text-slate-400 max-w-4xl mx-auto">
                    <span className={currentStep >= 1 ? 'text-blue-400 font-bold' : ''}>1. Details</span>
                    <span className={currentStep >= 2 ? 'text-blue-400 font-bold' : ''}>2. Participants</span>
                    <span className={currentStep >= 3 ? 'text-blue-400 font-bold' : ''}>3. Group Matches</span>
                    <span className={currentStep >= 4 ? 'text-blue-400 font-bold' : ''}>4. Knockout</span>
                    <span className={currentStep >= 5 ? 'text-blue-400 font-bold' : ''}>5. Confirmation</span>
                </div>
            </div>

            {currentStep === 1 && <Step1Details tournament={tournamentData} onNext={goToNextStep} onBack={onBackToList} setIsDirty={setIsDirty} />}
            {currentStep === 2 && <Step2Participants tournament={tournamentData} onNext={goToNextStep} onBack={goToPreviousStep} setIsDirty={setIsDirty} />}
            {currentStep === 3 && <Step3Matches tournament={tournamentData} onNext={goToNextStep} onBack={goToPreviousStep} setIsDirty={setIsDirty} />}
            {currentStep === 4 && <Step4Knockout tournament={tournamentData} onNext={goToNextStep} onBack={goToPreviousStep} setIsDirty={setIsDirty} />}
            {currentStep === 5 && <Step5Confirmation tournament={tournamentData} onBack={goToPreviousStep} onFinish={onBackToList} />}
        </div>
    );
};

export default TournamentWizard;

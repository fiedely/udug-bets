// src/components/admin/TournamentWizard.tsx

import { useState, useEffect, useCallback } from 'react';
import { db } from '../../firebaseConfig';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { Tournament, UserProfile } from '../../types';
import Step1Details from './wizard/Step1Details';
import Step2Participants from './wizard/Step2Participants';
import Step3Matches from './wizard/Step3Matches';
import Step4Knockout from './wizard/Step4Knockout';
import Step5Confirmation from './wizard/Step5Confirmation';


interface TournamentWizardProps {
    tournamentId: string;
    userProfile: UserProfile;
    onBackToList: () => void;
    reportDirtyState: (isDirty: boolean) => void;
}

type WizardStep = 1 | 2 | 3 | 4 | 5;

const TournamentWizard = ({ tournamentId, userProfile, onBackToList, reportDirtyState }: TournamentWizardProps) => {
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

    const STEPS = [
        { num: 1, label: 'Details' },
        { num: 2, label: 'Participants' },
        { num: 3, label: 'Group Matches' },
        { num: 4, label: 'Knockout' },
        { num: 5, label: 'Confirmation' },
    ];

    return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-100 overflow-y-auto w-full">
            <div className="bg-slate-800 p-4 border-b border-slate-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBackToList} className="text-slate-400 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-white">Manage: {tournamentData.name}</h2>
                        <p className="text-sm text-slate-400">Edit Tournament Detail: {tournamentData.name}</p>
                    </div>
                </div>
            </div>

            <div className="p-4 flex flex-col gap-6 max-w-6xl mx-auto w-full">
            <div className="mb-6">
                <div className="flex justify-between text-xs sm:text-sm font-medium text-slate-400 max-w-4xl mx-auto">
                    {STEPS.map(({num, label}) => (
                        <span key={num} className={`text-center ${currentStep >= num ? 'text-blue-400 font-bold' : ''}`}>
                            <span className="sm:hidden">{num}</span>
                            <span className="hidden sm:inline">{num}. {label}</span>
                        </span>
                    ))}
                </div>
            </div>

            {currentStep === 1 && <Step1Details tournament={tournamentData} userProfile={userProfile} onNext={goToNextStep} setIsDirty={setIsDirty} />}
            {currentStep === 2 && <Step2Participants tournament={tournamentData} onNext={goToNextStep} onBack={goToPreviousStep} setIsDirty={setIsDirty} />}
            {currentStep === 3 && <Step3Matches tournament={tournamentData} onNext={goToNextStep} onBack={goToPreviousStep} setIsDirty={setIsDirty} />}
            {currentStep === 4 && <Step4Knockout tournament={tournamentData} onNext={goToNextStep} onBack={goToPreviousStep} setIsDirty={setIsDirty} />}
            {currentStep === 5 && <Step5Confirmation tournament={tournamentData} onBack={goToPreviousStep} onFinish={onBackToList} />}
        </div>
        </div>
    );
};

export default TournamentWizard;

import { useState } from 'react';
import { auth, db, storage } from '../../firebaseConfig';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import type { UserProfile } from '../../types';
import { logAudit } from '../../utils/auditLogger';
import { useTranslation } from 'react-i18next';

interface UserProfileModalProps {
    userProfile: UserProfile;
    onClose: () => void;
    onProfileUpdate: (updatedProfile: UserProfile) => void;
}

const UserProfileModal = ({ userProfile, onClose, onProfileUpdate }: UserProfileModalProps) => {
    const { t, i18n } = useTranslation();
    const [name, setName] = useState(userProfile.name);
    const [language, setLanguage] = useState<'en' | 'id'>(userProfile.language || 'id');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(userProfile.avatarUrl || null);
    
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [profileMessage, setProfileMessage] = useState('');
    const [profileError, setProfileError] = useState('');

    const user = auth.currentUser;

    const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setAvatarPreview(URL.createObjectURL(file));
        }
    };

    const handleProfileSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileError('');
        setProfileMessage('');
        setIsSavingProfile(true);

        if (!user) {
            setProfileError("User not found.");
            setIsSavingProfile(false);
            return;
        }

        try {
            let newAvatarUrl = userProfile.avatarUrl;

            // Upload avatar if a new file is selected
            if (avatarFile) {
                const options = {
                    maxSizeMB: 0.05,
                    maxWidthOrHeight: 256,
                    useWebWorker: true,
                    fileType: 'image/webp'
                };
                const compressedFile = await imageCompression(avatarFile, options);
                
                const storageRef = ref(storage, `users/${user.uid}/avatar`);
                const snapshot = await uploadBytes(storageRef, compressedFile);
                newAvatarUrl = await getDownloadURL(snapshot.ref);
            }

            const userDocRef = doc(db, "users", user.uid);
            const updatedFields: Partial<UserProfile> = {
                name,
                language,
                avatarUrl: newAvatarUrl || null,
            };

            await updateDoc(userDocRef, updatedFields);
            
            await logAudit(userProfile, 'UPDATE_PROFILE', 'User Profile Modal', updatedFields);
            
            i18n.changeLanguage(language);

            // Update Auth Profile
            if (user.displayName !== name || newAvatarUrl) {
                await updateProfile(user, { 
                    displayName: name,
                    photoURL: newAvatarUrl || user.photoURL 
                });
            }

            const updatedDoc = await getDoc(userDocRef);
            onProfileUpdate(updatedDoc.data() as UserProfile);
            
            setProfileMessage("Profile updated successfully!");
            setTimeout(() => {
                setProfileMessage('');
                onClose();
            }, 1500);

        } catch (err) {
            console.error("Error updating profile:", err);
            setProfileError("Failed to update profile. Please try again.");
        } finally {
            setIsSavingProfile(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 p-6 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">{t('profile.title', 'My Profile')}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>

                <form onSubmit={handleProfileSave} className="space-y-4">
                    
                    {profileMessage && <p className="text-green-400 text-sm text-center mt-2">{profileMessage}</p>}
                    {profileError && <p className="text-red-400 text-sm text-center mt-2">{profileError}</p>}

                    <div className="flex flex-col items-center mb-6">
                        <div className="relative w-24 h-24 mb-2">
                            {avatarPreview ? (
                                <img loading="lazy" decoding="async" src={avatarPreview} alt="Avatar Preview" className="w-24 h-24 rounded-full transform-gpu object-cover border-2 border-blue-500" />
                            ) : (
                                <div className="w-24 h-24 rounded-full transform-gpu bg-slate-700 flex items-center justify-center text-slate-400 border-2 border-slate-600">
                                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                                    </svg>
                                </div>
                            )}
                        </div>
                        <label className="cursor-pointer bg-slate-700 hover:bg-slate-600 text-sm text-white px-3 py-1 rounded transition-colors">
                            <span>{t('profile.uploadPhoto', 'Upload your photo')}</span>
                            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                        </label>
                    </div>

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-300">{t('profile.emailAddress', 'Email Address')}</label>
                        <input id="email" type="email" value={userProfile.email} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-400 cursor-not-allowed" disabled />
                    </div>
                    
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-slate-300">{t('profile.displayName', 'Display Name')}</label>
                        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-600 text-slate-100" required />
                    </div>

                    <div>
                        <label htmlFor="language" className="block text-sm font-medium text-slate-300">{t('profile.language', 'Language / Bahasa')}</label>
                        <select id="language" value={language} onChange={(e) => setLanguage(e.target.value as 'en' | 'id')} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-600 text-slate-100">
                            <option value="en">English</option>
                            <option value="id">Bahasa Indonesia</option>
                        </select>
                    </div>
                    
                    <div className="flex justify-end pt-4 border-t border-slate-700">
                        <button type="submit" disabled={isSavingProfile} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 font-semibold text-white rounded disabled:bg-blue-800 disabled:cursor-not-allowed">
                            {isSavingProfile ? t('profile.saving', 'Saving...') : t('profile.saveProfile', 'Save Profile')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserProfileModal;

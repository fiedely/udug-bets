// src/components/views/UserProfileModal.tsx

import { useState } from 'react';
import { auth, db } from '../../firebaseConfig';
import { updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import type { UserProfile } from '../../types';
import { FIFA_COUNTRIES } from '../../data/countries';

interface UserProfileModalProps {
    userProfile: UserProfile;
    onClose: () => void;
    onProfileUpdate: (updatedProfile: UserProfile) => void;
}

const UserProfileModal = ({ userProfile, onClose, onProfileUpdate }: UserProfileModalProps) => {
    const [name, setName] = useState(userProfile.name);
    const [dob, setDob] = useState(userProfile.dob || '');
    const [sex, setSex] = useState(userProfile.sex || '');
    const [favouriteTeam, setFavouriteTeam] = useState(userProfile.favouriteTeam || '');

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    
    const [isSavingProfile, setIsSavingProfile] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    
    // Separate state for messages and errors for each form
    const [profileMessage, setProfileMessage] = useState('');
    const [profileError, setProfileError] = useState('');
    const [passwordMessage, setPasswordMessage] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const user = auth.currentUser;
    const isPasswordUser = user?.providerData.some(p => p.providerId === 'password');

    const handleProfileSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileError('');
        setProfileMessage('');
        setPasswordError('');
        setPasswordMessage('');
        setIsSavingProfile(true);

        if (!user) {
            setProfileError("User not found.");
            setIsSavingProfile(false);
            return;
        }

        try {
            const userDocRef = doc(db, "users", user.uid);
            const updatedFields: Partial<UserProfile> = {
                name,
                dob: dob || null,
                sex: sex || null,
                favouriteTeam: favouriteTeam || null,
            };

            await updateDoc(userDocRef, updatedFields);

            if (user.displayName !== name) {
                await updateProfile(user, { displayName: name });
            }

            const updatedDoc = await getDoc(userDocRef);
            onProfileUpdate(updatedDoc.data() as UserProfile);
            
            setProfileMessage("Profile updated successfully!");
            setTimeout(() => setProfileMessage(''), 3000);

        } catch (err) {
            console.error("Error updating profile:", err);
            setProfileError("Failed to update profile. Please try again.");
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');
        setPasswordMessage('');
        setProfileError('');
        setProfileMessage('');

        if (newPassword !== confirmPassword) {
            setPasswordError("New passwords do not match.");
            return;
        }
        if (newPassword.length < 6) {
            setPasswordError("New password must be at least 6 characters long.");
            return;
        }

        setIsChangingPassword(true);
        if (!user || !user.email) {
            setPasswordError("User not found or email is missing.");
            setIsChangingPassword(false);
            return;
        }

        try {
            const credential = EmailAuthProvider.credential(user.email, currentPassword);
            await reauthenticateWithCredential(user, credential);
            await updatePassword(user, newPassword);
            
            setPasswordMessage("Password changed successfully!");
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setPasswordMessage(''), 3000);

        } catch (err) {
            console.error("Error changing password:", err);
            setPasswordError("Failed to change password. Please check your current password.");
        } finally {
            setIsChangingPassword(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 p-6 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Edit Profile</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl">&times;</button>
                </div>

                <form onSubmit={handleProfileSave} className="space-y-4">
                    <h4 className="text-lg font-semibold text-blue-400 border-b border-slate-600 pb-2">Your Details</h4>
                    
                    {profileMessage && <p className="text-green-400 text-sm text-center mt-2">{profileMessage}</p>}
                    {profileError && <p className="text-red-400 text-sm text-center mt-2">{profileError}</p>}

                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-300">Email Address</label>
                        <input id="email" type="email" value={userProfile.email} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-700 text-slate-400 cursor-not-allowed" disabled />
                    </div>
                    <div>
                        <label htmlFor="name" className="block text-sm font-medium text-slate-300">Display Name</label>
                        <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-600 text-slate-100" required />
                    </div>
                    <div>
                        <label htmlFor="dob" className="block text-sm font-medium text-slate-300">Date of Birth</label>
                        <input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-600 text-slate-100" />
                    </div>
                    <div>
                        <label htmlFor="sex" className="block text-sm font-medium text-slate-300">Sex</label>
                        <select id="sex" value={sex} onChange={(e) => setSex(e.target.value)} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-600 text-slate-100">
                            <option value="">Prefer not to say</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="favouriteTeam" className="block text-sm font-medium text-slate-300">Favourite National Team</label>
                        <select id="favouriteTeam" value={favouriteTeam} onChange={(e) => setFavouriteTeam(e.target.value)} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-600 text-slate-100">
                            <option value="">-- Select a Team --</option>
                            {FIFA_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end">
                        <button type="submit" disabled={isSavingProfile || isChangingPassword} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 font-semibold text-white disabled:bg-blue-800 disabled:cursor-not-allowed">
                            {isSavingProfile ? 'Saving...' : 'Save Profile'}
                        </button>
                    </div>
                </form>

                <div className="mt-6 pt-6 border-t border-slate-700">
                    <h4 className="text-lg font-semibold text-blue-400 border-b border-slate-600 pb-2">Change Password</h4>
                    
                    {passwordMessage && <p className="text-green-400 text-sm text-center mt-4">{passwordMessage}</p>}
                    {passwordError && <p className="text-red-400 text-sm text-center mt-4">{passwordError}</p>}
                    
                    {isPasswordUser ? (
                        <form onSubmit={handlePasswordChange} className="space-y-4 mt-4">
                            <div>
                                <label htmlFor="current-password"  className="block text-sm font-medium text-slate-300">Current Password</label>
                                <input id="current-password" type={showPassword ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-600 text-slate-100" required />
                            </div>
                            <div>
                                <label htmlFor="new-password"  className="block text-sm font-medium text-slate-300">New Password</label>
                                <input id="new-password" type={showPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-600 text-slate-100" required />
                            </div>
                            <div>
                                <label htmlFor="confirm-password"  className="block text-sm font-medium text-slate-300">Confirm New Password</label>
                                <input id="confirm-password" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 w-full px-4 py-2 bg-slate-900 border border-slate-600 text-slate-100" required />
                            </div>
                             <div className="flex items-center">
                                <input id="show-password" type="checkbox" checked={showPassword} onChange={() => setShowPassword(!showPassword)} className="h-4 w-4 bg-slate-700 border-slate-600 text-blue-600 focus:ring-blue-500" />
                                <label htmlFor="show-password" className="ml-2 text-sm text-slate-300">Show Password</label>
                            </div>
                            <div className="flex justify-end">
                                <button type="submit" disabled={isSavingProfile || isChangingPassword} className="px-4 py-2 bg-slate-600 hover:bg-slate-500 font-semibold text-white disabled:bg-slate-700 disabled:cursor-not-allowed">
                                    {isChangingPassword ? 'Saving...' : 'Change Password'}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <div className="mt-4 p-4 bg-slate-700/50 text-slate-300 text-sm">
                            You signed in using a social provider (like Google). You can manage your password through that provider.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserProfileModal;

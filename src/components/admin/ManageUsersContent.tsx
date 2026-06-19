// src/components/admin/ManageUsersContent.tsx

import { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebaseConfig';
import { doc, collection, getDocs, updateDoc } from 'firebase/firestore';
import type { UserProfile } from '../../types';

interface ManageUsersContentProps {
    userProfile: UserProfile | null;
}

const ManageUsersContent = ({ userProfile }: ManageUsersContentProps) => {
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoadingUsers(true);
      const usersCollectionRef = collection(db, "users");
      const querySnapshot = await getDocs(usersCollectionRef);
      const users = querySnapshot.docs.map(doc => doc.data() as UserProfile);

      const roleOrder = { superadmin: 0, admin: 1, user: 2 };
      users.sort((a, b) => {
        if (roleOrder[a.role] < roleOrder[b.role]) return -1;
        if (roleOrder[a.role] > roleOrder[b.role]) return 1;
        return a.name.localeCompare(b.name);
      });

      setUsersList(users);
      setIsLoadingUsers(false);
    };
    fetchUsers();
  }, []);

  const handleRoleChange = async (uid: string, newRole: 'user' | 'admin') => {
    const userDocRef = doc(db, "users", uid);
    await updateDoc(userDocRef, { role: newRole });
    setUsersList(usersList.map(u => u.uid === uid ? { ...u, role: newRole } : u));
  };

  const handleNameChange = async (uid: string) => {
    if (!editingName.trim()) return;
    const userDocRef = doc(db, "users", uid);
    await updateDoc(userDocRef, { name: editingName });
    setUsersList(usersList.map(u => u.uid === uid ? { ...u, name: editingName } : u));
    setEditingUid(null);
  };

  const startEditing = (user: UserProfile) => {
    setEditingUid(user.uid);
    setEditingName(user.name);
  };

  const cancelEditing = () => {
    setEditingUid(null);
    setEditingName('');
  };

  const filteredUsers = useMemo(() => {
    if (!searchTerm) {
      return usersList;
    }
    const lowercasedFilter = searchTerm.toLowerCase();
    return usersList.filter(user =>
      user.name.toLowerCase().includes(lowercasedFilter) ||
      user.email.toLowerCase().includes(lowercasedFilter)
    );
  }, [usersList, searchTerm]);

  if (isLoadingUsers) {
    return <div className="bg-slate-800 border border-slate-700 p-8 text-center"><svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>;
  }

  return (
    <div className="bg-slate-800 border border-slate-700 p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-end items-center mb-4 gap-4">
        <div className="w-full md:w-1/3">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 bg-slate-900 border border-slate-600 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="mt-4">
        <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 text-xs text-slate-400 uppercase bg-slate-700 font-medium">
          <div className="col-span-4">Name</div>
          <div className="col-span-4">Email</div>
          <div className="col-span-2">Role</div>
          {userProfile?.role === 'superadmin' && <div className="col-span-2">Actions</div>}
        </div>
        <div className="space-y-4 md:space-y-0">
          {filteredUsers.map((u) => (
            <div key={u.uid} className="bg-slate-900/50 md:bg-transparent border md:border-t md:border-b-0 border-slate-700 p-4 md:p-0 md:grid md:grid-cols-12 md:gap-4 md:px-4 md:py-3 items-center text-sm">
              <div className="col-span-4 flex items-center">
                 <span className="md:hidden font-semibold text-slate-400 w-20">Name:</span>
                 {editingUid === u.uid && userProfile?.role === 'superadmin' ? (
                    <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)} className="bg-slate-700 border border-slate-600 text-white p-1 w-full" />
                  ) : (
                    <span className="text-white font-medium">{u.name}</span>
                  )}
              </div>
              <div className="col-span-4 mt-2 md:mt-0 flex items-center">
                 <span className="md:hidden font-semibold text-slate-400 w-20">Email:</span>
                 <span className="text-slate-300 truncate">{u.email}</span>
              </div>
              <div className="col-span-2 mt-2 md:mt-0 flex items-center">
                 <span className="md:hidden font-semibold text-slate-400 w-20">Role:</span>
                 {u.role === 'superadmin' ? (
                    <span className="font-bold text-amber-400">Super Admin</span>
                  ) : (
                    <select value={u.role} onChange={(e) => handleRoleChange(u.uid, e.target.value as 'user' | 'admin')} disabled={userProfile?.role === 'admin' && u.role === 'admin'} className="bg-slate-700 border border-slate-600 text-white text-sm focus:ring-blue-500 focus:border-blue-500 block w-full p-2">
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
              </div>
              {userProfile?.role === 'superadmin' && (
                <div className="col-span-2 mt-4 md:mt-0 pt-4 md:pt-0 border-t border-slate-700 md:border-0">
                  {u.role !== 'superadmin' && (
                      editingUid === u.uid ? (
                        <div className="flex gap-4">
                          <button onClick={() => handleNameChange(u.uid)} className="font-medium text-green-500 hover:underline">Save</button>
                          <button onClick={cancelEditing} className="font-medium text-slate-400 hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => startEditing(u)} className="font-medium text-blue-500 hover:underline">Edit Name</button>
                      )
                    )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ManageUsersContent;

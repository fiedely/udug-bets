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
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const savedValue = localStorage.getItem('udug-bets-itemsPerPage');
    return savedValue ? parseInt(savedValue, 10) : 10;
  });
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

  const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = Number(e.target.value);
    setItemsPerPage(newValue);
    setCurrentPage(1);
    localStorage.setItem('udug-bets-itemsPerPage', newValue.toString());
  };

  const totalPages = Math.ceil(usersList.length / itemsPerPage);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return usersList.slice(startIndex, startIndex + itemsPerPage);
  }, [usersList, currentPage, itemsPerPage]);

  if (isLoadingUsers) {
    return <div className="bg-slate-800 border border-slate-700 p-8 text-center"><svg className="animate-spin h-6 w-6 text-blue-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>;
  }

  return (
    <div className="bg-slate-800 border border-slate-700 p-4 md:p-8">
      <h2 className="text-2xl font-bold text-blue-400">Manage Users</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-300">
          <thead className="text-xs text-slate-400 uppercase bg-slate-700">
            <tr>
              <th scope="col" className="px-6 py-3">Name</th>
              <th scope="col" className="px-6 py-3">Email</th>
              <th scope="col" className="px-6 py-3">Role</th>
              {userProfile?.role === 'superadmin' && <th scope="col" className="px-6 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.map((u) => (
              <tr key={u.uid} className="bg-slate-800 border-b border-slate-700 hover:bg-slate-700">
                <td className="px-6 py-4 font-medium text-white">
                  {editingUid === u.uid && userProfile?.role === 'superadmin' ? (
                    <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)} className="bg-slate-900 border border-slate-600 text-white p-1" />
                  ) : (
                    u.name
                  )}
                </td>
                <td className="px-6 py-4">{u.email}</td>
                <td className="px-6 py-4">
                  {u.role === 'superadmin' ? (
                    <span className="font-bold text-amber-400">Super Admin</span>
                  ) : (
                    <select value={u.role} onChange={(e) => handleRoleChange(u.uid, e.target.value as 'user' | 'admin')} disabled={userProfile?.role === 'admin' && u.role === 'admin'} className="bg-slate-900 border border-slate-600 text-white text-sm focus:ring-blue-500 focus:border-blue-500 block w-full p-2">
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                </td>
                {userProfile?.role === 'superadmin' && (
                  <td className="px-6 py-4">
                    {u.role !== 'superadmin' && (
                      editingUid === u.uid ? (
                        <div className="flex gap-2">
                          <button onClick={() => handleNameChange(u.uid)} className="font-medium text-green-500 hover:underline">Save</button>
                          <button onClick={cancelEditing} className="font-medium text-red-500 hover:underline">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => startEditing(u)} className="font-medium text-blue-500 hover:underline">Edit</button>
                      )
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col md:flex-row items-center justify-between mt-4 text-sm text-slate-400 gap-4">
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select value={itemsPerPage} onChange={handleItemsPerPageChange} className="bg-slate-900 border border-slate-600 text-white p-1">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>entries</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Page {currentPage} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:cursor-not-allowed">Previous</button>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:cursor-not-allowed">Next</button>
            </div>
          </div>
        </div>
    </div>
  );
};

export default ManageUsersContent;

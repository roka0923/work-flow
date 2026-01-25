import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { UserCog, Shield } from 'lucide-react';

export default function AdminPanel() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const querySnapshot = await getDocs(collection(db, "users"));
            const userList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(userList);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        try {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, { role: newRole });
            // 로컬 상태 업데이트
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
            alert("권한이 변경되었습니다.");
        } catch (error) {
            console.error("Error updating role:", error);
            alert("권한 변경 실패");
        }
    };

    if (loading) return <div>사용자 목록 로딩 중...</div>;

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '80px' }}>
            <div className="section-header">
                <UserCog size={24} />
                <h1>사용자 권한 관리</h1>
            </div>

            <div className="card-list">
                {users.map(user => (
                    <div key={user.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>{user.name || user.email.split('@')[0]}</h3>
                            <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{user.email}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Shield size={16} color="var(--primary)" />
                            <select
                                value={user.role || 'worker'}
                                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                className="input-field"
                                style={{ width: 'auto', padding: '4px 8px' }}
                            >
                                <option value="admin">관리자 (Admin)</option>
                                <option value="manager">매니저 (Manager)</option>
                                <option value="worker">작업자 (Worker)</option>
                            </select>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

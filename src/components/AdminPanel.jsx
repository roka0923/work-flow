import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { UserCog, Shield } from 'lucide-react';

export default function AdminPanel() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const querySnapshot = await getDocs(collection(db, "users"));
            const userList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(userList);
            if (userList.length === 0) {
                console.warn("No users found in Firestore 'users' collection.");
            }
        } catch (error) {
            console.error("Error fetching users:", error);
            setError(error.message || "사용자 목록을 불러오는 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (userId, newRole) => {
        try {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, { role: newRole });
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch (error) {
            console.error("Error updating role:", error);
            alert("권한 변경 실패");
        }
    };

    const handleStartNameEdit = (user) => {
        setEditingId(user.id);
        setEditName(user.name || '');
    };

    const handleSaveName = async (userId) => {
        try {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, { name: editName });
            setUsers(users.map(u => u.id === userId ? { ...u, name: editName } : u));
            setEditingId(null);
        } catch (error) {
            console.error("Error updating name:", error);
            alert("이름 변경 실패");
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
                {error && (
                    <div className="card" style={{ border: '1px solid var(--danger)', color: 'var(--danger)', textAlign: 'center', padding: '20px' }}>
                        <p><strong>오류 발생:</strong> {error}</p>
                        <p style={{ fontSize: '12px', marginTop: '8px' }}>Firestore 보안 규칙 또는 권한 설정을 확인해 주세요.</p>
                        <button onClick={fetchUsers} className="btn-secondary" style={{ marginTop: '10px' }}>다시 시도</button>
                    </div>
                )}

                {!error && users.length === 0 && (
                    <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                        등록된 사용자가 없습니다. 첫 로그인이 완료되어야 목록에 나타납니다.
                    </div>
                )}

                {users.map(user => (
                    <div key={user.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ flex: 1 }}>
                            {editingId === user.id ? (
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        style={{ width: '150px', padding: '4px 8px' }}
                                        autoFocus
                                    />
                                    <button onClick={() => handleSaveName(user.id)} className="btn-primary" style={{ padding: '4px 8px', fontSize: '12px' }}>저장</button>
                                    <button onClick={() => setEditingId(null)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }}>취소</button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <h3 style={{ margin: 0, fontSize: '16px' }}>{user.name || user.email.split('@')[0]}</h3>
                                    <button
                                        onClick={() => handleStartNameEdit(user)}
                                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '12px', padding: 0 }}
                                    >수정</button>
                                </div>
                            )}
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

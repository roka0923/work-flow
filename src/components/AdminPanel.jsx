import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { UserCog, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function AdminPanel() {
    const { permissions: authContextPermissions } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        console.log("AdminPanel: fetchUsers started. DB instance:", !!db);
        setLoading(true);
        setError(null);
        try {
            if (!db) {
                throw new Error("Firestore 데이터베이스가 초기화되지 않았습니다. config.js를 확인해 주세요.");
            }
            const querySnapshot = await getDocs(collection(db, "users"));
            console.log("AdminPanel: Snapshot received. Size:", querySnapshot.size);
            const userList = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(userList);
        } catch (error) {
            console.error("AdminPanel fetch error:", error);
            setError(`데이터 로드 실패: ${error.message}`);
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

    const handleSavePermission = async (role, key, value) => {
        try {
            const permRef = doc(db, "settings", "permissions");
            await setDoc(permRef, {
                ...authPermissions,
                [role]: {
                    ...authPermissions[role],
                    [key]: value
                }
            });
        } catch (error) {
            console.error("Error updating permission:", error);
            alert("권한 설정 저장 실패");
        }
    };

    if (loading) return <div>사용자 목록 로딩 중...</div>;

    const authPermissions = authContextPermissions || {
        manager: { canRequest: false, canDelete: false, canSettings: false },
        worker: { canRequest: false, canDelete: false, canSettings: false }
    };

    return (
        <div className="animate-fade-in" style={{ paddingBottom: '120px' }}>
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
                                    <h3 style={{ margin: 0, fontSize: '16px' }}>{user.name || user.email?.split('@')[0] || '사용자'}</h3>
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

            <div className="section-header" style={{ marginTop: '40px' }}>
                <Shield size={24} />
                <h1>역할별 상세 권한 설정</h1>
            </div>

            <div className="card">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--glass-border)' }}>
                            <th style={{ padding: '12px', fontSize: '14px', color: 'var(--text-muted)' }}>역할</th>
                            <th style={{ padding: '12px', fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center' }}>작업지시</th>
                            <th style={{ padding: '12px', fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center' }}>데이터삭제</th>
                            <th style={{ padding: '12px', fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center' }}>설정접근</th>
                        </tr>
                    </thead>
                    <tbody>
                        {['manager', 'worker'].map(role => (
                            <tr key={role} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                <td style={{ padding: '12px', fontWeight: 'bold', textTransform: 'capitalize' }}>{role}</td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={authPermissions[role].canRequest}
                                        onChange={(e) => handleSavePermission(role, 'canRequest', e.target.checked)}
                                        className="stage-checkbox"
                                    />
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={authPermissions[role].canDelete}
                                        onChange={(e) => handleSavePermission(role, 'canDelete', e.target.checked)}
                                        className="stage-checkbox"
                                    />
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={authPermissions[role].canSettings}
                                        onChange={(e) => handleSavePermission(role, 'canSettings', e.target.checked)}
                                        className="stage-checkbox"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    * 관리자(Admin)는 항상 모든 권한을 가집니다. 변경 사항은 즉시 시스템 전체에 반영됩니다.
                </p>
            </div>
        </div>
    );
}

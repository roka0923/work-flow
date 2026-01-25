import React, { createContext, useContext, useState, useEffect } from 'react';
import {
    onAuthStateChanged,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    signInWithEmailAndPassword
} from 'firebase/auth';
import {
    doc,
    getDoc,
    setDoc,
    onSnapshot,
    serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null); // 'admin', 'manager', 'worker'
    const [permissions, setPermissions] = useState({
        manager: { canRequest: false, canDelete: false, canSettings: false },
        worker: { canRequest: false, canDelete: false, canSettings: false }
    });
    const [loading, setLoading] = useState(true);

    // 글로벌 권한 설정 실시간 수신
    useEffect(() => {
        const permRef = doc(db, "settings", "permissions");
        const unsubscribe = onSnapshot(permRef, (docSnap) => {
            if (docSnap.exists()) {
                setPermissions(docSnap.data());
            } else {
                // 기본값 생성 (최초 1회)
                setDoc(permRef, {
                    manager: { canRequest: false, canDelete: false, canSettings: false },
                    worker: { canRequest: false, canDelete: false, canSettings: false }
                });
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            try {
                if (user) {
                    // 로그인 된 경우 Firestore에서 사용자 정보(Role) 조회
                    const userRef = doc(db, "users", user.uid);
                    const userSnap = await getDoc(userRef);

                    if (userSnap.exists()) {
                        // 기존 사용자: 역할 정보 가져오기
                        const userData = userSnap.data();
                        setUserRole(userData.role || 'worker');
                    } else {
                        // 신규 사용자: DB에 등록 (기본 역할: worker)
                        const newUser = {
                            email: user.email,
                            name: user.displayName || user.email?.split('@')[0] || '사용자',
                            role: 'worker',
                            createdAt: serverTimestamp()
                        };
                        // 여기서 권한 문제 등으로 실패할 수 있으므로 개별 try-catch 또는 상위 catch로 유도
                        await setDoc(userRef, newUser);
                        setUserRole('worker');
                    }
                    setCurrentUser(user);
                } else {
                    // 로그아웃 된 경우
                    setCurrentUser(null);
                    setUserRole(null);
                }
            } catch (error) {
                console.error("Auth Listener Error:", error);
                // 에러 발생 시에도 최소한 로그아웃 상태이거나 기본 사용자 정보는 초기화
                setCurrentUser(user || null);
                setUserRole('worker'); // 에러 시 기본 권한이라도 부여하거나, 아예 null
            } finally {
                setLoading(false);
            }
        });

        return unsubscribe;
    }, []);

    // [임시] 개발용 Admin 승격 도구
    useEffect(() => {
        if (currentUser) {
            window.promoteMe = async () => {
                try {
                    const userRef = doc(db, "users", currentUser.uid);
                    await setDoc(userRef, { role: 'admin' }, { merge: true });
                    setUserRole('admin');
                    alert(`✅ ${currentUser.email} 계정이 관리자(Admin)로 변경되었습니다!`);
                } catch (e) {
                    console.error(e);
                    alert("오류가 발생했습니다.");
                }
            };
            console.log("%c🔧 개발자 도구: 콘솔에 window.promoteMe() 를 입력하면 현재 계정이 관리자로 변경됩니다.", "color: #00bcd4; font-size: 12px; font-weight: bold;");
        }
    }, [currentUser]);

    const loginWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Google Login Error:", error);
            throw error;
        }
    };

    const loginWithEmail = async (email, password) => {
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error("Email Login Error:", error);
            throw error;
        }
    };

    const logout = () => {
        return signOut(auth);
    };

    // 역할 및 권한 체크 유틸리티
    const checkPermission = (action) => {
        if (userRole === 'admin') return true;
        if (!userRole || !permissions[userRole]) return false;

        switch (action) {
            case 'request': return permissions[userRole].canRequest;
            case 'delete': return permissions[userRole].canDelete;
            case 'settings': return permissions[userRole].canSettings;
            default: return false;
        }
    };

    const value = {
        currentUser,
        userRole,
        permissions,
        loginWithGoogle,
        loginWithEmail,
        logout,
        isAdmin: userRole === 'admin',
        isManager: userRole === 'manager' || userRole === 'admin',
        canRequest: checkPermission('request'),
        canDelete: checkPermission('delete'),
        canSettings: checkPermission('settings')
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

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
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
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
                    // 단, 초기 관리자 설정을 위해 특정 이메일은 admin으로 설정할 수도 있음 (여기서는 생략하고 기본 worker)
                    const newUser = {
                        email: user.email,
                        name: user.displayName || user.email.split('@')[0],
                        role: 'worker',
                        createdAt: serverTimestamp()
                    };
                    await setDoc(userRef, newUser);
                    setUserRole('worker');
                }
                setCurrentUser(user);
            } else {
                // 로그아웃 된 경우
                setCurrentUser(null);
                setUserRole(null);
            }
            setLoading(false);
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

    const value = {
        currentUser,
        userRole,
        loginWithGoogle,
        loginWithEmail,
        logout,
        isAdmin: userRole === 'admin',
        isManager: userRole === 'manager' || userRole === 'admin'
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

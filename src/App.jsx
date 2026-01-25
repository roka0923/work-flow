import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import JobRequest from './components/JobRequest';
import ProcessList from './components/ProcessList';
import Settings from './components/Settings';
import { Layout } from './components/Layout';
import { useJobs } from './hooks/useJobs';
import { useStaff } from './hooks/useStaff';
import Login from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Home, PlusCircle, List, Settings as SettingsIcon, Users } from 'lucide-react';
import AdminPanel from './components/AdminPanel';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from './firebase/config';
import { requestNotificationPermission } from './utils/notifications';

function AppContent() {
    const { currentUser, userRole, logout, isAdmin, isManager, canRequest, canSettings, isAuthReady } = useAuth();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [processFilter, setProcessFilter] = useState(null);
    const [prefillData, setPrefillData] = useState(null);

    // 모바일 뒤로가기 종료 방지 및 탭 내비게이션
    useEffect(() => {
        // ... (이전 코드 동일)
    }, [activeTab]);

    const jobsHook = isAuthReady ? useJobs() : null;
    const {
        jobs = [],
        deletedJobs = [],
        loading: jobsLoading = true,
        error: jobsError = null,
        addJob = () => { },
        editJob = () => { },
        deleteJob = () => { },
        restoreJob = () => { },
        permanentDeleteJob = () => { },
        clearDeletedJobs = () => { },
        resetJobs = () => { },
        updateJobStatus = () => { }
    } = jobsHook || {};

    const loading = !isAuthReady || jobsLoading;
    const error = jobsError;

    const [staffNames, setStaffNames] = useState([]);

    // Firestore에서 직원 목록(이름) 실시간 동기화
    useEffect(() => {
        if (!currentUser) return;

        const q = query(collection(db, "users"), orderBy("name", "asc"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const names = snapshot.docs.map(doc => {
                const data = doc.data();
                return data.name || data.email?.split('@')[0] || '사용자';
            });
            setStaffNames(names);
        });

        return () => unsubscribe();
    }, [currentUser]);

    // 역할 및 동적 권한별 탭 정의
    const getTabs = () => {
        const tabs = [
            { id: 'dashboard', label: '대시보드', icon: <Home size={24} /> }
        ];

        // 모든 사용자는 공정관리 접근 가능
        tabs.push({ id: 'process', label: '공정관리', icon: <List size={24} /> });

        // 동적 권한에 따른 탭 추가
        if (canRequest) {
            tabs.push({ id: 'request', label: '작업지시', icon: <PlusCircle size={24} /> });
        }

        if (canSettings) {
            tabs.push({ id: 'settings', label: '설정', icon: <SettingsIcon size={24} /> });
        }

        // Admin 전용 사용자관리 탭
        if (isAdmin) {
            tabs.push({ id: 'admin', label: '사용자관리', icon: <Users size={24} /> });
        }

        return tabs;
    };

    const tabs = getTabs();

    // 탭 권한 확인 및 리다이렉트
    useEffect(() => {
        if (!tabs.find(t => t.id === activeTab)) {
            setActiveTab('dashboard');
        }
    }, [userRole, activeTab]);

    // Reset process filter when navigating away from process page
    useEffect(() => {
        if (activeTab !== 'process') {
            setProcessFilter(null);
        }
    }, [activeTab]);

    // 로그인 후 알림 권한 요청 - 임시 비활성화
    // useEffect(() => {
    //     if (currentUser) {
    //         // 로그인 성공 시 알림 권한 요청
    //         requestNotificationPermission().then(granted => {
    //             if (granted) {
    //                 console.log('알림 권한 허용됨');
    //             } else {
    //                 console.log('알림 권한 거부됨 또는 지원하지 않는 브라우저');
    //             }
    //         });
    //     }
    // }, [currentUser]);

    if (!isAuthReady) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
                <div className="loader"></div>
                <p>인증 처리 중...</p>
            </div>
        );
    }

    if (!currentUser) {
        return <Login />;
    }

    if (loading) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '1rem' }}>
            <div className="loader"></div>
            <p>데이터를 불러오는 중...</p>
        </div>
    );

    if (error) return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', color: 'var(--danger-color)', textAlign: 'center', padding: '2rem' }}>
            <h2>연결 오류</h2>
            <p>{error}</p>
            <button onClick={() => window.location.reload()} style={{ marginTop: '1rem', padding: '0.5rem 1rem', borderRadius: '8px', background: 'var(--primary-color)', color: 'white', border: 'none' }}>다시 시도</button>
        </div>
    );

    const handleAddJob = (data) => {
        addJob(data);
        setActiveTab('process');
    };

    const handlePrefillRequest = (data) => {
        setPrefillData(data);
        setActiveTab('request');
    };

    const handleResetData = () => {
        resetJobs();
        setActiveTab('dashboard');
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return <Dashboard jobs={jobs} onStageClick={(stage) => {
                    setProcessFilter(stage);
                    setActiveTab('process');
                }} />;
            case 'request':
                return canRequest ? <JobRequest onAddJob={handleAddJob} prefillData={prefillData} onClearPrefill={() => setPrefillData(null)} staffNames={staffNames} /> : <div>권한이 없습니다.</div>;
            case 'process':
                return (
                    <ProcessList
                        jobs={jobs}
                        staffNames={staffNames}
                        filter={processFilter}
                        onClearFilter={() => setProcessFilter(null)}
                        onUpdateStatus={updateJobStatus}
                        onDeleteJob={deleteJob}
                        onEditJob={editJob}
                        onAddJob={handleAddJob}
                        onPrefillRequest={handlePrefillRequest}
                    />
                );
            case 'settings':
                return canSettings ? <Settings
                    jobsCount={jobs.length}
                    onResetData={handleResetData}
                    staffNames={staffNames}
                    setStaffNames={setStaffNames}
                    deletedJobs={deletedJobs}
                    onRestoreJob={restoreJob}
                    onPermanentDelete={permanentDeleteJob}
                    onClearTrash={clearDeletedJobs}
                /> : <div>권한이 없습니다.</div>;
            case 'admin':
                return <AdminPanel />;
            default:
                return <Dashboard jobs={jobs} />;
        }
    };

    return (
        <Layout activeTab={activeTab} setActiveTab={setActiveTab} tabs={tabs}>
            <div style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1000 }}>
                <button onClick={logout} className="btn-secondary" style={{ padding: '8px 12px', fontSize: '12px' }}>로그아웃 ({currentUser.email})</button>
            </div>
            {renderContent()}
        </Layout>
    );
}

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

export default App;
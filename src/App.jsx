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

function AppContent() {
    const { currentUser, userRole, logout, isAdmin, isManager } = useAuth();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [processFilter, setProcessFilter] = useState(null);
    const [prefillData, setPrefillData] = useState(null);

    const {
        jobs,
        deletedJobs,
        loading,
        error,
        addJob,
        editJob,
        deleteJob,
        restoreJob,
        permanentDeleteJob,
        clearDeletedJobs,
        resetJobs,
        updateJobStatus
    } = useJobs();

    const {
        staffNames,
        setStaffNames
    } = useStaff();

    // 역할별 탭 정의
    const getTabs = () => {
        const tabs = [
            { id: 'dashboard', label: '대시보드', icon: <Home size={24} /> }
        ];

        // manager, admin은 공정관리 접근 가능
        if (isManager) {
            tabs.push({ id: 'process', label: '공정관리', icon: <List size={24} /> });
        } else {
            // worker도 공정관리는 볼 수 있게 (본인 작업 체크용) - 요구사항 3번 worker: 자신의 작업만 조회. 
            // 현재 구조상 worker도 공정관리 탭 자체는 접근해야 함.
            tabs.push({ id: 'process', label: '공정관리', icon: <List size={24} /> });
        }

        // admin은 모든 탭 접근 가능 (작업지시, 설정, 관리자)
        if (isAdmin) {
            tabs.push({ id: 'request', label: '작업지시', icon: <PlusCircle size={24} /> });
            tabs.push({ id: 'settings', label: '설정', icon: <SettingsIcon size={24} /> });
            tabs.push({ id: 'admin', label: '사용자관리', icon: <Users size={24} /> });
        } else if (isManager) {
            // manager는 작업지시 불가능(요구사항), 설정은? 언급없으므로 제외 또는 포함. 
            // 요구사항: manager: 생산 현황 조회 및 수정.
            // 일단 manager에게 작업지시는 안줌.
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
                return isAdmin ? <JobRequest onAddJob={handleAddJob} prefillData={prefillData} onClearPrefill={() => setPrefillData(null)} staffNames={staffNames} /> : <div>권한이 없습니다.</div>;
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
                return isAdmin ? <Settings
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
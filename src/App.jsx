import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import JobRequest from './components/JobRequest';
import ProcessList from './components/ProcessList';
import Settings from './components/Settings';
import { Layout } from './components/Layout';
import { useJobs } from './hooks/useJobs';
import { useStaff } from './hooks/useStaff';

function App() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [processFilter, setProcessFilter] = useState(null);
    const [prefillData, setPrefillData] = useState(null);

    const {
        jobs,
        deletedJobs,
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

    // Reset process filter when navigating away from process page
    useEffect(() => {
        if (activeTab !== 'process') {
            setProcessFilter(null);
        }
    }, [activeTab]);

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
                return <JobRequest onAddJob={handleAddJob} prefillData={prefillData} onClearPrefill={() => setPrefillData(null)} staffNames={staffNames} />;
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
                return <Settings
                    jobsCount={jobs.length}
                    onResetData={handleResetData}
                    staffNames={staffNames}
                    setStaffNames={setStaffNames}
                    deletedJobs={deletedJobs}
                    onRestoreJob={restoreJob}
                    onPermanentDelete={permanentDeleteJob}
                    onClearTrash={clearDeletedJobs}
                />;
            default:
                return <Dashboard jobs={jobs} />;
        }
    };

    return (
        <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
            {renderContent()}
        </Layout>
    );
}

export default App;

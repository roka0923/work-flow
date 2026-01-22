import { useState, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { LOCAL_STORAGE_KEYS, TEN_DAYS_MS } from '../config/constants';

export function useJobs() {
    const [jobs, setJobs] = useLocalStorage(LOCAL_STORAGE_KEYS.JOBS, []);
    const [deletedJobs, setDeletedJobs] = useLocalStorage(LOCAL_STORAGE_KEYS.DELETED_JOBS, []);

    // Initial Migration & Cleanup
    useEffect(() => {
        // Migration: Ensure all jobs have a groupId
        let migrated = false;
        const migratedJobs = jobs.map((job, index) => {
            if (!job.groupId) {
                migrated = true;
                return { ...job, groupId: `${job.id}_${index}` };
            }
            return job;
        });

        if (migrated) {
            setJobs(migratedJobs);
        }

        // Cleanup: Remove deleted jobs older than 10 days
        const now = Date.now();
        const filteredDeleted = deletedJobs.filter(job =>
            (now - new Date(job.deletedAt).getTime()) < TEN_DAYS_MS
        );
        if (filteredDeleted.length !== deletedJobs.length) {
            setDeletedJobs(filteredDeleted);
        }
    }, []);

    const addJob = (newJobOrJobs) => {
        const newJobs = Array.isArray(newJobOrJobs) ? newJobOrJobs : [newJobOrJobs];
        setJobs(current => [...newJobs, ...current]);
    };

    const editJob = (jobId, updatedData) => {
        setJobs(current => current.map(job =>
            job.id === jobId ? { ...job, ...updatedData, lastUpdated: new Date().toISOString() } : job
        ));
    };

    const deleteJob = (targetIds) => {
        const ids = Array.isArray(targetIds) ? targetIds : [targetIds];
        const now = new Date().toISOString();

        const jobsToDelete = jobs.filter(j => ids.includes(j.id));
        if (jobsToDelete.length > 0) {
            setDeletedJobs(prev => [
                ...jobsToDelete.map(j => ({ ...j, deletedAt: now })),
                ...prev
            ]);
        }
        setJobs(current => current.filter(job => !ids.includes(job.id)));
    };

    const restoreJob = (jobId) => {
        const jobToRestore = deletedJobs.find(j => j.id === jobId);
        if (jobToRestore) {
            const { deletedAt, ...restoredJob } = jobToRestore;
            setJobs(current => [restoredJob, ...current]);
            setDeletedJobs(current => current.filter(j => j.id !== jobId));
        }
    };

    const permanentDeleteJob = (jobId) => {
        setDeletedJobs(current => current.filter(j => j.id !== jobId));
    };

    const resetJobs = () => {
        setJobs([]);
        localStorage.removeItem(LOCAL_STORAGE_KEYS.JOBS);
    };

    const clearDeletedJobs = () => {
        setDeletedJobs([]);
    };

    const updateJobStatus = (targetIds, stage, staffName) => {
        const ids = Array.isArray(targetIds) ? targetIds : [targetIds];

        setJobs(prevJobs => prevJobs.map(job => {
            if (ids.includes(job.id)) {
                const isCompleting = !job.status[stage];
                const updatedJob = { ...job };

                updatedJob.status = {
                    ...job.status,
                    [stage]: isCompleting,
                    lastUpdated: new Date().toISOString()
                };

                if (isCompleting) {
                    const historyItem = {
                        stage,
                        staffName,
                        timestamp: new Date().toISOString()
                    };
                    updatedJob.history = [...(job.history || []), historyItem];
                }

                return updatedJob;
            }
            return job;
        }));
    };

    return {
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
    };
}

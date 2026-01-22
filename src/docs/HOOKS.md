# Caliper Flow Hooks Documentation

## `useJobs`

Main hook for managing job data and lifecycle.

### State
- `jobs`: Array of active job objects.
- `deletedJobs`: Array of recently deleted jobs (for restoration).

### API
- `addJob(newJobOrJobs)`: Adds one or multiple jobs.
- `editJob(jobId, updatedData)`: Updates specific job fields.
- `deleteJob(targetIds)`: Moves jobs to the deleted list.
- `restoreJob(jobId)`: Restores a job from the deleted list.
- `permanentDeleteJob(jobId)`: Completely removes a job.
- `updateJobStatus(targetIds, stage, staffName)`: Toggles status for specific stage.
- `resetJobs()`: Clears all job data.

## `useStaff`

Hook for managing staff names and preferences.

### State
- `staffNames`: Array of registered staff names.

### API
- `setStaffNames(names)`: Update the list of staff names.
- `resetStaff()`: Resets to default staff names.

## `useLocalStorage`

Low-level utility hook for synchronizing state with `localStorage`.

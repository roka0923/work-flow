import { useLocalStorage } from './useLocalStorage';
import { LOCAL_STORAGE_KEYS } from '../config/constants';

const DEFAULT_STAFF = ['홍길동', '김철수', '이영희'];

export function useStaff() {
    const [staffNames, setStaffNames] = useLocalStorage(LOCAL_STORAGE_KEYS.STAFF, DEFAULT_STAFF);

    const resetStaff = () => {
        setStaffNames(DEFAULT_STAFF);
    };

    return {
        staffNames,
        setStaffNames,
        resetStaff
    };
}

import { useState, useEffect } from 'react';

/**
 * Custom hook for managing state synchronized with localStorage.
 * @param {string} key - The key for localStorage.
 * @param {any} initialValue - The initial value if no data is found in localStorage.
 * @returns {[any, Function]} - The state and a setter function.
 */
export function useLocalStorage(key, initialValue) {
    const [value, setValue] = useState(() => {
        const saved = localStorage.getItem(key);
        if (saved !== null) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                console.error(`Error parsing localStorage key "${key}":`, e);
            }
        }
        return initialValue;
    });

    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);

    return [value, setValue];
}

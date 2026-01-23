import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { rtdb } from '../firebase/config';

export const useProducts = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Load all products from Firebase and cache in state
        const productsRef = ref(rtdb, 'products');
        const unsubscribe = onValue(productsRef, (snapshot) => {
            try {
                const data = snapshot.val();
                if (data) {
                    const productsArray = Object.entries(data).map(([id, product]) => ({
                        id,
                        ...product
                    }));
                    setProducts(productsArray);
                } else {
                    setProducts([]);
                }
                setLoading(false);
            } catch (err) {
                console.error("Firebase Products Read Error:", err);
                setError("품목 정보를 불러오는 중 오류가 발생했습니다.");
                setLoading(false);
            }
        }, (err) => {
            console.error("Firebase Products Subscription Error:", err);
            setError(err.message);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const searchProducts = (query) => {
        if (!query || query.trim() === '') return [];
        const lowerQuery = query.toLowerCase();

        // Fast filtering from local cache
        return products.filter(p =>
            p.productName?.toLowerCase().includes(lowerQuery) ||
            p.productNumber?.includes(lowerQuery)
        ).slice(0, 50); // Limit to 50 results for UI performance
    };

    return { products, loading, error, searchProducts };
};

import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, KeyRound, Mail } from 'lucide-react';

export default function Login() {
    const { loginWithGoogle, loginWithEmail } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        try {
            setError('');
            setLoading(true);
            await loginWithGoogle();
        } catch (err) {
            setError('Google 로그인에 실패했습니다. 관리자에게 문의하세요.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        if (!email || !password) return;

        try {
            setError('');
            setLoading(true);
            await loginWithEmail(email, password);
        } catch (err) {
            setError('이메일 또는 비밀번호가 올바르지 않습니다.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            color: 'var(--text-main)'
        }}>
            <div className="card" style={{
                width: '100%',
                maxWidth: '400px',
                padding: '40px',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                    <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        background: 'rgba(34, 211, 238, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px'
                    }}>
                        <LogIn size={32} color="var(--primary)" />
                    </div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Work Flow 로그인</h1>
                    <p style={{ color: 'var(--text-muted)' }}>직원 계정으로 접속해주세요</p>
                </div>

                {error && (
                    <div style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#fca5a5',
                        padding: '12px',
                        borderRadius: '8px',
                        fontSize: '14px',
                        marginBottom: '20px',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        className="btn"
                        style={{
                            background: '#ffffff',
                            color: '#000000',
                            border: '1px solid #ddd',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '12px',
                            fontWeight: '600',
                            height: '50px'
                        }}
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width={18} />
                        Google 계정으로 계속하기
                    </button>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        margin: '20px 0',
                        color: 'var(--text-muted)',
                        fontSize: '12px'
                    }}>
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                        OR
                        <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                    </div>

                    <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-item">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Mail size={14} /> 이메일
                            </label>
                            <input
                                type="email"
                                className="input-field"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="name@company.com"
                                style={{ height: '44px' }}
                            />
                        </div>
                        <div className="form-item">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <KeyRound size={14} /> 비밀번호
                            </label>
                            <input
                                type="password"
                                className="input-field"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                style={{ height: '44px' }}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading || !email || !password}
                            className="btn btn-primary"
                            style={{ height: '50px', marginTop: '10px' }}
                        >
                            {loading ? '로그인 중...' : '이메일로 로그인'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

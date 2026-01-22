import React from 'react';
import { Home, PlusCircle, List, Settings } from 'lucide-react';

export function Layout({ children, activeTab, setActiveTab }) {
    return (
        <div className="layout">
            <main className="main-content">
                {children}
            </main>

            <nav className="nav-bar glass">
                <div
                    className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setActiveTab('dashboard')}
                >
                    <Home size={24} />
                    <span style={{ fontSize: '10px' }}>대시보드</span>
                </div>
                <div
                    className={`nav-item ${activeTab === 'request' ? 'active' : ''}`}
                    onClick={() => setActiveTab('request')}
                >
                    <PlusCircle size={24} />
                    <span style={{ fontSize: '10px' }}>작업지시</span>
                </div>
                <div
                    className={`nav-item ${activeTab === 'process' ? 'active' : ''}`}
                    onClick={() => setActiveTab('process')}
                >
                    <List size={24} />
                    <span style={{ fontSize: '10px' }}>공정관리</span>
                </div>
                <div
                    className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                >
                    <Settings size={24} />
                    <span style={{ fontSize: '10px' }}>설정</span>
                </div>
            </nav>
        </div>
    );
}

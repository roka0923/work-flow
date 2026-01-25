import React from 'react';
import { Home, PlusCircle, List, Settings } from 'lucide-react';

export function Layout({ children, activeTab, setActiveTab, tabs }) {
    return (
        <div className="layout">
            <main className="main-content">
                {children}
            </main>

            <nav className="nav-bar glass">
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.icon}
                        <span style={{ fontSize: '10px' }}>{tab.label}</span>
                    </div>
                ))}
            </nav>
        </div>
    );
}

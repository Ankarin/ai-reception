'use client';

import { use, useState, useEffect } from 'react';
import { MessageSquare, X } from 'lucide-react';

export default function MobileWidgetPage({
    params,
}: {
    params: Promise<{ orgId: string; chatId: string }>;
}) {
    const { orgId, chatId } = use(params);
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);

        if (window.parent !== window) {
            window.parent.postMessage(
                { type: 'widget-resize', isOpen },
                '*'
            );
        }
    }, [isOpen]);

    if (!mounted) {
        return null;
    }

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
        body { position: fixed; top: 0; left: 0; right: 0; bottom: 0; }
      `}} />

            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    style={{
                        position: 'fixed',
                        bottom: '20px',
                        right: '20px',
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        background: '#171717',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                        zIndex: 999999,
                    }}
                >
                    <MessageSquare size={28} />
                </button>
            )}

            {isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 0,
                        right: 0,
                        width: '100%',
                        height: '100%',
                        background: 'white',
                        display: 'flex',
                        flexDirection: 'column',
                        zIndex: 999998,
                    }}
                >
                    <div
                        style={{
                            background: '#f5f5f5',
                            padding: '16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: '1px solid #e5e5e5',
                        }}
                    >
                        <div>
                            <div style={{ fontWeight: 'bold', color: '#0a0a0a' }}>Chat Support</div>
                            <div style={{ fontSize: '12px', color: '#737373' }}>We reply instantly</div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px',
                                color: '#0a0a0a',
                            }}
                        >
                            <X size={24} />
                        </button>
                    </div>
                    <div
                        style={{
                            flex: 1,
                            padding: '20px',
                            overflowY: 'auto',
                        }}
                    >
                        <p>Chat for Org: {orgId}</p>
                        <p>Chat ID: {chatId}</p>
                        <p style={{ marginTop: '10px' }}>✅ This is a CLIENT-ONLY React widget</p>
                        <p>✅ NO server-side rendering</p>
                        <p>✅ NO hydration issues</p>
                        <p>✅ Works in mobile iframes!</p>
                    </div>
                </div>
            )}
        </>
    );
}


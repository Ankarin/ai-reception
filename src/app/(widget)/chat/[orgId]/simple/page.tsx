'use client';

import { use, useState, useEffect } from 'react';

export default function SimpleChatPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = use(params);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    window.parent.postMessage(
      { type: 'widget-resize', isOpen },
      '*'
    );
  }, [isOpen]);

  return (
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style dangerouslySetInnerHTML={{
          __html: `
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
          body { position: fixed; top: 0; left: 0; right: 0; bottom: 0; }
        `}} />
      </head>
      <body>
        {!isOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              background: 'blue',
              color: 'white',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 'bold',
            }}
          >
            <div style={{ marginBottom: '10px' }}>REACT TEST</div>
            <button
              onClick={() => setIsOpen(true)}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'black',
                color: 'white',
                border: '5px solid yellow',
                fontSize: '40px',
                cursor: 'pointer',
              }}
            >
              💬
            </button>
            <div style={{ marginTop: '10px', fontSize: '16px' }}>
              If you see this, React works!
            </div>
            <div style={{ marginTop: '5px', fontSize: '12px' }}>
              OrgId: {orgId}
            </div>
          </div>
        )}

        {isOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              background: 'green',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              fontSize: '24px',
            }}
          >
            <div>CHAT OPENED!</div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                fontSize: '16px',
                background: 'red',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        )}
      </body>
    </html>
  );
}


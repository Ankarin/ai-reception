(function () {
    if (window.aiReceptionistWidgetLoaded) return;
    window.aiReceptionistWidgetLoaded = true;

    const config = window.ChatConfig || window.ChatConfig || {};

    const ORG_ID = config.orgId;
    if (!ORG_ID) {
        console.error('[AI Receptionist Widget] Missing orgId. Set window.ChatConfig = { orgId: "your_org_id" } before loading the script.');
        return;
    }

    const BASE_URL = config.baseUrl || 'http://localhost:3000';
    const WIDGET_URL = BASE_URL + '/chat/' + ORG_ID;

    let primaryColor = '#171717';
    let textSecondaryColor = '#fafafa';
    let widgetSettings = null;

    const style = document.createElement('style');
    function updateStyles() {
        style.textContent = `
            #ai-receptionist-widget-button {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 80px;
                height: 80px;
                border-radius: 50%;
                background: ${primaryColor};
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
                z-index: 2147483647;
                transition: transform 0.2s ease;
            }
            #ai-receptionist-widget-button:hover {
                transform: scale(1.1);
            }
            #ai-receptionist-widget-button svg {
                width: 34px;
                height: 34px;
                color: ${textSecondaryColor};
            }
            #ai-receptionist-chat-iframe {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 420px;
                height: 650px;
                max-width: calc(100vw - 40px);
                max-height: calc(100vh - 40px);
                border: none;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
                z-index: 2147483647;
                display: none;
            }
            @media (max-width: 768px) {
                #ai-receptionist-chat-iframe {
                    bottom: 0;
                    right: 0;
                    width: 100%;
                    height: 100%;
                    max-width: 100%;
                    max-height: 100%;
                    border-radius: 0;
                }
            }
        `;
    }
    document.head.appendChild(style);

    const button = document.createElement('button');
    button.id = 'ai-receptionist-widget-button';
    button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
    button.setAttribute('aria-label', 'Open chat');

    const iframe = document.createElement('iframe');
    iframe.id = 'ai-receptionist-chat-iframe';
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.setAttribute('aria-label', 'AI Receptionist Chat');

    let iframeLoaded = false;

    function openChat() {
        button.style.display = 'none';
        iframe.style.display = 'block';

        if (!iframeLoaded) {
            // Pass settings via URL hash so they're available immediately
            const settingsParam = widgetSettings ? encodeURIComponent(JSON.stringify(widgetSettings)) : '';
            iframe.src = WIDGET_URL + '?embedded=true&settings=' + settingsParam;
            iframeLoaded = true;

            iframe.addEventListener('load', function () {
                iframe.contentWindow.postMessage({
                    type: 'widget-config',
                    config: {
                        ...config,
                        widgetSettings: widgetSettings
                    }
                }, '*');
            });
        }
    }

    function closeChat() {
        button.style.display = 'flex';
        iframe.style.display = 'none';
    }

    button.addEventListener('click', openChat);

    window.addEventListener('message', function (event) {
        if (event.data && event.data.type === 'widget-resize' && !event.data.isOpen) {
            closeChat();
        }
    });

    function addWidgetToPage() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function () {
                document.body.appendChild(button);
                document.body.appendChild(iframe);
            });
        } else {
            document.body.appendChild(button);
            document.body.appendChild(iframe);
        }
    }

    // Fetch settings first, then show button with correct colors
    fetch(BASE_URL + '/api/organizations/' + ORG_ID + '/widget-settings')
        .then(function (res) { return res.json(); })
        .then(function (settings) {
            widgetSettings = settings;
            if (settings.primaryColor) primaryColor = settings.primaryColor;
            if (settings.textSecondaryColor) textSecondaryColor = settings.textSecondaryColor;
            updateStyles();
            addWidgetToPage();

            // Proactive time trigger - auto-open after X seconds
            if (settings.enableTimeTrigger && settings.timeTriggerSeconds > 0) {
                setTimeout(function () {
                    // Only open if not already open
                    if (button.style.display !== 'none') {
                        openChat();
                    }
                }, settings.timeTriggerSeconds * 1000);
            }
        })
        .catch(function () {
            // On error, show with defaults
            updateStyles();
            addWidgetToPage();
        });
})();

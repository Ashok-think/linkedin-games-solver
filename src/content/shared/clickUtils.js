export function dispatchMouseEvents(el) {
    if (!el) throw new Error('element not found');
    ['mouseover', 'mousedown', 'mouseup', 'click'].forEach(type => {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    });
}

export function dispatchMouseEventsInPage(selector, index) {
    return new Promise(resolve => {
        const code = `(function(){ try {
            const els = document.querySelectorAll(${JSON.stringify(selector)});
            const el = els[${index}];
            if (!el) return;

            ['mouseover','mousedown','mouseup','click'].forEach(t =>
                el.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window}))
            );

            setTimeout(() => {
                ['mouseover','mousedown','mouseup','click'].forEach(t =>
                    el.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window}))
                );
            }, 60);
        } catch(e){ console.error(e); }})();`;

        const s = document.createElement("script");
        s.textContent = code;
        (document.head || document.documentElement).appendChild(s);
        setTimeout(() => { s.remove(); resolve(); }, 150);
    });
}

export async function runPageClickCode(selector, index, numClicks) {
    return new Promise(resolve => {
        const clickCode = `
            const el = document.querySelectorAll('${selector}')[${index}];
            if (el) {
                const clickSeq = () => {
                    ['mouseover','mousedown','mouseup','click'].forEach(t => {
                        el.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window}));
                    });
                };

                clickSeq();
                if (${numClicks} === 2) setTimeout(clickSeq, 60);

                setTimeout(() => window.postMessage("click_done","*"), 150);
            } else {
                window.postMessage("click_fail","*");
            }
        `;

        const script = document.createElement("script");
        script.textContent = `(function(){ try { ${clickCode} } catch(e){ console.error(e);} })()`;
        document.head.appendChild(script);
        script.remove();

        const listener = e => {
            if (e.source === window && (e.data === "click_done" || e.data === "click_fail")) {
                window.removeEventListener("message", listener);
                resolve(true);
            }
        };
        window.addEventListener("message", listener);
    });
}

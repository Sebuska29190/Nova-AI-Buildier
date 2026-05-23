from playwright.sync_api import sync_playwright
import traceback

try:
    cm = sync_playwright()
    cm.start()
    pw = cm._playwright
    b = pw.chromium.launch()
    page = b.new_page()
    page.set_viewport_size({'width': 1920, 'height': 1080})
    page.goto('http://localhost:4123/', wait_until='networkidle', timeout=15000)
    page.wait_for_timeout(3000)

    links = page.evaluate('document.querySelectorAll("nav a").length')
    page.evaluate('''() => {
        const links = document.querySelectorAll('nav a');
        for (const l of links) {
            if (l.textContent.includes('Video')) { l.click(); break; }
        }
    }''')
    page.wait_for_timeout(2000)

    result = page.evaluate('''() => {
        const selects = document.querySelectorAll('select');
        let out = 'selects found: ' + selects.length + '\\n';
        for (let i = 0; i < selects.length; i++) {
            const prev = selects[i].previousElementSibling?.textContent || 'no label';
            const opts = [];
            for (const o of selects[i].options) opts.push(o.textContent);
            out += 'select ' + i + ' label: ' + prev + ' options: ' + opts.join(',') + '\\n';
        }
        return out;
    }''')

    page.screenshot(path='D:/nova/video_page_now.png')

    with open('D:/nova/screen_result.txt', 'w', encoding='utf-8') as f:
        f.write(result)

    b.close()
    cm._exit_was_called = True
except Exception as e:
    with open('D:/nova/screen_err.txt', 'w', encoding='utf-8') as f:
        f.write(str(e) + '\n' + traceback.format_exc())

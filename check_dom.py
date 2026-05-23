from playwright.sync_api import sync_playwright

cm = sync_playwright()
cm.start()
pw = cm._playwright
b = pw.chromium.launch()
page = b.new_page()
page.goto("http://localhost:4123/", wait_until="networkidle", timeout=15000)
page.wait_for_timeout(3000)

results = []

count = page.evaluate("document.querySelector('#app').children.length")
results.append(f"#app children: {count}")

links_count = page.evaluate("document.querySelectorAll('nav a').length")
results.append(f"Nav links: {links_count}")

text = page.evaluate("""() => {
    const m = document.querySelector('main');
    return m ? m.innerText.substring(0, 300) : 'no main';
}""")
results.append(f"Main: {text}")

result = page.evaluate("""() => {
    const links = document.querySelectorAll('nav a');
    if (links.length > 1) {
        links[1].click();
        return 'clicked: ' + links[1].textContent.trim().substring(0, 40);
    }
    return 'no links';
}""")
results.append(f"Click: {result}")

page.wait_for_timeout(1000)
text2 = page.evaluate("""() => {
    const m = document.querySelector('main');
    return m ? m.innerText.substring(0, 300) : 'no main';
}""")
results.append(f"After click: {text2}")

with open("D:/nova/dom_check.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(results))

b.close()
cm._exit_was_called = True

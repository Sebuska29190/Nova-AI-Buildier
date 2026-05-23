from playwright.sync_api import sync_playwright

cm = sync_playwright()
cm.start()
pw = cm._playwright
b = pw.chromium.launch()
page = b.new_page()

errors = []
page.on("pageerror", lambda e: errors.append(str(e)))

page.goto("http://localhost:4123/", wait_until="networkidle", timeout=15000)
page.wait_for_timeout(3000)

with open("D:/nova/test_built_result.txt", "w", encoding="utf-8") as f:
    f.write(f"Title: {page.title()}\n")
    f.write(f"Errors: {errors}\n")
    
    links = page.query_selector_all("nav a")
    f.write(f"Nav links: {len(links)}\n")
    for l in links[:8]:
        f.write(f"  Link: '{l.text_content().strip()[:80]}'\n")
    
    # Click Agents
    if len(links) > 1:
        links[1].click()
        page.wait_for_timeout(1000)
        f.write(f"After click - errors: {errors}\n")
    
    # Click Skills
    if len(links) > 2:
        links[2].click()
        page.wait_for_timeout(1000)
        f.write(f"After 2nd click - errors: {errors}\n")

page.screenshot(path="D:/nova/screenshot_built.png")
b.close()
cm._exit_was_called = True

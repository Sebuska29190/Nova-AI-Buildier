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

# Save HTML
with open("D:/nova/page_dump.html", "w", encoding="utf-8") as f:
    f.write(page.content())

# Find nav
links = page.query_selector_all("nav a")
with open("D:/nova/test_result.txt", "w", encoding="utf-8") as f:
    f.write(f"Title: {page.title()}\n")
    f.write(f"Errors: {errors}\n")
    f.write(f"Nav links: {len(links)}\n")
    for l in links[:8]:
        f.write(f"  Link: '{l.text_content().strip()[:80]}'\n")
    
    # Click second link
    if len(links) > 1:
        links[1].click()
        page.wait_for_timeout(1000)
        f.write(f"After click title: {page.title()}\n")
        f.write(f"After click errors: {errors}\n")

page.screenshot(path="D:/nova/screenshot.png")
b.close()
cm.stop()
print("DONE - check D:/nova/test_result.txt")

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

with open("D:/nova/test_final_result.txt", "w", encoding="utf-8") as f:
    f.write(f"Title: {page.title()}\n")
    f.write(f"All errors: {errors}\n\n")
    
    links = page.query_selector_all("nav a")
    f.write(f"Nav links: {len(links)}\n")
    
    # Click each of the first 10 links
    for i in range(min(10, len(links))):
        text = links[i].text_content().strip()[:60]
        links[i].click()
        page.wait_for_timeout(500)
        f.write(f"  Clicked [{i}] '{text}' -> errors after: {errors}\n")
        # re-query links (DOM may have changed)
        links = page.query_selector_all("nav a")

page.screenshot(path="D:/nova/screenshot_final.png")
b.close()
cm._exit_was_called = True
print("DONE")

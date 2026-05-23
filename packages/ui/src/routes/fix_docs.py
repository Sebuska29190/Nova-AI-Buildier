import re

with open('D:/nova/packages/ui/src/routes/DocsPage.svelte', 'r', encoding='utf-8') as f:
    c = f.read()

print(f"Before: len={len(c)}, style={'<style>' in c}, text-slate-300={'text-slate-300' in c}, @apply={'@apply' in c}")

# Remove style block
c = re.sub(r'<style>.*?</style>', '', c, flags=re.DOTALL)
# Remove @apply lines
c = re.sub(r'^.*@apply.*$', '', c, flags=re.MULTILINE)
# Replace text-slate-300 (global body)
c = c.replace('text-slate-300', 'text-slate-400')
# Remove :global blocks
c = re.sub(r'  :global\(body\) \{[^}]*\}', '', c)

print(f"After: len={len(c)}, style={'<style>' in c}, text-slate-300={'text-slate-300' in c}, @apply={'@apply' in c}")

with open('D:/nova/packages/ui/src/routes/DocsPage.svelte', 'w', encoding='utf-8') as f:
    f.write('\ufeff' + c)
print("Written OK")

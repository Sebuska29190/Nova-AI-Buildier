import sys
path = 'D:/nova/packages/ui/dist/assets/index-Cvz1EkOQ.js'
with open(path, 'rb') as f:
    data = f.read()

old = b'language:((Be=r[d(c)])==null?void 0:Be.code)||\"en\"'
new = b'language:((Be=r[d(c)])==null?void 0:Be.code)||\"fr\"'

count = data.count(old)
with open('D:/nova/patch_result.txt', 'w') as f:
    f.write(f'Found {count} occurrence(s) of old pattern\n')
    data2 = data.replace(old, new)
    count2 = data2.count(new)
    f.write(f'After replace, new pattern count: {count2}\n')
    with open(path, 'wb') as g:
        g.write(data2)
    f.write('Done\n')

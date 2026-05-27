import sys
sys.stdout.reconfigure(encoding='utf-8')

from pdfminer.high_level import extract_text
import os

pdf_path = 'D19640059Lj.pdf'
print(f'PDF exists: {os.path.exists(pdf_path)}')
print(f'PDF size: {os.path.getsize(pdf_path)} bytes')

try:
    text = extract_text(pdf_path)
    print(f'Extracted {len(text)} characters')
    if len(text) > 0:
        print('First 300 chars:')
        print(repr(text[:300]))
        
        # Write the file
        out_path = r'D:\home\user\baza_prawnicza\polskie_kodeksy\KRO_pelny_tekst.txt'
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(text)
        print(f'Written to: {out_path}')
        print(f'File size: {os.path.getsize(out_path)} bytes')
    else:
        print('WARNING: Empty text extracted!')
except Exception as e:
    print(f'Error: {type(e).__name__}: {e}')

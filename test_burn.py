#!/usr/bin/env python
import sys
sys.path.insert(0, r"D:/nova/packages/core/src/video")
try:
    from burn_subs import generate_subtitle_frames
    print("Import OK")
except Exception as e:
    print(f"Import failed: {e}")
try:
    import PIL
    print(f"Pillow: {PIL.__version__}")
except ImportError:
    print("NO PILLOW INSTALLED - this is the problem!")
except Exception as e:
    print(f"Pillow error: {e}")

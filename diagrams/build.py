"""Build eks-core-architecture.drawio: python3 build.py"""
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from drawlib import write
import pages_a

pages = [pages_a.overview(), pages_a.network()]
try:
    import pages_b
    pages += pages_b.all_pages()
except ImportError:
    pass
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'eks-core-architecture.drawio')
write(out, pages)
import shutil
static = os.path.join(os.path.dirname(out), '..', 'static', 'diagrams')
os.makedirs(static, exist_ok=True)
shutil.copy2(out, static)
print(out, len(pages), 'pages')

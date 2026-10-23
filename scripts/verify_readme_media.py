"""Documentation verification; no application or business storage is opened."""
from pathlib import Path
import re,json,hashlib
from urllib.parse import unquote
from PIL import Image
root=Path.cwd();readme=(root/'README.md').read_text();checked=set()
refs=re.findall(r'\]\(([^)]+)\)',readme)+re.findall(r'(?:src|srcset)="([^"]+)"',readme)
anchors=set(re.findall(r'<a (?:name|id)="([^"]+)"',readme))
for ref in refs:
 if ref.startswith(('https:','http:','mailto:')):continue
 if ref.startswith('#'):
  assert ref[1:] in anchors,ref;continue
 local=unquote(ref.split('#')[0]);assert (root/local).is_file(),f'Missing README target: {ref}';checked.add(local)
for stem in ['product-tour','offline-chai']:
 with Image.open(root/f'docs/assets/current/{stem}.gif') as im:
  assert im.n_frames>=2 and im.width<=1080 and im.height<=800
  assert (root/f'docs/assets/current/{stem}.gif').stat().st_size<2_000_000
  print(stem,'frames',im.n_frames,'dimensions',im.size)
 assert (root/f'docs/assets/current/{stem}-static.png').is_file()
for name in ['billzen-runtime','business-workflow']:
 base=root/'docs/diagrams'/name;receipt=json.loads(base.with_suffix('.receipt.json').read_text())
 assert receipt['status']=='pass' and all(v=='pass' for v in receipt['gates'].values()),name
 html=base.with_suffix('.html').read_bytes();assert hashlib.sha256(html).hexdigest()==receipt['artifact']['sha256'],name
 spec=json.loads(base.with_suffix('.spec.json').read_text());assert len(spec['meta']['repository']['revision'])==40
 print(name,'all Archify gates pass; checked publication SHA256 matches')
assert 'Browser edits can disappear on reload' not in readme
assert '38 passed' not in readme
print(f'PASS {len(checked)} local README targets, {len(anchors)} custom anchors, GIFs/static alternatives and diagram provenance')

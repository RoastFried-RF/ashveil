"""Read-only exact source lower-body composites, labelled as diagnostics."""
import json
from pathlib import Path
from PIL import Image,ImageDraw
B=Path(__file__).parent
data=json.loads((B/'source-analysis.json').read_text())
for filename,meta in data.items():
 image=Image.open(B/'originals'/filename).convert('RGBA');board=Image.new('RGBA',(1350,1000),(49,47,41,255));draw=ImageDraw.Draw(board)
 for r in meta['regionsAlpha16Area400']:
  i=r['rawSourceIndex'];x,y,w,h=r['crop'];lower=(x,y+int(h*.48),x+w,y+h);dx=(i%3)*450+20;dy=(i//3)*250+35
  board.alpha_composite(image.crop(lower),(dx,dy));draw.text((dx,dy-20),f'raw{i} requested '+['LH','LF','RH','RF'][i//3]+': '+['toe-off','mid-swing','touchdown'][i%3],fill=(240,226,189,255))
 board.convert('RGB').save(B/'diagnostics'/filename.replace('.png','-lower-body-diagnostic.png'))

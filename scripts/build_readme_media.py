"""Build original README GIFs; screenshots come from capture_readme.js."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import math
out=Path('docs/assets/current');out.mkdir(parents=True,exist_ok=True)
fontpath='public/fonts/NotoSans-Regular.ttf'
def font(size):return ImageFont.truetype(fontpath,size)
# A deliberate screen-to-screen product tour; no claim of continuous recording.
names=['dashboard-dark','analytics-dark','cashbook-dark','reports-dark','stock-history-dark','customers-dark']
labels=['01  See today clearly','02  Understand the month','03  Record money in and out','04  Filter, export, explain','05  Keep stock accountable','06  Follow customer cash history']
frames=[]
for name,label in zip(names,labels):
 image=Image.open(out/f'{name}.png').convert('RGB').resize((1080,720),Image.Resampling.LANCZOS)
 canvas=Image.new('RGB',(1080,770),'#0c120e');canvas.paste(image,(0,50));d=ImageDraw.Draw(canvas);d.text((20,11),label,font=font(18),fill='#c9ff79');d.text((853,14),'FICTIONAL DEMO',font=font(12),fill='#9aaa94');frames.append(canvas)
frames[0].save(out/'product-tour-static.png',optimize=True)
frames[0].save(out/'product-tour.gif',save_all=True,append_images=frames[1:],duration=2100,loop=0,optimize=True,disposal=2)
# Original lighthearted brand animation: no third-party meme or hotlinked asset.
comic=[]
for i in range(24):
 image=Image.new('RGB',(1080,236),'#101a14');d=ImageDraw.Draw(image)
 d.rounded_rectangle((1,1,1078,234),radius=20,outline='#31452b',width=2)
 d.text((28,24),'INTERNET TOOK A CHAI BREAK.',font=font(21),fill='#a7b89f')
 d.text((28,60),"Your cashbook didn't.",font=font(34),fill='#c9ff79')
 d.text((28,166),'Offline records. Zero cloud account required.',font=font(16),fill='#a7b89f')
 # A snoozing router, its cup, and a receipt happily carrying on.
 d.rounded_rectangle((681,114,799,161),radius=12,fill='#263024',outline='#596451',width=2)
 d.line((702,114,696,82),fill='#596451',width=5);d.line((780,114,786,82),fill='#596451',width=5)
 d.arc((712,127,727,141),0,180,fill='#a7b89f',width=2);d.arc((751,127,766,141),0,180,fill='#a7b89f',width=2)
 z=round(4*math.sin(i/24*math.tau));d.text((783,70+z),'z z',font=font(18),fill='#8d9e84')
 d.rounded_rectangle((814,132,847,165),radius=4,fill='#b6a1f5');d.arc((837,136,859,158),-90,90,fill='#b6a1f5',width=5)
 for x in [821,832]:d.arc((x,109-z,x+8,130-z),70,260,fill='#ad9bd4',width=2)
 y=45+round(3*math.sin(i/24*math.tau));d.rounded_rectangle((905,y,1015,y+142),radius=12,fill='#c9ff79')
 for dy,w in [(28,67),(43,67),(58,48)]:d.line((925,y+dy,925+w,y+dy),fill='#647e45',width=3)
 d.ellipse((939,y+86,979,y+126),fill='#152313');d.line((948,y+105,956,y+112,971,y+97),fill='#c9ff79',width=4)
 comic.append(image)
comic[0].save(out/'offline-chai-static.png',optimize=True)
comic[0].save(out/'offline-chai.gif',save_all=True,append_images=comic[1:],duration=120,loop=0,optimize=True,disposal=2)
print('Original product-tour and offline-chai GIFs built with static fallbacks.')

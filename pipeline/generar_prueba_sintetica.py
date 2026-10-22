import numpy as np, cv2, json
from PIL import Image
H,W=1600,1200
img=np.full((H,W,3),(128,128,128),np.uint8); m=np.zeros((H,W),np.uint8)
def put(fn,col):
    t=np.zeros((H,W),np.uint8); fn(t); img[t>0]=col; m[t>0]=255
put(lambda t: cv2.fillPoly(t,[np.array([[300,1000],[900,1000],[1050,1600],[150,1600]])],1),(20,25,45))
put(lambda t: cv2.rectangle(t,(540,820),(660,1010),1,-1),(200,150,120))
put(lambda t: cv2.ellipse(t,(600,700),(130,170),0,0,360,1,-1),(205,155,125))
put(lambda t: cv2.rectangle(t,(470,470),(730,560),1,-1),(15,15,15))
put(lambda t: cv2.line(t,(720,520),(760,760),1,6),(212,175,55))
rng=np.random.default_rng(0); img=np.clip(img+rng.normal(0,4,img.shape),0,255).astype(np.uint8)
m=cv2.GaussianBlur(m,(5,5),1.2)
Image.fromarray(img).save("in.jpg",quality=95); Image.fromarray(m).save("a.png")
g=np.zeros((700,900,4),np.uint8); cv2.fillPoly(g,[np.array([[200,60],[700,60],[880,700],[20,700]])],(30,50,140,255))
cv2.ellipse(g,(450,60),(80,60),0,0,180,(0,0,0,0),-1)
Image.fromarray(g,"RGBA").save("toga.png"); json.dump(dict(hombro_izq=[200,80],hombro_der=[700,80],escote=[450,60]),open("toga.json","w"))

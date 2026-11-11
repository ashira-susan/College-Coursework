import numpy as np, json
from nn import *
np.set_printoptions(precision=4,suppress=True)
# ---------- Q1 worked forward pass: 3-4-1 and 3-1
x=np.array([0.5,-0.2,1.0])   # standardised roughness, deviation, vibration
W1=np.array([[0.4,-0.3,0.2,0.1],[0.1,0.5,-0.4,0.3],[0.2,0.1,0.6,-0.5]]); b1=np.array([0.1,-0.1,0.0,0.2])
W2=np.array([0.5,-0.4,0.8,0.3]); b2=-0.1
z1=x@W1+b1; h=np.tanh(z1); z2=h@W2+b2; p=sigmoid(z2)
print("Q1 z1",z1,"h",h,"z2",z2,"p",p)
w=np.array([0.6,0.3,0.9]); b=-0.5; zl=x@w+b; print("Q1 linear z",zl,"p",sigmoid(zl))
# ---------- Q2 perceptron
def perceptron(X,y,lr,epochs=100,w0=(0.0,0.0),b0=0.0,verbose=False):
    w=np.array(w0,float); b=b0; mis=[]; trace=[]
    for ep in range(epochs):
        m=0
        for xi,yi in zip(X,y):
            o=1 if xi@w+b>=0 else 0; e=yi-o
            if e!=0:
                m+=1; w=w+lr*e*xi; b=b+lr*e
                if ep==0: trace.append((tuple(xi),yi,o,e,w.copy(),b))
        mis.append(m)
        if m==0: break
    return w,b,mis,trace
X=np.array([[0,0],[0,1],[1,0],[1,1]],float)
yand=np.array([0,0,0,1]); yxor=np.array([0,1,1,0])
w0=(0.0,0.0); 
print("pre-train preds AND:",[1 if xi@np.array(w0)+0>=0 else 0 for xi in X])
w,b,mis,tr=perceptron(X,yand,0.1); print("AND",w,b,mis); 
for t in tr: print(t)
print("final AND preds",[1 if xi@w+b>=0 else 0 for xi in X])
for lr in (0.01,0.1,1.0):
    w,b,mis,tr=perceptron(X,yxor,lr,epochs=100); print("XOR lr",lr,"final w,b",w,b,"mis first 10",mis[:10],"epochs",len(mis),"final mis",mis[-1],"preds",[1 if xi@w+b>=0 else 0 for xi in X])
    if lr==0.1:
        for t in tr: print(t)
# ---------- Q3 worked step
Xx=np.array([1.0,0.0]); yy=1.0
W1=np.array([[0.5,0.3],[-0.4,0.8]]); b1=np.array([0.1,-0.2]); w2=np.array([0.6,-0.7]); b2=0.05; eta=0.5
z1=Xx@W1+b1; h=sigmoid(z1); z2=h@w2+b2; p=sigmoid(z2); L=-(yy*np.log(p)+(1-yy)*np.log(1-p))
d2=p-yy; gw2=d2*h; gb2=d2; d1=d2*w2*h*(1-h); gW1=np.outer(Xx,d1); gb1=d1
print("Q3 z1",z1,"h",h,"z2",z2,"p",p,"L",L); print("d2",d2,"gw2",gw2,"d1",d1,"gW1",gW1,"gb1",gb1)
print("new w2",w2-eta*gw2,"b2",b2-eta*gb2,"W1",W1-eta*gW1,"b1",b1-eta*gb1)
# new loss
W1n=W1-eta*gW1;b1n=b1-eta*gb1;w2n=w2-eta*gw2;b2n=b2-eta*gb2
pn=sigmoid(sigmoid(Xx@W1n+b1n)@w2n+b2n); print("loss after",-np.log(pn),"p",pn)
# ---------- Q3 implementation: 2-2-1 sigmoid on XOR, own class with sigmoid hidden
def xor_train(seed,act="sigmoid",lr=0.5,epochs=20000,init=1.0,opt="sgd",tol=0.01):
    m=MLP([2,2,1],act=act,seed=seed,init=init); H={"loss":[]}; yx=yxor.astype(float)
    if opt=="adam":
        Hh=train(m,X,yx,X,yx,opt="adam",lr=lr,bs=None,epochs=epochs,seed=seed); return m,Hh["tr_loss"],Hh
    for ep in range(epochs):
        gW,gb=m.grads(X,yx)
        for k in range(2): m.W[k]-=lr*gW[k]; m.b[k]-=lr*gb[k]
        H["loss"].append(bce(m.forward(X),yx))
    return m,H["loss"],H
def success(m): return bool(np.all(m.predict(X)==yxor))
res=[]
for s in range(50):
    m,l,_=xor_train(s,epochs=10000); ep=next((i for i,v in enumerate(l) if v<0.05),None); res.append((s,success(m),l[-1],ep))
print("sigmoid N(0,1) init success",sum(r[1] for r in res),"/50")
print([ (r[0],round(r[2],4)) for r in res if not r[1]][:10])
# gradient check on XOR net at a seed
m=MLP([2,2,1],act="sigmoid",seed=3,init=1.0); gW,gb=m.grads(X,yxor.astype(float)); yx=yxor.astype(float)
for (k,i,j) in [(0,0,0),(0,1,1),(1,0,0),(1,1,0)]:
    o=m.W[k][i,j]; m.W[k][i,j]=o+1e-5; a=bce(m.forward(X),yx); m.W[k][i,j]=o-1e-5; bb=bce(m.forward(X),yx); m.W[k][i,j]=o
    num=(a-bb)/2e-5; print("gradcheck W",k,i,j,"analytic",gW[k][i,j],"numeric",num,"rel",abs(num-gW[k][i,j])/(abs(num)+abs(gW[k][i,j])))
json.dump([(r[0],r[1],r[2],r[3]) for r in res],open("q3_res.json","w"))

import numpy as np
from nn import MLP, sigmoid
X=np.array([[0,0],[0,1],[1,0],[1,1]],float); Y=np.array([0,1,1,0],float)
def batch_xor(seeds,h=2,act="sigmoid",init=1.0,opt="sgd",lr=0.5,beta=0.0,epochs=10000,record=False):
    S=len(seeds); W1=[];b1=[];W2=[];b2=[]
    for s in seeds:
        m=MLP([2,h,1],act=act,seed=s,init=init); W1.append(m.W[0]);b1.append(m.b[0]);W2.append(m.W[1][:,0]);b2.append(m.b[1][0])
    P=[np.array(W1),np.array(b1),np.array(W2),np.array(b2)]; V=[np.zeros_like(p) for p in P]; V2=[np.zeros_like(p) for p in P]
    a=(lambda z:np.tanh(z)) if act=="tanh" else sigmoid; da=(lambda h_:1-h_**2) if act=="tanh" else (lambda h_:h_*(1-h_))
    losses=np.zeros((epochs,S)) if record else None; first=np.full(S,-1)
    for ep in range(1,epochs+1):
        W1,b1,W2,b2=P
        H=a(np.einsum('ni,sih->snh',X,W1)+b1[:,None,:]); z=np.einsum('snh,sh->sn',H,W2)+b2[:,None]; p=sigmoid(z)
        L=-(Y*np.log(np.clip(p,1e-12,1))+(1-Y)*np.log(np.clip(1-p,1e-12,1))).mean(1)
        if record: losses[ep-1]=L
        first=np.where((first<0)&(L<0.05),ep,first)
        d=(p-Y)/4.0; gW2=np.einsum('sn,snh->sh',d,H); gb2=d.sum(1); dh=d[:,:,None]*W2[:,None,:]*da(H)
        gW1=np.einsum('ni,snh->sih',X,dh); gb1=dh.sum(1); G=[gW1,gb1,gW2,gb2]
        for k in range(4):
            if opt=="adam":
                V[k]=0.9*V[k]+0.1*G[k]; V2[k]=0.999*V2[k]+0.001*G[k]**2
                P[k]=P[k]-lr*(V[k]/(1-0.9**ep))/(np.sqrt(V2[k]/(1-0.999**ep))+1e-8)
            else:
                V[k]=beta*V[k]-lr*G[k]; P[k]=P[k]+V[k]
    W1,b1,W2,b2=P
    H=a(np.einsum('ni,sih->snh',X,W1)+b1[:,None,:]); p=sigmoid(np.einsum('snh,sh->sn',H,W2)+b2[:,None])
    ok=np.all((p>=0.5)==(Y>0.5),axis=1)
    return ok,L,first,losses,P,p
if __name__=="__main__":
    import time; t=time.time()
    cfgs={"base: sigmoid, N(0,1), SGD lr .5":dict(),
    "Xavier init":dict(init="xavier"),
    "momentum .9, lr .1":dict(lr=0.1,beta=0.9),
    "Adam lr .05":dict(opt="adam",lr=0.05),
    "tanh, Xavier":dict(act="tanh",init="xavier"),
    "tanh, N(0,1)":dict(act="tanh"),
    "tanh, N(0,1), Adam .05":dict(act="tanh",opt="adam",lr=0.05),
    "3 hidden, sigmoid, SGD":dict(h=3),
    "4 hidden, sigmoid, SGD":dict(h=4)}
    for k,c in cfgs.items():
        ok,L,first,_,_,_=batch_xor(list(range(50)),epochs=10000,**c); f=first[first>0]
        print(k,ok.sum(),"/50 median epochs to loss<.05:",int(np.median(f)) if len(f) else None, "stuck losses",np.round(np.unique(np.round(L[~ok],3)),3)[:5])
    print(time.time()-t)

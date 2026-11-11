"""Minimal NumPy MLP (no autodiff): forward, backprop, SGD / momentum / Adam, L2, dropout, early stopping."""
import numpy as np, time

def sigmoid(z): return 1.0/(1.0+np.exp(-np.clip(z,-500,500)))
def bce(p,y,eps=1e-12):
    p=np.clip(p,eps,1-eps); return float(-np.mean(y*np.log(p)+(1-y)*np.log(1-p)))

def make_moons(n_per_class,noise,seed):
    r=np.random.RandomState(seed); t=r.uniform(0,np.pi,n_per_class)
    a=np.c_[np.cos(t),np.sin(t)]; b=np.c_[1-np.cos(t),0.5-np.sin(t)]
    X=np.r_[a,b]+r.normal(0,noise,(2*n_per_class,2)); y=np.r_[np.zeros(n_per_class),np.ones(n_per_class)]
    return X,y

def split_moons(seed=42,noise=0.25):
    X,y=make_moons(500,noise,seed); r=np.random.RandomState(seed)
    idx={c:r.permutation(np.where(y==c)[0]) for c in (0,1)}
    tr=np.r_[idx[0][:300],idx[1][:300]]; va=np.r_[idx[0][300:400],idx[1][300:400]]; te=np.r_[idx[0][400:],idx[1][400:]]
    tr=r.permutation(tr); va=r.permutation(va); te=r.permutation(te)
    mu,sd=X[tr].mean(0),X[tr].std(0)          # preprocessing fitted on TRAIN only
    f=lambda i:((X[i]-mu)/sd,y[i])
    return f(tr),f(va),f(te)

class MLP:
    def __init__(self,sizes,act="tanh",seed=0,init="xavier",out_act="sigmoid"):
        r=np.random.RandomState(seed); self.sizes=sizes; self.act=act; self.W=[];self.b=[]
        for i in range(len(sizes)-1):
            fan_in,fan_out=sizes[i],sizes[i+1]
            s=np.sqrt(2.0/(fan_in+fan_out)) if init=="xavier" else (init if isinstance(init,float) else 1.0)
            self.W.append(r.normal(0,s,(fan_in,fan_out))); self.b.append(np.zeros(fan_out))
    def n_params(self): return sum(w.size+b.size for w,b in zip(self.W,self.b))
    def _a(self,z): return np.tanh(z) if self.act=="tanh" else (np.maximum(0,z) if self.act=="relu" else sigmoid(z))
    def _da(self,a): return 1-a*a if self.act=="tanh" else ((a>0).astype(float) if self.act=="relu" else a*(1-a))
    def forward(self,X,drop=0.0,rng=None,cache=False):
        A=[X];masks=[];R=[X]
        for i in range(len(self.W)-1):
            a=self._a(A[-1]@self.W[i]+self.b[i]); R.append(a)
            if drop>0:
                m=(rng.rand(*a.shape)>=drop)/(1-drop); a=a*m; masks.append(m)
            A.append(a)
        p=sigmoid(A[-1]@self.W[-1]+self.b[-1])[:,0]
        self._R=R
        return (p,A,masks) if cache else p
    def grads(self,X,y,l2=0.0,drop=0.0,rng=None):
        p,A,masks=self.forward(X,drop,rng,cache=True); n=len(y)
        d=((p-y)/n)[:,None]                     # dL/dz_out for sigmoid + BCE
        gW=[None]*len(self.W); gb=[None]*len(self.W)
        for i in range(len(self.W)-1,-1,-1):
            gW[i]=A[i].T@d+l2*self.W[i]; gb[i]=d.sum(0)
            if i>0:
                d=(d@self.W[i].T)
                if drop>0: d=d*masks[i-1]
                d=d*self._da(self._R[i])
        return gW,gb
    def predict(self,X): return (self.forward(X)>=0.5).astype(float)
    def evaluate(self,X,y): p=self.forward(X); return bce(p,y),float(np.mean((p>=0.5)==y))

def train(model,Xtr,ytr,Xva,yva,opt="adam",lr=0.01,bs=32,epochs=200,l2=0.0,drop=0.0,patience=None,seed=0,beta=0.9):
    rng=np.random.RandomState(seed+1000); n=len(ytr); bs=n if bs is None else min(bs,n)
    vW=[np.zeros_like(w) for w in model.W]; vb=[np.zeros_like(b) for b in model.b]
    mW=[np.zeros_like(w) for w in model.W]; mb=[np.zeros_like(b) for b in model.b]; t=0
    H={k:[] for k in("tr_loss","va_loss","tr_acc","va_acc")}; best=(1e9,None,0); bad=0; t0=time.perf_counter()
    for ep in range(1,epochs+1):
        perm=rng.permutation(n)
        for s in range(0,n,bs):
            ii=perm[s:s+bs]; gW,gb=model.grads(Xtr[ii],ytr[ii],l2,drop,rng); t+=1
            for k in range(len(model.W)):
                if opt=="sgd": model.W[k]-=lr*gW[k]; model.b[k]-=lr*gb[k]
                elif opt=="momentum":
                    vW[k]=beta*vW[k]-lr*gW[k]; vb[k]=beta*vb[k]-lr*gb[k]; model.W[k]+=vW[k]; model.b[k]+=vb[k]
                else:
                    mW[k]=0.9*mW[k]+0.1*gW[k]; mb[k]=0.9*mb[k]+0.1*gb[k]
                    vW[k]=0.999*vW[k]+0.001*gW[k]**2; vb[k]=0.999*vb[k]+0.001*gb[k]**2
                    c1=1-0.9**t; c2=1-0.999**t
                    model.W[k]-=lr*(mW[k]/c1)/(np.sqrt(vW[k]/c2)+1e-8); model.b[k]-=lr*(mb[k]/c1)/(np.sqrt(vb[k]/c2)+1e-8)
        tl,ta=model.evaluate(Xtr,ytr); vl,va=model.evaluate(Xva,yva)
        for k,v in zip(H,(tl,vl,ta,va)): H[k].append(v)
        if vl<best[0]-1e-9: best=(vl,([w.copy() for w in model.W],[b.copy() for b in model.b]),ep); bad=0
        else: bad+=1
        if patience and bad>=patience: break
    H["time"]=time.perf_counter()-t0; H["best_ep"]=best[2]; H["epochs_run"]=ep; H["best_state"]=best[1]; H["best_va_loss"]=best[0]
    return H
def restore(model,H): model.W=[w.copy() for w in H["best_state"][0]]; model.b=[b.copy() for b in H["best_state"][1]]

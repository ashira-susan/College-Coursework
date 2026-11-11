import numpy as np, json, pickle
from nn import *
(Xtr,ytr),(Xva,yva),(Xte,yte)=split_moons()
idx=np.r_[np.where(ytr==0)[0][:50],np.where(ytr==1)[0][:50]]; X5,y5=Xtr[idx],ytr[idx]
mu,sd=X5.mean(0),X5.std(0); f=lambda X:(X-mu)/sd; X5s,Xv,Xt=f(X5),f(Xva),f(Xte)
SZ=[2,64,64,1]; EP=1000
cfgs=[("Baseline",dict()),("L2 1e-3",dict(l2=1e-3)),("L2 1e-2",dict(l2=1e-2)),("L2 1e-1",dict(l2=1e-1)),("Dropout 0.2",dict(drop=0.2)),("Dropout 0.5",dict(drop=0.5)),("Early stop (pat 30)",dict(patience=30)),("Early stop (pat 100)",dict(patience=100))]
res={};hist={};models={}
for name,kw in cfgs:
    rows=[]
    for seed in (0,1,2):
        m=MLP(SZ,act="tanh",seed=seed); H=train(m,X5s,y5,Xv,yva,opt="adam",lr=0.01,bs=100,epochs=EP,seed=seed,**kw)
        if "patience" in kw: restore(m,H)
        tl,ta=m.evaluate(X5s,y5); vl,va=m.evaluate(Xv,yva)
        rows.append(dict(tr_loss=tl,va_loss=vl,tr_acc=ta,va_acc=va,gap=ta-va,epochs=H["epochs_run"],best_ep=H["best_ep"])); hist[(name,seed)]={k:H[k] for k in ("tr_loss","va_loss","tr_acc","va_acc","best_ep","epochs_run")}; models[(name,seed)]=m
    res[name]=rows; mean=lambda k:np.mean([r[k] for r in rows])
    print(f"{name:22s} trL {mean('tr_loss'):.3f} vaL {mean('va_loss'):.3f} trA {mean('tr_acc'):.3f} vaA {mean('va_acc'):.3f} gap {mean('gap'):+.3f} ep {mean('epochs'):.0f} best {mean('best_ep'):.0f}")
print("params",MLP(SZ).n_params())
# best val-loss config
best=min(res,key=lambda n:np.mean([r["va_loss"] for r in res[n]])); print("selected by val loss:",best)
tes=[models[(best,s)].evaluate(Xt,yte)[1] for s in range(3)]; print("TEST acc selected",np.mean(tes),tes)
base_te=[models[("Baseline",s)].evaluate(Xt,yte)[1] for s in range(3)]; print("TEST acc baseline (for comparison after selection)",np.mean(base_te))
pickle.dump((res,hist,best),open("q5.pkl","wb"))
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
fig,axs=plt.subplots(1,4,figsize=(7.6,2.3),sharey=True); show=["Baseline","L2 1e-2","Dropout 0.2","Early stop (pat 30)"]
for ax,n in zip(axs,show):
    tr=np.mean([np.pad(hist[(n,s)]["tr_loss"],(0,EP-len(hist[(n,s)]["tr_loss"])),mode="edge") for s in range(3)],0); va=np.mean([np.pad(hist[(n,s)]["va_loss"],(0,EP-len(hist[(n,s)]["va_loss"])),mode="edge") for s in range(3)],0)
    ax.plot(tr,color="#1F3A5F",label="train"); ax.plot(va,color="#C8553D",label="validation"); ax.set_title(n,fontsize=8); ax.set_xlabel("Epoch",fontsize=7); ax.grid(alpha=.3); ax.set_ylim(0,1.0)
axs[0].legend(fontsize=6); axs[0].set_ylabel("BCE loss"); plt.tight_layout(); plt.savefig("fig_q5.png",dpi=200); plt.close()

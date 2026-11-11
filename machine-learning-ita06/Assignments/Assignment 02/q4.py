import numpy as np, json, time
from nn import *
(Xtr,ytr),(Xva,yva),(Xte,yte)=split_moons()
archs={"Shallow 2-32-1":[2,32,1],"Deep 2-8-8-8-1":[2,8,8,8,1],"Wide 2-44-1 (param-matched)":[2,44,1]}
out={}; hist={}
for name,sz in archs.items():
    rows=[]
    for seed in (0,1,2):
        m=MLP(sz,act="tanh",seed=seed); H=train(m,Xtr,ytr,Xva,yva,opt="adam",lr=0.01,bs=32,epochs=150,seed=seed)
        tl,ta=m.evaluate(Xtr,ytr); vl,va=m.evaluate(Xva,yva); te=m.evaluate(Xte,yte)
        # epochs to reach val acc >= 0.92 
        e92=next((i+1 for i,a in enumerate(H["va_acc"]) if a>=0.92),None)
        rows.append(dict(seed=seed,tr_loss=tl,va_loss=vl,tr_acc=ta,va_acc=va,te_acc=te[1],te_loss=te[0],time=H["time"],e92=e92,params=m.n_params()))
        hist[(name,seed)]=H
        if seed==0: hist[(name,"model")]=m
    out[name]=rows
    f=lambda k:(np.mean([r[k] for r in rows]),np.std([r[k] for r in rows]))
    print(name,rows[0]["params"],{k:tuple(round(v,4) for v in f(k)) for k in("tr_loss","va_loss","tr_acc","va_acc","te_acc","time")},"e92",[r["e92"] for r in rows])
json.dump(out,open("q4_res.json","w"))
import pickle; pickle.dump({k:(v if not isinstance(v,dict) else {kk:vv for kk,vv in v.items() if kk!="best_state"}) for k,v in hist.items() if k[1]!="model"},open("q4_hist.pkl","wb"))
# decision boundary figure
import matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
fig,axs=plt.subplots(1,3,figsize=(7.4,2.5)); gx,gy=np.meshgrid(np.linspace(-2.6,2.6,200),np.linspace(-2.6,2.6,200)); G=np.c_[gx.ravel(),gy.ravel()]
for ax,(name,sz) in zip(axs,archs.items()):
    m=hist[(name,"model")]; Z=m.forward(G).reshape(gx.shape); ax.contourf(gx,gy,Z,levels=[0,0.5,1],colors=["#EAF1F8","#FBE9E3"]); ax.contour(gx,gy,Z,levels=[0.5],colors=["#1F3A5F"],linewidths=1.2)
    ax.scatter(Xte[:,0],Xte[:,1],c=np.where(yte==1,"#C8553D","#2A9D8F"),s=6); ax.set_title(f"{name}\ntest acc {m.evaluate(Xte,yte)[1]:.3f}",fontsize=8); ax.set_xticks([]);ax.set_yticks([])
plt.tight_layout(); plt.savefig("fig_q4_boundary.png",dpi=200); plt.close()
# learning curves
fig,axs=plt.subplots(1,2,figsize=(7.4,2.4)); cols={"Shallow 2-32-1":"#1F3A5F","Deep 2-8-8-8-1":"#C8553D","Wide 2-44-1 (param-matched)":"#2A9D8F"}
for name in archs:
    tr=np.mean([hist[(name,s)]["tr_loss"] for s in range(3)],0); va=np.mean([hist[(name,s)]["va_loss"] for s in range(3)],0)
    axs[0].plot(tr,color=cols[name],ls="--",lw=1); axs[0].plot(va,color=cols[name],lw=1.4,label=name)
    axs[1].plot(np.mean([hist[(name,s)]["va_acc"] for s in range(3)],0),color=cols[name],lw=1.4)
axs[0].set_title("Loss (dashed = train, solid = validation)",fontsize=8); axs[0].set_xlabel("Epoch"); axs[0].legend(fontsize=6); axs[0].set_ylim(0.1,0.6); axs[0].grid(alpha=.3)
axs[1].set_title("Validation accuracy (mean of 3 seeds)",fontsize=8); axs[1].set_xlabel("Epoch"); axs[1].set_ylim(0.8,0.96); axs[1].grid(alpha=.3)
plt.tight_layout(); plt.savefig("fig_q4_curves.png",dpi=200); plt.close()

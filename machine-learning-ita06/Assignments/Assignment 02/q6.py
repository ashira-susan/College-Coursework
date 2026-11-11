import numpy as np, pickle
from nn import *
(Xtr,ytr),(Xva,yva),(Xte,yte)=split_moons()
runs=[("R1","adam",0.01,32,16),("R2","adam",0.001,32,16),("R3","adam",0.1,32,16),("R4","adam",0.0001,32,16),
("R5","adam",0.01,16,16),("R6","adam",0.01,128,16),("R7","adam",0.01,32,8),("R8","adam",0.01,32,64),
("R9","sgd",0.01,32,16),("R10","sgd",0.1,32,16),("R11","momentum",0.01,32,16),("R12","momentum",0.1,32,16)]
res=[];models={}
for rid,opt,lr,bs,w in runs:
    m=MLP([2,w,1],act="tanh",seed=0); H=train(m,Xtr,ytr,Xva,yva,opt=opt,lr=lr,bs=bs,epochs=200,patience=20,seed=0)
    va_loss=np.array(H["va_loss"]); tl=np.array(H["tr_loss"]); be=H["best_ep"]
    osc=float(np.std(np.diff(tl[10:]))) if len(tl)>12 else 0.0
    best_acc=H["va_acc"][be-1]
    flag="unsuccessful (still high loss)" if best_acc<0.85 else ("ran full 200 epochs, still improving" if (H["epochs_run"]==200 and be>=190) else ("oscillating" if osc>0.01 else "stable"))
    res.append(dict(id=rid,opt=opt,lr=lr,bs=bs,w=w,params=m.n_params(),best_va_loss=H["best_va_loss"],best_va_acc=best_acc,best_ep=be,epochs=H["epochs_run"],time=H["time"],osc=osc,flag=flag))
    restore(m,H); models[rid]=m
    print(rid,opt,lr,bs,w,m.n_params(),"valLoss %.4f valAcc %.3f bestEp %d ran %d t %.2fs osc %.4f %s"%(H["best_va_loss"],best_acc,be,H["epochs_run"],H["time"],osc,flag))
best=min(res,key=lambda r:r["best_va_loss"]); print("SELECTED",best["id"])
m=models[best["id"]]; print("TEST",m.evaluate(Xte,yte))
pickle.dump(res,open("q6.pkl","wb"))

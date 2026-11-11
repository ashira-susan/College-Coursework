import numpy as np
from xorfast import *
np.set_printoptions(precision=3,suppress=True)
seeds=list(range(50)); ok,L,first,losses,P,p=batch_xor(seeds,record=True)
print("success",ok.sum(),"stuck seeds",[s for s in seeds if not ok[s]])
for s in (0,30,3):
    W1,b1,W2,b2=[q[s] for q in P]; H=sigmoid(X@W1+b1)
    print("seed",s,"ok",ok[s],"loss",round(L[s],4),"out",p[s],"\n W1",W1.ravel(),"b1",b1,"w2",W2,"b2",b2,"\n hidden units on 4 inputs:\n",H.T)
# gradient norm trajectory at epoch 2000 and 10000 for stuck vs ok (approx from loss slope)
for s in (0,3): print("seed",s,"loss@100,1000,3000,10000",losses[[99,999,2999,9999],s])
np.save("xor_losses_ok.npy",losses[:,3]); np.save("xor_losses_stuck0.npy",losses[:,0]); np.save("xor_losses_stuck30.npy",losses[:,30])
# best-of-3 restarts (by final training loss)
good=0
for i in range(16):
    g=[3*i,3*i+1,3*i+2]; best=min(g,key=lambda s:L[s]); good+=ok[best]
print("restarts best-of-3 groups success",good,"/16")
# 3-hidden detail
ok3,L3,first3,losses3,_,_=batch_xor(seeds,h=3,record=True); print("3 hidden",ok3.sum(),np.median(first3[first3>0]))
np.save("xor_losses_h3_s0.npy",losses3[:,0])
# time per epoch not needed. Also final outputs for the canonical seed 3 (base) 
print("final outputs seed3",p[3])
# correct predicted outputs for report with h=3 seed 0

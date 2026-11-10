import random
from id3 import *
from exp import genC, addnoise, loo
def proba(node,x):
    while node.attr:
        v=x[ATTRS.index(node.attr)]
        if v not in node.children: break
        node=node.children[v]
    y,n=node.counts; return y/(y+n)
def predt(node,x,tau): return "Yes" if proba(node,x)>=tau else "No"
def loo_tau(rows,tau,**kw):
    y=[];p=[]
    for i in range(len(rows)):
        tr=rows[:i]+rows[i+1:]; t=id3(tr,ATTRS,**kw); y.append(rows[i][-1]); p.append(predt(t,rows[i][:-1],tau))
    return metrics(y,p)
L2=B+N+T
for tau in (0.5,0.4,0.3):
    for kw in (dict(maxd=1),dict(maxd=2),dict(min_split=4)):
        m=loo_tau(L2,tau,**kw); print("LOO L2",tau,kw,{k:round(v,3) for k,v in m.items()})
# On C with 10% noise, 60 train
C=[tuple(r) for r in genC(600,0,42)]
trC,teC=C[:400],C[400:]
for ntr in (60,400):
  for rate in (0,0.05,0.1):
    for name,kw in [("full",{}),("ctrl",dict(min_split=10,min_gain=0.02))]:
      for tau in (0.5,0.35):
        A=[];R=[];P=[];S=[]
        for sd in range(20):
            sub=random.Random(sd).sample(trC,ntr); tn=addnoise(sub,rate,sd); t=id3(tn,ATTRS,**kw)
            m=metrics([r[-1] for r in teC],[predt(t,r[:-1],tau) for r in teC]); A.append(m["acc"]);R.append(m["rec"]);P.append(m["prec"]);S.append(stats(t)[1])
        print(ntr,rate,name,tau,"acc",round(sum(A)/20,3),"rec",round(sum(R)/20,3),"prec",round(sum(P)/20,3),"nodes",round(sum(S)/20,1))
# dataset C characteristics
from collections import Counter
print(Counter(r[-1] for r in C))
# informative query
import itertools
from ml import *
V=[('Low','Irregular','?','?','Passive','?'),('Low','Irregular','?','?','?','?'),('Low','?','?','?','Passive','?'),('Low','?','?','?','?','?'),('?','Irregular','?','?','Passive','?'),('?','?','?','?','Passive','?')]
cand=[]
for x in itertools.product(*A_dom):
    v=sum(covers(h,x) for h in V)
    if v==3: cand.append(x)
print(len(cand),cand[:10])
q=('Low','Regular','High','Strong','Passive','No'); print(sum(covers(h,q) for h in V))
for q in [("Low","Regular","Low","Weak","Passive","No"),("Medium","Irregular","High","Strong","Passive","Yes")]:
    print(q,[covers(h,q) for h in V])

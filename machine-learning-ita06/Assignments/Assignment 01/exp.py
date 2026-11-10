import random, math, json, itertools
from collections import Counter
from id3 import *
from ml import ce
random.seed(42)
L=B+T
# 10A.2 : LOOCV and 5-fold on 20
def loo(rows,**kw):
    y=[];p=[]
    for i in range(len(rows)):
        tr=rows[:i]+rows[i+1:]; t=id3(tr,ATTRS,**kw); y.append(rows[i][-1]); p.append(predict(t,rows[i][:-1]))
    return metrics(y,p)
print("LOO full",loo(L)); print("LOO d1",loo(L,maxd=1)); print("LOO d2",loo(L,maxd=2))
print("LOO minsplit4",loo(L,min_split=4))
print("T full",metrics([r[-1] for r in T],[predict(id3(B,ATTRS),r[:-1]) for r in T]))
print("T d1",metrics([r[-1] for r in T],[predict(id3(B,ATTRS,maxd=1),r[:-1]) for r in T]))
# depth sweep (train on B, val=T)  
for d in range(0,5):
    t=id3(B,ATTRS,maxd=d); print("depth",d,stats(t),round(acc(t,B),4),round(acc(t,T),4))
# LOO per depth 
for d in range(0,5): print("LOO depth",d,round(loo(L,maxd=d)["acc"],4), round(loo(L,maxd=d)["rec"],4))
# learning curve on B with val T: average over 20 random subsets
def lc(rows,val,sizes,reps=30):
    out=[]
    for s in sizes:
        tr_a=[];va_a=[]
        for r in range(reps):
            sub=random.sample(rows,s); t=id3(sub,ATTRS); tr_a.append(acc(t,sub)); va_a.append(acc(t,val))
        out.append((s,sum(tr_a)/reps,sum(va_a)/reps))
    return out
random.seed(1); print("LC",lc(B,T,[4,6,8,10,12,14]))
# CE on B restricted to attrs: treat B as 4-attr concept learning
dom=[["Low","Medium","High"],["Irregular","Regular"],["Passive","Active"],["Weak","Strong"]]
print("CE on B"); ce(B,dom)
# Dataset C generator
def genC(n,noise,seed):
    rnd=random.Random(seed); rows=[]
    for _ in range(n):
        a=rnd.choice(["Low","Medium","High"]); s=rnd.choice(["Irregular","Regular"]); l=rnd.choice(["Passive","Active"]); c=rnd.choice(["Weak","Strong"])
        y="Yes" if (c=="Weak" and (a!="High" or s=="Irregular")) or (c=="Strong" and a=="Low" and s=="Irregular" and l=="Passive") else "No"
        rows.append([a,s,l,c,y])
    return rows
def addnoise(rows,rate,seed):
    rnd=random.Random(seed); out=[list(r) for r in rows]
    idx=rnd.sample(range(len(out)),int(rate*len(out)))
    for i in idx: out[i][-1]="No" if out[i][-1]=="Yes" else "Yes"
    return [tuple(r) for r in out]
C=[tuple(r) for r in genC(600,0,42)]
trC,teC=C[:400],C[400:]
print("C classes",Counter(r[-1] for r in C), "train",Counter(r[-1] for r in trC))
# learning curve with C
sizes=[4,6,8,10,12,14,25,50,100,200,400]
res=[]
for s in sizes:
    ta=[];va=[]
    for r in range(20):
        sub=random.Random(r).sample(trC,s); t=id3(sub,ATTRS); ta.append(acc(t,sub)); va.append(acc(t,teC))
    res.append((s,sum(ta)/20,sum(va)/20))
print("LC C",[(s,round(a,3),round(b,3)) for s,a,b in res])
# depth on C
dd=[]
for d in range(0,5):
    t=id3(trC,ATTRS,maxd=d); dd.append((d,stats(t),round(acc(t,trC),3),round(acc(t,teC),3)))
print("depth C",dd)
# noise
for rate in [0,0.05,0.10]:
    out={}
    for name,kw in [("full",{}),("ctrl",dict(min_split=20,min_gain=0.02))]:
        a=[];sz=[];lv=[];rc=[]
        for sd in range(10):
            tn=addnoise(trC,rate,sd); t=id3(tn,ATTRS,**kw); a.append(acc(t,teC)); sz.append(stats(t)[1]); lv.append(stats(t)[2])
            rc.append(metrics([r[-1] for r in teC],[predict(t,r[:-1]) for r in teC])["rec"])
        out[name]=(round(sum(a)/10,3),round(sum(sz)/10,1),round(sum(lv)/10,1),round(sum(rc)/10,3))
    print("noise",rate,out)
# Task 11: rebuild with N
B2=B+N
t2=id3(B2,ATTRS); show(t2); print(stats(t2),acc(t2,B2))
print("N1 pred",predict(t2,N[0][:-1]),"orig tree N1",predict(id3(B,ATTRS),N[0][:-1]))
for n in N: print(n,predict(id3(B,ATTRS),n[:-1]),predict(t2,n[:-1]))
log=[];t2=id3(B2,ATTRS,log=log); print(log[:3])
print("T acc new tree",acc(t2,T),metrics([r[-1] for r in T],[predict(t2,r[:-1]) for r in T]))
# recall: orig tree on N
print("orig recall on N",sum(predict(id3(B,ATTRS),n[:-1])=="Yes" for n in N),"/3")
# LOO with B2+T
L2=B2+T
print("LOO L2 full",loo(L2)); print("LOO L2 d1",loo(L2,maxd=1)); print("LOO L2 d2",loo(L2,maxd=2))

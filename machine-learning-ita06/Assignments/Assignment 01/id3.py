import math, random
from collections import Counter
ATTRS=["Attendance","Assignments","LMS","PriorCGPA"]
B=[("Low","Irregular","Passive","Weak","Yes"),("Low","Irregular","Passive","Strong","Yes"),("Low","Regular","Active","Weak","Yes"),("Low","Regular","Active","Strong","No"),
("Medium","Irregular","Passive","Weak","Yes"),("Medium","Irregular","Active","Strong","No"),("Medium","Regular","Passive","Weak","Yes"),("Medium","Regular","Active","Strong","No"),
("High","Irregular","Passive","Weak","Yes"),("High","Irregular","Active","Strong","No"),("High","Regular","Passive","Strong","No"),("High","Regular","Active","Weak","No"),
("Medium","Irregular","Passive","Strong","No"),("Low","Irregular","Active","Weak","Yes")]
T=[("Low","Irregular","Active","Strong","No"),("Medium","Regular","Active","Weak","No"),("High","Regular","Passive","Weak","Yes"),("Medium","Irregular","Active","Weak","Yes"),("Low","Regular","Passive","Strong","No"),("High","Irregular","Active","Weak","Yes")]
N=[("Very Low","Irregular","Passive","Weak","Yes"),("High","Regular","Active","Strong","Yes"),("Low","Regular","Passive","Weak","Yes")]
def H(rows):
    n=len(rows)
    if n==0: return 0.0
    c=Counter(r[-1] for r in rows); return -sum(v/n*math.log2(v/n) for v in c.values() if v)
def gain(rows,a,attrs=ATTRS):
    i=attrs.index(a); n=len(rows); w=0
    for v in set(r[i] for r in rows):
        s=[r for r in rows if r[i]==v]; w+=len(s)/n*H(s)
    return H(rows)-w
def splitinfo(rows,a,attrs=ATTRS):
    i=attrs.index(a); n=len(rows); c=Counter(r[i] for r in rows)
    return -sum(v/n*math.log2(v/n) for v in c.values())
def maj(rows,default="Yes"):
    c=Counter(r[-1] for r in rows)
    if not c: return default
    if c["Yes"]>=c["No"]: return "Yes"   # tie -> Yes (favour recall)
    return "No"
class Node:
    def __init__(s,attr=None,label=None,children=None,n=None,counts=None):
        s.attr=attr;s.label=label;s.children=children or {};s.n=n;s.counts=counts
def id3(rows,attrs,avail=None,depth=0,maxd=None,min_split=2,min_gain=0.0,root=None,measure="gain",verbose=False,order=None,parent=None,log=None):
    if avail is None: avail=list(attrs)
    c=Counter(r[-1] for r in rows)
    lab=maj(rows,parent or "Yes")
    node=Node(label=lab,n=len(rows),counts=(c["Yes"],c["No"]))
    if len(c)<=1 or not avail or len(rows)<min_split or (maxd is not None and depth>=maxd): return node
    scores={a:(gain(rows,a,attrs) if measure=="gain" else (gain(rows,a,attrs)/splitinfo(rows,a,attrs) if splitinfo(rows,a,attrs)>0 else 0)) for a in avail}
    if log is not None: log.append((depth,len(rows),dict(scores)))
    if root and depth==0: best=root
    else:
        m=max(scores.values()); best=[a for a in avail if abs(scores[a]-m)<1e-12][0]  # tie -> first in column order
    if gain(rows,best,attrs)<=min_gain and min_gain>0: return node
    if gain(rows,best,attrs)<=1e-12: return node
    node.attr=best; node.label=lab
    i=attrs.index(best)
    for v in sorted(set(r[i] for r in rows)):
        sub=[r for r in rows if r[i]==v]
        node.children[v]=id3(sub,attrs,[a for a in avail if a!=best],depth+1,maxd,min_split,min_gain,root,measure,verbose,order,lab,log)
    return node
def predict(node,x,attrs=ATTRS):
    while node.attr:
        v=x[attrs.index(node.attr)]
        if v not in node.children: return node.label   # unseen value -> majority at this node
        node=node.children[v]
    return node.label
def stats(node):
    def d(n): return 0 if not n.children else 1+max(d(c) for c in n.children.values())
    def cnt(n): return 1+sum(cnt(c) for c in n.children.values())
    def lv(n): return 1 if not n.children else sum(lv(c) for c in n.children.values())
    return d(node),cnt(node),lv(node)
def acc(node,rows): return sum(predict(node,r[:-1])==r[-1] for r in rows)/len(rows)
def rules(node,path=()):
    if not node.children: return [(path,node.label)]
    out=[]
    for v,c in node.children.items(): out+=rules(c,path+((node.attr,v),))
    return out
def show(node,ind=0):
    if not node.children: print("  "*ind+f"-> {node.label} {node.counts}"); return
    for v,c in node.children.items():
        print("  "*ind+f"{node.attr}={v}"); show(c,ind+1)
def metrics(y,p):
    tp=sum(a=="Yes" and b=="Yes" for a,b in zip(y,p)); fn=sum(a=="Yes" and b=="No" for a,b in zip(y,p))
    fp=sum(a=="No" and b=="Yes" for a,b in zip(y,p)); tn=sum(a=="No" and b=="No" for a,b in zip(y,p))
    P=tp/(tp+fp) if tp+fp else 0; R=tp/(tp+fn) if tp+fn else 0; F=2*P*R/(P+R) if P+R else 0
    return dict(tp=tp,fn=fn,fp=fp,tn=tn,acc=(tp+tn)/len(y),prec=P,rec=R,f1=F)
if __name__=="__main__":
    print("H(B)=",H(B),Counter(r[-1] for r in B))
    log=[]
    t=id3(B,ATTRS,log=log); show(t); print(stats(t),acc(t,B),acc(t,T))
    for l in log: print(l)
    for a in ATTRS:
        i=ATTRS.index(a); print(a,"gain",round(gain(B,a),4),"SI",round(splitinfo(B,a),4),"GR",round(gain(B,a)/splitinfo(B,a),4))
        for v in sorted(set(r[i] for r in B)):
            s=[r for r in B if r[i]==v]; c=Counter(r[-1] for r in s); print("  ",v,len(s),c["Yes"],c["No"],round(H(s),4))
    print("StudentID gain",H(B),"SI",math.log2(14))
    t1=id3(B,ATTRS,maxd=1); show(t1); print(stats(t1),acc(t1,B),acc(t1,T))
    t0=id3(B,ATTRS,maxd=0); print(stats(t0),acc(t0,B),acc(t0,T),t0.label)
    ta=id3(B,ATTRS,root="Attendance"); show(ta); print("AttRoot",stats(ta),acc(ta,B),acc(ta,T))
    tm=id3(B,ATTRS,min_split=4); show(tm); print("minsplit4",stats(tm),acc(tm,B),acc(tm,T))
    print([ (p,l) for p,l in rules(t)])
    print("T preds",[predict(t,r[:-1]) for r in T])
    # sub-level logs
    for l in log: print(l)

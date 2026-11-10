import math, itertools
from collections import Counter
A_attrs=["Attendance","Assignments","StudyHours","PriorCGPA","LMS","Mentoring"]
A=[("Low","Irregular","Low","Weak","Passive","No","Yes"),
("Low","Irregular","Low","Strong","Passive","No","Yes"),
("High","Regular","High","Strong","Active","Yes","No"),
("Low","Irregular","High","Weak","Passive","Yes","Yes"),
("Medium","Irregular","High","Strong","Active","No","No")]
A_dom=[["Low","Medium","High"],["Irregular","Regular"],["Low","High"],["Weak","Strong"],["Passive","Active"],["No","Yes"]]
def covers(h,x): return all(a=="?" or a==b for a,b in zip(h,x))
def mgeq(h1,h2): 
    if "∅" in h2: return True
    return all(a=="?" or a==b for a,b in zip(h1,h2) if True) 
def ce(data,dom,verbose=True):
    n=len(dom); S={tuple(["∅"]*n)}; G={tuple(["?"]*n)}
    for i,r in enumerate(data,1):
        x,y=r[:-1],r[-1]
        if y=="Yes":
            G={g for g in G if covers(g,x)}
            newS=set()
            for s in S:
                if covers(s,x): newS.add(s)
                else:
                    if s==tuple(["∅"]*n): ns=tuple(x)
                    else: ns=tuple(a if a==b else "?" for a,b in zip(s,x))
                    if any(mgeq(g,ns) for g in G): newS.add(ns)
            S=newS
        else:
            S={s for s in S if not covers(s,x)}
            newG=set()
            for g in G:
                if not covers(g,x): newG.add(g)
                else:
                    for j in range(n):
                        if g[j]=="?":
                            for v in dom[j]:
                                if v!=x[j]:
                                    ng=list(g); ng[j]=v; ng=tuple(ng)
                                    if any(mgeq(ng,s) and s!=tuple(["∅"]*n) or s==tuple(["∅"]*n) for s in S): newG.add(ng)
            # remove less general than another
            newG={g for g in newG if not any(g!=o and mgeq(o,g) for o in newG)}
            G=newG
        if verbose: print(f"E{i} {y}\n  S={sorted(S)}\n  G={sorted(G)}")
        if not S or not G: print("  VERSION SPACE EMPTY"); break
    return S,G
if __name__=="__main__":
    print("---CE on A"); S,G=ce(A,A_dom)
    # version space enumeration
    allh=list(itertools.product(*[d+["?"] for d in A_dom]))
    def vs(S,G): return [h for h in allh if any(mgeq(h,s) for s in S) and any(mgeq(g,h) for g in G)]
    V=vs(S,G); print(len(V)); [print(v) for v in V]
    for q in [("Low","Regular","High","Weak","Passive","No"),("Low","Irregular","Low","Strong","Passive","Yes")]:
        print(q,[covers(h,q) for h in V])
    print("--- E6"); ce(A+[("Low","Irregular","Low","Weak","Passive","No","No")],A_dom)
    print("--- E7,E8")
    ce(A+[("Medium","Regular","High","Weak","Passive","No","Yes")],A_dom)
    ce(A+[("Medium","Regular","High","Weak","Passive","No","Yes"),("Low","Regular","High","Strong","Active","Yes","Yes")],A_dom)
    print("--- new pos in bias test")
    ce(A+[("High","Regular","High","Strong","Passive","No","Yes")],A_dom)
    # syntactic/semantic
    syn=1
    for d in A_dom: syn*=len(d)+2
    sem=1+math.prod(len(d)+1 for d in A_dom)
    print(syn,sem,math.prod(len(d) for d in A_dom))

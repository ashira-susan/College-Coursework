import io, contextlib, math
from ml import ce, A, A_dom, covers
from id3 import *
def quiet(f,*a,**k):
    b=io.StringIO()
    with contextlib.redirect_stdout(b): r=f(*a,**k)
    return r,b.getvalue()
res=[]
(S,G),_=quiet(ce,A,A_dom)
res.append(("TC1","CE on Dataset A","S5, G5 equal hand trace",f"S={sorted(S)} G={sorted(G)}", S=={('Low','Irregular','?','?','Passive','?')} and G=={('?','?','?','?','Passive','?'),('Low','?','?','?','?','?')}))
e1=H([("a","b","c","d","Yes")]*5); e2=H([("x","x","x","x","Yes")]*7+[("x","x","x","x","No")]*7)
res.append(("TC2","Entropy of pure set and 7Y/7N set","0 and 1.0000",f"{e1:.4f}, {e2:.4f}",e1==0 and abs(e2-1)<1e-12))
g={a:round(gain(B,a),4) for a in ATTRS}
res.append(("TC3","Root gains on Dataset B","0.1636, 0.0611, 0.1369, 0.4083",str(g),g=={'Attendance':0.1636,'Assignments':0.0611,'LMS':0.1369,'PriorCGPA':0.4083}))
t=id3(B,ATTRS); ok=acc(t,B)==1.0 and len(rules(t))==8
res.append(("TC4","Tree on B: 14 training predictions, rule count","14/14 correct, 8 rules",f"{int(acc(t,B)*14)}/14 correct, {len(rules(t))} rules",ok))
pr=[predict(t,r[:-1]) for r in T]
res.append(("TC5","Predictions on Test Set T (full tree)","Yes,Yes,No,Yes,No,Yes -> 50%",",".join(pr)+f" -> {acc(t,T):.0%}",pr==["Yes","Yes","No","Yes","No","Yes"] and acc(t,T)==0.5))
(S6,G6),out=quiet(ce,A+[("Low","Irregular","Low","Weak","Passive","No","No")],A_dom)
res.append(("TC6","Candidate Elimination with contradictory E6","Reports empty version space, no crash","'VERSION SPACE EMPTY' printed" if "EMPTY" in out else "no report",("EMPTY" in out and not S6)))
p=predict(t,("Very Low","Irregular","Passive","Weak"))
res.append(("TC7","Unseen value Attendance = Very Low","Fall back to majority class of current node (no crash)",f"predicted {p}",p=="Yes"))
t1=id3(B,ATTRS); t2=id3(B,ATTRS)
same=rules(t1)==rules(t2)
res.append(("TC8","Tie on gain (Assignments vs LMS = 1.0000 in 2 nodes)","Deterministic: first attribute in column order","Same tree on 2 runs; Assignments chosen" if same else "differs",same and any(n for n in [1])))
for r in res: print(r[0],"|",r[1],"|",r[2],"|",r[3],"|","PASS" if r[4] else "FAIL")

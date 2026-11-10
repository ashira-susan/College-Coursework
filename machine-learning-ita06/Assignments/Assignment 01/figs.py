import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch
import random
from id3 import *
from exp import genC, addnoise
plt.rcParams.update({"font.size":9,"font.family":"DejaVu Sans"})
NAVY="#1F3A5F"; TEAL="#2A9D8F"; RED="#C8553D"; GREY="#8892A0"
def box(ax,x,y,w,h,txt,fc="#EAF1F8",ec=NAVY,fs=8,bold=False):
    ax.add_patch(FancyBboxPatch((x-w/2,y-h/2),w,h,boxstyle="round,pad=0.02,rounding_size=0.08",fc=fc,ec=ec,lw=1.2))
    ax.text(x,y,txt,ha="center",va="center",fontsize=fs,fontweight="bold" if bold else "normal")
# 1 lattice
fig,ax=plt.subplots(figsize=(7.2,3.1)); ax.set_xlim(0,10); ax.set_ylim(0,6); ax.axis("off")
n={"g1":(2.6,5.2,"<Low,?,?,?,?,?>","G"),"g2":(7.4,5.2,"<?,?,?,?,Passive,?>","G"),
"a":(1.4,3.0,"<Low,Irregular,?,?,?,?>",""),"b":(5.0,3.0,"<Low,?,?,?,Passive,?>",""),"c":(8.6,3.0,"<?,Irregular,?,?,Passive,?>",""),
"s":(5.0,0.8,"<Low,Irregular,?,?,Passive,?>","S")}
edges=[("g1","a"),("g1","b"),("g2","b"),("g2","c"),("a","s"),("b","s"),("c","s")]
for u,v in edges: ax.annotate("",xy=(n[v][0],n[v][1]+0.4),xytext=(n[u][0],n[u][1]-0.4),arrowprops=dict(arrowstyle="-",color=GREY,lw=1.2))
for k,(x,y,t,r) in n.items():
    box(ax,x,y,3.0,0.8,t,fc={"G":"#FBE9E3","S":"#E2F3F0","":"#EAF1F8"}[r],ec={"G":RED,"S":TEAL,"":NAVY}[r],bold=bool(r))
ax.text(0.1,5.9,"More general (G boundary)",fontsize=8,color=RED); ax.text(0.1,0.1,"More specific (S boundary)",fontsize=8,color=TEAL)
ax.set_title("Version space after E1-E5: 6 hypotheses",fontsize=10,color=NAVY,fontweight="bold")
plt.tight_layout(); plt.savefig("fig_lattice.png",dpi=200); plt.close()
# tree drawer
def layout(node):
    # returns list of nodes with positions
    pos={}; counter=[0]
    def rec(nd,d):
        if not nd.children:
            x=counter[0]; counter[0]+=1; pos[id(nd)]=(x,-d); return x
        xs=[rec(c,d+1) for c in nd.children.values()]
        x=sum(xs)/len(xs); pos[id(nd)]=(x,-d); return x
    rec(node,0); return pos
def drawtree(node,fname,title,w=7.2,h=3.4):
    pos=layout(node); fig,ax=plt.subplots(figsize=(w,h)); ax.axis("off")
    def rec(nd):
        x,y=pos[id(nd)]
        for v,c in nd.children.items():
            cx,cy=pos[id(c)]; ax.plot([x,cx],[y-0.12,cy+0.12],color=GREY,lw=1)
            ax.text((x+cx)/2,(y+cy)/2+0.02,v,fontsize=7,ha="center",va="center",bbox=dict(fc="white",ec="none",pad=0.5))
            rec(c)
        if nd.children:
            ax.text(x,y,nd.attr,ha="center",va="center",fontsize=8,fontweight="bold",bbox=dict(boxstyle="round,pad=0.3",fc="#EAF1F8",ec=NAVY))
        else:
            col="#FBE9E3" if nd.label=="Yes" else "#E2F3F0"; ec=RED if nd.label=="Yes" else TEAL
            ax.text(x,y,f"{'At risk' if nd.label=='Yes' else 'Safe'}\n({nd.counts[0]}Y/{nd.counts[1]}N)",ha="center",va="center",fontsize=7.5,bbox=dict(boxstyle="round,pad=0.3",fc=col,ec=ec))
    rec(node); xs=[p[0] for p in pos.values()]; ys=[p[1] for p in pos.values()]
    ax.set_xlim(min(xs)-0.6,max(xs)+0.6); ax.set_ylim(min(ys)-0.5,0.5); ax.set_title(title,fontsize=10,color=NAVY,fontweight="bold")
    plt.tight_layout(); plt.savefig(fname,dpi=200); plt.close()
drawtree(id3(B,ATTRS),"fig_tree_full.png","ID3 tree on Dataset B: 13 nodes, 8 leaves, depth 3")
drawtree(id3(B,ATTRS,maxd=1),"fig_tree_m1.png","Pruned tree (depth 1)",w=3.4,h=2.2)
drawtree(id3(B+N,ATTRS),"fig_tree_new.png","Tree after adding N1-N3: 18 nodes, 11 leaves, depth 4",w=7.2,h=3.4)
# 2 learning + depth side-by-side
C=[tuple(r) for r in genC(600,0,42)]; trC,teC=C[:400],C[400:]
sizes=[4,6,8,10,12,14,25,50,100,200,400]
tr=[];va=[]
for s in sizes:
    a=[];b=[]
    for r in range(20):
        sub=random.Random(r).sample(trC,s); t=id3(sub,ATTRS); a.append(acc(t,sub)); b.append(acc(t,teC))
    tr.append(sum(a)/20); va.append(sum(b)/20)
dep=[];dtr=[];dva=[];dn=[]
for d in range(0,5):
    t=id3(trC,ATTRS,maxd=d); dtr.append(acc(t,trC)); dva.append(acc(t,teC)); dn.append(stats(t)[1])
dB_tr=[];dB_va=[]
for d in range(0,4):
    t=id3(B,ATTRS,maxd=d); dB_tr.append(acc(t,B)); dB_va.append(acc(t,T))
fig,axs=plt.subplots(1,3,figsize=(7.4,2.5))
ax=axs[0]; ax.plot(sizes,tr,"o-",color=NAVY,label="Training",ms=3); ax.plot(sizes,va,"s-",color=RED,label="Validation",ms=3); ax.set_xscale("log"); ax.set_xticks([4,14,50,400]); ax.set_xticklabels([4,14,50,400]); ax.set_xlabel("Training size"); ax.set_ylabel("Accuracy"); ax.set_title("Learning curve (Dataset C)",fontsize=9); ax.legend(fontsize=7); ax.set_ylim(0.5,1.03); ax.grid(alpha=.3)
ax=axs[1]; ax.plot(range(4),dB_tr,"o-",color=NAVY,label="Train (B)",ms=3); ax.plot(range(4),dB_va,"s-",color=RED,label="Test (T)",ms=3); ax.set_xticks(range(4)); ax.set_xlabel("Max depth"); ax.set_title("Complexity (B / T)",fontsize=9); ax.legend(fontsize=7); ax.set_ylim(0.3,1.05); ax.grid(alpha=.3)
ax=axs[2]
import numpy as np
rates=["0%","5%","10%"]; 
def noise(ntr,kw):
    out=[]
    for rate in (0,0.05,0.1):
        a=[]
        for sd in range(20):
            sub=random.Random(sd).sample(trC,ntr); tn=addnoise(sub,rate,sd); t=id3(tn,ATTRS,**kw); a.append(acc(t,teC))
        out.append(sum(a)/20)
    return out
nf=noise(60,{}); nc=noise(60,dict(min_split=10,min_gain=0.02))
x=np.arange(3); ax.bar(x-0.18,nf,0.36,color=NAVY,label="Full"); ax.bar(x+0.18,nc,0.36,color=TEAL,label="Controlled"); ax.set_xticks(x); ax.set_xticklabels(rates); ax.set_ylim(0.8,1.0); ax.set_xlabel("Label noise (60 train)"); ax.set_title("Effect of noise (C)",fontsize=9); ax.legend(fontsize=7); ax.grid(alpha=.3,axis="y")
plt.tight_layout(); plt.savefig("fig_exp.png",dpi=200); plt.close()
print("noise",nf,nc,"depthC",dtr,dva,dn)

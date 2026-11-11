import numpy as np, matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Circle
NAVY="#1F3A5F";TEAL="#2A9D8F";RED="#C8553D";GREY="#8892A0"
# Q1 architectures
def net(ax,layers,labels,title,hl=None):
    xs=np.linspace(0.12,0.88,len(layers)); pos=[]
    for li,(n,x) in enumerate(zip(layers,xs)):
        ys=np.linspace(0.8,0.2,n) if n>1 else [0.5]; pos.append([(x,y) for y in ys])
    for a,b in zip(pos[:-1],pos[1:]):
        for p in a:
            for q in b: ax.plot([p[0],q[0]],[p[1],q[1]],color=GREY,lw=0.7,zorder=1)
    cols=[ "#EAF1F8","#E2F3F0","#FBE9E3"] if len(layers)==3 else ["#EAF1F8","#FBE9E3"]
    for li,pts in enumerate(pos):
        for pi,(x,y) in enumerate(pts):
            ax.add_patch(Circle((x,y),0.045,fc=cols[li],ec=NAVY,lw=1.2,zorder=2))
            if li==0: ax.text(x-0.07,y,labels[0][pi],ha="right",va="center",fontsize=7)
            elif li==len(pos)-1: ax.text(x+0.07,y,labels[-1],ha="left",va="center",fontsize=7)
    for li,t in enumerate(hl): ax.text(xs[li],0.97,t,ha="center",fontsize=7,color=NAVY,fontweight="bold")
    ax.set_xlim(-0.12,1.18);ax.set_ylim(0.05,1.02);ax.axis("off");ax.set_title(title,fontsize=8,color=NAVY,fontweight="bold",pad=2)
fig,axs=plt.subplots(1,2,figsize=(7.4,2.3))
net(axs[0],[3,1],[["x1 roughness","x2 deviation","x3 vibration"],"p = σ(z)"],"A: No hidden layer (4 parameters)",["Input (3)","Output (1, sigmoid)"])
net(axs[1],[3,4,1],[["x1 roughness","x2 deviation","x3 vibration"],"p = σ(z₂)"],"B: One hidden layer 3-4-1 (21 parameters)",["Input (3)","Hidden (4, tanh)","Output (1, sigmoid)"])
plt.tight_layout();plt.savefig("fig_q1.png",dpi=200);plt.close()
# Q2 geometry
fig,axs=plt.subplots(1,2,figsize=(7.2,2.4)); P=np.array([[0,0],[0,1],[1,0],[1,1]])
for ax,y,title in zip(axs,([0,0,0,1],[0,1,1,0]),("Dispatch (AND): separable","Review flag (XOR): not separable")):
    for p,l in zip(P,y): ax.scatter(*p,s=140,c=RED if l else TEAL,edgecolors=NAVY,zorder=3); ax.text(p[0]+0.06,p[1]+0.06,f"({p[0]},{p[1]})→{l}",fontsize=7)
    ax.set_xlim(-0.25,1.5);ax.set_ylim(-0.25,1.4);ax.set_xlabel("Packaging complete",fontsize=7);ax.set_ylabel("Quality passed",fontsize=7);ax.set_title(title,fontsize=8,color=NAVY,fontweight="bold");ax.set_xticks([0,1]);ax.set_yticks([0,1]);ax.grid(alpha=.3)
t=np.linspace(-0.2,1.4,10); axs[0].plot(t,1.5-t,color=NAVY,ls="--"); axs[0].text(0.75,0.35,"x1+x2=1.5",fontsize=7,color=NAVY,rotation=-35)
axs[1].plot(t,0.5-t,color=GREY,ls=":"); axs[1].plot(t,1.5-t,color=GREY,ls=":"); axs[1].text(0.05,1.25,"no single line works",fontsize=7,color=RED)
plt.tight_layout();plt.savefig("fig_q2.png",dpi=200);plt.close()
# Q3 loss curves
ok=np.load("xor_losses_ok.npy");s0=np.load("xor_losses_stuck0.npy");s30=np.load("xor_losses_stuck30.npy");h3=np.load("xor_losses_h3_s0.npy")
fig,axs=plt.subplots(1,2,figsize=(7.2,2.3))
ax=axs[0]
for l,lab,c in ((ok,"seed 3 (succeeds)",TEAL),(s0,"seed 0 (stuck at 0.348)",RED),(s30,"seed 30 (stuck at 0.478)","#E9A23B")): ax.plot(l,label=lab,color=c,lw=1.4)
ax.set_xscale("log");ax.set_xlabel("Epoch (log)",fontsize=7);ax.set_ylabel("BCE loss",fontsize=7);ax.set_title("Q3: XOR with 2 hidden sigmoid units",fontsize=8,color=NAVY,fontweight="bold");ax.legend(fontsize=6);ax.grid(alpha=.3)
ax=axs[1]; ax.plot(s0,label="2 hidden, seed 0 (stuck)",color=RED,lw=1.4);ax.plot(h3,label="3 hidden, seed 0 (solved)",color=NAVY,lw=1.4);ax.set_xscale("log");ax.set_xlabel("Epoch (log)",fontsize=7);ax.set_title("Q7: same seed, redesigned network",fontsize=8,color=NAVY,fontweight="bold");ax.legend(fontsize=6);ax.grid(alpha=.3)
plt.tight_layout();plt.savefig("fig_q3.png",dpi=200);plt.close()
# Q7 network diagram
fig,ax=plt.subplots(figsize=(3.4,2.0)); net(ax,[2,3,1],[["x1","x2"],"ŷ"],"Redesigned 2-3-1 network (13 parameters)",["Input","Hidden (3, sigmoid)","Output"]); plt.tight_layout();plt.savefig("fig_q7net.png",dpi=200);plt.close()

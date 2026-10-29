import { useMemo, useState } from "react";

type Screen =
  | "welcome"
  | "home"
  | "products"
  | "details"
  | "cart"
  | "checkout"
  | "success"
  | "profile";

type IconName =
  | "arrow"
  | "bag"
  | "cart"
  | "check"
  | "chevron"
  | "filter"
  | "heart"
  | "home"
  | "minus"
  | "orders"
  | "plus"
  | "profile"
  | "search"
  | "star";

const images = {
  headphones:
    "https://images.unsplash.com/photo-1565259118992-d0dce38f9f26?auto=format&fit=crop&w=900&q=85",
  watch:
    "https://images.unsplash.com/photo-1537236440770-b76abe454cff?auto=format&fit=crop&w=900&q=85",
  perfume:
    "https://images.unsplash.com/photo-1620848616916-3efaf499adcb?auto=format&fit=crop&w=900&q=85",
  accessories:
    "https://images.unsplash.com/photo-1755645226165-468ab6b113ed?auto=format&fit=crop&w=900&q=85",
};

const products = [
  { name: "Aura Headphones", price: 129, rating: "4.9", image: images.headphones, tag: "Best seller" },
  { name: "Miro Classic Watch", price: 189, rating: "4.8", image: images.watch, tag: "New" },
  { name: "No. 08 Eau de Parfum", price: 84, rating: "4.7", image: images.perfume, tag: "Trending" },
  { name: "Everyday Tech Set", price: 149, rating: "4.9", image: images.accessories, tag: "Limited" },
];

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <path d="m15 18-6-6 6-6" />,
    bag: (
      <>
        <path d="M6 8h12l-1 12H7L6 8Z" />
        <path d="M9 9V6a3 3 0 0 1 6 0v3" />
      </>
    ),
    cart: (
      <>
        <path d="M3 4h2l2.4 10.5h9.8l2-7H6" />
        <circle cx="9" cy="19" r="1" />
        <circle cx="17" cy="19" r="1" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    filter: (
      <>
        <path d="M4 6h16" />
        <path d="M7 12h10" />
        <path d="M10 18h4" />
      </>
    ),
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />,
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10M9 20v-6h6v6" />
      </>
    ),
    minus: <path d="M5 12h14" />,
    orders: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="2" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    star: <path d="m12 2 3 6 6.5 1-4.7 4.6 1.1 6.4-5.9-3.1L6.1 20l1.1-6.4L2.5 9 9 8l3-6Z" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Logo({ light = false }: { light?: boolean }) {
  return (
    <button className="flex items-center gap-2" onClick={() => undefined} aria-label="ShopEase">
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${light ? "bg-white/15 text-white" : "bg-primary text-white"}`}>
        <Icon name="bag" size={19} />
      </span>
      <span className={`text-xl font-extrabold tracking-tight ${light ? "text-white" : "text-ink"}`}>
        Shop<span className={light ? "text-mint" : "text-primary"}>Ease</span>
      </span>
    </button>
  );
}

function TopBar({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between bg-canvas/95 px-5 pb-4 pt-5 backdrop-blur">
      <button className="icon-button" onClick={onBack} aria-label="Go back"><Icon name="arrow" /></button>
      <div className="text-[17px] font-bold text-ink">{title}</div>
      <div className="flex h-10 w-10 items-center justify-end">{action}</div>
    </header>
  );
}

function BottomNav({ active, go }: { active: string; go: (screen: Screen) => void }) {
  const items: { label: string; icon: IconName; screen: Screen }[] = [
    { label: "Home", icon: "home", screen: "home" },
    { label: "Browse", icon: "search", screen: "products" },
    { label: "Cart", icon: "cart", screen: "cart" },
    { label: "Profile", icon: "profile", screen: "profile" },
  ];
  return (
    <nav className="sticky bottom-0 z-30 mt-auto grid grid-cols-4 border-t border-line bg-white/95 px-2 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={() => go(item.screen)}
          className={`relative flex flex-col items-center gap-1 text-[11px] font-semibold transition ${active === item.screen ? "text-primary" : "text-muted"}`}
        >
          {item.screen === "cart" && <span className="absolute left-[55%] top-[-5px] grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[9px] text-white">2</span>}
          <Icon name={item.icon} size={21} />
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function Rating({ value = "4.9" }: { value?: string }) {
  return <span className="inline-flex items-center gap-1 text-xs font-bold text-ink"><span className="text-gold"><Icon name="star" size={13} /></span>{value}</span>;
}

function Welcome({ go }: { go: (screen: Screen) => void }) {
  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-primary px-6 pb-8 pt-8 text-white">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full border-[54px] border-white/5" />
      <Logo light />
      <div className="relative mt-14 overflow-hidden rounded-[32px] bg-sage p-3 shadow-2xl shadow-black/20">
        <img src={images.headphones} className="h-[330px] w-full rounded-[24px] object-cover object-center" alt="Black wireless headphones" />
        <span className="absolute bottom-7 left-7 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-primary backdrop-blur">Curated for you</span>
      </div>
      <div className="relative mt-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-mint">Welcome to ShopEase</p>
        <div className="max-w-xs text-[34px] font-extrabold leading-[1.08] tracking-tight">Everything you love, made easy.</div>
        <p className="mt-3 max-w-sm text-sm leading-6 text-white/70">Discover considered essentials, standout finds, and smooth delivery.</p>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-3 pt-8">
        <button className="rounded-2xl bg-white py-4 text-sm font-bold text-primary shadow-lg" onClick={() => go("home")}>Log in</button>
        <button className="rounded-2xl border border-white/30 bg-white/10 py-4 text-sm font-bold text-white" onClick={() => go("home")}>Sign up</button>
      </div>
      <button className="mt-4 text-sm font-semibold text-white/65" onClick={() => go("home")}>Continue as guest</button>
    </main>
  );
}

function Home({ go }: { go: (screen: Screen) => void }) {
  const [style, setStyle] = useState<"A" | "B">("A");
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <main className="flex-1 px-5 pb-6 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-muted">Good morning,</p>
            <div className="text-2xl font-extrabold tracking-tight text-ink">Taylor</div>
          </div>
          <button className="relative grid h-11 w-11 place-items-center rounded-full bg-white text-ink shadow-sm" onClick={() => go("cart")} aria-label="Open cart">
            <Icon name="bag" />
            <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full bg-coral text-[10px] font-bold text-white">2</span>
          </button>
        </div>

        <button onClick={() => go("products")} className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 text-left text-sm text-muted shadow-sm">
          <Icon name="search" size={19} /> Search products and brands
        </button>

        <div className="mt-6 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Explore</p>
            <div className="mt-0.5 text-xl font-extrabold text-ink">Shop your way</div>
          </div>
          <div className="flex rounded-xl bg-white p-1 shadow-sm" aria-label="Compare home styles">
            {(["A", "B"] as const).map((option) => (
              <button key={option} onClick={() => setStyle(option)} className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${style === option ? "bg-primary text-white" : "text-muted"}`}>{option}</button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-xs text-muted">{style === "A" ? "Style A · Image-focused" : "Style B · Compact & informative"}</p>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {["All", "Audio", "Wearables", "Beauty", "Lifestyle"].map((category, index) => (
            <button key={category} onClick={() => index > 0 && go("products")} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${index === 0 ? "bg-primary text-white" : "border border-line bg-white text-ink"}`}>{category}</button>
          ))}
        </div>

        <button onClick={() => go("products")} className="relative mt-5 w-full overflow-hidden rounded-[26px] bg-ink p-6 text-left text-white shadow-lg">
          <div className="relative z-10 w-[55%]">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-mint">Weekend edit</span>
            <div className="mt-2 text-2xl font-extrabold leading-tight">Essentials, upgraded.</div>
            <div className="mt-3 inline-flex items-center gap-1 text-xs font-bold">Shop 20% off <Icon name="chevron" size={15} /></div>
          </div>
          <img src={images.accessories} className="absolute right-0 top-0 h-full w-[48%] object-cover opacity-80 [mask-image:linear-gradient(to_right,transparent,black_35%)]" alt="Curated tech accessories" />
        </button>

        <div className="mt-7 flex items-center justify-between">
          <div className="text-lg font-extrabold text-ink">{style === "A" ? "Featured today" : "Popular picks"}</div>
          <button className="text-xs font-bold text-primary" onClick={() => go("products")}>View all</button>
        </div>

        {style === "A" ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {products.slice(0, 2).map((product) => (
              <button key={product.name} onClick={() => go("details")} className="group overflow-hidden rounded-[22px] bg-white p-2 text-left shadow-sm">
                <div className="relative overflow-hidden rounded-[17px] bg-sage">
                  <img src={product.image} className="h-44 w-full object-cover transition duration-500 group-hover:scale-105" alt={product.name} />
                  <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[9px] font-extrabold uppercase text-primary">{product.tag}</span>
                </div>
                <div className="px-2 pb-2 pt-3">
                  <div className="truncate text-sm font-bold text-ink">{product.name}</div>
                  <div className="mt-1 flex items-center justify-between"><span className="text-sm font-extrabold text-primary">${product.price}</span><Rating value={product.rating} /></div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            {products.slice(0, 3).map((product) => (
              <button key={product.name} onClick={() => go("details")} className="flex w-full items-center gap-3 rounded-2xl bg-white p-2.5 text-left shadow-sm">
                <img src={product.image} className="h-20 w-20 rounded-xl object-cover" alt={product.name} />
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wide text-primary">{product.tag}</span>
                  <div className="truncate text-sm font-bold text-ink">{product.name}</div>
                  <div className="mt-1 flex items-center gap-3"><span className="text-sm font-extrabold text-ink">${product.price}</span><Rating value={product.rating} /></div>
                  <div className="mt-1 text-[10px] text-muted">Free delivery · In stock</div>
                </div>
                <span className="text-muted"><Icon name="chevron" size={18} /></span>
              </button>
            ))}
          </div>
        )}
      </main>
      <BottomNav active="home" go={go} />
    </div>
  );
}

function ProductList({ go }: { go: (screen: Screen) => void }) {
  const [filter, setFilter] = useState("All");
  const [showFilters, setShowFilters] = useState(false);
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <TopBar title="Discover" onBack={() => go("home")} action={<button className="icon-button" onClick={() => setShowFilters(!showFilters)} aria-label="Filters"><Icon name="filter" /></button>} />
      <main className="flex-1 px-5 pb-6">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm text-muted"><Icon name="search" size={19} /><input className="w-full bg-transparent outline-none placeholder:text-muted" placeholder="Search in Audio" /></div>
        {showFilters && (
          <div className="mt-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between"><span className="text-sm font-bold text-ink">Quick filters</span><button className="text-xs font-bold text-primary" onClick={() => setFilter("All")}>Reset</button></div>
            <div className="mt-3 flex flex-wrap gap-2">{["Under $100", "4.5+ rating", "Free delivery"].map((item) => <button key={item} className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted">{item}</button>)}</div>
          </div>
        )}
        <div className="mt-5 flex gap-2 overflow-x-auto scrollbar-hide">
          {["All", "Headphones", "Speakers", "Accessories"].map((item) => <button key={item} onClick={() => setFilter(item)} className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold ${filter === item ? "bg-primary text-white" : "bg-white text-muted"}`}>{item}</button>)}
        </div>
        <div className="mb-4 mt-6 flex items-end justify-between"><div><div className="text-xl font-extrabold text-ink">Audio collection</div><p className="text-xs text-muted">24 curated products</p></div><button className="text-xs font-bold text-primary">Popular first</button></div>
        <div className="grid grid-cols-2 gap-3">
          {products.map((product) => (
            <button key={product.name} onClick={() => go("details")} className="overflow-hidden rounded-[20px] bg-white p-2 text-left shadow-sm">
              <div className="relative"><img src={product.image} className="h-40 w-full rounded-2xl object-cover" alt={product.name} /><span className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-ink"><Icon name="heart" size={15} /></span></div>
              <div className="px-1 pb-2 pt-3"><div className="truncate text-[13px] font-bold text-ink">{product.name}</div><div className="mt-1 flex items-center justify-between"><span className="text-sm font-extrabold text-primary">${product.price}</span><Rating value={product.rating} /></div></div>
            </button>
          ))}
        </div>
      </main>
      <BottomNav active="products" go={go} />
    </div>
  );
}

function ProductDetails({ go, addToCart }: { go: (screen: Screen) => void; addToCart: () => void }) {
  const [qty, setQty] = useState(1);
  return (
    <div className="min-h-dvh bg-canvas">
      <TopBar title="Product details" onBack={() => go("products")} action={<button className="icon-button" aria-label="Save product"><Icon name="heart" /></button>} />
      <main className="pb-32">
        <div className="mx-5 overflow-hidden rounded-[28px] bg-sage"><img src={images.headphones} className="h-[340px] w-full object-cover" alt="Aura wireless headphones in black" /></div>
        <div className="px-5 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div><span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-primary">Aura audio</span><div className="mt-1 text-2xl font-extrabold tracking-tight text-ink">Aura Headphones</div></div>
            <div className="text-2xl font-extrabold text-primary">$129</div>
          </div>
          <div className="mt-3 flex items-center gap-3"><Rating /><span className="text-xs text-muted">128 reviews</span><span className="rounded-full bg-mint/40 px-2 py-1 text-[10px] font-bold text-primary">In stock</span></div>
          <div className="my-6 h-px bg-line" />
          <div className="text-sm font-bold text-ink">Designed for all-day listening</div>
          <p className="mt-2 text-sm leading-6 text-muted">Immersive sound, plush memory foam cushions, and up to 30 hours of battery life in a refined, lightweight design.</p>
          <div className="mt-6 flex items-center justify-between">
            <div><div className="text-sm font-bold text-ink">Quantity</div><div className="text-xs text-muted">Ships within 24 hours</div></div>
            <div className="flex items-center gap-4 rounded-xl bg-white p-1.5 shadow-sm">
              <button className="grid h-8 w-8 place-items-center rounded-lg bg-canvas text-ink" onClick={() => setQty(Math.max(1, qty - 1))}><Icon name="minus" size={16} /></button>
              <span className="w-4 text-center text-sm font-bold">{qty}</span>
              <button className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-white" onClick={() => setQty(qty + 1)}><Icon name="plus" size={16} /></button>
            </div>
          </div>
        </div>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] border-t border-line bg-white/95 p-5 pb-[max(20px,env(safe-area-inset-bottom))] backdrop-blur">
        <button className="primary-button flex items-center justify-center gap-2" onClick={addToCart}><Icon name="bag" size={19} /> Add to cart · ${129 * qty}</button>
      </div>
    </div>
  );
}

function Cart({ go, quantity, setQuantity }: { go: (screen: Screen) => void; quantity: number; setQuantity: (q: number) => void }) {
  const subtotal = 129 * quantity + 84;
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <TopBar title="Your cart" onBack={() => go("details")} action={<span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-bold text-white">2</span>} />
      <main className="flex-1 px-5 pb-6">
        <p className="mb-4 text-xs text-muted">Two thoughtfully chosen items</p>
        <div className="space-y-3">
          <CartItem name="Aura Headphones" price={129} image={images.headphones} quantity={quantity} setQuantity={setQuantity} />
          <CartItem name="No. 08 Eau de Parfum" price={84} image={images.perfume} quantity={1} />
        </div>
        <div className="mt-7 rounded-[22px] bg-white p-5 shadow-sm">
          <div className="text-sm font-extrabold text-ink">Order summary</div>
          <div className="mt-4 space-y-3 text-sm"><SummaryRow label="Subtotal" value={`$${subtotal}`} /><SummaryRow label="Delivery" value="Free" accent /><SummaryRow label="Estimated tax" value="$17" /></div>
          <div className="my-4 border-t border-dashed border-line" />
          <div className="flex items-center justify-between"><span className="font-bold text-ink">Total</span><span className="text-xl font-extrabold text-primary">${subtotal + 17}</span></div>
        </div>
      </main>
      <div className="sticky bottom-0 border-t border-line bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))]"><button className="primary-button" onClick={() => go("checkout")}>Continue to checkout</button></div>
    </div>
  );
}

function CartItem({ name, price, image, quantity, setQuantity }: { name: string; price: number; image: string; quantity: number; setQuantity?: (q: number) => void }) {
  return (
    <div className="flex gap-3 rounded-[20px] bg-white p-3 shadow-sm">
      <img src={image} className="h-24 w-24 rounded-2xl object-cover" alt={name} />
      <div className="flex min-w-0 flex-1 flex-col py-1">
        <div className="truncate text-sm font-bold text-ink">{name}</div><span className="text-xs text-muted">Black · Standard</span>
        <div className="mt-auto flex items-center justify-between"><span className="text-sm font-extrabold text-primary">${price}</span>
          <div className="flex items-center gap-2 rounded-lg bg-canvas p-1">
            <button className="grid h-6 w-6 place-items-center" onClick={() => setQuantity?.(Math.max(1, quantity - 1))}><Icon name="minus" size={13} /></button><span className="w-4 text-center text-xs font-bold">{quantity}</span><button className="grid h-6 w-6 place-items-center" onClick={() => setQuantity?.(quantity + 1)}><Icon name="plus" size={13} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return <div className="flex justify-between"><span className="text-muted">{label}</span><span className={`font-semibold ${accent ? "text-primary" : "text-ink"}`}>{value}</span></div>;
}

function Checkout({ go, total }: { go: (screen: Screen) => void; total: number }) {
  const [payment, setPayment] = useState("visa");
  return (
    <div className="min-h-dvh bg-canvas">
      <TopBar title="Checkout" onBack={() => go("cart")} />
      <main className="space-y-4 px-5 pb-32">
        <section className="rounded-[22px] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><div className="text-sm font-extrabold text-ink">Delivery address</div><button className="text-xs font-bold text-primary">Change</button></div>
          <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-mint/40 text-primary"><Icon name="home" size={19} /></span><div><div className="text-sm font-bold text-ink">Home</div><p className="mt-1 text-xs leading-5 text-muted">Taylor Morgan<br />124 Meadow Lane, Portland, OR 97205</p></div></div>
        </section>
        <section className="rounded-[22px] bg-white p-5 shadow-sm">
          <div className="text-sm font-extrabold text-ink">Order summary</div>
          <div className="mt-4 flex items-center gap-3"><div className="flex -space-x-3"><img src={images.headphones} className="h-12 w-12 rounded-xl border-2 border-white object-cover" alt="" /><img src={images.perfume} className="h-12 w-12 rounded-xl border-2 border-white object-cover" alt="" /></div><div className="flex-1"><div className="text-sm font-bold text-ink">2 items</div><div className="text-xs text-muted">Arrives Wed, May 22</div></div><span className="font-extrabold text-ink">${total}</span></div>
        </section>
        <section className="rounded-[22px] bg-white p-5 shadow-sm">
          <div className="text-sm font-extrabold text-ink">Payment method</div>
          <div className="mt-4 space-y-2">
            <PaymentOption active={payment === "visa"} onClick={() => setPayment("visa")} title="•••• 4242" detail="Visa · Expires 09/28" mark="VISA" />
            <PaymentOption active={payment === "apple"} onClick={() => setPayment("apple")} title="Apple Pay" detail="Fast and secure checkout" mark="Pay" />
          </div>
        </section>
        <div className="rounded-2xl bg-mint/30 p-4 text-xs leading-5 text-primary">Your order includes free carbon-neutral delivery and easy 30-day returns.</div>
      </main>
      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[430px] border-t border-line bg-white/95 p-5 pb-[max(20px,env(safe-area-inset-bottom))] backdrop-blur">
        <button className="primary-button flex items-center justify-between px-5" onClick={() => go("success")}><span>Place order</span><span>${total}</span></button>
      </div>
    </div>
  );
}

function PaymentOption({ active, onClick, title, detail, mark }: { active: boolean; onClick: () => void; title: string; detail: string; mark: string }) {
  return <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${active ? "border-primary bg-primary/[0.04]" : "border-line"}`}><span className="grid h-10 w-12 place-items-center rounded-lg bg-ink text-[10px] font-extrabold text-white">{mark}</span><span className="flex-1"><span className="block text-sm font-bold text-ink">{title}</span><span className="text-[11px] text-muted">{detail}</span></span><span className={`grid h-5 w-5 place-items-center rounded-full border ${active ? "border-primary bg-primary text-white" : "border-line"}`}>{active && <Icon name="check" size={12} />}</span></button>;
}

function Success({ go, total }: { go: (screen: Screen) => void; total: number }) {
  return (
    <main className="flex min-h-dvh flex-col bg-canvas px-6 pb-8 pt-20 text-center">
      <div className="relative mx-auto grid h-28 w-28 place-items-center rounded-full bg-mint/50 text-primary"><span className="absolute inset-3 rounded-full bg-white shadow-sm" /><span className="relative grid h-14 w-14 place-items-center rounded-full bg-primary text-white"><Icon name="check" size={30} /></span></div>
      <div className="mt-8 text-[28px] font-extrabold tracking-tight text-ink">Order confirmed</div>
      <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-muted">Thank you, Taylor. Your order is packed with care and will be on its way soon.</p>
      <div className="mt-8 rounded-[24px] bg-white p-5 text-left shadow-sm">
        <div className="flex items-center justify-between border-b border-line pb-4"><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted">Order ID</p><p className="mt-1 text-sm font-extrabold text-ink">#SE-240518</p></div><span className="rounded-full bg-mint/40 px-3 py-1.5 text-[10px] font-bold text-primary">Confirmed</span></div>
        <div className="flex items-center justify-between pt-4"><div><p className="text-xs text-muted">Expected delivery</p><p className="mt-1 text-sm font-bold text-ink">Wednesday, May 22</p></div><div className="text-right"><p className="text-xs text-muted">Total</p><p className="mt-1 text-lg font-extrabold text-primary">${total}</p></div></div>
      </div>
      <div className="mt-auto space-y-3 pt-10"><button className="primary-button" onClick={() => go("profile")}>View order</button><button className="secondary-button" onClick={() => go("home")}>Continue shopping</button></div>
    </main>
  );
}

function Profile({ go }: { go: (screen: Screen) => void }) {
  const rows: { icon: IconName; title: string; detail: string; action?: Screen }[] = [
    { icon: "orders", title: "My orders", detail: "Track, return, or buy again", action: "success" },
    { icon: "home", title: "Addresses", detail: "2 saved addresses" },
    { icon: "heart", title: "Saved items", detail: "8 products" },
    { icon: "profile", title: "Account settings", detail: "Personal details and preferences" },
  ];
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <main className="flex-1 px-5 pb-6 pt-7">
        <div className="flex items-center justify-between"><Logo /><button className="text-xs font-bold text-primary" onClick={() => go("welcome")}>Sign out</button></div>
        <div className="mt-8 flex items-center gap-4 rounded-[24px] bg-primary p-5 text-white shadow-lg shadow-primary/15">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-mint text-xl font-extrabold text-primary">TM</div>
          <div><div className="text-lg font-extrabold">Taylor Morgan</div><div className="mt-1 text-xs text-white/65">taylor@example.com</div><span className="mt-2 inline-block rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-mint">Ease+ member</span></div>
        </div>
        <div className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-muted">Your account</div>
        <div className="mt-3 overflow-hidden rounded-[22px] bg-white shadow-sm">
          {rows.map((row, index) => (
            <button key={row.title} onClick={() => row.action && go(row.action)} className={`flex w-full items-center gap-3 p-4 text-left ${index < rows.length - 1 ? "border-b border-line" : ""}`}>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-canvas text-primary"><Icon name={row.icon} size={19} /></span><span className="flex-1"><span className="block text-sm font-bold text-ink">{row.title}</span><span className="text-[11px] text-muted">{row.detail}</span></span><span className="text-muted"><Icon name="chevron" size={17} /></span>
            </button>
          ))}
        </div>
        <div className="mt-5 rounded-[20px] border border-line bg-white p-4"><div className="flex items-center justify-between"><div><div className="text-sm font-bold text-ink">Notifications</div><div className="text-[11px] text-muted">Offers and order updates</div></div><button className="flex h-7 w-12 items-center justify-end rounded-full bg-primary p-1"><span className="h-5 w-5 rounded-full bg-white shadow" /></button></div></div>
      </main>
      <BottomNav active="profile" go={go} />
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [quantity, setQuantity] = useState(1);
  const total = useMemo(() => 129 * quantity + 84 + 17, [quantity]);
  const go = (next: Screen) => {
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const views: Record<Screen, React.ReactNode> = {
    welcome: <Welcome go={go} />,
    home: <Home go={go} />,
    products: <ProductList go={go} />,
    details: <ProductDetails go={go} addToCart={() => go("cart")} />,
    cart: <Cart go={go} quantity={quantity} setQuantity={setQuantity} />,
    checkout: <Checkout go={go} total={total} />,
    success: <Success go={go} total={total} />,
    profile: <Profile go={go} />,
  };
  return (
    <div className="min-h-screen bg-stage">
      <div className="app-shell">{views[screen]}</div>
    </div>
  );
}

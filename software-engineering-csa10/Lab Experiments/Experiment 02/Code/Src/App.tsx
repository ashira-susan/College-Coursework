import { useMemo, useState, type ReactNode } from "react";

type Screen =
  | "login"
  | "home"
  | "results"
  | "seats"
  | "passengers"
  | "payment"
  | "confirmation"
  | "ticket"
  | "tours"
  | "tour-detail"
  | "profile";

type IconName =
  | "bus"
  | "arrow"
  | "calendar"
  | "location"
  | "user"
  | "ticket"
  | "search"
  | "star"
  | "clock"
  | "shield"
  | "check"
  | "card"
  | "wallet"
  | "bank"
  | "phone"
  | "swap"
  | "chevron"
  | "map"
  | "compass"
  | "logout"
  | "plus"
  | "download";

const photos = {
  hero: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1600",
  kerala: "https://images.unsplash.com/photo-1661174607003-d9d36388c916?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900",
  palms: "https://images.unsplash.com/photo-1633145284780-c8fda4f11464?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900",
  lake: "https://images.unsplash.com/photo-1708017128148-cc7a14180555?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900",
  mountain: "https://images.unsplash.com/photo-1600278553756-63bb83d95c0c?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=900",
  bus: "https://images.unsplash.com/photo-1562000372-fba2929fe39a?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1000",
};

const iconPaths: Record<IconName, ReactNode> = {
  bus: <><path d="M5 17h14V6.5C19 4 16.5 3 12 3S5 4 5 6.5V17Z"/><path d="M5 10h14M8 20v-3m8 3v-3M8 7h.01M16 7h.01"/></>,
  arrow: <><path d="m5 12 14 0m-5-5 5 5-5 5"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  ticket: <><path d="M3 7a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4V7Z"/><path d="M13 5v14"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  star: <path d="m12 3 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.9-5.4 2.9 1-6-4.3-4.2 6-.9L12 3Z"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  shield: <><path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/></>,
  wallet: <><path d="M4 6h14a2 2 0 0 1 2 2v11H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12"/><path d="M15 12h6v4h-6a2 2 0 0 1 0-4Z"/></>,
  bank: <><path d="m3 10 9-6 9 6M5 10v8m5-8v8m5-8v8m4-8v8M3 21h18"/></>,
  phone: <><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/></>,
  swap: <><path d="M7 7h11l-3-3m3 3-3 3M17 17H6l3 3m-3-3 3-3"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15m6-12v15"/></>,
  compass: <><circle cx="12" cy="12" r="9"/><path d="m15 9-2 4-4 2 2-4 4-2Z"/></>,
  logout: <><path d="M10 4H5v16h5M14 8l4 4-4 4m4-4H9"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  download: <><path d="M12 3v12m-4-4 4 4 4-4M5 20h14"/></>,
};

function Icon({ name, size = 20, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name]}
    </svg>
  );
}

function Button({ children, onClick, variant = "primary", className = "", type = "button" }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "ghost" | "dark"; className?: string; type?: "button" | "submit";
}) {
  return <button type={type} className={`btn btn-${variant} ${className}`} onClick={onClick}>{children}</button>;
}

function Field({ label, icon, defaultValue, type = "text", placeholder }: {
  label: string; icon?: IconName; defaultValue?: string; type?: string; placeholder?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field-control">
        {icon && <Icon name={icon} size={18} />}
        <input type={type} defaultValue={defaultValue} placeholder={placeholder} />
      </div>
    </label>
  );
}

function SelectField({ label, icon, children }: { label: string; icon?: IconName; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field-control">
        {icon && <Icon name={icon} size={18} />}
        <select>{children}</select>
      </div>
    </label>
  );
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <span className="brand-mark"><Icon name="bus" size={24} /></span>
      <span>Travel<span>Bud</span></span>
    </div>
  );
}

function Header({ navigate, screen }: { navigate: (s: Screen) => void; screen: Screen }) {
  return (
    <header className="header">
      <div className="container header-inner">
        <button className="brand-button" onClick={() => navigate("home")}><Brand /></button>
        <nav>
          <button className={screen === "home" ? "active" : ""} onClick={() => navigate("home")}>Home</button>
          <button className={screen === "tours" || screen === "tour-detail" ? "active" : ""} onClick={() => navigate("tours")}>Explore tours</button>
          <button onClick={() => navigate("profile")}>My bookings</button>
          <button onClick={() => navigate("profile")}>Help</button>
        </nav>
        <button className="profile-pill" onClick={() => navigate("profile")}>
          <span className="avatar">AK</span><span><small>Hello,</small> Aarav</span><Icon name="chevron" size={15} />
        </button>
      </div>
    </header>
  );
}

function Progress({ step }: { step: number }) {
  const steps = ["Select bus", "Choose seats", "Passengers", "Payment"];
  return (
    <div className="progress">
      {steps.map((item, i) => <div key={item} className={`progress-step ${i <= step ? "done" : ""}`}>
        <span>{i < step ? <Icon name="check" size={14} /> : i + 1}</span><b>{item}</b>
      </div>)}
    </div>
  );
}

function PageTitle({ eyebrow, title, text }: { eyebrow?: string; title: string; text?: string }) {
  return <div className="page-title">{eyebrow && <span>{eyebrow}</span>}<h1>{title}</h1>{text && <p>{text}</p>}</div>;
}

function SearchBar({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <div className="search-card">
      <div className="trip-toggle"><button className="active">One way</button><button>Round trip</button></div>
      <div className="search-fields">
        <Field label="From" icon="location" defaultValue="Bengaluru" />
        <button className="swap"><Icon name="swap" size={18} /></button>
        <Field label="To" icon="location" defaultValue="Chennai" />
        <Field label="Date of journey" icon="calendar" type="date" defaultValue="2026-06-18" />
        <SelectField label="Bus type" icon="bus"><option>AC • Sleeper</option><option>AC • Seater</option><option>Non-AC • Sleeper</option><option>Non-AC • Seater</option></SelectField>
        <Button onClick={() => navigate("results")} className="search-button"><Icon name="search" size={19} /> Search buses</Button>
      </div>
    </div>
  );
}

function Login({ navigate }: { navigate: (s: Screen) => void }) {
  const [signup, setSignup] = useState(false);
  return (
    <main className="login-page">
      <section className="login-visual" style={{ backgroundImage: `linear-gradient(120deg, rgba(8,46,49,.86), rgba(8,46,49,.18)), url(${photos.hero})` }}>
        <div className="login-brand"><Brand light /></div>
        <div className="login-copy">
          <span className="eyebrow light">YOUR NEXT STORY STARTS HERE</span>
          <h1>Go farther.<br />Feel closer.</h1>
          <p>Comfortable bus journeys and unforgettable guided tours, all in one cheerful place.</p>
          <div className="trust-row"><span><Icon name="shield" /> Safe & secure</span><span><Icon name="ticket" /> Easy booking</span><span><Icon name="phone" /> 24/7 support</span></div>
        </div>
        <p className="photo-credit">Photo by Juan Encalada on Unsplash</p>
      </section>
      <section className="login-panel">
        <div className="login-form">
          <span className="mobile-brand"><Brand /></span>
          <div className="sun-icon"><Icon name="compass" size={30} /></div>
          <h2>{signup ? "Create your account" : "Welcome back, traveller"}</h2>
          <p>{signup ? "Join TravelBud and start exploring." : "Sign in to continue your journey."}</p>
          {signup && <Field label="Full name" icon="user" placeholder="Your name" />}
          <Field label="Email or mobile number" icon="user" defaultValue="aarav@example.com" />
          <Field label="Password" icon="shield" type="password" defaultValue="travelbud" />
          {!signup && <div className="form-meta"><label><input type="checkbox" defaultChecked /> Remember me</label><button>Forgot password?</button></div>}
          <Button onClick={() => navigate("home")} className="wide">{signup ? "Create account" : "Login to TravelBud"} <Icon name="arrow" /></Button>
          <div className="or"><span>or continue with</span></div>
          <div className="social-row"><Button variant="secondary">G&nbsp;&nbsp; Google</Button><Button variant="secondary">f&nbsp;&nbsp; Facebook</Button></div>
          <p className="switch-auth">{signup ? "Already a member?" : "New to TravelBud?"} <button onClick={() => setSignup(!signup)}>{signup ? "Login" : "Create an account"}</button></p>
        </div>
      </section>
    </main>
  );
}

const destinationCards = [
  { name: "Kerala", sub: "Backwaters & palms", image: photos.kerala },
  { name: "Munnar", sub: "Misty green escapes", image: photos.palms },
  { name: "Udaipur", sub: "Lakes & heritage", image: photos.lake },
  { name: "Manali", sub: "Mountains & adventure", image: photos.mountain },
];

function Home({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <>
      <Header navigate={navigate} screen="home" />
      <main>
        <section className="hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(8,55,64,.84), rgba(8,55,64,.16)), url(${photos.hero})` }}>
          <div className="container hero-content">
            <span className="eyebrow light">THE ROAD IS CALLING</span>
            <h1>Where will your<br /><em>happy</em> take you?</h1>
            <p>Book trusted buses and discover handpicked getaways across India.</p>
          </div>
        </section>
        <div className="container search-overlap"><SearchBar navigate={navigate} /></div>
        <section className="container section">
          <div className="section-heading"><div><span className="eyebrow">LIMITED TIME</span><h2>Offers made for you</h2></div><button>View all offers <Icon name="arrow" size={17} /></button></div>
          <div className="offer-grid">
            <div className="offer-card yellow"><span className="offer-icon"><Icon name="ticket" /></span><div><small>FIRST RIDE</small><h3>Save 20% on your first booking</h3><p>Use code <b>HELLOBUD</b></p></div><strong>20%<small>OFF</small></strong></div>
            <div className="offer-card blue"><span className="offer-icon"><Icon name="bus" /></span><div><small>WEEKEND DEAL</small><h3>Adventure is better together</h3><p>Flat ₹250 off on 3+ seats</p></div><strong>₹250<small>OFF</small></strong></div>
            <div className="offer-card green"><span className="offer-icon"><Icon name="compass" /></span><div><small>TOUR SPECIAL</small><h3>Explore more, spend less</h3><p>10% off on tour packages</p></div><strong>10%<small>OFF</small></strong></div>
          </div>
        </section>
        <section className="section soft-bg">
          <div className="container">
            <div className="section-heading"><div><span className="eyebrow">WANDER THIS WAY</span><h2>Popular destinations</h2></div><button onClick={() => navigate("tours")}>Explore all <Icon name="arrow" size={17} /></button></div>
            <div className="destination-grid">
              {destinationCards.map((d) => <button key={d.name} className="destination" onClick={() => navigate("tour-detail")} style={{ backgroundImage: `linear-gradient(0deg, rgba(5,35,39,.78), transparent 65%), url(${d.image})` }}><span><b>{d.name}</b><small>{d.sub}</small></span><i><Icon name="arrow" size={18} /></i></button>)}
            </div>
          </div>
        </section>
        <section className="container section">
          <div className="day-tour">
            <div><span className="eyebrow light">YOUR DAY, YOUR WAY</span><h2>Book your bus<br />for the whole day</h2><p>Plan a college trip, family outing or city tour. Get a bus, professional driver and total freedom.</p><Button onClick={() => navigate("tours")} variant="primary">Explore day tours <Icon name="arrow" /></Button></div>
            <img src={photos.bus} alt="Blue tourist bus travelling through a scenic road" />
            <div className="day-badge"><Icon name="clock" /><b>12 hours</b><span>of adventure</span></div>
          </div>
        </section>
      </main>
      <Footer navigate={navigate} />
    </>
  );
}

const buses = [
  { operator: "GreenLine Travels", label: "Premium", start: "21:30", end: "05:45", duration: "8h 15m", type: "AC Sleeper (2+1)", price: "1,249", rating: "4.8", seats: 12 },
  { operator: "Orange Tours", label: "Popular", start: "22:15", end: "06:15", duration: "8h 00m", type: "Volvo Multi-Axle AC", price: "1,099", rating: "4.6", seats: 8 },
  { operator: "SRS Travels", label: "Great value", start: "23:00", end: "07:40", duration: "8h 40m", type: "AC Sleeper (2+1)", price: "899", rating: "4.4", seats: 19 },
];

function Results({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <>
      <Header navigate={navigate} screen="results" />
      <main className="page-bg">
        <div className="container"><Progress step={0} />
          <div className="route-summary"><div><b>Bengaluru</b><Icon name="arrow" /><b>Chennai</b><span>Wed, 18 Jun</span><span>1 traveller</span></div><Button variant="secondary" onClick={() => navigate("home")}>Modify search</Button></div>
          <div className="results-layout">
            <aside className="filter-card"><div className="filter-head"><h3>Filters</h3><button>Clear all</button></div>
              <Filter title="Departure time" items={["Before 8 PM", "8 PM – 10 PM", "After 10 PM"]} />
              <Filter title="Bus type" items={["AC", "Sleeper", "Seater", "Volvo"]} />
              <Filter title="Amenities" items={["Charging point", "Live tracking", "Water bottle"]} />
              <div className="filter-group"><h4>Price range</h4><input type="range" min="500" max="2000" defaultValue="1450" /><div className="range-label"><span>₹500</span><span>₹2,000</span></div></div>
            </aside>
            <section className="results-main">
              <div className="results-head"><div><h1>18 buses found</h1><p>Bengaluru to Chennai</p></div><SelectField label="Sort by"><option>Recommended</option><option>Price: low to high</option><option>Departure time</option></SelectField></div>
              {buses.map((bus, i) => <article className="bus-card" key={bus.operator}>
                <div className="bus-card-main"><div className="operator"><span className={`bus-logo bus-logo-${i}`}><Icon name="bus" /></span><div><small>{bus.label}</small><h3>{bus.operator}</h3><p>{bus.type}</p></div></div>
                  <div className="timing"><div><b>{bus.start}</b><span>Bengaluru</span></div><div className="duration"><span>{bus.duration}</span><i></i><small>Overnight</small></div><div><b>{bus.end}</b><span>Chennai</span></div></div>
                  <div className="bus-price"><span className="rating"><Icon name="star" size={14} /> {bus.rating}</span><small>Starts from</small><b>₹{bus.price}</b><span>{bus.seats} seats left</span><Button onClick={() => navigate("seats")}>Select seats</Button></div>
                </div>
                <div className="amenities"><span><Icon name="shield" /> Safe travels</span><span><Icon name="phone" /> Charging point</span><span><Icon name="location" /> Live tracking</span><button>View details</button></div>
              </article>)}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}

function Filter({ title, items }: { title: string; items: string[] }) {
  return <div className="filter-group"><h4>{title}</h4>{items.map((x, i) => <label key={x}><input type="checkbox" defaultChecked={i === 0 && title !== "Amenities"} /><span>{x}</span></label>)}</div>;
}

function Seats({ navigate, selected, setSelected }: { navigate: (s: Screen) => void; selected: string[]; setSelected: (s: string[]) => void }) {
  const booked = ["1A", "2B", "4A", "5B", "6A", "7B", "8A", "9B"];
  const seats = Array.from({ length: 20 }, (_, i) => `${Math.floor(i / 2) + 1}${i % 2 ? "B" : "A"}`);
  const toggle = (seat: string) => setSelected(selected.includes(seat) ? selected.filter((s) => s !== seat) : [...selected, seat]);
  return (
    <>
      <Header navigate={navigate} screen="seats" />
      <main className="page-bg"><div className="container"><Progress step={1} />
        <div className="route-summary"><div><b>GreenLine Travels</b><span>AC Sleeper (2+1)</span><span>21:30 → 05:45</span></div><button className="back-link" onClick={() => navigate("results")}>← Change bus</button></div>
        <PageTitle title="Choose your happy place" text="Select one or more seats for your journey." />
        <div className="seat-layout">
          <section className="seat-card">
            <div className="seat-legend"><span><i className="seat-demo"></i>Available</span><span><i className="seat-demo selected"></i>Selected</span><span><i className="seat-demo booked"></i>Booked</span><span className="ladies"><i></i>Reserved for women</span></div>
            <div className="deck-label"><span>Upper deck</span><small>Front of bus <Icon name="bus" size={17} /></small></div>
            <div className="bus-interior">
              <div className="driver">◯</div>
              <div className="seat-grid">{seats.map((seat) => <button key={seat} disabled={booked.includes(seat)} onClick={() => toggle(seat)} className={`seat ${booked.includes(seat) ? "booked" : ""} ${selected.includes(seat) ? "selected" : ""}`}><span>{seat}</span></button>)}</div>
              <div className="aisle">AISLE</div>
            </div>
          </section>
          <aside className="booking-summary"><h3>Your journey</h3><div className="mini-route"><div><b>21:30</b><small>Bengaluru</small></div><span><Icon name="arrow" /></span><div><b>05:45</b><small>Chennai</small></div></div>
            <hr /><p><Icon name="calendar" /> Wed, 18 Jun 2026</p><p><Icon name="clock" /> 8h 15m • Overnight</p>
            <hr /><div className="seat-selected"><span>Selected seats</span><div>{selected.length ? selected.map((s) => <b key={s}>{s}</b>) : <small>Choose a seat</small>}</div></div>
            <div className="fare"><span>Total fare <small>Including taxes</small></span><b>₹{selected.length * 1249 || 0}</b></div>
            <Button className="wide" onClick={() => selected.length && navigate("passengers")}>Continue <Icon name="arrow" /></Button>
            <small className="secure-note"><Icon name="shield" size={15} /> Your booking is safe and secure</small>
          </aside>
        </div>
      </div></main>
    </>
  );
}

function Passengers({ navigate, selected }: { navigate: (s: Screen) => void; selected: string[] }) {
  const seats = selected.length ? selected : ["3A"];
  return (
    <>
      <Header navigate={navigate} screen="passengers" />
      <main className="page-bg"><div className="container"><Progress step={2} />
        <div className="passenger-layout">
          <section><PageTitle eyebrow="ALMOST THERE" title="Who’s travelling?" text="Enter passenger details exactly as on a government ID." />
            {seats.map((seat, i) => <div className="passenger-card" key={seat}><div className="passenger-card-head"><span>{i + 1}</span><h3>Passenger {i + 1}</h3><b>Seat {seat}</b></div><div className="form-grid"><Field label="Full name" icon="user" defaultValue={i === 0 ? "Aarav Kumar" : ""} placeholder="Enter full name" /><SelectField label="Gender"><option>Male</option><option>Female</option><option>Other</option></SelectField><Field label="Age" type="number" defaultValue={i === 0 ? "21" : ""} placeholder="Age" /></div></div>)}
            <Button variant="secondary"><Icon name="plus" /> Add another passenger</Button>
            <div className="contact-card"><div><span><Icon name="ticket" /></span><div><h3>Booking updates</h3><p>Your ticket and live journey alerts will be sent here.</p></div></div><div className="form-grid two"><Field label="Email" defaultValue="aarav@example.com" /><Field label="Mobile number" defaultValue="+91 98765 43210" /></div></div>
          </section>
          <aside className="booking-summary compact"><h3>Fare summary</h3><div className="summary-line"><span>Seats</span><b>{seats.join(", ")}</b></div><div className="summary-line"><span>Base fare</span><b>₹{seats.length * 1190}</b></div><div className="summary-line"><span>Taxes & fees</span><b>₹{seats.length * 59}</b></div><hr /><div className="fare"><span>Total</span><b>₹{seats.length * 1249}</b></div><Button className="wide" onClick={() => navigate("payment")}>Proceed to payment <Icon name="arrow" /></Button></aside>
        </div>
      </div></main>
    </>
  );
}

function Payment({ navigate, total, isTour, setIsTour }: { navigate: (s: Screen) => void; total: number; isTour: boolean; setIsTour: (v: boolean) => void }) {
  const [method, setMethod] = useState("UPI");
  const methods: { name: string; icon: IconName; desc: string }[] = [
    { name: "UPI", icon: "phone", desc: "Google Pay, PhonePe, Paytm" },
    { name: "Card", icon: "card", desc: "Credit or debit card" },
    { name: "Net Banking", icon: "bank", desc: "All major Indian banks" },
    { name: "Wallet", icon: "wallet", desc: "Amazon Pay & more" },
  ];
  const pay = () => navigate("confirmation");
  return (
    <>
      <Header navigate={navigate} screen="payment" />
      <main className="page-bg"><div className="container">{!isTour && <Progress step={3} />}
        <div className="payment-layout">
          <section><PageTitle eyebrow="SAFE & SECURE" title="Choose how to pay" text="Your payment information is encrypted and protected." />
            <div className="payment-card">
              <div className="payment-tabs">{methods.map((m) => <button key={m.name} onClick={() => setMethod(m.name)} className={method === m.name ? "active" : ""}><Icon name={m.icon} /><span><b>{m.name}</b><small>{m.desc}</small></span></button>)}</div>
              <div className="payment-content">
                <span className="method-icon"><Icon name={methods.find((m) => m.name === method)?.icon || "card"} size={28} /></span>
                <h2>Pay with {method}</h2>
                {method === "UPI" && <><Field label="UPI ID" placeholder="yourname@bank" /><p className="hint">Open your UPI app after clicking Pay Now to approve the request.</p></>}
                {method === "Card" && <><Field label="Card number" placeholder="0000 0000 0000 0000" /><div className="form-grid two"><Field label="Expiry" placeholder="MM / YY" /><Field label="CVV" placeholder="•••" /></div></>}
                {method === "Net Banking" && <SelectField label="Select your bank"><option>HDFC Bank</option><option>State Bank of India</option><option>ICICI Bank</option></SelectField>}
                {method === "Wallet" && <SelectField label="Select wallet"><option>Amazon Pay</option><option>Paytm</option><option>Mobikwik</option></SelectField>}
              </div>
            </div>
          </section>
          <aside className="booking-summary payment-summary"><span className="secure-badge"><Icon name="shield" /> 100% secure payment</span><h3>{isTour ? "Tour package" : "Your trip"}</h3>
            {isTour ? <div className="tour-mini"><img src={photos.kerala} alt="" /><div><b>Kerala Backwater Escape</b><span>3 days • 2 nights</span></div></div> : <><div className="mini-route"><div><b>BLR</b><small>Bengaluru</small></div><span><Icon name="arrow" /></span><div><b>MAA</b><small>Chennai</small></div></div><p><Icon name="calendar" /> Wed, 18 Jun • 21:30</p></>}
            <hr /><div className="summary-line"><span>{isTour ? "1 traveller" : "Seat 3A"}</span><b>₹{isTour ? "6,499" : total.toLocaleString("en-IN")}</b></div><div className="summary-line discount"><span>TravelBud offer</span><b>− ₹250</b></div><hr /><div className="fare"><span>Amount payable</span><b>₹{(isTour ? 6249 : Math.max(total - 250, 999)).toLocaleString("en-IN")}</b></div>
            <Button className="wide pay-button" onClick={pay}>Pay now <Icon name="arrow" /></Button><small className="secure-note"><Icon name="shield" size={15} /> Protected by 256-bit encryption</small>
            {isTour && <button className="text-link" onClick={() => { setIsTour(false); navigate("home"); }}>Cancel tour booking</button>}
          </aside>
        </div>
      </div></main>
    </>
  );
}

function Confirmation({ navigate, isTour }: { navigate: (s: Screen) => void; isTour: boolean }) {
  return (
    <main className="confirmation-page">
      <div className="confetti c1"></div><div className="confetti c2"></div><div className="confetti c3"></div>
      <button className="confirmation-brand" onClick={() => navigate("home")}><Brand /></button>
      <section className="confirmation-card">
        <div className="success-icon"><Icon name="check" size={38} /></div>
        <span className="eyebrow">BOOKING CONFIRMED</span><h1>Your adventure is all set!</h1><p>We’ve sent your ticket and journey details to <b>aarav@example.com</b></p>
        <div className="ticket-preview">
          <div className="ticket-top"><div><small>{isTour ? "TOUR PACKAGE" : "GREENLINE TRAVELS"}</small><h2>{isTour ? "Kerala Backwater Escape" : "Bengaluru to Chennai"}</h2><span>{isTour ? "3 days • 2 nights" : "AC Sleeper (2+1)"}</span></div><QRCode /></div>
          <div className="ticket-dash"></div>
          <div className="ticket-details">
            <div><small>DATE</small><b>{isTour ? "20 Jun 2026" : "18 Jun 2026"}</b><span>Wednesday</span></div>
            <div><small>DEPARTURE</small><b>{isTour ? "06:30 AM" : "09:30 PM"}</b><span>{isTour ? "Majestic, Bengaluru" : "Silk Board, Bengaluru"}</span></div>
            <div><small>{isTour ? "TRAVELLERS" : "SEAT"}</small><b>{isTour ? "1 Adult" : "3A"}</b><span>{isTour ? "Aarav Kumar" : "Upper deck"}</span></div>
            <div><small>BOOKING ID</small><b>TB82941K</b><span>Confirmed</span></div>
          </div>
          <div className="ticket-fare"><span>Total paid</span><b>₹{isTour ? "6,249" : "999"}</b></div>
        </div>
        <div className="confirmation-actions"><Button onClick={() => navigate("ticket")}><Icon name="ticket" /> View digital ticket</Button><Button variant="secondary" onClick={() => navigate("home")}>Back to home</Button></div>
        <div className="support-note"><Icon name="phone" /><span><b>Need help?</b> Our travel support team is available 24/7.</span><button>Get support</button></div>
      </section>
    </main>
  );
}

function QRCode() {
  const cells = useMemo(() => Array.from({ length: 81 }, (_, i) => ((i * 7 + i * i + 3) % 5 < 2) || i % 10 === 0), []);
  return <div className="qr" aria-label="Booking QR code">{cells.map((on, i) => <i key={i} className={on ? "on" : ""}></i>)}</div>;
}

function Ticket({ navigate, isTour }: { navigate: (s: Screen) => void; isTour: boolean }) {
  return (
    <>
      <Header navigate={navigate} screen="ticket" />
      <main className="ticket-page"><div className="container narrow">
        <div className="ticket-page-head"><div><span className="eyebrow">DIGITAL TICKET</span><h1>You’re good to go</h1><p>Show this ticket and a valid ID when boarding.</p></div><Button variant="secondary"><Icon name="download" /> Download ticket</Button></div>
        <article className="digital-ticket">
          <div className="digital-header"><Brand light /><span>CONFIRMED <Icon name="check" size={14} /></span></div>
          <div className="digital-body">
            <div className="journey-title"><div><small>{isTour ? "GUIDED TOUR" : "OVERNIGHT JOURNEY"}</small><h2>{isTour ? "Kerala Backwater Escape" : "Bengaluru → Chennai"}</h2><p>{isTour ? "TravelBud Experiences • Premium Coach" : "GreenLine Travels • AC Sleeper (2+1)"}</p></div><QRCode /></div>
            <div className="ticket-route">
              <div><b>{isTour ? "06:30" : "21:30"}</b><span>{isTour ? "Bengaluru" : "Bengaluru"}</span><small>{isTour ? "Majestic Gate 4" : "Silk Board, Platform 2"}</small></div>
              <div className="route-line"><Icon name="bus" /><i></i><span>{isTour ? "3 days" : "8h 15m"}</span></div>
              <div><b>{isTour ? "20:00" : "05:45"}</b><span>{isTour ? "Kumarakom" : "Chennai"}</span><small>{isTour ? "Lake Resort" : "Koyambedu CMBT"}</small></div>
            </div>
            <div className="ticket-info-grid"><div><small>PASSENGER</small><b>Aarav Kumar</b></div><div><small>{isTour ? "GROUP" : "SEAT"}</small><b>{isTour ? "T-04" : "3A • Upper deck"}</b></div><div><small>TRAVEL DATE</small><b>{isTour ? "20 Jun 2026" : "18 Jun 2026"}</b></div><div><small>BOOKING ID</small><b>TB82941K</b></div></div>
          </div>
          <div className="digital-footer"><span><Icon name="shield" /> Verified by TravelBud</span><b>Total paid: ₹{isTour ? "6,249" : "999"}</b></div>
        </article>
        <div className="boarding-note"><Icon name="clock" /><div><b>Please arrive 20 minutes early</b><span>Boarding closes 5 minutes before departure.</span></div><button>View boarding point <Icon name="arrow" size={16} /></button></div>
        <div className="center"><Button variant="ghost" onClick={() => navigate("home")}>← Back to home</Button></div>
      </div></main>
    </>
  );
}

const tours = [
  { tag: "BESTSELLER", title: "Kerala Backwater Escape", place: "Alleppey & Kumarakom", duration: "3 days • 2 nights", price: "6,499", image: photos.kerala },
  { tag: "ADVENTURE", title: "Misty Munnar Weekend", place: "Munnar, Kerala", duration: "2 days • 1 night", price: "4,299", image: photos.palms },
  { tag: "CULTURE", title: "Lakes & Legends", place: "Udaipur, Rajasthan", duration: "3 days • 2 nights", price: "7,999", image: photos.lake },
  { tag: "MOST LOVED", title: "Mountain Calling", place: "Manali, Himachal", duration: "4 days • 3 nights", price: "9,499", image: photos.mountain },
];

function Tours({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <>
      <Header navigate={navigate} screen="tours" />
      <main>
        <section className="tours-hero" style={{ backgroundImage: `linear-gradient(90deg, rgba(7,56,59,.85), rgba(7,56,59,.1)), url(${photos.kerala})` }}><div className="container"><span className="eyebrow light">CURATED ADVENTURES</span><h1>See more than<br />just the road.</h1><p>Thoughtfully planned small-group bus tours with great stays, local guides and no planning stress.</p><div className="tour-search"><Field label="Where do you want to go?" icon="search" placeholder="Search destinations" /><SelectField label="Duration"><option>Any duration</option><option>Weekend</option><option>3–5 days</option></SelectField><Button>Find tours</Button></div></div></section>
        <section className="container section"><div className="section-heading"><div><span className="eyebrow">PACK A LITTLE HAPPINESS</span><h2>Trips worth taking</h2><p>Handpicked for curious travellers like you.</p></div><div className="category-pills"><button className="active">All tours</button><button>Weekend</button><button>Nature</button><button>Culture</button></div></div>
          <div className="tour-grid">{tours.map((tour) => <article className="tour-card" key={tour.title}><button className="tour-image" onClick={() => navigate("tour-detail")} style={{ backgroundImage: `url(${tour.image})` }}><span>{tour.tag}</span><i><Icon name="star" size={14} /> 4.8</i></button><div className="tour-content"><span><Icon name="location" size={16} /> {tour.place}</span><h3>{tour.title}</h3><p><Icon name="clock" size={16} /> {tour.duration} <i></i> Bus + stay + guide</p><div><span>from <b>₹{tour.price}</b> / person</span><Button onClick={() => navigate("tour-detail")} variant="secondary">View trip <Icon name="arrow" size={16} /></Button></div></div></article>)}</div>
        </section>
      </main>
      <Footer navigate={navigate} />
    </>
  );
}

function TourDetail({ navigate, setIsTour }: { navigate: (s: Screen) => void; setIsTour: (v: boolean) => void }) {
  const book = () => { setIsTour(true); navigate("payment"); };
  return (
    <>
      <Header navigate={navigate} screen="tour-detail" />
      <main className="tour-detail-page">
        <section className="tour-detail-hero"><div className="detail-main-img" style={{ backgroundImage: `linear-gradient(0deg, rgba(4,34,38,.62), transparent), url(${photos.kerala})` }}><button onClick={() => navigate("tours")}>← All tours</button><div><span className="eyebrow light">BESTSELLER • 4.9 RATED</span><h1>Kerala Backwater Escape</h1><p><Icon name="location" /> Alleppey & Kumarakom, Kerala</p></div></div><div className="detail-side"><img src={photos.palms} alt="Palm-lined Kerala backwater" /><img src={photos.lake} alt="Boats on a calm lake" /></div></section>
        <div className="container detail-layout">
          <section className="detail-content">
            <div className="tour-highlights"><span><Icon name="calendar" /><b>3 days</b><small>2 nights</small></span><span><Icon name="bus" /><b>Premium AC bus</b><small>From Bengaluru</small></span><span><Icon name="user" /><b>Local guide</b><small>English & Hindi</small></span><span><Icon name="shield" /><b>Stay included</b><small>Lakefront resort</small></span></div>
            <article><span className="eyebrow">WHY YOU’LL LOVE IT</span><h2>Slow mornings, green horizons</h2><p>Trade city noise for palm-lined canals, quiet village trails and sunsets that paint the water gold. We handle the route, stay and local experiences—you simply show up ready to explore.</p></article>
            <article><span className="eyebrow">YOUR ITINERARY</span><h2>Three wonderfully unhurried days</h2>
              <div className="itinerary"><div><span>01</span><div><small>DAY ONE</small><h3>Road to the backwaters</h3><p>Morning departure from Bengaluru, scenic drive, resort check-in and sunset canoe ride.</p><b><Icon name="map" /> Bengaluru → Kumarakom</b></div></div><div><span>02</span><div><small>DAY TWO</small><h3>Life along the water</h3><p>Guided village walk, traditional Kerala lunch and a relaxed houseboat cruise.</p><b><Icon name="compass" /> Local culture & cruise</b></div></div><div><span>03</span><div><small>DAY THREE</small><h3>One last lakeside morning</h3><p>Leisurely breakfast, bird sanctuary visit and an evening journey home.</p><b><Icon name="bus" /> Kumarakom → Bengaluru</b></div></div></div>
            </article>
            <article><span className="eyebrow">YOUR TRAVEL CREW</span><h2>Comfort and company included</h2><div className="crew-grid"><div><img src={photos.bus} alt="Premium blue tour bus" /><div><h3>Premium AC coach</h3><p>Reclining seats • Charging ports • 24 travellers max</p></div></div><div className="guide-card"><span className="guide-avatar">AM</span><div><h3>Anjali Menon</h3><p>Your local host • 6 years experience</p><span className="rating"><Icon name="star" size={14} /> 4.9 guide rating</span></div></div></div></article>
          </section>
          <aside className="tour-book-card"><span className="eyebrow">NEXT DEPARTURE</span><h3>20 – 22 June 2026</h3><p><Icon name="location" /> Pickup from Majestic, Bengaluru</p><hr /><div className="tour-price"><span>Starting from<small>per person, incl. taxes</small></span><b>₹6,499</b></div><ul><li><Icon name="check" /> Round-trip AC bus</li><li><Icon name="check" /> 2 nights lakefront stay</li><li><Icon name="check" /> Breakfast + 2 local meals</li><li><Icon name="check" /> Guide & activities</li></ul><Button className="wide" onClick={book}>Book this tour <Icon name="arrow" /></Button><small className="secure-note"><Icon name="shield" /> Free cancellation up to 7 days before</small></aside>
        </div>
      </main>
    </>
  );
}

function Profile({ navigate }: { navigate: (s: Screen) => void }) {
  return (
    <>
      <Header navigate={navigate} screen="profile" />
      <main className="page-bg profile-page"><div className="container">
        <PageTitle eyebrow="MY TRAVELBUD" title="Hello, Aarav!" text="Your trips, travellers and travel preferences in one place." />
        <div className="profile-layout">
          <aside className="profile-sidebar"><div className="profile-user"><span className="avatar large">AK</span><h3>Aarav Kumar</h3><p>aarav@example.com</p></div><nav><button className="active"><Icon name="ticket" /> My bookings</button><button><Icon name="user" /> Personal details</button><button><Icon name="user" /> Saved travellers</button><button><Icon name="wallet" /> Payments & refunds</button><button onClick={() => navigate("login")}><Icon name="logout" /> Log out</button></nav></aside>
          <section className="profile-content"><div className="profile-section-head"><div><h2>My bookings</h2><p>Your upcoming and past journeys.</p></div><Button onClick={() => navigate("home")}><Icon name="plus" /> Book a trip</Button></div>
            <div className="booking-tabs"><button className="active">Upcoming <span>1</span></button><button>Completed</button><button>Cancelled</button></div>
            <article className="profile-booking"><div className="profile-booking-top"><span><Icon name="bus" /></span><div><small>UPCOMING • WED, 18 JUN</small><h3>Bengaluru → Chennai</h3><p>GreenLine Travels • AC Sleeper</p></div><b>CONFIRMED</b></div><div className="profile-booking-details"><div><small>DEPARTURE</small><b>21:30</b><span>Silk Board</span></div><div><small>ARRIVAL</small><b>05:45</b><span>Koyambedu</span></div><div><small>SEAT</small><b>3A</b><span>Upper deck</span></div><div><small>BOOKING ID</small><b>TB82941K</b><span>₹999 paid</span></div></div><div className="profile-booking-actions"><button>Cancel booking</button><button>Get help</button><Button onClick={() => navigate("ticket")} variant="secondary">View ticket <Icon name="arrow" size={16} /></Button></div></article>
            <div className="saved-travellers"><div><h2>Saved travellers</h2><p>Book faster with saved passenger details.</p></div><button><Icon name="plus" /> Add traveller</button><div className="saved-person"><span className="avatar">AK</span><div><b>Aarav Kumar</b><small>Male • 21 years</small></div><button>Edit</button></div></div>
          </section>
        </div>
      </div></main>
    </>
  );
}

function Footer({ navigate }: { navigate: (s: Screen) => void }) {
  return <footer><div className="container footer-inner"><div><Brand light /><p>Good journeys. Great stories.</p></div><div><b>Travel</b><button onClick={() => navigate("home")}>Book a bus</button><button onClick={() => navigate("tours")}>Explore tours</button></div><div><b>Support</b><button>Help centre</button><button onClick={() => navigate("profile")}>My bookings</button></div><div><b>Made for the road</b><p>Safe, simple travel across India.</p></div></div></footer>;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [selectedSeats, setSelectedSeats] = useState<string[]>(["3A"]);
  const [isTour, setIsTour] = useState(false);
  const navigate = (next: Screen) => {
    if (next === "home" || next === "results" || next === "seats") setIsTour(false);
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const total = Math.max(selectedSeats.length, 1) * 1249;

  if (screen === "login") return <Login navigate={navigate} />;
  if (screen === "home") return <Home navigate={navigate} />;
  if (screen === "results") return <Results navigate={navigate} />;
  if (screen === "seats") return <Seats navigate={navigate} selected={selectedSeats} setSelected={setSelectedSeats} />;
  if (screen === "passengers") return <Passengers navigate={navigate} selected={selectedSeats} />;
  if (screen === "payment") return <Payment navigate={navigate} total={total} isTour={isTour} setIsTour={setIsTour} />;
  if (screen === "confirmation") return <Confirmation navigate={navigate} isTour={isTour} />;
  if (screen === "ticket") return <Ticket navigate={navigate} isTour={isTour} />;
  if (screen === "tours") return <Tours navigate={navigate} />;
  if (screen === "tour-detail") return <TourDetail navigate={navigate} setIsTour={setIsTour} />;
  return <Profile navigate={navigate} />;
}

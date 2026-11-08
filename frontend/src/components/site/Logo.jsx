import { Link } from "react-router-dom";

export const Logo = ({ light = false }) => (
  <Link to="/" data-testid="site-logo" className="flex items-center gap-3 group">
    <span className={`relative grid h-11 w-11 place-items-center ${light ? "bg-white/10 border border-white/20" : "bg-navy"} text-white font-display text-xl font-extrabold`}>
      N
      <span className="absolute bottom-0 right-0 h-3 w-3 bg-ember transition-transform duration-300 group-hover:scale-125" />
    </span>
    <span className="leading-none">
      <span className={`block font-display text-lg font-extrabold tracking-tight ${light ? "text-white" : "text-navy"}`}>NIRMAN PROJECTS GROUP</span>
      <span className="block font-mono text-[10px] tracking-[0.35em] text-ember-600">ALL WORKS & MATERIAL SUPPLIERS</span>
    </span>
  </Link>
);

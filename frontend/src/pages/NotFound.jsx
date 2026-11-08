import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="min-h-[60vh] grid place-items-center bg-navy blueprint text-center px-6" data-testid="not-found-page">
      <div>
        <div className="font-mono text-ember tracking-widest">404</div>
        <h1 className="mt-4 text-4xl sm:text-5xl font-bold text-white">Page not found</h1>
        <Button asChild className="mt-8 bg-ember hover:bg-ember-600 rounded-none h-12 px-8">
          <Link to="/" data-testid="not-found-home-btn">Back to Home</Link>
        </Button>
      </div>
    </section>
  );
}

/**
 * Hero picture (2 Nov 2026): a plane, clouds and landmarks, made with Canva's image generator from the
 * owner's reference image. It is decoration, so the alt text is empty. The plane carries no airline
 * livery or name: VootFly does not operate flights. The sky at the left was widened by mirroring the
 * picture's own sky so it covers any screen, and a pale wash keeps the headline readable over it.
 *
 * Computers: behind the headline, with the landmarks standing on the search card, as in the owner's
 * reference. Phones and tablets: a band between the text and the search card, never behind the text.
 */
const heroFile = (width: number) => `/images/home/hero-plane-landmarks-${width}.webp`;
export const HERO_SRCSET = [1300, 1800, 2400, 3426].map((w) => `${heroFile(w)} ${w}w`).join(", ");
export const HERO_SIZES = "(min-width: 1280px) max(1770px, 100vw), (min-width: 1024px) 1428px, (min-width: 640px) 1085px, 640px";

export function HeroArt() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-[15.1rem] overflow-hidden bg-[linear-gradient(180deg,#D6EAFC_0%,#E3F1FE_70%,#FFFFFF_100%)] sm:h-[21.25rem] lg:h-[15.6rem] xl:h-[max(19.4rem,17.5vw)]"
    >
      <img
        src={heroFile(1800)}
        srcSet={HERO_SRCSET}
        sizes={HERO_SIZES}
        alt=""
        width={3426}
        height={600}
        fetchPriority="high"
        decoding="sync"
        className="absolute bottom-0 right-0 h-[8.1rem] w-auto max-w-none [mask-image:linear-gradient(180deg,transparent_0%,#000_30%,#000_88%,transparent_100%)] sm:h-[11.9rem] lg:h-full lg:[mask-image:linear-gradient(180deg,#000_90%,transparent_100%)]"
      />
      <span className="absolute inset-0 hidden bg-[radial-gradient(ellipse_50%_95%_at_10%_22%,rgba(240,248,255,0.97)_0%,rgba(240,248,255,0.9)_50%,rgba(240,248,255,0)_100%)] lg:block" />
    </div>
  );
}

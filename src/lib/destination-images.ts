/**
 * Destination photos for homepage cards (added 27 Oct 2026).
 *
 * Every photo is a real photo of the named city, free to use under the
 * Unsplash License (no Unsplash+ / premium images). Each was checked on its
 * Unsplash page for licence and location before being added. Served from
 * Unsplash's image CDN, which resizes and converts to WebP/AVIF on the fly.
 *
 * A destination without an entry here simply shows no photo (a plain tile),
 * never a photo of somewhere else.
 */
export type DestinationImage = { id: string; alt: string; credit: string; page: string };

export const DESTINATION_IMAGES: Record<string, DestinationImage> = {
  bcn: { id: "photo-1550834415-4b47996578ff", alt: "Sagrada Familia in Barcelona", credit: "Giulia Angotti", page: "https://unsplash.com/photos/GXUagPlBk9I" },
  dxb: { id: "photo-1512453979798-5ea266f8880c", alt: "Burj Khalifa and the Dubai skyline", credit: "David Rodrigo", page: "https://unsplash.com/photos/Fr6zexbmjmc" },
  rom: { id: "photo-1514896856000-91cb6de818e0", alt: "The Colosseum in Rome", credit: "Braden Collum", page: "https://unsplash.com/photos/75XHJzEIeUc" },
  lon: { id: "photo-1758833600766-d639b70e5f46", alt: "Big Ben and the Houses of Parliament in London", credit: "Maik Winnecke", page: "https://unsplash.com/photos/v3nbIVKiETU" },
  par: { id: "photo-1610046226394-be65aabee26d", alt: "The Eiffel Tower in Paris", credit: "Diogo Fagundes", page: "https://unsplash.com/photos/0UUwsa6nDP4" },
  bkk: { id: "photo-1755251042986-91270ffd76f5", alt: "Wat Arun on the Chao Phraya River in Bangkok", credit: "Teodor Kuduschiev", page: "https://unsplash.com/photos/wd3tQvk0WXA" },
  del: { id: "photo-1596601133894-f5acb46b3732", alt: "India Gate in New Delhi at night", credit: "Rachit Chaudhary", page: "https://unsplash.com/photos/4TPjD2ic3qI" },
  sin: { id: "photo-1628221680019-f28a2716e727", alt: "Marina Bay Sands in Singapore", credit: "Keming Tan", page: "https://unsplash.com/photos/hGgM1F_Mq6g" },
  tyo: { id: "photo-1754379446407-215d8afdd1ff", alt: "Tokyo Tower among city skyscrapers", credit: "fan yang", page: "https://unsplash.com/photos/E86nLQqdsjc" },
  syd: { id: "photo-1674043581356-af41daf2ecee", alt: "Sydney Opera House on the harbour", credit: "Jo Barnes", page: "https://unsplash.com/photos/5IHB76yDsQM" },
  yto: { id: "photo-1765760046723-bccc5ae0299d", alt: "Toronto skyline with the CN Tower", credit: "Jim Luo", page: "https://unsplash.com/photos/OzqTeeo6CQA" },
  gox: { id: "photo-1560179406-1c6c60e0dc76", alt: "Baga Beach in Goa", credit: "Sarang Pande", page: "https://unsplash.com/photos/IijeyJbmrec" },
  auh: { id: "photo-1512632578888-169bbbc64f33", alt: "Sheikh Zayed Grand Mosque in Abu Dhabi", credit: "David Rodrigo", page: "https://unsplash.com/photos/kZ1zThg6G40" },
};

/**
 * Route photos for the homepage "Popular routes" cards (added 30 Oct 2026), keyed
 * "from-to" by place code.
 *
 * Each route shows a different landmark of its arrival city, so a route card never
 * repeats that city's destination card photo, or the photo of another route to the
 * same city (New York to London and Chicago to London). Same rules as above: a real
 * photo of that city, free under the Unsplash License, licence and location checked
 * on its Unsplash page. Add an entry here when adding a route to POPULAR.
 */
export const ROUTE_IMAGES: Record<string, DestinationImage> = {
  "nyc-lon": { id: "photo-1533929736458-ca588d08c8be", alt: "Tower Bridge over the River Thames in London", credit: "Charles Postiaux", page: "https://unsplash.com/photos/Q6UehpkBSnQ" },
  "chi-lon": { id: "photo-1587659901518-7020d4413085", alt: "The London Eye and County Hall on the River Thames in London", credit: "John Cameron", page: "https://unsplash.com/photos/8Qqq7mlO1Vo" },
  "nyc-par": { id: "photo-1652117524850-33f12e2444b2", alt: "The glass pyramid at the Louvre Museum in Paris", credit: "Matej Pribanic", page: "https://unsplash.com/photos/F7NgUz5K_4A" },
  "nyc-dxb": { id: "photo-1667592441284-b590021411e3", alt: "The Museum of the Future on Sheikh Zayed Road in Dubai", credit: "Ondrej Bocek", page: "https://unsplash.com/photos/3Q17UE2FZM4" },
  "lax-tyo": { id: "photo-1580167227251-be70f01b0c51", alt: "Senso-ji Temple gate in Asakusa, Tokyo", credit: "Nicholas Doherty", page: "https://unsplash.com/photos/l81GuxMKOHw" },
  "nyc-bcn": { id: "photo-1593368858664-a7fe556ab936", alt: "Mosaic bench at Park Güell overlooking Barcelona", credit: "D Jonez", page: "https://unsplash.com/photos/qiH16d5SRxg" },
};

/** Cropped CDN URL for a card photo (4:3 unless a ratio is given). Quality 80 keeps photos sharp on large and high-density screens. */
export function destinationImageUrl(img: DestinationImage, width: number, ratio = 4 / 3): string {
  const height = Math.round(width / ratio);
  return `https://images.unsplash.com/${img.id}?auto=format&fit=crop&w=${width}&h=${height}&q=80`;
}

/**
 * One photo for a destination, ready to render. Comes from a Pixabay photo
 * picked for that place and saved in VootFly's own storage (destination_photos
 * table), or, when none has been picked, from the Unsplash list above.
 */
export type DestPhoto = {
  /** Wide photo for page heroes (about 1280 to 1600 px wide). */
  url: string;
  /** Small photo for cards (4:3). */
  thumb: string;
  thumbSrcSet?: string;
  /** 1200 px social share image. */
  og: string;
  alt: string;
  credit: string | null;
  sourceName: "Pixabay" | "Unsplash";
  sourcePage: string | null;
};

/** Row shape of public.destination_photos (only the columns the site reads). */
export type StoredPhotoRow = {
  place_code: string;
  source: string;
  public_url: string;
  thumb_url: string;
  alt: string;
  credit: string | null;
  source_page_url: string | null;
};

export function photoFromStored(row: StoredPhotoRow): DestPhoto {
  return {
    url: row.public_url,
    thumb: row.thumb_url,
    og: row.public_url,
    alt: row.alt,
    credit: row.credit,
    sourceName: row.source === "unsplash" ? "Unsplash" : "Pixabay",
    sourcePage: row.source_page_url,
  };
}

export function photoFromUnsplash(img: DestinationImage, thumbRatio = 4 / 3): DestPhoto {
  const u = (w: number, h?: number) =>
    `https://images.unsplash.com/${img.id}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ""}&q=80`;
  const t = (w: number) => destinationImageUrl(img, w, thumbRatio);
  return {
    url: u(2000, 1125),
    thumb: t(600),
    thumbSrcSet: `${t(400)} 400w, ${t(600)} 600w, ${t(900)} 900w, ${t(1200)} 1200w`,
    og: u(1200, 630),
    alt: img.alt,
    credit: img.credit,
    sourceName: "Unsplash",
    sourcePage: img.page,
  };
}

/**
 * Best photo for a place: a saved (Pixabay) photo for the place itself, then
 * for its parent metro (so an airport such as LHR uses London's photo), then
 * the Unsplash photo for either. Null when there is no real photo of that place.
 */
export function resolveDestinationPhoto(
  code: string | null | undefined,
  parentCode: string | null | undefined,
  stored: Record<string, StoredPhotoRow>,
): DestPhoto | null {
  for (const c of [code, parentCode]) {
    if (c && stored[c]) return photoFromStored(stored[c]);
  }
  for (const c of [code, parentCode]) {
    if (c && DESTINATION_IMAGES[c]) return photoFromUnsplash(DESTINATION_IMAGES[c]);
  }
  return null;
}

/**
 * Photo for a "Popular routes" card: the route's own photo (16:9, to match the
 * card), ahead of any saved photo for the city. A route without one falls back
 * to the arrival city's photo.
 */
export function resolveRoutePhoto(
  fromCode: string,
  toCode: string,
  toParentCode: string | null | undefined,
  stored: Record<string, StoredPhotoRow>,
): DestPhoto | null {
  const img = ROUTE_IMAGES[`${fromCode}-${toCode}`];
  return img ? photoFromUnsplash(img, 16 / 9) : resolveDestinationPhoto(toCode, toParentCode, stored);
}

import Image, { type StaticImageData } from 'next/image';

/* Browser chrome frame — every screenshot runs on localhost, on purpose. */
export function BrowserFrame({
  image,
  lightImage,
  alt,
  sizes,
  priority = false,
}: {
  image: StaticImageData;
  lightImage?: StaticImageData;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-zinc-950 shadow-2xl shadow-black/30 ring-1 ring-white/10">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <span aria-hidden className="size-2.5 rounded-full bg-zinc-700" />
        <span aria-hidden className="size-2.5 rounded-full bg-zinc-700" />
        <span aria-hidden className="size-2.5 rounded-full bg-zinc-700" />
        <span className="mx-auto rounded-md bg-zinc-900 px-6 py-0.5 font-mono text-[11px] text-zinc-500">
          localhost:3000
        </span>
      </div>
      <Image
        src={image}
        alt={alt}
        priority={priority}
        sizes={sizes}
        className={lightImage ? 'hidden w-full dark:block' : 'w-full'}
      />
      {lightImage ? (
        <Image src={lightImage} alt={alt} sizes={sizes} className="w-full dark:hidden" />
      ) : null}
    </div>
  );
}

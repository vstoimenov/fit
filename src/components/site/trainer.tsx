"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { PHOTOS } from "@/lib/photos";
import type { VideoRef } from "@/lib/video/parse-video-url";
import { CTA, CTA_SECONDARY, DISPLAY, EYEBROW, WRAP } from "./styles";
import { VideoFacade } from "./video-facade";

/** Аксения: photo, her own introduction in the first person, an optional 60-second video. */
export function Trainer({ video }: { video: VideoRef | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  // The facade is mounted only while the dialog is open, so closing it also stops the video.
  const [open, setOpen] = useState(false);
  const show = () => {
    setOpen(true);
    dialog.current?.showModal();
  };
  return (
    <section id="aksenia" className="scroll-mt-20 bg-ink py-20 text-white lg:py-28">
      <div className={`${WRAP} grid items-center gap-10 lg:grid-cols-12 lg:gap-12`}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-white/5 lg:col-span-5">
          {/* TODO owner photo: replace the stock image with a real photo of Аксения. */}
          <Image
            src={PHOTOS.step2.src}
            alt="Аксения Михайлова"
            fill
            sizes="(min-width:1024px) 480px, 100vw"
            className="object-cover"
          />
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <p className={cn(EYEBROW, "text-white/70")}>Запознай се с мен!</p>
          <h2 className={`${DISPLAY} mt-3 text-4xl sm:text-[56px]`}>Аксения Михайлова</h2>
          <div className="mt-6 flex flex-col gap-4 text-lg leading-relaxed text-white/85">
            <p>
              Тренирам повече от 15 години. През това време преминах през различни спортове и
              тренировъчни методи – лека атлетика, фитнес, йога, HIIT и Tabata, както и още много
              други физически активности.
            </p>
            <p>
              Натрупаният опит и знания ми помогнаха да изградя собствена методика на трениране и да
              открия формулата, която съчетава динамика, разнообразие и ефективност и води до реални
              резултати.
            </p>
            <p>
              Днес споделям опита си с други жени. Моята мисия е да ги вдъхновявам да направят
              първата крачка към по-добрата версия на себе си, да открият силата на движението, да
              изградят увереност и да се научат да вярват и обичат себе си.
            </p>
            <p>
              Вярвам, че всичко започва с една малка стъпка, а постоянството е това, което ни
              отвежда до желаните резултати – и до мечтаното тяло, и до удовлетворението от самите
              нас.
            </p>
            <p className="font-bold text-white">
              Не е нужно да си силна, за да започнеш. Нужно е да започнеш, за да откриеш колко силна
              можеш да бъдеш!
            </p>
          </div>
          {video && (
            <>
              <button
                type="button"
                onClick={show}
                className={`${CTA} ${CTA_SECONDARY} mt-8 border-white text-white hover:bg-white hover:text-ink`}
              >
                <Play size={18} strokeWidth={2.2} aria-hidden="true" />
                Чуй я за 60 секунди
              </button>
              <dialog
                ref={dialog}
                aria-label="Видео с Аксения"
                className="m-auto w-[min(92vw,900px)] max-w-none rounded-3xl bg-ink p-3 backdrop:bg-ink/70"
                onClose={() => setOpen(false)}
                onClick={(e) => {
                  if (e.target === dialog.current) dialog.current?.close();
                }}
              >
                {open && (
                  <VideoFacade
                    video={video}
                    posterSrc={PHOTOS.step2.src}
                    title="Аксения за 60 секунди"
                  />
                )}
                <button
                  type="button"
                  onClick={() => dialog.current?.close()}
                  className="mt-3 inline-flex min-h-11 items-center rounded-full border-[1.5px] border-white px-5 text-[15px] font-bold text-white"
                >
                  Затвори
                </button>
              </dialog>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

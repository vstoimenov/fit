"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";
import { PHOTOS } from "@/lib/photos";
import type { VideoRef } from "@/lib/video/parse-video-url";
import { CTA, CTA_SECONDARY, DISPLAY, EYEBROW, WRAP } from "./styles";
import { VideoFacade } from "./video-facade";

/** Аксения: photo, three short paragraphs in the first person, an optional 60-second video. */
export function Trainer({ video }: { video: VideoRef | null }) {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <section id="aksenia" className="scroll-mt-20 bg-ink py-20 text-white lg:py-28">
      <div className={`${WRAP} grid items-center gap-10 lg:grid-cols-12 lg:gap-12`}>
        <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-[#1E1E1E] lg:col-span-5">
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
          <p className={`${EYEBROW} text-[#BDBBB4]`}>Треньорката</p>
          <h2 className={`${DISPLAY} mt-3 text-4xl sm:text-[56px]`}>Аксения Михайлова</h2>
          {/* TODO owner copy: the three paragraphs below are working text in Аксения's voice. */}
          <div className="mt-6 flex flex-col gap-4 text-lg leading-relaxed text-[#DDD]">
            <p>
              Тренирам жени от години и знам кога се отказват: не когато е трудно, а когато няма
              време. Затова всичко тук е 20 минути.
            </p>
            <p>
              Няма да ти обещавам тяло като от реклама. Обещавам ти, че след две седмици ще се
              качваш по стълбите по-леко и ще спиш по-добре.
            </p>
            <p>
              Клубът е за теб, ако искаш да започнеш и да не спираш. Не е за теб, ако търсиш бързо
              отслабване за две седмици.
            </p>
          </div>
          {video && (
            <>
              <button
                type="button"
                onClick={() => dialog.current?.showModal()}
                className={`${CTA} ${CTA_SECONDARY} mt-8 border-white text-white hover:bg-white hover:text-ink`}
              >
                <Play size={18} strokeWidth={2.2} aria-hidden="true" />
                Чуй я за 60 секунди
              </button>
              <dialog
                ref={dialog}
                aria-label="Видео с Аксения"
                className="m-auto w-[min(92vw,900px)] max-w-none rounded-3xl bg-ink p-3 backdrop:bg-ink/70"
                onClick={(e) => {
                  if (e.target === dialog.current) dialog.current?.close();
                }}
              >
                <VideoFacade
                  video={video}
                  posterSrc={PHOTOS.step2.src}
                  title="Аксения за 60 секунди"
                />
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

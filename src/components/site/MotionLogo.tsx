import { useEffect, useRef, useState } from "react";

/**
 * The VootFly logo reveal animation (mark -> wordmark -> tagline, then
 * fades out), re-encoded for the web from the original 1080p/1.78MB
 * source: MP4 (H.264, ~77KB) + WebM (VP9, ~93KB) at 760px wide, 24fps,
 * silent. A real chroma-key pass was attempted to give it a transparent
 * background but the available encoder could not preserve alpha through
 * VP9 encoding (verified by decoding the output back and finding the
 * alpha channel fully opaque) -- so it keeps its real flat #F8F9FC
 * background and is only ever placed on a light/white surface, where
 * that reads as an intentional card rather than a bug.
 *
 * Respects prefers-reduced-motion: no <video> element is created at all
 * for a user with that preference, only the static poster frame, so no
 * animation is forced on anyone who has asked not to see one.
 */
export function MotionLogo({
  className = "",
  onEnded,
  loop = false,
}: {
  className?: string;
  onEnded?: () => void;
  loop?: boolean;
}) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const onChange = () => setReducedMotion(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  if (reducedMotion) {
    return (
      <img
        src="/brand/vootfly-logo-poster.jpg"
        alt="VootFly. Search. Compare. Travel."
        className={className}
        width={760}
        height={428}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      className={className}
      width={760}
      height={428}
      autoPlay
      muted
      playsInline
      loop={loop}
      poster="/brand/vootfly-logo-poster.jpg"
      onEnded={onEnded}
      aria-label="VootFly. Search. Compare. Travel."
    >
      <source src="/brand/vootfly-logo-motion.webm" type="video/webm" />
      <source src="/brand/vootfly-logo-motion.mp4" type="video/mp4" />
    </video>
  );
}

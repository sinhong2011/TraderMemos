import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";

export function AnimatedHeight({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	const innerRef = useRef<HTMLDivElement>(null);
	const heightRef = useRef(0);
	const [height, setHeight] = useState(0);
	const [ready, setReady] = useState(false);
	const [animate, setAnimate] = useState(false);

	useLayoutEffect(() => {
		const el = innerRef.current;
		if (!el) return;

		const update = () => {
			const next = el.scrollHeight;
			const prev = heightRef.current;
			heightRef.current = next;
			setHeight(next);

			if (next > prev && ready) {
				setAnimate(false);
				requestAnimationFrame(() => {
					requestAnimationFrame(() => setAnimate(true));
				});
			}
		};

		update();
		const frame = requestAnimationFrame(() => {
			setReady(true);
			setAnimate(true);
		});

		const ro = new ResizeObserver(update);
		ro.observe(el);
		return () => {
			cancelAnimationFrame(frame);
			ro.disconnect();
		};
	}, [ready]);

	return (
		<div
			className={cn(
				"overflow-hidden transition-[height] duration-[260ms] ease-out motion-reduce:transition-none",
				className,
			)}
			style={{
				height: ready ? height : "auto",
				transition:
					ready && animate ? undefined : "height 0ms linear",
			}}
		>
			<div ref={innerRef} className="pb-px">
				{children}
			</div>
		</div>
	);
}
